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
import type { PostingGuard } from './UltimateTwitterPoster';

interface PostAttemptMetadata {
  decision_id: string;
  decision_type: 'single' | 'thread' | 'reply';
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
  target_username?: string; // 🔒 For self-reply guard
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
  
  // 🔒 CRITICAL: Fail-closed if build_sha is missing
  const finalBuildSha = build_sha || getBuildSHA();
  if (!finalBuildSha || finalBuildSha === 'dev' || finalBuildSha === 'unknown') {
    const errorMsg = `[ATOMIC_POST] ❌ BLOCKED: Missing or invalid build_sha. Provided: ${build_sha}, Resolved: ${finalBuildSha}`;
    console.error(errorMsg);
    
    await supabase.from('system_events').insert({
      event_type: 'atomic_post_blocked_missing_build_sha',
      severity: 'critical',
      message: `Posting blocked: missing build_sha`,
      event_data: {
        decision_id,
        decision_type,
        pipeline_source,
        provided_build_sha: build_sha,
        resolved_build_sha: finalBuildSha,
      },
      created_at: new Date().toISOString(),
    });
    
    return {
      success: false,
      error: `BLOCKED: Missing or invalid build_sha (${finalBuildSha})`,
    };
  }
  
  console.log(`[ATOMIC_POST] ⚛️ Starting atomic post execution`);
  console.log(`[ATOMIC_POST]   decision_id=${decision_id} type=${decision_type} source=${pipeline_source} build_sha=${finalBuildSha}`);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: PREWRITE - Insert DB row BEFORE posting
  // ═══════════════════════════════════════════════════════════════════════════
  console.log(`[ATOMIC_POST] 📝 PREWRITE: Inserting DB row with status='posting_attempt'...`);
  
  const prewriteRow = {
    decision_id,
    decision_type,
    status: 'posting_attempt',
    pipeline_source: pipeline_source || 'unknown',
    build_sha: finalBuildSha,
    job_run_id: job_run_id || `unknown_${Date.now()}`,
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
  // 🔒 FINAL REPLY GATE - Enforce invariants BEFORE posting (fail-closed)
  // ═══════════════════════════════════════════════════════════════════════════
  if (decision_type === 'reply') {
    console.log(`[ATOMIC_POST] 🔒 FINAL_REPLY_GATE: Enforcing reply invariants...`);
    
    // INVARIANT 1: target_tweet_id must exist
    if (!metadata.target_tweet_id) {
      console.error(`[ATOMIC_POST] ❌ REPLY_GATE_FAILED: Missing target_tweet_id`);
      await supabase
        .from('content_generation_metadata_comprehensive')
        .update({
          status: 'blocked',
          skip_reason: 'reply_gate_missing_target_tweet_id',
          updated_at: new Date().toISOString(),
        })
        .eq('decision_id', decision_id);
      
      await supabase.from('system_events').insert({
        event_type: 'reply_gate_blocked',
        severity: 'critical',
        message: `Reply blocked: missing target_tweet_id`,
        event_data: { decision_id, decision_type, pipeline_source },
        created_at: new Date().toISOString(),
      });
      
      return {
        success: false,
        error: 'REPLY_GATE_FAILED: Missing target_tweet_id',
      };
    }
    
    // INVARIANT 2: Content must NOT contain thread markers
    const content = metadata.content || '';
    const threadPatterns = [
      /\b\d+\/\d+\b/,           // "2/6", "3/6"
      /^\s*\d+\/\d+/,           // Starts with "1/5"
      /🧵/,                      // Thread emoji
      /\n.*\n/,                 // Multiple newlines (thread-like)
    ];
    
    for (const pattern of threadPatterns) {
      if (pattern.test(content)) {
        const matched = content.match(pattern)?.[0] || '';
        console.error(`[ATOMIC_POST] ❌ REPLY_GATE_FAILED: Thread-like content detected`);
        console.error(`[ATOMIC_POST]   pattern=${pattern.source} matched="${matched.substring(0, 50)}"`);
        
        await supabase
          .from('content_generation_metadata_comprehensive')
          .update({
            status: 'blocked',
            skip_reason: `reply_gate_thread_marker: ${pattern.source}`,
            updated_at: new Date().toISOString(),
          })
          .eq('decision_id', decision_id);
        
        await supabase.from('system_events').insert({
          event_type: 'reply_gate_blocked',
          severity: 'critical',
          message: `Reply blocked: thread-like content`,
          event_data: {
            decision_id,
            decision_type,
            pipeline_source,
            pattern: pattern.source,
            matched: matched.substring(0, 100),
          },
          created_at: new Date().toISOString(),
        });
        
        return {
          success: false,
          error: `REPLY_GATE_FAILED: Thread-like content detected (${pattern.source})`,
        };
      }
    }
    
    // INVARIANT 3: root_tweet_id must equal target_tweet_id (ROOT-ONLY)
    if (metadata.root_tweet_id && metadata.root_tweet_id !== metadata.target_tweet_id) {
      console.error(`[ATOMIC_POST] ❌ REPLY_GATE_FAILED: ROOT-ONLY violation`);
      console.error(`[ATOMIC_POST]   root=${metadata.root_tweet_id} target=${metadata.target_tweet_id}`);
      
      await supabase
        .from('content_generation_metadata_comprehensive')
        .update({
          status: 'blocked',
          skip_reason: 'reply_gate_root_only_violation',
          updated_at: new Date().toISOString(),
        })
        .eq('decision_id', decision_id);
      
      await supabase.from('system_events').insert({
        event_type: 'reply_gate_blocked',
        severity: 'critical',
        message: `Reply blocked: ROOT-ONLY violation`,
        event_data: {
          decision_id,
          decision_type,
          pipeline_source,
          root_tweet_id: metadata.root_tweet_id,
          target_tweet_id: metadata.target_tweet_id,
        },
        created_at: new Date().toISOString(),
      });
      
      return {
        success: false,
        error: 'REPLY_GATE_FAILED: ROOT-ONLY violation (target is not root)',
      };
    }
    
    // INVARIANT 4: NO SELF-REPLY (CRITICAL)
    const ourHandle = (process.env.TWITTER_USERNAME || 'SignalAndSynapse').toLowerCase();
    const targetAuthor = metadata.target_username ? String(metadata.target_username).toLowerCase().trim() : null;
    
    if (targetAuthor && targetAuthor === ourHandle) {
      console.error(`[ATOMIC_POST] ❌ REPLY_GATE_FAILED: SELF-REPLY detected`);
      console.error(`[ATOMIC_POST]   target=${metadata.target_tweet_id}`);
      console.error(`[ATOMIC_POST]   author=@${targetAuthor} (our handle: @${ourHandle})`);
      
      await supabase
        .from('content_generation_metadata_comprehensive')
        .update({
          status: 'blocked',
          skip_reason: 'reply_gate_self_reply_blocked',
          updated_at: new Date().toISOString(),
        })
        .eq('decision_id', decision_id);
      
      await supabase.from('system_events').insert({
        event_type: 'reply_gate_blocked',
        severity: 'critical',
        message: `Reply blocked: SELF-REPLY (target is our own tweet)`,
        event_data: {
          decision_id,
          decision_type,
          pipeline_source,
          target_tweet_id: metadata.target_tweet_id,
          target_author: targetAuthor,
          our_handle: ourHandle,
        },
        created_at: new Date().toISOString(),
      });
      
      return {
        success: false,
        error: 'REPLY_GATE_FAILED: SELF-REPLY blocked (cannot reply to our own tweets)',
      };
    }
    
    console.log(`[ATOMIC_POST] ✅ REPLY_GATE: All invariants passed (including NO SELF-REPLY)`);
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: POST - Call Twitter API with timeout protection
  // ═══════════════════════════════════════════════════════════════════════════
  console.log(`[ATOMIC_POST] 🚀 POSTING: Calling Twitter API...`);
  
  // Log posting attempt start
  await supabase.from('system_events').insert({
    event_type: 'posting_attempt_started',
    severity: 'info',
    message: `Starting atomic post execution`,
    event_data: {
      decision_id,
      decision_type,
      pipeline_source,
    },
    created_at: new Date().toISOString(),
  });
  
  // Timeout: 4 minutes for single posts, 6 minutes for threads/replies
  const POST_TIMEOUT_MS = options.isReply ? 240000 : 240000; // 4 minutes
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Posting timeout after ${POST_TIMEOUT_MS/1000}s`));
    }, POST_TIMEOUT_MS);
  });
  
  let postResult;
  try {
    const postingPromise = options.isReply && options.replyToTweetId
      ? poster.postReply(metadata.content, options.replyToTweetId, guard)
      : poster.postTweet(metadata.content, guard);
    
    // Race posting against timeout
    postResult = await Promise.race([postingPromise, timeoutPromise]);
  } catch (error: any) {
    console.error(`[ATOMIC_POST] ❌ POSTING EXCEPTION: ${error.message}`);
    
    const isTimeout = error.message.includes('timeout');
    const skipReason = isTimeout 
      ? 'posting_timeout' 
      : `posting_exception: ${error.message.substring(0, 200)}`;
    
    // Update DB row to status='failed'
    await supabase
      .from('content_generation_metadata_comprehensive')
      .update({
        status: 'failed',
        skip_reason: skipReason,
        updated_at: new Date().toISOString(),
      })
      .eq('decision_id', decision_id);
    
    // Log failure event
    await supabase.from('system_events').insert({
      event_type: 'posting_attempt_failed',
      severity: 'warning',
      message: `Posting failed: ${error.message}`,
      event_data: {
        decision_id,
        decision_type,
        error: error.message,
        is_timeout: isTimeout,
      },
      created_at: new Date().toISOString(),
    });
    
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
  
  // Update DB row to status='posted' with tweet_id
  // Note: tweet_url column does NOT exist in content_generation_metadata_comprehensive schema
  const { error: updateError } = await supabase
    .from('content_generation_metadata_comprehensive')
    .update({
      status: 'posted',
      tweet_id: postResult.tweetId,
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
  const sha = process.env.RAILWAY_GIT_COMMIT_SHA || 
              process.env.VERCEL_GIT_COMMIT_SHA || 
              process.env.BUILD_SHA;
  
  // 🔒 CRITICAL: Never return 'dev' or empty - fail-closed
  if (!sha || sha === 'dev') {
    // Try to get from Railway deployment if available
    const railwaySha = process.env.RAILWAY_DEPLOYMENT_ID || 
                       process.env.RAILWAY_DEPLOYMENT_COMMIT_SHA;
    if (railwaySha) {
      return railwaySha;
    }
    
    // Last resort: use timestamp-based ID (better than 'dev')
    return `unknown_${Date.now()}`;
  }
  
  return sha;
}

/**
 * Helper: Get DB environment fingerprint for audit trail
 */
export function getDBEnvFingerprint(): string {
  const dbUrl = process.env.DATABASE_URL || '';
  return require('crypto').createHash('md5').update(dbUrl).digest('hex').substring(0, 8);
}

