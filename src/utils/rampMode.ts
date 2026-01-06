/**
 * 🚀 PRODUCTION RAMP MODE
 * 
 * Safely ramp up posting/reply rates with monitoring
 * 
 * Levels:
 * - Level 1: 1 post/hr, 1 reply/hr (conservative start)
 * - Level 2: 2 posts/hr, 2 replies/hr (moderate)
 * - Level 3: 2 posts/hr, 4 replies/hr (full production)
 */

export interface RampConfig {
  enabled: boolean;
  level: 1 | 2 | 3;
  maxPostsPerHour: number;
  maxRepliesPerHour: number;
}

export function getRampConfig(): RampConfig {
  const rampMode = process.env.RAMP_MODE === 'true';
  const rampLevelRaw = process.env.RAMP_LEVEL;
  
  if (!rampMode) {
    return {
      enabled: false,
      level: 3, // Default to full production when not in ramp mode
      maxPostsPerHour: 0, // Will use normal config
      maxRepliesPerHour: 0, // Will use normal config
    };
  }
  
  // Parse ramp level (default to 1 if invalid)
  let rampLevel: 1 | 2 | 3 = 1;
  if (rampLevelRaw === '2') {
    rampLevel = 2;
  } else if (rampLevelRaw === '3') {
    rampLevel = 3;
  }
  
  // Define quotas per level
  const quotas: Record<1 | 2 | 3, { posts: number; replies: number }> = {
    1: { posts: 1, replies: 1 },  // Conservative start
    2: { posts: 2, replies: 2 },  // Moderate
    3: { posts: 2, replies: 4 },  // Full production
  };
  
  const quota = quotas[rampLevel];
  
  return {
    enabled: true,
    level: rampLevel,
    maxPostsPerHour: quota.posts,
    maxRepliesPerHour: quota.replies,
  };
}

/**
 * Get effective quotas (ramp mode overrides if enabled)
 */
export function getEffectiveQuotas(
  defaultMaxPostsPerHour: number,
  defaultMaxRepliesPerHour: number
): { maxPostsPerHour: number; maxRepliesPerHour: number } {
  const ramp = getRampConfig();
  
  if (ramp.enabled) {
    return {
      maxPostsPerHour: ramp.maxPostsPerHour,
      maxRepliesPerHour: ramp.maxRepliesPerHour,
    };
  }
  
  return {
    maxPostsPerHour: defaultMaxPostsPerHour,
    maxRepliesPerHour: defaultMaxRepliesPerHour,
  };
}

