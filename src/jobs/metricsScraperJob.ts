/**
 * 📊 METRICS SCRAPER JOB
 * 
 * SMART BATCH FIX: Scheduled job to collect metrics from posted tweets
 * Runs every 10 minutes to ensure we have fresh data for learning
 */

import { getSupabaseClient } from '../db';
import { BulletproofTwitterScraper } from '../scrapers/bulletproofTwitterScraper';
import { ScrapingOrchestrator } from '../metrics/scrapingOrchestrator';

export async function metricsScraperJob(): Promise<void> {
  console.log('[METRICS_JOB] 🔍 Starting scheduled metrics collection...');
  
  try {
    const supabase = getSupabaseClient();
    
    // PRIORITY 1: Recent tweets (last 3 days) - scrape aggressively
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const { data: recentPosts, error: recentError } = await supabase
      .from('content_metadata')
      .select('id, tweet_id, created_at')
      .eq('status', 'posted')
      .not('tweet_id', 'is', null)
      .gte('created_at', threeDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(15); // Scrape 15 most recent (last 3 days)
    
    // PRIORITY 2: Historical tweets (3-30 days old) - scrape less frequently
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const { data: historicalPosts, error: historicalError } = await supabase
      .from('content_metadata')
      .select('id, tweet_id, created_at')
      .eq('status', 'posted')
      .not('tweet_id', 'is', null)
      .lt('created_at', threeDaysAgo.toISOString())
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(5); // Only scrape 5 historical posts per cycle
    
    // Combine: prioritize recent, then add some historical
    const posts = [...(recentPosts || []), ...(historicalPosts || [])];
    
    const postsError = recentError || historicalError;
    
    if (postsError) {
      console.error('[METRICS_JOB] ❌ Failed to fetch posts:', postsError.message);
      return;
    }
    
    if (!posts || posts.length === 0) {
      console.log('[METRICS_JOB] ℹ️ No recent posts to scrape');
      return;
    }
    
    const recentCount = recentPosts?.length || 0;
    const historicalCount = historicalPosts?.length || 0;
    console.log(`[METRICS_JOB] 📊 Found ${posts.length} posts to check (${recentCount} recent, ${historicalCount} historical)`);
    
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    
    // PHASE 4: Use ScrapingOrchestrator instead of direct scraper
    const orchestrator = ScrapingOrchestrator.getInstance();
    
    for (const post of posts) {
      try {
        // Check if we collected metrics recently (skip if collected in last hour)
        const { data: lastMetrics } = await supabase
          .from('outcomes')
          .select('collected_at')
          .eq('decision_id', post.id)
          .order('collected_at', { ascending: false })
          .limit(1)
          .single();
        
        if (lastMetrics && 
            new Date(String(lastMetrics.collected_at)) > new Date(Date.now() - 60 * 60 * 1000)) {
          skipped++;
          continue; // Skip if collected in last hour
        }
        
        // Skip invalid tweet IDs (from cleanup)
        if (String(post.tweet_id).includes('verified_') || String(post.tweet_id).length < 19) {
          skipped++;
          continue;
        }
        
        console.log(`[METRICS_JOB] 🔍 Scraping ${post.tweet_id}...`);
        
        // Scrape fresh metrics with browser
        const browserManager = (await import('../lib/browser')).default;
        const page = await browserManager.newPage();
        
        try {
          // PHASE 4: Use orchestrator (includes validation, quality tracking, caching)
          const postedAt = new Date(String(post.created_at));
          const hoursSincePost = (Date.now() - postedAt.getTime()) / (1000 * 60 * 60);
          
          const result = await orchestrator.scrapeAndStore(page, String(post.tweet_id), {
            collectionPhase: 'scheduled_job',
            postedAt: postedAt
          });
          
          if (!result.success) {
            console.warn(`[METRICS_JOB] ⚠️ Scraping failed for ${post.tweet_id}: ${result.error}`);
            failed++;
            continue;
          }
          
          const metrics = result.metrics || {} as any;
          const isFirstHour = hoursSincePost <= 1;
          
          const totalEngagement = (metrics.likes ?? 0) + (metrics.retweets ?? 0) + 
                                  (metrics.quote_tweets ?? 0) + (metrics.replies ?? 0) + 
                                  (metrics.bookmarks ?? 0);
          
          // Log validation quality
          if (result.validationResult) {
            console.log(`[METRICS_JOB] 📊 Quality: confidence=${result.validationResult.confidence.toFixed(2)}, valid=${result.validationResult.isValid}`);
          }
          
          // Update outcomes table (for backward compatibility with existing systems)
          const { data: outcomeData, error: outcomeError } = await supabase.from('outcomes').upsert({
            decision_id: post.id,
            tweet_id: post.tweet_id,
            likes: metrics.likes ?? null,
            retweets: metrics.retweets ?? null,
            quote_tweets: metrics.quote_tweets ?? null,
            replies: metrics.replies ?? null,
            views: metrics.views ?? null,
            bookmarks: metrics.bookmarks ?? null,
            impressions: metrics.views ?? null, // Map views to impressions
            first_hour_engagement: isFirstHour ? totalEngagement : null,
            collected_at: new Date().toISOString(),
            data_source: 'orchestrator_v2',
            simulated: false
          }, { onConflict: 'decision_id' });
          
          if (outcomeError) {
            console.error(`[METRICS_JOB] ❌ Failed to write outcomes for ${post.tweet_id}:`, outcomeError.message);
            console.error(`[METRICS_JOB] 🔍 Error details:`, JSON.stringify(outcomeError, null, 2));
            failed++;
            continue;
          }
          
          // CRITICAL: Also update learning_posts table (used by 30+ learning systems!)
          const { error: learningError } = await supabase.from('learning_posts').upsert({
            tweet_id: post.tweet_id,
            likes_count: metrics.likes ?? 0,
            retweets_count: metrics.retweets ?? 0,
            replies_count: metrics.replies ?? 0,
            bookmarks_count: metrics.bookmarks ?? 0,
            impressions_count: metrics.views ?? 0,
            updated_at: new Date().toISOString()
          }, { onConflict: 'tweet_id' });
          
          if (learningError) {
            console.warn(`[METRICS_JOB] ⚠️ Failed to update learning_posts for ${post.tweet_id}:`, learningError.message);
            // Don't fail - outcomes table is the primary store
          }
          
          // CRITICAL: Also update tweet_metrics table (used by timing & quantity optimizers!)
          const { error: metricsError } = await supabase.from('tweet_metrics').upsert({
            tweet_id: post.tweet_id,
            likes_count: metrics.likes ?? 0,
            retweets_count: metrics.retweets ?? 0,
            replies_count: metrics.replies ?? 0,
            impressions_count: metrics.views ?? 0,
            updated_at: new Date().toISOString(),
            created_at: post.created_at
          }, { onConflict: 'tweet_id' });
          
          if (metricsError) {
            console.warn(`[METRICS_JOB] ⚠️ Failed to update tweet_metrics for ${post.tweet_id}:`, metricsError.message);
            // Don't fail - outcomes table is the primary store
          }
          
          console.log(`[METRICS_JOB] ✅ Updated ${post.tweet_id}: ${metrics.likes ?? 0} likes, ${metrics.views ?? 0} views`);
          updated++;
          
          // Update generator stats for autonomous learning
          try {
            const { data: metadata } = await supabase
              .from('content_metadata')
              .select('generator_name')
              .eq('id', post.id)
              .single();
            
            if (metadata && metadata.generator_name && typeof metadata.generator_name === 'string') {
              const { getGeneratorPerformanceTracker } = await import('../learning/generatorPerformanceTracker');
              const tracker = getGeneratorPerformanceTracker();
              await tracker.updateGeneratorStats(metadata.generator_name);
              console.log(`[METRICS_JOB] 📊 Updated generator stats for ${metadata.generator_name}`);
            }
          } catch (statsError: any) {
            console.warn(`[METRICS_JOB] ⚠️ Failed to update generator stats:`, statsError.message);
          }
          
        } finally {
          await page.close();
        }
        
        // Rate limit: wait 5 seconds between scrapes
        await new Promise(resolve => setTimeout(resolve, 5000));
        
      } catch (err: any) {
        console.error(`[METRICS_JOB] ⚠️ Failed ${post.tweet_id}: ${err.message}`);
        failed++;
        
        // Continue with next post, don't fail entire job
        continue;
      }
    }
    
    console.log(`[METRICS_JOB] ✅ Metrics collection complete: ${updated} updated, ${skipped} skipped, ${failed} failed`);
    
  } catch (error: any) {
    console.error('[METRICS_JOB] ❌ Metrics collection failed:', error.message);
    throw error;
  }
}

/**
 * Enhanced metrics scraper with velocity tracking
 * Runs less frequently but collects more detailed data
 */
export async function enhancedMetricsScraperJob(): Promise<void> {
  console.log('[ENHANCED_METRICS] 🔍 Starting enhanced metrics collection...');
  
  try {
    const supabase = getSupabaseClient();
    
    // Find posts that are 1h, 6h, 24h, or 7d old for velocity tracking
    const now = new Date();
    const timeWindows = [
      { hours: 1, label: '1h' },
      { hours: 6, label: '6h' }, 
      { hours: 24, label: '24h' },
      { hours: 168, label: '7d' } // 7 days
    ];
    
    for (const window of timeWindows) {
      const targetTime = new Date(now.getTime() - window.hours * 60 * 60 * 1000);
      const windowStart = new Date(targetTime.getTime() - 30 * 60 * 1000); // 30 min before
      const windowEnd = new Date(targetTime.getTime() + 30 * 60 * 1000);   // 30 min after
      
      const { data: posts } = await supabase
        .from('content_metadata')
        .select('id, tweet_id, created_at')
        .eq('status', 'posted')
        .not('tweet_id', 'is', null)
        .gte('created_at', windowStart.toISOString())
        .lte('created_at', windowEnd.toISOString())
        .limit(10);
      
      if (!posts || posts.length === 0) continue;
      
      console.log(`[ENHANCED_METRICS] 📊 Checking ${posts.length} posts at ${window.label} mark`);
      
      const scraper = BulletproofTwitterScraper.getInstance();
      
      for (const post of posts) {
        try {
          // Check if we already have velocity data for this window
          const { data: existing } = await supabase
            .from('post_velocity_tracking')
            .select('id')
            .eq('post_id', post.id)
            .eq('hours_after_post', window.hours)
            .single();
          
          if (existing) continue; // Already tracked
          
          // Skip invalid IDs
          if (String(post.tweet_id).includes('verified_') || String(post.tweet_id).length < 19) continue;
          
          const browserManager = (await import('../lib/browser')).default;
          const page = await browserManager.newPage();
          
          try {
            const result = await scraper.scrapeTweetMetrics(page, String(post.tweet_id));
            const metrics = result.metrics || {} as any;
            
            if (!result.success) {
              console.warn(`[ENHANCED_METRICS] ⚠️ Scraping failed: ${result.error}`);
              continue;
            }
          
            // Calculate engagement for this checkpoint
            const checkpointEngagement = (metrics.likes ?? 0) + (metrics.retweets ?? 0) + 
                                         (metrics.quote_tweets ?? 0) + (metrics.replies ?? 0) + 
                                         (metrics.bookmarks ?? 0);
            
            // Store velocity data
            await supabase.from('post_velocity_tracking').insert({
              post_id: post.id,
              tweet_id: post.tweet_id,
              check_time: now.toISOString(),
              hours_after_post: window.hours,
              likes: metrics.likes ?? null,
              retweets: metrics.retweets ?? null,
              quote_tweets: metrics.quote_tweets ?? null,
              replies: metrics.replies ?? null,
              bookmarks: metrics.bookmarks ?? null,
              views: metrics.views ?? null,
              total_engagement: checkpointEngagement,
              collection_phase: `checkpoint_${window.hours}h`
            });
            
            console.log(`[ENHANCED_METRICS] ✅ Velocity tracked for ${post.tweet_id} at ${window.label}: ${metrics.likes ?? 0} likes`);
            
          } finally {
            await page.close();
          }
          
          // Rate limit
          await new Promise(resolve => setTimeout(resolve, 3000));
          
        } catch (err: any) {
          console.warn(`[ENHANCED_METRICS] ⚠️ Failed velocity tracking: ${err.message}`);
        }
      }
    }
    
    console.log('[ENHANCED_METRICS] ✅ Enhanced metrics collection complete');
    
  } catch (error: any) {
    console.error('[ENHANCED_METRICS] ❌ Enhanced metrics failed:', error.message);
  }
}
