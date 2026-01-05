/**
 * 🔒 POSTING GUARD - Single choke-point for ALL Twitter posting
 * 
 * EVERY post/reply MUST go through this guard.
 * This ensures:
 * 1. Decision row exists with all required fields
 * 2. Provenance is tracked (pipeline_source, generator_name, build_sha, job_run_id)
 * 3. Reply targets are verified as ROOT tweets
 * 4. DB write happens after successful post
 * 5. No bypass paths possible
 */

import { getSupabaseClient } from '../db';

export interface PostingRequest {
  decision_id: string;
  pipeline_source: 'postingQueue' | 'admin_manual' | 'test_only';
  content: string;
  decision_type: 'single' | 'thread' | 'reply';
  target_tweet_id?: string;
  target_username?: string;
  generator_name?: string;
  job_run_id?: string;
}

export interface PostingResult {
  success: boolean;
  tweet_id?: string;
  error?: string;
  blocked_reason?: string;
}

// Build SHA for provenance tracking
const BUILD_SHA = process.env.RAILWAY_GIT_COMMIT_SHA || 
                  process.env.GIT_COMMIT_SHA || 
                  `local-${Date.now()}`;

/**
 * 🚨 CRITICAL: This is the ONLY authorized path to post to Twitter
 * All other direct calls to UltimateTwitterPoster MUST be blocked
 */
export async function executeAuthorizedPost(request: PostingRequest): Promise<PostingResult> {
  const { decision_id, pipeline_source, content, decision_type, target_tweet_id, target_username, generator_name, job_run_id } = request;
  
  console.log(`[POSTING_GUARD] 🔒 Authorized post request received`);
  console.log(`[POSTING_GUARD]   decision_id=${decision_id}`);
  console.log(`[POSTING_GUARD]   pipeline_source=${pipeline_source}`);
  console.log(`[POSTING_GUARD]   decision_type=${decision_type}`);
  console.log(`[POSTING_GUARD]   build_sha=${BUILD_SHA}`);
  
  // ═══════════════════════════════════════════════════════════════════════
  // GATE 1: Require valid pipeline_source
  // ═══════════════════════════════════════════════════════════════════════
  const ALLOWED_SOURCES = ['postingQueue', 'admin_manual', 'test_only'];
  if (!ALLOWED_SOURCES.includes(pipeline_source)) {
    console.error(`[POSTING_GUARD] ⛔ BLOCKED: Invalid pipeline_source="${pipeline_source}"`);
    return { success: false, blocked_reason: 'invalid_pipeline_source' };
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // GATE 2: Require decision_id
  // ═══════════════════════════════════════════════════════════════════════
  if (!decision_id || decision_id === 'unknown' || decision_id.length < 10) {
    console.error(`[POSTING_GUARD] ⛔ BLOCKED: Invalid decision_id="${decision_id}"`);
    return { success: false, blocked_reason: 'missing_decision_id' };
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // GATE 3: Verify decision row exists in DB (except test_only)
  // ═══════════════════════════════════════════════════════════════════════
  const supabase = getSupabaseClient();
  
  if (pipeline_source !== 'test_only') {
    const { data: existingDecision, error: fetchError } = await supabase
      .from('content_generation_metadata_comprehensive')
      .select('decision_id, status, decision_type, content')
      .eq('decision_id', decision_id)
      .maybeSingle();
    
    if (fetchError || !existingDecision) {
      console.error(`[POSTING_GUARD] ⛔ BLOCKED: Decision row not found for ${decision_id}`);
      return { success: false, blocked_reason: 'decision_not_in_db' };
    }
    
    if (existingDecision.status === 'posted') {
      console.error(`[POSTING_GUARD] ⛔ BLOCKED: Decision ${decision_id} already posted`);
      return { success: false, blocked_reason: 'already_posted' };
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // GATE 4: For replies, verify target is ROOT tweet
  // ═══════════════════════════════════════════════════════════════════════
  if (decision_type === 'reply' && target_tweet_id) {
    const rootCheck = await verifyTargetIsRoot(target_tweet_id);
    if (!rootCheck.isRoot) {
      console.error(`[POSTING_GUARD] ⛔ BLOCKED: Target ${target_tweet_id} is NOT a root tweet`);
      console.error(`[POSTING_GUARD]   reason=${rootCheck.reason}`);
      
      await supabase.from('content_generation_metadata_comprehensive')
        .update({ 
          status: 'blocked', 
          skip_reason: 'post_time_root_check_failed',
          error_message: rootCheck.reason
        })
        .eq('decision_id', decision_id);
      
      return { success: false, blocked_reason: 'target_not_root', error: rootCheck.reason };
    }
    console.log(`[POSTING_GUARD] ✅ Target ${target_tweet_id} verified as ROOT`);
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // STORE PROVENANCE before posting
  // ═══════════════════════════════════════════════════════════════════════
  if (pipeline_source !== 'test_only') {
    await supabase.from('content_generation_metadata_comprehensive')
      .update({
        pipeline_source,
        build_sha: BUILD_SHA,
        job_run_id: job_run_id || null,
        generator_name: generator_name || null,
        post_attempt_at: new Date().toISOString()
      })
      .eq('decision_id', decision_id);
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // EXECUTE THE POST
  // ═══════════════════════════════════════════════════════════════════════
  console.log(`[POSTING_GUARD] 🚀 Executing post via UltimateTwitterPoster...`);
  
  try {
    const { UltimateTwitterPoster } = await import('./UltimateTwitterPoster');
    const poster = new UltimateTwitterPoster();
    
    let result: { success: boolean; tweetId?: string; error?: string };
    
    if (decision_type === 'reply' && target_tweet_id) {
      result = await poster.postReply(content, target_tweet_id);
    } else {
      result = await poster.postTweet(content);
    }
    
    if (!result.success) {
      console.error(`[POSTING_GUARD] ❌ Post failed: ${result.error}`);
      
      await supabase.from('content_generation_metadata_comprehensive')
        .update({ 
          status: 'failed',
          error_message: result.error || 'Unknown post error'
        })
        .eq('decision_id', decision_id);
      
      return { success: false, error: result.error };
    }
    
    const tweetId = result.tweetId || `unknown_${Date.now()}`;
    console.log(`[POSTING_GUARD] ✅ Post successful: tweet_id=${tweetId}`);
    
    // ═══════════════════════════════════════════════════════════════════════
    // DB WRITE: Persist tweet_id (REQUIRED - with retry)
    // ═══════════════════════════════════════════════════════════════════════
    const dbWriteSuccess = await persistPostResult(decision_id, tweetId, pipeline_source, BUILD_SHA, job_run_id);
    
    if (!dbWriteSuccess) {
      console.error(`[POSTING_GUARD] ⚠️ ALERT: Post succeeded but DB write failed!`);
      console.error(`[POSTING_GUARD]   decision_id=${decision_id} tweet_id=${tweetId}`);
      // Don't fail the overall result - the tweet was posted
      // But mark for reconciliation
    }
    
    return { success: true, tweet_id: tweetId };
    
  } catch (postError: any) {
    console.error(`[POSTING_GUARD] ❌ Post exception: ${postError.message}`);
    
    await supabase.from('content_generation_metadata_comprehensive')
      .update({ 
        status: 'failed',
        error_message: postError.message
      })
      .eq('decision_id', decision_id);
    
    return { success: false, error: postError.message };
  }
}

/**
 * Verify target tweet is a ROOT (not a reply)
 */
async function verifyTargetIsRoot(tweetId: string): Promise<{ isRoot: boolean; reason: string }> {
  try {
    // Use Playwright to fetch tweet page and check for "Replying to" indicator
    const { withBrowser } = await import('../infra/playwright/withBrowser');
    
    const result = await withBrowser(async (page) => {
      const url = `https://x.com/i/status/${tweetId}`;
      await page.goto(url, { timeout: 15000 });
      await page.waitForTimeout(2000);
      
      // Check if tweet exists
      const notFound = await page.locator('text="This post is from an account that no longer exists"').isVisible({ timeout: 2000 }).catch(() => false);
      if (notFound) {
        return { isRoot: false, reason: 'tweet_deleted_or_not_found' };
      }
      
      // Check for "Replying to" text which indicates this is a reply
      const replyingTo = await page.locator('[data-testid="Tweet-User-Avatar"] ~ div:has-text("Replying to")').isVisible({ timeout: 2000 }).catch(() => false);
      if (replyingTo) {
        return { isRoot: false, reason: 'target_is_a_reply_tweet' };
      }
      
      // Check for reply thread indicator in conversation
      const inReplyChain = await page.locator('article').first().locator('text="Show this thread"').isVisible({ timeout: 1000 }).catch(() => false);
      if (inReplyChain) {
        // Could still be root of a thread, check more carefully
        const hasParentTweet = await page.locator('[data-testid="ancestor"]').isVisible({ timeout: 1000 }).catch(() => false);
        if (hasParentTweet) {
          return { isRoot: false, reason: 'target_has_parent_tweet' };
        }
      }
      
      return { isRoot: true, reason: 'verified_root' };
    });
    
    return result;
    
  } catch (error: any) {
    console.error(`[POSTING_GUARD] Root verification error: ${error.message}`);
    // Fail CLOSED - if we can't verify, don't post
    return { isRoot: false, reason: `verification_error: ${error.message}` };
  }
}

/**
 * Persist post result to DB with retry
 */
async function persistPostResult(
  decisionId: string, 
  tweetId: string, 
  pipelineSource: string,
  buildSha: string,
  jobRunId?: string
): Promise<boolean> {
  const supabase = getSupabaseClient();
  const maxRetries = 3;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { error } = await supabase
        .from('content_generation_metadata_comprehensive')
        .update({
          status: 'posted',
          tweet_id: tweetId,
          posted_at: new Date().toISOString(),
          pipeline_source: pipelineSource,
          build_sha: buildSha,
          job_run_id: jobRunId || null
        })
        .eq('decision_id', decisionId);
      
      if (!error) {
        console.log(`[POSTING_GUARD] ✅ DB write successful (attempt ${attempt})`);
        return true;
      }
      
      console.error(`[POSTING_GUARD] DB write attempt ${attempt} failed: ${error.message}`);
      
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * attempt)); // Backoff
      }
      
    } catch (dbError: any) {
      console.error(`[POSTING_GUARD] DB write exception attempt ${attempt}: ${dbError.message}`);
      
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }
  }
  
  // All retries failed - log to posting_attempts as fallback
  console.error(`[POSTING_GUARD] 🚨 All DB write retries failed! Logging to posting_attempts...`);
  
  try {
    await supabase.from('posting_attempts').insert({
      decision_id: decisionId,
      tweet_id: tweetId,
      status: 'post_succeeded_db_write_failed',
      pipeline_source: pipelineSource,
      build_sha: buildSha,
      attempted_at: new Date().toISOString()
    });
  } catch (fallbackError: any) {
    console.error(`[POSTING_GUARD] 🚨 CRITICAL: Even fallback write failed: ${fallbackError.message}`);
  }
  
  return false;
}

/**
 * 🚫 BLOCK LEGACY BYPASS PATHS
 * This is called by guard checks in legacy files
 */
export function assertPostingGuardRequired(): never {
  throw new Error(
    '[POSTING_GUARD] 🚨 BLOCKED: Direct posting is not allowed. ' +
    'All posts must go through PostingGuard.executeAuthorizedPost(). ' +
    'This is a security and data integrity requirement.'
  );
}

export const BUILD_SHA_FOR_PROVENANCE = BUILD_SHA;

