#!/usr/bin/env tsx
/**
 * Run posting queue once (process 1 queued item)
 * Usage: pnpm exec tsx scripts/run-posting-once.ts
 */

import 'dotenv/config';
import { processPostingQueue } from '../src/jobs/postingQueue';

async function main() {
  console.log('[POSTING_ONCE] 🚀 Starting posting queue (one-shot)...');
  
  try {
    await processPostingQueue({ maxItems: 1 });
    console.log('[POSTING_ONCE] ✅ Posting queue completed');
  } catch (error: any) {
    console.error('[POSTING_ONCE] ❌ Posting queue failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
