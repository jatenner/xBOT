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
      readyCandidates = queueResult.queued;
      
      const schedulerResult = await attemptScheduledReply();
      if (schedulerResult.posted) {
        selectedCandidates = 1;
        attemptsStarted = 1;
      }
      
      // Skip performance metrics update in PROOF_MODE
      await emitReplyQueueTick();
      return;
    }
    
    // Step 1: Fetch and evaluate candidates
    await runFullCycle();
    
    // Step 2: Refresh queue
    const queueResult = await refreshCandidateQueue();
    readyCandidates = queueResult.queued;
    
    // Step 3: Attempt scheduled reply
    const schedulerResult = await attemptScheduledReply();
    if (schedulerResult.posted) {
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
    
    console.log('[REPLY_V2] ✅ Job complete');
  } catch (error: any) {
    console.error(`[REPLY_V2] ❌ Job failed: ${error.message}`);
    
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

