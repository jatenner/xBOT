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

async function main() {
  console.log('========================================');
  console.log('REPLY QUEUE ONCE (single pass)');
  console.log('========================================\n');

  try {
    await replySystemV2Job();
    console.log('\n========================================');
    console.log('RESULTS');
    console.log('========================================');
    console.log('Reply queue job completed');
    console.log('Check system_events for REPLY_QUEUE_TICK events');
    console.log('========================================\n');
  } catch (err: any) {
    console.error('\n========================================');
    console.error('REPLY QUEUE ONCE FAILED');
    console.error('========================================');
    console.error(err?.message || err);
    if (err?.stack) console.error(err.stack);
    process.exit(1);
  }
}

main();
