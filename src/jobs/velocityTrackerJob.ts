/**
 * ⚡ VELOCITY TRACKER JOB
 * Re-scrapes posts at 24h checkpoint to measure follower attribution and engagement velocity
 */

import { getSupabaseClient } from '../db/index';
import { getKVStore } from '../utils/kv';
import { getBulletproofScraper } from '../scrapers/bulletproofTwitterScraper';

export async function runVelocityTracking(): Promise<void> {
  console.log('[VELOCITY] ⚡ Starting velocity tracking cycle...');
  
  try {
    const supabase = getSupabaseClient();
    const kv = getKVStore();
    
    // Get posts from last 48 hours
    const { data: recentPosts, error } = await supabase
      .from('posted_decisions')
      .select('decision_id, tweet_id, posted_at')
      .gte('posted_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
      .order('posted_at', { ascending: false });
    
    if (error || !recentPosts || recentPosts.length === 0) {
      console.log('[VELOCITY] ℹ️ No recent posts to track');
      return;
    }
    
    console.log(`[VELOCITY] 📋 Found ${recentPosts.length} recent posts`);
    
    let tracked = 0;
    let skipped = 0;
    
    for (const post of recentPosts) {
      try {
        const hoursAfterPost = (Date.now() - new Date(String(post.posted_at)).getTime()) / (1000 * 60 * 60);
        
        // Check if we're at the 24h checkpoint (23h-25h window)
        if (hoursAfterPost >= 23 && hoursAfterPost <= 25) {
          // Check if already tracked
          const alreadyTracked = await kv.get(`velocity:tracked:${post.decision_id}:24h`);
          if (alreadyTracked) {
            skipped++;
            continue;
          }
          
          // Track this post
          await trackPostCheckpoint(String(post.decision_id), String(post.tweet_id), 24);
          tracked++;
          
          // Mark as tracked in Redis
          await kv.set(`velocity:tracked:${post.decision_id}:24h`, '1', 172800); // 48h TTL
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
      } catch (error: any) {
        console.error(`[VELOCITY] ❌ Failed to track ${post.decision_id}:`, error.message);
        // Continue with next post
      }
    }
    
    console.log(`[VELOCITY] ✅ Velocity tracking complete: ${tracked} tracked, ${skipped} skipped`);
    
  } catch (error: any) {
    console.error('[VELOCITY] ❌ Velocity tracking failed:', error.message);
    throw error;
  }
}

/**
 * Track a specific post at a checkpoint
 */
async function trackPostCheckpoint(postId: string, tweetId: string, hoursAfter: number): Promise<void> {
  const supabase = getSupabaseClient();
  const scraper = getBulletproofScraper();
  
  // Dynamically import BrowserManager
  const { BrowserManager } = await import('../browser/browserManager');
  const browserManager = BrowserManager.getInstance();
  
  let page;
  
  try {
    // Get browser page
    page = await browserManager.getPage();
    
    // Scrape tweet metrics
    console.log(`[VELOCITY] 📊 Scraping metrics for ${postId} at ${hoursAfter}h...`);
    const tweetResult = await scraper.scrapeTweetMetrics(page, tweetId);
    
    // Extract metrics (handle both success and failure cases)
    const tweetMetrics = tweetResult.metrics || {
      likes: null,
      retweets: null,
      replies: null,
      bookmarks: null,
      views: null,
      _verified: false,
      _status: 'UNDETERMINED' as const,
      _dataSource: 'scraping_failed' as const,
      _attempts: 0,
      _selectors_used: [],
      _timestamp: new Date().toISOString()
    };
    
    // Scrape profile metrics (follower count)
    console.log(`[VELOCITY] 👥 Scraping follower count for ${postId}...`);
    const profileMetrics = await scraper.scrapeProfileMetrics(page);
    
    const checkTime = new Date();
    const collectionPhase = `checkpoint_${hoursAfter}h`;
    
    // Store velocity tracking data
    // PHASE 2 FIX: Use null coalescing to avoid fake zeros
    const { error: velocityError } = await supabase
      .from('post_velocity_tracking')
      .insert({
        post_id: postId,
        tweet_id: tweetId,
        check_time: checkTime.toISOString(),
        hours_after_post: hoursAfter,
        likes: tweetMetrics.likes ?? null,
        retweets: tweetMetrics.retweets ?? null,
        replies: tweetMetrics.replies ?? null,
        bookmarks: tweetMetrics.bookmarks ?? null,
        views: tweetMetrics.views ?? null,
        collection_phase: collectionPhase
      });
    
    if (velocityError) {
      console.error(`[VELOCITY] ⚠️ Failed to store velocity data:`, velocityError.message);
    } else {
      console.log(`[VELOCITY] ✅ Velocity data saved: ${tweetMetrics.likes} likes`);
    }
    
    // Store follower tracking data
    console.log(`[VELOCITY] 👥 Followers at ${hoursAfter}h: ${profileMetrics.followerCount}`);
    
    // PHASE 2 FIX: Use null coalescing for follower data too
    const { error: followerError } = await supabase
      .from('post_follower_tracking')
      .insert({
        post_id: postId,
        tweet_id: tweetId,
        check_time: checkTime.toISOString(),
        follower_count: profileMetrics.followerCount ?? null,
        profile_views: profileMetrics.profileViews ?? null,
        hours_after_post: hoursAfter,
        collection_phase: collectionPhase
      });
    
    if (followerError) {
      console.error(`[VELOCITY] ⚠️ Failed to store follower data:`, followerError.message);
    } else {
      console.log(`[VELOCITY] ✅ Follower data saved: ${profileMetrics.followerCount} followers`);
    }
    
    // Calculate and log attribution
    await logFollowerAttribution(postId);
    
  } finally {
    if (page) {
      await browserManager.releasePage(page);
    }
  }
}

/**
 * Calculate and log follower attribution for a post
 */
async function logFollowerAttribution(postId: string): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    
    // Get baseline and 24h data
    const { data: trackingData } = await supabase
      .from('post_follower_tracking')
      .select('hours_after_post, follower_count')
      .eq('post_id', postId)
      .in('hours_after_post', [0, 24])
      .order('hours_after_post', { ascending: true });
    
    if (trackingData && trackingData.length === 2) {
      const baseline = Number(trackingData[0].follower_count) || 0;
      const after24h = Number(trackingData[1].follower_count) || 0;
      const gained = after24h - baseline;
      
      if (gained > 0) {
        console.log(`[VELOCITY] 🎯 Post ${postId} gained +${gained} followers in 24h!`);
      } else if (gained < 0) {
        console.log(`[VELOCITY] 📉 Post ${postId}: ${gained} followers (lost)`);
      } else {
        console.log(`[VELOCITY] ➡️ Post ${postId}: No follower change`);
      }
    }
    
  } catch (error: any) {
    console.warn(`[VELOCITY] ⚠️ Failed to log attribution:`, error.message);
  }
}

