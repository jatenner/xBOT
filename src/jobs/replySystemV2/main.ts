/**
 * 🎼 REPLY SYSTEM V2 MAIN JOB
 * 
 * Entry point for reply system v2
 */

import { runFullCycle } from './orchestrator';
import { refreshCandidateQueue } from './queueManager';
import { attemptScheduledReply } from './tieredScheduler';
import { updatePerformanceMetrics } from './performanceTracker';
import { runWeeklyRatchet } from './ratchetController';

/**
 * Main job: fetch -> evaluate -> queue -> post
 */
export async function replySystemV2Job(): Promise<void> {
  console.log('[REPLY_V2] 🎼 Starting reply system v2 job...');
  console.log('[REPLY_QUEUE] ✅ job_tick start');
  
  const { getSupabaseClient } = await import('../../db/index');
  const supabase = getSupabaseClient();
  
  let readyCandidates = 0;
  let selectedCandidates = 0;
  let attemptsStarted = 0;
  
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
  
  try {
    // 🔒 PROOF_MODE: Skip feed fetching and discovery work
    if (process.env.PROOF_MODE === 'true') {
      console.log(`[REPLY_V2] 🔒 PROOF_MODE: Skipping feed fetching and discovery`);
      // Still refresh queue and attempt scheduled reply (for proof decisions)
      const queueResult = await refreshCandidateQueue();
      readyCandidates = queueResult?.queued ?? 0;
      const s = queueResult?.summary;
      if (s) {
        console.log(`[REPLY_CYCLE_SUMMARY] fetched=0 evaluated=0 passed_filters=0 root_confirmed=${s.root_confirmed} rejected_non_root=${s.rejected_non_root} rejected_freshness=${s.rejected_freshness} rejected_judge=${s.rejected_judge}${s.rejected_controlled_live != null ? ` rejected_controlled_live=${s.rejected_controlled_live}` : ''} queued=${s.queued} top_scores=[${(s.top_scores || []).join(',')}] sample_rejects=[${(s.sample_rejects || []).slice(0, 4).join('; ')}]`);
      }
      const schedulerResult = await attemptScheduledReply();
      if (schedulerResult?.posted) {
        selectedCandidates = 1;
        attemptsStarted = 1;
      }
      // Skip performance metrics update in PROOF_MODE
      await emitReplyQueueTick();
      return;
    }
    
    // Step 1: Fetch and evaluate candidates
    const cycleResult = await runFullCycle();
    
    // Step 2: Refresh queue
    const queueResult = await refreshCandidateQueue();
    readyCandidates = queueResult?.queued ?? 0;
    
    // Step 3: Attempt scheduled reply
    const schedulerResult = await attemptScheduledReply();
    if (schedulerResult?.posted) {
      selectedCandidates = 1;
      attemptsStarted = 1;
    }
    
    // Step 4: Update performance metrics
    await updatePerformanceMetrics();
    
    // Emit tick event
    await emitReplyQueueTick();
    
    // Update job heartbeat
    try {
      const { recordJobSuccess } = await import('../jobHeartbeat');
      await recordJobSuccess('reply_queue');
    } catch (e) {
      // Ignore heartbeat errors
    }
    
    const postedTotal = schedulerResult?.posted ? 1 : 0;
    const c = (cycleResult ?? {}) as { fetched_total?: number; evaluated_total?: number; passed_total?: number; queued_total?: number };
    console.log(
      `[REPLY_V2] reply_summary fetched_total=${c.fetched_total ?? 0} evaluated_total=${c.evaluated_total ?? 0} passed_total=${c.passed_total ?? 0} allow_total=0 deny_total=0 queued_total=${c.queued_total ?? 0} posted_total=${postedTotal} errors_total=0`
    );
    if (process.env.REPLY_CONTROLLED_LIVE === 'true') {
      console.log('[REPLY_V2] 🎯 REPLY_CONTROLLED_LIVE was enabled (no explore, stricter queue gates, 1 candidate per tick)');
    }
    console.log('[REPLY_V2] ✅ Job complete');
  } catch (error: any) {
    console.error(`[REPLY_V2] ❌ Job failed: ${error.message}`);
    console.log(
      '[REPLY_V2] reply_summary fetched_total=0 evaluated_total=0 passed_total=0 allow_total=0 deny_total=0 queued_total=0 posted_total=0 errors_total=1'
    );
    
    // Emit tick with error
    await emitReplyQueueTick();
    
    // Update job heartbeat
    try {
      const { recordJobFailure } = await import('../jobHeartbeat');
      await recordJobFailure('reply_queue', error.message);
    } catch (e) {
      // Ignore heartbeat errors
    }
    
    throw error;
  }
}

/**
 * Weekly ratchet job
 */
export async function replyRatchetJob(): Promise<void> {
  console.log('[REPLY_RATCHET] 📈 Running weekly ratchet...');
  
  try {
    await runWeeklyRatchet();
    console.log('[REPLY_RATCHET] ✅ Ratchet complete');
  } catch (error: any) {
    console.error(`[REPLY_RATCHET] ❌ Ratchet failed: ${error.message}`);
    throw error;
  }
}

