/**
 * 📊 v2 OBJECTIVE SCORE CALCULATOR
 * 
 * Calculates followers_gained_weighted and primary_objective_score for v2 learning system
 * 
 * Formula:
 * - followers_gained_weighted = followers_gained * time_window_weight * attribution_confidence
 * - primary_objective_score = (engagement_rate * 0.4) + (normalized_followers_weighted * 0.6)
 */

export interface FollowerAttributionData {
  followers_gained: number;
  followers_before?: number;
  followers_after?: number;
  followers_2h_after?: number;
  followers_24h_after?: number;
  followers_48h_after?: number;
  hours_since_post?: number;
  attribution_confidence?: number; // 0-1, default 0.8
}

export interface EngagementMetrics {
  engagement_rate: number; // 0-1 scale (e.g., 0.05 = 5%)
  impressions?: number;
  likes?: number;
  retweets?: number;
  replies?: number;
}

export interface ObjectiveScoreResult {
  followers_gained_weighted: number;
  primary_objective_score: number;
  attribution_confidence: number;
  time_window_hours: number;
}

/**
 * Calculate weighted follower gain
 * 
 * Weighting factors:
 * 1. Time window: 24h data preferred over 2h, 48h used if 24h unavailable
 * 2. Attribution confidence: Based on time window and data quality
 * 3. Follower quality: Assumed constant for now (can be enhanced later)
 */
export function calculateFollowersGainedWeighted(
  attribution: FollowerAttributionData
): {
  followers_gained_weighted: number;
  attribution_confidence: number;
  time_window_hours: number;
} {
  const {
    followers_gained = 0,
    followers_24h_after,
    followers_48h_after,
    followers_2h_after,
    followers_before,
    hours_since_post,
    attribution_confidence: provided_confidence
  } = attribution;

  // Determine best time window and confidence
  let time_window_hours: number;
  let attribution_confidence: number;

  // Prefer 24h data (most reliable for follower attribution)
  if (followers_24h_after !== undefined && followers_before !== undefined) {
    time_window_hours = 24;
    attribution_confidence = provided_confidence ?? 0.85; // High confidence for 24h window
  }
  // Fall back to 48h if available
  else if (followers_48h_after !== undefined && followers_before !== undefined) {
    time_window_hours = 48;
    attribution_confidence = provided_confidence ?? 0.75; // Slightly lower (more noise over 48h)
  }
  // Use 2h as last resort (less reliable)
  else if (followers_2h_after !== undefined && followers_before !== undefined) {
    time_window_hours = 2;
    attribution_confidence = provided_confidence ?? 0.60; // Lower confidence for 2h
  }
  // If we only have raw followers_gained, use hours_since_post to estimate confidence
  else if (hours_since_post !== undefined) {
    time_window_hours = hours_since_post;
    if (hours_since_post >= 24) {
      attribution_confidence = provided_confidence ?? 0.80;
    } else if (hours_since_post >= 12) {
      attribution_confidence = provided_confidence ?? 0.70;
    } else if (hours_since_post >= 6) {
      attribution_confidence = provided_confidence ?? 0.60;
    } else {
      attribution_confidence = provided_confidence ?? 0.50; // Low confidence for <6h
    }
  }
  // Default: assume 24h window with medium confidence
  else {
    time_window_hours = 24;
    attribution_confidence = provided_confidence ?? 0.70;
  }

  // Calculate weighted follower gain
  // Apply confidence multiplier (0-1 scale)
  const followers_gained_weighted = followers_gained * attribution_confidence;

  return {
    followers_gained_weighted: Math.max(0, followers_gained_weighted),
    attribution_confidence,
    time_window_hours
  };
}

/**
 * Calculate primary objective score (v2 primary metric)
 * 
 * Formula:
 * primary_objective_score = (engagement_rate * 0.4) + (normalized_followers_weighted * 0.6)
 * 
 * Where normalized_followers_weighted is followers_gained_weighted normalized to 0-1 scale
 * Normalization uses a sigmoid function to handle outliers gracefully
 */
export function calculatePrimaryObjectiveScore(
  engagement: EngagementMetrics,
  followers_weighted: number,
  normalization_params?: {
    max_followers?: number; // Expected max followers per post (default: 50)
    sigmoid_steepness?: number; // Steepness of sigmoid (default: 0.1)
  }
): number {
  const {
    engagement_rate = 0,
  } = engagement;

  const {
    max_followers = 50, // Default: expect max 50 followers per post
    sigmoid_steepness = 0.1
  } = normalization_params || {};

  // Normalize engagement_rate (already 0-1 scale, but clamp to ensure)
  const normalized_engagement = Math.max(0, Math.min(1, engagement_rate));

  // Normalize followers_gained_weighted using sigmoid function
  // Sigmoid: 1 / (1 + exp(-k * (x - midpoint)))
  // This maps followers to 0-1 scale, with midpoint at max_followers/2
  const midpoint = max_followers / 2;
  const normalized_followers = 1 / (1 + Math.exp(-sigmoid_steepness * (followers_weighted - midpoint)));

  // Calculate primary objective score
  // Weight: 40% engagement, 60% followers (follower growth is primary goal)
  const primary_objective_score = (normalized_engagement * 0.4) + (normalized_followers * 0.6);

  return Math.max(0, Math.min(1, primary_objective_score));
}

/**
 * Calculate both v2 metrics together
 */
export function calculateV2ObjectiveMetrics(
  attribution: FollowerAttributionData,
  engagement: EngagementMetrics,
  normalization_params?: {
    max_followers?: number;
    sigmoid_steepness?: number;
  }
): ObjectiveScoreResult {
  const { followers_gained_weighted, attribution_confidence, time_window_hours } =
    calculateFollowersGainedWeighted(attribution);

  const primary_objective_score = calculatePrimaryObjectiveScore(
    engagement,
    followers_gained_weighted,
    normalization_params
  );

  return {
    followers_gained_weighted,
    primary_objective_score,
    attribution_confidence,
    time_window_hours
  };
}

/**
 * Extract hook_type, cta_type, structure_type from content metadata
 * These are optional fields for enhanced learning
 */
export function extractContentStructureTypes(content: string, decision_type?: string): {
  hook_type?: string;
  cta_type?: string;
  structure_type?: string;
} {
  const result: {
    hook_type?: string;
    cta_type?: string;
    structure_type?: string;
  } = {};

  // Determine structure_type from decision_type
  if (decision_type) {
    result.structure_type = decision_type; // 'single', 'thread', 'reply'
  }

  // Detect hook_type from content patterns
  const lowerContent = content.toLowerCase().trim();
  
  if (lowerContent.match(/^(what|why|how|when|where|who|which|do|does|did|can|could|should|will|would)\s/i)) {
    result.hook_type = 'question';
  } else if (lowerContent.match(/^\d+[%]|^\d+\s*(studies?|research|people|users?|patients?)/i)) {
    result.hook_type = 'statistic';
  } else if (lowerContent.match(/(actually|truth|myth|lie|wrong|false|don't|doesn't)/i)) {
    result.hook_type = 'controversy';
  } else if (lowerContent.match(/^(i|my|we|our|when i|years ago|story|remember)/i)) {
    result.hook_type = 'story';
  } else if (lowerContent.match(/^(here'?s|this is|let'?s|check out|look at)/i)) {
    result.hook_type = 'reveal';
  }

  // Detect cta_type
  if (lowerContent.match(/(click|link|read more|learn more|check out|visit|go to)/i)) {
    result.cta_type = 'link';
  } else if (lowerContent.match(/(what do you think|thoughts|agree|disagree|comment|reply)/i)) {
    result.cta_type = 'engagement';
  } else if (lowerContent.match(/[?？]$/)) {
    result.cta_type = 'question';
  } else {
    result.cta_type = 'none';
  }

  return result;
}

