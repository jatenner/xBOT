#!/usr/bin/env tsx
/**
 * 🎯 MAC RUNNER SCHEDULER + POSTER
 * 
 * Converts reply_candidate_queue → reply_decisions → posts
 * Uses CDP-authenticated Chrome session
 */

import fs from 'fs';
import path from 'path';

// Load .env.local first
const envLocalPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  require('dotenv').config({ path: envLocalPath });
} else {
  require('dotenv').config();
}

// Set runner mode
process.env.RUNNER_MODE = 'true';
if (!process.env.RUNNER_PROFILE_DIR) {
  process.env.RUNNER_PROFILE_DIR = path.join(process.cwd(), '.runner-profile');
}
if (!process.env.RUNNER_BROWSER) {
  process.env.RUNNER_BROWSER = 'cdp';
}

async function main() {
  const isLoop = process.argv.includes('--loop');
  const GLOBAL_TIMEOUT_MS = 60000; // 60s hard global timeout
  const globalStartTime = Date.now();
  let lastCandidateSeen: string | null = null;
  let lastStageSeen: string | null = 'initializing';
  
  // Global timeout watchdog
  const globalTimeoutTimer = setTimeout(async () => {
    console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('           ❌ SCHEDULER GLOBAL TIMEOUT');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error(`Timeout after ${GLOBAL_TIMEOUT_MS}ms`);
    console.error(`Last candidate seen: ${lastCandidateSeen || 'none'}`);
    console.error(`Last stage seen: ${lastStageSeen || 'none'}`);
    console.error('Error: scheduler_global_timeout');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Try to release any stuck candidates
    if (lastCandidateSeen) {
      try {
        const { getSupabaseClient } = await import('../../src/db');
        const { releaseLease } = await import('../../src/jobs/replySystemV2/queueManager');
        const supabase = getSupabaseClient();
        await releaseLease(lastCandidateSeen);
        console.error(`🔧 Released stuck candidate: ${lastCandidateSeen}`);
      } catch (releaseError: any) {
        console.error(`⚠️  Failed to release candidate: ${releaseError.message}`);
      }
    }
    
    process.exit(1);
  }, GLOBAL_TIMEOUT_MS);
  
  // Clear timeout on successful completion
  const clearGlobalTimeout = () => clearTimeout(globalTimeoutTimer);
  
  try {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('           🎯 MAC RUNNER SCHEDULER + POSTER');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    if (isLoop) {
      console.log('🔄 Loop mode: Running every 60s with backoff\n');
    }
    
    // Log configuration at start
    console.log('📋 Scheduler configuration:');
    console.log(`   RUNNER_MODE: ${process.env.RUNNER_MODE || 'not set'}`);
    console.log(`   RUNNER_BROWSER: ${process.env.RUNNER_BROWSER || 'not set'}`);
    console.log(`   RUNNER_PROFILE_DIR: ${process.env.RUNNER_PROFILE_DIR || 'not set'}`);
    console.log(`   RUN_STARTED_AT: ${process.env.RUN_STARTED_AT || 'not set'}`);
    console.log('');
  
  // Step 1: Auto-sync env (fail-closed)
  console.log('📥 Step 1: Syncing env from Railway...');
  try {
    const { execSync } = require('child_process');
    execSync('pnpm run runner:autosync', { stdio: 'inherit' });
    console.log('✅ Env synced\n');
  } catch (error: any) {
    console.error(`❌ Env sync failed: ${error.message}`);
    process.exit(1);
  }
  
  // Step 2: Check session (direct function call, no execSync)
  console.log('🔐 Step 2: Checking session...');
  console.log(`   RUNNER_MODE: ${process.env.RUNNER_MODE || 'not set'}`);
  console.log(`   RUNNER_BROWSER: ${process.env.RUNNER_BROWSER || 'not set'}`);
  console.log(`   RUNNER_PROFILE_DIR: ${process.env.RUNNER_PROFILE_DIR || 'not set'}`);
  
  // Check if session was already confirmed (from one-shot)
  const sessionAlreadyConfirmed = process.env.SESSION_CONFIRMED === 'true';
  
  let sessionOk = false;
  if (sessionAlreadyConfirmed) {
    console.log('✅ Session already confirmed by one-shot workflow');
    sessionOk = true;
  } else {
    // Import and call checkSession function directly
    try {
      const { checkSession } = await import('./session-check');
      const sessionResult = await checkSession();
      sessionOk = sessionResult.status === 'SESSION_OK';
      
      if (sessionOk) {
        console.log('✅ Session OK\n');
        console.log(`   URL: ${sessionResult.url}`);
        console.log(`   Reason: ${sessionResult.reason}`);
      } else {
        console.error(`❌ Session expired: ${sessionResult.reason}`);
        console.error('   Run: pnpm run runner:login');
        clearGlobalTimeout();
        process.exit(1); // Exit 1 for session expiry (real failure)
      }
    } catch (error: any) {
      console.error(`❌ Session check failed: ${error.message}`);
      console.error(`   Stack: ${error.stack?.split('\n')[0]}`);
      clearGlobalTimeout();
      // Exit 1 for actual errors (not timeouts, which are handled by checkSession)
      process.exit(1);
    }
  }
  
  console.log(`   session_ok: ${sessionOk}\n`);
  
  // Step 3: Lazy import after env is loaded
  const { getSupabaseClient } = await import('../../src/db');
  const supabase = getSupabaseClient();
  
  // Step 4: Fetch candidates from queue (prefer fresh ones created after runStartedAt if provided)
  console.log('📋 Step 3: Fetching candidates from reply_candidate_queue...');
  const runStartedAt = process.env.RUN_STARTED_AT || null;
  
  // Try to fetch fresh candidates first (created after runStartedAt)
  let candidates: any[] | null = null;
  let candidatesAreFresh = false;
  
  if (runStartedAt) {
    const { data: freshCandidates, error: freshError } = await supabase
      .from('reply_candidate_queue')
      .select('*')
      .eq('status', 'queued')
      .gt('expires_at', new Date().toISOString())
      .gte('created_at', runStartedAt)
      .order('predicted_tier', { ascending: true })
      .order('overall_score', { ascending: false })
      .limit(5);
    
    if (!freshError && freshCandidates && freshCandidates.length > 0) {
      candidates = freshCandidates;
      candidatesAreFresh = true;
      console.log(`✅ Found ${candidates.length} fresh candidates (created after ${runStartedAt})\n`);
    }
  }
  
  // Fallback to any queued candidates if no fresh ones found
  if (!candidates || candidates.length === 0) {
    let query = supabase
      .from('reply_candidate_queue')
      .select('*')
      .eq('status', 'queued')
      .gt('expires_at', new Date().toISOString());
    
    // SCHEDULER_SINGLE_ID: Process exactly one candidate by tweet_id
    const singleId = process.env.SCHEDULER_SINGLE_ID;
    if (singleId) {
      query = query.eq('candidate_tweet_id', singleId);
      console.log(`🎯 SINGLE_ID mode: Processing only candidate ${singleId}\n`);
    }
    
    query = query
      .order('predicted_tier', { ascending: true })
      .order('overall_score', { ascending: false })
      .limit(singleId ? 1 : 5);
    
    // Add timeout to DB query to prevent hanging (fast-noop)
    const DB_QUERY_TIMEOUT_MS = 10000; // 10s max for DB query
    let allCandidates: any[] | null = null;
    let queueError: any = null;
    
    try {
      const queryPromise = query;
      const timeoutPromise = new Promise<any>((_, reject) => {
        setTimeout(() => reject(new Error('DB query TIMED OUT after 10s')), DB_QUERY_TIMEOUT_MS);
      });
      
      const result = await Promise.race([queryPromise, timeoutPromise]);
      allCandidates = result.data || null;
      queueError = result.error || null;
    } catch (error: any) {
      if (error.message.includes('TIMED OUT')) {
        console.error(`❌ Failed to fetch candidates: ${error.message}`);
        console.error(`   Operation: fetch_candidates_from_queue`);
        clearGlobalTimeout();
        console.log('⚠️  Non-fatal: Exiting gracefully due to timeout');
        process.exit(0); // Exit 0 instead of 1 (non-fatal, fast-noop)
      } else {
        queueError = error;
      }
    }
    
    if (queueError) {
      console.error(`❌ Failed to fetch candidates: ${queueError.message}`);
      clearGlobalTimeout();
      console.log('⚠️  Non-fatal: Exiting gracefully due to query error');
      process.exit(0); // Exit 0 instead of 1 (non-fatal, fast-noop)
    }
    
    if (!allCandidates || allCandidates.length === 0) {
      console.log('⚠️  No candidates available in queue');
      clearGlobalTimeout();
      process.exit(0); // Fast-noop: exit immediately when empty
    }
    
    candidates = allCandidates;
    if (runStartedAt) {
      console.log(`⚠️  WARNING: No fresh candidates found, using existing queue (may contain stale candidates)\n`);
    }
    console.log(`✅ Found ${candidates.length} candidates\n`);
  }
  
  // If SINGLE_ID mode and no candidates match, exit
  const singleId = process.env.SCHEDULER_SINGLE_ID;
  if (singleId && (!candidates || candidates.length === 0 || candidates[0].candidate_tweet_id !== singleId)) {
    console.log(`⚠️  Candidate ${singleId} not found in queue`);
    clearGlobalTimeout();
    process.exit(0);
  }
  
  // Step 5: Process candidates through scheduler (one at a time)
  let decisionsCreated = 0;
  let postedSuccess = 0;
  let postedFailed = 0;
  const failureReasons: Record<string, number> = {};
  
  // Debug limit: only process N candidates if SCHEDULER_DEBUG_LIMIT is set
  const debugLimit = process.env.SCHEDULER_DEBUG_LIMIT ? parseInt(process.env.SCHEDULER_DEBUG_LIMIT, 10) : null;
  const maxCandidates = debugLimit || 3; // Default to 3, or use debug limit
  const candidatesToProcess = candidates.slice(0, maxCandidates);
  
  if (debugLimit) {
    console.log(`🔍 DEBUG MODE: Processing only ${debugLimit} candidates`);
  }
  
  // Helper: Timeout wrapper with logging
  async function withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    operationName: string
  ): Promise<T> {
    const startTime = Date.now();
    console.log(`   ⏱️  Starting ${operationName} (timeout: ${timeoutMs}ms)...`);
    
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        setTimeout(() => {
          const elapsed = Date.now() - startTime;
          reject(new Error(`${operationName} TIMED OUT after ${elapsed}ms (limit: ${timeoutMs}ms)`));
        }, timeoutMs);
      }),
    ]).then(result => {
      const elapsed = Date.now() - startTime;
      console.log(`   ✅ ${operationName} completed in ${elapsed}ms`);
      return result;
    }).catch(error => {
      const elapsed = Date.now() - startTime;
      console.error(`   ❌ ${operationName} failed after ${elapsed}ms: ${error.message}`);
      throw error;
    });
  }
  
  // attemptScheduledReply processes one candidate and creates reply_decisions
  // We'll call it once per candidate
  for (let i = 0; i < candidatesToProcess.length; i++) {
    const candidate = candidatesToProcess[i];
    const candidateStartTime = Date.now();
    const CANDIDATE_MAX_TIME_MS = 15000; // 15s watchdog per candidate
    
    try {
      console.log(`\n🎯 Processing candidate ${i + 1}/${candidatesToProcess.length}: ${candidate.candidate_tweet_id} (tier=${candidate.predicted_tier}, score=${candidate.overall_score})`);
      
      // Watchdog: If candidate takes too long, skip it
      const schedulerPromise = (async () => {
        // Run tieredScheduler (it fetches from queue internally and creates reply_decisions)
        const { attemptScheduledReply } = await import('../../src/jobs/replySystemV2/tieredScheduler');
        return await attemptScheduledReply();
      })();
      
      lastStageSeen = 'scheduler_executing';
      const schedulerResult = await withTimeout(
        schedulerPromise,
        CANDIDATE_MAX_TIME_MS,
        `Candidate ${candidate.candidate_tweet_id} processing`
      );
      
      if (schedulerResult.posted) {
        lastStageSeen = 'decision_created';
        decisionsCreated++;
        console.log(`   ✅ Decision created and queued: ${schedulerResult.candidate_tweet_id || candidate.candidate_tweet_id}`);
        
        // Wait a moment for decision to be written
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Immediately process posting queue
        lastStageSeen = 'posting_queue';
        console.log(`   📮 Processing posting queue...`);
        const { processPostingQueue } = await import('../../src/jobs/postingQueue');
        await processPostingQueue({ maxItems: 1 });
        
        // Wait for posting to complete
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Check if it posted successfully
        const { data: recentPosts } = await supabase
          .from('system_events')
          .select('event_type, event_data, created_at')
          .eq('event_type', 'POST_SUCCESS')
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (recentPosts && recentPosts.length > 0) {
          const post = recentPosts[0];
          const data = typeof post.event_data === 'string' ? JSON.parse(post.event_data) : post.event_data;
          const postTime = new Date(post.created_at).getTime();
          const now = Date.now();
          
          // Only count if posted in last 10 seconds
          if (now - postTime < 10000) {
            postedSuccess++;
            const tweetUrl = data.tweet_url || `https://x.com/i/status/${data.posted_reply_tweet_id}`;
            console.log(`   ✅ POST_SUCCESS: ${tweetUrl}`);
            
            // Early exit: stop once we get 1 POST_SUCCESS (for fast one-shot runs)
            if (postedSuccess >= 1) {
              console.log(`\n🎯 Early exit: Achieved 1 POST_SUCCESS - stopping scheduler`);
              clearGlobalTimeout();
              break; // Exit the loop
            }
          }
        } else {
          // Check for POST_FAILED
          lastStageSeen = 'posting_failed_check';
          const { data: failedPosts } = await supabase
            .from('system_events')
            .select('event_type, event_data, created_at')
            .eq('event_type', 'POST_FAILED')
            .order('created_at', { ascending: false })
            .limit(1);
          
          if (failedPosts && failedPosts.length > 0) {
            const failed = failedPosts[0];
            const failedTime = new Date(failed.created_at).getTime();
            const now = Date.now();
            
            if (now - failedTime < 10000) {
              postedFailed++;
              const data = typeof failed.event_data === 'string' ? JSON.parse(failed.event_data) : failed.event_data;
              const reason = data.deny_reason_code || data.reason || 'unknown';
              failureReasons[reason] = (failureReasons[reason] || 0) + 1;
              console.log(`   ❌ POST_FAILED: ${reason}`);
            }
          }
        }
      } else {
        console.log(`   ⏭️  Scheduler skipped: ${schedulerResult.reason || 'unknown'}`);
        failureReasons[schedulerResult.reason || 'skipped'] = (failureReasons[schedulerResult.reason || 'skipped'] || 0) + 1;
      }
    } catch (error: any) {
      lastStageSeen = 'error';
      const elapsed = Date.now() - candidateStartTime;
      if (error.message.includes('TIMED OUT') || elapsed >= CANDIDATE_MAX_TIME_MS) {
        console.error(`   ⏱️  Candidate ${candidate.candidate_tweet_id} exceeded ${CANDIDATE_MAX_TIME_MS}ms watchdog - SKIPPING`);
        failureReasons['candidate_timeout'] = (failureReasons['candidate_timeout'] || 0) + 1;
      } else {
        console.error(`   ❌ Error processing candidate: ${error.message} (${elapsed}ms)`);
        failureReasons['error'] = (failureReasons['error'] || 0) + 1;
      }
      
      // Reset candidate status if it was stuck (release lease if exists)
      try {
        const { releaseLease } = await import('../../src/jobs/replySystemV2/queueManager');
        await releaseLease(candidate.candidate_tweet_id, candidate.lease_id);
        console.log(`   🔧 Released candidate ${candidate.candidate_tweet_id} (lease released)`);
      } catch (releaseError: any) {
        // Fallback: try direct update
        try {
          await supabase
            .from('reply_candidate_queue')
            .update({ status: 'queued', selected_at: null, lease_id: null })
            .eq('id', candidate.id);
          console.log(`   🔧 Reset candidate ${candidate.candidate_tweet_id} status to queued`);
        } catch (resetError: any) {
          console.warn(`   ⚠️  Failed to reset candidate status: ${resetError.message}`);
        }
      }
    }
    
    // If SINGLE_ID mode, exit after first candidate
    if (singleId) {
      console.log(`\n🎯 SINGLE_ID mode: Exiting after processing ${candidate.candidate_tweet_id}`);
      clearGlobalTimeout();
      break;
    }
  }
  
  // Final summary with detailed counters
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           📊 SCHEDULER SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log(`Candidates fetched: ${candidates.length}`);
  console.log(`Candidates considered: ${candidatesToProcess.length}`);
  console.log(`Candidates processed: ${candidatesToProcess.length}`);
  console.log(`Decisions created: ${decisionsCreated}`);
  console.log(`POST_SUCCESS: ${postedSuccess}`);
  console.log(`POST_FAILED: ${postedFailed}`);
  
  // Count decisions from DB to verify accounting
  const { count: dbDecisionsCount } = await supabase
    .from('reply_decisions')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'queued')
    .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()); // Last 5 minutes
  
  console.log(`\nAccounting check:`);
  console.log(`   DB queued decisions (last 5min): ${dbDecisionsCount || 0}`);
  console.log(`   Logged decisions created: ${decisionsCreated}`);
  
  if (dbDecisionsCount !== decisionsCreated && dbDecisionsCount && decisionsCreated > 0) {
    console.log(`   ⚠️  Accounting mismatch: DB shows ${dbDecisionsCount || 0}, we counted ${decisionsCreated}`);
  }
  
  if (Object.keys(failureReasons).length > 0) {
    console.log('\nFailure reasons:');
    Object.entries(failureReasons)
      .sort((a, b) => b[1] - a[1])
      .forEach(([reason, count]) => {
        console.log(`   ${reason}: ${count}`);
      });
  }
  
  // Get outcomes from DB (last 5 minutes)
  const { data: recentOutcomes } = await supabase
    .from('system_events')
    .select('event_data, created_at')
    .eq('event_type', 'scheduler_outcome')
    .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false });
  
  if (recentOutcomes && recentOutcomes.length > 0) {
    console.log('\nPer-candidate outcomes (from DB):');
    recentOutcomes.forEach((outcome, i) => {
      const data = typeof outcome.event_data === 'string' 
        ? JSON.parse(outcome.event_data) 
        : outcome.event_data;
      const type = data.outcome_type || 'UNKNOWN';
      const tweetId = data.candidate_tweet_id || 'N/A';
      const reason = data.deny_reason_code || data.error_stage || 'OK';
      const timings = data.stage_timings || {};
      const totalMs = timings.total_ms || 0;
      console.log(`   ${i + 1}. ${type}: ${tweetId} | ${reason} | ${totalMs}ms`);
      if (timings.fetch_ms || timings.ancestry_ms || timings.quality_ms) {
        const parts = [];
        if (timings.fetch_ms) parts.push(`fetch=${timings.fetch_ms}ms`);
        if (timings.ancestry_ms) parts.push(`ancestry=${timings.ancestry_ms}ms`);
        if (timings.quality_ms) parts.push(`quality=${timings.quality_ms}ms`);
        console.log(`      ${parts.join(', ')}`);
      }
    });
  }
  
  console.log('');
  
    // Clear global timeout on successful completion
    clearGlobalTimeout();
    
    // Loop mode
    if (isLoop) {
      const delay = 60 * 1000; // 60 seconds
      console.log(`⏰ Waiting ${delay / 1000}s before next run...\n`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return main(); // Recursive call
    }
  } catch (error: any) {
    // Clear timeout on error
    clearGlobalTimeout();
    console.error('\n❌ Scheduler error:', error.message);
    console.error(`Last candidate seen: ${lastCandidateSeen || 'none'}`);
    console.error(`Last stage seen: ${lastStageSeen || 'none'}`);
    
    // Release stuck candidate
    if (lastCandidateSeen) {
      try {
        const { releaseLease } = await import('../../src/jobs/replySystemV2/queueManager');
        await releaseLease(lastCandidateSeen);
      } catch (releaseError: any) {
        console.warn(`⚠️  Failed to release candidate: ${releaseError.message}`);
      }
    }
    
    throw error;
  }
}

main().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
