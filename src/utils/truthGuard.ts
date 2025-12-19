/**
 * Truth Guard
 * 
 * Prevents posting when truth integrity is failing repeatedly
 * to avoid polluting the learning system with false data
 */

import { createClient } from '@supabase/supabase-js';

const ENABLE_TRUTH_GUARD = process.env.ENABLE_TRUTH_GUARD !== 'false'; // Default true
const FAILURE_THRESHOLD = 3; // Number of failures to trigger block
const ROLLING_WINDOW_MINUTES = 60; // Time window for counting failures

/**
 * Check if posting should be blocked due to truth integrity failures
 */
export async function isTruthIntegrityBlocked(): Promise<{ blocked: boolean; reason?: string; failure_count?: number }> {
  if (!ENABLE_TRUTH_GUARD) {
    return { blocked: false };
  }
  
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!url || !key) {
      console.warn('[TRUTH_GUARD] ⚠️ Supabase credentials missing, allowing posting');
      return { blocked: false };
    }
    
    const supabase = createClient(url, key);
    
    // Query system_events for recent verification failures
    const cutoffTime = new Date(Date.now() - ROLLING_WINDOW_MINUTES * 60 * 1000).toISOString();
    
    const { data, error } = await supabase
      .from('system_events')
      .select('timestamp')
      .eq('component', 'truth_integrity')
      .eq('event_type', 'verification_failed')
      .gte('timestamp', cutoffTime)
      .order('timestamp', { ascending: false });
    
    if (error) {
      console.error('[TRUTH_GUARD] ⚠️ Failed to query failures:', error.message);
      return { blocked: false }; // Fail open (allow posting if guard check fails)
    }
    
    const failureCount = data?.length || 0;
    
    if (failureCount >= FAILURE_THRESHOLD) {
      return {
        blocked: true,
        reason: `TRUTH_VERIFY_FAIL_STREAK: ${failureCount} failures in last ${ROLLING_WINDOW_MINUTES}min`,
        failure_count: failureCount
      };
    }
    
    return { blocked: false, failure_count: failureCount };
  } catch (error: any) {
    console.error('[TRUTH_GUARD] ⚠️ Guard check failed:', error.message);
    return { blocked: false }; // Fail open
  }
}

/**
 * Clear truth integrity block (for manual recovery)
 */
export async function clearTruthIntegrityBlock(): Promise<void> {
  console.log('[TRUTH_GUARD] 🔓 Clearing truth integrity block...');
  
  try {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!url || !key) {
      console.warn('[TRUTH_GUARD] ⚠️ Supabase credentials missing');
      return;
    }
    
    const supabase = createClient(url, key);
    
    // Delete recent verification failures
    const cutoffTime = new Date(Date.now() - ROLLING_WINDOW_MINUTES * 60 * 1000).toISOString();
    
    const { error } = await supabase
      .from('system_events')
      .delete()
      .eq('component', 'truth_integrity')
      .eq('event_type', 'verification_failed')
      .gte('timestamp', cutoffTime);
    
    if (error) {
      console.error('[TRUTH_GUARD] ⚠️ Failed to clear block:', error.message);
    } else {
      console.log('[TRUTH_GUARD] ✅ Truth integrity block cleared');
    }
  } catch (error: any) {
    console.error('[TRUTH_GUARD] ⚠️ Clear operation failed:', error.message);
  }
}

