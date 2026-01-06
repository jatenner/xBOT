/**
 * Distributed Content Rate Limiter
 * 
 * Ensures exactly MAX_POSTS_PER_HOUR posts/hour across multiple workers using DB locks.
 * Uses Postgres advisory locks for distributed coordination.
 */

import { getSupabaseClient } from '../db/index';

const CONTENT_LOCK_ID = 987654322; // Unique lock ID for content posting (different from reply lock)
const MAX_POSTS_PER_HOUR = 2; // From env or config
const LOCK_TIMEOUT_MS = 5000; // 5 seconds max to acquire lock

export interface ContentRateLimitResult {
  allowed: boolean;
  reason?: string;
  postsInWindow?: number;
  nextAvailableIn?: number; // minutes
}

/**
 * Execute content posting operation with distributed lock
 * 
 * Holds lock for entire duration of operation to prevent concurrent posts.
 * Lock is automatically released after operation completes or throws.
 */
export async function withContentLock<T>(operation: () => Promise<T>): Promise<T> {
  const supabase = getSupabaseClient();
  let lockAcquired = false;
  
  try {
    // STEP 1: Acquire advisory lock (non-blocking with timeout)
    console.log(`[CONTENT_LOCK] 🔒 Attempting to acquire distributed lock (id=${CONTENT_LOCK_ID})...`);
    
    const lockStart = Date.now();
    while (Date.now() - lockStart < LOCK_TIMEOUT_MS) {
      // Try to acquire lock (pg_try_advisory_lock returns true if acquired)
      const { data: lockResult, error: lockError } = await supabase
        .rpc('pg_try_advisory_lock', { lock_id: CONTENT_LOCK_ID });
      
      if (lockError) {
        console.error(`[CONTENT_LOCK] ❌ Lock acquisition error: ${lockError.message}`);
        throw new Error(`Content lock error: ${lockError.message}`);
      }
      
      if (lockResult === true) {
        lockAcquired = true;
        console.log(`[CONTENT_LOCK] ✅ Lock acquired`);
        break;
      }
      
      // Lock not available, wait 100ms and retry
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (!lockAcquired) {
      console.log(`[CONTENT_LOCK] ⏰ Lock timeout - another worker is posting`);
      throw new Error('Content lock timeout: another worker is posting');
    }
    
    // STEP 2: Check rate limit (rolling 60-minute window)
    // Count ALL tweets posted (singles + threads) - they share the same quota
    const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { count, error: countError } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .in('decision_type', ['single', 'thread'])
      .eq('status', 'posted')
      .not('tweet_id', 'is', null)
      .gte('posted_at', sixtyMinutesAgo);
    
    if (countError) {
      console.error(`[CONTENT_LOCK] ❌ Rate check error: ${countError.message}`);
      throw new Error(`Rate check error: ${countError.message}`);
    }
    
    const postsInWindow = count || 0;
    
    // Get MAX_POSTS_PER_HOUR from env or use default
    const maxPostsPerHour = Number(process.env.MAX_POSTS_PER_HOUR) || MAX_POSTS_PER_HOUR;
    
    if (postsInWindow >= maxPostsPerHour) {
      // Find when oldest post will expire
      const { data: oldestPost } = await supabase
        .from('content_metadata')
        .select('posted_at')
        .in('decision_type', ['single', 'thread'])
        .eq('status', 'posted')
        .not('tweet_id', 'is', null)
        .gte('posted_at', sixtyMinutesAgo)
        .order('posted_at', { ascending: true })
        .limit(1)
        .single();
      
      let nextAvailableIn = 60; // Default fallback
      if (oldestPost) {
        const oldestTime = new Date(oldestPost.posted_at);
        const unlocksAt = new Date(oldestTime.getTime() + 60 * 60 * 1000);
        nextAvailableIn = Math.max(0, (unlocksAt.getTime() - Date.now()) / (1000 * 60));
      }
      
      console.log(`[CONTENT_RATE_LIMIT] blocked=true count_last_60m=${postsInWindow} cap=${maxPostsPerHour} next_in=${Math.ceil(nextAvailableIn)}m`);
      throw new Error(`Rate limit exceeded: ${postsInWindow}/${maxPostsPerHour} in last 60m`);
    }
    
    console.log(`[CONTENT_RATE_LIMIT] allowed=true count_last_60m=${postsInWindow} cap=${maxPostsPerHour}`);
    
    // STEP 3: Execute operation while holding lock
    return await operation();
    
  } finally {
    // STEP 4: Always release lock (even if error)
    if (lockAcquired) {
      try {
        const { error: unlockError } = await supabase
          .rpc('pg_advisory_unlock', { lock_id: CONTENT_LOCK_ID });
        
        if (unlockError) {
          console.error(`[CONTENT_LOCK] ⚠️ Failed to release lock: ${unlockError.message}`);
        } else {
          console.log(`[CONTENT_LOCK] 🔓 Lock released`);
        }
      } catch (unlockErr: any) {
        console.error(`[CONTENT_LOCK] ⚠️ Exception releasing lock: ${unlockErr.message}`);
      }
    }
  }
}

/**
 * Check if rate limit allows posting (without acquiring lock)
 * Useful for pre-checks before attempting to post
 */
export async function checkContentRateLimit(): Promise<ContentRateLimitResult> {
  const supabase = getSupabaseClient();
  
  const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  const { count, error } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .in('decision_type', ['single', 'thread'])
    .eq('status', 'posted')
    .not('tweet_id', 'is', null)
    .gte('posted_at', sixtyMinutesAgo);
  
  if (error) {
    return {
      allowed: false,
      reason: `Rate check error: ${error.message}`
    };
  }
  
  const postsInWindow = count || 0;
  const maxPostsPerHour = Number(process.env.MAX_POSTS_PER_HOUR) || MAX_POSTS_PER_HOUR;
  
  return {
    allowed: postsInWindow < maxPostsPerHour,
    postsInWindow,
    reason: postsInWindow >= maxPostsPerHour ? 'Rate limit would be exceeded' : undefined
  };
}

