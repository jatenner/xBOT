
import * as cron from 'node-cron';
import { PostTweetAgent } from './postTweet';
import { RealEngagementAgent } from './realEngagementAgent';
import { AggressiveFollowerGrowthAgent } from './aggressiveFollowerGrowthAgent';
import { FollowerGrowthDiagnostic } from './followerGrowthDiagnostic';
import { secureSupabaseClient } from '../utils/secureSupabaseClient';
import { TwitterQuotaManager } from '../utils/twitterQuotaManager';
import { intelligentQuotaScheduler } from '../utils/intelligentQuotaScheduler';

export class Scheduler {
  private postTweetAgent: PostTweetAgent;
  private realEngagementAgent: RealEngagementAgent;
  private aggressiveGrowthAgent: AggressiveFollowerGrowthAgent;
  private growthDiagnostic: FollowerGrowthDiagnostic;
  private quotaManager: TwitterQuotaManager;
  private dailyPostCount = 0;
  private targetDailyPosts = 17;
  private lastPostTime: Date | null = null;
  private lastResetDate: string | null = null;
  
  // Rate limiting
  private consecutiveRateLimitErrors = 0;
  private lastRateLimitTime: Date | null = null;
  
  // Cron jobs
  private postingJob: cron.ScheduledTask | null = null;
  private engagementJob: cron.ScheduledTask | null = null;
  private growthJob: cron.ScheduledTask | null = null;
  private diagnosticJob: cron.ScheduledTask | null = null;

  constructor() {
    this.postTweetAgent = new PostTweetAgent();
    this.realEngagementAgent = new RealEngagementAgent();
    this.aggressiveGrowthAgent = new AggressiveFollowerGrowthAgent();
    this.growthDiagnostic = new FollowerGrowthDiagnostic();
    this.quotaManager = TwitterQuotaManager.getInstance();
    this.resetDailyCountIfNeeded();
  }

  async start(): Promise<void> {
    try {
      console.log('🚀 Starting HIGH-FREQUENCY Simple Health Bot Scheduler...');
      console.log('🎯 TARGET: 17 posts per day for maximum growth');

      // Check current time and set timezone
      const now = new Date();
      const serverTime = now.toISOString();
      const estTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
      
      console.log(`🕐 Server time: ${serverTime.split('T')[1].split('.')[0]} UTC`);
      console.log(`🗽 EST time: ${estTime.getHours()}:${estTime.getMinutes().toString().padStart(2, '0')} EST`);

      // Get ACTUAL daily post count from database
      const todaysActualCount = await this.getTodaysPostCount();
      this.dailyPostCount = todaysActualCount;
      
      console.log(`📊 REAL Daily progress: ${this.dailyPostCount}/${this.targetDailyPosts} posts (from database)`);
      
      if (this.dailyPostCount >= this.targetDailyPosts) {
        console.log('🎯 Daily target already reached! Will continue with engagement and optimization.');
      }

      // Run initial diagnostics
      console.log('🔍 Running initial follower growth diagnostic...');
      await this.growthDiagnostic.runCompleteGrowthAudit();

      // Check if we should post now
      await this.checkAndPost();

      // Schedule regular checks
      this.postingJob = cron.schedule('*/10 * * * *', async () => {
        await this.checkAndPost();
      });

      // 🔔 QUOTA RESET MONITORING: Check every 5 minutes for quota resets
      const quotaMonitorJob = cron.schedule('*/5 * * * *', async () => {
        const quotaCheck = await intelligentQuotaScheduler.checkQuotaReset();
        if (quotaCheck.hasReset) {
          console.log('🚀 QUOTA RESET DETECTED! Triggering immediate posting check...');
          await this.checkAndPost();
        }
      });

      // Schedule engagement every 30 minutes
      this.engagementJob = cron.schedule('*/30 * * * *', async () => {
        console.log('🤝 Running real engagement cycle...');
        await this.realEngagementAgent.run();
      });

      // Schedule aggressive growth every 45 minutes
      this.growthJob = cron.schedule('*/45 * * * *', async () => {
        console.log('🚀 Running aggressive follower growth...');
        await this.aggressiveGrowthAgent.runAggressiveGrowthCycle();
      });

      // Schedule growth diagnostic every 4 hours
      this.diagnosticJob = cron.schedule('0 */4 * * *', async () => {
        console.log('📊 Running growth diagnostic...');
        await this.growthDiagnostic.runCompleteGrowthAudit();
      });

      const minutesToNext = this.getMinutesToNextPost();
      console.log(`🎯 Intelligent spacing: ~${minutesToNext} minutes between posts`);
      console.log('🔥 Content: Health news, supplements, fitness, biohacking, food tips - ANYTHING that gets followers');
      console.log('⏰ Active hours: 6 AM - 11 PM EST (17 hour window)');
      
      console.log('✅ HIGH-FREQUENCY Scheduler started - checking every 10 minutes');
      console.log('🤝 REAL ENGAGEMENT started - running every 30 minutes');
      console.log('🚀 AGGRESSIVE GROWTH started - running every 45 minutes');
      console.log('📊 GROWTH DIAGNOSTIC started - running every 4 hours');
      
      console.log('🎉 VIRAL HEALTH Twitter Bot is LIVE!');
      console.log('🔥 Generating diverse health content for maximum followers');
      console.log('📊 Check logs for posting activity every ~50 minutes');

    } catch (error) {
      console.error('❌ Scheduler start error:', error);
    }
  }

  private resetDailyCountIfNeeded(): void {
    // 🌐 TIMEZONE FIX: Use Eastern Time for daily reset (user is in New York)
    const estTime = new Date(new Date().toLocaleString("en-US", {timeZone: "America/New_York"}));
    const today = estTime.toDateString();
    if (this.lastResetDate !== today) {
      this.dailyPostCount = 0;
      this.lastResetDate = today;
      console.log(`🔄 Daily counter reset (EST) - Target: ${this.targetDailyPosts} posts today`);
    }
  }

  private async checkAndPost(): Promise<void> {
    // Reset counter if new day
    this.resetDailyCountIfNeeded();
    
    // 🧠 INTELLIGENT QUOTA MANAGEMENT: Check if quota has reset
    const quotaResetCheck = await intelligentQuotaScheduler.checkQuotaReset();
    if (quotaResetCheck.hasReset) {
      console.log('🚀 QUOTA RESET! Immediately posting first tweet of new cycle...');
      this.consecutiveRateLimitErrors = 0;
      this.lastRateLimitTime = null;
      // Continue to posting logic below
    }
    
    // Check rate limit backoff (but allow posting if quota reset)
    if (this.isInRateLimitBackoff() && !quotaResetCheck.hasReset) {
      const backoffMinutes = this.getRateLimitBackoffMinutes();
      console.log(`⏸️ Rate limit backoff active. Waiting ${backoffMinutes} more minutes before retry.`);
      
      // But check if quota reset during backoff
      if (backoffMinutes > 60) {
        const checkReset = await intelligentQuotaScheduler.checkQuotaReset();
        if (checkReset.hasReset) {
          console.log('🎉 Quota reset detected during backoff! Resuming posting...');
        } else {
          return;
        }
      } else {
        return;
      }
    }
    
    // 🧠 GET INTELLIGENT SCHEDULE
    const schedule = await intelligentQuotaScheduler.getOptimalSchedule();
    const now = new Date();
    const estTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
    const hour = estTime.getHours();
    const currentMinutes = estTime.getMinutes();
    
    console.log(`🕐 Server time: ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')} UTC`);
    console.log(`🗽 EST time: ${hour}:${currentMinutes.toString().padStart(2, '0')} EST`);
    
    // 📊 ULTIMATE QUOTA STATUS REPORT - Using database truth
    const { UltimateQuotaManager } = await import('../utils/ultimateQuotaManager');
    const ultimateStatus = await UltimateQuotaManager.getQuotaStatus();
    
    console.log(`📊 QUOTA STATUS: ${ultimateStatus.daily_used}/${ultimateStatus.daily_limit} used (${ultimateStatus.percentage_used}%)`);
    console.log(`🎯 STRATEGY: ${schedule.strategy.toUpperCase()} - ${ultimateStatus.can_post ? 'CAN POST' : 'QUOTA EXHAUSTED'}`);
    console.log(`⏰ NEXT OPTIMAL: ${schedule.nextPostTime.toLocaleTimeString()} EST (${schedule.optimalInterval}min interval)`);
    
    // Active posting hours: 6 AM to 11 PM EST (17 hours)
    const isActiveHours = hour >= 6 && hour <= 23;
    
    if (!isActiveHours) {
      console.log(`😴 Outside active hours (6 AM - 11 PM EST). Current EST: ${hour}:${currentMinutes.toString().padStart(2, '0')}`);
      
      // If we have remaining quota and it's close to end of day, warn
      if (schedule.postsRemaining > 3) {
        console.log(`⚠️ WARNING: ${schedule.postsRemaining} tweets unused! Consider extending active hours.`);
      }
      return;
    }
    
    console.log(`🌞 ACTIVE HOURS: ${hour}:${currentMinutes.toString().padStart(2, '0')} EST is within 6 AM - 11 PM posting window`);

    // ✅ ULTIMATE QUOTA CHECK: Use database truth instead of broken estimates
    if (!ultimateStatus.can_post) {
      const hoursUntilReset = Math.ceil((ultimateStatus.reset_time.getTime() - Date.now()) / (1000 * 60 * 60));
      console.log(`🚫 QUOTA EXHAUSTED: All 17 daily tweets used!`);
      console.log(`⏰ Quota resets in ~${hoursUntilReset} hours at ${ultimateStatus.reset_time.toLocaleTimeString()}`);
      console.log(`📊 Switching to engagement-only mode until quota resets`);
      console.log(`🎯 Will automatically resume posting when quota resets`);
      
      // Set a check for closer to reset time
      const minutesUntilReset = Math.ceil((ultimateStatus.reset_time.getTime() - Date.now()) / (1000 * 60));
      if (minutesUntilReset <= 30) {
        console.log(`🔔 Quota resets in ${minutesUntilReset} minutes - preparing for immediate resumption!`);
      }
      
      return;
    }

    // 🧠 ULTIMATE POSTING DECISION: Use database truth + intelligent timing
    const shouldPost = schedule.shouldPostNow && ultimateStatus.can_post;
    
    if (shouldPost) {
      console.log(`🎯 POSTING NOW (${ultimateStatus.daily_used + 1}/17) - Strategy: ${schedule.strategy}`);
      console.log('🔥 Generating viral health content - maximizing our 17 daily tweets...');
      
      try {
        await this.postTweetAgent.run();
        
        // If we get here, posting was successful
        this.dailyPostCount++;
        this.lastPostTime = now;
        
        // ✅ ENHANCED: Record the post in quota manager
        await this.quotaManager.recordPost();
        
        // Reset rate limit tracking on success
        this.consecutiveRateLimitErrors = 0;
        this.lastRateLimitTime = null;
        
        // 📊 POST-SUCCESS ANALYSIS - ULTIMATE ACCURACY
        const updatedStatus = await UltimateQuotaManager.forceRefresh();
        console.log(`📊 Updated quota: ${updatedStatus.daily_used}/17 used, ${updatedStatus.daily_remaining} remaining`);
        console.log(`⏰ Next optimal post: ${schedule.nextPostTime.toLocaleTimeString()} EST`);
        
        // 🎯 STRATEGIC MESSAGING
        if (updatedStatus.daily_remaining === 0) {
          console.log(`🎉 ALL 17 DAILY TWEETS USED! Perfect quota utilization achieved!`);
        } else if (updatedStatus.daily_remaining <= 3 && schedule.hoursRemaining <= 3) {
          console.log(`🔥 FINAL PUSH: ${updatedStatus.daily_remaining} tweets remaining with ${schedule.hoursRemaining.toFixed(1)} active hours left!`);
        }
        
      } catch (error) {
        console.log('❌ Post failed:', error);
        
        // Check if this is a rate limit error
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('429')) {
          // ✅ ENHANCED: Refresh quota on rate limit to get accurate data
          await this.quotaManager.refreshQuota();
          await this.handleRateLimitError();
        }
      }
    } else {
      const timeToNext = Math.ceil((schedule.nextPostTime.getTime() - Date.now()) / (1000 * 60));
      console.log(`⏰ INTELLIGENT TIMING: Next post in ${timeToNext} minutes at ${schedule.nextPostTime.toLocaleTimeString()}`);
      console.log(`📊 Current: ${ultimateStatus.daily_used}/17 used, ${schedule.postsRemaining} remaining, ${schedule.hoursRemaining.toFixed(1)}h left`);
      console.log(`🎯 Strategy: ${schedule.strategy} - optimal distribution for maximum daily utilization`);
    }
  }

  private shouldPostNow(now: Date): boolean {
    // If this is our first post today, post immediately
    if (this.dailyPostCount === 0) {
      return true;
    }

    // If we don't have a last post time, post now
    if (!this.lastPostTime) {
      return true;
    }

    // Calculate ideal interval (17 posts across 17 active hours = ~50 minutes per post)
    const idealIntervalMs = (17 * 60 * 60 * 1000) / this.targetDailyPosts; // ~50 minutes
    const timeSinceLastPost = now.getTime() - this.lastPostTime.getTime();

    // Add some flexibility (±10 minutes)
    const minInterval = idealIntervalMs - (10 * 60 * 1000); // 40 minutes min
    const maxInterval = idealIntervalMs + (10 * 60 * 1000); // 60 minutes max

    // Post if we're past minimum interval
    if (timeSinceLastPost >= minInterval) {
      return true;
    }

    // Catch-up logic: If we're behind schedule, be more aggressive
    const remainingHours = this.getRemainingActiveHours(now);
    const remainingPosts = this.targetDailyPosts - this.dailyPostCount;
    
    if (remainingHours > 0 && remainingPosts > 0) {
      const requiredInterval = (remainingHours * 60 * 60 * 1000) / remainingPosts;
      
      // If we need to post more frequently to hit target, do it
      if (timeSinceLastPost >= requiredInterval) {
        console.log('🚀 Catch-up mode: Posting to meet daily target');
        return true;
      }
    }

    return false;
  }

  private getRemainingActiveHours(now: Date): number {
    const currentHour = now.getHours();
    const endHour = 23; // 11 PM
    
    if (currentHour >= endHour) {
      return 0;
    }
    
    return endHour - currentHour;
  }

  private getMinutesToNextPost(): number {
    if (!this.lastPostTime) {
      return 0;
    }

    const now = new Date();
    const idealIntervalMs = (17 * 60 * 60 * 1000) / this.targetDailyPosts; // ~50 minutes
    const timeSinceLastPost = now.getTime() - this.lastPostTime.getTime();
    const timeToNextPost = idealIntervalMs - timeSinceLastPost;

    return Math.max(0, Math.round(timeToNextPost / (60 * 1000)));
  }

  private async handleRateLimitError(): Promise<void> {
    this.consecutiveRateLimitErrors++;
    this.lastRateLimitTime = new Date();
    
    // ✅ ENHANCED: Get accurate quota information
    const quota = await this.quotaManager.getCurrentQuota();
    const timeUntilReset = await this.quotaManager.getTimeUntilReset();
    const resetHours = Math.ceil(timeUntilReset / (1000 * 60 * 60));
    
    if (quota.isExhausted) {
      console.log(`🚫 DAILY QUOTA EXHAUSTED: Used ${quota.dailyUsed}/${quota.dailyLimit} tweets`);
      console.log(`⏰ Quota resets in ~${resetHours} hours at ${quota.resetTime.toLocaleTimeString()}`);
      console.log(`📊 Bot will focus on engagement until quota resets`);
      
      // Set a longer backoff for quota exhaustion
      this.consecutiveRateLimitErrors = 10; // Force max backoff
    } else {
      const backoffMinutes = Math.min(30, this.consecutiveRateLimitErrors * 5); // 5, 10, 15, 20, 25, 30 minutes max
      
      console.log(`🚫 Rate limit detected! Backing off for ${backoffMinutes} minutes (error #${this.consecutiveRateLimitErrors})`);
      console.log(`📊 This preserves API quota for engagement system`);
      console.log(`📊 Quota status: ${quota.dailyUsed}/${quota.dailyLimit} used, ${quota.dailyRemaining} remaining`);
      
      if (this.consecutiveRateLimitErrors >= 5) {
        console.log(`⚠️ Multiple rate limits detected. Daily posting may be exhausted.`);
        console.log(`🎯 Focus will shift to engagement-only mode until tomorrow`);
      }
    }
  }

  private isInRateLimitBackoff(): boolean {
    if (!this.lastRateLimitTime || this.consecutiveRateLimitErrors === 0) {
      return false;
    }
    
    const backoffMinutes = Math.min(30, this.consecutiveRateLimitErrors * 5);
    const backoffMs = backoffMinutes * 60 * 1000;
    const timeSinceRateLimit = Date.now() - this.lastRateLimitTime.getTime();
    
    return timeSinceRateLimit < backoffMs;
  }

  private getRateLimitBackoffMinutes(): number {
    if (!this.lastRateLimitTime) return 0;
    
    const backoffMinutes = Math.min(30, this.consecutiveRateLimitErrors * 5);
    const backoffMs = backoffMinutes * 60 * 1000;
    const timeSinceRateLimit = Date.now() - this.lastRateLimitTime.getTime();
    const remainingMs = backoffMs - timeSinceRateLimit;
    
    return Math.max(0, Math.round(remainingMs / (60 * 1000)));
  }

  private async getTodaysPostCount(): Promise<number> {
    try {
      // Get today's start in EST timezone
      const now = new Date();
      const estNow = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
      
      // Start of today in EST (midnight EST)
      const todayStartEST = new Date(estNow.getFullYear(), estNow.getMonth(), estNow.getDate());
      
      // Convert to UTC for database query
      const estOffset = estNow.getTimezoneOffset() + 240; // EST is UTC-5 (300 minutes), but we want the opposite
      const todayStartUTC = new Date(todayStartEST.getTime() + (estOffset * 60000));
      
      console.log(`🔍 Checking posts since today's start (EST): ${todayStartUTC.toISOString()}`);

      const { data, error } = await secureSupabaseClient.supabase
        ?.from('tweets')
        .select('tweet_id, created_at, content')
        .gte('created_at', todayStartUTC.toISOString())
        .order('created_at', { ascending: false }) || { data: null, error: null };

      if (error) {
        console.warn('⚠️ Could not fetch today\'s posts:', error);
        return 0;
      }

      const count = data?.length || 0;
      console.log(`🔍 Database check: Found ${count} posts since today's start (EST)`);
      
      // Log recent posts for verification
      if (data && data.length > 0) {
        console.log('📋 Today\'s posts:');
        data.slice(0, 5).forEach((tweet, i) => {
          const tweetTime = new Date(tweet.created_at);
          const estTime = tweetTime.toLocaleString("en-US", {timeZone: "America/New_York"});
          console.log(`  ${i + 1}. ${estTime} EST - ${tweet.content.substring(0, 60)}...`);
        });
      }
      
      return count;

    } catch (error) {
      console.error('❌ Error getting today\'s post count:', error);
      return 0;
    }
  }

  async stop(): Promise<void> {
    console.log('🛑 Stopping high-frequency scheduler...');
    
    if (this.postingJob) {
      this.postingJob.stop();
      this.postingJob = null;
    }
    
    if (this.engagementJob) {
      this.engagementJob.stop();
      this.engagementJob = null;
    }

    if (this.growthJob) {
      this.growthJob.stop();
      this.growthJob = null;
    }

    if (this.diagnosticJob) {
      this.diagnosticJob.stop();
      this.diagnosticJob = null;
    }
    
    console.log('✅ High-frequency scheduler stopped');
    console.log('✅ Real engagement agent stopped');
    console.log('✅ Aggressive growth agent stopped');
    console.log('✅ Growth diagnostic stopped');
    console.log(`📊 Final daily count: ${this.dailyPostCount}/${this.targetDailyPosts} posts`);
  }
}

export const scheduler = new Scheduler();