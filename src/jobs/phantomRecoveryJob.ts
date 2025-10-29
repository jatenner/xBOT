/**
 * 🔧 PHANTOM POST RECOVERY JOB
 * 
 * Runs periodically to detect and recover posts that were marked as "failed"
 * but actually succeeded on Twitter
 */

import { runPhantomPostRecovery } from '../recovery/phantomPostRecovery';

export async function runPhantomRecoveryJob(): Promise<void> {
  console.log('[PHANTOM_RECOVERY_JOB] 🔧 Starting phantom post recovery job...');
  
  try {
    await runPhantomPostRecovery();
    console.log('[PHANTOM_RECOVERY_JOB] ✅ Job complete');
  } catch (error: any) {
    console.error('[PHANTOM_RECOVERY_JOB] ❌ Job failed:', error.message);
    // Don't throw - this is a recovery job, failures shouldn't break the system
  }
}

