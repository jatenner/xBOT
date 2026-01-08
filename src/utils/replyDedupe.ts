/**
 * 🔒 REPLY DEDUPLICATION & DO-NOT-REPLY RULES
 * 
 * Prevents duplicate replies and enforces author daily caps
 */

import { getSupabaseClient } from '../db/index';
import { classifyDisallowedTweet } from '../ai/relevanceReplyabilityScorer';

const AUTHOR_REPLY_DAILY_CAP = parseInt(process.env.AUTHOR_REPLY_DAILY_CAP || '2', 10);

export interface ReplyCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Check if we've already replied to this tweet_id
 */
export async function checkAlreadyReplied(tweetId: string): Promise<ReplyCheckResult> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('replied_tweets')
    .select('tweet_id')
    .eq('tweet_id', tweetId)
    .single();
  
  if (error && error.code !== 'PGRST116') { // PGRST116 = not found (ok)
    console.error(`[REPLY_DEDUPE] Error checking replied_tweets: ${error.message}`);
    return { allowed: true }; // Allow on error (fail open)
  }
  
  if (data) {
    return { allowed: false, reason: 'already_replied' };
  }
  
  return { allowed: true };
}

/**
 * Check if author has exceeded daily reply cap
 */
export async function checkAuthorDailyCap(authorHandle: string): Promise<ReplyCheckResult> {
  const supabase = getSupabaseClient();
  
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  const { count, error } = await supabase
    .from('replied_tweets')
    .select('*', { count: 'exact', head: true })
    .eq('author_handle', authorHandle.toLowerCase())
    .gte('replied_at', oneDayAgo);
  
  if (error) {
    console.error(`[REPLY_DEDUPE] Error checking author cap: ${error.message}`);
    return { allowed: true }; // Allow on error
  }
  
  if ((count || 0) >= AUTHOR_REPLY_DAILY_CAP) {
    return { allowed: false, reason: `author_daily_cap_exceeded (${count}/${AUTHOR_REPLY_DAILY_CAP})` };
  }
  
  return { allowed: true };
}

/**
 * Check if tweet is disallowed (corporate/promo/sensitive)
 */
export function checkDisallowedTweet(
  tweetText: string,
  authorHandle: string,
  tweetUrl?: string
): ReplyCheckResult {
  const disallowedReason = classifyDisallowedTweet(tweetText, authorHandle, tweetUrl);
  
  if (disallowedReason) {
    return { allowed: false, reason: disallowedReason };
  }
  
  return { allowed: true };
}

/**
 * Comprehensive check: already replied + author cap + disallowed
 */
export async function checkReplyAllowed(
  tweetId: string,
  tweetText: string,
  authorHandle: string,
  tweetUrl?: string
): Promise<ReplyCheckResult> {
  // Check already replied
  const alreadyReplied = await checkAlreadyReplied(tweetId);
  if (!alreadyReplied.allowed) {
    return alreadyReplied;
  }
  
  // Check author daily cap
  const authorCap = await checkAuthorDailyCap(authorHandle);
  if (!authorCap.allowed) {
    return authorCap;
  }
  
  // Check disallowed patterns
  const disallowed = checkDisallowedTweet(tweetText, authorHandle, tweetUrl);
  if (!disallowed.allowed) {
    return disallowed;
  }
  
  return { allowed: true };
}

/**
 * Record a successful reply (insert into replied_tweets)
 * Only call this after successful post (not dry-run)
 */
export async function recordReply(
  tweetId: string,
  authorHandle: string,
  decisionId?: string
): Promise<void> {
  const supabase = getSupabaseClient();
  
  const { error } = await supabase
    .from('replied_tweets')
    .insert({
      tweet_id: tweetId,
      author_handle: authorHandle.toLowerCase(),
      decision_id: decisionId,
      replied_at: new Date().toISOString(),
    });
  
  if (error) {
    console.error(`[REPLY_DEDUPE] Failed to record reply: ${error.message}`);
    // Don't throw - this is non-critical
  } else {
    console.log(`[REPLY_DEDUPE] ✅ Recorded reply: tweet_id=${tweetId} author=@${authorHandle}`);
  }
}

