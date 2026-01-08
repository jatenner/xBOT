/**
 * 🎯 CANDIDATE SCORER
 * 
 * Scores and filters candidates with hard filters and composite scoring
 */

import { getSupabaseClient } from '../../db/index';
import { resolveRootTweetId } from '../../utils/resolveRootTweet';

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
  retweetCount: number = 0
): Promise<CandidateScore> {
  console.log(`[SCORER] 🎯 Scoring candidate: ${tweetId} by @${authorUsername}`);
  
  // Hard filters
  const isRoot = await checkIsRootTweet(tweetId);
  const isParody = checkIsParody(content, authorUsername);
  const topicRelevance = calculateTopicRelevance(content);
  const spamScore = calculateSpamScore(content);
  
  // Hard filter check
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
  
  // Check for insufficient text (separate from topic relevance)
  if (!content || content.trim().length < 20) {
    passedHardFilters = false;
    filterReasons.push(`insufficient_text_${content?.trim().length || 0}`);
  } else if (topicRelevance < TOPIC_RELEVANCE_THRESHOLD) {
    passedHardFilters = false;
    filterReasons.push(`low_topic_relevance_${topicRelevance.toFixed(2)}`);
  }
  
  if (spamScore > SPAM_THRESHOLD) {
    passedHardFilters = false;
    filterReasons.push(`high_spam_score_${spamScore.toFixed(2)}`);
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
    };
  }
  
  // Calculate scores
  const postedTime = new Date(postedAt).getTime();
  const now = Date.now();
  const ageMinutes = (now - postedTime) / (1000 * 60);
  
  const velocityScore = calculateVelocityScore(likeCount, replyCount, retweetCount, ageMinutes);
  const recencyScore = calculateRecencyScore(ageMinutes);
  const authorSignalScore = await calculateAuthorSignalScore(authorUsername);
  
  // Composite score (weighted)
  const overallScore = (
    topicRelevance * 0.3 +
    (1 - spamScore) * 0.2 + // Invert spam score (lower spam = higher score)
    velocityScore * 0.3 +
    recencyScore * 0.1 +
    authorSignalScore * 0.1
  ) * 100; // Scale to 0-100
  
  // Predict 24h views (simple heuristic)
  const predicted24hViews = predict24hViews(likeCount, replyCount, retweetCount, ageMinutes);
  
  // Determine tier
  let predictedTier = 4; // Block always
  if (predicted24hViews >= 5000) {
    predictedTier = 1; // Tier 1: >=5000 views
  } else if (predicted24hViews >= 1000) {
    predictedTier = 2; // Tier 2: >=1000 views
  } else if (predicted24hViews >= 500) {
    predictedTier = 3; // Tier 3: >=500 views
  }
  
  console.log(`[SCORER] ✅ Scored: ${tweetId} score=${overallScore.toFixed(2)} tier=${predictedTier} predicted_views=${predicted24hViews}`);
  
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
    filter_reason: 'passed_all_filters',
    predicted_24h_views: predicted24hViews,
    predicted_tier: predictedTier,
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
function calculateTopicRelevance(content: string): number {
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
function calculateSpamScore(content: string): number {
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
 * Calculate velocity score (0-1)
 */
function calculateVelocityScore(
  likes: number,
  replies: number,
  retweets: number,
  ageMinutes: number
): number {
  if (ageMinutes < 1) ageMinutes = 1; // Avoid division by zero
  
  const totalEngagement = likes + replies + retweets;
  const velocity = totalEngagement / ageMinutes;
  
  // Normalize: velocity > 10 per minute = score 1.0
  return Math.min(velocity / 10, 1.0);
}

/**
 * Calculate recency score (0-1, newer = higher)
 */
function calculateRecencyScore(ageMinutes: number): number {
  // Score decays over 60 minutes
  return Math.max(0, 1 - (ageMinutes / 60));
}

/**
 * Calculate author signal score (0-1)
 */
async function calculateAuthorSignalScore(username: string): Promise<number> {
  const supabase = getSupabaseClient();
  
  // Check if in curated accounts
  const { data: curated } = await supabase
    .from('curated_accounts')
    .select('signal_score')
    .eq('username', username)
    .eq('enabled', true)
    .single();
  
  if (curated) {
    return curated.signal_score || 0.5;
  }
  
  // Default signal score for unknown accounts
  return 0.3;
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

