
import * as cron from 'node-cron';
import { PostTweetAgent } from './postTweet';
import { RealEngagementAgent } from './realEngagementAgent';

export class Scheduler {
  private postTweetAgent: PostTweetAgent;
  private realEngagementAgent: RealEngagementAgent;
  private isRunning = false;
  private intelligentCheckJob: cron.ScheduledTask | null = null;
  private engagementJob: cron.ScheduledTask | null = null;
  private dailyPostCount = 0;
  private lastPostTime: Date | null = null;
  private targetDailyPosts = 17; // Maximize daily posting for growth
  private lastResetDate: string | null = null;
  private consecutiveRateLimitErrors = 0;
  private lastRateLimitTime: Date | null = null;

  constructor() {
    this.postTweetAgent = new PostTweetAgent();
    this.realEngagementAgent = new RealEngagementAgent();
    this.resetDailyCountIfNeeded();
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Scheduler is already running');
      return;
    }

    console.log('🚀 Starting HIGH-FREQUENCY Simple Health Bot Scheduler...');
    console.log(`🎯 TARGET: ${this.targetDailyPosts} posts per day for maximum growth`);
    this.isRunning = true;

    // Reset daily counter if needed
    this.resetDailyCountIfNeeded();

    // Post immediately if we're behind schedule
    console.log('🔥 Checking for immediate viral health posting opportunity...');
    await this.checkAndPost();

    // Check every 10 minutes for maximum responsiveness (6x per hour)
    this.intelligentCheckJob = cron.schedule('*/10 * * * *', async () => {
      try {
        console.log('🔥 High-frequency check for viral health posting...');
        await this.checkAndPost();
      } catch (error) {
        console.error('❌ Scheduler error:', error);
      }
    });

    // 🤝 REAL ENGAGEMENT: Run every 30 minutes
    this.engagementJob = cron.schedule('*/30 * * * *', async () => {
      try {
        console.log('🤝 === REAL ENGAGEMENT CYCLE ===');
        const result = await this.realEngagementAgent.run();
        
        if (result.success) {
          console.log(`✅ Engagement cycle complete: ${result.message}`);
          const successful = result.actions.filter(a => a.success);
          if (successful.length > 0) {
            console.log(`🎯 Real Twitter actions performed: ${successful.length}`);
            successful.forEach(action => {
              console.log(`   ${action.action_type === 'like' ? '❤️' : action.action_type === 'reply' ? '💬' : action.action_type === 'follow' ? '👥' : '🔄'} ${action.action_type} → ${action.target_type} ${action.target_id}`);
            });
          }
        } else {
          console.log(`❌ Engagement cycle failed: ${result.message}`);
        }
      } catch (error) {
        console.error('❌ Engagement error:', error);
      }
    });

    console.log('✅ HIGH-FREQUENCY Scheduler started - checking every 10 minutes');
    console.log('🤝 REAL ENGAGEMENT started - running every 30 minutes');
    console.log('🎯 Intelligent spacing: ~50 minutes between posts');
    console.log('🔥 Content: Health news, supplements, fitness, biohacking, food tips - ANYTHING that gets followers');
    console.log('⏰ Active hours: 6 AM - 11 PM EST (17 hour window)');
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
    
    // Check rate limit backoff
    if (this.isInRateLimitBackoff()) {
      const backoffMinutes = this.getRateLimitBackoffMinutes();
      console.log(`⏸️ Rate limit backoff active. Waiting ${backoffMinutes} more minutes before retry.`);
      return;
    }
    
    // 🌐 TIMEZONE FIX: Convert to Eastern Time (user is in New York)
    const now = new Date();
    const estTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
    const hour = estTime.getHours();
    const currentMinutes = estTime.getMinutes();
    
    console.log(`🕐 Server time: ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')} UTC`);
    console.log(`🗽 EST time: ${hour}:${currentMinutes.toString().padStart(2, '0')} EST`);
    
    // Active posting hours: 6 AM to 11 PM EST (17 hours)
    const isActiveHours = hour >= 6 && hour <= 23;
    
    if (!isActiveHours) {
      console.log(`😴 Outside active hours (6 AM - 11 PM EST). Current EST: ${hour}:${currentMinutes.toString().padStart(2, '0')}`);
      return;
    }
    
    console.log(`🌞 ACTIVE HOURS: ${hour}:${currentMinutes.toString().padStart(2, '0')} EST is within 6 AM - 11 PM posting window`);

    // Check if we've hit daily limit
    if (this.dailyPostCount >= this.targetDailyPosts) {
      console.log(`✅ Daily target reached! Posted ${this.dailyPostCount}/${this.targetDailyPosts} times today`);
      return;
    }

    // Calculate optimal timing (using EST time)
    const shouldPost = this.shouldPostNow(estTime);
    
    if (shouldPost) {
      console.log(`🎯 POSTING NOW (${this.dailyPostCount + 1}/${this.targetDailyPosts})`);
      console.log('🔥 Generating viral health content - news, supplements, fitness, biohacking, food tips...');
      
      const result = await this.postTweetAgent.run();
      
      if (result.success) {
        this.dailyPostCount++;
        this.lastPostTime = now;
        
        // Reset rate limit tracking on success
        this.consecutiveRateLimitErrors = 0;
        this.lastRateLimitTime = null;
        
        console.log('✅ Simple health tip posted successfully!');
        console.log(`📝 Content: "${result.content}"`);
        console.log(`📊 Daily progress: ${this.dailyPostCount}/${this.targetDailyPosts} posts`);
        console.log(`⏰ Next post in ~${this.getMinutesToNextPost()} minutes`);
      } else {
        console.log('❌ Post failed:', result.error);
        
        // Check if this is a rate limit error
        if (result.error && result.error.includes('429')) {
          this.handleRateLimitError();
        }
      }
    } else {
      const nextPostTime = this.getMinutesToNextPost();
      console.log(`⏰ Waiting for optimal timing. Next post in ~${nextPostTime} minutes (${this.dailyPostCount}/${this.targetDailyPosts} posted today)`);
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

  private handleRateLimitError(): void {
    this.consecutiveRateLimitErrors++;
    this.lastRateLimitTime = new Date();
    
    const backoffMinutes = Math.min(30, this.consecutiveRateLimitErrors * 5); // 5, 10, 15, 20, 25, 30 minutes max
    
    console.log(`🚫 Rate limit detected! Backing off for ${backoffMinutes} minutes (error #${this.consecutiveRateLimitErrors})`);
    console.log(`📊 This preserves API quota for engagement system`);
    
    if (this.consecutiveRateLimitErrors >= 5) {
      console.log(`⚠️ Multiple rate limits detected. Daily posting may be exhausted.`);
      console.log(`🎯 Focus will shift to engagement-only mode until tomorrow`);
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

  async stop(): Promise<void> {
    console.log('🛑 Stopping high-frequency scheduler...');
    this.isRunning = false;
    
    if (this.intelligentCheckJob) {
      this.intelligentCheckJob.stop();
      this.intelligentCheckJob = null;
    }
    
    if (this.engagementJob) {
      this.engagementJob.stop();
      this.engagementJob = null;
    }
    
    console.log('✅ High-frequency scheduler stopped');
    console.log('✅ Real engagement agent stopped');
    console.log(`📊 Final daily count: ${this.dailyPostCount}/${this.targetDailyPosts} posts`);
  }
}

export const scheduler = new Scheduler();
