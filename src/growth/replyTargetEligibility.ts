/**
 * 🎯 REPLY TARGET ELIGIBILITY FILTER
 * Phase 6.2: Filters invalid reply targets and prevents spam
 * 
 * Filters out:
 * - Tweets already replied to recently (lookback window)
 * - Tweets that trigger target_exists:true
 * - Tweets that are is_root_tweet:false (if reply pipeline requires root tweets)
 * - Stale tweets (older than threshold)
 */

import { getSupabaseClient } from '../db/index';
import { getGrowthConfig } from '../config/growthConfig';

/**
 * Eligibility reason codes (enum)
 */
export enum EligibilityReason {
  ELIGIBLE = 'eligible',
  ALREADY_REPLIED_RECENTLY = 'already_replied_recently',
  TARGET_EXISTS = 'target_exists',
  NOT_ROOT_TWEET = 'not_root_tweet',
  STALE_TWEET = 'stale_tweet',
  MISSING_REQUIRED_FIELDS = 'missing_required_fields',
}

/**
 * Eligibility decision result
 */
export interface EligibilityDecision {
  eligible: boolean;
  reason: EligibilityReason;
  reasonDetails?: string;
  checkedAt: Date;
}

/**
 * Candidate tweet interface (matches reply_opportunities schema)
 */
export interface ReplyTargetCandidate {
  id?: number;
  target_tweet_id: string;
  target_username?: string;
  tweet_posted_at?: string | Date;
  is_root_tweet?: boolean | number | string;
  root_tweet_id?: string;
  status?: string;
  replied_to?: boolean | number | string;
  target_in_reply_to_tweet_id?: string;
  in_reply_to_tweet_id?: string;
  // Scoring-relevant fields
  like_count?: number;
  reply_count?: number;
  retweet_count?: number;
  posted_minutes_ago?: number;
  engagement_rate?: number;
  target_followers?: number;
  account_followers?: number;
}

/**
 * Check if a candidate tweet is eligible for reply targeting
 */
export async function checkEligibility(
  candidate: ReplyTargetCandidate,
  options?: {
    checkTargetExists?: boolean;
    requireRootTweet?: boolean;
  }
): Promise<EligibilityDecision> {
  const config = getGrowthConfig();
  const supabase = getSupabaseClient();
  const checkedAt = new Date();

  // 1. Check required fields
  if (!candidate.target_tweet_id) {
    return {
      eligible: false,
      reason: EligibilityReason.MISSING_REQUIRED_FIELDS,
      reasonDetails: 'Missing target_tweet_id',
      checkedAt,
    };
  }

  // 2. Check if already replied to recently (lookback window)
  const lookbackDate = new Date();
  lookbackDate.setDate(lookbackDate.getDate() - config.REPLY_RECENT_LOOKBACK_DAYS);
  
  const { data: recentReplies } = await supabase
    .from('content_metadata')
    .select('decision_id, target_tweet_id, target_username, posted_at')
    .eq('decision_type', 'reply')
    .eq('target_tweet_id', candidate.target_tweet_id)
    .gte('posted_at', lookbackDate.toISOString())
    .limit(1);

  if (recentReplies && recentReplies.length > 0) {
    return {
      eligible: false,
      reason: EligibilityReason.ALREADY_REPLIED_RECENTLY,
      reasonDetails: `Already replied to this tweet within last ${config.REPLY_RECENT_LOOKBACK_DAYS} days`,
      checkedAt,
    };
  }

  // Also check reply_opportunities for replied_to flag
  if (candidate.replied_to === true || candidate.replied_to === 1 || candidate.replied_to === 'true') {
    return {
      eligible: false,
      reason: EligibilityReason.ALREADY_REPLIED_RECENTLY,
      reasonDetails: 'Opportunity marked as replied_to',
      checkedAt,
    };
  }

  // 3. Check if target exists (if enabled)
  if (options?.checkTargetExists !== false) {
    // Check if we already have a reply queued/posted for this target
    const { data: existingReply } = await supabase
      .from('content_metadata')
      .select('decision_id, status')
      .eq('decision_type', 'reply')
      .eq('target_tweet_id', candidate.target_tweet_id)
      .in('status', ['queued', 'posting', 'posted'])
      .limit(1);

    if (existingReply && existingReply.length > 0) {
      return {
        eligible: false,
        reason: EligibilityReason.TARGET_EXISTS,
        reasonDetails: `Reply already exists for target_tweet_id=${candidate.target_tweet_id}`,
        checkedAt,
      };
    }
  }

  // 4. Check if root tweet (if required)
  const requireRoot = options?.requireRootTweet !== false; // Default true for safety
  if (requireRoot) {
    const isRootValue = candidate.is_root_tweet;
    const isRoot = isRootValue === true || isRootValue === 1 || isRootValue === 'true' || String(isRootValue).toLowerCase() === 'true';
    const hasInReplyTo = !!(candidate.target_in_reply_to_tweet_id || candidate.in_reply_to_tweet_id);

    if (!isRoot || hasInReplyTo) {
      return {
        eligible: false,
        reason: EligibilityReason.NOT_ROOT_TWEET,
        reasonDetails: `is_root_tweet=${candidate.is_root_tweet}, has_in_reply_to=${hasInReplyTo}`,
        checkedAt,
      };
    }
  }

  // 5. Check if stale (older than threshold)
  if (candidate.tweet_posted_at) {
    const tweetDate = new Date(candidate.tweet_posted_at);
    const ageHours = (Date.now() - tweetDate.getTime()) / (1000 * 60 * 60);

    if (ageHours > config.REPLY_STALE_THRESHOLD_HOURS) {
      return {
        eligible: false,
        reason: EligibilityReason.STALE_TWEET,
        reasonDetails: `Tweet age: ${ageHours.toFixed(1)}h (threshold: ${config.REPLY_STALE_THRESHOLD_HOURS}h)`,
        checkedAt,
      };
    }
  }

  // All checks passed
  return {
    eligible: true,
    reason: EligibilityReason.ELIGIBLE,
    checkedAt,
  };
}

/**
 * Filter multiple candidates and return eligible ones with reasons
 */
export async function filterEligibleCandidates(
  candidates: ReplyTargetCandidate[],
  options?: {
    checkTargetExists?: boolean;
    requireRootTweet?: boolean;
  }
): Promise<{
  eligible: ReplyTargetCandidate[];
  ineligible: Array<{ candidate: ReplyTargetCandidate; decision: EligibilityDecision }>;
}> {
  const results = await Promise.all(
    candidates.map(async (candidate) => {
      const decision = await checkEligibility(candidate, options);
      return { candidate, decision };
    })
  );

  const eligible: ReplyTargetCandidate[] = [];
  const ineligible: Array<{ candidate: ReplyTargetCandidate; decision: EligibilityDecision }> = [];

  for (const { candidate, decision } of results) {
    if (decision.eligible) {
      eligible.push(candidate);
    } else {
      ineligible.push({ candidate, decision });
    }
  }

  return { eligible, ineligible };
}

/**
 * Store eligibility decision in content_metadata.features for auditability
 */
export async function storeEligibilityDecision(
  candidate: ReplyTargetCandidate,
  decision: EligibilityDecision
): Promise<void> {
  const supabase = getSupabaseClient();

  // Store in reply_opportunities if it exists, otherwise in a dedicated audit table
  // For now, we'll store in content_metadata.features when a reply is created
  // This function is called before reply generation to track eligibility checks

  // If candidate has an id, update reply_opportunities with eligibility metadata
  if (candidate.id) {
    await supabase
      .from('reply_opportunities')
      .update({
        // Store eligibility metadata in a JSONB field if available
        // For now, we'll rely on the status field and features JSONB
      })
      .eq('id', candidate.id);
  }
}
