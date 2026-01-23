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

async function main() {
  console.log('========================================');
  console.log('POSTING QUEUE ONCE (single pass)');
  console.log('========================================\n');

  try {
    const result = await processPostingQueue();
    console.log('\n========================================');
    console.log('RESULTS');
    console.log('========================================');
    console.log(`ready_candidates: ${result.ready_candidates}`);
    console.log(`selected_candidates: ${result.selected_candidates}`);
    console.log(`attempts_started: ${result.attempts_started}`);
    console.log(`attempted a post: ${result.attempts_started > 0 ? 'yes' : 'no'}`);
    console.log('========================================\n');
  } catch (err: any) {
    console.error('\n========================================');
    console.error('POSTING QUEUE ONCE FAILED');
    console.error('========================================');
    console.error(err?.message || err);
    if (err?.stack) console.error(err.stack);
    process.exit(1);
  }
}

main();
