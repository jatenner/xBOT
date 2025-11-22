/**
 * Adaptive Learning Thresholds
 * 
 * Problem: If all posts have low engagement (e.g., 50 views, 1 like is best),
 * fixed thresholds (100 views, 5 likes) would filter out ALL posts.
 * 
 * Solution: Use adaptive thresholds based on account performance:
 * - If account has decent engagement: Use fixed thresholds (100 views, 5 likes)
 * - If account has low engagement: Use percentile-based thresholds (top 25%)
 * - Always maintain absolute minimum to filter out true noise
 */

export interface AdaptiveThresholds {
  minViews: number;
  minLikes: number;
  method: 'fixed' | 'percentile';
  reason: string;
}

/**
 * Calculate adaptive learning thresholds based on account performance
 * 
 * Strategy:
 * 1. Check account's recent performance (last 30 days)
 * 2. If median < 50 views or median < 1 like → use percentile-based thresholds
 * 3. If account has decent engagement → use fixed thresholds
 * 4. Always maintain absolute minimum (10 views, 1 like) to filter true noise
 */
export async function calculateAdaptiveThresholds(
  outcomes: Array<{ impressions?: number | null; likes?: number | null }>
): Promise<AdaptiveThresholds> {
  
  if (!outcomes || outcomes.length === 0) {
    // Default to fixed thresholds if no data
    return {
      minViews: 100,
      minLikes: 5,
      method: 'fixed',
      reason: 'No data available, using default fixed thresholds'
    };
  }

  // Calculate percentiles for account performance
  const impressions = outcomes
    .map(o => o.impressions || 0)
    .filter(v => v > 0)
    .sort((a, b) => a - b);
  
  const likes = outcomes
    .map(o => o.likes || 0)
    .filter(v => v > 0)
    .sort((a, b) => a - b);

  if (impressions.length === 0 || likes.length === 0) {
    // If no valid data, use very low absolute minimum
    return {
      minViews: 10,  // Absolute minimum to filter true noise
      minLikes: 1,   // Absolute minimum to filter true noise
      method: 'percentile',
      reason: 'Very low engagement account, using absolute minimum thresholds'
    };
  }

  // Calculate percentiles
  const getPercentile = (sorted: number[], percentile: number): number => {
    const index = Math.floor(sorted.length * percentile);
    return sorted[Math.min(index, sorted.length - 1)];
  };

  const medianViews = getPercentile(impressions, 0.5);
  const p75Views = getPercentile(impressions, 0.75);
  const medianLikes = getPercentile(likes, 0.5);
  const p75Likes = getPercentile(likes, 0.75);

  // Determine if account has low engagement
  const hasLowEngagement = medianViews < 50 || medianLikes < 1;
  const hasVeryLowEngagement = medianViews < 25 || medianLikes < 0.5;

  // Strategy: Use percentile-based thresholds for low-engagement accounts
  if (hasVeryLowEngagement) {
    // Account is struggling: Use top 25% OR absolute minimum (whichever is lower)
    // This ensures we learn from best posts even if they're low
    const adaptiveViews = Math.min(Math.max(p75Views, 10), 50);  // Top 25% but cap at 50
    const adaptiveLikes = Math.max(p75Likes, 1);   // At least 1 like
    
    return {
      minViews: adaptiveViews,
      minLikes: adaptiveLikes,
      method: 'percentile',
      reason: `Very low engagement account (median: ${medianViews.toFixed(0)} views, ${medianLikes.toFixed(1)} likes). Using adaptive threshold (${adaptiveViews.toFixed(0)} views, ${adaptiveLikes.toFixed(0)} likes) - learns from top 25% but caps at 50 views`
    };
  }

  if (hasLowEngagement) {
    // Account has some engagement but below fixed thresholds: Use top 25% OR reasonable minimum
    // Cap at 50 views to ensure we learn from best posts even if they're low
    const adaptiveViews = Math.min(Math.max(p75Views, 25), 50);  // Top 25% but cap at 50
    const adaptiveLikes = Math.max(p75Likes, 1);   // At least 1 like
    
    return {
      minViews: adaptiveViews,
      minLikes: adaptiveLikes,
      method: 'percentile',
      reason: `Below-average engagement account (median: ${medianViews.toFixed(0)} views, ${medianLikes.toFixed(1)} likes). Using adaptive threshold (${adaptiveViews.toFixed(0)} views, ${adaptiveLikes.toFixed(0)} likes) - learns from top 25% but caps at 50 views`
    };
  }

  // Account has decent engagement: Use fixed thresholds
  return {
    minViews: 100,
    minLikes: 5,
    method: 'fixed',
    reason: `Normal engagement account (median: ${medianViews.toFixed(0)} views, ${medianLikes.toFixed(1)} likes). Using fixed thresholds (100 views, 5 likes)`
  };
}

/**
 * Check if a post passes the learning threshold
 */
export function passesLearningThreshold(
  impressions: number | null | undefined,
  likes: number | null | undefined,
  thresholds: AdaptiveThresholds
): boolean {
  const views = impressions || 0;
  const likesCount = likes || 0;
  
  return views >= thresholds.minViews && likesCount >= thresholds.minLikes;
}

