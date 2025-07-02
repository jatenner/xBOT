/**
 * Runtime configuration from Supabase bot_config table
 */

import { defaults } from './config';
import { supabaseClient } from './supabaseClient';

export interface RuntimeConfig {
  quality: {
    readabilityMin: number;
    credibilityMin: number;
  };
  fallbackStaggerMinutes: number;
  postingStrategy: string;
}

// Cache for runtime configuration
let _runtimeConfig: RuntimeConfig | null = null;
let _lastConfigFetch = 0;
const CONFIG_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Initialize runtime configuration from Supabase
 */
export async function ensureRuntimeConfig(): Promise<void> {
  const now = Date.now();
  
  if (_runtimeConfig && (now - _lastConfigFetch) < CONFIG_CACHE_DURATION) {
    return; // Use cached config
  }

  try {
    const { data, error } = await supabaseClient.supabase
      ?.from('bot_config')
      .select('*')
      .eq('key', 'runtime_config')
      .single();

    if (error || !data) {
      console.log('⚙️ Creating default runtime configuration...');
      
      const defaultConfig: RuntimeConfig = {
        quality: defaults.quality,
        fallbackStaggerMinutes: defaults.fallbackStaggerMinutes,
        postingStrategy: defaults.postingStrategy
      };

      await supabaseClient.supabase
        ?.from('bot_config')
        .upsert({
          key: 'runtime_config',
          value: defaultConfig,
          description: 'Runtime configuration using real Twitter API limits only'
        });

      _runtimeConfig = defaultConfig;
    } else {
      const configValue = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
      _runtimeConfig = {
        quality: configValue?.quality || defaults.quality,
        fallbackStaggerMinutes: configValue?.fallbackStaggerMinutes || defaults.fallbackStaggerMinutes,
        postingStrategy: configValue?.postingStrategy || defaults.postingStrategy
      };
    }
    
    _lastConfigFetch = now;
    console.log('✅ Runtime configuration loaded');
    
  } catch (error) {
    console.error('❌ Failed to load runtime configuration:', error);
    // Use defaults if database fails
    _runtimeConfig = { ...defaults };
  }
}

/**
 * Get current runtime configuration (must call initializeRuntimeConfig first)
 */
export async function getRuntimeConfig(): Promise<RuntimeConfig> {
  await ensureRuntimeConfig();
  
  if (!_runtimeConfig) {
    console.warn('⚠️ Runtime configuration not available, using defaults');
    return { ...defaults };
  }
  
  return _runtimeConfig;
}

export function clearRuntimeConfigCache(): void {
  _runtimeConfig = null;
  _lastConfigFetch = 0;
  console.log('🔄 Runtime configuration cache cleared');
}

// Export singleton instance
export const runtimeConfig = new Proxy({} as RuntimeConfig, {
  get(target, prop) {
    return getRuntimeConfig()[prop as keyof RuntimeConfig];
  }
}); 