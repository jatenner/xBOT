#!/usr/bin/env tsx
/**
 * 💬 REPLY QUEUE ONCE
 *
 * Runs exactly one reply system v2 job pass (no loops).
 * Use for manual trigger / debugging.
 *
 * Usage:
 *   pnpm run runner:reply-queue-once
 *   RUNNER_MODE=true RUNNER_BROWSER=cdp pnpm run runner:reply-queue-once
 */

import 'dotenv/config';
import { replySystemV2Job } from '../../src/jobs/replySystemV2/main';
import { initializeGuard, checkStopSwitch, applyBackoff, recordFailure, recordSuccess, logGuardState } from '../../src/infra/executorGuard';

async function main() {
  // 🛡️ EXECUTOR GUARD: Initialize (checks stop switch + single-instance lock)
  initializeGuard();
  
  console.log('========================================');
  console.log('REPLY QUEUE ONCE (single pass)');
  console.log('========================================\n');

  try {
    // 🛡️ Check stop switch before each operation
    checkStopSwitch();
    
    // 🛡️ Apply backoff if needed
    await applyBackoff();
    
    await replySystemV2Job();
    
    // 🛡️ Record success (resets failure counter)
    recordSuccess();
    
    // 🛡️ Log guard state
    await logGuardState();
    
    console.log('\n========================================');
    console.log('RESULTS');
    console.log('========================================');
    console.log('Reply queue job completed');
    console.log('Check system_events for REPLY_QUEUE_TICK events');
    console.log('========================================\n');
  } catch (err: any) {
    // 🛡️ Record failure (triggers backoff)
    recordFailure();
    
    // Check if it's a consent/login/retryable error
    const isRetryable = err?.message?.includes('consent') || 
                       err?.message?.includes('login') || 
                       err?.message?.includes('challenge') ||
                       err?.message?.includes('timeout');
    
    if (isRetryable) {
      console.error('\n========================================');
      console.error('REPLY QUEUE ONCE FAILED (RETRYABLE)');
      console.error('========================================');
      console.error(err?.message || err);
      console.error('🛡️  Backoff will be applied on next run');
    } else {
      console.error('\n========================================');
      console.error('REPLY QUEUE ONCE FAILED');
      console.error('========================================');
      console.error(err?.message || err);
      if (err?.stack) console.error(err.stack);
    }
    
    // 🛡️ Log guard state before exit
    await logGuardState();
    
    process.exit(1);
  }
}

main();
