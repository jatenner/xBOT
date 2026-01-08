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
  
  try {
    // Step 1: Fetch and evaluate candidates
    await runFullCycle();
    
    // Step 2: Refresh queue
    await refreshCandidateQueue();
    
    // Step 3: Attempt scheduled reply
    await attemptScheduledReply();
    
    // Step 4: Update performance metrics
    await updatePerformanceMetrics();
    
    console.log('[REPLY_V2] ✅ Job complete');
  } catch (error: any) {
    console.error(`[REPLY_V2] ❌ Job failed: ${error.message}`);
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

