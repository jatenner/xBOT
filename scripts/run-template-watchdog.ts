#!/usr/bin/env tsx
/**
 * Run template status watchdog
 */

import 'dotenv/config';
import { runTemplateStatusWatchdog } from '../src/jobs/replySystemV2/templateStatusWatchdog';

async function runWatchdog() {
  console.log('🐕 Running template status watchdog...\n');

  try {
    await runTemplateStatusWatchdog();
    console.log('\n✅ Watchdog complete');
  } catch (error: any) {
    console.error('❌ Watchdog failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runWatchdog().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
