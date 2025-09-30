/**
 * 🚀 POSTING ORCHESTRATOR
 * Handles real posting to X with proper queue management
 */

import { getConfig } from '../config/config';
import { getEnvFlags, isPostingAllowed } from '../config/envFlags';
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
  try {
    const tweetId = await postToXWithRetry(decision);
    
    // Store successful posting
    await storePostedDecision(decision, tweetId);
    
    // Update content_metadata
    await markAsPosted(decision.decision_id, tweetId);
    
    console.log(`[POSTING_ORCHESTRATOR] ✅ Posted successfully tweet_id=${tweetId} decision_id=${decision.decision_id}`);
    postingMetrics.posts_posted++;
    
  } catch (error: any) {
    console.error(`[POSTING_ORCHESTRATOR] ❌ Failed to post decision_id=${decision.decision_id}:`, error.message);
    const skipReason = 'posting_failed';
    updateSkipMetrics(skipReason);
    
    // Mark as failed
    await markAsFailed(decision.decision_id, error.message);
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
  const maxPerHour = parseInt(String(config.MAX_POSTS_PER_HOUR || 1));
  
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

function updateSkipMetrics(reason: string): void {
  postingMetrics.posts_skipped++;
  postingMetrics.skip_reasons[reason] = (postingMetrics.skip_reasons[reason] || 0) + 1;
}

export function getPostingMetrics() {
  return { ...postingMetrics };
}