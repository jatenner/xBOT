/**
 * 📊 ENGAGEMENT TRACKING JOB
 * 
 * Fetches engagement metrics for replies posted 24h+ ago
 */

import { fetchPendingEngagementMetrics } from './engagementTracker';

/**
 * Run engagement tracking job
 */
export async function runEngagementTrackingJob(): Promise<void> {
  console.log('[ENGAGEMENT_TRACKER] 📊 Starting engagement tracking job...');
  
  const result = await fetchPendingEngagementMetrics();
  
  console.log(`[ENGAGEMENT_TRACKER] ✅ Job complete: checked=${result.checked}, updated=${result.updated}, errors=${result.errors}`);
  
  if (result.errors > 0) {
    console.warn(`[ENGAGEMENT_TRACKER] ⚠️ ${result.errors} errors occurred during tracking`);
  }
}
