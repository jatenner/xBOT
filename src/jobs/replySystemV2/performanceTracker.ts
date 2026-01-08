/**
 * 📊 PERFORMANCE TRACKER
 * 
 * Tracks reply performance at +30m, +4h, +24h
 * Computes pass rate vs >=1000 views target
 */

import { getSupabaseClient } from '../../db/index';

/**
 * Track performance for a posted reply
 */
export async function trackReplyPerformance(
  decisionId: string,
  candidateTweetId: string,
  ourReplyTweetId: string,
  predictedTier: number
): Promise<void> {
  console.log(`[PERF_TRACKER] 📊 Tracking performance for reply ${ourReplyTweetId}...`);
  
  const supabase = getSupabaseClient();
  
  // Update SLO event with tweet_id
  const { updateSloEventAfterPosting } = await import('./sloTracker');
  
  // Get permit_id
  const { data: permit } = await supabase
    .from('post_attempts')
    .select('permit_id')
    .eq('decision_id', decisionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (permit) {
    await updateSloEventAfterPosting(decisionId, permit.permit_id, ourReplyTweetId);
  }
  
  // Get target threshold from ratchet controller
  const { data: ratchet } = await supabase
    .from('reply_ratchet_controller')
    .select('current_24h_views_threshold')
    .order('week_start_date', { ascending: false })
    .limit(1)
    .single();
  
  const target24hViews = ratchet?.current_24h_views_threshold || 1000;
  
  // Create performance record
  const { data: decision } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('posted_at')
    .eq('decision_id', decisionId)
    .single();
  
  if (!decision || !decision.posted_at) {
    console.error(`[PERF_TRACKER] ⚠️ Decision not found or not posted: ${decisionId}`);
    return;
  }
  
  const postedAt = new Date(decision.posted_at);
  
  // Insert initial record
  await supabase
    .from('reply_performance_metrics')
    .insert({
      decision_id: decisionId,
      candidate_tweet_id: candidateTweetId,
      our_reply_tweet_id: ourReplyTweetId,
      predicted_tier: predictedTier,
      target_24h_views: target24hViews,
      posted_at: postedAt.toISOString(),
    });
  
  console.log(`[PERF_TRACKER] ✅ Created performance record for ${ourReplyTweetId}`);
}

/**
 * Update performance metrics at specific intervals
 */
export async function updatePerformanceMetrics(): Promise<{
  updated_30m: number;
  updated_4h: number;
  updated_24h: number;
}> {
  console.log('[PERF_TRACKER] 📊 Updating performance metrics...');
  
  const supabase = getSupabaseClient();
  const now = new Date();
  
  let updated30m = 0;
  let updated4h = 0;
  let updated24h = 0;
  
  // Get metrics that need updating
  const { data: metrics } = await supabase
    .from('reply_performance_metrics')
    .select('*')
    .order('posted_at', { ascending: false })
    .limit(100);
  
  if (!metrics || metrics.length === 0) {
    return { updated_30m: 0, updated_4h: 0, updated_24h: 0 };
  }
  
  for (const metric of metrics) {
    const postedAt = new Date(metric.posted_at);
    const ageMinutes = (now.getTime() - postedAt.getTime()) / (1000 * 60);
    
    // Update 30m metrics
    if (ageMinutes >= 30 && !metric.views_30m) {
      const views30m = await scrapeTweetMetrics(metric.our_reply_tweet_id);
      await supabase
        .from('reply_performance_metrics')
        .update({
          views_30m: views30m.views,
          likes_30m: views30m.likes,
          replies_30m: views30m.replies,
          retweets_30m: views30m.retweets,
        })
        .eq('id', metric.id);
      updated30m++;
    }
    
    // Update 4h metrics
    if (ageMinutes >= 240 && !metric.views_4h) {
      const views4h = await scrapeTweetMetrics(metric.our_reply_tweet_id);
      await supabase
        .from('reply_performance_metrics')
        .update({
          views_4h: views4h.views,
          likes_4h: views4h.likes,
          replies_4h: views4h.replies,
          retweets_4h: views4h.retweets,
        })
        .eq('id', metric.id);
      updated4h++;
    }
    
    // Update 24h metrics
    if (ageMinutes >= 1440 && !metric.views_24h) {
      const views24h = await scrapeTweetMetrics(metric.our_reply_tweet_id);
      const passedTarget = views24h.views >= metric.target_24h_views;
      
      // Determine actual tier
      let actualTier = 4;
      if (views24h.views >= 5000) actualTier = 1;
      else if (views24h.views >= 1000) actualTier = 2;
      else if (views24h.views >= 500) actualTier = 3;
      
      await supabase
        .from('reply_performance_metrics')
        .update({
          views_24h: views24h.views,
          likes_24h: views24h.likes,
          replies_24h: views24h.replies,
          retweets_24h: views24h.retweets,
          passed_target: passedTarget,
          actual_tier: actualTier,
        })
        .eq('id', metric.id);
      updated24h++;
    }
  }
  
  console.log(`[PERF_TRACKER] ✅ Updated: 30m=${updated30m}, 4h=${updated4h}, 24h=${updated24h}`);
  
  return { updated_30m: updated30m, updated_4h: updated4h, updated_24h: updated24h };
}

/**
 * Scrape tweet metrics
 */
async function scrapeTweetMetrics(tweetId: string): Promise<{
  views: number;
  likes: number;
  replies: number;
  retweets: number;
}> {
  // This would use the existing metrics scraper
  // For now, return placeholder (will be implemented with actual scraper)
  return {
    views: 0,
    likes: 0,
    replies: 0,
    retweets: 0,
  };
}

