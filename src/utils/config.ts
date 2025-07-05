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
 * Core configuration defaults - NUCLEAR MODE WITH SAFETY
 * 
 * REMOVED ALL ARTIFICIAL LIMITS - Let the bot be intelligent!
 * ONLY SAFETY: Maximum 3 posts per hour (72 posts/day max)
 * 
 * Real Twitter API v2 Free Tier Limits:
 * - 300 tweets per 3-hour rolling window
 * - 2400 tweets per 24-hour rolling window
 * - Rate limits are handled by xClient.ts directly
 */

export const defaults = {
  // 🚀 NUCLEAR MODE: Remove all artificial constraints
  // Only real safety limit: 3 posts per hour maximum
  maxPostsPerHour: 3,  // SAFETY NET: Prevent nuclear insanity
  maxPostsPerDay: 72,  // 3/hour * 24 hours = reasonable maximum
  
  // Remove all other artificial limits
  minInterval: 20, // 20 minutes minimum between posts (sensible spacing)
  fallbackStaggerMinutes: 20, // Fallback stagger for safety
  
  // Content quality settings (keep these for quality)
  quality: { 
    readabilityMin: 55, 
    credibilityMin: 0.85 
  },
  
  // Strategy: Let the AI decide everything else
  postingStrategy: "nuclear_intelligence_unleashed",
  
  // Emergency mode: DISABLED (let the bot work!)
  emergencyMode: false,
  disableLearning: false,
  
  // Budget: Reasonable but not restrictive
  dailyBudgetLimit: 25, // Increased from $10 to $25 for more capability
  
  // Startup throttling: REMOVED
  startupThrottling: false,
  
  // Real limits only
  respectOnlyRealTwitterLimits: true
};

/**
 * Safe environment variable getter with fallback
 */
export function getEnv(name: string, fallback: string): string {
  return process.env[name] || fallback;
} 