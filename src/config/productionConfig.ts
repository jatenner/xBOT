/**
 * 🚀 PRODUCTION CONFIGURATION
 * Centralized configuration for autonomous Twitter growth bot
 * Sets proper budget limits, constraints, and operational parameters
 */

export interface ProductionConfig {
  // Budget Configuration
  budget: {
    dailyLimit: number;
    emergencyLimit: number;
    emergencyOverrideHours: number;
    operationsAllowed: boolean;
  };

  // Posting Configuration  
  posting: {
    maxDailyPosts: number;
    minHoursBetweenPosts: number;
    activeHoursStart: number;
    activeHoursEnd: number;
    emergencyOverrideEnabled: boolean;
  };

  // Engagement Configuration
  engagement: {
    dailyLikes: number;
    dailyReplies: number;
    dailyFollows: number;
    maxActionsPerHour: number;
    targetInfluencers: string[];
  };

  // Growth Targets
  targets: {
    dailyFollowerGrowth: number;
    engagementRate: number;
    viralHitRate: number;
  };

  // Intelligence Configuration
  intelligence: {
    enabled: boolean;
    optimizationLevel: 'conservative' | 'balanced' | 'aggressive';
    learningRate: number;
    dailyOptimizationTime: string;
  };

  // Safety Constraints
  safety: {
    humanLikeBehavior: boolean;
    antiSpamEnabled: boolean;
    ethicalContentOnly: boolean;
    maxConsecutiveActions: number;
  };
}

export const PRODUCTION_CONFIG: ProductionConfig = {
  budget: {
    dailyLimit: 7.50, // Raised to $7.50 as requested
    emergencyLimit: 7.25,
    emergencyOverrideHours: 12,
    operationsAllowed: true
  },

  posting: {
    maxDailyPosts: 17, // Stay within constraint
    minHoursBetweenPosts: 1.5,
    activeHoursStart: 6, // 6 AM
    activeHoursEnd: 23, // 11 PM
    emergencyOverrideEnabled: true
  },

  engagement: {
    dailyLikes: 50,
    dailyReplies: 15,
    dailyFollows: 10,
    maxActionsPerHour: 8,
    targetInfluencers: [
      'hubermanlab',
      'drmarkhyman', 
      'peterattiamd',
      'bengreenfield',
      'drrhondapatrick',
      'theliverfactor',
      'drdavinagha'
    ]
  },

  targets: {
    dailyFollowerGrowth: 15, // 15+ followers per day target
    engagementRate: 0.45, // 45% engagement rate target
    viralHitRate: 0.15 // 15% viral hit rate target
  },

  intelligence: {
    enabled: true,
    optimizationLevel: 'balanced',
    learningRate: 0.15,
    dailyOptimizationTime: '04:00' // 4 AM UTC
  },

  safety: {
    humanLikeBehavior: true,
    antiSpamEnabled: true,
    ethicalContentOnly: true,
    maxConsecutiveActions: 3
  }
};

/**
 * 🔧 ENVIRONMENT VALIDATION
 */
export function validateEnvironment(): {
  valid: boolean;
  missing: string[];
  warnings: string[];
} {
  const required = [
    'OPENAI_API_KEY',
    'TWITTER_API_KEY',
    'TWITTER_API_SECRET', 
    'TWITTER_ACCESS_TOKEN',
    'TWITTER_ACCESS_TOKEN_SECRET',
    'TWITTER_USERNAME',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY'
  ];

  const optional = [
    'TWITTER_BEARER_TOKEN',
    'SUPABASE_ANON_KEY',
    'NEWS_API_KEY',
    'PEXELS_API_KEY'
  ];

  const missing = required.filter(key => !process.env[key]);
  const warnings = optional.filter(key => !process.env[key]);

  return {
    valid: missing.length === 0,
    missing,
    warnings
  };
}

/**
 * 🛡️ BUDGET OVERRIDE CONFIGURATION 
 */
export function getBudgetConfig() {
  return {
    ABSOLUTE_DAILY_LIMIT: PRODUCTION_CONFIG.budget.dailyLimit,
    EMERGENCY_LIMIT: PRODUCTION_CONFIG.budget.emergencyLimit, 
    CRITICAL_OVERRIDE_HOURS: PRODUCTION_CONFIG.budget.emergencyOverrideHours,
    OPERATIONS_ALLOWED: PRODUCTION_CONFIG.budget.operationsAllowed
  };
}

/**
 * 📊 GROWTH METRICS CONFIGURATION
 */
export function getGrowthTargets() {
  return PRODUCTION_CONFIG.targets;
}

/**
 * 🤖 INTELLIGENT SYSTEMS CONFIGURATION
 */
export function getIntelligenceConfig() {
  return PRODUCTION_CONFIG.intelligence;
}

/**
 * 🎯 ENGAGEMENT CONFIGURATION
 */
export function getEngagementConfig() {
  return PRODUCTION_CONFIG.engagement;
}

/**
 * 🛡️ SAFETY CONFIGURATION
 */
export function getSafetyConfig() {
  return PRODUCTION_CONFIG.safety;
} 