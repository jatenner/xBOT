import { supabase } from './supabaseClient';

/**
 * Get configuration value from bot_config table
 * @param key Configuration key
 * @param defaultValue Default value if key not found
 * @returns Configuration value or default
 */
export async function getConfigValue<T>(key: string, defaultValue: T): Promise<T> {
  try {
    const { data, error } = await supabase
      .from('bot_config')
      .select('value')
      .eq('key', key)
      .single();

    if (error || !data) {
      console.log(`⚙️ Config ${key} not found, using default: ${defaultValue}`);
      return defaultValue;
    }

    const value = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
    console.log(`⚙️ Config ${key}: ${value}`);
    return value as T;
  } catch (error) {
    console.error(`❌ Failed to get config ${key}:`, error);
    return defaultValue;
  }
}

/**
 * Set configuration value in bot_config table
 * @param key Configuration key
 * @param value Configuration value
 * @returns Success status
 */
export async function setConfigValue(key: string, value: any): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('bot_config')
      .upsert({
        key,
        value: typeof value === 'object' ? value : JSON.stringify(value),
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error(`❌ Failed to set config ${key}:`, error);
      return false;
    }

    console.log(`⚙️ Updated config ${key}: ${value}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to set config ${key}:`, error);
    return false;
  }
}

/**
 * Get all configuration values
 * @returns All config key-value pairs
 */
export async function getAllConfig(): Promise<Record<string, any>> {
  try {
    const { data, error } = await supabase
      .from('bot_config')
      .select('key, value');

    if (error || !data) {
      return {};
    }

    const config: Record<string, any> = {};
    for (const row of data) {
      config[row.key] = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
    }
    
    return config;
  } catch (error) {
    console.error('❌ Failed to get all config:', error);
    return {};
  }
}

/**
 * Core configuration defaults - OPTIMIZED FOR MAXIMUM TWEET OUTPUT
 * 
 * UPDATED: Now uses SmartBudgetOptimizer to maximize tweets within $3 budget
 * Target: 10-15 tweets per day (up from 6) with smart cost allocation
 * 
 * Real Twitter API v2 Free Tier Limits:
 * - 300 tweets per 3-hour rolling window
 * - 2400 tweets per 24-hour rolling window
 * - Rate limits are handled by xClient.ts directly
 */

export const defaults = {
  // 🎯 OPTIMIZED: Higher posting frequency with smart budget management
  maxPostsPerHour: 2,  // Up from 1 - allows 2 posts per hour (24 max per day)
  maxPostsPerDay: 15,  // Up from 6 - target 10-15 tweets with budget optimization
  
  // Reduced intervals for more frequent posting
  minInterval: 30, // 30 minutes minimum between posts (was 20)
  fallbackStaggerMinutes: 30, // 30 minutes for fallback stagger
  
  // Content quality settings (balanced for volume)
  quality: { 
    readabilityMin: 50,    // Slightly lower for volume (was 55)
    credibilityMin: 0.80   // Slightly lower for volume (was 0.85)
  },
  
  // Strategy: Smart budget-aware posting
  postingStrategy: "smart_budget_optimized",
  
  // Emergency mode: DISABLED (let the optimizer work!)
  emergencyMode: false,
  disableLearning: false,
  
  // Budget: Strict cost control with smart allocation
  dailyBudgetLimit: 5, // ENFORCED: $5.00/day maximum with smart optimization
  budgetOptimizationEnabled: true, // New: enable smart budget optimization
  
  // Smart posting settings
  enableSmartBudgetOptimizer: true,
  targetTweetsPerDay: 12, // Optimal target with budget constraints
  minimumTweetsPerDay: 10, // Minimum to avoid ghost account
  
  // Cost optimization
  useFallbackContent: true,
  enableEmergencyContent: true,
  cacheOptimization: true,
  
  // Startup throttling: DISABLED
  startupThrottling: false,
  
  // Real limits only
  respectOnlyRealTwitterLimits: true,
  
  // Budget allocation (new)
  budgetAllocation: {
    contentGeneration: 0.65,  // 65% for tweet content
    engagement: 0.20,         // 20% for engagement analysis
    learning: 0.10,           // 10% for learning systems
    emergency: 0.05           // 5% emergency reserve
  }
};

/**
 * 🎯 GET DYNAMIC POSTING CONFIGURATION
 * Adjusts posting frequency based on budget optimization
 */
export async function getDynamicConfig() {
  try {
    if (!defaults.enableSmartBudgetOptimizer) {
      return defaults;
    }

    // Dynamic import to avoid circular dependencies
    const { smartBudgetOptimizer } = await import('./smartBudgetOptimizer');
    const plan = await smartBudgetOptimizer.createDailyPlan();
    const optimization = smartBudgetOptimizer.getCostOptimization(plan.budgetPerTweet);

    // Adjust posting frequency based on budget plan
    const dynamicConfig = {
      ...defaults,
      maxPostsPerDay: plan.targetTweets,
      targetTweetsPerDay: plan.targetTweets,
      maxPostsPerHour: Math.min(2, Math.ceil(plan.targetTweets / 12)), // Spread over 12 hours
      
      // Adjust quality based on budget per tweet
      quality: {
        readabilityMin: optimization.qualityLevel === 'premium' ? 60 : 
                       optimization.qualityLevel === 'high' ? 55 :
                       optimization.qualityLevel === 'good' ? 50 : 45,
        credibilityMin: optimization.qualityLevel === 'premium' ? 0.90 :
                       optimization.qualityLevel === 'high' ? 0.85 :
                       optimization.qualityLevel === 'good' ? 0.80 : 0.75
      },
      
      // Adjust content generation settings
      contentGeneration: {
        maxTokensPerTweet: optimization.maxTokensPerTweet,
        aiCallsPerTweet: optimization.aiCallsPerTweet,
        qualityLevel: optimization.qualityLevel,
        estimatedCostPerTweet: optimization.estimatedCostPerTweet
      },
      
      // Dynamic intervals based on tweet target
      minInterval: Math.max(20, Math.floor((16 * 60) / plan.targetTweets)), // Spread over 16 active hours
      
      // Aggressiveness settings
      aggressiveMode: plan.aggressivenessLevel === 'maximum' || plan.aggressivenessLevel === 'aggressive',
      conservativeMode: plan.aggressivenessLevel === 'conservative',
      
      // Budget info for agents
      budgetInfo: {
        remainingBudget: plan.remainingBudget,
        budgetPerTweet: plan.budgetPerTweet,
        aggressivenessLevel: plan.aggressivenessLevel,
        recommendations: plan.recommendations
      }
    };

    console.log(`🎯 DYNAMIC CONFIG: ${plan.targetTweets} tweets, $${plan.budgetPerTweet.toFixed(3)}/tweet, ${optimization.qualityLevel} quality`);
    
    return dynamicConfig;

  } catch (error) {
    console.error('❌ Failed to get dynamic config:', error);
    return defaults;
  }
}

/**
 * 📊 GET POSTING FREQUENCY RECOMMENDATION
 */
export async function getPostingFrequencyRecommendation(): Promise<{
  recommendedPostsPerDay: number;
  recommendedInterval: number;
  reasoning: string;
  budgetUtilization: number;
}> {
  try {
    const { smartBudgetOptimizer } = await import('./smartBudgetOptimizer');
    const plan = await smartBudgetOptimizer.createDailyPlan();
    const currentSpending = plan.dailyBudget - plan.remainingBudget;
    const budgetUtilization = currentSpending / plan.dailyBudget;

    let recommendedPostsPerDay = plan.targetTweets;
    let reasoning = '';

    if (budgetUtilization < 0.3 && plan.remainingTweets > 8) {
      recommendedPostsPerDay = Math.min(15, plan.targetTweets + 2);
      reasoning = 'Budget under-utilized - increase posting frequency';
    } else if (budgetUtilization > 0.8 && plan.remainingTweets > 5) {
      recommendedPostsPerDay = Math.max(10, plan.targetTweets - 1);
      reasoning = 'Budget heavily used - maintain sustainable pace';
    } else {
      reasoning = 'Optimal posting frequency for current budget utilization';
    }

    const recommendedInterval = Math.max(30, Math.floor((16 * 60) / recommendedPostsPerDay));

    return {
      recommendedPostsPerDay,
      recommendedInterval,
      reasoning,
      budgetUtilization
    };

  } catch (error) {
    console.error('❌ Failed to get frequency recommendation:', error);
    return {
      recommendedPostsPerDay: 12,
      recommendedInterval: 80,
      reasoning: 'Fallback recommendation due to system error',
      budgetUtilization: 0.5
    };
  }
}

/**
 * Safe environment variable getter with fallback
 */
export function getEnv(name: string, fallback: string): string {
  return process.env[name] || fallback;
} 