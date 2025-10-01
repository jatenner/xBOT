#!/usr/bin/env ts-node
/**
 * Run Learning Job Once
 * Direct execution without admin API dependency
 */

import { runLearningCycle } from './learnJob';

async function main() {
  console.log('[RUN_LEARN_ONCE] 🚀 Starting one-shot learning job...');
  
  try {
    await runLearningCycle();
    console.log('[RUN_LEARN_ONCE] ✅ Learning job completed successfully');
    process.exit(0);
  } catch (error: any) {
    console.error('[RUN_LEARN_ONCE] ❌ Learning job failed:', error.message);
    process.exit(1);
  }
}

main();

