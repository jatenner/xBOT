/**
 * 📈 GROWTH CONFIGURATION MODULE
 * Phase 6.1: Measurable growth objectives and reply targeting limits
 * 
 * Defines:
 * - Primary/secondary growth metrics
 * - Daily reply attempt limits
 * - Daily post limits
 * - Safe conservative defaults
 */

import { z } from 'zod';

/**
 * Growth objective configuration schema
 */
export const GrowthConfigSchema = z.object({
  // Primary metric (default: followers_per_day)
  PRIMARY_METRIC: z.enum(['followers_per_day', 'profile_visits_per_day', 'engagement_per_impression']).default('followers_per_day'),
  
  // Secondary metrics (for multi-objective optimization)
  SECONDARY_METRICS: z.array(z.enum(['followers_per_day', 'profile_visits_per_day', 'engagement_per_impression'])).default(['profile_visits_per_day', 'engagement_per_impression']),
  
  // Daily limits (conservative defaults)
  MAX_DAILY_REPLY_ATTEMPTS: z.number().int().min(1).default(20),
  MAX_DAILY_POSTS: z.number().int().min(1).default(24),
  
  // Reply targeting parameters
  REPLY_TARGET_MAX_AGE_HOURS: z.number().default(24), // Only reply to tweets <24h old
  REPLY_RECENT_LOOKBACK_DAYS: z.number().default(3), // Don't reply to same account within 3 days
  REPLY_STALE_THRESHOLD_HOURS: z.number().default(24), // Stale tweet threshold
  
  // Scoring weights (for top-K selection)
  SCORING_TOPIC_FIT_WEIGHT: z.number().min(0).max(1).default(0.3),
  SCORING_ENGAGEMENT_VELOCITY_WEIGHT: z.number().min(0).max(1).default(0.3),
  SCORING_AUTHOR_INFLUENCE_WEIGHT: z.number().min(0).max(1).default(0.25),
  SCORING_RECENCY_WEIGHT: z.number().min(0).max(1).default(0.15),
  
  // Top-K selection
  REPLY_TARGET_TOP_K: z.number().int().min(1).default(5), // Select top 5 per cycle
});

export type GrowthConfig = z.infer<typeof GrowthConfigSchema>;

/**
 * Default growth configuration (conservative, safe defaults)
 */
export const DEFAULT_GROWTH_CONFIG: GrowthConfig = {
  PRIMARY_METRIC: 'followers_per_day',
  SECONDARY_METRICS: ['profile_visits_per_day', 'engagement_per_impression'],
  MAX_DAILY_REPLY_ATTEMPTS: 20,
  MAX_DAILY_POSTS: 24,
  REPLY_TARGET_MAX_AGE_HOURS: 24,
  REPLY_RECENT_LOOKBACK_DAYS: 3,
  REPLY_STALE_THRESHOLD_HOURS: 24,
  SCORING_TOPIC_FIT_WEIGHT: 0.3,
  SCORING_ENGAGEMENT_VELOCITY_WEIGHT: 0.3,
  SCORING_AUTHOR_INFLUENCE_WEIGHT: 0.25,
  SCORING_RECENCY_WEIGHT: 0.15,
  REPLY_TARGET_TOP_K: 5,
};

/**
 * Load growth configuration from environment variables with safe defaults
 */
export function loadGrowthConfig(): GrowthConfig {
  const rawConfig = {
    PRIMARY_METRIC: process.env.GROWTH_PRIMARY_METRIC,
    SECONDARY_METRICS: process.env.GROWTH_SECONDARY_METRICS 
      ? process.env.GROWTH_SECONDARY_METRICS.split(',').map(m => m.trim()) as any[]
      : undefined,
    MAX_DAILY_REPLY_ATTEMPTS: process.env.MAX_DAILY_REPLY_ATTEMPTS 
      ? parseInt(process.env.MAX_DAILY_REPLY_ATTEMPTS, 10) 
      : undefined,
    MAX_DAILY_POSTS: process.env.MAX_DAILY_POSTS 
      ? parseInt(process.env.MAX_DAILY_POSTS, 10) 
      : undefined,
    REPLY_TARGET_MAX_AGE_HOURS: process.env.REPLY_TARGET_MAX_AGE_HOURS 
      ? parseFloat(process.env.REPLY_TARGET_MAX_AGE_HOURS) 
      : undefined,
    REPLY_RECENT_LOOKBACK_DAYS: process.env.REPLY_RECENT_LOOKBACK_DAYS 
      ? parseInt(process.env.REPLY_RECENT_LOOKBACK_DAYS, 10) 
      : undefined,
    REPLY_STALE_THRESHOLD_HOURS: process.env.REPLY_STALE_THRESHOLD_HOURS 
      ? parseFloat(process.env.REPLY_STALE_THRESHOLD_HOURS) 
      : undefined,
    SCORING_TOPIC_FIT_WEIGHT: process.env.SCORING_TOPIC_FIT_WEIGHT 
      ? parseFloat(process.env.SCORING_TOPIC_FIT_WEIGHT) 
      : undefined,
    SCORING_ENGAGEMENT_VELOCITY_WEIGHT: process.env.SCORING_ENGAGEMENT_VELOCITY_WEIGHT 
      ? parseFloat(process.env.SCORING_ENGAGEMENT_VELOCITY_WEIGHT) 
      : undefined,
    SCORING_AUTHOR_INFLUENCE_WEIGHT: process.env.SCORING_AUTHOR_INFLUENCE_WEIGHT 
      ? parseFloat(process.env.SCORING_AUTHOR_INFLUENCE_WEIGHT) 
      : undefined,
    SCORING_RECENCY_WEIGHT: process.env.SCORING_RECENCY_WEIGHT 
      ? parseFloat(process.env.SCORING_RECENCY_WEIGHT) 
      : undefined,
    REPLY_TARGET_TOP_K: process.env.REPLY_TARGET_TOP_K 
      ? parseInt(process.env.REPLY_TARGET_TOP_K, 10) 
      : undefined,
  };

  try {
    return GrowthConfigSchema.parse(rawConfig);
  } catch (error) {
    console.warn('[GROWTH_CONFIG] Invalid config, using defaults:', error);
    return DEFAULT_GROWTH_CONFIG;
  }
}

// Global instance
let globalGrowthConfig: GrowthConfig | null = null;

/**
 * Get or load global growth configuration
 */
export function getGrowthConfig(): GrowthConfig {
  if (!globalGrowthConfig) {
    globalGrowthConfig = loadGrowthConfig();
  }
  return globalGrowthConfig;
}
