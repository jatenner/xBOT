#!/usr/bin/env ts-node
/**
 * Run Reply Job Once
 * Direct execution without admin API dependency
 */

import { generateReplies } from './replyJob';

async function main() {
  console.log('[RUN_REPLY_ONCE] 🚀 Starting one-shot reply job...');
  
  try {
    await generateReplies();
    console.log('[RUN_REPLY_ONCE] ✅ Reply job completed successfully');
    process.exit(0);
  } catch (error: any) {
    console.error('[RUN_REPLY_ONCE] ❌ Reply job failed:', error.message);
    process.exit(1);
  }
}

main();

