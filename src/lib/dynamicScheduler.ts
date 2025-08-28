/**
 * ⏰ DYNAMIC SCHEDULER
 * Converts AI posting frequency decisions into dynamic scheduling
 * 
 * TRANSFORMATION:
 * - AI recommends 0-100 posts/day
 * - Converts to dynamic intervals and daily quotas
 * - Enforces intelligent backoff and burst modes
 */

import { getUnifiedDataManager } from './unifiedDataManager';

interface ScheduleConfig {
  minInterval: number; // Minutes between posts
  dailyQuota: number; // Max posts per day
  currentQuota: number; // Posts used today
  burstModeActive: boolean; // In rapid posting mode
  backoffUntil: Date | null; // Backoff until this time
  lastUpdate: Date;
}

interface ScheduleDecision {
  shouldPost: boolean;
  nextCheckIn: number; // Minutes
  reason: string;
  quotaRemaining: number;
  scheduleStrategy: 'burst' | 'steady' | 'conservative' | 'backoff';
}

export class DynamicScheduler {
  private static instance: DynamicScheduler;
  private dataManager = getUnifiedDataManager();
  private currentConfig: ScheduleConfig;

  // Default conservative config
  private readonly DEFAULT_CONFIG: ScheduleConfig = {
    minInterval: 240, // 4 hours
    dailyQuota: 6,
    currentQuota: 0,
    burstModeActive: false,
    backoffUntil: null,
    lastUpdate: new Date()
  };

  private constructor() {
    this.currentConfig = { ...this.DEFAULT_CONFIG };
  }

  public static getInstance(): DynamicScheduler {
    if (!DynamicScheduler.instance) {
      DynamicScheduler.instance = new DynamicScheduler();
    }
    return DynamicScheduler.instance;
  }

  /**
   * 🎯 GET SCHEDULE DECISION
   * Main method that determines if we should post based on AI frequency
   */
  public async getScheduleDecision(): Promise<ScheduleDecision> {
    console.log('⏰ DYNAMIC_SCHEDULER: Calculating schedule decision...');

    try {
      // Update schedule config based on AI recommendations
      await this.updateScheduleFromAI();

      // Check daily reset
      this.checkDailyReset();

      // Get minutes since last post
      const minutesSinceLastPost = await this.getMinutesSinceLastPost();

      // Check if we're in backoff mode
      if (this.currentConfig.backoffUntil && new Date() < this.currentConfig.backoffUntil) {
        const backoffMinutes = Math.ceil((this.currentConfig.backoffUntil.getTime() - Date.now()) / 60000);
        return {
          shouldPost: false,
          nextCheckIn: Math.min(backoffMinutes, 30),
          reason: `Backoff mode active for ${backoffMinutes} more minutes`,
          quotaRemaining: this.currentConfig.dailyQuota - this.currentConfig.currentQuota,
          scheduleStrategy: 'backoff'
        };
      }

      // Check daily quota
      if (this.currentConfig.currentQuota >= this.currentConfig.dailyQuota) {
        const minutesUntilMidnight = this.getMinutesUntilMidnight();
        return {
          shouldPost: false,
          nextCheckIn: Math.min(minutesUntilMidnight, 60),
          reason: `Daily quota reached (${this.currentConfig.currentQuota}/${this.currentConfig.dailyQuota})`,
          quotaRemaining: 0,
          scheduleStrategy: 'conservative'
        };
      }

      // Check minimum interval
      if (minutesSinceLastPost < this.currentConfig.minInterval) {
        const waitTime = this.currentConfig.minInterval - minutesSinceLastPost;
        return {
          shouldPost: false,
          nextCheckIn: waitTime,
          reason: `Minimum interval not met (${minutesSinceLastPost}/${this.currentConfig.minInterval} min)`,
          quotaRemaining: this.currentConfig.dailyQuota - this.currentConfig.currentQuota,
          scheduleStrategy: 'steady'
        };
      }

      // Determine strategy based on current state
      const strategy = this.determineStrategy();

      return {
        shouldPost: true,
        nextCheckIn: this.calculateNextCheckInterval(strategy),
        reason: `Ready to post - ${strategy} strategy (${minutesSinceLastPost} min since last)`,
        quotaRemaining: this.currentConfig.dailyQuota - this.currentConfig.currentQuota - 1,
        scheduleStrategy: strategy
      };

    } catch (error: any) {
      console.error('❌ DYNAMIC_SCHEDULER error:', error.message);
      
      // Safe fallback
      return {
        shouldPost: false,
        nextCheckIn: 30,
        reason: 'Scheduler error - conservative fallback',
        quotaRemaining: this.currentConfig.dailyQuota - this.currentConfig.currentQuota,
        scheduleStrategy: 'conservative'
      };
    }
  }

  /**
   * 🤖 UPDATE SCHEDULE FROM AI
   * Gets AI frequency recommendation and updates schedule config
   */
  private async updateScheduleFromAI(): Promise<void> {
    try {
      const aiFrequency = await this.dataManager.getOptimalPostingFrequency();
      
      const postsPerDay = Math.max(1, Math.min(100, aiFrequency.optimalFrequency));
      
      // Convert posts/day to schedule parameters
      const newConfig = this.convertFrequencyToSchedule(postsPerDay, aiFrequency.strategy);
      
      // Only update if significantly different (avoid constant changes)
      if (this.shouldUpdateConfig(newConfig)) {
        console.log(`⚡ DYNAMIC_SCHEDULER: Updating from ${this.currentConfig.dailyQuota} to ${newConfig.dailyQuota} posts/day`);
        console.log(`⏰ DYNAMIC_SCHEDULER: Interval ${this.currentConfig.minInterval} → ${newConfig.minInterval} minutes`);
        
        this.currentConfig = {
          ...this.currentConfig,
          ...newConfig,
          lastUpdate: new Date()
        };
      }

    } catch (error: any) {
      console.error('❌ DYNAMIC_SCHEDULER failed to update from AI:', error.message);
    }
  }

  /**
   * 🔄 CONVERT FREQUENCY TO SCHEDULE
   * Converts AI posts/day recommendation to concrete schedule parameters
   */
  private convertFrequencyToSchedule(
    postsPerDay: number, 
    strategy: string
  ): Partial<ScheduleConfig> {
    // Calculate base interval (distribute posts across 16 active hours)
    const activeHours = 16; // 6 AM to 10 PM
    const baseInterval = Math.floor((activeHours * 60) / postsPerDay);
    
    // Adjust based on strategy
    let minInterval = baseInterval;
    let dailyQuota = postsPerDay;
    let burstModeActive = false;

    switch (strategy) {
      case 'aggressive_growth':
        minInterval = Math.max(30, baseInterval * 0.8); // 20% more aggressive
        dailyQuota = Math.min(100, postsPerDay * 1.2); // Allow 20% overage
        burstModeActive = postsPerDay >= 20;
        break;
        
      case 'steady_optimization':
        minInterval = baseInterval; // Use calculated interval
        dailyQuota = postsPerDay;
        burstModeActive = false;
        break;
        
      case 'quality_focused':
        minInterval = Math.max(120, baseInterval * 1.5); // 50% more conservative
        dailyQuota = Math.max(3, Math.floor(postsPerDay * 0.8)); // 20% reduction
        burstModeActive = false;
        break;
        
      default:
        minInterval = Math.max(60, baseInterval);
        dailyQuota = Math.max(3, Math.min(20, postsPerDay));
        burstModeActive = false;
    }

    return {
      minInterval,
      dailyQuota,
      burstModeActive
    };
  }

  /**
   * 🎯 DETERMINE STRATEGY
   * Determines current posting strategy based on context
   */
  private determineStrategy(): 'burst' | 'steady' | 'conservative' | 'backoff' {
    const quotaUsed = this.currentConfig.currentQuota / this.currentConfig.dailyQuota;
    const hourOfDay = new Date().getHours();
    
    // Burst mode conditions
    if (this.currentConfig.burstModeActive && quotaUsed < 0.8 && hourOfDay >= 6 && hourOfDay <= 22) {
      return 'burst';
    }
    
    // Conservative during late hours or when quota is high
    if (hourOfDay > 22 || hourOfDay < 6 || quotaUsed > 0.9) {
      return 'conservative';
    }
    
    // Steady during normal hours
    if (quotaUsed <= 0.7) {
      return 'steady';
    }
    
    return 'conservative';
  }

  /**
   * ⏰ CALCULATE NEXT CHECK INTERVAL
   */
  private calculateNextCheckInterval(strategy: 'burst' | 'steady' | 'conservative' | 'backoff'): number {
    switch (strategy) {
      case 'burst': return Math.max(10, this.currentConfig.minInterval * 0.5);
      case 'steady': return this.currentConfig.minInterval;
      case 'conservative': return this.currentConfig.minInterval * 1.5;
      case 'backoff': return this.currentConfig.minInterval * 2;
      default: return this.currentConfig.minInterval;
    }
  }

  /**
   * 📊 RECORD POST COMPLETION
   * Call this when a post is actually made
   */
  public recordPostCompleted(): void {
    this.currentConfig.currentQuota += 1;
    console.log(`📊 DYNAMIC_SCHEDULER: Post recorded, quota: ${this.currentConfig.currentQuota}/${this.currentConfig.dailyQuota}`);
  }

  /**
   * ⚠️ ACTIVATE BACKOFF
   * Call this when there are posting failures
   */
  public activateBackoff(minutes: number, reason: string): void {
    this.currentConfig.backoffUntil = new Date(Date.now() + minutes * 60 * 1000);
    console.log(`⚠️ DYNAMIC_SCHEDULER: Backoff activated for ${minutes} min - ${reason}`);
  }

  /**
   * 🔄 CHECK DAILY RESET
   */
  private checkDailyReset(): void {
    const now = new Date();
    const lastUpdate = this.currentConfig.lastUpdate;
    
    if (now.getDate() !== lastUpdate.getDate() || now.getMonth() !== lastUpdate.getMonth()) {
      console.log('🔄 DYNAMIC_SCHEDULER: Daily reset - quota refreshed');
      this.currentConfig.currentQuota = 0;
      this.currentConfig.backoffUntil = null;
      this.currentConfig.lastUpdate = now;
    }
  }

  /**
   * 🤔 SHOULD UPDATE CONFIG
   */
  private shouldUpdateConfig(newConfig: Partial<ScheduleConfig>): boolean {
    const intervalChange = Math.abs((newConfig.minInterval || 0) - this.currentConfig.minInterval);
    const quotaChange = Math.abs((newConfig.dailyQuota || 0) - this.currentConfig.dailyQuota);
    
    // Update if changes are significant (>20% change)
    return intervalChange > this.currentConfig.minInterval * 0.2 || quotaChange > 2;
  }

  // Helper methods
  private async getMinutesSinceLastPost(): Promise<number> {
    try {
      const posts = await this.dataManager.getPostPerformance(1);
      if (posts.length === 0) return 999; // No posts, allow posting
      
      const lastPost = posts[0];
      const now = new Date();
      const lastPostTime = new Date(lastPost.postedAt);
      
      return Math.floor((now.getTime() - lastPostTime.getTime()) / 60000);
    } catch (error) {
      return 180; // Default to 3 hours if error
    }
  }

  private getMinutesUntilMidnight(): number {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setDate(midnight.getDate() + 1);
    midnight.setHours(0, 0, 0, 0);
    
    return Math.floor((midnight.getTime() - now.getTime()) / 60000);
  }

  /**
   * 📊 GET SCHEDULE STATUS
   */
  public getScheduleStatus(): {
    currentConfig: ScheduleConfig;
    nextOptimalTime: Date;
    efficiency: number;
    recommendation: string;
  } {
    const now = new Date();
    const nextOptimalTime = new Date(now.getTime() + this.currentConfig.minInterval * 60 * 1000);
    
    const efficiency = this.currentConfig.dailyQuota > 0 
      ? this.currentConfig.currentQuota / this.currentConfig.dailyQuota 
      : 0;

    let recommendation = 'Operating normally';
    if (efficiency > 0.9) recommendation = 'Near daily quota - consider quality focus';
    if (efficiency < 0.3) recommendation = 'Under-posting - consider increasing frequency';
    if (this.currentConfig.burstModeActive) recommendation = 'Burst mode active - maximize opportunities';

    return {
      currentConfig: this.currentConfig,
      nextOptimalTime,
      efficiency,
      recommendation
    };
  }
}

export const getDynamicScheduler = () => DynamicScheduler.getInstance();
