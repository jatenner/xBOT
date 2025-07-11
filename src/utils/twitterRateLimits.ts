/**
 * 🐦 TWITTER RATE LIMITS MANAGER
 * 
 * Simplified rate limiting focused ONLY on actual Twitter API limits.
 * Eliminates false positives and complex recovery systems.
 * 
 * Real Twitter Free Tier Limits:
 * - 300 tweets per 3-hour rolling window
 * - 2400 tweets per 24-hour rolling window  
 * - 1500 tweets per month
 */

import { supabaseClient } from './supabaseClient';

export interface TwitterLimits {
  tweets3Hour: {
    used: number;
    limit: number;
    resetTime: Date;
  };
  tweets24Hour: {
    used: number;
    limit: number;
    resetTime: Date;
  };
  tweetsMonthly: {
    used: number;
    limit: number;
    resetTime: Date;
  };
}

export interface PostingStatus {
  canPost: boolean;
  reason: string;
  nextAvailableTime?: Date;
  timeToWait?: number; // minutes
}

export class TwitterRateLimits {
  private static instance: TwitterRateLimits;
  
  // Real Twitter Free Tier Limits
  private static readonly LIMITS = {
    TWEETS_3_HOUR: 300,
    TWEETS_24_HOUR: 2400,
    TWEETS_MONTHLY: 1500
  };

  private limits: TwitterLimits;
  private lastUpdate = 0;
  private readonly UPDATE_INTERVAL = 60000; // 1 minute

  static getInstance(): TwitterRateLimits {
    if (!TwitterRateLimits.instance) {
      TwitterRateLimits.instance = new TwitterRateLimits();
    }
    return TwitterRateLimits.instance;
  }

  constructor() {
    this.limits = this.initializeLimits();
    this.loadFromDatabase();
  }

  /**
   * 🎯 MAIN CHECK - Can we post right now?
   */
  async canPost(): Promise<PostingStatus> {
    await this.updateLimitsIfNeeded();

    const now = new Date();

    // Check 3-hour limit
    if (this.limits.tweets3Hour.used >= this.limits.tweets3Hour.limit) {
      const waitTime = Math.ceil((this.limits.tweets3Hour.resetTime.getTime() - now.getTime()) / 60000);
      return {
        canPost: false,
        reason: `3-hour limit reached (${this.limits.tweets3Hour.used}/${this.limits.tweets3Hour.limit})`,
        nextAvailableTime: this.limits.tweets3Hour.resetTime,
        timeToWait: waitTime
      };
    }

    // Check 24-hour limit
    if (this.limits.tweets24Hour.used >= this.limits.tweets24Hour.limit) {
      const waitTime = Math.ceil((this.limits.tweets24Hour.resetTime.getTime() - now.getTime()) / 60000);
      return {
        canPost: false,
        reason: `24-hour limit reached (${this.limits.tweets24Hour.used}/${this.limits.tweets24Hour.limit})`,
        nextAvailableTime: this.limits.tweets24Hour.resetTime,
        timeToWait: waitTime
      };
    }

    // Check monthly limit
    if (this.limits.tweetsMonthly.used >= this.limits.tweetsMonthly.limit) {
      const waitTime = Math.ceil((this.limits.tweetsMonthly.resetTime.getTime() - now.getTime()) / 60000);
      return {
        canPost: false,
        reason: `Monthly limit reached (${this.limits.tweetsMonthly.used}/${this.limits.tweetsMonthly.limit})`,
        nextAvailableTime: this.limits.tweetsMonthly.resetTime,
        timeToWait: waitTime
      };
    }

    return {
      canPost: true,
      reason: `Can post (3h: ${this.limits.tweets3Hour.used}/${this.limits.tweets3Hour.limit}, 24h: ${this.limits.tweets24Hour.used}/${this.limits.tweets24Hour.limit})`
    };
  }

  /**
   * 📝 RECORD POST - Update counters after successful post
   */
  async recordPost(): Promise<void> {
    const now = new Date();

    // Increment all counters
    this.limits.tweets3Hour.used++;
    this.limits.tweets24Hour.used++;
    this.limits.tweetsMonthly.used++;

    // Save to database
    await this.saveLimitsToDatabase();

    console.log(`📊 Tweet recorded - 3h: ${this.limits.tweets3Hour.used}/${this.limits.tweets3Hour.limit}, 24h: ${this.limits.tweets24Hour.used}/${this.limits.tweets24Hour.limit}, Monthly: ${this.limits.tweetsMonthly.used}/${this.limits.tweetsMonthly.limit}`);
  }

  /**
   * 🔄 UPDATE LIMITS - Reset windows that have expired
   */
  private async updateLimitsIfNeeded(): Promise<void> {
    const now = new Date();
    
    // Only update once per minute
    if (now.getTime() - this.lastUpdate < this.UPDATE_INTERVAL) {
      return;
    }

    let updated = false;

    // Reset 3-hour window if expired
    if (now >= this.limits.tweets3Hour.resetTime) {
      this.limits.tweets3Hour.used = 0;
      this.limits.tweets3Hour.resetTime = new Date(now.getTime() + (3 * 60 * 60 * 1000));
      updated = true;
      console.log('🔄 3-hour tweet window reset');
    }

    // Reset 24-hour window if expired
    if (now >= this.limits.tweets24Hour.resetTime) {
      this.limits.tweets24Hour.used = 0;
      this.limits.tweets24Hour.resetTime = new Date(now.getTime() + (24 * 60 * 60 * 1000));
      updated = true;
      console.log('🔄 24-hour tweet window reset');
    }

    // Reset monthly window if expired
    if (now >= this.limits.tweetsMonthly.resetTime) {
      this.limits.tweetsMonthly.used = 0;
      this.limits.tweetsMonthly.resetTime = this.getNextMonthStart();
      updated = true;
      console.log('🔄 Monthly tweet window reset');
    }

    if (updated) {
      await this.saveLimitsToDatabase();
    }

    this.lastUpdate = now.getTime();
  }

  /**
   * 📊 GET STATUS REPORT
   */
  async getStatusReport(): Promise<string> {
    await this.updateLimitsIfNeeded();
    
    const now = new Date();
    
    return `
🐦 === TWITTER RATE LIMITS ===
📈 3-Hour Window: ${this.limits.tweets3Hour.used}/${this.limits.tweets3Hour.limit} 
   Reset: ${this.limits.tweets3Hour.resetTime.toLocaleString()}
   
📈 24-Hour Window: ${this.limits.tweets24Hour.used}/${this.limits.tweets24Hour.limit}
   Reset: ${this.limits.tweets24Hour.resetTime.toLocaleString()}
   
📈 Monthly Window: ${this.limits.tweetsMonthly.used}/${this.limits.tweetsMonthly.limit}
   Reset: ${this.limits.tweetsMonthly.resetTime.toLocaleDateString()}

🎯 Status: ${(await this.canPost()).canPost ? '✅ CAN POST' : '❌ RATE LIMITED'}
`;
  }

  /**
   * 🗃️ DATABASE PERSISTENCE
   */
  private async loadFromDatabase(): Promise<void> {
    try {
      if (!supabaseClient.supabase) return;

      const { data } = await supabaseClient.supabase
        .from('twitter_rate_limits')
        .select('*')
        .single();

      if (data) {
        this.limits = {
          tweets3Hour: {
            used: data.tweets_3_hour_used || 0,
            limit: TwitterRateLimits.LIMITS.TWEETS_3_HOUR,
            resetTime: new Date(data.tweets_3_hour_reset || Date.now() + 3 * 60 * 60 * 1000)
          },
          tweets24Hour: {
            used: data.tweets_24_hour_used || 0,
            limit: TwitterRateLimits.LIMITS.TWEETS_24_HOUR,
            resetTime: new Date(data.tweets_24_hour_reset || Date.now() + 24 * 60 * 60 * 1000)
          },
          tweetsMonthly: {
            used: data.tweets_monthly_used || 0,
            limit: TwitterRateLimits.LIMITS.TWEETS_MONTHLY,
            resetTime: new Date(data.tweets_monthly_reset || this.getNextMonthStart())
          }
        };
      }
    } catch (error) {
      console.warn('⚠️ Could not load rate limits from database:', error);
    }
  }

  private async saveLimitsToDatabase(): Promise<void> {
    try {
      if (!supabaseClient.supabase) return;

      await supabaseClient.supabase
        .from('twitter_rate_limits')
        .upsert({
          id: 1, // Single row for all limits
          tweets_3_hour_used: this.limits.tweets3Hour.used,
          tweets_3_hour_reset: this.limits.tweets3Hour.resetTime.toISOString(),
          tweets_24_hour_used: this.limits.tweets24Hour.used,
          tweets_24_hour_reset: this.limits.tweets24Hour.resetTime.toISOString(),
          tweets_monthly_used: this.limits.tweetsMonthly.used,
          tweets_monthly_reset: this.limits.tweetsMonthly.resetTime.toISOString(),
          updated_at: new Date().toISOString()
        });
    } catch (error) {
      console.warn('⚠️ Could not save rate limits to database:', error);
    }
  }

  /**
   * 🔧 UTILITY METHODS
   */
  private initializeLimits(): TwitterLimits {
    const now = new Date();
    
    return {
      tweets3Hour: {
        used: 0,
        limit: TwitterRateLimits.LIMITS.TWEETS_3_HOUR,
        resetTime: new Date(now.getTime() + (3 * 60 * 60 * 1000))
      },
      tweets24Hour: {
        used: 0,
        limit: TwitterRateLimits.LIMITS.TWEETS_24_HOUR,
        resetTime: new Date(now.getTime() + (24 * 60 * 60 * 1000))
      },
      tweetsMonthly: {
        used: 0,
        limit: TwitterRateLimits.LIMITS.TWEETS_MONTHLY,
        resetTime: this.getNextMonthStart()
      }
    };
  }

  private getNextMonthStart(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }

  /**
   * ⚡ QUICK CHECKS - For frequent calls
   */
  canPostQuick(): boolean {
    const now = new Date();
    
    // Quick check without database update
    return (
      this.limits.tweets3Hour.used < this.limits.tweets3Hour.limit &&
      this.limits.tweets24Hour.used < this.limits.tweets24Hour.limit &&
      this.limits.tweetsMonthly.used < this.limits.tweetsMonthly.limit &&
      now < this.limits.tweets3Hour.resetTime &&
      now < this.limits.tweets24Hour.resetTime &&
      now < this.limits.tweetsMonthly.resetTime
    );
  }

  getRemainingPosts(): {
    next3Hours: number;
    next24Hours: number;
    thisMonth: number;
  } {
    return {
      next3Hours: Math.max(0, this.limits.tweets3Hour.limit - this.limits.tweets3Hour.used),
      next24Hours: Math.max(0, this.limits.tweets24Hour.limit - this.limits.tweets24Hour.used),
      thisMonth: Math.max(0, this.limits.tweetsMonthly.limit - this.limits.tweetsMonthly.used)
    };
  }

  /**
   * 🔄 FORCE RESET - For testing/emergency use
   */
  async forceReset(): Promise<void> {
    this.limits = this.initializeLimits();
    await this.saveLimitsToDatabase();
    console.log('🔄 Twitter rate limits force reset');
  }
}

// Export singleton instance
export const twitterRateLimits = TwitterRateLimits.getInstance(); 