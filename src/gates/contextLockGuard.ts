/**
 * CONTEXT LOCK GUARD
 * 
 * Ensures replies are anchored to the exact tweet being targeted.
 * Prevents select/generate/post mismatch that causes unrelated replies.
 */

import { createHash } from 'crypto';
import { getSupabaseClient } from '../db';

export interface ContextSnapshot {
  target_tweet_id: string;
  target_tweet_text: string;
  target_tweet_text_hash: string;
  target_author: string;
  snapshot_at: string;
}

export interface ContextLockResult {
  pass: boolean;
  reason: string;
  similarity?: number;
  snapshot?: ContextSnapshot;
}

/**
 * Create SHA256 hash of tweet text for verification
 */
export function hashTweetText(text: string): string {
  return createHash('sha256')
    .update(text.trim().toLowerCase())
    .digest('hex');
}

/**
 * Compute text similarity using Jaccard similarity (simple, deterministic)
 */
export function computeTextSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  
  const intersection = new Set(Array.from(words1).filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

/**
 * Create a context snapshot at decision creation time
 */
export async function createContextSnapshot(
  targetTweetId: string,
  targetTweetText: string,
  targetAuthor: string
): Promise<ContextSnapshot> {
  if (!targetTweetText || targetTweetText.trim().length === 0) {
    throw new Error('Cannot create context snapshot: empty tweet text');
  }
  
  return {
    target_tweet_id: targetTweetId,
    target_tweet_text: targetTweetText.trim(),
    target_tweet_text_hash: hashTweetText(targetTweetText),
    target_author: targetAuthor,
    snapshot_at: new Date().toISOString()
  };
}

/**
 * Verify context lock at post time
 * 
 * Fetches fresh tweet text from DB and verifies it matches the snapshot
 */
export async function verifyContextLock(
  snapshot: ContextSnapshot,
  minSimilarity: number = 0.8
): Promise<ContextLockResult> {
  const supabase = getSupabaseClient();
  
  // Fetch fresh tweet text from reply_opportunities
  const { data: opportunity, error } = await supabase
    .from('reply_opportunities')
    .select('target_tweet_content, target_username, target_tweet_id')
    .eq('target_tweet_id', snapshot.target_tweet_id)
    .maybeSingle();
  
  if (error) {
    console.error(`[CONTEXT_LOCK] DB error fetching tweet ${snapshot.target_tweet_id}:`, error.message);
    return {
      pass: false,
      reason: 'db_fetch_error',
    };
  }
  
  if (!opportunity) {
    console.log(`[CONTEXT_LOCK] ⚠️ Opportunity ${snapshot.target_tweet_id} not found (may have been deleted)`);
    return {
      pass: false,
      reason: 'opportunity_missing',
    };
  }
  
  const freshText = String(opportunity.target_tweet_content || '').trim();
  
  // Check if fresh text is empty
  if (!freshText || freshText.length === 0) {
    console.log(`[CONTEXT_LOCK] ⚠️ Fresh text is empty for ${snapshot.target_tweet_id}`);
    return {
      pass: false,
      reason: 'fresh_text_empty',
    };
  }
  
  // Verify hash match (exact)
  const freshHash = hashTweetText(freshText);
  const hashMatch = freshHash === snapshot.target_tweet_text_hash;
  
  if (hashMatch) {
    console.log(`[CONTEXT_LOCK] ✅ Hash match (exact) for ${snapshot.target_tweet_id}`);
    return {
      pass: true,
      reason: 'hash_match_exact',
      similarity: 1.0,
      snapshot
    };
  }
  
  // Hash mismatch - compute similarity
  const similarity = computeTextSimilarity(snapshot.target_tweet_text, freshText);
  
  console.log(`[CONTEXT_LOCK] Hash mismatch for ${snapshot.target_tweet_id}: similarity=${(similarity * 100).toFixed(1)}%`);
  console.log(`[CONTEXT_LOCK]   Snapshot: "${snapshot.target_tweet_text.substring(0, 60)}..."`);
  console.log(`[CONTEXT_LOCK]   Fresh:    "${freshText.substring(0, 60)}..."`);
  
  if (similarity >= minSimilarity) {
    console.log(`[CONTEXT_LOCK] ✅ High similarity (${(similarity * 100).toFixed(1)}%) for ${snapshot.target_tweet_id}`);
    return {
      pass: true,
      reason: 'high_similarity',
      similarity,
      snapshot
    };
  }
  
  console.log(`[CONTEXT_LOCK] ⛔ Low similarity (${(similarity * 100).toFixed(1)}% < ${(minSimilarity * 100).toFixed(0)}%) for ${snapshot.target_tweet_id}`);
  return {
    pass: false,
    reason: 'context_mismatch',
    similarity,
  };
}

/**
 * Store context snapshot in decision metadata
 */
export async function storeContextSnapshot(
  decisionId: string,
  snapshot: ContextSnapshot
): Promise<void> {
  const supabase = getSupabaseClient();
  
  const { error } = await supabase
    .from('content_generation_metadata_comprehensive')
    .update({
      target_tweet_content_snapshot: snapshot.target_tweet_text,
      target_tweet_content_hash: snapshot.target_tweet_text_hash
    })
    .eq('decision_id', decisionId);
  
  if (error) {
    console.error(`[CONTEXT_LOCK] Failed to store snapshot for ${decisionId}:`, error.message);
  }
}

