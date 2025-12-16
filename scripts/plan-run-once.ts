/**
 * 🚀 ONE-SHOT PLAN JOB RUNNER
 * Runs planJob once and exits (for manual triggering)
 */

import { planContent } from '../src/jobs/planJob';

async function runPlanOnce() {
  console.log('[PLAN_RUN_ONCE] 🚀 Starting one-shot plan job run...');
  try {
    await planContent();
    console.log('[PLAN_RUN_ONCE] ✅ Plan job completed successfully');
    process.exit(0);
  } catch (error: any) {
    console.error('[PLAN_RUN_ONCE] ❌ Plan job failed:', error.message);
    process.exit(1);
  }
}

runPlanOnce();

