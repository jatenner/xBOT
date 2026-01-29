/**
 * 🎯 REWARD COMPUTATION MODULE
 * Phase 6.3B: Compute reward from engagement metrics for strategy learning
 * 
 * Features:
 * - Configurable weights for different engagement types
 * - Impression normalization (sqrt scaling)
 * - Clamped to >=0 (never negative)
 * - Safe defaults if metrics missing
 */

import { getGrowthConfig } from '../config/growthConfig';

/**
 * Engagement metrics input
 */
export interface EngagementMetrics {
  likes?: number;
  replies?: number;
  reposts?: number;
  retweets?: number;
  bookmarks?: number;
  impressions?: number;
  views?: number; // Alias for impressions
  follower_delta_1h?: number; // 🔒 FOLLOWER GROWTH: Follower delta in last 1 hour
  follower_delta_6h?: number; // 🔒 FOLLOWER GROWTH: Follower delta in last 6 hours
  follower_delta_24h?: number; // 🔒 FOLLOWER GROWTH: Follower delta in last 24 hours
  profile_clicks?: number; // 🔒 FOLLOWER GROWTH: Profile clicks (if available)
}

/**
 * Compute reward from engagement metrics
 * 
 * Formula:
 * reward = (likes * w_likes + replies * w_replies + reposts * w_reposts + bookmarks * w_bookmarks)
 * 
 * If impressions > 0:
 * reward /= sqrt(impressions)
 * 
 * Returns >= 0 (clamped)
 */
export function computeReward(metrics: EngagementMetrics): number {
  const config = getGrowthConfig();
  
  // Use views as impressions if impressions not provided
  const impressions = metrics.impressions || metrics.views || 0;
  
  // Get weights from config (with safe defaults)
  const weightLikes = config.REWARD_WEIGHT_LIKES ?? 0.5;
  const weightReplies = config.REWARD_WEIGHT_REPLIES ?? 1.5;
  const weightReposts = config.REWARD_WEIGHT_REPOSTS ?? 2.0;
  const weightRetweets = config.REWARD_WEIGHT_RETWEETS ?? 2.0; // Same as reposts
  const weightBookmarks = config.REWARD_WEIGHT_BOOKMARKS ?? 0.2;
  
  // Compute base reward (default missing metrics to 0)
  const likes = metrics.likes || 0;
  const replies = metrics.replies || 0;
  const reposts = metrics.reposts || metrics.retweets || 0; // Support both names
  const bookmarks = metrics.bookmarks || 0;
  
  let reward = 
    likes * weightLikes +
    replies * weightReplies +
    reposts * weightReposts +
    bookmarks * weightBookmarks;
  
  // 🔒 FOLLOWER GROWTH: Add follower_delta reward (dominant signal)
  // Use 24h delta if available, otherwise 6h, otherwise 1h
  const followerDelta = metrics.follower_delta_24h || metrics.follower_delta_6h || metrics.follower_delta_1h || 0;
  const followerReward = followerDelta * 5.0; // Dominant signal: 5x multiplier
  reward += followerReward;
  
  // Normalize by impressions if available
  if (impressions > 0) {
    reward = reward / Math.sqrt(impressions);
  }
  
  // Clamp to >= 0 (never negative)
  return Math.max(0, reward);
}

/**
 * Format reward for storage in features
 */
export function formatRewardForStorage(reward: number, metrics: EngagementMetrics): Record<string, any> {
  return {
    reward: reward,
    reward_components: {
      likes: metrics.likes || 0,
      replies: metrics.replies || 0,
      reposts: metrics.reposts || metrics.retweets || 0,
      bookmarks: metrics.bookmarks || 0,
      impressions: metrics.impressions || metrics.views || 0,
      follower_delta_1h: metrics.follower_delta_1h || null,
      follower_delta_6h: metrics.follower_delta_6h || null,
      follower_delta_24h: metrics.follower_delta_24h || null,
      profile_clicks: metrics.profile_clicks || null,
    },
    reward_computed_at: new Date().toISOString(),
  };
}
