/**
 * ⚛️ ATOMIC POST EXECUTOR
 * 
 * Implements DB-prewrite guarantee: NO POST WITHOUT DB ROW.
 * 
 * Flow:
 * 1. Prewrite: Insert row with status='posting_attempt' BEFORE posting
 * 2. Post: Only if prewrite succeeds, call Twitter API
 * 3. Update: Mark status='posted' with tweet_id on success, or status='failed' on error
 * 
 * CRITICAL INVARIANT: If DB insert fails, posting is BLOCKED (fail-closed).
 */

import { getSupabaseClient } from '../db/index';
import { UltimateTwitterPoster } from './UltimateTwitterPoster';
import type { PostingGuard } from './PostingGuard';

interface PostAttemptMetadata {
  decision_id: string;
  decision_type: 'post' | 'reply';
  pipeline_source: string;
  build_sha: string;
  job_run_id: string;
  content: string;
  // Reply-specific
  target_tweet_id?: string;
  root_tweet_id?: string;
  target_tweet_content_snapshot?: string;
  target_tweet_content_hash?: string;
  semantic_similarity?: number;
}

interface ExecutePostResult {
  success: boolean;
  tweet_id?: string;
  tweet_url?: string;
  error?: string;
  prewrite_failed?: boolean;
}

/**
 * Execute an authorized post with atomic DB-prewrite guarantee
 */
export async function executeAuthorizedPost(
  poster: UltimateTwitterPoster,
  guard: PostingGuard,
  metadata: PostAttemptMetadata,
  options: {
    isReply?: boolean;
    replyToTweetId?: string;
  } = {}
): Promise<ExecutePostResult> {
  const supabase = getSupabaseClient();
  const { decision_id, decision_type, pipeline_source, build_sha, job_run_id } = metadata;
  
  console.log(`[ATOMIC_POST] ⚛️ Starting atomic post execution`);
  console.log(`[ATOMIC_POST]   decision_id=${decision_id} type=${decision_type} source=${pipeline_source}`);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: PREWRITE - Insert DB row BEFORE posting
  // ═══════════════════════════════════════════════════════════════════════════
  console.log(`[ATOMIC_POST] 📝 PREWRITE: Inserting DB row with status='posting_attempt'...`);
  
  const prewriteRow = {
    decision_id,
    decision_type,
    status: 'posting_attempt',
    pipeline_source,
    build_sha,
    job_run_id,
    content: metadata.content,
    target_tweet_id: metadata.target_tweet_id,
    root_tweet_id: metadata.root_tweet_id,
    target_tweet_content_snapshot: metadata.target_tweet_content_snapshot,
    target_tweet_content_hash: metadata.target_tweet_content_hash,
    semantic_similarity: metadata.semantic_similarity,
    created_at: new Date().toISOString(),
  };
  
  const { error: prewriteError } = await supabase
    .from('content_generation_metadata_comprehensive')
    .upsert(prewriteRow, {
      onConflict: 'decision_id',
    });
  
  if (prewriteError) {
    console.error(`[ATOMIC_POST] ❌ PREWRITE FAILED: ${prewriteError.message}`);
    console.error(`[ATOMIC_POST]   🚨 CRITICAL: Posting is BLOCKED (fail-closed)`);
    console.error(`[ATOMIC_POST]   decision_id=${decision_id}`);
    
    // Log to system_events
    await supabase.from('system_events').insert({
      event_type: 'atomic_post_prewrite_failed',
      severity: 'critical',
      message: `DB prewrite failed, posting blocked: ${prewriteError.message}`,
      event_data: {
        decision_id,
        decision_type,
        pipeline_source,
        error: prewriteError.message,
      },
      created_at: new Date().toISOString(),
    });
    
    return {
      success: false,
      error: `PREWRITE_FAILED: ${prewriteError.message}`,
      prewrite_failed: true,
    };
  }
  
  console.log(`[ATOMIC_POST] ✅ PREWRITE SUCCESS: DB row inserted`);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: POST - Call Twitter API
  // ═══════════════════════════════════════════════════════════════════════════
  console.log(`[ATOMIC_POST] 🚀 POSTING: Calling Twitter API...`);
  
  let postResult;
  try {
    if (options.isReply && options.replyToTweetId) {
      postResult = await poster.postReply(metadata.content, options.replyToTweetId, guard);
    } else {
      postResult = await poster.postTweet(metadata.content, guard);
    }
  } catch (error: any) {
    console.error(`[ATOMIC_POST] ❌ POSTING EXCEPTION: ${error.message}`);
    
    // Update DB row to status='failed'
    await supabase
      .from('content_generation_metadata_comprehensive')
      .update({
        status: 'failed',
        skip_reason: `posting_exception: ${error.message}`,
        updated_at: new Date().toISOString(),
      })
      .eq('decision_id', decision_id);
    
    return {
      success: false,
      error: error.message,
    };
  }
  
  if (!postResult.success || !postResult.tweetId) {
    console.error(`[ATOMIC_POST] ❌ POSTING FAILED: ${postResult.error || 'No tweetId returned'}`);
    
    // Update DB row to status='failed'
    await supabase
      .from('content_generation_metadata_comprehensive')
      .update({
        status: 'failed',
        skip_reason: postResult.error || 'no_tweet_id_returned',
        updated_at: new Date().toISOString(),
      })
      .eq('decision_id', decision_id);
    
    return {
      success: false,
      error: postResult.error || 'Posting failed: no tweetId',
    };
  }
  
  console.log(`[ATOMIC_POST] ✅ POSTING SUCCESS: tweet_id=${postResult.tweetId}`);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3: UPDATE - Mark row as 'posted' with tweet_id
  // ═══════════════════════════════════════════════════════════════════════════
  console.log(`[ATOMIC_POST] 💾 UPDATE: Marking DB row as posted...`);
  
  const { error: updateError } = await supabase
    .from('content_generation_metadata_comprehensive')
    .update({
      status: 'posted',
      tweet_id: postResult.tweetId,
      tweet_url: postResult.tweetUrl,
      posted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('decision_id', decision_id);
  
  if (updateError) {
    console.error(`[ATOMIC_POST] ⚠️ UPDATE FAILED: ${updateError.message}`);
    console.error(`[ATOMIC_POST]   🚨 CRITICAL: Tweet posted but DB not updated!`);
    console.error(`[ATOMIC_POST]   tweet_id=${postResult.tweetId} decision_id=${decision_id}`);
    
    // Log to system_events
    await supabase.from('system_events').insert({
      event_type: 'atomic_post_update_failed',
      severity: 'critical',
      message: `Tweet posted but DB update failed: ${updateError.message}`,
      event_data: {
        decision_id,
        tweet_id: postResult.tweetId,
        error: updateError.message,
      },
      created_at: new Date().toISOString(),
    });
  } else {
    console.log(`[ATOMIC_POST] ✅ UPDATE SUCCESS: DB row updated with tweet_id`);
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // SUCCESS: Return tweet_id
  // ═══════════════════════════════════════════════════════════════════════════
  console.log(`[ATOMIC_POST] 🎉 COMPLETE: Atomic post execution successful`);
  
  return {
    success: true,
    tweet_id: postResult.tweetId,
    tweet_url: postResult.tweetUrl,
  };
}

/**
 * Helper: Get build SHA for audit trail
 */
export function getBuildSHA(): string {
  return process.env.RAILWAY_GIT_COMMIT_SHA || 
         process.env.VERCEL_GIT_COMMIT_SHA || 
         process.env.BUILD_SHA || 
         'dev';
}

/**
 * Helper: Get DB environment fingerprint for audit trail
 */
export function getDBEnvFingerprint(): string {
  const dbUrl = process.env.DATABASE_URL || '';
  return require('crypto').createHash('md5').update(dbUrl).digest('hex').substring(0, 8);
}

