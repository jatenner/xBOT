/**
 * Runtime configuration from Supabase bot_config table
 */

import { defaults } from './config.js';
import { supabaseClient } from './supabaseClient.js';

export interface RuntimeConfig {
  maxDailyTweets: number;
  quality: {
    readabilityMin: number;
    credibilityMin: number;
  };
  fallbackStaggerMinutes: number;
  postingStrategy: string;
}

let _runtimeConfig: RuntimeConfig | null = null;

/**
 * Initialize runtime configuration from Supabase
 */
export async function initializeRuntimeConfig(): Promise<RuntimeConfig> {
  try {
    // Ensure bot_config table has a row
    await supabaseClient.supabase
      ?.from('bot_config')
      .upsert({ id: 1 }, { onConflict: 'id' });

    // Fetch configuration
    const { data, error } = await supabaseClient.supabase
      ?.from('bot_config')
      .select('*')
      .eq('id', 1)
      .single();

    if (error) {
      console.log('⚠️ Could not fetch bot_config, using defaults:', error.message);
      _runtimeConfig = { ...defaults };
      return _runtimeConfig;
    }

    // Merge database config over defaults
    _runtimeConfig = {
      maxDailyTweets: data?.max_daily_tweets ?? defaults.maxDailyTweets,
      quality: {
        readabilityMin: data?.quality_readability_min ?? defaults.quality.readabilityMin,
        credibilityMin: data?.quality_credibility_min ?? defaults.quality.credibilityMin,
      },
      fallbackStaggerMinutes: data?.fallback_stagger_minutes ?? defaults.fallbackStaggerMinutes,
      postingStrategy: data?.posting_strategy ?? defaults.postingStrategy,
    };

    console.log('✅ Runtime config loaded from Supabase:', _runtimeConfig);
    return _runtimeConfig;

  } catch (error) {
    console.log('⚠️ Error initializing runtime config, using defaults:', error);
    _runtimeConfig = { ...defaults };
    return _runtimeConfig;
  }
}

/**
 * Get current runtime configuration (must call initializeRuntimeConfig first)
 */
export function getRuntimeConfig(): RuntimeConfig {
  if (!_runtimeConfig) {
    console.log('⚠️ Runtime config not initialized, using defaults');
    return { ...defaults };
  }
  return _runtimeConfig;
}

// Export singleton instance
export const runtimeConfig = new Proxy({} as RuntimeConfig, {
  get(target, prop) {
    return getRuntimeConfig()[prop as keyof RuntimeConfig];
  }
}); 