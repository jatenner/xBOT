import { TwitterQuotaManager, TwitterQuota } from './twitterQuotaManager';
import { secureSupabaseClient } from './secureSupabaseClient';

export interface OptimalSchedule {
  nextPostTime: Date;
  postsRemaining: number;
  hoursRemaining: number;
  optimalInterval: number; // minutes
  shouldPostNow: boolean;
  quotaResetTime: Date;
  strategy: 'aggressive' | 'balanced' | 'conservative' | 'final_push';
}

export class IntelligentQuotaScheduler {
  private static instance: IntelligentQuotaScheduler;
  private quotaManager: TwitterQuotaManager;
  private readonly ACTIVE_HOURS_START = 6; // 6 AM EST
  private readonly ACTIVE_HOURS_END = 23; // 11 PM EST
  private readonly TARGET_DAILY_TWEETS = 17;

  constructor() {
    this.quotaManager = TwitterQuotaManager.getInstance();
  }

  static getInstance(): IntelligentQuotaScheduler {
    if (!IntelligentQuotaScheduler.instance) {
      IntelligentQuotaScheduler.instance = new IntelligentQuotaScheduler();
    }
    return IntelligentQuotaScheduler.instance;
  }

  /**
   * Get optimal posting schedule based on current quota and time
   */
  async getOptimalSchedule(): Promise<OptimalSchedule> {
    const quota = await this.quotaManager.getCurrentQuota();
    const now = new Date();
    const estNow = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
    
    // If quota is exhausted, calculate when it resets
    if (quota.isExhausted) {
      return this.getQuotaExhaustedSchedule(quota, estNow);
    }

    // Calculate remaining active hours today
    const activeHoursRemaining = this.getActiveHoursRemaining(estNow);
    const postsRemaining = quota.dailyRemaining;
    
    // Determine posting strategy based on quota utilization
    const strategy = this.determineStrategy(postsRemaining, activeHoursRemaining, estNow);
    const optimalInterval = this.calculateOptimalInterval(postsRemaining, activeHoursRemaining);
    
    return {
      nextPostTime: this.calculateNextPostTime(estNow, optimalInterval),
      postsRemaining,
      hoursRemaining: activeHoursRemaining,
      optimalInterval,
      shouldPostNow: await this.shouldPostNow(strategy, estNow, postsRemaining),
      quotaResetTime: quota.resetTime,
      strategy
    };
  }

  /**
   * Check if quota has reset and we can resume posting
   */
  async checkQuotaReset(): Promise<{ hasReset: boolean; newQuota?: TwitterQuota }> {
    try {
      const quota = await this.quotaManager.refreshQuota();
      
      // If we have quota available, it likely reset
      if (!quota.isExhausted && quota.dailyRemaining > 0) {
        console.log('🎉 QUOTA RESET DETECTED! Resuming intelligent posting...');
        console.log(`📊 Fresh quota: ${quota.dailyRemaining}/${quota.dailyLimit} tweets available`);
        
        // Log quota reset for tracking
        await this.logQuotaReset(quota);
        
        return { hasReset: true, newQuota: quota };
      }
      
      return { hasReset: false };
    } catch (error) {
      console.warn('⚠️ Error checking quota reset:', error);
      return { hasReset: false };
    }
  }

  /**
   * Get schedule when quota is exhausted
   */
  private getQuotaExhaustedSchedule(quota: TwitterQuota, estNow: Date): OptimalSchedule {
    const timeUntilReset = quota.resetTime.getTime() - Date.now();
    const hoursUntilReset = Math.max(0, timeUntilReset / (1000 * 60 * 60));
    
    return {
      nextPostTime: quota.resetTime,
      postsRemaining: 0,
      hoursRemaining: 0,
      optimalInterval: 0,
      shouldPostNow: false,
      quotaResetTime: quota.resetTime,
      strategy: 'conservative'
    };
  }

  /**
   * Calculate remaining active hours today
   */
  private getActiveHoursRemaining(estNow: Date): number {
    const currentHour = estNow.getHours();
    
    // If outside active hours, return 0
    if (currentHour < this.ACTIVE_HOURS_START || currentHour >= this.ACTIVE_HOURS_END) {
      return 0;
    }
    
    const activeHoursEnd = this.ACTIVE_HOURS_END;
    const currentMinutes = estNow.getMinutes();
    
    return activeHoursEnd - currentHour - (currentMinutes / 60);
  }

  /**
   * Determine optimal posting strategy - FIXED FOR MAXIMUM POSTING
   */
  private determineStrategy(postsRemaining: number, hoursRemaining: number, estNow: Date): OptimalSchedule['strategy'] {
    const currentHour = estNow.getHours();
    const quotaUtilization = (this.TARGET_DAILY_TWEETS - postsRemaining) / this.TARGET_DAILY_TWEETS;
    const postsPerHourRequired = hoursRemaining > 0 ? postsRemaining / hoursRemaining : 0;
    
    console.log(`📊 Strategy calculation: ${postsRemaining} posts remaining, ${hoursRemaining.toFixed(1)}h left, ${(quotaUtilization * 100).toFixed(1)}% used`);
    
    // Final push strategy in last 3 hours with many posts left
    if (hoursRemaining <= 3 && postsRemaining > 3) {
      console.log('🚀 Strategy: FINAL_PUSH - Racing against time');
      return 'final_push';
    }
    
    // Aggressive if we need more than 1 post per hour
    if (postsPerHourRequired > 1.0) {
      console.log('🔥 Strategy: AGGRESSIVE - Need to catch up');
      return 'aggressive';
    }
    
    // Aggressive if we're significantly behind schedule (less than 50% utilized)
    if (quotaUtilization < 0.5) {
      console.log('⚡ Strategy: AGGRESSIVE - Behind schedule');
      return 'aggressive';
    }
    
    // Conservative only if we're way ahead of schedule (more than 80% utilized with lots of time)
    if (quotaUtilization > 0.8 && hoursRemaining > 6) {
      console.log('🐌 Strategy: CONSERVATIVE - Ahead of schedule');
      return 'conservative';
    }
    
    // Default to balanced for moderate usage
    console.log('⚖️ Strategy: BALANCED - Steady posting');
    return 'balanced';
  }

  /**
   * Calculate optimal interval between posts
   */
  private calculateOptimalInterval(postsRemaining: number, hoursRemaining: number): number {
    if (postsRemaining === 0 || hoursRemaining === 0) {
      return 0;
    }
    
    // Base interval: distribute posts evenly across remaining hours
    const baseInterval = (hoursRemaining * 60) / postsRemaining;
    
    // Minimum 20 minutes, maximum 4 hours
    return Math.max(20, Math.min(240, baseInterval));
  }

  /**
   * Calculate next optimal post time
   */
  private calculateNextPostTime(estNow: Date, intervalMinutes: number): Date {
    const nextTime = new Date(estNow.getTime() + (intervalMinutes * 60 * 1000));
    
    // Ensure it's within active hours
    const nextHour = nextTime.getHours();
    if (nextHour < this.ACTIVE_HOURS_START) {
      nextTime.setHours(this.ACTIVE_HOURS_START, 0, 0, 0);
    } else if (nextHour >= this.ACTIVE_HOURS_END) {
      // Move to next day's start
      nextTime.setDate(nextTime.getDate() + 1);
      nextTime.setHours(this.ACTIVE_HOURS_START, 0, 0, 0);
    }
    
    return nextTime;
  }

  /**
   * Determine if we should post right now - FIXED FOR MAXIMUM POSTING
   */
  private async shouldPostNow(strategy: OptimalSchedule['strategy'], estNow: Date, postsRemaining: number): Promise<boolean> {
    const currentHour = estNow.getHours();
    const timeSinceLastPost = await this.timeSinceLastPost();
    
    console.log(`🕐 shouldPostNow: ${strategy} strategy, ${timeSinceLastPost.toFixed(1)} min since last post`);
    
    // Always post if it's our first post of the day
    if (postsRemaining === this.TARGET_DAILY_TWEETS) {
      console.log('✅ First post of day - posting now');
      return true;
    }
    
    // Strategy-based decisions with more intelligent timing
    switch (strategy) {
      case 'aggressive':
        // Post every 30 minutes when aggressive
        const shouldPostAggressive = timeSinceLastPost >= 30;
        console.log(`🔥 Aggressive: ${shouldPostAggressive ? 'YES' : 'NO'} (need 30+ min, have ${timeSinceLastPost.toFixed(1)})`);
        return shouldPostAggressive;
      
      case 'final_push':
        // Post every 20 minutes in final push
        const shouldPostFinalPush = timeSinceLastPost >= 20;
        console.log(`🚀 Final push: ${shouldPostFinalPush ? 'YES' : 'NO'} (need 20+ min, have ${timeSinceLastPost.toFixed(1)})`);
        return shouldPostFinalPush;
      
      case 'balanced':
        // Post if we haven't posted in the last 45 minutes
        const shouldPostBalanced = timeSinceLastPost >= 45;
        console.log(`⚖️ Balanced: ${shouldPostBalanced ? 'YES' : 'NO'} (need 45+ min, have ${timeSinceLastPost.toFixed(1)})`);
        return shouldPostBalanced;
      
      case 'conservative':
        // Space out posts more (but not too much - max 60 minutes)
        const shouldPostConservative = timeSinceLastPost >= 60;
        console.log(`🐌 Conservative: ${shouldPostConservative ? 'YES' : 'NO'} (need 60+ min, have ${timeSinceLastPost.toFixed(1)})`);
        return shouldPostConservative;
      
      default:
        console.log('❌ Unknown strategy - defaulting to NO');
        return false;
    }
  }

  /**
   * Get minutes since last post
   */
  private async timeSinceLastPost(): Promise<number> {
    try {
      const { data } = await secureSupabaseClient.supabase
        ?.from('tweets')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1) || { data: null };
      
      if (data && data.length > 0) {
        const lastPostTime = new Date(data[0].created_at);
        return (Date.now() - lastPostTime.getTime()) / (1000 * 60);
      }
    } catch (error) {
      console.warn('⚠️ Could not check last post time:', error);
    }
    
    return 999; // Safe fallback - assume enough time has passed
  }

  /**
   * Log quota reset for analytics
   */
  private async logQuotaReset(quota: TwitterQuota): Promise<void> {
    try {
      await secureSupabaseClient.supabase
        ?.from('quota_reset_log')
        .insert({
          reset_time: quota.resetTime.toISOString(),
          new_quota_limit: quota.dailyLimit,
          new_quota_remaining: quota.dailyRemaining,
          detected_at: new Date().toISOString()
        });
    } catch (error) {
      console.warn('⚠️ Could not log quota reset:', error);
    }
  }

  /**
   * Get daily quota utilization report
   */
  async getQuotaUtilizationReport(): Promise<{
    used: number;
    remaining: number;
    utilizationRate: number;
    onTrack: boolean;
    recommendation: string;
  }> {
    const quota = await this.quotaManager.getCurrentQuota();
    const estNow = new Date(new Date().toLocaleString("en-US", {timeZone: "America/New_York"}));
    const activeHoursRemaining = this.getActiveHoursRemaining(estNow);
    
    const used = quota.dailyUsed;
    const remaining = quota.dailyRemaining;
    const utilizationRate = used / this.TARGET_DAILY_TWEETS;
    
    // Check if we're on track
    const expectedUsage = this.getExpectedUsageByTime(estNow);
    const onTrack = utilizationRate >= (expectedUsage * 0.8); // Within 20% of expected
    
    let recommendation = '';
    if (quota.isExhausted) {
      recommendation = `Quota exhausted. Resume posting when quota resets at ${quota.resetTime.toLocaleTimeString()}.`;
    } else if (!onTrack && activeHoursRemaining > 2) {
      recommendation = 'Behind schedule. Consider more aggressive posting.';
    } else if (remaining > 5 && activeHoursRemaining < 3) {
      recommendation = 'Final push time! Use remaining quota quickly.';
    } else {
      recommendation = 'On track. Continue current posting strategy.';
    }
    
    return {
      used,
      remaining,
      utilizationRate,
      onTrack,
      recommendation
    };
  }

  /**
   * Calculate expected quota usage by current time
   */
  private getExpectedUsageByTime(estNow: Date): number {
    const currentHour = estNow.getHours();
    const totalActiveHours = this.ACTIVE_HOURS_END - this.ACTIVE_HOURS_START; // 17 hours
    
    if (currentHour < this.ACTIVE_HOURS_START) {
      return 0;
    } else if (currentHour >= this.ACTIVE_HOURS_END) {
      return 1; // Should have used all quota
    } else {
      const hoursElapsed = currentHour - this.ACTIVE_HOURS_START + (estNow.getMinutes() / 60);
      return hoursElapsed / totalActiveHours;
    }
  }
}

export const intelligentQuotaScheduler = IntelligentQuotaScheduler.getInstance(); 