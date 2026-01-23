#!/usr/bin/env tsx
/**
 * 📮 POSTING QUEUE ONCE
 *
 * Runs exactly one posting queue pass (no loops).
 * Use for manual trigger / debugging.
 *
 * Usage:
 *   pnpm run runner:posting-queue-once
 *   RUNNER_MODE=true RUNNER_BROWSER=cdp pnpm run runner:posting-queue-once
 */

import 'dotenv/config';
import { processPostingQueue } from '../../src/jobs/postingQueue';
import { initializeGuard, checkStopSwitch, applyBackoff, recordFailure, recordSuccess, logGuardState } from '../../src/infra/executorGuard';

async function main() {
  // 🛡️ EXECUTOR GUARD: Initialize (checks stop switch + single-instance lock)
  initializeGuard();
  
  console.log('========================================');
  console.log('POSTING QUEUE ONCE (single pass)');
  console.log('========================================\n');

  try {
    // 🛡️ Check stop switch before each operation
    checkStopSwitch();
    
    // 🛡️ Apply backoff if needed
    await applyBackoff();
    
    const result = await processPostingQueue();
    
    // 🛡️ Record success (resets failure counter)
    recordSuccess();
    
    // 🛡️ Log guard state
    await logGuardState();
    
    console.log('\n========================================');
    console.log('RESULTS');
    console.log('========================================');
    console.log(`ready_candidates: ${result.ready_candidates}`);
    console.log(`selected_candidates: ${result.selected_candidates}`);
    console.log(`attempts_started: ${result.attempts_started}`);
    console.log(`attempted a post: ${result.attempts_started > 0 ? 'yes' : 'no'}`);
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
      console.error('POSTING QUEUE ONCE FAILED (RETRYABLE)');
      console.error('========================================');
      console.error(err?.message || err);
      console.error('🛡️  Backoff will be applied on next run');
    } else {
      console.error('\n========================================');
      console.error('POSTING QUEUE ONCE FAILED');
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
