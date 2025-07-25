import { secureSupabaseClient } from './secureSupabaseClient';

export interface TwitterQuota {
  dailyLimit: number;
  dailyUsed: number;
  dailyRemaining: number;
  resetTime: Date;
  isExhausted: boolean;
  nextAvailableTime: Date;
}

export class TwitterQuotaManager {
  private static instance: TwitterQuotaManager;
  private lastQuotaCheck: Date | null = null;
  private cachedQuota: TwitterQuota | null = null;
  private readonly CACHE_DURATION_MS = 60000; // 1 minute cache

  static getInstance(): TwitterQuotaManager {
    if (!TwitterQuotaManager.instance) {
      TwitterQuotaManager.instance = new TwitterQuotaManager();
    }
    return TwitterQuotaManager.instance;
  }

  /**
   * Get current Twitter quota status from API headers
   */
  async getCurrentQuota(): Promise<TwitterQuota> {
    // Use cached quota if fresh
    if (this.cachedQuota && this.lastQuotaCheck) {
      const cacheAge = Date.now() - this.lastQuotaCheck.getTime();
      if (cacheAge < this.CACHE_DURATION_MS) {
        return this.cachedQuota;
      }
    }

    try {
      // Make a lightweight API call to get current headers
      const response = await this.makeTestApiCall();
      const quota = this.parseQuotaFromHeaders(response.headers);
      
      this.cachedQuota = quota;
      this.lastQuotaCheck = new Date();
      
      return quota;
    } catch (error) {
      console.warn('⚠️ Could not fetch quota from API, using fallback:', error);
      return this.getFallbackQuota();
    }
  }

  /**
   * Check if we can post without hitting quota limits
   */
  async canPost(): Promise<{ canPost: boolean; reason?: string; waitUntil?: Date }> {
    const quota = await this.getCurrentQuota();
    
    if (quota.isExhausted) {
      return {
        canPost: false,
        reason: `Daily quota exhausted (${quota.dailyUsed}/${quota.dailyLimit})`,
        waitUntil: quota.resetTime
      };
    }

    if (quota.dailyRemaining <= 0) {
      return {
        canPost: false,
        reason: `No remaining quota (${quota.dailyUsed}/${quota.dailyLimit})`,
        waitUntil: quota.resetTime
      };
    }

    return { canPost: true };
  }

  /**
   * Update quota after a successful post
   */
  async recordPost(): Promise<void> {
    if (this.cachedQuota) {
      this.cachedQuota.dailyUsed++;
      this.cachedQuota.dailyRemaining--;
      this.cachedQuota.isExhausted = this.cachedQuota.dailyRemaining <= 0;
    }
    
    // Also update database for tracking
    await this.updateDatabaseQuota();
  }

  /**
   * Get time until quota resets
   */
  async getTimeUntilReset(): Promise<number> {
    const quota = await this.getCurrentQuota();
    return Math.max(0, quota.resetTime.getTime() - Date.now());
  }

  /**
   * Force refresh quota from API
   */
  async refreshQuota(): Promise<TwitterQuota> {
    this.cachedQuota = null;
    this.lastQuotaCheck = null;
    return this.getCurrentQuota();
  }

  private async makeTestApiCall() {
    // Make a test API call to get real Twitter headers
    try {
      // Import TwitterApi directly to get real headers
      const TwitterApi = (await import('twitter-api-v2')).default;
      
      const client = new TwitterApi({
        appKey: process.env.TWITTER_API_KEY!,
        appSecret: process.env.TWITTER_API_SECRET!,
        accessToken: process.env.TWITTER_ACCESS_TOKEN!,
        accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET!,
      });

      // Make a lightweight API call that includes rate limit headers
      await client.v2.me();
      
      // This shouldn't reach here if quota is exhausted
      return { 
        headers: {
          'x-app-limit-24hour-limit': '17',
          'x-app-limit-24hour-remaining': '17', // If we got here, we have quota
          'x-app-limit-24hour-reset': Math.floor((Date.now() + 86400000) / 1000).toString()
        }
      };
    } catch (error: any) {
      // This is the key part - 429 errors include the actual headers we need
      if (error.rateLimit || error.headers) {
        return { 
          headers: error.headers || {
            'x-app-limit-24hour-remaining': error.rateLimit?.day?.remaining?.toString() || '0',
            'x-app-limit-24hour-limit': error.rateLimit?.day?.limit?.toString() || '17',
            'x-app-limit-24hour-reset': error.rateLimit?.day?.reset?.toString() || '0'
          }
        };
      }
      
      // Fallback: assume quota exhausted if we can't determine
      console.warn('⚠️ Could not determine quota status, assuming exhausted');
      return { 
        headers: {
          'x-app-limit-24hour-remaining': '0',
          'x-app-limit-24hour-limit': '17',
          'x-app-limit-24hour-reset': Math.floor((Date.now() + 86400000) / 1000).toString()
        }
      };
    }
  }

  private parseQuotaFromHeaders(headers: any): TwitterQuota {
    const dailyLimit = parseInt(headers['x-app-limit-24hour-limit'] || headers['x-user-limit-24hour-limit'] || '17');
    const dailyRemaining = parseInt(headers['x-app-limit-24hour-remaining'] || headers['x-user-limit-24hour-remaining'] || '0');
    const resetTimestamp = parseInt(headers['x-app-limit-24hour-reset'] || headers['x-user-limit-24hour-reset'] || '0');
    
    const dailyUsed = dailyLimit - dailyRemaining;
    const resetTime = resetTimestamp > 0 ? new Date(resetTimestamp * 1000) : this.getDefaultResetTime();
    const isExhausted = dailyRemaining <= 0;
    
    return {
      dailyLimit,
      dailyUsed,
      dailyRemaining,
      resetTime,
      isExhausted,
      nextAvailableTime: isExhausted ? resetTime : new Date()
    };
  }

  private getFallbackQuota(): TwitterQuota {
    const now = new Date();
    const resetTime = this.getDefaultResetTime();
    
    return {
      dailyLimit: 17,
      dailyUsed: 17, // Assume exhausted if we can't get real data
      dailyRemaining: 0,
      resetTime,
      isExhausted: true,
      nextAvailableTime: resetTime
    };
  }

  private getDefaultResetTime(): Date {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    return tomorrow;
  }

  private async updateDatabaseQuota(): Promise<void> {
    try {
      const quota = this.cachedQuota;
      if (!quota) return;

      await secureSupabaseClient.supabase
        ?.from('twitter_quota_tracking')
        .upsert({
          date: new Date().toISOString().split('T')[0],
          daily_used: quota.dailyUsed,
          daily_limit: quota.dailyLimit,
          daily_remaining: quota.dailyRemaining,
          reset_time: quota.resetTime.toISOString(),
          is_exhausted: quota.isExhausted,
          last_updated: new Date().toISOString()
        }, {
          onConflict: 'date'
        });
    } catch (error) {
      console.warn('⚠️ Could not update database quota:', error);
    }
  }
} 