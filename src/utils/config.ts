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
 * Core configuration defaults and environment utilities
 */

export const defaults = {
  maxDailyTweets: 6,
  quality: { 
    readabilityMin: 55, 
    credibilityMin: 0.85 
  },
  fallbackStaggerMinutes: 90,
  postingStrategy: "balanced"
};

/**
 * Safe environment variable getter with fallback
 */
export function getEnv(name: string, fallback: string): string {
  return process.env[name] || fallback;
} 