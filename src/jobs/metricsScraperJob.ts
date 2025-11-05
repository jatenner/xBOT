/**
 * 📊 METRICS SCRAPER JOB
 * 
 * SMART BATCH FIX: Scheduled job to collect metrics from posted tweets
 * Runs every 10 minutes to ensure we have fresh data for learning
 */

import { log } from '../lib/logger';
import { getSupabaseClient } from '../db';
import { BulletproofTwitterScraper } from '../scrapers/bulletproofTwitterScraper';
import { ScrapingOrchestrator } from '../metrics/scrapingOrchestrator';

export async function metricsScraperJob(): Promise<void> {
  log({ op: 'metrics_scraper_start' });
  
  try {
    const supabase = getSupabaseClient();
    
    // PRIORITY 1: Recent tweets (last 3 days) - scrape aggressively
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const { data: recentPosts, error: recentError } = await supabase
      .from('content_metadata')
      .select('decision_id, tweet_id, created_at')  // 🔥 FIX: Use decision_id (UUID), not id (integer)!
      .eq('status', 'posted')
      .not('tweet_id', 'is', null)
      .gte('created_at', threeDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(15); // Scrape 15 most recent (last 3 days)
    
    // PRIORITY 2: Historical tweets (3-30 days old) - scrape less frequently
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const { data: historicalPosts, error: historicalError } = await supabase
      .from('content_metadata')
      .select('decision_id, tweet_id, created_at')  // 🔥 FIX: Use decision_id (UUID), not id (integer)!
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
    
    // 🚀 OPTIMIZATION: Filter posts that need scraping BEFORE acquiring browser
    const postsToScrape = [];
    
    for (const post of posts) {
      try {
        // Check if we collected metrics recently (skip if collected in last hour)
        const { data: lastMetrics } = await supabase
          .from('outcomes')
          .select('collected_at')
          .eq('decision_id', post.decision_id)  // 🔥 FIX: Use decision_id (UUID)
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
        
        postsToScrape.push(post);
      } catch (error: any) {
        console.warn(`[METRICS_JOB] ⚠️ Pre-filter failed for ${post.decision_id}: ${error.message}`);
        failed++;
      }
    }
    
    if (postsToScrape.length === 0) {
      console.log(`[METRICS_JOB] ℹ️ No posts need scraping (${skipped} skipped, ${failed} failed pre-filter)`);
      return;
    }
    
    console.log(`[METRICS_JOB] 🔍 Batching ${postsToScrape.length} tweets into single browser session...`);
    
    // 🔒 BROWSER SEMAPHORE: Acquire ONE browser lock for ALL tweets (BATCHED)
    const { withBrowserLock, BrowserPriority } = await import('../browser/BrowserSemaphore');
    
    await withBrowserLock('metrics_batch', BrowserPriority.METRICS, async () => {
      // Use UnifiedBrowserPool (same as working discovery system)
      const { UnifiedBrowserPool } = await import('../browser/UnifiedBrowserPool');
      const pool = UnifiedBrowserPool.getInstance();
      const page = await pool.acquirePage('metrics_batch');
      
      try {
        console.log(`[METRICS_JOB] 🚀 Starting batched scraping of ${postsToScrape.length} tweets...`);
        
        // Process all tweets in sequence using the same browser session
        for (const post of postsToScrape) {
          try {
            console.log(`[METRICS_JOB] 🔍 Scraping ${post.tweet_id} (${updated + failed + 1}/${postsToScrape.length})...`);
            
            // Use the shared page from the batch session
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
            
            // 🐛 DEBUG: Log what the scraper actually extracted
            console.log(`[METRICS_JOB] 🔍 Extracted metrics for ${post.tweet_id}:`, JSON.stringify({
              views: metrics.views,
              impressions: metrics.views,
              profile_clicks: metrics.profile_clicks,
              likes: metrics.likes,
              retweets: metrics.retweets,
              replies: metrics.replies,
              _verified: metrics._verified,
              _status: metrics._status,
              _dataSource: metrics._dataSource
            }, null, 2));
            
            // Log validation quality
            if (result.validationResult) {
              console.log(`[METRICS_JOB] 📊 Quality: confidence=${result.validationResult.confidence.toFixed(2)}, valid=${result.validationResult.isValid}`);
            }
            
            // Update outcomes table (for backward compatibility with existing systems)
            const { data: outcomeData, error: outcomeError } = await supabase.from('outcomes').upsert({
              decision_id: post.decision_id,  // 🔥 FIX: Use decision_id (UUID), not integer id
              tweet_id: post.tweet_id,
              likes: metrics.likes ?? null,
              retweets: metrics.retweets ?? null,
              quote_tweets: metrics.quote_tweets ?? null,
              replies: metrics.replies ?? null,
              views: metrics.views ?? null,
              bookmarks: metrics.bookmarks ?? null,
              impressions: metrics.views ?? null, // Map views to impressions
              profile_clicks: metrics.profile_clicks ?? null, // 📊 Save Profile visits from analytics page
              first_hour_engagement: isFirstHour ? totalEngagement : null,
              collected_at: new Date().toISOString(),
              data_source: 'orchestrator_v2',
              simulated: false
            }, { onConflict: 'decision_id' });
            
            if (outcomeError) {
              console.error(`[METRICS_JOB] ❌ Failed to write outcomes for ${post.tweet_id}:`, outcomeError.message);
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
            const { error: metricsTableError } = await supabase.from('tweet_metrics').upsert({
              tweet_id: post.tweet_id,
              likes_count: metrics.likes ?? 0,
              retweets_count: metrics.retweets ?? 0,
              replies_count: metrics.replies ?? 0,
              impressions_count: metrics.views ?? 0,
              updated_at: new Date().toISOString(),
              created_at: post.created_at
            }, { onConflict: 'tweet_id' });
            
            if (metricsTableError) {
              // 🔥 FIX: Log SPECIFIC error details for debugging
              console.error(`[METRICS_JOB] ❌ Failed to update tweet_metrics for ${post.tweet_id}:`, {
                error: metricsTableError.message,
                code: metricsTableError.code,
                details: metricsTableError.details,
                hint: metricsTableError.hint,
                tweet_id: post.tweet_id,
                decision_id: post.decision_id
              });
              
              // 🔥 FIX: If it's a constraint violation, log which constraint failed
              if (metricsTableError.code === '23505') { // Unique violation
                console.error(`[METRICS_JOB] 🔍 CONSTRAINT VIOLATION: Duplicate tweet_id detected`);
                console.error(`[METRICS_JOB] 💡 This might be due to tweet_metrics UNIQUE constraint on (tweet_id, collected_at)`);
                console.error(`[METRICS_JOB] 💡 Consider using INSERT ... ON CONFLICT DO UPDATE with collected_at`);
              }
              
              // Don't fail the job - outcomes table is the primary store
              // But log comprehensively so we can debug the root cause
            }
            
            // 🔥 CRITICAL FIX: Also update content_generation_metadata_comprehensive 
            // This table has actual_impressions, actual_likes, actual_retweets, actual_replies
            // These are used for content diversity analysis and topic cluster learning!
            const { error: contentMetadataError } = await supabase
              .from('content_generation_metadata_comprehensive')
              .update({
                actual_impressions: metrics.views ?? null,  // Keep NULL if no views (not 0!)
                actual_likes: metrics.likes ?? 0,
                actual_retweets: metrics.retweets ?? 0,
                actual_replies: metrics.replies ?? 0,
                updated_at: new Date().toISOString()
              })
              .eq('tweet_id', post.tweet_id);
            
            if (contentMetadataError) {
              console.warn(`[METRICS_JOB] ⚠️ Failed to update content_metadata for ${post.tweet_id}:`, contentMetadataError.message);
              // Don't fail - this is supplementary data
            } else {
              console.log(`[METRICS_JOB] 📊 Updated content_metadata: ${metrics.views ?? 0} views stored in actual_impressions`);
            }
            
            console.log(`[METRICS_JOB] ✅ Updated ${post.tweet_id}: ${metrics.likes ?? 0} likes, ${metrics.views ?? 0} views`);
            updated++;
            
            // Update generator stats for autonomous learning
            try {
              const { data: metadata } = await supabase
                .from('content_metadata')
                .select('generator_name')
                .eq('decision_id', post.decision_id)  // 🔥 FIX: Use decision_id (UUID)
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
            
            // Rate limit: wait 2 seconds between scrapes in batch
            await new Promise(resolve => setTimeout(resolve, 2000));
            
          } catch (err: any) {
            console.error(`[METRICS_JOB] ⚠️ Failed ${post.tweet_id}: ${err.message}`);
            failed++;
          }
        }
        
      } finally {
        await pool.releasePage(page);
      }
    });
    
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
        .select('decision_id, tweet_id, created_at')  // 🔥 FIX: Use decision_id (UUID), not id
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
            .eq('post_id', post.decision_id)  // 🔥 FIX: Use decision_id (UUID), not integer id
            .eq('hours_after_post', window.hours)
            .single();
          
          if (existing) continue; // Already tracked
          
          // Skip invalid IDs
          if (String(post.tweet_id).includes('verified_') || String(post.tweet_id).length < 19) continue;
          
          const { UnifiedBrowserPool } = await import('../browser/UnifiedBrowserPool');
          const pool = UnifiedBrowserPool.getInstance();
          const page = await pool.acquirePage(`velocity_${window.hours}h`);
          
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
              post_id: post.decision_id,  // 🔥 FIX: Use decision_id (UUID), not integer id
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
            await pool.releasePage(page);
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
