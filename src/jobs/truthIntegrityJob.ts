/**
 * Truth Integrity Job
 * 
 * Scheduled job that runs truth integrity verification
 * and logs results to system_events
 */

import { verifyTruthIntegrity } from '../../scripts/verifyTruthIntegrity';

export async function runTruthIntegrityCheck(): Promise<void> {
  console.log('[TRUTH_INTEGRITY_JOB] Starting scheduled truth integrity check...');
  
  try {
    const exitCode = await verifyTruthIntegrity();
    
    if (exitCode === 0) {
      console.log('[TRUTH_INTEGRITY_JOB] ✅ Truth integrity check PASSED');
    } else {
      console.error('[TRUTH_INTEGRITY_JOB] ❌ Truth integrity check FAILED');
      console.error('[TRUTH_INTEGRITY_JOB] Critical violations detected - review logs above');
      
      // Log to system_events for monitoring
      try {
        const { trackError } = await import('../utils/errorTracking');
        await trackError(
          'truth_integrity',
          'verification_failed',
          'Truth integrity check failed - critical violations detected',
          'critical',
          { exit_code: exitCode }
        );
      } catch (err) {
        console.error('[TRUTH_INTEGRITY_JOB] Failed to log to system_events:', err);
      }
    }
  } catch (error: any) {
    console.error('[TRUTH_INTEGRITY_JOB] ❌ Truth integrity check crashed:', error.message);
    
    // Log to system_events
    try {
      const { trackError } = await import('../utils/errorTracking');
      await trackError(
        'truth_integrity',
        'verification_crashed',
        `Truth integrity check crashed: ${error.message}`,
        'critical',
        { error: error.message, stack: error.stack }
      );
    } catch (err) {
      console.error('[TRUTH_INTEGRITY_JOB] Failed to log to system_events:', err);
    }
  }
}
