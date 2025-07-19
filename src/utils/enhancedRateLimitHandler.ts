import { createClient } from '@supabase/supabase-js';

interface RateLimitStatus {
  dailyRemaining: number;
  dailyLimit: number;
  resetTime: number;
  canPost: boolean;
  nextAvailableTime?: Date;
  gracefulMode: boolean;
}

export class EnhancedRateLimitHandler {
  private supabase: any;
  private lastStatusCheck: number = 0;
  private cachedStatus: RateLimitStatus | null = null;
  private readonly CACHE_DURATION = 60000; // 1 minute cache

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!
    );
  }

  /**
   * Check current rate limit status with intelligent caching
   */
  async checkRateLimitStatus(): Promise<RateLimitStatus> {
    const now = Date.now();
    
    // Return cached status if recent
    if (this.cachedStatus && (now - this.lastStatusCheck) < this.CACHE_DURATION) {
      return this.cachedStatus;
    }

    try {
      // Get from database
      const { data: config } = await this.supabase
        .from('bot_config')
        .select('*')
        .in('key', [
          'daily_tweets_remaining',
          'daily_tweets_limit',
          'rate_limit_reset_time',
          'graceful_mode'
        ]);

      const configMap = new Map(config?.map((item: any) => [item.key, item.value]) || []);
      
      const dailyRemaining = parseInt(String(configMap.get('daily_tweets_remaining') || '0'));
      const dailyLimit = parseInt(String(configMap.get('daily_tweets_limit') || '17'));
      const resetTime = parseInt(String(configMap.get('rate_limit_reset_time') || '0'));
      const gracefulMode = String(configMap.get('graceful_mode') || 'false') === 'true';

      const status: RateLimitStatus = {
        dailyRemaining,
        dailyLimit,
        resetTime,
        canPost: dailyRemaining > 0,
        gracefulMode,
        nextAvailableTime: dailyRemaining === 0 ? new Date(resetTime * 1000) : undefined
      };

      this.cachedStatus = status;
      this.lastStatusCheck = now;
      
      return status;
    } catch (error) {
      console.error('❌ Error checking rate limit status:', error);
      
      // Return conservative default
      return {
        dailyRemaining: 0,
        dailyLimit: 17,
        resetTime: Math.floor(Date.now() / 1000) + 86400, // 24 hours from now
        canPost: false,
        gracefulMode: true,
        nextAvailableTime: new Date(Date.now() + 86400000)
      };
    }
  }

  /**
   * Enable graceful mode when rate limits are hit
   */
  async enableGracefulMode(resetTime: number): Promise<void> {
    try {
      console.log('🛡️ Enabling graceful mode until rate limit reset...');
      
      const updates = [
        { key: 'graceful_mode', value: 'true' },
        { key: 'rate_limit_reset_time', value: resetTime.toString() },
        { key: 'graceful_mode_reason', value: 'Twitter daily limit reached' },
        { key: 'graceful_mode_enabled_at', value: new Date().toISOString() }
      ];

      for (const update of updates) {
        await this.supabase
          .from('bot_config')
          .upsert(update, { onConflict: 'key' });
      }

      // Clear cache to force refresh
      this.cachedStatus = null;
      
      console.log('✅ Graceful mode enabled successfully');
      console.log(`⏰ Will resume posting at: ${new Date(resetTime * 1000).toLocaleString()}`);
      
    } catch (error) {
      console.error('❌ Error enabling graceful mode:', error);
    }
  }

  /**
   * Disable graceful mode when limits reset
   */
  async disableGracefulMode(): Promise<void> {
    try {
      console.log('🚀 Disabling graceful mode - resuming normal operations...');
      
      const updates = [
        { key: 'graceful_mode', value: 'false' },
        { key: 'graceful_mode_disabled_at', value: new Date().toISOString() }
      ];

      for (const update of updates) {
        await this.supabase
          .from('bot_config')
          .upsert(update, { onConflict: 'key' });
      }

      // Clear cache to force refresh
      this.cachedStatus = null;
      
      console.log('✅ Graceful mode disabled - normal posting resumed');
      
    } catch (error) {
      console.error('❌ Error disabling graceful mode:', error);
    }
  }

  /**
   * Check if we should attempt posting based on current limits
   */
  async shouldAttemptPost(): Promise<{ shouldPost: boolean; reason: string; waitTime?: number }> {
    const status = await this.checkRateLimitStatus();
    
    if (status.gracefulMode && status.nextAvailableTime) {
      const now = new Date();
      if (now < status.nextAvailableTime) {
        const waitTime = status.nextAvailableTime.getTime() - now.getTime();
        return {
          shouldPost: false,
          reason: `Graceful mode active until ${status.nextAvailableTime.toLocaleString()}`,
          waitTime: Math.floor(waitTime / 1000)
        };
      } else {
        // Time to disable graceful mode
        await this.disableGracefulMode();
        return { shouldPost: true, reason: 'Rate limits have reset' };
      }
    }

    if (!status.canPost) {
      return {
        shouldPost: false,
        reason: `Daily limit reached (${status.dailyRemaining}/${status.dailyLimit})`,
        waitTime: status.resetTime - Math.floor(Date.now() / 1000)
      };
    }

    return { shouldPost: true, reason: `Limits available (${status.dailyRemaining}/${status.dailyLimit})` };
  }

  /**
   * Update rate limit status after API response
   */
  async updateFromApiResponse(headers: any): Promise<void> {
    try {
      const dailyRemaining = parseInt(headers['x-app-limit-24hour-remaining'] || '0');
      const dailyLimit = parseInt(headers['x-app-limit-24hour-limit'] || '17');
      const resetTime = parseInt(headers['x-app-limit-24hour-reset'] || '0');

      const updates = [
        { key: 'daily_tweets_remaining', value: dailyRemaining.toString() },
        { key: 'daily_tweets_limit', value: dailyLimit.toString() },
        { key: 'rate_limit_reset_time', value: resetTime.toString() },
        { key: 'last_rate_limit_update', value: new Date().toISOString() }
      ];

      for (const update of updates) {
        await this.supabase
          .from('bot_config')
          .upsert(update, { onConflict: 'key' });
      }

      // If we hit the limit, enable graceful mode
      if (dailyRemaining === 0) {
        await this.enableGracefulMode(resetTime);
      }

      // Clear cache to force refresh
      this.cachedStatus = null;
      
      console.log(`📊 Rate limits updated: ${dailyRemaining}/${dailyLimit} remaining`);
      
    } catch (error) {
      console.error('❌ Error updating rate limit status:', error);
    }
  }

  /**
   * Get smart scheduling recommendation
   */
  async getSmartSchedule(): Promise<{ nextPostTime: Date; postsRemaining: number; strategy: string }> {
    const status = await this.checkRateLimitStatus();
    
    if (status.gracefulMode && status.nextAvailableTime) {
      return {
        nextPostTime: status.nextAvailableTime,
        postsRemaining: 0,
        strategy: 'graceful_wait'
      };
    }

    if (status.dailyRemaining === 0) {
      return {
        nextPostTime: new Date(status.resetTime * 1000),
        postsRemaining: 0,
        strategy: 'wait_for_reset'
      };
    }

    // Calculate optimal spacing for remaining posts
    const now = new Date();
    const resetTime = new Date(status.resetTime * 1000);
    const timeUntilReset = resetTime.getTime() - now.getTime();
    const hoursUntilReset = timeUntilReset / (1000 * 60 * 60);
    
    // Space posts evenly across remaining time
    const optimalSpacing = Math.max(2, hoursUntilReset / status.dailyRemaining); // At least 2 hours apart
    const nextPostTime = new Date(now.getTime() + (optimalSpacing * 60 * 60 * 1000));

    return {
      nextPostTime,
      postsRemaining: status.dailyRemaining,
      strategy: `optimal_spacing_${Math.round(optimalSpacing)}h`
    };
  }

  /**
   * Log current status for monitoring
   */
  async logStatus(): Promise<void> {
    const status = await this.checkRateLimitStatus();
    const schedule = await this.getSmartSchedule();
    
    console.log('📊 === RATE LIMIT STATUS ===');
    console.log(`📝 Posts remaining: ${status.dailyRemaining}/${status.dailyLimit}`);
    console.log(`⏰ Limits reset: ${new Date(status.resetTime * 1000).toLocaleString()}`);
    console.log(`🛡️ Graceful mode: ${status.gracefulMode ? 'ACTIVE' : 'INACTIVE'}`);
    console.log(`🎯 Can post: ${status.canPost ? 'YES' : 'NO'}`);
    console.log(`📅 Next post: ${schedule.nextPostTime.toLocaleString()}`);
    console.log(`🧠 Strategy: ${schedule.strategy}`);
    console.log('================================');
  }
}

// Singleton instance
export const rateLimitHandler = new EnhancedRateLimitHandler(); 