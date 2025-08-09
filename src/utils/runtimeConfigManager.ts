/**
 * 🎛️ RUNTIME CONFIG MANAGER
 * Manages bot configuration and posting throttling
 */

import { supabaseClient } from './supabaseClient';

export interface RuntimeConfig {
  daily_post_cap: number;
  min_hours_between_posts: number;
  max_daily_posts: number;
  posting_enabled: boolean;
  engagement_enabled: boolean;
  viral_threshold: number;
  quality_threshold: number;
  learning_mode: boolean;
  growth_phase: 'startup' | 'growth' | 'scaling';
  target_followers: number;
  current_strategy: string;
}

export class RuntimeConfigManager {
  private static instance: RuntimeConfigManager;
  private config: RuntimeConfig | null = null;
  private lastUpdated: Date | null = null;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  static getInstance(): RuntimeConfigManager {
    if (!this.instance) {
      this.instance = new RuntimeConfigManager();
    }
    return this.instance;
  }

  /**
   * 🔧 STATIC HELPER: Set single config value
   * Used by immediateGrowthAccelerator and other agents
   */
  static async set(key: string, value: any): Promise<void> {
    const instance = RuntimeConfigManager.getInstance();
    return instance.updateConfig({ [key]: value } as any);
  }

  /**
   * 🔧 STATIC HELPER: Set multiple config values
   * Used by immediateGrowthAccelerator and other agents
   */
  static async setBulk(updates: Record<string, any>): Promise<void> {
    const instance = RuntimeConfigManager.getInstance();
    return instance.updateConfig(updates as any);
  }

  /**
   * 📥 GET CURRENT CONFIGURATION
   */
  async getConfig(): Promise<RuntimeConfig> {
    // Check if we need to refresh the cache
    if (!this.config || !this.lastUpdated || 
        Date.now() - this.lastUpdated.getTime() > this.CACHE_DURATION) {
      await this.loadConfig();
    }

    return this.config || this.getDefaultConfig();
  }

  /**
   * 🔄 UPDATE CONFIGURATION
   */
  async updateConfig(updates: Partial<RuntimeConfig>): Promise<void> {
    try {
      // Check database health before attempting update
      const { databaseHealthMonitor } = await import('./databaseHealthMonitor');
      const dbStatus = databaseHealthMonitor.getStatus();
      
      if (!dbStatus.supabase.available) {
        console.log('⚠️ Supabase unavailable, skipping config update');
        console.log(`   Error: ${dbStatus.supabase.error}`);
        return; // Skip update to prevent 522 errors
      }

      const currentConfig = await this.getConfig();
      const newConfig = { ...currentConfig, ...updates };

      // Store in database with timeout protection
      const updatePromise = supabaseClient.supabase
        .from('bot_config')
        .upsert({
          key: 'runtime_config',
          value: newConfig,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'key'
        });

      // Add timeout protection to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database update timeout after 10 seconds')), 10000)
      );

      const { error } = await Promise.race([updatePromise, timeoutPromise]);

      if (error) {
        console.error('❌ Failed to update runtime config:', error);
        throw error;
      }

      // Update cache
      this.config = newConfig;
      this.lastUpdated = new Date();

      console.log('✅ Runtime config updated:', updates);
    } catch (error) {
      console.error('❌ Error updating runtime config:', error);
      throw error;
    }
  }

  /**
   * 📊 GET OPTIMIZED CONFIG FOR CURRENT FOLLOWER COUNT
   */
  async getOptimizedConfig(): Promise<RuntimeConfig> {
    const currentFollowers = await this.getCurrentFollowerCount();
    const baseConfig = await this.getConfig();

    // Optimize based on follower count
    if (currentFollowers < 100) {
      // Startup phase: Conservative posting, focus on quality
      return {
        ...baseConfig,
        daily_post_cap: 8,
        min_hours_between_posts: 2,
        max_daily_posts: 8,
        growth_phase: 'startup',
        viral_threshold: 30,
        quality_threshold: 75,
        engagement_enabled: true,
        target_followers: 100
      };
    } else if (currentFollowers < 1000) {
      // Growth phase: Moderate posting, A/B testing
      return {
        ...baseConfig,
        daily_post_cap: 15,
        min_hours_between_posts: 1.5,
        max_daily_posts: 15,
        growth_phase: 'growth',
        viral_threshold: 50,
        quality_threshold: 70,
        engagement_enabled: true,
        target_followers: 1000
      };
    } else {
      // Scaling phase: Higher volume, viral focus
      return {
        ...baseConfig,
        daily_post_cap: 25,
        min_hours_between_posts: 1,
        max_daily_posts: 25,
        growth_phase: 'scaling',
        viral_threshold: 70,
        quality_threshold: 65,
        engagement_enabled: true,
        target_followers: 10000
      };
    }
  }

  /**
   * 📈 APPLY EMERGENCY THROTTLING
   */
  async applyEmergencyThrottling(reason: string): Promise<void> {
    console.log(`🚨 Applying emergency throttling: ${reason}`);
    
    await this.updateConfig({
      daily_post_cap: 3,
      min_hours_between_posts: 4,
      posting_enabled: false,
      current_strategy: `emergency_throttle: ${reason}`
    });
  }

  /**
   * ⚡ APPLY VIRAL BOOST
   */
  async applyViralBoost(reason: string): Promise<void> {
    console.log(`🚀 Applying viral boost: ${reason}`);
    
    await this.updateConfig({
      daily_post_cap: 12,
      min_hours_between_posts: 1,
      viral_threshold: 20,
      posting_enabled: true,
      current_strategy: `viral_boost: ${reason}`
    });
  }

  /**
   * 🔄 LOAD CONFIGURATION FROM DATABASE
   */
  private async loadConfig(): Promise<void> {
    try {
      const { data, error } = await supabaseClient.supabase
        .from('bot_config')
        .select('value')
        .eq('key', 'runtime_config')
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error('❌ Error loading runtime config:', error);
        this.config = this.getDefaultConfig();
        return;
      }

      if (data?.value) {
        this.config = data.value as RuntimeConfig;
      } else {
        // Initialize with default config
        this.config = this.getDefaultConfig();
        await this.updateConfig(this.config);
      }

      this.lastUpdated = new Date();
    } catch (error) {
      console.error('❌ Failed to load runtime config:', error);
      this.config = this.getDefaultConfig();
    }
  }

  /**
   * 🎯 GET DEFAULT CONFIGURATION
   */
  private getDefaultConfig(): RuntimeConfig {
    return {
      daily_post_cap: 8,
      min_hours_between_posts: 2,
      max_daily_posts: 8,
      posting_enabled: true,
      engagement_enabled: true,
      viral_threshold: 30,
      quality_threshold: 75,
      learning_mode: true,
      growth_phase: 'startup',
      target_followers: 100,
      current_strategy: 'quality_first_growth'
    };
  }

  /**
   * 👥 GET CURRENT FOLLOWER COUNT
   */
  private async getCurrentFollowerCount(): Promise<number> {
    try {
      const { data, error } = await supabaseClient.supabase
        .from('follower_attribution')
        .select('follower_count_after')
        .order('measured_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        return 17; // Fallback to known current count
      }

      return data.follower_count_after;
    } catch (error) {
      console.warn('⚠️ Could not get follower count, using fallback');
      return 17;
    }
  }

  /**
   * 📊 GET POSTING STATS FOR TODAY
   */
  async getTodayPostingStats(): Promise<{
    posts_today: number;
    last_post_time: Date | null;
    time_until_next_post: number; // minutes
    can_post_now: boolean;
  }> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: tweets, error } = await supabaseClient.supabase
        .from('tweets')
        .select('created_at')
        .gte('created_at', today.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error getting today posting stats:', error);
        return {
          posts_today: 0,
          last_post_time: null,
          time_until_next_post: 0,
          can_post_now: true
        };
      }

      const config = await this.getConfig();
      const postsToday = tweets?.length || 0;
      const lastPostTime = tweets?.[0] ? new Date(tweets[0].created_at) : null;
      
      let timeUntilNextPost = 0;
      let canPostNow = true;

      if (lastPostTime) {
        const timeSinceLastPost = Date.now() - lastPostTime.getTime();
        const minIntervalMs = config.min_hours_between_posts * 60 * 60 * 1000;
        
        if (timeSinceLastPost < minIntervalMs) {
          timeUntilNextPost = Math.ceil((minIntervalMs - timeSinceLastPost) / (1000 * 60));
          canPostNow = false;
        }
      }

      if (postsToday >= config.daily_post_cap) {
        canPostNow = false;
      }

      return {
        posts_today: postsToday,
        last_post_time: lastPostTime,
        time_until_next_post: timeUntilNextPost,
        can_post_now: canPostNow
      };

    } catch (error) {
      console.error('❌ Error calculating posting stats:', error);
      return {
        posts_today: 0,
        last_post_time: null,
        time_until_next_post: 0,
        can_post_now: false
      };
    }
  }

  /**
   * 🧪 TEST CONFIGURATION SYSTEM
   */
  async testConfig(): Promise<{
    success: boolean;
    config_loaded: boolean;
    database_writable: boolean;
    cache_working: boolean;
  }> {
    try {
      // Test loading config
      await this.loadConfig();
      const configLoaded = this.config !== null;

      // Test updating config
      const testUpdate = { current_strategy: `test_${Date.now()}` };
      await this.updateConfig(testUpdate);
      const databaseWritable = true;

      // Test cache
      const config1 = await this.getConfig();
      const config2 = await this.getConfig();
      const cacheWorking = config1 === config2; // Same object reference = cache working

      return {
        success: true,
        config_loaded: configLoaded,
        database_writable: databaseWritable,
        cache_working: cacheWorking
      };

    } catch (error) {
      console.error('❌ Config test failed:', error);
      return {
        success: false,
        config_loaded: false,
        database_writable: false,
        cache_working: false
      };
    }
  }

  /**
   * 📊 GET PERFORMANCE SUMMARY
   */
  async getPerformanceSummary(): Promise<{
    current_phase: string;
    posts_today: number;
    engagement_rate: number;
    follower_growth_24h: number;
    optimization_recommendations: string[];
  }> {
    const config = await this.getConfig();
    const stats = await this.getTodayPostingStats();
    
    const recommendations: string[] = [];
    
    // Analyze performance and provide recommendations
    if (stats.posts_today === 0) {
      recommendations.push('⚠️ No posts today - system may be throttled');
    } else if (stats.posts_today > config.daily_post_cap * 0.8) {
      recommendations.push('📊 Approaching daily post limit - pace posting');
    }

    if (!config.engagement_enabled) {
      recommendations.push('🔄 Enable engagement for follower growth');
    }

    if (config.viral_threshold > 50) {
      recommendations.push('🎯 Lower viral threshold to increase posting frequency');
    }

    return {
      current_phase: config.growth_phase,
      posts_today: stats.posts_today,
      engagement_rate: 0, // TODO: Calculate from recent analytics
      follower_growth_24h: 0, // TODO: Calculate from follower_attribution
      optimization_recommendations: recommendations
    };
  }
}

// Export singleton instance
export const runtimeConfigManager = RuntimeConfigManager.getInstance();