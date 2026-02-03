/**
 * 🛡️ BACKOFF STORE - Persistent Rate Limit Backoff in Supabase
 * 
 * Manages persistent backoff state in database to prevent repeated 429 hits.
 * Survives deploys and persists across instances.
 */

import { getSupabaseClient } from '../db/index';

export interface BackoffState {
  key: string;
  is_blocked: boolean;
  blocked_until: string | null;
  consecutive_429: number;
  last_429_at: string | null;
  updated_at: string;
}

/**
 * Get current backoff state for a key
 */
export async function getBackoff(key: string = 'harvest_search'): Promise<BackoffState | null> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('bot_backoff_state')
    .select('*')
    .eq('key', key)
    .single();
  
  if (error) {
    // If row doesn't exist, return null (not blocked)
    if (error.code === 'PGRST116') {
      return null;
    }
    // Table doesn't exist yet - return null (not blocked)
    if (error.message?.includes('does not exist') || error.message?.includes('relation')) {
      console.warn(`[BACKOFF_STORE] Table bot_backoff_state does not exist yet - returning null (not blocked). Apply migration: supabase/migrations/20260203_rate_limit_backoff_tables.sql`);
      return null;
    }
    console.error(`[BACKOFF_STORE] Failed to get backoff state: ${error.message}`);
    return null;
  }
  
  // Auto-clear if blocked_until has passed and no 429 in last 24h
  if (data && data.blocked_until) {
    const blockedUntil = new Date(data.blocked_until);
    const now = new Date();
    const last429At = data.last_429_at ? new Date(data.last_429_at) : null;
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    if (now >= blockedUntil && (!last429At || last429At < twentyFourHoursAgo)) {
      await clearBackoff(key);
      return null;
    }
  }
  
  return data;
}

/**
 * Record a 429 rate limit hit and set escalating backoff
 */
export async function set429(key: string = 'harvest_search'): Promise<void> {
  const supabase = getSupabaseClient();
  const now = new Date();
  const nowISO = now.toISOString();
  
  // Get current state
  const current = await getBackoff(key);
  const consecutive429 = (current?.consecutive_429 || 0) + 1;
  
  // Escalating backoff schedule with jitter
  let backoffMinutes: number;
  if (consecutive429 === 1) {
    // 1st: 45-75 min jitter
    backoffMinutes = 45 + Math.random() * 30;
  } else if (consecutive429 === 2) {
    // 2nd: 2-4 hr jitter
    backoffMinutes = 120 + Math.random() * 120;
  } else {
    // 3rd+: 12-24 hr jitter
    backoffMinutes = 720 + Math.random() * 720;
  }
  
  const blockedUntil = new Date(now.getTime() + backoffMinutes * 60 * 1000);
  
  const { error } = await supabase
    .from('bot_backoff_state')
    .upsert({
      key,
      is_blocked: true,
      blocked_until: blockedUntil.toISOString(),
      consecutive_429: consecutive429,
      last_429_at: nowISO,
      updated_at: nowISO,
    }, {
      onConflict: 'key',
    });
  
  if (error) {
    // Table doesn't exist yet - log warning but continue
    if (error.message?.includes('does not exist') || error.message?.includes('relation')) {
      console.warn(`[BACKOFF_STORE] Table bot_backoff_state does not exist - cannot persist backoff. Apply migration: supabase/migrations/20260203_rate_limit_backoff_tables.sql`);
    } else {
      console.error(`[BACKOFF_STORE] Failed to set 429 backoff: ${error.message}`);
    }
  } else {
    const minutesRounded = Math.round(backoffMinutes);
    console.log(`[BACKOFF_STORE] 429 recorded for ${key}; blocked_until=${blockedUntil.toISOString()}; consecutive=${consecutive429}; backoff_minutes=${minutesRounded}`);
  }
}

/**
 * Clear backoff for a key (manual override or auto-clear)
 */
export async function clearBackoff(key: string = 'harvest_search'): Promise<void> {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();
  
  const { error } = await supabase
    .from('bot_backoff_state')
    .upsert({
      key,
      is_blocked: false,
      blocked_until: null,
      consecutive_429: 0,
      last_429_at: null,
      updated_at: now,
    }, {
      onConflict: 'key',
    });
  
  if (error) {
    console.error(`[BACKOFF_STORE] Failed to clear backoff: ${error.message}`);
  } else {
    console.log(`[BACKOFF_STORE] Backoff cleared for ${key}`);
  }
}

/**
 * Check if a key is currently blocked
 */
export async function isBlocked(key: string = 'harvest_search'): Promise<{ blocked: boolean; blockedUntil: Date | null; minutesRemaining: number }> {
  const state = await getBackoff(key);
  
  if (!state || !state.blocked_until) {
    return { blocked: false, blockedUntil: null, minutesRemaining: 0 };
  }
  
  const blockedUntil = new Date(state.blocked_until);
  const now = new Date();
  
  if (now < blockedUntil) {
    const minutesRemaining = Math.ceil((blockedUntil.getTime() - now.getTime()) / (60 * 1000));
    return { blocked: true, blockedUntil, minutesRemaining };
  }
  
  // Block expired, auto-clear
  await clearBackoff(key);
  return { blocked: false, blockedUntil: null, minutesRemaining: 0 };
}
