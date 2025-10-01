#!/usr/bin/env ts-node
/**
 * Run Posting Job Once
 * Direct execution without admin API dependency
 */

import { processPostingQueue } from '../posting/orchestrator';

async function main() {
  console.log('[RUN_POSTING_ONCE] 🚀 Starting one-shot posting job...');
  
  try {
    await processPostingQueue();
    console.log('[RUN_POSTING_ONCE] ✅ Posting job completed successfully');
    process.exit(0);
  } catch (error: any) {
    console.error('[RUN_POSTING_ONCE] ❌ Posting job failed:', error.message);
    process.exit(1);
  }
}

main();

