/**
 * 🔄 RATE LIMIT DATABASE INTEGRATION
 * 
 * Integrates with the new SQL setup for real Twitter rate limiting
 * Works with fix_supabase_sql_error.sql migration
 */

import { supabaseClient } from './supabaseClient';

export interface RateLimitWindow {
  id?: number;
  window_type: '3_hour' | '24_hour';
  tweets_used: number;
  window_start: Date;
  window_end: Date;
  last_reset: Date;
}

export interface RateLimitStatus {
  tweets3Hour: { used: number; limit: number; resetTime: Date };
  tweets24Hour: { used: number; limit: number; resetTime: Date };
  lastSync: Date;
}

export class RateLimitDatabase {
  private static instance: RateLimitDatabase;
  private lastSync: Date = new Date(0);
  private syncInterval = 30000; // 30 seconds

  public static getInstance(): RateLimitDatabase {
    if (!RateLimitDatabase.instance) {
      RateLimitDatabase.instance = new RateLimitDatabase();
    }
    return RateLimitDatabase.instance;
  }

  /**
   * Get current rate limit status from database
   */
  async getRateLimitStatus(): Promise<RateLimitStatus> {
    try {
      const { data, error } = await supabaseClient.supabase
        ?.from('real_twitter_rate_limits')
        .select('*');

      if (error) {
        console.error('Error loading rate limits from database:', error);
        // Return default limits if database fails
        return this.getDefaultLimits();
      }

      const status: RateLimitStatus = {
        tweets3Hour: { used: 0, limit: 300, resetTime: new Date(Date.now() + 3 * 60 * 60 * 1000) },
        tweets24Hour: { used: 0, limit: 2400, resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000) },
        lastSync: new Date()
      };

      if (data) {
        for (const record of data) {
          if (record.window_type === '3_hour') {
            status.tweets3Hour.used = record.tweets_used;
            status.tweets3Hour.resetTime = new Date(record.window_end);
          } else if (record.window_type === '24_hour') {
            status.tweets24Hour.used = record.tweets_used;
            status.tweets24Hour.resetTime = new Date(record.window_end);
          }
        }
      }

      this.lastSync = new Date();
      return status;

    } catch (error) {
      console.error('Error getting rate limit status:', error);
      return this.getDefaultLimits();
    }
  }

  /**
   * Increment tweet count using database function
   */
  async incrementTweetCount(): Promise<boolean> {
    try {
      const { error } = await supabaseClient.supabase
        ?.rpc('increment_tweet_count');

      if (error) {
        console.error('Error incrementing tweet count:', error);
        return false;
      }

      console.log('✅ Tweet count incremented in database');
      return true;

    } catch (error) {
      console.error('Error calling increment_tweet_count function:', error);
      return false;
    }
  }

  /**
   * Reset rate limit window using database function
   */
  async resetRateLimitWindow(windowType: '3_hour' | '24_hour'): Promise<boolean> {
    try {
      const { error } = await supabaseClient.supabase
        ?.rpc('reset_rate_limit_window', { window_type_param: windowType });

      if (error) {
        console.error(`Error resetting ${windowType} window:`, error);
        return false;
      }

      console.log(`✅ ${windowType} rate limit window reset in database`);
      return true;

    } catch (error) {
      console.error(`Error resetting ${windowType} window:`, error);
      return false;
    }
  }

  /**
   * Log rate limit violation (HTTP 429) to database
   */
  async logRateLimitViolation(details: {
    error_code: number;
    endpoint?: string;
    response_headers?: any;
    current_limits: RateLimitStatus;
  }): Promise<void> {
    try {
      await supabaseClient.supabase
        ?.from('bot_config')
        .upsert({
          key: 'last_rate_limit_violation',
          value: {
            timestamp: new Date().toISOString(),
            ...details
          },
          description: 'Last rate limit violation from Twitter API',
          created_by: 'rateLimitDatabase'
        });

      console.log('📊 Rate limit violation logged to database');

    } catch (error) {
      console.error('Error logging rate limit violation:', error);
    }
  }

  /**
   * Check if we need to sync with database
   */
  shouldSync(): boolean {
    const timeSinceSync = Date.now() - this.lastSync.getTime();
    return timeSinceSync > this.syncInterval;
  }

  /**
   * Initialize rate limit windows in database (run once on startup)
   */
  async initializeWindows(): Promise<void> {
    try {
      // Check if windows exist
      const { data: existing } = await supabaseClient.supabase
        ?.from('real_twitter_rate_limits')
        .select('window_type');

      const hasThreeHour = existing?.some(r => r.window_type === '3_hour');
      const hasTwentyFourHour = existing?.some(r => r.window_type === '24_hour');

      // Create missing windows
      const windowsToCreate = [];

      if (!hasThreeHour) {
        windowsToCreate.push({
          window_type: '3_hour',
          tweets_used: 0,
          window_start: new Date(),
          window_end: new Date(Date.now() + 3 * 60 * 60 * 1000)
        });
      }

      if (!hasTwentyFourHour) {
        windowsToCreate.push({
          window_type: '24_hour',
          tweets_used: 0,
          window_start: new Date(),
          window_end: new Date(Date.now() + 24 * 60 * 60 * 1000)
        });
      }

      if (windowsToCreate.length > 0) {
        const { error } = await supabaseClient.supabase
          ?.from('real_twitter_rate_limits')
          .insert(windowsToCreate);

        if (error) {
          console.error('Error creating rate limit windows:', error);
        } else {
          console.log(`✅ Created ${windowsToCreate.length} rate limit windows`);
        }
      }

    } catch (error) {
      console.error('Error initializing rate limit windows:', error);
    }
  }

  /**
   * Get configuration from database
   */
  async getRateLimitConfig(): Promise<any> {
    try {
      const { data } = await supabaseClient.supabase
        ?.from('bot_config')
        .select('value')
        .eq('key', 'real_twitter_limits')
        .single();

      return data?.value || this.getDefaultConfig();

    } catch (error) {
      console.error('Error getting rate limit config:', error);
      return this.getDefaultConfig();
    }
  }

  /**
   * Update cached user ID in database
   */
  async updateCachedUserId(userId: string): Promise<void> {
    try {
      await supabaseClient.supabase
        ?.from('bot_config')
        .upsert({
          key: 'twitter_user_id_cached',
          value: {
            enabled: true,
            user_id: userId,
            cached_at: new Date().toISOString(),
            eliminates_users_me_calls: true
          },
          description: 'Cached Twitter user ID to eliminate /users/me API calls',
          created_by: 'rateLimitDatabase'
        });

      console.log('✅ User ID cached in database');

    } catch (error) {
      console.error('Error caching user ID:', error);
    }
  }

  /**
   * Get cached user ID from database
   */
  async getCachedUserId(): Promise<string | null> {
    try {
      const { data } = await supabaseClient.supabase
        ?.from('bot_config')
        .select('value')
        .eq('key', 'twitter_user_id_cached')
        .single();

      return data?.value?.user_id || null;

    } catch (error) {
      console.error('Error getting cached user ID:', error);
      return null;
    }
  }

  private getDefaultLimits(): RateLimitStatus {
    return {
      tweets3Hour: { used: 0, limit: 300, resetTime: new Date(Date.now() + 3 * 60 * 60 * 1000) },
      tweets24Hour: { used: 0, limit: 2400, resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000) },
      lastSync: new Date()
    };
  }

  private getDefaultConfig(): any {
    return {
      tweets_3_hour: { limit: 300, description: 'Real Twitter API v2 Free Tier: 300 tweets per 3-hour rolling window' },
      tweets_24_hour: { limit: 2400, description: 'Real Twitter API v2 Free Tier: 2400 tweets per 24-hour rolling window' },
      enabled: true,
      artificial_limits_removed: true
    };
  }
}

// Export singleton instance
export const rateLimitDB = RateLimitDatabase.getInstance(); 