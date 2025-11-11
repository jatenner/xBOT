/**
 * 🔍 REPLY METRICS SCRAPER JOB
 * 
 * METADATA GOATNESS: Tracks performance of every reply
 * - Views/impressions per reply
 * - Likes/retweets on replies
 * - Followers gained from each reply
 * - Parent tweet context
 * - Timing data
 * 
 * Runs every 30 minutes to collect fresh data for learning system
 */

import { getSupabaseClient } from '../db';
import { BulletproofTwitterScraper } from '../scrapers/bulletproofTwitterScraper';
import { UnifiedBrowserPool } from '../browser/UnifiedBrowserPool';

export async function replyMetricsScraperJob(): Promise<void> {
  console.log('[REPLY_METRICS] 🔍 Starting reply performance scraping...');
  
  try {
    const supabase = getSupabaseClient();
    
    // PRIORITY 1: Recent replies (last 7 days) - scrape aggressively
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const { data: recentReplies, error: recentError } = await supabase
      .from('content_metadata')
      .select('decision_id, tweet_id, posted_at, content, features')
      .eq('status', 'posted')
      .eq('decision_type', 'reply')
      .not('tweet_id', 'is', null)
      .gte('posted_at', sevenDaysAgo.toISOString())
      .order('posted_at', { ascending: false })
      .limit(20); // Scrape up to 20 recent replies
    
    if (recentError) {
      console.error('[REPLY_METRICS] ❌ Failed to fetch recent replies:', recentError.message);
      return;
    }
    
    if (!recentReplies || recentReplies.length === 0) {
      console.log('[REPLY_METRICS] ℹ️ No recent replies to scrape');
      return;
    }
    
    console.log(`[REPLY_METRICS] 📊 Found ${recentReplies.length} replies to scrape`);
    
    // Get current follower count (to calculate followers gained)
    let currentFollowerCount = 0;
    try {
      const { data: accountData } = await supabase
        .from('system_health_metrics')
        .select('follower_count')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      currentFollowerCount = Number(accountData?.follower_count) || 0;
    } catch (error) {
      console.warn('[REPLY_METRICS] ⚠️ Could not get current follower count');
    }
    
    // Scrape metrics for each reply
    let scrapedCount = 0;
    let failedCount = 0;
    
    // Get browser page for scraping
    const pool = UnifiedBrowserPool.getInstance();
    const page = await pool.acquirePage('reply_metrics_scrape');
    
    try {
      for (const reply of recentReplies) {
        try {
          console.log(`[REPLY_METRICS]   🔍 Scraping reply ${reply.tweet_id}...`);
          
          // Scrape tweet metrics
          const scraper = BulletproofTwitterScraper.getInstance();
          const features = (reply.features || {}) as any;
          const result = await scraper.scrapeTweetMetrics(
            page,
            String(reply.tweet_id),
            2,
            {
              isReply: true,
              useAnalytics: false,
              tweetUrl: typeof features.tweet_url === 'string' ? features.tweet_url : undefined
            }
          );
          
          if (!result.success || !result.metrics) {
            console.warn(`[REPLY_METRICS]   ⚠️ No metrics for ${reply.tweet_id}: ${result.error || 'Unknown error'}`);
            failedCount++;
            continue;
          }
          
          const metrics = result.metrics;
        
        // Extract parent tweet info from features
        const parentTweetId = features.parent_tweet_id || '';
        const parentUsername = features.parent_username || '';
        
        // Calculate engagement rate
        const totalEngagement = (metrics.likes || 0) + (metrics.replies || 0) + (metrics.retweets || 0);
        const engagementRate = metrics.views && metrics.views > 0 ? totalEngagement / metrics.views : 0;
        
        // Check if reply was already tracked
        const { data: existingPerf } = await supabase
          .from('reply_performance')
          .select('id, followers_gained')
          .eq('reply_tweet_id', reply.tweet_id)
          .single();
        
        // Calculate followers gained (if we have baseline)
        let followersGained = 0;
        if (existingPerf && existingPerf.followers_gained) {
          followersGained = Number(existingPerf.followers_gained); // Keep existing value
        } else if (currentFollowerCount > 0) {
          // Try to estimate (very rough)
          // In reality, you'd track follower count at time of posting
          const hoursOld = (Date.now() - new Date(String(reply.posted_at)).getTime()) / (1000 * 60 * 60);
          const estimatedGrowthRate = 0.5; // Assume 0.5 followers/hour baseline
          const estimatedBaseline = Math.floor(hoursOld * estimatedGrowthRate);
          
          // If engagement is high, attribute some followers
          if (engagementRate > 0.02) { // 2%+ engagement rate
            followersGained = Math.floor(metrics.likes * 0.01); // Rough estimate: 1% of likes
          }
        }
        
        // Calculate visibility score (how visible was it in the thread?)
        // Higher = better position, fewer competing replies
        const parentReplies = features.parent_replies || 1;
        const replyPosition = features.reply_position || parentReplies;
        const visibilityScore = Math.max(0, 1 - (replyPosition / Math.max(parentReplies, 10)));
        
        // Check if conversation continued (did we get replies?)
        const conversationContinued = (metrics.replies || 0) > 0;
        
        // 🔥 STORE ALL METADATA in reply_performance table
        const perfData = {
          decision_id: reply.decision_id,
          reply_tweet_id: reply.tweet_id,
          parent_tweet_id: parentTweetId,
          parent_username: parentUsername,
          
          // Engagement metrics
          likes: metrics.likes || 0,
          replies: metrics.replies || 0,
          impressions: metrics.views || 0,
          
          // Follower impact
          followers_gained: followersGained,
          
          // Quality metrics
          reply_relevance_score: engagementRate,
          conversation_continuation: conversationContinued,
          visibility_score: visibilityScore,
          engagement_rate: engagementRate,
          
          // Metadata (store extra context as JSON)
          reply_metadata: {
            retweets: metrics.retweets || 0,
            bookmarks: metrics.bookmarks || 0,
            parent_likes: features.parent_likes || 0,
            parent_replies: features.parent_replies || 0,
            reply_position: replyPosition,
            time_of_day: new Date(String(reply.posted_at)).getHours(),
            day_of_week: new Date(String(reply.posted_at)).getDay(),
            hours_since_parent: features.hours_since_parent || 0,
            parent_account_size: features.parent_account_size || 0,
            generator_used: features.generator || 'unknown'
          },
          
          updated_at: new Date().toISOString()
        };
        
        // Upsert to reply_performance
        const { error: perfError } = await supabase
          .from('reply_performance')
          .upsert(perfData, { onConflict: 'reply_tweet_id' });
        
        if (perfError) {
          console.error(`[REPLY_METRICS]   ❌ Failed to store performance:`, perfError.message);
          failedCount++;
        } else {
          console.log(`[REPLY_METRICS]   ✅ ${reply.tweet_id}: ${metrics.views || 0} views, ${metrics.likes || 0} likes, +${followersGained} followers`);
          scrapedCount++;
        }
        
        // Small delay between scrapes
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error: any) {
        console.error(`[REPLY_METRICS]   ❌ Error scraping ${reply.tweet_id}:`, error.message);
        failedCount++;
      }
    }
    } finally {
      // Release browser page
      await pool.releasePage(page);
    }
    
    console.log(`[REPLY_METRICS] ✅ Scraping complete: ${scrapedCount} successful, ${failedCount} failed`);
    
  } catch (error: any) {
    console.error('[REPLY_METRICS] ❌ Job failed:', error.message);
    throw error;
  }
}

