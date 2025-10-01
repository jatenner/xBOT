#!/usr/bin/env ts-node
/**
 * Run Plan Job Once
 * Direct execution without admin API dependency
 */

import { planContent } from './planJob';

async function main() {
  console.log('[RUN_PLAN_ONCE] 🚀 Starting one-shot plan job...');
  
  try {
    await planContent();
    console.log('[RUN_PLAN_ONCE] ✅ Plan job completed successfully');
    process.exit(0);
  } catch (error: any) {
    console.error('[RUN_PLAN_ONCE] ❌ Plan job failed:', error.message);
    process.exit(1);
  }
}

main();

