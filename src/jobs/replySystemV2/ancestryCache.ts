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
  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('reply_ancestry_cache')
      .select('*')
      .eq('tweet_id', tweetId)
      .single();
    
    if (error || !data) {
      return null; // Cache miss
    }
    
    const cached = data as CachedAncestry;
    const updatedAt = new Date(cached.updated_at);
    const ageMs = Date.now() - updatedAt.getTime();
    
    // Check TTL
    if (ageMs > CACHE_TTL_MS) {
      console.log(`[ANCESTRY_CACHE] ⏰ Cache expired for ${tweetId} (age: ${Math.round(ageMs / 1000 / 60)}min)`);
      return null; // Cache expired
    }
    
    console.log(`[ANCESTRY_CACHE] ✅ Cache hit for ${tweetId} (age: ${Math.round(ageMs / 1000 / 60)}min, method=${cached.method})`);
    
    return {
      targetTweetId: tweetId,
      targetInReplyToTweetId: null, // Not cached
      rootTweetId: cached.root_tweet_id,
      ancestryDepth: cached.depth,
      isRoot: cached.depth === 0 && cached.status === 'OK',
      status: cached.status,
      confidence: cached.confidence,
      method: `cache:${cached.method}`,
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
 */
export async function setCachedAncestry(tweetId: string, ancestry: ReplyAncestry): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from('reply_ancestry_cache')
      .upsert({
        tweet_id: tweetId,
        status: ancestry.status,
        depth: ancestry.ancestryDepth,
        root_tweet_id: ancestry.rootTweetId,
        confidence: ancestry.confidence,
        method: ancestry.method,
        signals_json: ancestry.signals || null,
        error: ancestry.error || null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'tweet_id',
      });
    
    if (error) {
      console.warn(`[ANCESTRY_CACHE] ⚠️ Failed to cache ancestry: ${error.message}`);
    } else {
      console.log(`[ANCESTRY_CACHE] 💾 Cached ancestry for ${tweetId} (status=${ancestry.status}, method=${ancestry.method})`);
    }
  } catch (error: any) {
    console.warn(`[ANCESTRY_CACHE] ⚠️ Error caching ancestry: ${error.message}`);
  }
}
