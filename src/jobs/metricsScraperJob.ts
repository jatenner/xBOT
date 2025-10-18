/**
 * 📊 METRICS SCRAPER JOB
 * 
 * SMART BATCH FIX: Scheduled job to collect metrics from posted tweets
 * Runs every 10 minutes to ensure we have fresh data for learning
 */

import { getSupabaseClient } from '../db';
import { BulletproofTwitterScraper } from '../scrapers/bulletproofTwitterScraper';

export async function metricsScraperJob(): Promise<void> {
  console.log('[METRICS_JOB] 🔍 Starting scheduled metrics collection...');
  
  try {
    const supabase = getSupabaseClient();
    
    // Find posts from last 7 days that need metrics updates
    const { data: posts, error: postsError } = await supabase
      .from('posted_decisions')
      .select('decision_id, tweet_id, posted_at')
      .gte('posted_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('posted_at', { ascending: false })
      .limit(20); // Process 20 most recent posts
    
    if (postsError) {
      console.error('[METRICS_JOB] ❌ Failed to fetch posts:', postsError.message);
      return;
    }
    
    if (!posts || posts.length === 0) {
      console.log('[METRICS_JOB] ℹ️ No recent posts to scrape');
      return;
    }
    
    console.log(`[METRICS_JOB] 📊 Found ${posts.length} posts to check`);
    
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    
    const scraper = BulletproofTwitterScraper.getInstance();
    
    for (const post of posts) {
      try {
        // Check if we collected metrics recently (skip if collected in last hour)
        const { data: lastMetrics } = await supabase
          .from('outcomes')
          .select('collected_at')
          .eq('decision_id', post.decision_id)
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
          const result = await scraper.scrapeTweetMetrics(page, String(post.tweet_id));
          const metrics = result.metrics || {} as any;
          
          if (!result.success) {
            console.warn(`[METRICS_JOB] ⚠️ Scraping failed for ${post.tweet_id}: ${result.error}`);
            continue;
          }
        
          // Update outcomes table
          await supabase.from('outcomes').upsert({
            decision_id: post.decision_id,
            tweet_id: post.tweet_id,
            likes: metrics.likes ?? null,
            retweets: metrics.retweets ?? null,
            replies: metrics.replies ?? null,
            views: metrics.views ?? null,
            bookmarks: metrics.bookmarks ?? null,
            impressions: metrics.impressions ?? null,
            collected_at: new Date().toISOString(),
            data_source: 'scheduled_scraper',
            simulated: false
          }, { onConflict: 'decision_id' });
          
          console.log(`[METRICS_JOB] ✅ Updated ${post.tweet_id}: ${metrics.likes ?? 0} likes, ${metrics.views ?? 0} views`);
          updated++;
          
          // Update generator stats for autonomous learning
          try {
            const { data: metadata } = await supabase
              .from('content_metadata')
              .select('generator_name')
              .eq('decision_id', post.decision_id)
              .single();
            
            if (metadata && metadata.generator_name) {
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
        .from('posted_decisions')
        .select('decision_id, tweet_id, posted_at')
        .gte('posted_at', windowStart.toISOString())
        .lte('posted_at', windowEnd.toISOString())
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
            .eq('post_id', post.decision_id)
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
          
            // Store velocity data
            await supabase.from('post_velocity_tracking').insert({
              post_id: post.decision_id,
              tweet_id: post.tweet_id,
              check_time: now.toISOString(),
              hours_after_post: window.hours,
              likes: metrics.likes ?? null,
              retweets: metrics.retweets ?? null,
              replies: metrics.replies ?? null,
              bookmarks: metrics.bookmarks ?? null,
              views: metrics.views ?? null,
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
