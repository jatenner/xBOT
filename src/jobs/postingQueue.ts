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

interface QueuedDecisionRow {
  [key: string]: unknown;
  id: unknown;
  content: unknown;
  decision_type: unknown;
  target_tweet_id?: unknown;
  target_username?: unknown;
  bandit_arm: unknown;
  timing_arm?: unknown;
  predicted_er: unknown;
  quality_score?: unknown;
  topic_cluster: unknown;
  status: unknown;
  created_at: unknown;
}

async function checkPostingRateLimits(): Promise<boolean> {
  const config = getConfig();
  const maxPostsPerHour = parseInt(String(config.MAX_POSTS_PER_HOUR || 1));
  
  try {
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { count, error } = await supabase
      .from('posted_decisions')
      .select('*', { count: 'exact', head: true })
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
      .from('content_metadata')
      .select('*')
      .eq('status', 'queued')
      .eq('generation_source', 'real')
      .order('created_at', { ascending: true })
      .limit(5); // Process max 5 at a time to avoid overwhelming Twitter
    
    if (error) {
      console.error('[POSTING_QUEUE] ❌ Failed to fetch ready decisions:', error.message);
      return [];
    }
    
    if (!data || data.length === 0) {
      return [];
    }
    
    // Map raw rows to typed decisions
    const rows = data as QueuedDecisionRow[];
    const decisions: QueuedDecision[] = rows.map(row => ({
      id: String(row.id ?? ''),
      content: String(row.content ?? ''),
      decision_type: String(row.decision_type ?? 'content') as 'content' | 'reply',
      target_tweet_id: row.target_tweet_id ? String(row.target_tweet_id) : undefined,
      target_username: row.target_username ? String(row.target_username) : undefined,
      bandit_arm: String(row.bandit_arm ?? ''),
      timing_arm: row.timing_arm ? String(row.timing_arm) : undefined,
      predicted_er: Number(row.predicted_er ?? 0),
      quality_score: row.quality_score ? Number(row.quality_score) : undefined,
      topic_cluster: String(row.topic_cluster ?? ''),
      status: String(row.status ?? 'ready_for_posting'),
      created_at: String(row.created_at ?? new Date().toISOString())
    }));
    
    return decisions;
    
  } catch (error) {
    console.error('[POSTING_QUEUE] ❌ Failed to fetch ready decisions:', error.message);
    return [];
  }
}

async function processDecision(decision: QueuedDecision): Promise<void> {
  console.log(`[POSTING_QUEUE] 📮 Processing ${decision.decision_type}: ${decision.id}`);
  
    // Note: We keep status as 'queued' until actually posted
    // No intermediate 'posting' status to avoid DB constraint violations
    
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
  
  // Use the new postTweet function with built-in retry + traces
  const { postTweet } = await import('../posting/railwayCompatiblePoster');
  
  const result = await postTweet(decision.content);
  
  if (!result.success) {
    // Artifacts logged by withBrowser on failure (/tmp/trace-*.zip, /tmp/fail-*.png)
    throw new Error(result.error || 'Unknown posting error');
  }
  
  const tweetId = result.id || `posted_${Date.now()}`;
  console.log(`[POSTING_QUEUE] ✅ Content posted with ID: ${tweetId}`);
  
  return tweetId;
}

async function postReply(decision: QueuedDecision): Promise<string> {
  if (!decision.target_tweet_id || !decision.target_username) {
    throw new Error('Reply decision missing target information');
  }
  
  console.log(`[POSTING_QUEUE] 💬 Posting reply to @${decision.target_username}: "${decision.content.substring(0, 50)}..."`);
  
  // For now, use the same posting infrastructure for replies
  // In a full implementation, this would navigate to the specific tweet and reply
  const { postTweet } = await import('../posting/railwayCompatiblePoster');
  
  // For this implementation, we'll post a standalone tweet mentioning the user
  // A full implementation would navigate to the specific tweet and use the reply function
  const replyContent = `@${decision.target_username} ${decision.content}`;
  
  const result = await postTweet(replyContent);
  
  if (!result.success) {
    // Artifacts logged by withBrowser on failure
    throw new Error(result.error || 'Unknown reply posting error');
  }
  
  const tweetId = result.id || `reply_${Date.now()}`;
  console.log(`[POSTING_QUEUE] ✅ Reply posted with ID: ${tweetId}`);
  
  return tweetId;
}

async function updateDecisionStatus(decisionId: string, status: string): Promise<void> {
  try {
    const { getSupabaseClient } = await import('../db/index');
    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from('content_metadata')
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
    
    // 1. Update content_metadata status
    const { error: updateError } = await supabase
      .from('content_metadata')
      .update({ 
        status: 'posted',
        updated_at: new Date().toISOString()
      })
      .eq('id', decisionId);
    
    if (updateError) {
      console.warn(`[POSTING_QUEUE] ⚠️ Failed to update content_metadata for ${decisionId}:`, updateError.message);
    }
    
    // 2. Get the full decision details for posted_decisions archive
    const { data: decisionData, error: fetchError } = await supabase
      .from('content_metadata')
      .select('*')
      .eq('id', decisionId)
      .single();
    
    if (fetchError || !decisionData) {
      console.warn(`[POSTING_QUEUE] ⚠️ Failed to fetch decision data for ${decisionId}`);
      return;
    }
    
    // 3. Store in posted_decisions archive
    const { error: archiveError } = await supabase
      .from('posted_decisions')
      .insert([{
        decision_id: decisionId,
        content: decisionData.content,
        tweet_id: tweetId,
        decision_type: decisionData.decision_type || 'content',
        target_tweet_id: decisionData.target_tweet_id,
        target_username: decisionData.target_username,
        bandit_arm: decisionData.bandit_arm,
        timing_arm: decisionData.timing_arm,
        predicted_er: decisionData.predicted_er,
        quality_score: decisionData.quality_score,
        topic_cluster: decisionData.topic_cluster,
        posted_at: new Date().toISOString()
      }]);
    
    if (archiveError) {
      console.warn(`[POSTING_QUEUE] ⚠️ Failed to archive posted decision ${decisionId}:`, archiveError.message);
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
      .from('content_metadata')
      .update({ 
        status: 'failed',
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
