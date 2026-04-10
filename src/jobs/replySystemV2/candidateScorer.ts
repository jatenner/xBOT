/**
 * 🎯 CANDIDATE SCORER
 * 
 * Scores and filters candidates with hard filters and composite scoring
 */

import { getSupabaseClient } from '../../db/index';
import { resolveRootTweetId } from '../../utils/resolveRootTweet';
import { judgeTargetSuitability, JudgeDecision } from './targetSuitabilityJudge';
import { getDiscoveryBucketFromOpp, type DiscoveryBucket } from './discoveryBuckets';
import { bucketFilterReasonForFallout } from './denyReasonMapper';

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

/** Map filter_reason to rejection_stage for proof logs (Phase 2). */
function mapFilterReasonToRejectionStage(reason: string): RejectionStage {
  const r = reason.toLowerCase();
  if (r.includes('consent_wall') || r.includes('not_root') || r.includes('parody') || r.includes('spam') || r.includes('insufficient_text')) return 'rejected_before_judge';
  if (r.includes('p1_age_limit') || r.includes('rejected_low_velocity') || r.includes('rejected_low_conversation') || r.includes('rejected_low_expected_views')) return 'rejected_by_freshness';
  if (r.includes('judge_reject') || r.includes('judge_explore') || r.includes('broad_viral_low_health_angle_fit') || r.includes('low_topic_relevance')) return 'rejected_by_judge';
  return 'rejected_before_judge';
}

/** Account size tier from follower count (for upside and proof logs). */
function accountSizeTierFromFollowers(followers: number | null | undefined): string | null {
  if (followers == null || followers <= 0) return null;
  if (followers >= 1e6) return 'mega';
  if (followers >= 100e3) return 'large';
  if (followers >= 10e3) return 'medium';
  if (followers >= 1e3) return 'small';
  return 'tiny';
}

/** Compute 0-100 opportunity upside score and subcomponents (Phase 1). Log subcomponents in proof. */
function computeOpportunityUpsideScore(params: {
  target_followers?: number;
  account_size_tier?: string | null;
  like_count?: number;
  reply_count?: number;
  retweet_count?: number;
  view_count?: number | null;
  post_age_minutes: number;
  discovery_bucket: DiscoveryBucket;
}): { score: number; early_visibility: boolean } {
  const {
    target_followers = 0,
    account_size_tier,
    like_count = 0,
    reply_count = 0,
    retweet_count = 0,
    view_count,
    post_age_minutes,
    discovery_bucket,
  } = params;

  const tier = account_size_tier ?? accountSizeTierFromFollowers(target_followers);
  const tierScore =
    tier === 'mega' ? 1.0 : tier === 'large' ? 0.85 : tier === 'medium' ? 0.65 : tier === 'small' ? 0.4 : 0.2;

  const engagement = like_count + reply_count * 2 + retweet_count;
  const velocity = post_age_minutes >= 1 ? (like_count + reply_count + retweet_count) / post_age_minutes : 0;
  const engagementScore = Math.min(1, Math.log10(engagement + 1) / 3);
  const velocityScore = Math.min(1, velocity / 5);

  // Freshness is DOMINANT — at 0 followers, replying fast matters more than anything else
  // A mediocre reply to a 5-min-old tweet gets 10x more visibility than a perfect reply to a 2-hour-old tweet
  const freshnessScore = post_age_minutes <= 10 ? 1.0 : post_age_minutes <= 20 ? 0.95 : post_age_minutes <= 30 ? 0.85 : post_age_minutes <= 60 ? 0.6 : post_age_minutes <= 120 ? 0.3 : post_age_minutes <= 180 ? 0.1 : 0.0;
  const early_visibility = post_age_minutes <= 60;

  const bucketScore =
    discovery_bucket === 'direct_health' ? 1.0 : discovery_bucket === 'health_adjacent_lifestyle' ? 0.9 : 0.75;

  const viewScore = view_count != null && view_count > 0 ? Math.min(1, Math.log10(view_count + 1) / 5) : 0.5;

  // Freshness at 40% — the most important signal for growth from 0 followers
  const weighted =
    freshnessScore * 0.40 +
    tierScore * 0.20 +
    engagementScore * 0.15 +
    velocityScore * 0.10 +
    bucketScore * 0.10 +
    viewScore * 0.05;
  const score = Math.round(Math.min(100, Math.max(0, weighted * 100)));
  return { score, early_visibility };
}

/** Input opp shape for opportunity upside (optional fields). */
export interface OppUpsideInput {
  features?: Record<string, unknown> | null;
  discovery_source?: string | null;
  target_followers?: number | null;
  like_count?: number | null;
  reply_count?: number | null;
  retweet_count?: number | null;
  view_count?: number | null;
  tweet_posted_at?: string | null;
  account_size_tier?: string | null;
}

export interface CandidateScore {
  is_root_tweet: boolean;
  is_parody: boolean;
  topic_relevance_score: number;
  spam_score: number;
  velocity_score: number;
  recency_score: number;
  author_signal_score: number;
  /** 0-1: How natural a health/performance reply angle is (from judge). */
  health_angle_fit_score: number;
  /** 0-100: Quality of the target opportunity (account size, traction, freshness, bucket). */
  opportunity_upside_score: number;
  /** 0-1: Opportunity alpha sub-score (velocity, recency, author, upside, freshness). */
  opportunity_alpha: number;
  /** 0-1: Response fit sub-score (topic relevance, anti-spam, health angle, conversation). */
  response_fit: number;
  overall_score: number;
  passed_hard_filters: boolean;
  filter_reason: string;
  predicted_24h_views: number;
  predicted_tier: number;
  judge_decision?: JudgeDecision;
  /** Discovery bucket when available (for proof logs). */
  discovery_bucket?: DiscoveryBucket;
}

/** Rejection stage for proof logs (Phase 2). */
export type RejectionStage =
  | 'rejected_before_judge'
  | 'rejected_by_judge'
  | 'rejected_by_freshness'
  | 'rejected_by_tier'
  | 'rejected_by_preflight'
  | 'rejected_by_queue_limits'
  | 'rejected_by_missing_metadata'
  | 'none';

/** Full proof log payload for every candidate (Phase 2). */
export interface CandidateProofLogPayload {
  tweet_id: string;
  target_username: string;
  discovery_bucket: string;
  candidate_age_min: number;
  account_size_tier: string | null;
  target_followers: number | null;
  target_like_count: number | null;
  target_reply_count: number | null;
  target_repost_count: number | null;
  target_view_count: number | null;
  health_angle_fit_score: number | null;
  opportunity_upside_score: number | null;
  passed: boolean;
  rejection_reason: string;
  rejection_stage: RejectionStage;
}

/** Proof log: full candidate payload for supply bottleneck diagnosis. */
function logCandidateProof(payload: CandidateProofLogPayload): void {
  const line =
    `[REPLY_CANDIDATE] tweet_id=${payload.tweet_id} target_username=${payload.target_username} discovery_bucket=${payload.discovery_bucket} ` +
    `candidate_age_min=${payload.candidate_age_min.toFixed(1)} account_size_tier=${payload.account_size_tier ?? 'n/a'} target_followers=${payload.target_followers ?? 'n/a'} ` +
    `target_like_count=${payload.target_like_count ?? 'n/a'} target_reply_count=${payload.target_reply_count ?? 'n/a'} target_repost_count=${payload.target_repost_count ?? 'n/a'} target_view_count=${payload.target_view_count ?? 'n/a'} ` +
    `health_angle_fit_score=${payload.health_angle_fit_score ?? 'n/a'} opportunity_upside_score=${payload.opportunity_upside_score ?? 'n/a'} ` +
    `passed=${payload.passed} rejection_reason=${payload.rejection_reason || 'none'} rejection_stage=${payload.rejection_stage}`;
  console.log(line);
}

/** Legacy proof log: discovery bucket, candidate age, health_angle_fit, rejection reason. */
function logDiscoveryProof(
  tweetId: string,
  discoveryBucket: DiscoveryBucket,
  ageMinutes: number,
  healthAngleFitScore: number | null,
  passed: boolean,
  rejectionReason: string,
  opportunityUpsideScore?: number | null,
  targetUsername?: string,
  targetFollowers?: number | null,
  likeCount?: number,
  replyCount?: number,
  retweetCount?: number,
  accountSizeTier?: string | null,
  rejectionStage?: RejectionStage
): void {
  console.log(
    `[REPLY_DISCOVERY] tweet_id=${tweetId} discovery_bucket=${discoveryBucket} candidate_age_min=${ageMinutes.toFixed(1)} health_angle_fit_score=${healthAngleFitScore ?? 'n/a'} opportunity_upside_score=${opportunityUpsideScore ?? 'n/a'} passed=${passed} rejection_reason=${rejectionReason || 'none'} rejection_stage=${rejectionStage ?? 'none'}`
  );
  logCandidateProof({
    tweet_id: tweetId,
    target_username: targetUsername ?? 'unknown',
    discovery_bucket: discoveryBucket,
    candidate_age_min: ageMinutes,
    account_size_tier: accountSizeTier ?? null,
    target_followers: targetFollowers ?? null,
    target_like_count: likeCount ?? null,
    target_reply_count: replyCount ?? null,
    target_repost_count: retweetCount ?? null,
    target_view_count: null,
    health_angle_fit_score: healthAngleFitScore,
    opportunity_upside_score: opportunityUpsideScore ?? null,
    passed,
    rejection_reason: rejectionReason || 'none',
    rejection_stage: rejectionStage ?? 'none',
  });
}

/**
 * Score a candidate tweet.
 * When targetFollowerCount is provided (e.g. from reply_opportunities.target_followers), author signal uses it for account-scale awareness.
 * When opp is provided, discovery_bucket is derived for proof logs and broad_viral relaxed pre-judge filters.
 */
export async function scoreCandidate(
  tweetId: string,
  authorUsername: string,
  content: string,
  postedAt: string,
  likeCount: number = 0,
  replyCount: number = 0,
  retweetCount: number = 0,
  feedRunId?: string,
  targetFollowerCount?: number,
  opp?: OppUpsideInput | null
): Promise<CandidateScore> {
  const discoveryBucket = getDiscoveryBucketFromOpp(opp);
  const oppLikes = opp?.like_count ?? likeCount;
  const oppReplies = opp?.reply_count ?? replyCount;
  const oppRetweets = opp?.retweet_count ?? retweetCount;
  const oppFollowers = opp?.target_followers ?? targetFollowerCount;
  const postedTime = new Date(postedAt).getTime();
  const ageMinutes = (Date.now() - postedTime) / (1000 * 60);
  const opportunityUpside = computeOpportunityUpsideScore({
    target_followers: oppFollowers ?? undefined,
    account_size_tier: opp?.account_size_tier ?? undefined,
    like_count: oppLikes,
    reply_count: oppReplies,
    retweet_count: oppRetweets,
    view_count: opp?.view_count,
    post_age_minutes: ageMinutes,
    discovery_bucket: discoveryBucket,
  });

  // 🐢 BOOTSTRAP DETECTION: At < 500 followers we need to POST replies to learn.
  // Relaxed filters let more candidates through so the system can gather outcome data.
  let ourFollowers = 0;
  try {
    const { getFollowerCountFromDB } = await import('../../utils/followerCountHelper');
    ourFollowers = await getFollowerCountFromDB();
  } catch { /* fallback to 0 */ }
  const isBootstrap = ourFollowers < 500;

  console.log(`[SCORER] 🎯 Scoring candidate: ${tweetId} by @${authorUsername} bucket=${discoveryBucket} opportunity_upside=${opportunityUpside.score}${oppFollowers != null ? ` (followers=${oppFollowers})` : ''}${isBootstrap ? ' [BOOTSTRAP MODE: relaxed filters]' : ''}`);

  // 🚫 Reject consent-wall placeholder IDs (never real candidates)
  if ((tweetId || '').startsWith('consent_wall_')) {
    logDiscoveryProof(tweetId, discoveryBucket, 0, null, false, 'consent_wall_placeholder', opportunityUpside.score, authorUsername, oppFollowers, oppLikes, oppReplies, oppRetweets, opp?.account_size_tier ?? null, 'rejected_before_judge');
    return {
      is_root_tweet: false,
      is_parody: false,
      topic_relevance_score: 0,
      spam_score: 0,
      velocity_score: 0,
      recency_score: 0,
      author_signal_score: 0,
      health_angle_fit_score: 0,
      opportunity_upside_score: opportunityUpside.score,
      opportunity_alpha: 0,
      response_fit: 0,
      overall_score: 0,
      passed_hard_filters: false,
      filter_reason: 'consent_wall_placeholder',
      predicted_24h_views: 0,
      predicted_tier: 4,
      discovery_bucket: discoveryBucket,
    };
  }

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

  // 🎯 EARLY QUALITY GATE: Skip zero-engagement tweets from tiny accounts before expensive work
  // This prevents wasting browser pool on tweets that will fail velocity filters anyway
  // At bootstrap stage, skip this gate — we need volume to learn
  const totalEngagement = likeCount + replyCount + retweetCount;
  if (!isBootstrap && ageMinutes > 30 && totalEngagement === 0 && (targetFollowerCount === null || targetFollowerCount === undefined || targetFollowerCount < 500)) {
    passedHardFilters = false;
    filterReasons.push(`zero_engagement_tiny_account_${targetFollowerCount || 0}_followers`);
  }
  
  // 🎯 P1 PROVING LANE: Prefer targets most likely to pass preflight
  const p1Mode = process.env.P1_MODE === 'true' || process.env.REPLY_V2_ROOT_ONLY === 'true';
  const p1MaxAgeMinutes = parseInt(process.env.P1_TARGET_MAX_AGE_MINUTES || '60', 10);
  
  // 🔒 TASK 2: Momentum + Audience Fit filters (before AI judge to save cost)
  const now = Date.now();
  
  // P1: Prefer very fresh tweets (< 60 minutes default)
  if (p1Mode && ageMinutes > p1MaxAgeMinutes) {
    passedHardFilters = false;
    filterReasons.push(`p1_age_limit_${ageMinutes.toFixed(1)}min_max_${p1MaxAgeMinutes}min`);
  }
  
  // Calculate velocity and reply_rate early
  const likesPerMinute = ageMinutes >= 1 ? likeCount / ageMinutes : likeCount;
  const likesPerHour = likesPerMinute * 60;
  const replyRate = ageMinutes >= 1 ? replyCount / ageMinutes : replyCount;
  const retweetRate = ageMinutes >= 1 ? retweetCount / ageMinutes : retweetCount;
  
  // 🔒 BROAD_VIRAL: Avoid over-filtering before creative relevance; run judge first for broad_viral_cultural
  const skipPreJudgeVelocityForBroadViral = discoveryBucket === 'broad_viral_cultural';
  
  if (!skipPreJudgeVelocityForBroadViral) {
    if (isBootstrap) {
      // 🐣 BOOTSTRAP: Nearly disable velocity filters. A 3-follower account can't be picky.
      // ANY reply to a health account is better than posting originals nobody sees.
      // We learn from POSTING replies, not from filtering them out.
      // Only reject truly dead tweets (0 engagement after 3+ hours).
      if (ageMinutes > 180 && likeCount === 0 && replyCount === 0 && retweetCount === 0) {
        passedHardFilters = false;
        filterReasons.push(`rejected_dead_tweet_${ageMinutes}min_zero_engagement`);
      }
    } else {
      // Normal mode: full velocity/momentum filters
      const MIN_LIKES_PER_HOUR = 2;
      const MIN_LIKES_PER_MINUTE = 0.05;
      if (ageMinutes > 30) {
        if (likesPerHour < MIN_LIKES_PER_HOUR) {
          passedHardFilters = false;
          filterReasons.push(`rejected_low_velocity_${likesPerHour.toFixed(2)}_likes_per_hour`);
        }
      } else if (ageMinutes > 10) {
        if (likesPerMinute < MIN_LIKES_PER_MINUTE) {
          passedHardFilters = false;
          filterReasons.push(`rejected_low_velocity_${likesPerMinute.toFixed(3)}_likes_per_min`);
        }
      }
      const MIN_REPLY_RATE = 0.01;
      if (ageMinutes > 60 && replyCount === 0 && replyRate < MIN_REPLY_RATE) {
        passedHardFilters = false;
        filterReasons.push(`rejected_low_conversation_${replyRate.toFixed(3)}_replies_per_min`);
      }
      const ageHours = ageMinutes / 60;
      const estimated24hViews = ageHours > 0
        ? (likeCount + replyCount + retweetCount) * (24 / ageHours) * 0.3
        : (likeCount + replyCount + retweetCount) * 50;
      const MIN_EXPECTED_VIEWS = 500;
      if (ageMinutes > 60 && estimated24hViews < MIN_EXPECTED_VIEWS) {
        passedHardFilters = false;
        filterReasons.push(`rejected_low_expected_views_${Math.round(estimated24hViews)}_est_24h`);
      }
    }
  }
  
  // If hard filters fail, return early (before judge call to save cost)
  if (!passedHardFilters) {
    const filterReason = filterReasons.join(', ');
    const rejectionStage = mapFilterReasonToRejectionStage(filterReason);
    const falloutBucket = bucketFilterReasonForFallout(filterReason);
    logDiscoveryProof(tweetId, discoveryBucket, ageMinutes, null, false, filterReason, opportunityUpside.score, authorUsername, oppFollowers, oppLikes, oppReplies, oppRetweets, opp?.account_size_tier ?? accountSizeTierFromFollowers(oppFollowers ?? undefined), rejectionStage);
    console.log(`[REPLY_FALLOUT] reason=${falloutBucket} stage=${rejectionStage} tweet_id=${tweetId} filter_reason=${filterReason.substring(0, 80)}`);
    return {
      is_root_tweet: isRoot,
      is_parody: isParody,
      topic_relevance_score: 0,
      spam_score: spamScore,
      velocity_score: 0,
      recency_score: 0,
      author_signal_score: 0,
      health_angle_fit_score: 0,
      opportunity_upside_score: opportunityUpside.score,
      opportunity_alpha: 0,
      response_fit: 0,
      overall_score: 0,
      passed_hard_filters: false,
      filter_reason: filterReason,
      predicted_24h_views: 0,
      predicted_tier: 4,
      discovery_bucket: discoveryBucket,
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
    // If judge returned fail-safe (relevance=0, replyability=0) due to API error, treat as no judge and use heuristic
    const isJudgeFailSafe =
      judgeDecision.relevance === 0 &&
      judgeDecision.replyability === 0 &&
      (judgeDecision.reasons?.includes('Judge error') || judgeDecision.reasons?.includes('429'));
    if (isJudgeFailSafe && calculateTopicRelevance(content) > 0 && spamScore < SPAM_THRESHOLD) {
      console.warn(`[SCORER] ⚠️ Using heuristic fallback due to judge API failure (relevance=0 replyability=0) for ${tweetId}`);
      judgeDecision = null;
    } else {
      console.log(`[SCORER] ✅ Judge decision for ${tweetId}: ${judgeDecision.decision} (relevance=${judgeDecision.relevance.toFixed(2)}, replyability=${judgeDecision.replyability.toFixed(2)})`);
    }
  } catch (error: any) {
    const msg = error?.message ?? String(error);
    const is429OrTransient = msg.includes('429') || /quota|rate limit|rate_limit/i.test(msg);
    if (is429OrTransient) {
      console.warn(`[SCORER] ⚠️ Judge API failed (429/transient) for ${tweetId} - using heuristic fallback: ${msg}`);
    } else {
      console.error(`[SCORER] ❌ Judge failed for ${tweetId}: ${msg}`, error.stack);
    }
    try {
      const supabase = getSupabaseClient();
      await supabase.from('system_events').insert({
        event_type: 'judge_call_failed',
        severity: 'warning',
        message: `Judge failed for ${tweetId}: ${msg}`,
        event_data: { tweet_id: tweetId, error: msg, stack: error.stack, heuristic_fallback: is429OrTransient },
        created_at: new Date().toISOString(),
      });
    } catch (logError) {
      // Ignore logging errors
    }
  }

  // Heuristic relevance from health keywords (never default to 0 for health discussion)
  const heuristicRelevance = calculateTopicRelevance(content);
  // Brain-recommended candidates bypass the health keyword gate — they're selected
  // by the brain for engagement patterns, not health relevance. The AI judge still
  // evaluates health_angle_fit for reply quality.
  const isBrainRecommended = discoveryBucket === 'brain_recommended' as any;
  const BRAIN_TOPIC_FLOOR = 0.55; // Brain candidates get a relevance floor above the gate
  // Blend: use judge relevance but floor so health/keyword-feed tweets are treated as potentially relevant
  const HEALTH_TOPIC_FLOOR = 0.45; // Min relevance when content has any health keyword (downstream gate is 0.45)
  const topicRelevance = judgeDecision
    ? Math.max(
        Number(judgeDecision.relevance),
        heuristicRelevance,
        heuristicRelevance > 0 ? HEALTH_TOPIC_FLOOR : 0,
        isBrainRecommended ? BRAIN_TOPIC_FLOOR : 0
      )
    : isBrainRecommended
      ? Math.max(heuristicRelevance, BRAIN_TOPIC_FLOOR)
      : heuristicRelevance;

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

  const healthAngleFitScore = judgeDecision?.health_angle_fit ?? (heuristicRelevance > 0 ? 0.6 : 0.4);
  
  // 🔒 BROAD_VIRAL: Require minimum health_angle_fit so we don't force replies
  if (discoveryBucket === 'broad_viral_cultural' && healthAngleFitScore < 0.5) {
    passedHardFilters = false;
    filterReasons.push(`broad_viral_low_health_angle_fit_${healthAngleFitScore.toFixed(2)}_min_0.5`);
  }
  
  // Apply judge decision or adaptive threshold (safety: spam_risk unchanged)
  if (judgeDecision) {
    const spamRisk = judgeDecision.spam_risk ?? 0.3; // Default to low risk (0.3) — old 0.5 default blocked valid health overrides
    const isHealthRelevant = heuristicRelevance > 0 && topicRelevance >= adaptiveThreshold * 0.7;
    // Freshness boost: very fresh tweets (<15 min) with strong health angle get borderline acceptance
    const isFreshHighQuality = ageMinutes < 15 && healthAngleFitScore >= 0.7 && (judgeDecision.replyability ?? 0) >= 0.5;
    if (judgeDecision.decision === 'reject') {
      if (isHealthRelevant && spamRisk < 0.5) {
        console.log(`[SCORER] 📈 Override judge reject: health-relevant (heuristic=${heuristicRelevance.toFixed(2)}, topic=${topicRelevance.toFixed(2)}) spam_risk=${spamRisk.toFixed(2)}`);
      } else if (isFreshHighQuality && spamRisk < 0.4) {
        console.log(`[SCORER] 📈 Override judge reject: fresh+quality (age=${ageMinutes.toFixed(0)}min, health_fit=${healthAngleFitScore.toFixed(2)}, replyability=${(judgeDecision.replyability ?? 0).toFixed(2)}) spam_risk=${spamRisk.toFixed(2)}`);
      } else {
        passedHardFilters = false;
        filterReasons.push(`judge_reject: ${judgeDecision.reasons}`);
      }
    } else if (judgeDecision.decision === 'explore') {
      if (topicRelevance < adaptiveThreshold * 0.7) {
        passedHardFilters = false;
        filterReasons.push(`judge_explore_relevance_too_low_${topicRelevance.toFixed(2)}_min_${(adaptiveThreshold * 0.7).toFixed(2)}`);
      }
    }
  } else {
    // Fallback to adaptive threshold (heuristic topic relevance)
    if (topicRelevance < adaptiveThreshold) {
      passedHardFilters = false;
      filterReasons.push(`low_topic_relevance_${topicRelevance.toFixed(2)}_threshold_${adaptiveThreshold.toFixed(2)}`);
    }
  }
  
  if (!passedHardFilters) {
    const filterReason = filterReasons.join(', ');
    const rejectionStage = mapFilterReasonToRejectionStage(filterReason);
    logDiscoveryProof(tweetId, discoveryBucket, ageMinutes, healthAngleFitScore, false, filterReason, opportunityUpside.score, authorUsername, oppFollowers, oppLikes, oppReplies, oppRetweets, opp?.account_size_tier ?? accountSizeTierFromFollowers(oppFollowers ?? undefined), rejectionStage);
    return {
      is_root_tweet: isRoot,
      is_parody: isParody,
      topic_relevance_score: topicRelevance,
      spam_score: spamScore,
      velocity_score: 0,
      recency_score: 0,
      author_signal_score: 0,
      health_angle_fit_score: healthAngleFitScore,
      opportunity_upside_score: opportunityUpside.score,
      opportunity_alpha: 0,
      response_fit: 0,
      overall_score: 0,
      passed_hard_filters: false,
      filter_reason: filterReason,
      predicted_24h_views: 0,
      predicted_tier: 4,
      judge_decision: judgeDecision || undefined,
      discovery_bucket: discoveryBucket,
    };
  }
  
  // Calculate scores (ageMinutes already calculated above)
  // Use judge scores if available, otherwise calculate heuristically
  const velocityScore = judgeDecision?.momentum ?? calculateVelocityScore(likeCount, replyCount, retweetCount, ageMinutes);
  const recencyScore = calculateRecencyScore(ageMinutes);
  const authorSignalScore = judgeDecision?.audience_fit ?? await calculateAuthorSignalScore(authorUsername, targetFollowerCount);
  
  // Composite score split into two sub-scores for transparency
  const conversationBoost = Math.min(replyRate * 10, 0.15);
  const opportunityUpsideNorm = opportunityUpside.score / 100;
  const freshnessNorm = recencyScore; // recency already captures time-based freshness

  // Opportunity Alpha: how good is the opportunity itself?
  const opportunityAlpha =
    velocityScore * 0.35 +
    recencyScore * 0.15 +
    authorSignalScore * 0.15 +
    opportunityUpsideNorm * 0.15 +
    freshnessNorm * 0.20;

  // Response Fit: how well can we respond to it?
  const responseFit =
    topicRelevance * 0.35 +
    (1 - spamScore) * 0.20 +
    healthAngleFitScore * 0.25 +
    conversationBoost / 0.15 * 0.20; // normalize conversationBoost (max 0.15) to 0-1 range

  let overallScore = (opportunityAlpha * 0.5 + responseFit * 0.5) * 100;

  // Behavioral targeting boost: if we have data on optimal target sizes,
  // boost candidates that match the proven-optimal ratio
  try {
    const { getTickAdvice } = await import('../../intelligence/tickAdvisor');
    const tickAdvice = await getTickAdvice();
    const optimalRange = tickAdvice?.reply_preferences?.optimal_target_follower_range;

    if (optimalRange && oppFollowers && oppFollowers > 0) {
      // Get our follower count for ratio computation
      const { data: selfModel } = await getSupabaseClient()
        .from('self_model_state')
        .select('follower_count')
        .eq('id', 1)
        .single();

      const ourFollowers = selfModel?.follower_count ?? 1;
      const ratio = oppFollowers / Math.max(ourFollowers, 1);

      // If target is within the optimal ratio range, boost by up to 10%
      if (ratio >= optimalRange[0] && ratio <= optimalRange[1]) {
        overallScore *= 1.10; // 10% boost for behavioral-optimal targets
      }
    }
  } catch {
    // Behavioral boost is non-fatal
  }

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
  
  logDiscoveryProof(tweetId, discoveryBucket, ageMinutes, healthAngleFitScore, true, 'none', opportunityUpside.score, authorUsername, oppFollowers, oppLikes, oppReplies, oppRetweets, opp?.account_size_tier ?? accountSizeTierFromFollowers(oppFollowers ?? undefined), 'none');
  console.log(`[SCORER] ✅ Scored: ${tweetId} score=${overallScore.toFixed(2)} opp_alpha=${opportunityAlpha.toFixed(3)} resp_fit=${responseFit.toFixed(3)} tier=${predictedTier} health_angle_fit=${healthAngleFitScore.toFixed(2)} opportunity_upside=${opportunityUpside.score} judge=${judgeDecision?.decision || 'none'}`);
  
  return {
    is_root_tweet: isRoot,
    is_parody: isParody,
    topic_relevance_score: topicRelevance,
    spam_score: spamScore,
    velocity_score: velocityScore,
    recency_score: recencyScore,
    author_signal_score: authorSignalScore,
    health_angle_fit_score: healthAngleFitScore,
    opportunity_upside_score: opportunityUpside.score,
    opportunity_alpha: opportunityAlpha,
    response_fit: responseFit,
    overall_score: overallScore,
    passed_hard_filters: true,
    filter_reason: judgeDecision ? `judge_${judgeDecision.decision}` : 'passed_all_filters',
    predicted_24h_views: predicted24hViews,
    predicted_tier: predictedTier,
    judge_decision: judgeDecision || undefined,
    discovery_bucket: discoveryBucket,
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
 * Health/metabolism/fitness tweets from keyword feeds should score as potentially relevant (not 0).
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

  if (matches === 0) return 0;
  // 1 match = 0.35, 2 = 0.5, 3+ = 0.6+ so general health discussion passes gate (0.45)
  return Math.min(0.35 + (matches - 1) * 0.15, 1.0);
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
 * Map follower count to 0-1 author signal (account-scale awareness).
 * Log-like scale: tiny→low, small→0.3, medium→0.5, large→0.7, mega→0.9.
 */
function authorSignalFromFollowerCount(count: number): number {
  if (count <= 0) return 0.2;
  if (count >= 1e6) return 0.9;
  if (count >= 100e3) return 0.75;
  if (count >= 10e3) return 0.55;
  if (count >= 1e3) return 0.35;
  return 0.25; // tiny / unknown
}

/**
 * Calculate author signal score (0-1) - IMPROVED: Momentum + Audience Fit + account metadata
 *
 * When targetFollowerCount is provided (from reply_opportunities.target_followers), use it for account-scale signal.
 * Otherwise uses discovered_accounts / curated_accounts lookups.
 */
async function calculateAuthorSignalScore(username: string, targetFollowerCount?: number): Promise<number> {
  // Account metadata from discovery: use when available so scoring reflects tiny vs mid vs huge accounts
  if (targetFollowerCount != null && targetFollowerCount >= 0) {
    const fromCount = authorSignalFromFollowerCount(targetFollowerCount);
    const supabase = getSupabaseClient();
    const { data: curated } = await supabase
      .from('curated_accounts')
      .select('signal_score')
      .eq('username', username)
      .eq('enabled', true)
      .single();
    if (curated?.signal_score != null) {
      return Math.min(Math.max(curated.signal_score, 0, 1), 1.0);
    }
    const { data: discovered } = await supabase
      .from('discovered_accounts')
      .select('priority_score, performance_tier, conversion_rate, followers_gained_from_account')
      .eq('username', username)
      .single();
    if (discovered?.priority_score != null && discovered.priority_score > 0) {
      let score = Math.min(Math.max(discovered.priority_score, 0, 1), 1.0);
      // Boost accounts that historically convert replies to followers
      if (discovered.conversion_rate && discovered.conversion_rate > 0) {
        const conversionBoost = Math.min(0.2, discovered.conversion_rate * 0.5);
        score = Math.min(1.0, score + conversionBoost);
      }
      return score;
    }
    return fromCount;
  }

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

