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
        const { getSupabaseClient } = await import('../db/index');
        const supabase = getSupabaseClient();
        await supabase.from('system_events').insert({
          component: 'truth_integrity',
          event_type: 'verification_failed',
          severity: 'critical',
          message: 'Truth integrity check failed - critical violations detected',
          metadata: { exit_code: exitCode },
          timestamp: new Date().toISOString()
        });
      } catch (err) {
        console.error('[TRUTH_INTEGRITY_JOB] Failed to log to system_events:', err);
      }
    }
  } catch (error: any) {
    console.error('[TRUTH_INTEGRITY_JOB] ❌ Truth integrity check crashed:', error.message);
    
    // Log to system_events
    try {
      const { getSupabaseClient } = await import('../db/index');
      const supabase = getSupabaseClient();
      await supabase.from('system_events').insert({
        component: 'truth_integrity',
        event_type: 'verification_crashed',
        severity: 'critical',
        message: `Truth integrity check crashed: ${error.message}`,
        metadata: { error: error.message, stack: error.stack },
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error('[TRUTH_INTEGRITY_JOB] Failed to log to system_events:', err);
    }
  }
}
