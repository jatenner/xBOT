/**
 * 🚀 POSTING ORCHESTRATOR
 * Handles real posting to X with proper queue management
 */

import { getConfig } from '../config/config';
import { getEnvConfig, isPostingAllowed } from '../config/envFlags';
import { getSupabaseClient } from '../db/index';

let postingMetrics = {
  posts_attempted: 0,
  posts_posted: 0,
  posts_skipped: 0,
  skip_reasons: {} as Record<string, number>
};

interface QueuedDecision {
  decision_id: string;
  id: number;
  content: string;
  decision_type: 'single' | 'thread' | 'reply';
  generation_source: 'real' | 'synthetic';
  scheduled_at: string;
  target_tweet_id?: string;
  target_username?: string;
  bandit_arm?: string;
  timing_arm?: string;
  quality_score?: number;
}

export async function processPostingQueue(): Promise<void> {
  console.log('[POSTING_ORCHESTRATOR] 🚀 Processing posting queue...');
  
  try {
    const queuedDecisions = await getQueuedDecisions();
    
    if (queuedDecisions.length === 0) {
      console.log('[POSTING_ORCHESTRATOR] ℹ️ No decisions queued for posting');
      return;
    }
    
    console.log(`[POSTING_ORCHESTRATOR] 📋 Found ${queuedDecisions.length} decisions in queue`);
    
    for (const decision of queuedDecisions) {
      await processDecision(decision);
    }
    
  } catch (error: any) {
    console.error('[POSTING_ORCHESTRATOR] ❌ Queue processing failed:', error.message);
    throw error;
  }
}

async function getQueuedDecisions(): Promise<QueuedDecision[]> {
  const supabase = getSupabaseClient();
  
  // CANONICAL QUERY
  const { data, error } = await supabase
    .from('content_metadata')
    .select('*')
    .eq('status', 'queued')
    .eq('generation_source', 'real')
    .lte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(5);
  
  if (error) {
    console.error('[POSTING_ORCHESTRATOR] ❌ Failed to fetch queue:', error.message);
    return [];
  }
  
  if (!data) return [];
  
  // Map to typed interface
  return data.map((row: any) => ({
    decision_id: row.decision_id as string,
    id: row.id as number,
    content: row.content as string,
    decision_type: row.decision_type as 'single' | 'thread' | 'reply',
    generation_source: row.generation_source as 'real' | 'synthetic',
    scheduled_at: row.scheduled_at as string,
    target_tweet_id: row.target_tweet_id as string | undefined,
    target_username: row.target_username as string | undefined,
    bandit_arm: row.bandit_arm as string | undefined,
    timing_arm: row.timing_arm as string | undefined,
    quality_score: row.quality_score as number | undefined
  }));
}

async function processDecision(decision: QueuedDecision): Promise<void> {
  postingMetrics.posts_attempted++;
  
  // Check if posting is allowed
  const postingCheck = isPostingAllowed();
  if (!postingCheck.allowed) {
    console.log(`[POSTING_ORCHESTRATOR] ⏭️ Skipped posting decision_id=${decision.decision_id}: ${postingCheck.reason}`);
    updateSkipMetrics(postingCheck.reason || 'posting_disabled');
    // Keep in queue (do NOT update status)
    return;
  }
  
  // Check rate limits
  if (await isRateLimited()) {
    const skipReason = 'rate_limit';
    console.log(`[POSTING_ORCHESTRATOR] ⏭️ Skipped posting decision_id=${decision.decision_id}: ${skipReason}`);
    updateSkipMetrics(skipReason);
    return;
  }
  
  // Attempt posting with retry
  let tweetId: string | null = null;
  let postingError: any = null;
  
  try {
    tweetId = await postToXWithRetry(decision);
    console.log(`[POSTING_ORCHESTRATOR] ✅ Tweet posted to Twitter: ${tweetId}`);
  } catch (error: any) {
    postingError = error;
    console.error(`[POSTING_ORCHESTRATOR] ❌ Failed to post to Twitter:`, error.message);
  }
  
  // 🚨 CRITICAL: If we got a tweet ID, the post succeeded on Twitter!
  // Never mark as "failed" if we have a tweet ID - that would be a phantom failure
  if (tweetId) {
    console.log(`[POSTING_ORCHESTRATOR] 🎯 Tweet ID captured: ${tweetId} - post is LIVE on Twitter`);
    
    // Try to save to database - but if this fails, DON'T mark post as failed!
    try {
      await storePostedDecision(decision, tweetId);
      console.log(`[POSTING_ORCHESTRATOR] 💾 Stored in posted_decisions archive`);
    } catch (dbError: any) {
      console.error(`[POSTING_ORCHESTRATOR] ⚠️ DB archive failed (non-critical):`, dbError.message);
    }
    
    try {
      await markAsPosted(decision.decision_id, tweetId);
      console.log(`[POSTING_ORCHESTRATOR] 💾 Updated content_metadata status`);
    } catch (dbError: any) {
      console.error(`[POSTING_ORCHESTRATOR] 🚨 CRITICAL: Failed to update status for LIVE tweet ${tweetId}!`);
      console.error(`[POSTING_ORCHESTRATOR] ⚠️ Phantom failure detected - recovery system will fix this`);
      // Don't throw - tweet is live, phantom recovery will catch it
    }
    
    // Track baseline followers (non-blocking)
    trackBaselineFollowers(decision.decision_id, tweetId).catch(error => {
      console.warn(`[POSTING_ORCHESTRATOR] ⚠️ Baseline follower tracking failed:`, error.message);
    });
    
    console.log(`[POSTING_ORCHESTRATOR] ✅ Posted successfully tweet_id=${tweetId} decision_id=${decision.decision_id}`);
    postingMetrics.posts_posted++;
    
  } else {
    // No tweet ID = actual failure on Twitter
    console.error(`[POSTING_ORCHESTRATOR] ❌ Failed to post to Twitter - decision_id=${decision.decision_id}`);
    console.error(`[POSTING_ORCHESTRATOR] ❌ Error: ${postingError?.message || 'Unknown error'}`);
    const skipReason = 'posting_failed';
    updateSkipMetrics(skipReason);
    
    // Only mark as failed if we KNOW it didn't post
    await markAsFailed(decision.decision_id, postingError?.message || 'Unknown posting error');
  }
}

async function postToXWithRetry(decision: QueuedDecision, retries = 3): Promise<string> {
  const delays = [1000, 2000, 4000]; // Exponential backoff
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[POSTING_ORCHESTRATOR] 🔄 Retry attempt ${attempt + 1}/${retries}`);
        await new Promise(resolve => setTimeout(resolve, delays[attempt - 1]));
      }
      
      if (decision.decision_type === 'reply' && decision.target_tweet_id) {
        return await postReply(decision);
      } else {
        return await postContent(decision);
      }
      
    } catch (error: any) {
      if (attempt === retries - 1) throw error;
      console.warn(`[POSTING_ORCHESTRATOR] ⚠️ Attempt ${attempt + 1} failed: ${error.message}`);
    }
  }
  
  throw new Error('Max retries exceeded');
}

async function postContent(decision: QueuedDecision): Promise<string> {
  const { RailwayCompatiblePoster } = await import('./railwayCompatiblePoster');
  const poster = new RailwayCompatiblePoster();
  
  try {
    const initSuccess = await poster.initialize();
    if (!initSuccess) {
      throw new Error('Failed to initialize poster');
    }
    
    const result = await poster.postTweet(decision.content);
    
    if (!result.success) {
      throw new Error(result.error || 'Unknown posting error');
    }
    
    return result.tweetId || `posted_${Date.now()}`;
    
  } finally {
    try {
      await poster.cleanup();
    } catch (e) {
      console.warn('[POSTING_ORCHESTRATOR] ⚠️ Cleanup warning:', e);
    }
  }
}

async function postReply(decision: QueuedDecision): Promise<string> {
  // For replies, use the same posting infrastructure
  // In production, would navigate to specific tweet and reply
  const { RailwayCompatiblePoster } = await import('./railwayCompatiblePoster');
  const poster = new RailwayCompatiblePoster();
  
  try {
    await poster.initialize();
    const replyContent = `@${decision.target_username} ${decision.content}`;
    const result = await poster.postTweet(replyContent);
    
    if (!result.success) {
      throw new Error(result.error || 'Reply posting failed');
    }
    
    return result.tweetId || `reply_${Date.now()}`;
    
  } finally {
    await poster.cleanup();
  }
}

async function storePostedDecision(decision: QueuedDecision, tweetId: string): Promise<void> {
  const supabase = getSupabaseClient();
  
  const { error } = await supabase
    .from('posted_decisions')
    .insert([{
      decision_id: decision.decision_id,
      decision_type: decision.decision_type,
      content: decision.content,
      tweet_id: tweetId,
      generation_source: decision.generation_source,
      bandit_arm: decision.bandit_arm,
      timing_arm: decision.timing_arm,
      target_tweet_id: decision.target_tweet_id,
      posted_at: new Date().toISOString()
    }]);
  
  if (error) {
    console.warn(`[POSTING_ORCHESTRATOR] ⚠️ Failed to store posted_decision:`, error.message);
  }
}

async function markAsPosted(decision_id: string, tweetId: string): Promise<void> {
  const supabase = getSupabaseClient();
  
  const { error } = await supabase
    .from('content_metadata')
    .update({
      status: 'posted',
      tweet_id: tweetId,
      posted_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('decision_id', decision_id);
  
  if (error) {
    console.warn(`[POSTING_ORCHESTRATOR] ⚠️ Failed to update status:`, error.message);
  }
}

async function markAsFailed(decision_id: string, errorMsg: string): Promise<void> {
  const supabase = getSupabaseClient();
  
  const { error } = await supabase
    .from('content_metadata')
    .update({
      status: 'failed',
      error_message: errorMsg,
      updated_at: new Date().toISOString()
    })
    .eq('decision_id', decision_id);
  
  if (error) {
    console.warn(`[POSTING_ORCHESTRATOR] ⚠️ Failed to mark as failed:`, error.message);
  }
}

async function isRateLimited(): Promise<boolean> {
  const config = getConfig();
  const maxPerHour = parseInt(String(config.MAX_POSTS_PER_HOUR || 1)); // 1 post/hour = 2 every 2 hours
  
  const supabase = getSupabaseClient();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  const { count, error } = await supabase
    .from('posted_decisions')
    .select('*', { count: 'exact', head: true })
    .gte('posted_at', oneHourAgo);
  
  if (error) {
    console.warn('[POSTING_ORCHESTRATOR] ⚠️ Rate limit check failed, allowing');
    return false;
  }
  
  return (count || 0) >= maxPerHour;
}

async function trackBaselineFollowers(postId: string, tweetId: string): Promise<void> {
  try {
    console.log(`[POSTING_ORCHESTRATOR] 👥 Tracking baseline followers for ${postId}...`);
    
    const { BrowserManager } = await import('../browser/browserManager');
    const { getBulletproofScraper } = await import('../scrapers/bulletproofTwitterScraper');
    const { getKVStore } = await import('../utils/kv');
    
    const browserManager = BrowserManager.getInstance();
    const scraper = getBulletproofScraper();
    const kv = getKVStore();
    const supabase = getSupabaseClient();
    
    // Get page
    const page = await browserManager.getPage();
    
    try {
      // Scrape current follower count
      const { followerCount, profileViews } = await scraper.scrapeProfileMetrics(page);
      
      // Store baseline in database
      const { error } = await supabase
        .from('post_follower_tracking')
        .insert({
          post_id: postId,
          tweet_id: tweetId,
          check_time: new Date().toISOString(),
          follower_count: followerCount,
          profile_views: profileViews,
          hours_after_post: 0,
          collection_phase: 'baseline'
        });
      
      if (error) {
        console.error(`[POSTING_ORCHESTRATOR] ❌ Failed to store baseline followers:`, error.message);
      } else {
        console.log(`[POSTING_ORCHESTRATOR] ✅ Baseline tracked: ${followerCount} followers`);
      }
      
      // Cache in Redis for fast access
      await kv.set(`follower:baseline:${postId}`, String(followerCount), 172800); // 48h TTL
      
    } finally {
      await browserManager.releasePage(page);
    }
    
  } catch (error: any) {
    console.error(`[POSTING_ORCHESTRATOR] ❌ Baseline tracking error:`, error.message);
    // Don't throw - this is non-critical
  }
}

function updateSkipMetrics(reason: string): void {
  postingMetrics.posts_skipped++;
  postingMetrics.skip_reasons[reason] = (postingMetrics.skip_reasons[reason] || 0) + 1;
}

export function getPostingMetrics() {
  return { ...postingMetrics };
}