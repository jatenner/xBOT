/**
 * ATTRIBUTION JOB
 * Runs every 2 hours to update post attribution and learning data
 */

import { runAttributionUpdate } from '../learning/engagementAttribution';

export async function runAttributionJob(): Promise<void> {
  console.log('[ATTRIBUTION_JOB] 🔄 Starting attribution update cycle...');
  
  try {
    await runAttributionUpdate();
    console.log('[ATTRIBUTION_JOB] ✅ Attribution update complete');
  } catch (error: any) {
    console.error('[ATTRIBUTION_JOB] ❌ Attribution update failed:', error.message);
  }
}

// Export for job scheduler
export const attributionJobConfig = {
  name: 'attribution',
  schedule: '0 */2 * * *', // Every 2 hours
  handler: runAttributionJob
};

