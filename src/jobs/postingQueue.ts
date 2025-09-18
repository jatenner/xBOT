/**
 * 📮 POSTING QUEUE JOB
 * Processes ready decisions and posts them to Twitter
 */

import { getConfig, getModeFlags } from '../config/config';

export async function processPostingQueue(): Promise<void> {
  const config = getConfig();
  const flags = getModeFlags(config);
  
  console.log('[POSTING_QUEUE] 📮 Processing posting queue...');
  
  try {
    // 1. Check if posting is enabled
    if (flags.postingDisabled) {
      console.log('[POSTING_QUEUE] ⚠️ Posting disabled, skipping queue processing');
      return;
    }
    
    // 2. Check rate limits
    const canPost = await checkPostingRateLimits();
    if (!canPost) {
      console.log('[POSTING_QUEUE] ⚠️ Rate limit reached, skipping posting');
      return;
    }
    
    // 3. Get ready decisions from queue
    const readyDecisions = await getReadyDecisions();
    if (readyDecisions.length === 0) {
      console.log('[POSTING_QUEUE] ℹ️ No decisions ready for posting');
      return;
    }
    
    console.log(`[POSTING_QUEUE] 📝 Found ${readyDecisions.length} decisions ready for posting`);
    
    // 4. Process each decision
    let successCount = 0;
    for (const decision of readyDecisions) {
      try {
        await processDecision(decision);
        successCount++;
      } catch (error) {
        console.error(`[POSTING_QUEUE] ❌ Failed to post decision ${decision.id}:`, error.message);
        await markDecisionFailed(decision.id, error.message);
      }
    }
    
    console.log(`[POSTING_QUEUE] ✅ Posted ${successCount}/${readyDecisions.length} decisions`);
    
  } catch (error) {
    console.error('[POSTING_QUEUE] ❌ Queue processing failed:', error.message);
    throw error;
  }
}

interface QueuedDecision {
  id: string;
  content: string;
  decision_type: 'content' | 'reply';
  target_tweet_id?: string;
  target_username?: string;
  bandit_arm: string;
  timing_arm?: string;
  predicted_er: number;
  quality_score?: number;
  topic_cluster: string;
  status: string;
  created_at: string;
}

async function checkPostingRateLimits(): Promise<boolean> {
  const config = getConfig();
  const maxPostsPerHour = parseInt(config.MAX_POSTS_PER_HOUR || '1');
  
  try {
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { count, error } = await supabase
      .from('unified_ai_intelligence')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'posted')
      .gte('posted_at', oneHourAgo);
    
    if (error) {
      console.warn('[POSTING_QUEUE] ⚠️ Failed to check posting rate limit, allowing posts');
      return true;
    }
    
    const recentPosts = count || 0;
    if (recentPosts >= maxPostsPerHour) {
      console.log(`[POSTING_QUEUE] ⚠️ Hourly post limit reached: ${recentPosts}/${maxPostsPerHour}`);
      return false;
    }
    
    console.log(`[POSTING_QUEUE] ✅ Post budget available: ${recentPosts}/${maxPostsPerHour}`);
    return true;
    
  } catch (error) {
    console.warn('[POSTING_QUEUE] ⚠️ Failed to check rate limits, allowing posts:', error.message);
    return true;
  }
}

async function getReadyDecisions(): Promise<QueuedDecision[]> {
  try {
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('unified_ai_intelligence')
      .select('*')
      .eq('status', 'ready_for_posting')
      .order('created_at', { ascending: true })
      .limit(5); // Process max 5 at a time to avoid overwhelming Twitter
    
    if (error) {
      console.error('[POSTING_QUEUE] ❌ Failed to fetch ready decisions:', error.message);
      return [];
    }
    
    return data || [];
    
  } catch (error) {
    console.error('[POSTING_QUEUE] ❌ Failed to fetch ready decisions:', error.message);
    return [];
  }
}

async function processDecision(decision: QueuedDecision): Promise<void> {
  console.log(`[POSTING_QUEUE] 📮 Processing ${decision.decision_type}: ${decision.id}`);
  
    // Mark as posting to prevent duplicate processing
    await updateDecisionStatus(decision.id, 'posting');
    
    // Update metrics
    await updatePostingMetrics('queued');
  
  try {
    let tweetId: string;
    
    if (decision.decision_type === 'content') {
      tweetId = await postContent(decision);
    } else if (decision.decision_type === 'reply') {
      tweetId = await postReply(decision);
    } else {
      throw new Error(`Unknown decision type: ${decision.decision_type}`);
    }
    
    // Mark as posted and store tweet ID
    await markDecisionPosted(decision.id, tweetId);
    
    // Update metrics
    await updatePostingMetrics('posted');
    
    console.log(`[POSTING_QUEUE] ✅ ${decision.decision_type} posted: ${tweetId}`);
    
  } catch (error) {
    await updateDecisionStatus(decision.id, 'failed');
    await updatePostingMetrics('error');
    throw error;
  }
}

async function postContent(decision: QueuedDecision): Promise<string> {
  console.log(`[POSTING_QUEUE] 📝 Posting content: "${decision.content.substring(0, 50)}..."`);
  
  // Use the existing Twitter posting infrastructure
  const { RailwayCompatiblePoster } = await import('../posting/railwayCompatiblePoster');
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
    
    const tweetId = result.tweetId || `posted_${Date.now()}`;
    console.log(`[POSTING_QUEUE] ✅ Content posted with ID: ${tweetId}`);
    
    return tweetId;
    
  } finally {
    try {
      await poster.cleanup();
    } catch (cleanupError) {
      console.warn('[POSTING_QUEUE] ⚠️ Poster cleanup failed:', cleanupError.message);
    }
  }
}

async function postReply(decision: QueuedDecision): Promise<string> {
  if (!decision.target_tweet_id || !decision.target_username) {
    throw new Error('Reply decision missing target information');
  }
  
  console.log(`[POSTING_QUEUE] 💬 Posting reply to @${decision.target_username}: "${decision.content.substring(0, 50)}..."`);
  
  // For now, use the same posting infrastructure for replies
  // In a full implementation, this would navigate to the specific tweet and reply
  const { RailwayCompatiblePoster } = await import('../posting/railwayCompatiblePoster');
  const poster = new RailwayCompatiblePoster();
  
  try {
    const initSuccess = await poster.initialize();
    if (!initSuccess) {
      throw new Error('Failed to initialize poster for reply');
    }
    
    // For this implementation, we'll post a standalone tweet mentioning the user
    // A full implementation would navigate to the specific tweet and use the reply function
    const replyContent = `@${decision.target_username} ${decision.content}`;
    
    const result = await poster.postTweet(replyContent);
    
    if (!result.success) {
      throw new Error(result.error || 'Unknown reply posting error');
    }
    
    const tweetId = result.tweetId || `reply_${Date.now()}`;
    console.log(`[POSTING_QUEUE] ✅ Reply posted with ID: ${tweetId}`);
    
    return tweetId;
    
  } finally {
    try {
      await poster.cleanup();
    } catch (cleanupError) {
      console.warn('[POSTING_QUEUE] ⚠️ Reply poster cleanup failed:', cleanupError.message);
    }
  }
}

async function updateDecisionStatus(decisionId: string, status: string): Promise<void> {
  try {
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from('unified_ai_intelligence')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', decisionId);
    
    if (error) {
      console.warn(`[POSTING_QUEUE] ⚠️ Failed to update status for ${decisionId}:`, error.message);
    }
  } catch (error) {
    console.warn(`[POSTING_QUEUE] ⚠️ Failed to update status for ${decisionId}:`, error.message);
  }
}

async function markDecisionPosted(decisionId: string, tweetId: string): Promise<void> {
  try {
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from('unified_ai_intelligence')
      .update({ 
        status: 'posted',
        tweet_id: tweetId,
        posted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', decisionId);
    
    if (error) {
      console.warn(`[POSTING_QUEUE] ⚠️ Failed to mark posted for ${decisionId}:`, error.message);
    } else {
      console.log(`[POSTING_QUEUE] 📝 Decision ${decisionId} marked as posted with tweet ID: ${tweetId}`);
    }
  } catch (error) {
    console.warn(`[POSTING_QUEUE] ⚠️ Failed to mark posted for ${decisionId}:`, error.message);
  }
}

async function markDecisionFailed(decisionId: string, errorMessage: string): Promise<void> {
  try {
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from('unified_ai_intelligence')
      .update({ 
        status: 'failed',
        error_message: errorMessage,
        updated_at: new Date().toISOString()
      })
      .eq('id', decisionId);
    
    if (error) {
      console.warn(`[POSTING_QUEUE] ⚠️ Failed to mark failed for ${decisionId}:`, error.message);
    } else {
      console.log(`[POSTING_QUEUE] ❌ Decision ${decisionId} marked as failed: ${errorMessage}`);
    }
  } catch (error) {
    console.warn(`[POSTING_QUEUE] ⚠️ Failed to mark failed for ${decisionId}:`, error.message);
  }
}

async function updatePostingMetrics(type: 'queued' | 'posted' | 'error'): Promise<void> {
  try {
    const { updateMockMetrics } = await import('../api/metrics');
    
    switch (type) {
      case 'queued':
        updateMockMetrics({ postsQueued: 1 });
        break;
      case 'posted':
        updateMockMetrics({ postsPosted: 1 });
        break;
      case 'error':
        updateMockMetrics({ postingErrors: 1 });
        break;
    }
  } catch (error) {
    console.warn('[POSTING_QUEUE] ⚠️ Failed to update posting metrics:', error.message);
  }
}
