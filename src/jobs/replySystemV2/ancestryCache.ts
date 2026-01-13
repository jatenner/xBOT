/**
 * 🔍 ANCESTRY CACHE: Cache resolved ancestry to reduce UNCERTAIN/ERROR rates
 */

import { getSupabaseClient } from '../../db';
import { ReplyAncestry } from './replyDecisionRecorder';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface CachedAncestry {
  tweet_id: string;
  status: 'OK' | 'UNCERTAIN' | 'ERROR';
  depth: number | null;
  root_tweet_id: string | null;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  method: string;
  signals_json: any;
  error: string | null;
  updated_at: string;
}

/**
 * Get cached ancestry if available and fresh
 */
export async function getCachedAncestry(tweetId: string): Promise<ReplyAncestry | null> {
  const DEBUG = process.env.ANCESTRY_CACHE_DEBUG === 'true';
  
  try {
    const supabase = getSupabaseClient();
    
    // Ensure tweet_id is string (consistent key)
    const cacheKey = String(tweetId);
    
    if (DEBUG) {
      console.log(`[ANCESTRY_CACHE] 🔍 Looking up cache for tweet_id=${cacheKey}`);
    }
    
    const { data, error } = await supabase
      .from('reply_ancestry_cache')
      .select('*')
      .eq('tweet_id', cacheKey)
      .maybeSingle();
    
    if (error) {
      if (error.code === '42P01') {
        if (DEBUG) console.log(`[ANCESTRY_CACHE] ⚠️ Table does not exist yet`);
      } else {
        console.warn(`[ANCESTRY_CACHE] ⚠️ Error reading cache: ${error.message}`);
      }
      return null; // Cache miss
    }
    
    if (!data) {
      if (DEBUG) console.log(`[ANCESTRY_CACHE] ❌ Cache miss for ${cacheKey}`);
      return null; // Cache miss
    }
    
    const cached = data as CachedAncestry;
    const updatedAt = new Date(cached.updated_at);
    const ageMs = Date.now() - updatedAt.getTime();
    
    // Check TTL
    if (ageMs > CACHE_TTL_MS) {
      if (DEBUG) console.log(`[ANCESTRY_CACHE] ⏰ Cache expired for ${cacheKey} (age: ${Math.round(ageMs / 1000 / 60)}min)`);
      return null; // Cache expired
    }
    
    // 🎯 PART A: Detect stale cache entries (old format)
    // If entry has ERROR/UNCERTAIN status and error message looks like old format, bypass cache
    if ((cached.status === 'ERROR' || cached.status === 'UNCERTAIN') && cached.error) {
      const errorMsg = cached.error;
      // Check for old format indicators:
      // - Contains "pool={queue=" OR "active=0/5" (old pool snapshot format)
      // - Contains "queue=XX, active=0/5" pattern (old overload message format)
      // - Lacks "OVERLOAD_DETAIL_JSON:" marker
      // - Lacks "detail_version" marker
      const hasOldFormat = errorMsg.includes('pool={queue=') || 
                          errorMsg.includes('active=0/5') ||
                          (errorMsg.includes('queue=') && errorMsg.includes('active=') && 
                           !errorMsg.includes('OVERLOAD_DETAIL_JSON:') &&
                           !errorMsg.includes('detail_version'));
      
      if (hasOldFormat) {
        console.log(`[ANCESTRY_CACHE] stale_format_bypass tweet_id=${cacheKey} reason=old_format error_preview=${errorMsg.substring(0, 100)}`);
        return null; // Bypass stale cache, force fresh resolution
      }
    }
    
    console.log(`[ANCESTRY_CACHE] ✅ Cache hit for ${cacheKey} (age: ${Math.round(ageMs / 1000 / 60)}min, method=${cached.method})`);
    
    return {
      targetTweetId: tweetId,
      targetInReplyToTweetId: null, // Not cached
      rootTweetId: cached.root_tweet_id,
      ancestryDepth: cached.depth,
      isRoot: cached.depth === 0 && cached.status === 'OK',
      status: cached.status,
      confidence: cached.confidence,
      method: cached.method, // Keep original method, not prefixed with 'cache:'
      signals: cached.signals_json || undefined,
      error: cached.error || undefined,
    };
  } catch (error: any) {
    console.warn(`[ANCESTRY_CACHE] ⚠️ Error reading cache: ${error.message}`);
    return null;
  }
}

/**
 * Write ancestry to cache (write-through)
 * 🔒 ALWAYS writes, even on UNCERTAIN/ERROR (useful to avoid retrying)
 */
export async function setCachedAncestry(tweetId: string, ancestry: ReplyAncestry): Promise<void> {
  const DEBUG = process.env.ANCESTRY_CACHE_DEBUG === 'true';
  
  try {
    const supabase = getSupabaseClient();
    
    // Ensure tweet_id is string (consistent key)
    const cacheKey = String(tweetId);
    
    // Extract method without 'cache:' prefix if present
    const method = ancestry.method.startsWith('cache:') 
      ? ancestry.method.substring(6) 
      : ancestry.method;
    
    if (DEBUG) {
      console.log(`[ANCESTRY_CACHE] 💾 Writing cache for tweet_id=${cacheKey}, status=${ancestry.status}, method=${method}`);
    }
    
    const { error } = await supabase
      .from('reply_ancestry_cache')
      .upsert({
        tweet_id: cacheKey, // Use string key consistently
        status: ancestry.status,
        depth: ancestry.ancestryDepth,
        root_tweet_id: ancestry.rootTweetId,
        confidence: ancestry.confidence,
        method: method, // Store without 'cache:' prefix
        signals_json: ancestry.signals || null,
        error: ancestry.error || null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'tweet_id',
      });
    
    if (error) {
      console.error(`[ANCESTRY_CACHE] ❌ Failed to cache ancestry for ${cacheKey}: ${error.message}`);
      console.error(`[ANCESTRY_CACHE]   Error code: ${error.code}, details: ${JSON.stringify(error)}`);
    } else {
      console.log(`[ANCESTRY_CACHE] ✅ Cached ancestry for ${cacheKey} (status=${ancestry.status}, method=${method}, depth=${ancestry.ancestryDepth ?? 'null'})`);
    }
  } catch (error: any) {
    console.error(`[ANCESTRY_CACHE] ❌ Exception caching ancestry for ${tweetId}: ${error.message}`);
    console.error(`[ANCESTRY_CACHE]   Stack: ${error.stack}`);
  }
}
