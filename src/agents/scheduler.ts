
import * as cron from 'node-cron';
import { PostTweetAgent } from './postTweet';

export class Scheduler {
  private postTweetAgent: PostTweetAgent;
  private isRunning = false;
  private intelligentCheckJob: cron.ScheduledTask | null = null;
  private dailyPostCount = 0;
  private lastPostTime: Date | null = null;
  private targetDailyPosts = 17; // Maximize daily posting for growth
  private lastResetDate: string | null = null;

  constructor() {
    this.postTweetAgent = new PostTweetAgent();
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
    console.log('🍌 Checking for immediate posting opportunity...');
    await this.checkAndPost();

    // Check every 10 minutes for maximum responsiveness (6x per hour)
    this.intelligentCheckJob = cron.schedule('*/10 * * * *', async () => {
      try {
        console.log('🍌 High-frequency check for posting...');
        await this.checkAndPost();
      } catch (error) {
        console.error('❌ Scheduler error:', error);
      }
    });

    console.log('✅ HIGH-FREQUENCY Scheduler started - checking every 10 minutes');
    console.log('🎯 Intelligent spacing: ~50 minutes between posts');
    console.log('🍌 Focus: "Eat 2 bananas daily" style content ONLY');
    console.log('⏰ Active hours: 6 AM - 11 PM (17 hour window)');
  }

  private resetDailyCountIfNeeded(): void {
    const today = new Date().toDateString();
    if (this.lastResetDate !== today) {
      this.dailyPostCount = 0;
      this.lastResetDate = today;
      console.log(`🔄 Daily counter reset - Target: ${this.targetDailyPosts} posts today`);
    }
  }

  private async checkAndPost(): Promise<void> {
    // Reset counter if new day
    this.resetDailyCountIfNeeded();
    
    const now = new Date();
    const hour = now.getHours();
    const currentMinutes = now.getMinutes();
    
    // Active posting hours: 6 AM to 11 PM (17 hours)
    const isActiveHours = hour >= 6 && hour <= 23;
    
    if (!isActiveHours) {
      console.log(`😴 Outside active hours (6 AM - 11 PM). Current: ${hour}:${currentMinutes.toString().padStart(2, '0')}`);
      return;
    }

    // Check if we've hit daily limit
    if (this.dailyPostCount >= this.targetDailyPosts) {
      console.log(`✅ Daily target reached! Posted ${this.dailyPostCount}/${this.targetDailyPosts} times today`);
      return;
    }

    // Calculate optimal timing
    const shouldPost = this.shouldPostNow(now);
    
    if (shouldPost) {
      console.log(`🎯 POSTING NOW (${this.dailyPostCount + 1}/${this.targetDailyPosts})`);
      console.log('🍌 Generating banana-style simple health tip...');
      
      const result = await this.postTweetAgent.run();
      
      if (result.success) {
        this.dailyPostCount++;
        this.lastPostTime = now;
        
        console.log('✅ Simple health tip posted successfully!');
        console.log(`📝 Content: "${result.content}"`);
        console.log(`📊 Daily progress: ${this.dailyPostCount}/${this.targetDailyPosts} posts`);
        console.log(`⏰ Next post in ~${this.getMinutesToNextPost()} minutes`);
      } else {
        console.log('❌ Post failed:', result.error);
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

  async stop(): Promise<void> {
    console.log('🛑 Stopping high-frequency scheduler...');
    this.isRunning = false;
    
    if (this.intelligentCheckJob) {
      this.intelligentCheckJob.stop();
      this.intelligentCheckJob = null;
    }
    
    console.log('✅ High-frequency scheduler stopped');
    console.log(`📊 Final daily count: ${this.dailyPostCount}/${this.targetDailyPosts} posts`);
  }
}

export const scheduler = new Scheduler();
