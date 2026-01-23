/**
 * ⏰ TIERED POSTING SCHEDULER
 * 
 * Posts ONE reply every 15 minutes from queue
 * Tiers: 1 (>=5000), 2 (>=1000), 3 (>=500), 4 (block)
 */

import { getSupabaseClient } from '../../db/index';
import { getNextCandidateFromQueue } from './queueManager';
import { createHash } from 'crypto';
import { computeSemanticSimilarity } from '../../gates/semanticGate';

// Outcome tracking interface
interface OutcomeData {
  outcome_type: 'DECISION_CREATED' | 'DENY' | 'SKIP' | 'ERROR' | 'TIMEOUT';
  candidate_tweet_id: string;
  candidate_id?: string;
  author_handle?: string;
  url: string;
  stage_timings?: {
    fetch_ms?: number;
    ancestry_ms?: number;
    quality_ms?: number;
    allow_ms?: number;
    total_ms: number;
  };
  deny_reason_code?: string;
  deny_reason_detail?: any;
  error_stage?: string;
  error_message?: string;
  decision_id?: string;
}


// 🔒 TASK 4: Throughput knobs via env vars (safe, reversible)
const REPLY_V2_TICK_SECONDS = parseInt(process.env.REPLY_V2_TICK_SECONDS || '900', 10); // Default: 15 min (900s)
const POSTING_INTERVAL_MINUTES = REPLY_V2_TICK_SECONDS / 60;
const TARGET_REPLIES_PER_HOUR = 4;
const TARGET_REPLIES_PER_TICK = Math.floor((TARGET_REPLIES_PER_HOUR * REPLY_V2_TICK_SECONDS) / 3600); // Replies per tick

export interface SchedulerResult {
  posted: boolean;
  candidate_tweet_id?: string;
  tier?: number;
  reason: string;
  behind_schedule: boolean;
}

// Outcome tracking interface
interface OutcomeData {
  outcome_type: 'DECISION_CREATED' | 'DENY' | 'SKIP' | 'ERROR' | 'TIMEOUT';
  candidate_tweet_id: string;
  candidate_id?: string;
  author_handle?: string;
  url: string;
  stage_timings?: {
    fetch_ms?: number;
    ancestry_ms?: number;
    quality_ms?: number;
    allow_ms?: number;
    total_ms: number;
  };
  deny_reason_code?: string;
  deny_reason_detail?: any;
  error_stage?: string;
  error_message?: string;
  decision_id?: string;
}

// Global counters for this run
const runCounters = {
  candidates_fetched: 0,
  candidates_considered: 0,
  decisions_created: 0,
  denies_by_reason: {} as Record<string, number>,
  skips_by_reason: {} as Record<string, number>,
  timeouts_by_stage: {} as Record<string, number>,
  insert_failures: 0,
  errors: [] as Array<{ stage: string; message: string }>,
};

/**
 * Log outcome to console and DB
 */
async function logOutcome(supabase: any, schedulerRunId: string, outcome: OutcomeData): Promise<void> {
  const logLine = `[OUTCOME] ${outcome.outcome_type}: ${outcome.candidate_tweet_id} | ${outcome.deny_reason_code || outcome.error_stage || 'OK'} | ${outcome.stage_timings?.total_ms || 0}ms`;
  
  if (outcome.outcome_type === 'DECISION_CREATED') {
    console.log(`✅ ${logLine}`);
    runCounters.decisions_created++;
  } else if (outcome.outcome_type === 'DENY') {
    const reason = outcome.deny_reason_code || 'UNKNOWN';
    console.log(`🚫 ${logLine}`);
    runCounters.denies_by_reason[reason] = (runCounters.denies_by_reason[reason] || 0) + 1;
  } else if (outcome.outcome_type === 'SKIP') {
    const reason = outcome.deny_reason_code || 'UNKNOWN';
    console.log(`⏭️  ${logLine}`);
    runCounters.skips_by_reason[reason] = (runCounters.skips_by_reason[reason] || 0) + 1;
  } else if (outcome.outcome_type === 'TIMEOUT') {
    const stage = outcome.error_stage || 'UNKNOWN';
    console.log(`⏱️  ${logLine}`);
    runCounters.timeouts_by_stage[stage] = (runCounters.timeouts_by_stage[stage] || 0) + 1;
  } else {
    console.error(`❌ ${logLine}`);
    runCounters.errors.push({
      stage: outcome.error_stage || 'UNKNOWN',
      message: outcome.error_message || 'Unknown error',
    });
  }
  
  // Persist to DB
  try {
    await supabase.from('system_events').insert({
      event_type: 'scheduler_outcome',
      severity: outcome.outcome_type === 'DECISION_CREATED' ? 'info' : 
                outcome.outcome_type === 'TIMEOUT' ? 'warning' : 'error',
      message: logLine,
      event_data: {
        scheduler_run_id: schedulerRunId,
        ...outcome,
      },
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn(`[SCHEDULER] Failed to log outcome to DB: ${(e as Error).message}`);
  }
}

/**
 * Attempt to post ONE reply from queue
 */
export async function attemptScheduledReply(): Promise<SchedulerResult> {
  const supabase = getSupabaseClient();
  const schedulerRunId = `scheduler_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const slotTime = new Date();
  
  // 🔒 REPLY_QUEUE instrumentation
  console.log('[REPLY_QUEUE] ✅ job_tick start');
  let readyCandidates = 0;
  let selectedCandidates = 0;
  let attemptsStarted = 0;
  
  // Helper to emit REPLY_QUEUE_TICK
  const emitReplyQueueTick = async () => {
    try {
      await supabase.from('system_events').insert({
        event_type: 'REPLY_QUEUE_TICK',
        severity: 'info',
        message: `Reply queue tick: ready=${readyCandidates} selected=${selectedCandidates} attempts=${attemptsStarted}`,
        event_data: { ready_candidates: readyCandidates, selected_candidates: selectedCandidates, attempts_started: attemptsStarted },
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn(`[REPLY_QUEUE_TICK] Failed to write system_events: ${(e as Error).message}`);
    }
  };
  
  // Helper to emit REPLY_QUEUE_BLOCKED
  const emitReplyQueueBlock = async (reason: string, eventData?: Record<string, unknown>) => {
    console.warn(`[REPLY_QUEUE_BLOCK] reason=${reason}`);
    try {
      await supabase.from('system_events').insert({
        event_type: 'REPLY_QUEUE_BLOCKED',
        severity: 'warning',
        message: `Reply queue blocked: ${reason}`,
        event_data: { reason, ...eventData },
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn(`[REPLY_QUEUE_BLOCK] Failed to write system_events: ${(e as Error).message}`);
    }
  };
  
  // 🔒 CRITICAL: Log job start IMMEDIATELY (before any work)
  const runnerMode = process.env.RUNNER_MODE === 'true' ? 'MAC_RUNNER' : 'RAILWAY';
  const earlyExitReason = process.env.RUNNER_MODE !== 'true' ? 'RUNNER_MODE_NOT_SET' : null;
  
  try {
    await supabase.from('system_events').insert({
      event_type: 'reply_v2_scheduler_job_started',
      severity: 'info',
      message: `Reply V2 scheduler job started: scheduler_run_id=${schedulerRunId} runner_mode=${runnerMode}`,
      event_data: {
        scheduler_run_id: schedulerRunId,
        slot_time: slotTime.toISOString(),
        runner_mode: runnerMode,
        early_exit_reason: earlyExitReason,
      },
      created_at: new Date().toISOString(),
    });
    console.log(`[SCHEDULER] ✅ Job start logged: ${schedulerRunId} (runner_mode=${runnerMode})`);
  } catch (logError: any) {
    console.error(`[SCHEDULER] ❌ Failed to log job start: ${logError.message}`);
    // Continue anyway - logging failure shouldn't block scheduler
  }
  
  // Early exit check for Railway (Playwright disabled)
  if (process.env.RUNNER_MODE !== 'true') {
    const exitMsg = `[SCHEDULER] ⏸️ Early exit: RUNNER_MODE not set. Scheduler requires browser access (Playwright disabled on Railway). Run on Mac Runner with RUNNER_MODE=true.`;
    console.log(exitMsg);
    await supabase.from('system_events').insert({
      event_type: 'reply_v2_scheduler_early_exit',
      severity: 'warning',
      message: exitMsg,
      event_data: { scheduler_run_id: schedulerRunId, reason: 'RUNNER_MODE_NOT_SET' },
      created_at: new Date().toISOString(),
    });
    
    // Get ready candidates count
    const { count: queueCount } = await supabase
      .from('reply_candidate_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'queued')
      .gt('expires_at', new Date().toISOString());
    readyCandidates = queueCount || 0;
    
    // Emit block and tick
    await emitReplyQueueBlock('RUNNER_MODE_NOT_SET');
    await emitReplyQueueTick();
    
    // Update job heartbeat
    try {
      const { recordJobSkip } = await import('../jobHeartbeat');
      await recordJobSkip('reply_queue', 'RUNNER_MODE_NOT_SET');
    } catch (e) {
      // Ignore heartbeat errors
    }
    
    // Log outcome
    await logOutcome(supabase, schedulerRunId, {
      outcome_type: 'SKIP',
      candidate_tweet_id: 'N/A',
      url: 'N/A',
      deny_reason_code: 'RUNNER_MODE_NOT_SET',
      stage_timings: { total_ms: 0 },
    });
    
    return {
      posted: false,
      reason: 'RUNNER_MODE_NOT_SET',
      behind_schedule: false,
    };
  }
  
  console.log('[SCHEDULER] ⏰ Attempting scheduled reply...');
  console.log(`[PIPELINE] scheduler_run_id=${schedulerRunId} stage=scheduler_start ok=true detail=attempting_reply runner_mode=${runnerMode}`);
  
  // 🔒 MANDATE 3: Cleanup expired leases BEFORE selecting new one
  const { cleanupExpiredLeases } = await import('./queueManager');
  const cleanedLeases = await cleanupExpiredLeases();
  if (cleanedLeases > 0) {
    console.log(`[SCHEDULER] 🔧 Cleaned up ${cleanedLeases} expired leases`);
  }
  
  // Also cleanup old "selected" status for backward compatibility
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count: stuckCount } = await supabase
    .from('reply_candidate_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'selected')
    .lt('selected_at', tenMinutesAgo);
  
  if ((stuckCount || 0) > 0) {
    console.log(`[SCHEDULER] 🔧 Resetting ${stuckCount} stuck "selected" candidates...`);
    await supabase
      .from('reply_candidate_queue')
      .update({ status: 'queued', selected_at: null, scheduler_run_id: null })
      .eq('status', 'selected')
      .lt('selected_at', tenMinutesAgo);
  }
  
  // Round to nearest 15-min slot
  const slotMinutes = Math.floor(slotTime.getMinutes() / 15) * 15;
  slotTime.setMinutes(slotMinutes, 0, 0);
  
  console.log(`[SCHEDULER] 🆔 Scheduler run ID: ${schedulerRunId}`);
  
  // 🎯 PART B: Prevent scheduler from looping on same bad candidates
  // Check for recent DENY decisions with ANCESTRY_SKIPPED_OVERLOAD/ANCESTRY_TIMEOUT and skip those candidates
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: recentDenies } = await supabase
    .from('reply_decisions')
    .select('target_tweet_id')
    .gte('created_at', thirtyMinutesAgo)
    .eq('decision', 'DENY')
    .in('deny_reason_code', ['ANCESTRY_SKIPPED_OVERLOAD', 'ANCESTRY_ACQUIRE_CONTEXT_TIMEOUT', 'ANCESTRY_TIMEOUT']);
  
  const deniedTweetIds = new Set(recentDenies?.map(d => d.target_tweet_id).filter(Boolean) || []);
  if (deniedTweetIds.size > 0) {
    console.log(`[SCHEDULER] 🚫 Skipping ${deniedTweetIds.size} tweet IDs with recent DENY decisions (backoff)`);
  }
  console.log(`[SCHEDULER] ⏰ Slot time: ${slotTime.toISOString()}`);
  
  // Check if we're behind schedule
  const behindSchedule = await checkBehindSchedule();
  
  // Try tiers in order
  let candidate = await getNextCandidateFromQueue(1, deniedTweetIds); // Tier 1 first
  let tier = 1;
  let candidateLeaseId: string | undefined = candidate?.lease_id;
  let candidateQueueId: string | undefined = candidate?.id;
  
  if (!candidate) {
    candidate = await getNextCandidateFromQueue(2, deniedTweetIds); // Tier 2
    tier = 2;
    candidateLeaseId = candidate?.lease_id;
    candidateQueueId = candidate?.id;
  }
  
  if (!candidate && behindSchedule) {
    candidate = await getNextCandidateFromQueue(3, deniedTweetIds); // Tier 3 only if behind
    tier = 3;
    candidateLeaseId = candidate?.lease_id;
    candidateQueueId = candidate?.id;
  }
  
  // Get queue metrics for SLO tracking
  const { data: queueMetrics } = await supabase
    .from('reply_candidate_queue')
    .select('predicted_tier')
    .eq('status', 'queued')
    .gt('expires_at', new Date().toISOString());
  
  const queueSize = queueMetrics?.length || 0;
  const tier1Count = queueMetrics?.filter(q => q.predicted_tier === 1).length || 0;
  const tier2Count = queueMetrics?.filter(q => q.predicted_tier === 2).length || 0;
  const tier3Count = queueMetrics?.filter(q => q.predicted_tier === 3).length || 0;
  
  if (!candidate) {
    console.log('[SCHEDULER] ⚠️ No candidates available in queue');
    console.log(`[PIPELINE] scheduler_run_id=${schedulerRunId} stage=scheduler_end ok=false detail=queue_empty`);
    
    // Log SLO event
    await supabase
      .from('reply_slo_events')
      .insert({
        scheduler_run_id: schedulerRunId,
        slot_time: slotTime.toISOString(),
        posted: false,
        reason: 'queue_empty',
        queue_size: queueSize,
        tier_1_count: tier1Count,
        tier_2_count: tier2Count,
        tier_3_count: tier3Count,
        slo_hit: false,
        slo_target: TARGET_REPLIES_PER_HOUR,
      });
    
    // Trigger immediate refill if queue empty
    if (queueSize === 0) {
      console.log('[SCHEDULER] 🔄 Queue empty - triggering immediate refill...');
      const { refreshCandidateQueue } = await import('./queueManager');
      await refreshCandidateQueue();
    }
    
    // Log outcome
    await logOutcome(supabase, schedulerRunId, {
      outcome_type: 'SKIP',
      candidate_tweet_id: 'N/A',
      url: 'N/A',
      deny_reason_code: 'queue_empty',
      stage_timings: { total_ms: 0 },
    });
    
    // Update ready candidates count (already set above)
    selectedCandidates = 0;
    attemptsStarted = 0;
    
    // Emit REPLY_QUEUE_TICK
    await emitReplyQueueTick();
    
    // Update job heartbeat
    try {
      const { recordJobSkip } = await import('../jobHeartbeat');
      await recordJobSkip('reply_queue', 'queue_empty');
    } catch (e) {
      // Ignore heartbeat errors
    }
    
    return {
      posted: false,
      reason: 'queue_empty',
      behind_schedule: behindSchedule,
    };
  }
  
  console.log(`[SCHEDULER] 🎯 Selected candidate: ${candidate.candidate_tweet_id} (tier ${tier}, lease_id=${candidateLeaseId})`);
  
  // Initialize tracking for this candidate
  const candidateStartTime = Date.now();
  let stageTimings: { fetch_ms?: number; ancestry_ms?: number; quality_ms?: number; allow_ms?: number; generation_ms?: number; total_ms: number } = { total_ms: 0 };
  
  // 🔒 MANDATE 1: Create decision + permit IMMEDIATELY after selection, BEFORE generation
  let decisionId: string;
  let permit_id: string;
  let queueId: string | undefined = candidateQueueId;
  let candidateData: any = null;
  const WATCHDOG_TIMEOUT_MS = 45000; // 45s total watchdog
  
  // Watchdog: Abort if total time exceeds 45s
  const watchdogTimer = setTimeout(async () => {
    if (candidateLeaseId) {
      console.error(`[SCHEDULER] ⚠️ WATCHDOG: Candidate ${candidate.candidate_tweet_id} exceeded ${WATCHDOG_TIMEOUT_MS}ms - releasing lease`);
      const { releaseLease } = await import('./queueManager');
      await releaseLease(candidate.candidate_tweet_id, candidateLeaseId);
      
      stageTimings.total_ms = Date.now() - candidateStartTime;
      await logOutcome(supabase, schedulerRunId, {
        outcome_type: 'TIMEOUT',
        candidate_tweet_id: candidate.candidate_tweet_id,
        candidate_id: candidate.evaluation_id,
        url: `https://x.com/i/status/${candidate.candidate_tweet_id}`,
        error_stage: 'watchdog',
        error_message: `Total processing time exceeded ${WATCHDOG_TIMEOUT_MS}ms`,
        stage_timings: stageTimings,
      });
    }
  }, WATCHDOG_TIMEOUT_MS);
  
  try {
    console.log(`[SCHEDULER] 💓 Heartbeat: Starting candidate processing for ${candidate.candidate_tweet_id}`);
    
    // Get candidate details (including scores for quality tracking)
    const dataFetchStart = Date.now();
    console.log(`[SCHEDULER] 💓 Heartbeat: Fetching candidate data...`);
    const { data: fetchedCandidateData } = await supabase
      .from('candidate_evaluations')
      .select('candidate_tweet_id, candidate_author_username, candidate_content, topic_relevance_score, velocity_score, recency_score, author_signal_score, predicted_tier, predicted_24h_views, overall_score')
      .eq('id', candidate.evaluation_id)
      .single();
    
    candidateData = fetchedCandidateData;
    const dataFetchElapsed = Date.now() - dataFetchStart;
    console.log(`[SCHEDULER] 💓 Heartbeat: Candidate data fetched in ${dataFetchElapsed}ms`);
    
    if (!candidateData) {
      stageTimings.total_ms = Date.now() - candidateStartTime;
      await logOutcome(supabase, schedulerRunId, {
        outcome_type: 'ERROR',
        candidate_tweet_id: candidate.candidate_tweet_id,
        candidate_id: candidate.evaluation_id,
        url: `https://x.com/i/status/${candidate.candidate_tweet_id}`,
        error_stage: 'data_fetch',
        error_message: 'Candidate data not found',
        stage_timings: stageTimings,
      });
      throw new Error('Candidate data not found');
    }
    
    // Use lease_id for traceability (already have queueId from getNextCandidateFromQueue)
    if (queueId && candidateLeaseId) {
      // Update queue with scheduler_run_id (keep lease active)
      await supabase
        .from('reply_candidate_queue')
        .update({ scheduler_run_id: schedulerRunId })
        .eq('id', queueId)
        .eq('lease_id', candidateLeaseId); // Only update our lease
    }
    
    // 🔒 TASK 2: Create decision in DRAFT/PENDING state FIRST (before generation)
    const { v4: uuidv4 } = await import('uuid');
    decisionId = uuidv4();
    
    // 🔒 TASK 1: Fetch FULL tweet text from Twitter (canonical source)
    // Use the same fetchTweetData function from contextLockVerifier
    console.log(`[SCHEDULER] 🌐 Fetching full tweet text from Twitter for ${candidate.candidate_tweet_id}...`);
    let targetTweetContentSnapshot: string;
    let snapshotSource: 'live_fetch' | 'candidate_extract' = 'live_fetch';
    let snapshotLenLive = 0;
    
    const FETCH_TWEET_TIMEOUT_MS = 12000; // 12s hard timeout for tweet fetch
    const fetchStartTime = Date.now();
    console.log(`[SCHEDULER] 💓 Heartbeat: Starting tweet fetch (timeout: ${FETCH_TWEET_TIMEOUT_MS}ms)...`);
    
    // Store isReply from fetch for fail-open logic
    let isReplyFromFetch: boolean | undefined = undefined;
    
    try {
      // Use the EXACT same fetch function as contextLockVerifier
      const { fetchTweetData } = await import('../../gates/contextLockVerifier');
      const tweetData = await Promise.race([
        fetchTweetData(candidate.candidate_tweet_id),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('FETCH_TWEET_TIMEOUT')), FETCH_TWEET_TIMEOUT_MS);
        }),
      ]) as any;
      
      const fetchElapsed = Date.now() - fetchStartTime;
      stageTimings.fetch_ms = fetchElapsed;
      console.log(`[SCHEDULER] 💓 Heartbeat: Tweet fetch completed in ${fetchElapsed}ms`);
      
      if (tweetData && tweetData.text && tweetData.text.trim().length >= 20) {
        targetTweetContentSnapshot = tweetData.text.trim();
        snapshotLenLive = tweetData.text.trim().length;
        snapshotSource = 'live_fetch';
        isReplyFromFetch = tweetData.isReply || false; // Store isReply for fail-open logic
        console.log(`[SCHEDULER] ✅ Fetched full tweet text in ${fetchElapsed}ms: ${snapshotLenLive} chars, isReply=${isReplyFromFetch}`);
      } else {
        throw new Error(`Fetched text too short or null: ${tweetData?.text?.length || 0} chars`);
      }
    } catch (fetchError: any) {
      const fetchElapsed = Date.now() - fetchStartTime;
      stageTimings.fetch_ms = fetchElapsed;
      const errorMsg = fetchError.message.includes('TIMEOUT') 
        ? `fetch timed out after ${fetchElapsed}ms` 
        : fetchError.message;
      console.warn(`[SCHEDULER] ⚠️ Failed to fetch live tweet text (${fetchElapsed}ms): ${errorMsg}, falling back to candidate content`);
      
      // If it's a timeout, log it but continue with fallback
      if (fetchError.message.includes('TIMEOUT')) {
        console.log(`[SCHEDULER] 💓 Heartbeat: Fetch timeout after ${fetchElapsed}ms - using fallback`);
      }
      // Fallback to candidate content
      targetTweetContentSnapshot = candidateData.candidate_content || '';
      snapshotSource = 'candidate_extract';
      snapshotLenLive = 0;
      
      if (!targetTweetContentSnapshot || targetTweetContentSnapshot.length < 20) {
        clearTimeout(watchdogTimer);
        stageTimings.total_ms = Date.now() - candidateStartTime;
        
        // Release lease on failure
        if (candidateLeaseId) {
          const { releaseLease } = await import('./queueManager');
          await releaseLease(candidate.candidate_tweet_id, candidateLeaseId);
        }
        
        await logOutcome(supabase, schedulerRunId, {
          outcome_type: 'ERROR',
          candidate_tweet_id: candidate.candidate_tweet_id,
          candidate_id: candidate.evaluation_id,
          author_handle: candidateData.candidate_author_username,
          url: `https://x.com/i/status/${candidate.candidate_tweet_id}`,
          error_stage: 'fetch',
          error_message: `Candidate content too short: ${targetTweetContentSnapshot.length} chars`,
          stage_timings: stageTimings,
        });
        throw new Error(`Candidate content too short: ${targetTweetContentSnapshot.length} chars`);
      }
    }
    
    // Normalize snapshot text (remove extra whitespace, normalize line breaks)
    const { normalizeTweetText } = await import('../../gates/contextLockVerifier');
    const normalizedSnapshot = normalizeTweetText(targetTweetContentSnapshot);
    
    // Compute SHA256 hash
    const targetTweetContentHash = createHash('sha256')
      .update(normalizedSnapshot)
      .digest('hex');
    
    // 🔒 TASK 2: Compute prefix hash (first 500 chars)
    const prefixText = normalizedSnapshot.slice(0, 500);
    const targetTweetContentPrefixHash = createHash('sha256')
      .update(prefixText)
      .digest('hex');
    
    console.log(`[SCHEDULER] 📸 Snapshot saved: ${normalizedSnapshot.length} chars, hash=${targetTweetContentHash.substring(0, 16)}..., source=${snapshotSource}`);
    
    // 🔒 TASK 3: Emit snapshot_saved event with source and lengths
    await supabase.from('system_events').insert({
      event_type: 'reply_v2_snapshot_saved',
      severity: 'info',
      message: `Reply V2 snapshot saved: decision_id=${decisionId} source=${snapshotSource}`,
      event_data: {
        decision_id: decisionId,
        snapshot_length: normalizedSnapshot.length,
        snapshot_len_live: snapshotLenLive,
        snapshot_len_saved: normalizedSnapshot.length,
        snapshot_source: snapshotSource,
        hash_length: targetTweetContentHash.length,
        hash_preview: targetTweetContentHash.substring(0, 16),
        prefix_hash_preview: targetTweetContentPrefixHash.substring(0, 16),
      },
      created_at: new Date().toISOString(),
    });
    
    // 🔍 FORENSIC PIPELINE: Resolve ancestry and record decision
    const { resolveTweetAncestry, recordReplyDecision, shouldAllowReply } = await import('./replyDecisionRecorder');
    
    // Add timeout and logging around ancestry resolution
    const ancestryStartTime = Date.now();
    const ANCESTRY_TIMEOUT_MS = 12000; // 12s hard timeout for ancestry
    console.log(`[SCHEDULER] 💓 Heartbeat: Starting ancestry resolution (timeout: ${ANCESTRY_TIMEOUT_MS}ms)...`);
    
    let ancestry;
    try {
      ancestry = await Promise.race([
        resolveTweetAncestry(candidate.candidate_tweet_id),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('ANCESTRY_TIMEOUT')), ANCESTRY_TIMEOUT_MS);
        }),
      ]) as any;
      const ancestryElapsed = Date.now() - ancestryStartTime;
      stageTimings.ancestry_ms = ancestryElapsed;
      console.log(`[SCHEDULER] 💓 Heartbeat: Ancestry resolution completed in ${ancestryElapsed}ms`);
      console.log(`[SCHEDULER] ✅ Ancestry resolved in ${ancestryElapsed}ms: status=${ancestry.status}, isRoot=${ancestry.isRoot}`);
    } catch (ancestryError: any) {
      const ancestryElapsed = Date.now() - ancestryStartTime;
      stageTimings.ancestry_ms = ancestryElapsed;
      console.error(`[SCHEDULER] ❌ Ancestry resolution failed after ${ancestryElapsed}ms: ${ancestryError.message}`);
      
      // Return an error ancestry result
      ancestry = {
        targetTweetId: candidate.candidate_tweet_id,
        targetInReplyToTweetId: null,
        rootTweetId: null,
        ancestryDepth: null,
        isRoot: false,
        status: 'ERROR' as const,
        confidence: 'LOW' as const,
        method: 'timeout',
        error: `ANCESTRY_TIMEOUT: ${ancestryError.message}`,
        cache_hit: false,
      };
      
      // Log timeout outcome and release lease
      clearTimeout(watchdogTimer);
      stageTimings.total_ms = Date.now() - candidateStartTime;
      
      if (candidateLeaseId) {
        const { releaseLease } = await import('./queueManager');
        await releaseLease(candidate.candidate_tweet_id, candidateLeaseId);
      }
      
      await logOutcome(supabase, schedulerRunId, {
        outcome_type: 'TIMEOUT',
        candidate_tweet_id: candidate.candidate_tweet_id,
        candidate_id: candidate.evaluation_id,
        author_handle: (candidateData as any)?.candidate_author_username,
        url: `https://x.com/i/status/${candidate.candidate_tweet_id}`,
        error_stage: 'ancestry',
        error_message: ancestryError.message,
        stage_timings: stageTimings,
      });
      
      throw new Error(`Ancestry resolution timeout: ${ancestryError.message}`);
    }
    
    const allowCheckStartTime = Date.now();
    console.log(`[SCHEDULER] 💓 Heartbeat: Starting allow check...`);
    
    // Check for consent_wall in ancestry error
    const hasConsentWall = ancestry.error?.toLowerCase().includes('consent_wall') || false;
    
    // Pass context to shouldAllowReply for fail-open logic
    // isReplyFromFetch is already set from fetchTweetData above (or undefined if fetch failed)
    const allowCheck = await shouldAllowReply(ancestry, {
      consent_wall: hasConsentWall,
      isReply: isReplyFromFetch, // Will be undefined if fetch failed, false if root, true if reply
      author_handle: candidateData.candidate_author_username,
      tweet_id: candidate.candidate_tweet_id,
    });
    const allowCheckElapsed = Date.now() - allowCheckStartTime;
    stageTimings.allow_ms = allowCheckElapsed;
    console.log(`[SCHEDULER] 💓 Heartbeat: Allow check completed in ${allowCheckElapsed}ms`);
    console.log(`[SCHEDULER] ✅ Allow check completed in ${allowCheckElapsed}ms: allow=${allowCheck.allow}, reason=${allowCheck.reason}`);
    
    // 🔒 FRESHNESS CHECK - Enforce maximum tweet age (default 48h) at scheduler time
    const MAX_TWEET_AGE_HOURS = parseInt(process.env.REPLY_MAX_TWEET_AGE_HOURS || '48', 10);
    const MAX_TWEET_AGE_MS = MAX_TWEET_AGE_HOURS * 60 * 60 * 1000;
    const isTestMode = process.env.RUNNER_TEST_MODE === 'true' && process.env.RUNNER_MODE === 'true';
    
    // Check tweet age from reply_opportunities
    const { data: freshnessOpportunity } = await supabase
      .from('reply_opportunities')
      .select('tweet_posted_at')
      .eq('target_tweet_id', candidate.candidate_tweet_id)
      .maybeSingle();
    
    if (freshnessOpportunity?.tweet_posted_at && !isTestMode) {
      const postedAt = new Date(freshnessOpportunity.tweet_posted_at);
      const ageMs = Date.now() - postedAt.getTime();
      const ageHours = ageMs / (60 * 60 * 1000);
      
      if (ageMs > MAX_TWEET_AGE_MS) {
        console.error(`[SCHEDULER] 🚫 Tweet too old: ${ageHours.toFixed(1)}h (max=${MAX_TWEET_AGE_HOURS}h)`);
        
        await recordReplyDecision({
          decision_id: decisionId,
          target_tweet_id: candidate.candidate_tweet_id,
          target_in_reply_to_tweet_id: null,
          root_tweet_id: candidate.candidate_tweet_id,
          ancestry_depth: 0,
          is_root: true,
          decision: 'DENY',
          reason: `Tweet too old: ${ageHours.toFixed(1)}h > ${MAX_TWEET_AGE_HOURS}h`,
          deny_reason_code: 'TWEET_TOO_OLD',
          deny_reason_detail: JSON.stringify({ age_hours: ageHours.toFixed(1), max_hours: MAX_TWEET_AGE_HOURS }),
          status: 'RESOLVED',
          confidence: 'HIGH',
          method: 'freshness_check',
          cache_hit: false,
          trace_id: schedulerRunId,
          job_run_id: schedulerRunId,
          pipeline_source: 'reply_v2_scheduler',
        } as any);
        
        clearTimeout(watchdogTimer);
        stageTimings.total_ms = Date.now() - candidateStartTime;
        
        if (candidateLeaseId) {
          const { releaseLease } = await import('./queueManager');
          await releaseLease(candidate.candidate_tweet_id, candidateLeaseId);
        }
        
        await logOutcome(supabase, schedulerRunId, {
          outcome_type: 'DENY',
          candidate_tweet_id: candidate.candidate_tweet_id,
          candidate_id: candidate.evaluation_id,
          author_handle: candidateData.candidate_author_username,
          url: `https://x.com/i/status/${candidate.candidate_tweet_id}`,
          deny_reason_code: 'TWEET_TOO_OLD',
          deny_reason_detail: { age_hours: ageHours.toFixed(1), max_hours: MAX_TWEET_AGE_HOURS },
          decision_id: decisionId,
          stage_timings: stageTimings,
        });
        
        throw new Error(`Tweet too old: ${ageHours.toFixed(1)}h > ${MAX_TWEET_AGE_HOURS}h`);
      } else {
        console.log(`[SCHEDULER] ✅ Freshness check passed: ${ageHours.toFixed(1)}h (max=${MAX_TWEET_AGE_HOURS}h)`);
      }
    } else if (isTestMode && freshnessOpportunity?.tweet_posted_at) {
      const postedAt = new Date(freshnessOpportunity.tweet_posted_at);
      const ageHours = (Date.now() - postedAt.getTime()) / (60 * 60 * 1000);
      console.log(`[SCHEDULER] 🧪 TEST MODE: BYPASS_ACTIVE: FRESHNESS_CHECK (age=${ageHours.toFixed(1)}h)`);
    }
    
    // 🔒 PHASE 1.1: TARGET QUALITY FILTER - Pre-generation filter (MUST be enforced)
    const qualityFilterStartTime = Date.now();
    console.log(`[SCHEDULER] 💓 Heartbeat: Starting quality filter (timeout: 2s)...`);
    const { filterTargetQuality } = await import('../../gates/replyTargetQualityFilter');
    
    // Wrap quality filter in timeout (2s max)
    const QUALITY_FILTER_TIMEOUT_MS = 2000;
    const qualityFilter = await Promise.race([
      Promise.resolve(filterTargetQuality(
        normalizedSnapshot,
        candidateData.candidate_author_username,
        (candidateData as any).candidate_author_bio || undefined,
        normalizedSnapshot // Use snapshot as extracted context
      )),
      new Promise<any>((_, reject) => {
        setTimeout(() => reject(new Error('QUALITY_FILTER_TIMEOUT')), QUALITY_FILTER_TIMEOUT_MS);
      }),
    ]) as any;
    
    const qualityFilterElapsed = Date.now() - qualityFilterStartTime;
    stageTimings.quality_ms = qualityFilterElapsed;
    console.log(`[SCHEDULER] 💓 Heartbeat: Quality filter completed in ${qualityFilterElapsed}ms`);
    console.log(`[SCHEDULER] ✅ Quality filter completed in ${qualityFilterElapsed}ms: pass=${qualityFilter.pass}, reason=${qualityFilter.reason}`);
    
    // Instrument OFF_LIMITS_TOPIC decisions with debug data
    if (qualityFilter.deny_reason_code === 'OFF_LIMITS_TOPIC') {
      const healthScore = (qualityFilter.detail as any)?.health_score || 0;
      const debugData = {
        ...qualityFilter.detail,
        target_tweet_id: candidate.candidate_tweet_id,
        target_username: candidateData.candidate_author_username,
        url: `https://x.com/i/status/${candidate.candidate_tweet_id}`,
        health_score: healthScore,
      };
      
      await supabase.from('system_events').insert({
        event_type: 'NON_HEALTH_TOPIC_DEBUG',
        severity: 'info',
        message: `NON_HEALTH_TOPIC decision: target=${candidate.candidate_tweet_id} health_score=${healthScore}`,
        event_data: debugData,
        created_at: new Date().toISOString(),
      });
    }
    
    if (!qualityFilter.pass) {
      const denyReasonCode = qualityFilter.deny_reason_code || qualityFilter.code || 'TARGET_QUALITY_BLOCK';
      console.error(`[SCHEDULER] 🚫 Target quality filter blocked: ${denyReasonCode} - ${qualityFilter.reason}`);
      console.error(`[SCHEDULER]   Detail: ${JSON.stringify(qualityFilter.detail || qualityFilter.details, null, 2)}`);
      
      // Instrument OFF_LIMITS_TOPIC decisions with debug data
      if (denyReasonCode === 'OFF_LIMITS_TOPIC') {
        const healthScore = (qualityFilter.detail as any)?.health_score || 0;
        const debugData = {
          ...qualityFilter.detail,
          target_tweet_id: candidate.candidate_tweet_id,
          target_username: candidateData.candidate_author_username,
          url: `https://x.com/i/status/${candidate.candidate_tweet_id}`,
          health_score: healthScore,
        };
        
        await supabase.from('system_events').insert({
          event_type: 'OFF_LIMITS_TOPIC_DEBUG',
          severity: 'info',
          message: `OFF_LIMITS_TOPIC decision: target=${candidate.candidate_tweet_id}`,
          event_data: debugData,
          created_at: new Date().toISOString(),
        });
      }
      
      // Record DENY decision with structured detail JSON (including debug data for OFF_LIMITS_TOPIC)
      const denyReasonDetail = denyReasonCode === 'OFF_LIMITS_TOPIC' ? {
        ...qualityFilter.detail,
        target_tweet_id: candidate.candidate_tweet_id,
        target_username: candidateData.candidate_author_username,
        url: `https://x.com/i/status/${candidate.candidate_tweet_id}`,
      } : {
        code: qualityFilter.code,
        detail: qualityFilter.detail || qualityFilter.details,
        score: qualityFilter.score
      };
      
      await recordReplyDecision({
        decision_id: decisionId,
        target_tweet_id: candidate.candidate_tweet_id,
        target_in_reply_to_tweet_id: ancestry.targetInReplyToTweetId,
        root_tweet_id: ancestry.rootTweetId || 'null',
        ancestry_depth: ancestry.ancestryDepth ?? -1,
        is_root: ancestry.isRoot,
        decision: 'DENY',
        reason: `Quality filter: ${qualityFilter.reason}`,
        deny_reason_code: denyReasonCode,
        deny_reason_detail: typeof denyReasonDetail === 'string' ? denyReasonDetail : JSON.stringify(denyReasonDetail),
        status: ancestry.status,
        confidence: ancestry.confidence,
        method: ancestry.method || 'unknown',
        cache_hit: ancestry.method?.startsWith('cache:') || false,
        trace_id: schedulerRunId,
        job_run_id: schedulerRunId,
        pipeline_source: 'reply_v2_scheduler',
      } as any);
      
      // Mark as blocked
      await supabase
        .from('content_metadata')
        .update({ 
          status: 'blocked',
          skip_reason: denyReasonCode
        })
        .eq('decision_id', decisionId);
      
      // Log POST_FAILED with structured metadata
      const appVersion = process.env.APP_VERSION || process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_SHA || 'unknown';
      await supabase.from('system_events').insert({
        event_type: 'POST_FAILED',
        severity: 'error',
        message: `Target quality filter blocked: ${denyReasonCode}`,
        event_data: {
          decision_id: decisionId,
          target_tweet_id: candidate.candidate_tweet_id,
          target_in_reply_to_tweet_id: ancestry.targetInReplyToTweetId || null,
          app_version: appVersion,
          gate_result: 'BLOCK',
          deny_reason_code: denyReasonCode,
          pipeline_error_reason: denyReasonCode,
          reason: qualityFilter.reason,
          detail: qualityFilter.detail || qualityFilter.details,
        },
        created_at: new Date().toISOString(),
      });
      
      // Log DENY outcome
      stageTimings.total_ms = Date.now() - candidateStartTime;
      await logOutcome(supabase, schedulerRunId, {
        outcome_type: 'DENY',
        candidate_tweet_id: candidate.candidate_tweet_id,
        candidate_id: candidate.evaluation_id,
        author_handle: candidateData.candidate_author_username,
        url: `https://x.com/i/status/${candidate.candidate_tweet_id}`,
        deny_reason_code: denyReasonCode,
        deny_reason_detail: denyReasonDetail,
        decision_id: decisionId,
        stage_timings: stageTimings,
      });
      
      throw new Error(`Quality filter blocked: ${denyReasonCode}`);
    }
    
    console.log(`[SCHEDULER] ✅ Quality filter passed: ${qualityFilter.reason} (score: ${qualityFilter.score || 'N/A'})`);
    
    // 🎨 QUALITY TRACKING: Get candidate score for logging (from candidateData)
    const candidateScore = candidateData.overall_score || candidate.overall_score || 0;
    const candidateFeatures = {
      topic_relevance: candidateData.topic_relevance_score || 0,
      velocity: candidateData.velocity_score || 0,
      recency: candidateData.recency_score || 0,
      author_signal: candidateData.author_signal_score || 0,
      predicted_tier: candidateData.predicted_tier || candidate.predicted_tier || 4,
      predicted_24h_views: candidateData.predicted_24h_views || 0,
    };
    
    // Record decision BEFORE inserting into content_metadata
    // 🎯 PIPELINE STAGES: Set scored_at timestamp
    const scoredAt = new Date().toISOString();
    await recordReplyDecision({
      decision_id: decisionId,
      target_tweet_id: candidate.candidate_tweet_id,
      target_in_reply_to_tweet_id: ancestry.targetInReplyToTweetId,
      root_tweet_id: ancestry.rootTweetId || 'null',
      ancestry_depth: ancestry.ancestryDepth ?? -1,
      is_root: ancestry.isRoot,
      decision: allowCheck.allow ? 'ALLOW' : 'DENY',
      reason: allowCheck.reason,
      deny_reason_code: allowCheck.deny_reason_code, // 🎯 ANALYTICS: Structured deny reason code
      deny_reason_detail: allowCheck.deny_reason_detail, // 🎯 PART B: Stage-specific error detail
      status: ancestry.status, // 🔒 REQUIRED
      confidence: ancestry.confidence, // 🔒 REQUIRED
      method: ancestry.method || 'unknown', // 🔒 REQUIRED
      cache_hit: ancestry.method?.startsWith('cache:') || false,
      candidate_features: candidateFeatures,
      candidate_score: candidateScore,
      template_id: null, // Will be updated after template selection
      prompt_version: null, // Will be updated after template selection
      template_status: 'PENDING', // Will be updated to 'SET' after template selection
      scored_at: scoredAt, // 🎯 PIPELINE STAGES
      trace_id: schedulerRunId,
      job_run_id: schedulerRunId,
      pipeline_source: 'reply_v2_scheduler',
    } as any);
    
    console.log(`[PIPELINE] decision_id=${decisionId} stage=scored ok=true detail=decision=${allowCheck.allow ? 'ALLOW' : 'DENY'} target=${candidate.candidate_tweet_id}`);
    
    // 🔒 HARD INVARIANT: Deny non-root replies
    if (!allowCheck.allow) {
      const denyReason = `DENY_NON_ROOT: ${allowCheck.reason}`;
      const denyReasonCode = allowCheck.deny_reason_code || 'NON_ROOT_REPLY';
      
      await supabase
        .from('reply_decisions')
        .update({
          pipeline_error_reason: denyReason,
          deny_reason_code: denyReasonCode,
        })
        .eq('decision_id', decisionId);
      console.error(`[PIPELINE] decision_id=${decisionId} stage=scored ok=false detail=${denyReason}`);
      
      // Log DENY outcome and release lease
      clearTimeout(watchdogTimer);
      stageTimings.total_ms = Date.now() - candidateStartTime;
      
      if (candidateLeaseId) {
        const { releaseLease } = await import('./queueManager');
        await releaseLease(candidate.candidate_tweet_id, candidateLeaseId);
      }
      
      await logOutcome(supabase, schedulerRunId, {
        outcome_type: 'DENY',
        candidate_tweet_id: candidate.candidate_tweet_id,
        candidate_id: candidate.evaluation_id,
        author_handle: candidateData.candidate_author_username,
        url: `https://x.com/i/status/${candidate.candidate_tweet_id}`,
        deny_reason_code: denyReasonCode,
        deny_reason_detail: allowCheck.deny_reason_detail,
        decision_id: decisionId,
        stage_timings: stageTimings,
      });
      
      throw new Error(`Non-root reply blocked: ${allowCheck.reason}`);
    }
    
    // Insert decision with snapshot/hash populated (status: generating)
    // Check if decision already exists (from previous failed attempt)
    const { data: existingDecision } = await supabase
      .from('content_generation_metadata_comprehensive')
      .select('decision_id, status')
      .eq('decision_id', decisionId)
      .maybeSingle();
    
    if (!existingDecision) {
      const { error: insertError1 } = await supabase
        .from('content_generation_metadata_comprehensive')
        .insert({
          decision_id: decisionId,
          decision_type: 'reply',
          status: 'generating', // Status: generating → queued → posted
          content: '[GENERATING...]', // Placeholder
          target_tweet_id: candidate.candidate_tweet_id,
          target_username: candidateData.candidate_author_username, // Required for FINAL_REPLY_GATE
          root_tweet_id: ancestry.rootTweetId, // 🔒 CRITICAL: Use resolved root tweet ID
          target_tweet_content_snapshot: normalizedSnapshot, // 🔒 TASK 1: Populated from live fetch
          target_tweet_content_hash: targetTweetContentHash, // 🔒 TASK 1: Populated from live fetch
          pipeline_source: 'reply_v2_scheduler',
          build_sha: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_SHA || 'unknown',
          candidate_evaluation_id: candidate.evaluation_id,
          queue_id: queueId,
          scheduler_run_id: schedulerRunId,
        });
      
      if (insertError1) {
        throw new Error(`Failed to insert decision: ${insertError1.message}`);
      }
    } else {
      // Update existing decision with new snapshot/hash
      await supabase
        .from('content_generation_metadata_comprehensive')
        .update({
          target_tweet_content_snapshot: normalizedSnapshot,
          target_tweet_content_hash: targetTweetContentHash,
          status: 'generating',
        })
        .eq('decision_id', decisionId);
    }
    
    // Also insert/update content_metadata with snapshot/hash
    const scheduledAt = new Date().toISOString(); // 🔒 TASK 2: Set scheduled_at immediately
    const { data: existingMetadataRow } = await supabase
      .from('content_metadata')
      .select('decision_id')
      .eq('decision_id', decisionId)
      .maybeSingle();
    
    if (!existingMetadataRow) {
      const { error: insertError2 } = await supabase
        .from('content_metadata')
        .insert({
          decision_id: decisionId,
          decision_type: 'reply',
          status: 'generating',
          content: '[GENERATING...]',
          target_tweet_id: candidate.candidate_tweet_id,
          target_username: candidateData.candidate_author_username, // Required for FINAL_REPLY_GATE
          root_tweet_id: ancestry.rootTweetId, // 🔒 CRITICAL: Use resolved root tweet ID
          target_tweet_content_snapshot: normalizedSnapshot, // 🔒 TASK 1: Populated from live fetch
          target_tweet_content_hash: targetTweetContentHash, // 🔒 TASK 1: Populated from live fetch
          scheduled_at: scheduledAt, // 🔒 TASK 2: Set immediately so posting queue can pick it up
          pipeline_source: 'reply_v2_scheduler',
          build_sha: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_SHA || 'unknown',
          quality_score: candidate.overall_score / 100,
        });
      
      if (insertError2) {
        throw new Error(`Failed to insert metadata: ${insertError2.message}`);
      }
    } else {
      // Update existing metadata with new snapshot/hash
      await supabase
        .from('content_metadata')
        .update({
          target_tweet_content_snapshot: normalizedSnapshot,
          target_tweet_content_hash: targetTweetContentHash,
          scheduled_at: scheduledAt,
          status: 'generating',
        })
        .eq('decision_id', decisionId);
    }
    
    // Store prefix hash in a separate metadata field or event for now (until migration adds column)
    // For now, we'll pass it via the decision object to contextLockVerifier
    
    // 🎫 CREATE POSTING PERMIT IMMEDIATELY (before generation)
    const { createPostingPermit } = await import('../../posting/postingPermit');
    console.log(`[SCHEDULER] 🎫 Creating posting permit BEFORE generation...`);
    const permitResult = await createPostingPermit({
      decision_id: decisionId,
      decision_type: 'reply',
      pipeline_source: 'reply_v2_scheduler',
      content_preview: '[GENERATING...]',
      target_tweet_id: candidate.candidate_tweet_id,
      run_id: schedulerRunId,
    });
    
    if (!permitResult.success) {
      const errorMsg = `[SCHEDULER] ❌ BLOCKED: Failed to create posting permit: ${permitResult.error}`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    
    permit_id = permitResult.permit_id;
    console.log(`[SCHEDULER] ✅ Permit created: ${permit_id}`);
    
    // 🔒 MANDATE 1: Emit system_event 'reply_v2_attempt_created'
    await supabase.from('system_events').insert({
      event_type: 'reply_v2_attempt_created',
      severity: 'info',
      message: `Reply V2 attempt created: decision_id=${decisionId} permit_id=${permit_id}`,
      event_data: {
        decision_id: decisionId,
        permit_id: permit_id,
        candidate_id: candidate.candidate_tweet_id,
        candidate_evaluation_id: candidate.evaluation_id,
        scheduler_run_id: schedulerRunId,
        queue_id: queueId,
        pipeline_source: 'reply_v2_scheduler',
      },
      created_at: new Date().toISOString(),
    });
    
    console.log(`[SCHEDULER] ✅ Decision + permit created: decision_id=${decisionId} permit_id=${permit_id}`);
    
    // NOW generate reply content (after decision+permit exist)
    const { routeContentGeneration } = await import('../../ai/orchestratorRouter');
    const { extractKeywords } = await import('../../gates/ReplyQualityGate');
    const { buildReplyContext } = await import('../../utils/replyContextBuilder');
    
    // Build context
    const keywords = extractKeywords(candidateData.candidate_content);
    const replyContext = await buildReplyContext(candidate.candidate_tweet_id, candidateData.candidate_author_username);
    
    // 🔒 CRITICAL: Check for required API keys BEFORE template selection
    // If missing, write decision row with FAILED status and exit gracefully
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      console.error(`[SCHEDULER] ❌ Missing OPENAI_API_KEY - cannot generate reply`);
      const templateSelectedAt = new Date().toISOString();
      await supabase
        .from('reply_decisions')
        .update({
          template_status: 'FAILED',
          template_error_reason: 'GENERATION_FAILED_MISSING_API_KEY',
          pipeline_error_reason: 'GENERATION_FAILED_MISSING_API_KEY',
          template_selected_at: templateSelectedAt, // Mark that we attempted template selection
        })
        .eq('decision_id', decisionId);
      console.log(`[SCHEDULER] 🎯 Decision row updated: decision_id=${decisionId}, pipeline_error_reason=GENERATION_FAILED_MISSING_API_KEY`);
      throw new Error('OPENAI_API_KEY missing - cannot generate reply');
    }
    
    // 🎯 PIPELINE STAGES: Mark generation started
    const generationStartedAt = new Date().toISOString();
    await supabase
      .from('reply_decisions')
      .update({
        generation_started_at: generationStartedAt,
      })
      .eq('decision_id', decisionId);
    console.log(`[PIPELINE] decision_id=${decisionId} stage=generate_start ok=true detail=generation_started_at_set`);
    
    // 🎨 QUALITY TRACKING: Select reply template
    let templateSelection;
    let templateSelectedAt: string | null = null;
    try {
      console.log(`[PIPELINE] decision_id=${decisionId} stage=template_select ok=start detail=selecting_template`);
      const { selectReplyTemplate } = await import('./replyTemplateSelector');
      templateSelection = await selectReplyTemplate({
        topic_relevance_score: (candidateData.topic_relevance_score || 0) / 100, // Normalize to 0-1
        candidate_score: candidateData.overall_score || candidate.overall_score || 0,
        topic: keywords.join(', '),
        content_preview: candidateData.candidate_content.substring(0, 100),
      });
      
      if (!templateSelection || !templateSelection.template_id) {
        throw new Error('Template selection returned null or missing template_id');
      }
      
      // 🎯 PIPELINE STAGES: Mark template selected
      templateSelectedAt = new Date().toISOString();
      // 🔒 FIX: Use id as fallback if decision_id is NULL
      const { data: decisionRow } = await supabase
        .from('reply_decisions')
        .select('id, decision_id')
        .or(`decision_id.eq.${decisionId},id.eq.${decisionId}`)
        .eq('target_tweet_id', candidate.candidate_tweet_id)
        .eq('decision', 'ALLOW')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      const updateId = decisionRow?.id || decisionId;
      const { error: updateError } = await supabase
        .from('reply_decisions')
        .update({
          template_selected_at: templateSelectedAt,
          template_id: templateSelection.template_id,
          prompt_version: templateSelection.prompt_version,
          template_status: 'SET',
          template_error_reason: null,
          decision_id: decisionId, // Ensure decision_id is set
        })
        .eq('id', updateId);
      
      if (updateError) {
        throw new Error(`Update failed: ${updateError.message}`);
      }
      
      console.log(`[PIPELINE] decision_id=${decisionId} stage=template_select ok=true detail=template_id=${templateSelection.template_id} prompt_version=${templateSelection.prompt_version}`);
      console.log(`[SCHEDULER] 🎨 Selected template: ${templateSelection.template_id} (${templateSelection.template_name}) - ${templateSelection.selection_reason} at ${templateSelectedAt}`);
    } catch (templateError: any) {
      const errorReason = `TEMPLATE_SELECTION_FAILED_${templateError.message.replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 50)}`;
      templateSelectedAt = new Date().toISOString();
      await supabase
        .from('reply_decisions')
        .update({
          template_selected_at: templateSelectedAt,
          template_status: 'FAILED',
          template_error_reason: errorReason,
          pipeline_error_reason: errorReason,
        })
        .eq('decision_id', decisionId);
      console.error(`[PIPELINE] decision_id=${decisionId} stage=template_select ok=false detail=${errorReason}`);
      throw new Error(`Template selection failed: ${templateError.message}`);
    }
    
    // Generate reply content with fallback logic
    let replyContent: string;
    let isFallback = false;
    let generationError: Error | null = null;
    let promptVersion = templateSelection.prompt_version;
    let generationCompletedAt: string | null = null;
    
    // 🔒 CERT_MODE: Check if cert mode is enabled (env var or global flag)
    const certMode = process.env.CERT_MODE === 'true' || (global as any).CERT_MODE === true;
    
    const generationStartTime = Date.now();
    const GENERATION_TIMEOUT_MS = 25000; // 25s hard timeout for OpenAI generation
    console.log(`[SCHEDULER] 💓 Heartbeat: Starting generation (timeout: ${GENERATION_TIMEOUT_MS}ms)...`);
    
    try {
      console.log(`[PIPELINE] decision_id=${decisionId} stage=generate ok=start detail=generating_reply cert_mode=${certMode}`);
      if (certMode) {
        // 🔒 CERT_MODE: Use certified reply generator (guaranteed success)
        console.log(`[SCHEDULER] 🔒 CERT_MODE enabled - using certified reply generator`);
        const { generateCertModeReply } = await import('../../ai/replyGeneratorAdapter');
        // Note: Template selection already done above, will be logged in reply_decisions
        const certResult = await Promise.race([
          generateCertModeReply({
            target_username: candidateData.candidate_author_username,
            target_tweet_content: normalizedSnapshot,
            topic: 'health',
            angle: 'reply_context',
            tone: 'helpful',
            model: 'gpt-4o-mini',
            template_id: templateSelection.template_id, // 🎨 QUALITY TRACKING
            prompt_version: promptVersion, // 🎨 QUALITY TRACKING
          }),
          new Promise<any>((_, reject) => {
            setTimeout(() => reject(new Error('GENERATION_TIMEOUT')), GENERATION_TIMEOUT_MS);
          }),
        ]) as any;
        
        replyContent = certResult.content;
        const generationElapsed = Date.now() - generationStartTime;
        stageTimings.generation_ms = generationElapsed;
        console.log(`[SCHEDULER] 💓 Heartbeat: Generation completed in ${generationElapsed}ms`);
        console.log(`[SCHEDULER] ✅ CERT reply generated: ${replyContent.length} chars`);
      } else {
        // Normal generation path
        // 🎨 QUALITY TRACKING: Use template-aware generation
        const { generateReplyContent } = await import('../../ai/replyGeneratorAdapter');
        const { getTemplatePrompt } = await import('./replyTemplateSelector');
        
        // Get template prompt structure (if available)
        const templatePrompt = await getTemplatePrompt(templateSelection.template_id);
        
        const replyResult = await Promise.race([
          generateReplyContent({
            target_username: candidateData.candidate_author_username,
            target_tweet_content: normalizedSnapshot,
            topic: keywords.join(', ') || 'health',
            angle: 'reply_context',
            tone: 'helpful',
            model: 'gpt-4o-mini',
            template_id: templateSelection.template_id, // 🎨 QUALITY TRACKING
            prompt_version: promptVersion, // 🎨 QUALITY TRACKING
            reply_context: {
              target_text: normalizedSnapshot,
              root_text: replyContext.root_tweet_text || normalizedSnapshot,
              root_tweet_id: candidate.candidate_tweet_id,
            },
          }),
          new Promise<any>((_, reject) => {
            setTimeout(() => reject(new Error('GENERATION_TIMEOUT')), GENERATION_TIMEOUT_MS);
          }),
        ]) as any;
        
        replyContent = replyResult.content;
        const generationElapsed = Date.now() - generationStartTime;
        stageTimings.generation_ms = generationElapsed;
        console.log(`[SCHEDULER] 💓 Heartbeat: Generation completed in ${generationElapsed}ms`);
        console.log(`[PIPELINE] decision_id=${decisionId} stage=generate ok=true detail=reply_generated length=${replyContent.length}`);
        console.log(`[SCHEDULER] ✅ Reply generated: ${replyContent.length} chars`);
      }
      
      // 🔒 TASK 2: GROUNDING GUARANTEE - Verify reply references target tweet
      const { verifyContextGrounding } = await import('../../gates/replyContextGroundingGate');
      const groundingCheck = verifyContextGrounding(
        replyContent,
        normalizedSnapshot,
        undefined, // extractedCaption - not available yet
        undefined, // extractedAltText - not available yet
        candidateData.candidate_author_username // authorUsername for paraphrase detection
      );
      
      if (!groundingCheck.pass) {
        console.error(`[SCHEDULER] 🚫 Context grounding failed: ${groundingCheck.deny_reason_code} - ${groundingCheck.reason}`);
        
        // Mark as blocked
        await supabase
          .from('content_metadata')
          .update({ 
            status: 'blocked',
            skip_reason: groundingCheck.deny_reason_code || 'UNGROUNDED_REPLY'
          })
          .eq('decision_id', decisionId);
        
        // Update reply_decisions
        await supabase
          .from('reply_decisions')
          .update({
            generation_completed_at: new Date().toISOString(),
            pipeline_error_reason: groundingCheck.deny_reason_code || 'UNGROUNDED_REPLY',
          })
          .eq('decision_id', decisionId);
        
        // Log POST_FAILED with structured metadata
        const appVersion = process.env.APP_VERSION || process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_SHA || 'unknown';
        await supabase.from('system_events').insert({
          event_type: 'POST_FAILED',
          severity: 'error',
          message: `Context grounding failed: ${groundingCheck.deny_reason_code || 'UNGROUNDED_REPLY'}`,
          event_data: {
            decision_id: decisionId,
            target_tweet_id: candidate.candidate_tweet_id,
            target_in_reply_to_tweet_id: ancestry.targetInReplyToTweetId || null,
            app_version: appVersion,
            gate_result: 'BLOCK',
            deny_reason_code: groundingCheck.deny_reason_code || 'UNGROUNDED_REPLY',
            pipeline_error_reason: groundingCheck.deny_reason_code || 'UNGROUNDED_REPLY',
            reason: groundingCheck.reason,
            detail: {
              grounding_evidence: groundingCheck.grounding_evidence,
              missing_criteria: 'No quoted snippet, <2 keywords, no author paraphrase'
            }
          },
          created_at: new Date().toISOString(),
        });
        
        throw new Error(`Context grounding failed: ${groundingCheck.deny_reason_code}`);
      }
      
      console.log(`[SCHEDULER] ✅ Context grounding passed: ${groundingCheck.reason}`);
      if (groundingCheck.grounding_evidence?.matched_keyphrases.length) {
        console.log(`[SCHEDULER]   Matched keyphrases: ${groundingCheck.grounding_evidence.matched_keyphrases.slice(0, 3).join(', ')}`);
      }
      
      // Store grounding evidence in content_metadata
      await supabase
        .from('content_metadata')
        .update({
          features: {
            ...((await supabase.from('content_metadata').select('features').eq('decision_id', decisionId).maybeSingle()).data?.features || {}),
            grounding_evidence: groundingCheck.grounding_evidence,
          }
        })
        .eq('decision_id', decisionId);
      
      // Mark generation completed
      generationCompletedAt = new Date().toISOString();
      console.log(`[PIPELINE] decision_id=${decisionId} stage=generate ok=true detail=generation_completed_at_set`);
    } catch (genError: any) {
      generationError = genError;
      const errorReason = `GENERATION_FAILED_${genError.message.replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 50)}`;
      generationCompletedAt = new Date().toISOString();
      
      // Mark generation failed in DB
      await supabase
        .from('reply_decisions')
        .update({
          generation_completed_at: generationCompletedAt,
          pipeline_error_reason: errorReason,
        })
        .eq('decision_id', decisionId);
      console.error(`[PIPELINE] decision_id=${decisionId} stage=generate ok=false detail=${errorReason}`);
      
      // 🔒 TASK 1: Instrument UNGROUNDED_GENERATION_SKIP
      if (genError.message?.includes('UNGROUNDED_GENERATION_SKIP')) {
        const { getSupabaseClient } = await import('../../db/index');
        const supabase = getSupabaseClient();
        
        const ungroundedReasonCodes = (genError as any).ungroundedReasonCodes || ['unknown'];
        const flaggedClaims = (genError as any).flaggedClaims || [];
        const evidenceSnippetsUsed = (genError as any).evidenceSnippetsUsed || [];
        const modelOutputExcerpt = (genError as any).modelOutputExcerpt || '';
        const tweetTerms = (genError as any).tweetTerms || [];
        
        await supabase.from('system_events').insert({
          event_type: 'reply_v2_ungrounded_skip',
          severity: 'warning',
          message: `Reply V2 ungrounded generation skip: decision_id=${decisionId}`,
          event_data: {
            decision_id: decisionId,
            permit_id: permit_id,
            tweet_id: candidate.candidate_tweet_id,
            snapshot_len: normalizedSnapshot.length,
            ungrounded_reason_codes: ungroundedReasonCodes,
            flagged_claims: flaggedClaims,
            evidence_snippets_used: evidenceSnippetsUsed,
            model_output_excerpt: modelOutputExcerpt.substring(0, 300),
            tweet_terms: tweetTerms,
            stack_trace: genError.stack?.substring(0, 1000),
          },
          created_at: new Date().toISOString(),
        });
        
        console.log(`[SCHEDULER] ⚠️ Primary generation failed grounding - attempting fallback...`);
        
        // 🔒 TASK 2: Try fallback generation
        try {
          const { generateGroundedFallbackReply } = await import('../../ai/replyGeneratorAdapter');
          const fallbackResult = await generateGroundedFallbackReply({
            target_username: candidateData.candidate_author_username,
            target_tweet_content: normalizedSnapshot,
            topic: 'health',
            angle: 'reply_context',
            tone: 'helpful',
            model: 'gpt-4o-mini',
            template_id: templateSelection.template_id, // 🎨 QUALITY TRACKING
            prompt_version: promptVersion, // 🎨 QUALITY TRACKING
            reply_context: {
              target_text: normalizedSnapshot,
              root_text: replyContext.root_tweet_text || normalizedSnapshot,
              root_tweet_id: candidate.candidate_tweet_id,
            },
          });
          
          replyContent = fallbackResult.content;
          isFallback = true;
          console.log(`[SCHEDULER] ✅ Fallback reply generated: ${replyContent.length} chars`);
          
          // 🎨 QUALITY TRACKING: Update template status even for fallback (template was selected)
          // 🎯 PIPELINE STAGES: Mark template selected and generation completed
          const fallbackGenerationCompletedAt = new Date().toISOString();
          await supabase
            .from('reply_decisions')
            .update({
              template_id: templateSelection.template_id,
              prompt_version: promptVersion,
              template_status: 'SET',
              template_error_reason: null,
              template_selected_at: templateSelectedAt, // 🎯 PIPELINE STAGES
              generation_completed_at: fallbackGenerationCompletedAt, // 🎯 PIPELINE STAGES
            })
            .eq('decision_id', decisionId);
          console.log(`[SCHEDULER] 🎨 Updated template tracking (fallback): template_id=${templateSelection.template_id}, template_status=SET, template_selected_at=${templateSelectedAt}, generation_completed_at=${fallbackGenerationCompletedAt}`);
          
          // 🔒 TASK 3: Emit fallback generation completed event
          await supabase.from('system_events').insert({
            event_type: 'reply_v2_fallback_generation_completed',
            severity: 'info',
            message: `Reply V2 fallback generation completed: decision_id=${decisionId}`,
            event_data: {
              decision_id: decisionId,
              permit_id: permit_id,
              reply_length: replyContent.length,
              snapshot_length: normalizedSnapshot.length,
              original_error: genError.message,
              reason_codes: ['fallback_used', 'ungrounded_generation_skipped'],
            },
            created_at: new Date().toISOString(),
          });
        } catch (fallbackError: any) {
          // Fallback also failed - mark decision/permit as FAILED
          console.error(`[SCHEDULER] ❌ Fallback generation also failed: ${fallbackError.message}`);
          
          await supabase
            .from('content_generation_metadata_comprehensive')
            .update({
              status: 'failed',
              skip_reason: 'ungrounded_generation_failed',
              error_message: `Primary: ${genError.message}; Fallback: ${fallbackError.message}`,
            })
            .eq('decision_id', decisionId);
          
          await supabase
            .from('content_metadata')
            .update({
              status: 'failed',
              skip_reason: 'ungrounded_generation_failed',
            })
            .eq('decision_id', decisionId);
          
          // Mark permit as FAILED
          const { markPermitFailed } = await import('../../posting/postingPermit');
          await markPermitFailed(permit_id, `Generation failed: ${fallbackError.message}`);
          
          // 🔒 MANDATE 2: Emit generation_failed event
          await supabase.from('system_events').insert({
            event_type: 'reply_v2_generation_failed',
            severity: 'error',
            message: `Reply V2 generation failed (primary + fallback): decision_id=${decisionId}`,
            event_data: {
              decision_id: decisionId,
              permit_id: permit_id,
              primary_error: genError.message,
              fallback_error: fallbackError.message,
              stack_trace: fallbackError.stack?.substring(0, 1000),
            },
            created_at: new Date().toISOString(),
          });
          
          // Reset candidate to queued for retry
          await supabase
            .from('reply_candidate_queue')
            .update({ status: 'queued', selected_at: null })
            .eq('id', queueId);
          
          throw new Error(`[SCHEDULER] ❌ BLOCKED: Both primary and fallback generation failed grounding`);
        }
      } else {
        // Non-ungrounded error - rethrow
        throw genError;
      }
    }
    
    // 🔒 TASK 2: Compute semantic similarity AFTER generation, BEFORE queuing
    const semanticSimilarity = computeSemanticSimilarity(normalizedSnapshot, replyContent);
    console.log(`[SCHEDULER] 🧠 Semantic similarity computed: ${semanticSimilarity.toFixed(3)}`);
    
    // 🔒 TASK 2: Update decision with generated content + semantic_similarity BEFORE setting status='queued'
    // Store is_fallback flag in features JSONB for FINAL_REPLY_GATE to use relaxed threshold
    
    // Get existing features JSONB or create new object
    const { data: existingMetadataForUpdate } = await supabase
      .from('content_metadata')
      .select('features, pipeline_source, status')
      .eq('decision_id', decisionId)
      .single();
    
    if (!existingMetadataForUpdate) {
      throw new Error(`[SCHEDULER] ❌ Decision ${decisionId} not found in content_metadata`);
    }
    
    const existingFeatures = (existingMetadataForUpdate?.features as any) || {};
    const existingReasonCodes = existingFeatures.reason_codes || [];
    const updatedReasonCodes = isFallback 
      ? [...new Set([...existingReasonCodes, 'fallback_used'])]
      : existingReasonCodes;
    
    const updatedFeatures = { 
      ...existingFeatures, 
      is_fallback: isFallback,
      semantic_similarity: semanticSimilarity, // 🔒 TASK 2: Store in features JSONB (column doesn't exist in content_metadata)
      reason_codes: updatedReasonCodes, // 🔒 TASK 3: Include fallback_used if fallback was used
    };
    
    // Update content_generation_metadata_comprehensive
    const { data: comprehensiveUpdate, error: updateError1 } = await supabase
      .from('content_generation_metadata_comprehensive')
      .update({
        status: 'queued', // 🔒 TASK 3: Set to queued AFTER all fields populated
        content: replyContent,
        semantic_similarity: semanticSimilarity, // 🔒 TASK 2: Populated after generation
      })
      .eq('decision_id', decisionId)
      .select('decision_id, status')
      .single();
    
    if (updateError1) {
      throw new Error(`[SCHEDULER] ❌ Failed to update comprehensive: ${updateError1.message}`);
    }
    
    if (!comprehensiveUpdate) {
      // Check current status to diagnose
      const { data: currentStatus } = await supabase
        .from('content_generation_metadata_comprehensive')
        .select('decision_id, status')
        .eq('decision_id', decisionId)
        .single();
      
      await supabase.from('system_events').insert({
        event_type: 'reply_v2_decision_update_zero_rows',
        severity: 'error',
        message: `Reply V2 decision update zero rows: decision_id=${decisionId}`,
        event_data: {
          decision_id: decisionId,
          current_status: currentStatus?.status || 'unknown',
          expected_status: 'queued',
        },
        created_at: new Date().toISOString(),
      });
      
      throw new Error(`[SCHEDULER] ❌ Update comprehensive returned 0 rows. Current status: ${currentStatus?.status || 'unknown'}`);
    }
    
    // Update content_metadata (primary table)
    const { data: metadataUpdate, error: updateError2 } = await supabase
      .from('content_metadata')
      .update({
        status: 'queued', // 🔒 TASK 3: Set to queued AFTER all fields populated
        content: replyContent,
        features: updatedFeatures, // 🔒 TASK 2+3: Store semantic_similarity + fallback flag in features JSONB
        pipeline_source: existingMetadataForUpdate?.pipeline_source || 'reply_v2_scheduler', // Preserve pipeline_source
      })
      .eq('decision_id', decisionId)
      .select('decision_id, status, features')
      .single();
    
    if (updateError2) {
      throw new Error(`[SCHEDULER] ❌ Failed to update metadata: ${updateError2.message}`);
    }
    
    if (!metadataUpdate) {
      // Check current status to diagnose
      const { data: currentStatus } = await supabase
        .from('content_metadata')
        .select('decision_id, status')
        .eq('decision_id', decisionId)
        .single();
      
      await supabase.from('system_events').insert({
        event_type: 'reply_v2_decision_update_zero_rows',
        severity: 'error',
        message: `Reply V2 decision update zero rows: decision_id=${decisionId}`,
        event_data: {
          decision_id: decisionId,
          current_status: currentStatus?.status || 'unknown',
          expected_status: 'queued',
          table: 'content_metadata',
        },
        created_at: new Date().toISOString(),
      });
      
      throw new Error(`[SCHEDULER] ❌ Update metadata returned 0 rows. Current status: ${currentStatus?.status || 'unknown'}`);
    }
    
    // 🔒 TASK 2: Verify persistence - re-select and assert
    const { data: persistedDecision, error: verifyError } = await supabase
      .from('content_metadata')
      .select('decision_id, status, features')
      .eq('decision_id', decisionId)
      .single();
    
    if (verifyError || !persistedDecision) {
      throw new Error(`[SCHEDULER] ❌ Failed to verify persistence: ${verifyError?.message || 'decision not found'}`);
    }
    
    if (persistedDecision.status !== 'queued') {
      throw new Error(`[SCHEDULER] ❌ Persistence verification failed: status=${persistedDecision.status}, expected=queued`);
    }
    
    const persistedFeatures = (persistedDecision.features as any) || {};
    if (persistedFeatures.semantic_similarity === undefined || persistedFeatures.semantic_similarity === null) {
      throw new Error(`[SCHEDULER] ❌ Persistence verification failed: semantic_similarity missing in features`);
    }
    
    if (persistedFeatures.is_fallback !== isFallback) {
      throw new Error(`[SCHEDULER] ❌ Persistence verification failed: is_fallback=${persistedFeatures.is_fallback}, expected=${isFallback}`);
    }
    
    // 🔒 TASK 2: Log persistence success
    await supabase.from('system_events').insert({
      event_type: 'reply_v2_decision_queued_persisted',
      severity: 'info',
      message: `Reply V2 decision queued persisted: decision_id=${decisionId}`,
      event_data: {
        decision_id: decisionId,
        is_fallback: isFallback,
        semantic_similarity: semanticSimilarity,
        rowsUpdated_comprehensive: comprehensiveUpdate ? 1 : 0,
        rowsUpdated_metadata: metadataUpdate ? 1 : 0,
        persisted_status: persistedDecision.status,
        persisted_features: persistedFeatures,
      },
      created_at: new Date().toISOString(),
    });
    
    console.log(`[SCHEDULER] ✅ Decision persisted: status=queued, is_fallback=${isFallback}, similarity=${semanticSimilarity.toFixed(3)}`);
    
    // 🎨 QUALITY TRACKING: Update reply_decisions with template_id and prompt_version
    // 🔒 DETERMINISTIC UPDATE: Use decision_id as primary key (guaranteed to exist)
    // 🎯 PIPELINE STAGES: Mark template selected and generation completed
    // Set generation_completed_at if not already set (from catch block)
    if (!generationCompletedAt) {
      generationCompletedAt = new Date().toISOString();
    }
    
    try {
      const { data: updateResult, error: updateError } = await supabase
        .from('reply_decisions')
        .update({
          template_id: templateSelection.template_id,
          prompt_version: promptVersion,
          template_status: 'SET',
          template_error_reason: null, // Clear any previous error
          template_selected_at: templateSelectedAt, // 🎯 PIPELINE STAGES
          generation_completed_at: generationCompletedAt, // 🎯 PIPELINE STAGES
          pipeline_error_reason: null, // Clear any previous error
        })
        .eq('decision_id', decisionId)
        .select('id');
      
      if (updateError) {
        console.error(`[SCHEDULER] ❌ Failed to update template tracking: ${updateError.message}`);
        // Mark as failed with error reason
        await supabase
          .from('reply_decisions')
          .update({ 
            template_status: 'FAILED',
            template_error_reason: `UPDATE_FAILED: ${updateError.message}`,
          })
          .eq('decision_id', decisionId);
        throw new Error(`Template tracking update failed: ${updateError.message}`);
      } else if (!updateResult || updateResult.length === 0) {
        // No rows updated - decision_id might not match
        console.error(`[SCHEDULER] ❌ No rows updated for decision_id=${decisionId} - row may not exist or decision_id mismatch`);
        // Try to find the row by target_tweet_id as fallback
        const { data: fallbackResult } = await supabase
          .from('reply_decisions')
          .select('id, decision_id, target_tweet_id')
          .eq('target_tweet_id', candidate.candidate_tweet_id)
          .eq('decision', 'ALLOW')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        if (fallbackResult) {
          console.log(`[SCHEDULER] 🔍 Found row by target_tweet_id: id=${fallbackResult.id}, decision_id=${fallbackResult.decision_id}`);
          // Update using the found id
          await supabase
            .from('reply_decisions')
            .update({
              template_id: templateSelection.template_id,
              prompt_version: promptVersion,
              template_status: 'SET',
              template_error_reason: null,
              template_selected_at: templateSelectedAt, // 🎯 PIPELINE STAGES
              generation_completed_at: generationCompletedAt, // 🎯 PIPELINE STAGES
            })
            .eq('id', fallbackResult.id);
          console.log(`[SCHEDULER] 🎨 Updated reply_decisions (fallback) with template_id=${templateSelection.template_id}, template_status=SET`);
        } else {
          // Mark as failed - row not found
          await supabase
            .from('reply_decisions')
            .update({ 
              template_status: 'FAILED',
              template_error_reason: 'ROW_NOT_FOUND: decision_id mismatch or row deleted',
              pipeline_error_reason: 'ROW_NOT_FOUND', // 🎯 PIPELINE STAGES
            })
            .eq('decision_id', decisionId);
          console.error(`[SCHEDULER] ❌ Could not find reply_decisions row for decision_id=${decisionId}`);
        }
      } else {
        console.log(`[SCHEDULER] 🎨 ✅ Updated reply_decisions: decision_id=${decisionId}, template_id=${templateSelection.template_id}, prompt_version=${promptVersion}, template_status=SET, template_selected_at=${templateSelectedAt}, generation_completed_at=${generationCompletedAt}`);
      }
    } catch (error: any) {
      console.error(`[SCHEDULER] ❌ Error updating template tracking: ${error.message}`);
      // Mark as failed with error reason
      try {
        await supabase
          .from('reply_decisions')
          .update({ 
            template_status: 'FAILED',
            template_error_reason: `EXCEPTION: ${error.message}`,
            pipeline_error_reason: 'UPDATE_EXCEPTION', // 🎯 PIPELINE STAGES
          })
          .eq('decision_id', decisionId);
      } catch (markFailedError: any) {
        console.error(`[SCHEDULER] ❌ Failed to mark as FAILED: ${markFailedError.message}`);
      }
    }
    
    // 🔒 TASK 4: Emit generation_completed event (AFTER updates succeed)
    await supabase.from('system_events').insert({
      event_type: isFallback ? 'reply_v2_fallback_generation_completed' : 'reply_v2_generation_completed',
      severity: 'info',
      message: `Reply V2 ${isFallback ? 'fallback ' : ''}generation completed: decision_id=${decisionId}`,
      event_data: {
        decision_id: decisionId,
        permit_id: permit_id,
        reply_length: replyContent.length,
        reply_preview: replyContent.substring(0, 100),
        is_fallback: isFallback,
      },
      created_at: new Date().toISOString(),
    });
    
    // 🔒 TASK 4: Emit similarity_computed event
    await supabase.from('system_events').insert({
      event_type: 'reply_v2_similarity_computed',
      severity: 'info',
      message: `Reply V2 similarity computed: decision_id=${decisionId} similarity=${semanticSimilarity.toFixed(3)}`,
      event_data: {
        decision_id: decisionId,
        permit_id: permit_id,
        semantic_similarity: semanticSimilarity,
        snapshot_length: normalizedSnapshot.length,
        reply_length: replyContent.length,
      },
      created_at: new Date().toISOString(),
    });
    
    // 🔒 TASK 4: Emit decision_queued event
    await supabase.from('system_events').insert({
      event_type: 'reply_v2_decision_queued',
      severity: 'info',
      message: `Reply V2 decision queued: decision_id=${decisionId}`,
      event_data: {
        decision_id: decisionId,
        permit_id: permit_id,
        candidate_id: candidate.candidate_tweet_id,
        semantic_similarity: semanticSimilarity,
        reply_length: replyContent.length,
        snapshot_length: normalizedSnapshot.length,
      },
      created_at: new Date().toISOString(),
    });
    
    // Create reply opportunity (for compatibility)
    const { data: opportunity, error: oppError } = await supabase
      .from('reply_opportunities')
      .insert({
        target_tweet_id: candidate.candidate_tweet_id,
        target_username: candidateData.candidate_author_username,
        target_tweet_content: candidateData.candidate_content,
        is_root_tweet: true,
        source: 'tiered_scheduler',
        priority_score: candidate.overall_score,
        root_tweet_id: candidate.candidate_tweet_id,
      })
      .select()
      .single();
    
    if (oppError && !oppError.message.includes('duplicate')) {
      console.warn(`[SCHEDULER] Failed to create opportunity: ${oppError.message}`);
    }
    
    const replyDecisionId = decisionId;
    
    // Log SLO event (will be updated after posting completes)
    await supabase
      .from('reply_slo_events')
      .insert({
        scheduler_run_id: schedulerRunId,
        slot_time: slotTime.toISOString(),
        posted: true,
        reason: 'queued_for_posting',
        candidate_tweet_id: candidate.candidate_tweet_id,
        candidate_evaluation_id: candidate.evaluation_id,
        queue_id: queueId,
        predicted_tier: tier,
        decision_id: decisionId,
        queue_size: queueSize,
        tier_1_count: tier1Count,
        tier_2_count: tier2Count,
        tier_3_count: tier3Count,
        slo_hit: true,
        slo_target: TARGET_REPLIES_PER_HOUR,
      });
    
    // Update queue status (release lease and mark as posted)
    clearTimeout(watchdogTimer);
    if (candidateLeaseId) {
      const { markCandidateProcessed } = await import('./queueManager');
      await markCandidateProcessed(candidate.candidate_tweet_id, candidateLeaseId, 'posted');
    } else {
      // Fallback: update directly
      await supabase
        .from('reply_candidate_queue')
        .update({
          status: 'posted',
          posted_at: new Date().toISOString(),
          lease_id: null,
          leased_at: null,
          leased_until: null,
        })
        .eq('candidate_tweet_id', candidate.candidate_tweet_id);
    }
    
    // Update evaluation status
    await supabase
      .from('candidate_evaluations')
      .update({
        status: 'posted',
        posted_at: new Date().toISOString(),
      })
      .eq('id', candidate.evaluation_id);
    
    console.log(`[SCHEDULER] ✅ Queued reply: ${replyDecisionId} to ${candidate.candidate_tweet_id}`);
    console.log(`[SCHEDULER] 🆔 Traceability: feed_run_id -> eval_id -> queue_id -> scheduler_run_id -> decision_id`);
    
    // Log DECISION_CREATED outcome
    stageTimings.total_ms = Date.now() - candidateStartTime;
      await logOutcome(supabase, schedulerRunId, {
        outcome_type: 'DECISION_CREATED',
        candidate_tweet_id: candidate.candidate_tweet_id,
        candidate_id: candidate.evaluation_id,
        author_handle: candidateData.candidate_author_username,
        url: `https://x.com/i/status/${candidate.candidate_tweet_id}`,
        decision_id: replyDecisionId,
        stage_timings: stageTimings,
      });
    
    // Log job success to system_events
    try {
      await supabase.from('system_events').insert({
        event_type: 'reply_v2_scheduler_job_success',
        severity: 'info',
        message: `Reply V2 scheduler job success: posted=true decision_id=${replyDecisionId}`,
        event_data: { scheduler_run_id: schedulerRunId, decision_id: replyDecisionId, tier, posted: true },
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn(`[SCHEDULER] Failed to log job success: ${(e as Error).message}`);
    }
    
    // Get ready candidates count
    const { count: queueCount } = await supabase
      .from('reply_candidate_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'queued')
      .gt('expires_at', new Date().toISOString());
    readyCandidates = queueCount || 0;
    selectedCandidates = 1;
    attemptsStarted = 1;
    
    // Emit REPLY_QUEUE_TICK
    await emitReplyQueueTick();
    
    // Update job heartbeat
    try {
      const { recordJobSuccess } = await import('../jobHeartbeat');
      await recordJobSuccess('reply_queue');
    } catch (e) {
      // Ignore heartbeat errors
    }
    
    // Queue will be processed by postingQueue job
    return {
      posted: true,
      candidate_tweet_id: candidate.candidate_tweet_id,
      tier: tier,
      reason: 'queued_for_posting',
      behind_schedule: behindSchedule,
    };
  } catch (error: any) {
    console.error(`[SCHEDULER] ❌ Failed to post reply: ${error.message}`);
    
    // Determine error stage and type
    let errorStage = 'unknown';
    let outcomeType: 'ERROR' | 'TIMEOUT' = 'ERROR';
    
    if (error.message.includes('TIMEOUT') || error.message.includes('timeout')) {
      outcomeType = 'TIMEOUT';
      if (error.message.includes('ANCESTRY')) {
        errorStage = 'ancestry';
      } else if (error.message.includes('FETCH')) {
        errorStage = 'fetch';
      } else if (error.message.includes('candidate')) {
        errorStage = 'processing';
      } else {
        errorStage = 'unknown';
      }
    } else if (error.message.includes('Quality filter')) {
      errorStage = 'quality_filter';
      // Already logged as DENY above, skip
    } else if (error.message.includes('Non-root')) {
      errorStage = 'allow_check';
      // Already logged as DENY above, skip
    } else {
      errorStage = 'processing';
    }
    
    // Log ERROR outcome (unless already logged as DENY)
    if (!error.message.includes('Quality filter') && !error.message.includes('Non-root')) {
      // Ensure stageTimings exists (might not be initialized if error happened very early)
      if (!stageTimings || !stageTimings.total_ms) {
        stageTimings = { total_ms: Date.now() - candidateStartTime };
      } else {
        stageTimings.total_ms = Date.now() - candidateStartTime;
      }
      
      // Get candidateData if available (may not be initialized if error happened early)
      const candidateAuthor = candidateData?.candidate_author_username || 'unknown';
      
      await logOutcome(supabase, schedulerRunId, {
        outcome_type: outcomeType,
        candidate_tweet_id: candidate.candidate_tweet_id,
        candidate_id: candidate.evaluation_id,
        author_handle: candidateAuthor,
        url: `https://x.com/i/status/${candidate.candidate_tweet_id}`,
        error_stage: errorStage,
        error_message: error.message,
        decision_id: decisionId,
        stage_timings: stageTimings,
      });
    }
    
    // 🎯 PIPELINE STAGES: Mark all unset stages as FAILED
    if (decisionId) {
      try {
        const { data: current } = await supabase
          .from('reply_decisions')
          .select('decision, template_status, template_selected_at, generation_completed_at, posting_completed_at')
          .eq('decision_id', decisionId)
          .single();
        
        // Only mark pipeline stages for ALLOW decisions (DENY decisions never entered pipeline)
        if (current?.decision === 'ALLOW') {
          const errorReason = `SCHEDULER_ERROR_${error.message.replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 50)}`;
          const updates: any = {
            pipeline_error_reason: errorReason,
          };
          
          // Mark template as FAILED if still PENDING
          if (current?.template_status === 'PENDING' && !current?.template_selected_at) {
            updates.template_status = 'FAILED';
            updates.template_error_reason = `TEMPLATE_SELECTION_FAILED_${errorReason}`;
            updates.template_selected_at = new Date().toISOString(); // Mark that we attempted
            console.log(`[PIPELINE] decision_id=${decisionId} stage=template_select ok=false detail=${updates.template_error_reason}`);
          }
          
          // Mark generation as failed if not completed
          if (!current?.generation_completed_at) {
            updates.generation_completed_at = new Date().toISOString();
            console.log(`[PIPELINE] decision_id=${decisionId} stage=generate ok=false detail=GENERATION_FAILED_${errorReason}`);
          }
          
          // Mark posting as failed if not completed
          if (!current?.posting_completed_at) {
            updates.posting_completed_at = new Date().toISOString();
            console.log(`[PIPELINE] decision_id=${decisionId} stage=post ok=false detail=POSTING_FAILED_${errorReason}`);
          }
          
          await supabase
            .from('reply_decisions')
            .update(updates)
            .eq('decision_id', decisionId);
          
          console.log(`[SCHEDULER] 🎯 Marked pipeline stages as FAILED due to scheduler error`);
        }
      } catch (statusError: any) {
        console.warn(`[SCHEDULER] ⚠️ Failed to update pipeline stages: ${statusError.message}`);
      }
    }
    console.error(`[SCHEDULER] Stack: ${error.stack}`);
    
    // 🔒 MANDATE 2: Emit 'reply_v2_generation_failed' event
    try {
      await supabase.from('system_events').insert({
        event_type: 'reply_v2_generation_failed',
        severity: 'error',
        message: `Reply V2 generation failed: ${error.message}`,
        event_data: {
          decision_id: decisionId || 'unknown',
          permit_id: permit_id || 'unknown',
          candidate_id: candidate.candidate_tweet_id,
          scheduler_run_id: schedulerRunId,
          error: error.message,
          stack: error.stack?.substring(0, 1000),
        },
        created_at: new Date().toISOString(),
      });
    } catch (logError) {
      console.error(`[SCHEDULER] Failed to log generation failure: ${(logError as Error).message}`);
    }
    
    // Mark decision/permit as FAILED
    if (decisionId) {
      try {
        await supabase
          .from('content_generation_metadata_comprehensive')
          .update({
            status: 'failed',
            skip_reason: `generation_failed: ${error.message.substring(0, 200)}`,
          })
          .eq('decision_id', decisionId);
      } catch (updateError) {
        console.error(`[SCHEDULER] Failed to update decision status: ${(updateError as Error).message}`);
      }
    }
    
    if (permit_id) {
      try {
        const { markPermitFailed } = await import('../../posting/postingPermit');
        await markPermitFailed(permit_id, `Generation failed: ${error.message}`);
      } catch (permitError) {
        console.error(`[SCHEDULER] Failed to mark permit failed: ${(permitError as Error).message}`);
      }
    }
    
    // 🔒 CRITICAL: Release lease on failure so candidate can be retried
    clearTimeout(watchdogTimer);
    try {
      if (candidateLeaseId) {
        const { releaseLease } = await import('./queueManager');
        await releaseLease(candidate.candidate_tweet_id, candidateLeaseId);
      } else {
        // Fallback: update directly
        await supabase
          .from('reply_candidate_queue')
          .update({ 
            status: 'queued',
            selected_at: null,
            lease_id: null,
            leased_at: null,
            leased_until: null,
          })
          .eq('candidate_tweet_id', candidate.candidate_tweet_id);
      }
      console.log(`[SCHEDULER] ✅ Released lease for candidate ${candidate.candidate_tweet_id}`);
    } catch (resetError: any) {
      console.error(`[SCHEDULER] ❌ Failed to release lease: ${resetError.message}`);
    }
    
    // Log SLO event for failure
    await supabase
      .from('reply_slo_events')
      .insert({
        scheduler_run_id: schedulerRunId,
        slot_time: slotTime.toISOString(),
        posted: false,
        reason: `posting_failed: ${error.message.substring(0, 100)}`,
        candidate_tweet_id: candidate.candidate_tweet_id,
        candidate_evaluation_id: candidate.evaluation_id,
        predicted_tier: tier,
        queue_size: queueSize,
        tier_1_count: tier1Count,
        tier_2_count: tier2Count,
        tier_3_count: tier3Count,
        slo_hit: false,
        slo_target: TARGET_REPLIES_PER_HOUR,
      });
    
    // Log job error to system_events with full stack trace
    try {
      await supabase.from('system_events').insert({
        event_type: 'reply_v2_scheduler_job_error',
        severity: 'error',
        message: `Reply V2 scheduler job error: ${error.message}`,
        event_data: { 
          scheduler_run_id: schedulerRunId, 
          error: error.message,
          stack: error.stack?.substring(0, 1000),
          candidate_tweet_id: candidate.candidate_tweet_id,
          tier,
          posted: false 
        },
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn(`[SCHEDULER] Failed to log job error: ${(e as Error).message}`);
    }
    
    // Get ready candidates count
    const { count: queueCount } = await supabase
      .from('reply_candidate_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'queued')
      .gt('expires_at', new Date().toISOString());
    readyCandidates = queueCount || 0;
    selectedCandidates = candidate ? 1 : 0;
    attemptsStarted = candidate ? 1 : 0;
    
    // Emit REPLY_QUEUE_TICK
    await emitReplyQueueTick();
    
    // Update job heartbeat
    try {
      const { recordJobFailure } = await import('../jobHeartbeat');
      await recordJobFailure('reply_queue', error.message);
    } catch (e) {
      // Ignore heartbeat errors
    }
    
    return {
      posted: false,
      candidate_tweet_id: candidate.candidate_tweet_id,
      tier: tier,
      reason: error.message,
      behind_schedule: behindSchedule,
    };
  }
}

/**
 * Check if we're behind schedule (should have posted more replies)
 */
async function checkBehindSchedule(): Promise<boolean> {
  const supabase = getSupabaseClient();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  // Count replies posted in last hour
  const { data: recentReplies } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id')
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .gte('posted_at', oneHourAgo.toISOString());
  
  const repliesLastHour = recentReplies?.length || 0;
  const behindSchedule = repliesLastHour < TARGET_REPLIES_PER_HOUR;
  
  if (behindSchedule) {
    console.log(`[SCHEDULER] ⚠️ Behind schedule: ${repliesLastHour}/${TARGET_REPLIES_PER_HOUR} replies in last hour`);
  }
  
  return behindSchedule;
}

/**
 * Generate reply content for a candidate (simplified - uses existing reply generation)
 */
async function generateReplyContentForCandidate(targetContent: string): Promise<string> {
  // This would use the full LLM pipeline from replyJob
  // For now, return a placeholder that will be replaced by actual generation
  // In production, this would call the reply generation router
  return `Engaging reply to: ${targetContent.substring(0, 50)}...`;
}

