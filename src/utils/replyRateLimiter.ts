/**
 * Distributed Reply Rate Limiter
 * 
 * Ensures exactly 4 replies/hour across multiple workers using DB locks.
 * Uses Postgres advisory locks for distributed coordination.
 */

import { getSupabaseClient } from '../db/index';

const REPLY_LOCK_ID = 987654321; // Unique lock ID for reply posting
const REPLIES_PER_HOUR = 4;
const LOCK_TIMEOUT_MS = 5000; // 5 seconds max to acquire lock

export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  repliesInWindow?: number;
  nextAvailableIn?: number; // minutes
}

/**
 * Execute reply posting operation with distributed lock
 * 
 * Holds lock for entire duration of operation to prevent concurrent posts.
 * Lock is automatically released after operation completes or throws.
 */
export async function withReplyLock<T>(operation: () => Promise<T>): Promise<T> {
  const supabase = getSupabaseClient();
  let lockAcquired = false;
  
  try {
    // STEP 1: Acquire advisory lock (non-blocking with timeout)
    console.log(`[REPLY_LOCK] 🔒 Attempting to acquire distributed lock (id=${REPLY_LOCK_ID})...`);
    
    const lockStart = Date.now();
    while (Date.now() - lockStart < LOCK_TIMEOUT_MS) {
      // Try to acquire lock (pg_try_advisory_lock returns true if acquired)
      const { data: lockResult, error: lockError } = await supabase
        .rpc('pg_try_advisory_lock', { lock_id: REPLY_LOCK_ID });
      
      if (lockError) {
        console.error(`[REPLY_LOCK] ❌ Lock acquisition error: ${lockError.message}`);
        throw new Error(`Reply lock error: ${lockError.message}`);
      }
      
      if (lockResult === true) {
        lockAcquired = true;
        console.log(`[REPLY_LOCK] ✅ Lock acquired`);
        break;
      }
      
      // Lock not available, wait 100ms and retry
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (!lockAcquired) {
      console.log(`[REPLY_LOCK] ⏰ Lock timeout - another worker is posting`);
      throw new Error('Reply lock timeout: another worker is posting');
    }
    
    // STEP 2: Check rate limit (rolling 60-minute window)
    const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { count, error: countError } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('decision_type', 'reply')
      .eq('status', 'posted')
      .gte('posted_at', sixtyMinutesAgo);
    
    if (countError) {
      console.error(`[REPLY_LOCK] ❌ Rate check error: ${countError.message}`);
      throw new Error(`Rate check error: ${countError.message}`);
    }
    
    const repliesInWindow = count || 0;
    
    if (repliesInWindow >= REPLIES_PER_HOUR) {
      // Find when oldest reply will expire
      const { data: oldestReply } = await supabase
        .from('content_metadata')
        .select('posted_at')
        .eq('decision_type', 'reply')
        .eq('status', 'posted')
        .gte('posted_at', sixtyMinutesAgo)
        .order('posted_at', { ascending: true })
        .limit(1)
        .single();
      
      let nextAvailableIn = 60; // Default fallback
      if (oldestReply) {
        const oldestTime = new Date(oldestReply.posted_at);
        const unlocksAt = new Date(oldestTime.getTime() + 60 * 60 * 1000);
        nextAvailableIn = Math.max(0, (unlocksAt.getTime() - Date.now()) / (1000 * 60));
      }
      
      console.log(`[REPLY_RATE_LIMIT] blocked=true count_last_60m=${repliesInWindow} cap=${REPLIES_PER_HOUR} next_in=${Math.ceil(nextAvailableIn)}m`);
      throw new Error(`Rate limit exceeded: ${repliesInWindow}/${REPLIES_PER_HOUR} in last 60m`);
    }
    
    console.log(`[REPLY_RATE_LIMIT] allowed=true count_last_60m=${repliesInWindow} cap=${REPLIES_PER_HOUR}`);
    
    // STEP 3: Execute operation while holding lock
    return await operation();
    
  } finally {
    // STEP 4: Always release lock (even if error)
    if (lockAcquired) {
      try {
        const { error: unlockError } = await supabase
          .rpc('pg_advisory_unlock', { lock_id: REPLY_LOCK_ID });
        
        if (unlockError) {
          console.error(`[REPLY_LOCK] ⚠️ Failed to release lock: ${unlockError.message}`);
        } else {
          console.log(`[REPLY_LOCK] 🔓 Lock released`);
        }
      } catch (unlockErr: any) {
        console.error(`[REPLY_LOCK] ⚠️ Exception releasing lock: ${unlockErr.message}`);
      }
    }
  }
}

/**
 * Check if rate limit allows posting (without acquiring lock)
 * Useful for pre-checks before attempting to post
 */
export async function checkReplyRateLimit(): Promise<RateLimitResult> {
  const supabase = getSupabaseClient();
  
  const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  const { count, error } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .gte('posted_at', sixtyMinutesAgo);
  
  if (error) {
    return {
      allowed: false,
      reason: `Rate check error: ${error.message}`
    };
  }
  
  const repliesInWindow = count || 0;
  
  return {
    allowed: repliesInWindow < REPLIES_PER_HOUR,
    repliesInWindow,
    reason: repliesInWindow >= REPLIES_PER_HOUR ? 'Rate limit would be exceeded' : undefined
  };
}

