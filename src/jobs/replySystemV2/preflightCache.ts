/**
 * 🔒 PREFLIGHT CACHE
 * 
 * Caches preflight check results in reply_opportunities to avoid redundant fetches.
 * TTL: 20 minutes (configurable via PREFLIGHT_CACHE_TTL_MINUTES)
 */

import { getSupabaseClient } from '../../db/index';

export type PreflightStatus = 'ok' | 'deleted' | 'protected' | 'timeout' | 'error' | 'skipped';

// Export as const for type checking
export const PreflightStatusValues = ['ok', 'deleted', 'protected', 'timeout', 'error', 'skipped'] as const;

export interface PreflightCacheEntry {
  status: PreflightStatus;
  checked_at: string;
  text_hash?: string;
  reason?: string;
  latency_ms?: number;
}

const CACHE_TTL_MS = parseInt(process.env.PREFLIGHT_CACHE_TTL_MINUTES || '20', 10) * 60 * 1000;

/**
 * Get cached preflight status for a tweet
 */
export async function getCachedPreflight(tweetId: string): Promise<PreflightCacheEntry | null> {
  const supabase = getSupabaseClient();
  
  // Check reply_opportunities for cached status
  // Note: If features column doesn't exist, this will return null (graceful fallback)
  const { data: opp } = await supabase
    .from('reply_opportunities')
    .select('features')
    .eq('target_tweet_id', tweetId)
    .maybeSingle();
  
  if (!opp || !opp.features) {
    return null;
  }
  
  const features = opp.features as any;
  const cached = features.preflight_cache;
  
  if (!cached || !cached.checked_at) {
    return null;
  }
  
  const checkedAt = new Date(cached.checked_at).getTime();
  const ageMs = Date.now() - checkedAt;
  
  if (ageMs > CACHE_TTL_MS) {
    return null; // Cache expired
  }
  
  return {
    status: cached.status || 'error',
    checked_at: cached.checked_at,
    text_hash: cached.text_hash,
    reason: cached.reason,
    latency_ms: cached.latency_ms,
  };
}

/**
 * Cache preflight result for a tweet
 */
export async function cachePreflight(
  tweetId: string,
  entry: PreflightCacheEntry
): Promise<void> {
  const supabase = getSupabaseClient();
  
  // Get existing features or create new
  const { data: opp } = await supabase
    .from('reply_opportunities')
    .select('features')
    .eq('target_tweet_id', tweetId)
    .maybeSingle();
  
  const existingFeatures = (opp?.features || {}) as any;
  
  // Update features with preflight cache
  const updatedFeatures = {
    ...existingFeatures,
    preflight_cache: {
      status: entry.status,
      checked_at: entry.checked_at,
      text_hash: entry.text_hash,
      reason: entry.reason,
      latency_ms: entry.latency_ms,
    },
  };
  
  // Try to update (may fail if features column doesn't exist - graceful fallback)
  await supabase
    .from('reply_opportunities')
    .update({ features: updatedFeatures })
    .eq('target_tweet_id', tweetId)
    .then(({ error }) => {
      if (error && !error.message.includes('column') && !error.message.includes('does not exist')) {
        console.warn(`[PREFLIGHT_CACHE] Failed to cache preflight for ${tweetId}: ${error.message}`);
      }
    });
}
