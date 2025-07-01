/**
 * Runtime configuration from Supabase bot_config table
 */

import { defaults } from './config';
import { supabaseClient } from './supabaseClient';

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
    // Ensure bot_config table has a runtime_config row
    await supabaseClient.supabase
      ?.from('bot_config')
      .upsert({ 
        key: 'runtime_config',
        value: {
          max_daily_tweets: defaults.maxDailyTweets,
          quality_readability_min: defaults.quality.readabilityMin,
          quality_credibility_min: defaults.quality.credibilityMin,
          fallback_stagger_minutes: defaults.fallbackStaggerMinutes,
          posting_strategy: defaults.postingStrategy
        }
      }, { onConflict: 'key' });

    // Fetch configuration
    const { data, error } = await supabaseClient.supabase
      ?.from('bot_config')
      .select('*')
      .eq('key', 'runtime_config')
      .single();

    if (error) {
      console.log('⚠️ Could not fetch bot_config, using defaults:', error.message);
      _runtimeConfig = { ...defaults };
      return _runtimeConfig;
    }

    // Merge database config over defaults
    const configValue = data?.value || {};
    _runtimeConfig = {
      maxDailyTweets: configValue?.max_daily_tweets || configValue?.maxDailyTweets || defaults.maxDailyTweets,
      quality: {
        readabilityMin: configValue?.quality_readability_min || configValue?.quality?.readabilityMin || defaults.quality.readabilityMin,
        credibilityMin: configValue?.quality_credibility_min || configValue?.quality?.credibilityMin || defaults.quality.credibilityMin,
      },
      fallbackStaggerMinutes: configValue?.fallback_stagger_minutes || configValue?.fallbackStaggerMinutes || defaults.fallbackStaggerMinutes,
      postingStrategy: configValue?.posting_strategy || configValue?.postingStrategy || defaults.postingStrategy,
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