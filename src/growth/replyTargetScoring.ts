/**
 * 📊 REPLY TARGET SCORING SYSTEM
 * Phase 6.2: Scores eligible candidates for top-K selection
 * 
 * Scoring components:
 * - Topic fit (embedding similarity)
 * - Engagement velocity (likes/min if available)
 * - Author influence proxy (followers if available; else use engagement)
 * - Recency
 */

import { getGrowthConfig } from '../config/growthConfig';
import { EligibilityReason } from './replyTargetEligibility';
import type { ReplyTargetCandidate } from './replyTargetEligibility';

/**
 * Scoring components breakdown (for auditability)
 */
export interface ScoringComponents {
  topicFit: number; // 0-1, embedding similarity
  engagementVelocity: number; // 0-1, normalized likes/min or engagement rate
  authorInfluence: number; // 0-1, normalized follower count or engagement proxy
  recency: number; // 0-1, fresher = higher
  totalScore: number; // Weighted sum
}

/**
 * Scored candidate with components
 */
export interface ScoredCandidate extends ReplyTargetCandidate {
  score: number;
  scoringComponents: ScoringComponents;
  eligibilityReason: EligibilityReason;
}

/**
 * Calculate topic fit score using embedding similarity
 * For now, returns a placeholder (0.5) - requires embedding infrastructure
 */
function calculateTopicFit(candidate: ReplyTargetCandidate): number {
  // TODO: Implement actual embedding similarity when embeddings are available
  // For now, return a neutral score
  // In production, this would:
  // 1. Get candidate tweet embedding
  // 2. Get our content embeddings
  // 3. Calculate cosine similarity
  // 4. Normalize to 0-1
  
  return 0.5; // Placeholder
}

/**
 * Calculate engagement velocity score
 * Uses likes/min if available, otherwise falls back to engagement rate
 */
function calculateEngagementVelocity(candidate: ReplyTargetCandidate & {
  like_count?: number;
  reply_count?: number;
  retweet_count?: number;
  posted_minutes_ago?: number;
  engagement_rate?: number;
}): number {
  const config = getGrowthConfig();
  
  // If we have posted_minutes_ago and like_count, calculate likes/min
  if (candidate.posted_minutes_ago && candidate.posted_minutes_ago > 0 && candidate.like_count) {
    const likesPerMin = candidate.like_count / candidate.posted_minutes_ago;
    // Normalize: assume max 10 likes/min is excellent (1.0), 0 is 0
    return Math.min(1.0, likesPerMin / 10);
  }
  
  // Fallback to engagement rate if available
  if (candidate.engagement_rate !== undefined) {
    // Normalize: assume 0.05 (5%) is excellent (1.0)
    return Math.min(1.0, candidate.engagement_rate / 0.05);
  }
  
  // If no metrics available, return neutral score
  return 0.3;
}

/**
 * Calculate author influence score
 * Uses follower count if available, otherwise uses engagement as proxy
 */
function calculateAuthorInfluence(candidate: ReplyTargetCandidate & {
  target_followers?: number;
  account_followers?: number;
  like_count?: number;
}): number {
  // Try target_followers first (from reply_opportunities)
  let followers = candidate.target_followers;
  
  // Fallback to account_followers
  if (!followers && candidate.account_followers) {
    followers = candidate.account_followers;
  }
  
  if (followers) {
    // Normalize: assume 1M+ followers is excellent (1.0), 0 is 0
    // Use log scale for better distribution
    const normalized = Math.log10(Math.max(1, followers)) / 6; // log10(1M) = 6
    return Math.min(1.0, normalized);
  }
  
  // Fallback: use engagement as proxy
  if (candidate.like_count) {
    // High engagement suggests influence
    // Normalize: assume 10K+ likes is excellent (1.0)
    const normalized = Math.log10(Math.max(1, candidate.like_count)) / 4; // log10(10K) = 4
    return Math.min(1.0, normalized);
  }
  
  // If no metrics available, return low score
  return 0.2;
}

/**
 * Calculate recency score
 * Fresher tweets score higher
 */
function calculateRecency(candidate: ReplyTargetCandidate): number {
  const config = getGrowthConfig();
  
  if (!candidate.tweet_posted_at) {
    // If no timestamp, assume fresh (from live scraping)
    return 0.9;
  }
  
  const tweetDate = new Date(candidate.tweet_posted_at);
  const ageHours = (Date.now() - tweetDate.getTime()) / (1000 * 60 * 60);
  
  // Score decreases linearly from 1.0 (0h) to 0.0 (max_age_hours)
  const score = Math.max(0, 1.0 - (ageHours / config.REPLY_TARGET_MAX_AGE_HOURS));
  
  return score;
}

/**
 * Score a single candidate
 */
export function scoreCandidate(candidate: ReplyTargetCandidate & {
  like_count?: number;
  reply_count?: number;
  retweet_count?: number;
  posted_minutes_ago?: number;
  engagement_rate?: number;
  target_followers?: number;
  account_followers?: number;
}): ScoringComponents {
  const config = getGrowthConfig();
  
  const topicFit = calculateTopicFit(candidate);
  const engagementVelocity = calculateEngagementVelocity(candidate);
  const authorInfluence = calculateAuthorInfluence(candidate);
  const recency = calculateRecency(candidate);
  
  // Weighted sum
  const totalScore = 
    topicFit * config.SCORING_TOPIC_FIT_WEIGHT +
    engagementVelocity * config.SCORING_ENGAGEMENT_VELOCITY_WEIGHT +
    authorInfluence * config.SCORING_AUTHOR_INFLUENCE_WEIGHT +
    recency * config.SCORING_RECENCY_WEIGHT;
  
  return {
    topicFit,
    engagementVelocity,
    authorInfluence,
    recency,
    totalScore,
  };
}

/**
 * Score multiple candidates and return top-K
 */
export function scoreAndSelectTopK(
  candidates: ReplyTargetCandidate[],
  eligibilityReasons: Map<string, EligibilityReason>
): ScoredCandidate[] {
  const config = getGrowthConfig();
  
  // Score all candidates
  const scored: ScoredCandidate[] = candidates.map(candidate => {
    const components = scoreCandidate(candidate);
    const eligibilityReason = eligibilityReasons.get(candidate.target_tweet_id) || EligibilityReason.ELIGIBLE;
    
    return {
      ...candidate,
      score: components.totalScore,
      scoringComponents: components,
      eligibilityReason,
    };
  });
  
  // Sort by score (descending)
  scored.sort((a, b) => b.score - a.score);
  
  // Return top-K
  return scored.slice(0, config.REPLY_TARGET_TOP_K);
}

/**
 * Store scoring components in content_metadata.features for auditability
 */
export function formatScoringForStorage(scoring: ScoringComponents): Record<string, any> {
  return {
    reply_targeting_score: scoring.totalScore,
    reply_targeting_components: {
      topic_fit: scoring.topicFit,
      engagement_velocity: scoring.engagementVelocity,
      author_influence: scoring.authorInfluence,
      recency: scoring.recency,
    },
    reply_targeting_scored_at: new Date().toISOString(),
  };
}
