/**
 * 🎯 RUNTIME CONFIG MANAGER
 * 
 * Manages dynamic configuration values stored in the database for adaptive posting optimization.
 * Works with the adaptive posting system to allow AI-driven parameter tuning.
 */

import { supabaseClient } from './supabaseClient';

export interface RuntimeConfigValue {
  key: string;
  value: any;
  updated_at: string;
}

export class RuntimeConfigManager {
  private static cache: Map<string, { value: any; expires: number }> = new Map();
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Get a runtime configuration value
   */
  static async get(key: string, defaultValue?: any): Promise<any> {
    try {
      // Check cache first
      const cached = this.cache.get(key);
      if (cached && Date.now() < cached.expires) {
        return cached.value;
      }

      // Query database
      const { data, error } = await supabaseClient.supabase
        .from('bot_config')
        .select('value')
        .eq('key', key)
        .single();

      if (error || !data) {
        console.warn(`Runtime config key "${key}" not found, using default:`, defaultValue);
        return defaultValue;
      }

      // Parse JSON value
      let parsedValue;
      try {
        parsedValue = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
      } catch {
        parsedValue = data.value;
      }

      // Cache the value
      this.cache.set(key, {
        value: parsedValue,
        expires: Date.now() + this.CACHE_TTL
      });

      return parsedValue;
    } catch (error) {
      console.error(`Error getting runtime config "${key}":`, error);
      return defaultValue;
    }
  }

  /**
   * Set a runtime configuration value
   */
  static async set(key: string, value: any): Promise<boolean> {
    try {
      const jsonValue = typeof value === 'string' ? value : JSON.stringify(value);

      const { error } = await supabaseClient.supabase
        .from('bot_config')
        .upsert({
          key,
          value: jsonValue,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'key'
        });

      if (error) {
        console.error(`Error setting runtime config "${key}":`, error);
        return false;
      }

      // Update cache
      this.cache.set(key, {
        value,
        expires: Date.now() + this.CACHE_TTL
      });

      console.log(`✅ Runtime config updated: ${key} = ${JSON.stringify(value)}`);
      return true;
    } catch (error) {
      console.error(`Error setting runtime config "${key}":`, error);
      return false;
    }
  }

  /**
   * Get current daily posting limit (AI-optimized)
   */
  static async getDailyPostingLimit(): Promise<number> {
    const limit = await this.get('daily_post_cap', 15);
    return parseInt(limit);
  }

  /**
   * Get multiple config values at once
   */
  static async getMultiple(keys: string[]): Promise<Record<string, any>> {
    try {
      const { data, error } = await supabaseClient.supabase
        .from('bot_config')
        .select('key, value')
        .in('key', keys);

      if (error) {
        console.error('Error getting multiple runtime configs:', error);
        return {};
      }

      const result: Record<string, any> = {};
      data?.forEach(row => {
        try {
          result[row.key] = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
        } catch {
          result[row.key] = row.value;
        }
      });

      return result;
    } catch (error) {
      console.error('Error getting multiple runtime configs:', error);
      return {};
    }
  }

  /**
   * Clear the cache (force fresh reads)
   */
  static clearCache(): void {
    this.cache.clear();
    console.log('🗑️ Runtime config cache cleared');
  }

  /**
   * Get all configuration values
   */
  static async getAll(): Promise<Record<string, any>> {
    try {
      const { data, error } = await supabaseClient.supabase
        .from('bot_config')
        .select('key, value, updated_at')
        .order('key');

      if (error) {
        console.error('Error getting all runtime configs:', error);
        return {};
      }

      const result: Record<string, any> = {};
      data?.forEach(row => {
        try {
          result[row.key] = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
        } catch {
          result[row.key] = row.value;
        }
      });

      return result;
    } catch (error) {
      console.error('Error getting all runtime configs:', error);
      return {};
    }
  }
}

/**
 * 🎯 UPDATE DAILY POSTING LIMIT (AI Optimization Function)
 * Called by the DailyOptimizationLoop to set the new posting frequency
 */
export async function updateDailyLimit(
  newLimit: number, 
  reasoning: string = 'AI optimization'
): Promise<boolean> {
  try {
    console.log(`🎯 Updating daily posting limit: ${newLimit} (${reasoning})`);

    // Validate range
    if (newLimit < 5 || newLimit > 100) {
      console.error(`❌ Invalid daily limit: ${newLimit}. Must be 5-100.`);
      return false;
    }

    // Call the database function
    const { data, error } = await supabaseClient.supabase
      .rpc('update_daily_posting_limit', {
        new_limit: newLimit,
        reasoning: reasoning
      });

    if (error) {
      console.error('❌ Error calling update_daily_posting_limit function:', error);
      return false;
    }

    if (data === true) {
      // Clear cache to force fresh read
      RuntimeConfigManager.clearCache();
      console.log(`✅ Daily posting limit updated to ${newLimit}`);
      return true;
    } else {
      console.error('❌ Database function returned false');
      return false;
    }
  } catch (error) {
    console.error('❌ Error updating daily posting limit:', error);
    return false;
  }
}

/**
 * 🎯 GET CURRENT DAILY POSTING LIMIT
 * Returns the AI-optimized daily posting limit
 */
export async function getCurrentDailyLimit(): Promise<number> {
  try {
    const { data, error } = await supabaseClient.supabase
      .rpc('get_daily_posting_limit');

    if (error) {
      console.error('❌ Error getting daily posting limit:', error);
      return 15; // Fallback
    }

    return data || 15;
  } catch (error) {
    console.error('❌ Error getting daily posting limit:', error);
    return 15; // Fallback
  }
}

/**
 * 🎯 UPDATE SLOT PERFORMANCE
 * Records performance data for a specific posting time slot
 */
export async function updateSlotPerformance(
  slotHour: number,
  dayOfWeek: number,
  engagement: number,
  cost: number = 0
): Promise<void> {
  try {
    const { error } = await supabaseClient.supabase
      .rpc('update_slot_performance', {
        p_slot_hour: slotHour,
        p_day_of_week: dayOfWeek,
        p_engagement: engagement,
        p_cost: cost
      });

    if (error) {
      console.error('❌ Error updating slot performance:', error);
    } else {
      console.log(`📊 Slot performance updated: ${slotHour}:00 on day ${dayOfWeek}`);
    }
  } catch (error) {
    console.error('❌ Error updating slot performance:', error);
  }
}

/**
 * 🎯 REFRESH SLOT ROI VIEW
 * Refreshes the materialized view for slot performance analysis
 */
export async function refreshSlotROIView(): Promise<void> {
  try {
    const { error } = await supabaseClient.supabase
      .rpc('refresh_slot_roi_view');

    if (error) {
      console.error('❌ Error refreshing slot ROI view:', error);
    } else {
      console.log('📊 Slot ROI view refreshed');
    }
  } catch (error) {
    console.error('❌ Error refreshing slot ROI view:', error);
  }
}