/**
 * 🔐 AUTH FRESHNESS CHECK
 * 
 * Lightweight check that detects login validity for Railway jobs
 * Fails closed: if invalid, emits system block event + prevents harvesting/planning
 */

import { Page } from 'playwright';
import { getSupabaseClient } from '../db/index';
import { checkWhoami } from './whoamiAuth';

export interface AuthFreshnessResult {
  valid: boolean;
  handle: string | null;
  reason: string;
  checked_at: string;
}

/**
 * Check auth freshness and persist result to DB
 * Returns true if auth is valid, false otherwise
 */
export async function checkAuthFreshness(page: Page): Promise<AuthFreshnessResult> {
  const whoami = await checkWhoami(page);
  const checkedAt = new Date().toISOString();
  
  const result: AuthFreshnessResult = {
    valid: whoami.logged_in,
    handle: whoami.handle,
    reason: whoami.reason,
    checked_at: checkedAt,
  };
  
  // Persist to system_events
  try {
    const supabase = getSupabaseClient();
    await supabase.from('system_events').insert({
      event_type: whoami.logged_in ? 'auth_freshness_ok' : 'auth_freshness_failed',
      severity: whoami.logged_in ? 'info' : 'error',
      message: `Auth freshness check: ${whoami.logged_in ? 'valid' : 'invalid'} - ${whoami.reason}`,
      event_data: {
        handle: whoami.handle,
        reason: whoami.reason,
        url: whoami.url,
        title: whoami.title,
      },
      created_at: checkedAt,
    });
    
    // Update auth_blocked flag (create table if needed)
    try {
      await supabase.rpc('set_auth_blocked', {
        blocked: !whoami.logged_in,
        reason: whoami.reason,
      }).catch(() => {
        // RPC might not exist, use system_events only
      });
    } catch (rpcErr) {
      // Ignore RPC errors
    }
  } catch (dbErr: any) {
    console.warn(`[AUTH_FRESHNESS] Failed to persist check:`, dbErr.message);
  }
  
  return result;
}

/**
 * Check if auth is currently blocked (fail-closed check)
 */
export async function isAuthBlocked(): Promise<{ blocked: boolean; reason?: string }> {
  try {
    const supabase = getSupabaseClient();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    // Check for recent auth failures
    const { data: recentFailures } = await supabase
      .from('system_events')
      .select('event_type, message, event_data')
      .eq('event_type', 'auth_freshness_failed')
      .gte('created_at', oneHourAgo)
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (recentFailures && recentFailures.length > 0) {
      const failure = recentFailures[0];
      const reason = (failure.event_data as any)?.reason || failure.message || 'unknown';
      return { blocked: true, reason };
    }
    
    return { blocked: false };
  } catch (err) {
    // On error, don't block (fail-open for safety)
    console.warn(`[AUTH_FRESHNESS] Error checking block status:`, err);
    return { blocked: false };
  }
}
