/**
 * 🎯 CANDIDATE SCORER
 * 
 * Scores and filters candidates with hard filters and composite scoring
 */

import { getSupabaseClient } from '../../db/index';
import { resolveRootTweetId } from '../../utils/resolveRootTweet';
import { judgeTargetSuitability, JudgeDecision } from './targetSuitabilityJudge';

const TOPIC_RELEVANCE_THRESHOLD = 0.6; // Minimum topic relevance score
const SPAM_THRESHOLD = 0.7; // Maximum spam score (higher = more spam)
const MIN_VELOCITY = 0.1; // Minimum likes/replies/rt per minute

const HEALTH_KEYWORDS = [
  'health', 'fitness', 'nutrition', 'wellness', 'exercise', 'diet',
  'supplements', 'cardio', 'strength', 'metabolism', 'creatine',
  'protein', 'ozempic', 'cholesterol', 'zone 2', 'VO2 max', 'sleep'
];

const PARODY_KEYWORDS = ['parody', 'satire', 'joke', 'meme', 'humor'];
const SPAM_PATTERNS = [
  /buy now/i,
  /click here/i,
  /limited time/i,
  /act now/i,
  /\$\$\$/,
  /free money/i,
  /guaranteed/i,
];

export interface CandidateScore {
  is_root_tweet: boolean;
  is_parody: boolean;
  topic_relevance_score: number;
  spam_score: number;
  velocity_score: number;
  recency_score: number;
  author_signal_score: number;
  overall_score: number;
  passed_hard_filters: boolean;
  filter_reason: string;
  predicted_24h_views: number;
  predicted_tier: number;
  judge_decision?: JudgeDecision; // AI judge decision if available
}

/**
 * Score a candidate tweet
 */
export async function scoreCandidate(
  tweetId: string,
  authorUsername: string,
  content: string,
  postedAt: string,
  likeCount: number = 0,
  replyCount: number = 0,
  retweetCount: number = 0,
  feedRunId?: string
): Promise<CandidateScore> {
  console.log(`[SCORER] 🎯 Scoring candidate: ${tweetId} by @${authorUsername}`);
  
  // Hard filters (SAFETY RAILS: Never relaxed)
  const isRoot = await checkIsRootTweet(tweetId);
  const isParody = checkIsParody(content, authorUsername);
  const spamScore = calculateSpamScore(content);
  
  // Hard filter check (absolute filters)
  let passedHardFilters = true;
  const filterReasons: string[] = [];
  
  if (!isRoot) {
    passedHardFilters = false;
    filterReasons.push('not_root_tweet');
  }
  
  if (isParody) {
    passedHardFilters = false;
    filterReasons.push('parody_account');
  }
  
  if (spamScore > SPAM_THRESHOLD) {
    passedHardFilters = false;
    filterReasons.push(`high_spam_score_${spamScore.toFixed(2)}`);
  }
  
  // Check for insufficient text
  if (!content || content.trim().length < 20) {
    passedHardFilters = false;
    filterReasons.push(`insufficient_text_${content?.trim().length || 0}`);
  }
  
  // 🔒 TASK 2: Momentum + Audience Fit filters (before AI judge to save cost)
  const postedTime = new Date(postedAt).getTime();
  const now = Date.now();
  const ageMinutes = (now - postedTime) / (1000 * 60);
  
  // Calculate velocity and reply_rate early
  const likesPerMinute = ageMinutes >= 1 ? likeCount / ageMinutes : likeCount;
  const likesPerHour = likesPerMinute * 60;
  const replyRate = ageMinutes >= 1 ? replyCount / ageMinutes : replyCount;
  const retweetRate = ageMinutes >= 1 ? retweetCount / ageMinutes : retweetCount;
  
  // 🔒 TASK 2: Enhanced momentum signals
  // Velocity = likes per minute (or likes per hour) since posted_at
  // High velocity indicates trending/momentum
  const MIN_LIKES_PER_HOUR = 2; // At least 2 likes/hour indicates some engagement
  const MIN_LIKES_PER_MINUTE = 0.05; // For very recent tweets (< 10 min), require higher rate
  
  // Reject low-velocity tweets (not gaining momentum)
  if (ageMinutes > 30) {
    // For tweets >30 min old, require minimum hourly velocity
    if (likesPerHour < MIN_LIKES_PER_HOUR) {
      passedHardFilters = false;
      filterReasons.push(`rejected_low_velocity_${likesPerHour.toFixed(2)}_likes_per_hour`);
    }
  } else if (ageMinutes > 10) {
    // For tweets 10-30 min old, require minimum per-minute velocity
    if (likesPerMinute < MIN_LIKES_PER_MINUTE) {
      passedHardFilters = false;
      filterReasons.push(`rejected_low_velocity_${likesPerMinute.toFixed(3)}_likes_per_min`);
    }
  }
  // Tweets <10 min old: give them time (no velocity filter)
  
  // 🔒 TASK 2: Reject low-conversation tweets (no replies = no conversation opportunity)
  const MIN_REPLY_RATE = 0.01; // At least 0.01 replies/min (1 reply per 100 min)
  if (ageMinutes > 60 && replyCount === 0 && replyRate < MIN_REPLY_RATE) {
    // Only reject if >1 hour old with 0 replies (personal/low-engagement tweet)
    passedHardFilters = false;
    filterReasons.push(`rejected_low_conversation_${replyRate.toFixed(3)}_replies_per_min`);
  }
  
  // 🔒 TASK 2: Reject low-expected-views tweets (based on current engagement)
  // Estimate 24h views: current_views * (24h / age_hours) * decay_factor
  const ageHours = ageMinutes / 60;
  const estimated24hViews = ageHours > 0 
    ? (likeCount + replyCount + retweetCount) * (24 / ageHours) * 0.3 // Decay factor 0.3
    : (likeCount + replyCount + retweetCount) * 50; // Very new: optimistic multiplier
  
  const MIN_EXPECTED_VIEWS = 500; // Minimum expected 24h views
  if (ageMinutes > 60 && estimated24hViews < MIN_EXPECTED_VIEWS) {
    passedHardFilters = false;
    filterReasons.push(`rejected_low_expected_views_${Math.round(estimated24hViews)}_est_24h`);
  }
  
  // If hard filters fail, return early (before judge call to save cost)
  if (!passedHardFilters) {
    return {
      is_root_tweet: isRoot,
      is_parody: isParody,
      topic_relevance_score: 0,
      spam_score: spamScore,
      velocity_score: 0,
      recency_score: 0,
      author_signal_score: 0,
      overall_score: 0,
      passed_hard_filters: false,
      filter_reason: filterReasons.join(', '),
      predicted_24h_views: 0,
      predicted_tier: 4,
    };
  }
  
  // AI JUDGE: Get intelligent suitability judgment (only if hard filters pass)
  let judgeDecision: JudgeDecision | null = null;
  console.log(`[SCORER] 🎯 Calling AI judge for ${tweetId} (feedRunId: ${feedRunId || 'undefined'})`);
  try {
    judgeDecision = await judgeTargetSuitability(
      tweetId,
      authorUsername,
      content,
      likeCount,
      replyCount,
      retweetCount,
      postedAt,
      { candidate_id: tweetId, feed_run_id: feedRunId }
    );
    console.log(`[SCORER] ✅ Judge decision for ${tweetId}: ${judgeDecision.decision} (relevance=${judgeDecision.relevance.toFixed(2)}, replyability=${judgeDecision.replyability.toFixed(2)})`);
  } catch (error: any) {
    console.error(`[SCORER] ❌ Judge failed for ${tweetId}: ${error.message}`, error.stack);
    // Log to system_events for visibility
    try {
      const supabase = getSupabaseClient();
      await supabase.from('system_events').insert({
        event_type: 'judge_call_failed',
        severity: 'warning',
        message: `Judge failed for ${tweetId}: ${error.message}`,
        event_data: { tweet_id: tweetId, error: error.message, stack: error.stack },
        created_at: new Date().toISOString(),
      });
    } catch (logError) {
      // Ignore logging errors
    }
  }
  
  // Use judge relevance if available, otherwise fall back to heuristic
  const topicRelevance = judgeDecision?.relevance ?? calculateTopicRelevance(content);
  
  // Get current control plane state for adaptive threshold
  const supabase = getSupabaseClient();
  const { data: controlState } = await supabase
    .from('control_plane_state')
    .select('acceptance_threshold')
    .is('expires_at', null)
    .order('effective_at', { ascending: false })
    .limit(1)
    .single();
  
  const adaptiveThreshold = controlState?.acceptance_threshold || TOPIC_RELEVANCE_THRESHOLD;
  console.log(`[SCORER] 📊 Using adaptive threshold: ${adaptiveThreshold.toFixed(2)} (from control plane, default=${TOPIC_RELEVANCE_THRESHOLD})`);
  
  // Apply judge decision or adaptive threshold
  if (judgeDecision) {
    // Use judge decision
    if (judgeDecision.decision === 'reject') {
      passedHardFilters = false;
      filterReasons.push(`judge_reject: ${judgeDecision.reasons}`);
    } else if (judgeDecision.decision === 'explore') {
      // Exploration candidates pass but with lower tier (handled below)
      // Check if relevance still meets minimum threshold (70% of adaptive threshold)
      if (judgeDecision.relevance < adaptiveThreshold * 0.7) {
        passedHardFilters = false;
        filterReasons.push(`judge_explore_relevance_too_low_${judgeDecision.relevance.toFixed(2)}_min_${(adaptiveThreshold * 0.7).toFixed(2)}`);
      }
    }
    // 'accept' => continue
  } else {
    // Fallback to adaptive threshold (heuristic topic relevance)
    if (topicRelevance < adaptiveThreshold) {
      passedHardFilters = false;
      filterReasons.push(`low_topic_relevance_${topicRelevance.toFixed(2)}_threshold_${adaptiveThreshold.toFixed(2)}`);
    }
  }
  
  if (!passedHardFilters) {
    return {
      is_root_tweet: isRoot,
      is_parody: isParody,
      topic_relevance_score: topicRelevance,
      spam_score: spamScore,
      velocity_score: 0,
      recency_score: 0,
      author_signal_score: 0,
      overall_score: 0,
      passed_hard_filters: false,
      filter_reason: filterReasons.join(', '),
      predicted_24h_views: 0,
      predicted_tier: 4,
      judge_decision: judgeDecision || undefined,
    };
  }
  
  // Calculate scores (ageMinutes already calculated above)
  // Use judge scores if available, otherwise calculate heuristically
  const velocityScore = judgeDecision?.momentum ?? calculateVelocityScore(likeCount, replyCount, retweetCount, ageMinutes);
  const recencyScore = calculateRecencyScore(ageMinutes);
  const authorSignalScore = judgeDecision?.audience_fit ?? await calculateAuthorSignalScore(authorUsername);
  
  // 🔒 TASK 2: Improved composite score - prioritize momentum + recency + audience fit
  // Higher weight for velocity (momentum), reply_rate (conversation), and recency (timing matters)
  // Boost score for high reply_rate (indicates active conversation = better for replies)
  const conversationBoost = Math.min(replyRate * 10, 0.15); // Up to +15% boost for high reply_rate
  
  const overallScore = (
    topicRelevance * 0.25 + // Topic relevance (25%)
    (1 - spamScore) * 0.15 + // Anti-spam (15%)
    velocityScore * 0.35 + // Velocity/momentum (35% - highest weight)
    recencyScore * 0.15 + // Recency (15% - timing matters)
    authorSignalScore * 0.10 + // Author signal/audience fit (10%)
    conversationBoost // Conversation boost (up to +15% for high reply_rate)
  ) * 100; // Scale to 0-100
  
  // Predict 24h views (use judge bucket if available)
  let predicted24hViews: number;
  if (judgeDecision?.expected_views_bucket) {
    // Map judge bucket to numeric estimate
    const bucketEstimates: Record<string, number> = {
      'low': 500,
      'medium': 1500,
      'high': 5000,
      'viral': 20000
    };
    predicted24hViews = bucketEstimates[judgeDecision.expected_views_bucket] || predict24hViews(likeCount, replyCount, retweetCount, ageMinutes);
  } else {
    predicted24hViews = predict24hViews(likeCount, replyCount, retweetCount, ageMinutes);
  }
  
  // Determine tier
  let predictedTier = 4; // Block always
  if (predicted24hViews >= 5000) {
    predictedTier = 1; // Tier 1: >=5000 views
  } else if (predicted24hViews >= 1000) {
    predictedTier = 2; // Tier 2: >=1000 views
  } else if (predicted24hViews >= 500) {
    predictedTier = 3; // Tier 3: >=500 views
  }
  
  // If judge says "explore", downgrade tier but still allow
  if (judgeDecision?.decision === 'explore') {
    predictedTier = Math.min(predictedTier + 1, 3); // Downgrade by 1 tier, max tier 3
  }
  
  console.log(`[SCORER] ✅ Scored: ${tweetId} score=${overallScore.toFixed(2)} tier=${predictedTier} predicted_views=${predicted24hViews} judge=${judgeDecision?.decision || 'none'}`);
  
  return {
    is_root_tweet: isRoot,
    is_parody: isParody,
    topic_relevance_score: topicRelevance,
    spam_score: spamScore,
    velocity_score: velocityScore,
    recency_score: recencyScore,
    author_signal_score: authorSignalScore,
    overall_score: overallScore,
    passed_hard_filters: true,
    filter_reason: judgeDecision ? `judge_${judgeDecision.decision}` : 'passed_all_filters',
    predicted_24h_views: predicted24hViews,
    predicted_tier: predictedTier,
    judge_decision: judgeDecision || undefined,
  };
}

/**
 * Check if tweet is root (not a reply)
 * EVIDENCE-BASED: Only mark as not-root if explicit reply signals exist
 */
async function checkIsRootTweet(tweetId: string): Promise<boolean> {
  try {
    const resolution = await resolveRootTweetId(tweetId);
    
    // Evidence-based decision: Only return false if explicit reply signals were found
    // If resolution failed or is uncertain, default to root (fail-open for root check)
    if (resolution.isRootTweet) {
      return true; // Explicitly marked as root
    }
    
    // Check if we have explicit reply signals (not just verification failure)
    // If rootTweetId is null but no reply signals, treat as root
    if (resolution.rootTweetId === null) {
      // This could be verification failure - check logs for explicit reply signals
      // For now, fail-open: assume root unless we have strong evidence it's a reply
      console.log(`[SCORER] ⚠️ Uncertain root status for ${tweetId}, defaulting to root (fail-open)`);
      return true; // Fail-open: assume root unless explicit reply signals
    }
    
    // rootTweetId exists and != tweetId means it's a reply
    return resolution.rootTweetId === tweetId;
  } catch (error: any) {
    console.warn(`[SCORER] ⚠️ Could not resolve root for ${tweetId}: ${error.message}`);
    // Fail-open: assume root on error (opposite of fail-closed)
    return true; // Fail-open: assume root unless we can prove it's a reply
  }
}

/**
 * Check if account/content is parody
 */
function checkIsParody(content: string, username: string): boolean {
  const contentLower = content.toLowerCase();
  const usernameLower = username.toLowerCase();
  
  // Check username
  if (PARODY_KEYWORDS.some(kw => usernameLower.includes(kw))) {
    return true;
  }
  
  // Check content
  if (PARODY_KEYWORDS.some(kw => contentLower.includes(kw))) {
    return true;
  }
  
  return false;
}

/**
 * Calculate topic relevance score (0-1)
 */
export function calculateTopicRelevance(content: string): number {
  // Check for insufficient text first
  if (!content || content.trim().length < 20) {
    return 0; // Insufficient text - will be caught by hard filter
  }
  
  const contentLower = content.toLowerCase();
  let matches = 0;
  
  for (const keyword of HEALTH_KEYWORDS) {
    if (contentLower.includes(keyword.toLowerCase())) {
      matches++;
    }
  }
  
  // Normalize to 0-1 (more matches = higher score)
  return Math.min(matches / HEALTH_KEYWORDS.length * 2, 1.0);
}

/**
 * Calculate spam score (0-1, higher = more spam)
 */
export function calculateSpamScore(content: string): number {
  const contentLower = content.toLowerCase();
  let spamIndicators = 0;
  
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(contentLower)) {
      spamIndicators++;
    }
  }
  
  // Normalize to 0-1
  return Math.min(spamIndicators / SPAM_PATTERNS.length * 2, 1.0);
}

/**
 * Calculate velocity score (0-1) - IMPROVED: Momentum + Audience Fit
 * 
 * Prioritizes:
 * - High velocity (likes per minute/hour)
 * - High reply_rate (replies per minute - indicates conversation)
 * - Recency bonus
 */
export function calculateVelocityScore(
  likes: number,
  replies: number,
  retweets: number,
  ageMinutes: number
): number {
  if (ageMinutes < 1) ageMinutes = 1; // Avoid division by zero
  
  // 🔒 TASK 2: Separate velocity signals
  const likesPerMinute = likes / ageMinutes;
  const likesPerHour = likesPerMinute * 60;
  const replyRate = replies / ageMinutes; // Replies per minute (conversation signal)
  const retweetRate = retweets / ageMinutes;
  
  // Weighted velocity: prioritize likes + reply_rate (conversation)
  // High reply_rate indicates active conversation (better for replies)
  const conversationSignal = replyRate * 2; // 2x weight for replies (conversation)
  const engagementVelocity = likesPerMinute + conversationSignal + retweetRate * 0.5;
  
  // Normalize: velocity > 5 per minute = score 1.0 (lowered threshold for better signal)
  // For very recent tweets (< 5 min), boost score
  const baseScore = Math.min(engagementVelocity / 5, 1.0);
  const recencyBoost = ageMinutes < 5 ? 0.2 : 0; // +20% boost for very recent
  
  return Math.min(baseScore + recencyBoost, 1.0);
}

/**
 * Calculate recency score (0-1, newer = higher)
 */
export function calculateRecencyScore(ageMinutes: number): number {
  // Score decays over 60 minutes
  return Math.max(0, 1 - (ageMinutes / 60));
}

/**
 * Calculate author signal score (0-1) - IMPROVED: Momentum + Audience Fit
 * 
 * Uses:
 * - discovered_accounts.priority_score (if available)
 * - discovered_accounts.performance_tier
 * - Account age / verified status (proxy for authority)
 * - Engagement history
 */
async function calculateAuthorSignalScore(username: string): Promise<number> {
  const supabase = getSupabaseClient();
  
  // Check if in curated accounts (highest priority)
  const { data: curated } = await supabase
    .from('curated_accounts')
    .select('signal_score')
    .eq('username', username)
    .eq('enabled', true)
    .single();
  
  if (curated) {
    return curated.signal_score || 0.5;
  }
  
  // 🔒 TASK 2: Check discovered_accounts for performance signals
  const { data: discovered } = await supabase
    .from('discovered_accounts')
    .select('priority_score, performance_tier, verified, follower_count, avg_followers_per_reply')
    .eq('username', username)
    .single();
  
  if (discovered) {
    // Use priority_score if available (0-1 scale)
    if (discovered.priority_score && discovered.priority_score > 0) {
      return Math.min(discovered.priority_score, 1.0);
    }
    
    // Use performance_tier as proxy
    const tierScores: Record<string, number> = {
      'excellent': 0.9,
      'good': 0.7,
      'moderate': 0.5,
      'poor': 0.3,
    };
    
    if (discovered.performance_tier && tierScores[discovered.performance_tier]) {
      let score = tierScores[discovered.performance_tier];
      
      // Boost for verified accounts
      if (discovered.verified) {
        score = Math.min(score + 0.1, 1.0);
      }
      
      // Boost for high follower count (proxy for authority)
      if (discovered.follower_count && discovered.follower_count > 10000) {
        score = Math.min(score + 0.1, 1.0);
      }
      
      // Boost for high avg_followers_per_reply (proven performance)
      if (discovered.avg_followers_per_reply && discovered.avg_followers_per_reply > 10) {
        score = Math.min(score + 0.1, 1.0);
      }
      
      return Math.min(score, 1.0);
    }
  }
  
  // Default signal score for unknown accounts (lower to prioritize discovered accounts)
  return 0.2;
}

/**
 * Predict 24h views based on current engagement
 */
function predict24hViews(
  likes: number,
  replies: number,
  retweets: number,
  ageMinutes: number
): number {
  if (ageMinutes < 1) ageMinutes = 1;
  
  const totalEngagement = likes + replies + retweets;
  const engagementRate = totalEngagement / ageMinutes;
  
  // Simple heuristic: views ≈ engagement * 10-50 (varies by velocity)
  const multiplier = engagementRate > 1 ? 50 : engagementRate > 0.5 ? 30 : 10;
  const predictedViews = totalEngagement * multiplier;
  
  return Math.round(predictedViews);
}

