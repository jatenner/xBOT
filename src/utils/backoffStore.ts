/**
 * 🔒 BACKOFF STORE
 * 
 * Checks if a resource is currently blocked due to backoff state.
 * Uses bot_backoff_state table for persistent backoff tracking.
 */

import { getSupabaseClient } from '../db/index';

export interface BlockCheckResult {
  blocked: boolean;
  blockedUntil?: Date | null;
  reason?: string;
}

/**
 * Check if a resource is currently blocked
 */
export async function isBlocked(resource: string): Promise<BlockCheckResult> {
  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('bot_backoff_state')
      .select('blocked_until, reason')
      .eq('resource', resource)
      .single();
    
    if (error || !data) {
      return { blocked: false };
    }
    
    if (!data.blocked_until) {
      return { blocked: false };
    }
    
    const blockedUntil = new Date(data.blocked_until);
    const now = new Date();
    
    if (now < blockedUntil) {
      return {
        blocked: true,
        blockedUntil,
        reason: data.reason || 'backoff_active',
      };
    }
    
    // Block expired, clear it
    await supabase
      .from('bot_backoff_state')
      .update({ blocked_until: null, reason: null })
      .eq('resource', resource);
    
    return { blocked: false };
  } catch (error: any) {
    console.warn(`[BACKOFF_STORE] Error checking block status: ${error.message}`);
    return { blocked: false }; // Fail-open
  }
}
