/**
 * ANTI-SPAM GUARD
 * 
 * Prevents spamming same accounts/tweets with multiple replies.
 * Enforces cooldowns and blocks self-replies.
 */

import { getSupabaseClient } from '../db';

export interface AntiSpamResult {
  pass: boolean;
  reason: string;
  cooldown_remaining_minutes?: number;
  last_reply_at?: string;
}

const OUR_HANDLE = (process.env.TWITTER_USERNAME || 'SignalAndSynapse').toLowerCase();

/**
 * Check if we've already replied to this root tweet recently
 */
export async function checkRootTweetCooldown(
  rootTweetId: string,
  cooldownHours: number = parseFloat(process.env.REPLY_ROOT_TWEET_COOLDOWN_HOURS || '24')
): Promise<AntiSpamResult> {
  const supabase = getSupabaseClient();
  const cooldownMs = cooldownHours * 60 * 60 * 1000;
  const cooldownThreshold = new Date(Date.now() - cooldownMs).toISOString();
  
  const { data: existingReply, error } = await supabase
    .from('content_metadata')
    .select('posted_at, tweet_id')
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .eq('root_tweet_id', rootTweetId)
    .gte('posted_at', cooldownThreshold)
    .order('posted_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (error) {
    console.error(`[ANTI_SPAM] DB error checking root cooldown:`, error.message);
    // Fail open on transient errors
    return { pass: true, reason: 'db_error_fail_open' };
  }
  
  if (existingReply) {
    const lastReplyAt = new Date(existingReply.posted_at);
    const cooldownRemaining = cooldownMs - (Date.now() - lastReplyAt.getTime());
    const minutesRemaining = Math.ceil(cooldownRemaining / (60 * 1000));
    
    console.log(`[ANTI_SPAM] ⛔ Already replied to root ${rootTweetId} ${minutesRemaining}min ago (cooldown: ${cooldownHours}h)`);
    
    return {
      pass: false,
      reason: 'root_tweet_cooldown',
      cooldown_remaining_minutes: minutesRemaining,
      last_reply_at: existingReply.posted_at
    };
  }
  
  return { pass: true, reason: 'no_recent_reply_to_root' };
}

/**
 * Check if we've already replied to this author recently
 */
export async function checkAuthorCooldown(
  authorHandle: string,
  cooldownHours: number = parseFloat(process.env.REPLY_AUTHOR_COOLDOWN_HOURS || '12')
): Promise<AntiSpamResult> {
  const supabase = getSupabaseClient();
  const cooldownMs = cooldownHours * 60 * 60 * 1000;
  const cooldownThreshold = new Date(Date.now() - cooldownMs).toISOString();
  
  const { data: existingReply, error } = await supabase
    .from('content_metadata')
    .select('posted_at, tweet_id')
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .eq('target_username', authorHandle.toLowerCase())
    .gte('posted_at', cooldownThreshold)
    .order('posted_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (error) {
    console.error(`[ANTI_SPAM] DB error checking author cooldown:`, error.message);
    return { pass: true, reason: 'db_error_fail_open' };
  }
  
  if (existingReply) {
    const lastReplyAt = new Date(existingReply.posted_at);
    const cooldownRemaining = cooldownMs - (Date.now() - lastReplyAt.getTime());
    const minutesRemaining = Math.ceil(cooldownRemaining / (60 * 1000));
    
    console.log(`[ANTI_SPAM] ⛔ Already replied to @${authorHandle} ${minutesRemaining}min ago (cooldown: ${cooldownHours}h)`);
    
    return {
      pass: false,
      reason: 'author_cooldown',
      cooldown_remaining_minutes: minutesRemaining,
      last_reply_at: existingReply.posted_at
    };
  }
  
  return { pass: true, reason: 'no_recent_reply_to_author' };
}

/**
 * Check if target is our own tweet/reply
 */
export function checkSelfReply(authorHandle: string): AntiSpamResult {
  const normalized = authorHandle.toLowerCase().replace('@', '');
  
  if (normalized === OUR_HANDLE) {
    console.log(`[ANTI_SPAM] ⛔ Blocking self-reply to @${authorHandle}`);
    return {
      pass: false,
      reason: 'self_reply_blocked'
    };
  }
  
  return { pass: true, reason: 'not_self_reply' };
}

/**
 * Check hourly reply rate limit
 */
export async function checkHourlyRateLimit(
  maxRepliesPerHour: number = parseInt(process.env.MAX_REPLIES_PER_HOUR || '4')
): Promise<AntiSpamResult> {
  const supabase = getSupabaseClient();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  const { count, error } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .gte('posted_at', oneHourAgo);
  
  if (error) {
    console.error(`[ANTI_SPAM] DB error checking hourly rate:`, error.message);
    return { pass: true, reason: 'db_error_fail_open' };
  }
  
  if ((count || 0) >= maxRepliesPerHour) {
    console.log(`[ANTI_SPAM] ⛔ Hourly rate limit reached (${count}/${maxRepliesPerHour})`);
    return {
      pass: false,
      reason: 'hourly_rate_limit_reached'
    };
  }
  
  return { pass: true, reason: 'within_hourly_rate_limit' };
}

/**
 * Run all anti-spam checks
 */
export async function checkAntiSpam(
  rootTweetId: string | null,
  targetTweetId: string,
  authorHandle: string
): Promise<AntiSpamResult> {
  // 1. Check self-reply
  const selfCheck = checkSelfReply(authorHandle);
  if (!selfCheck.pass) return selfCheck;
  
  // 2. Check hourly rate limit
  const rateCheck = await checkHourlyRateLimit();
  if (!rateCheck.pass) return rateCheck;
  
  // 3. Check author cooldown
  const authorCheck = await checkAuthorCooldown(authorHandle);
  if (!authorCheck.pass) return authorCheck;
  
  // 4. Check root tweet cooldown (if root is known)
  if (rootTweetId) {
    const rootCheck = await checkRootTweetCooldown(rootTweetId);
    if (!rootCheck.pass) return rootCheck;
  }
  
  return { pass: true, reason: 'all_anti_spam_checks_passed' };
}

