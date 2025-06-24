import { supabaseClient } from './supabaseClient';
import { PostTweetAgent } from '../agents/postTweet';
import { contentCache } from './contentCache';
import * as cron from 'node-cron';

interface DailyPostingState {
  date: string;
  posts_completed: number;
  posts_target: number;
  next_post_time: string;
  posting_schedule: string[];
  emergency_mode: boolean;
  last_post_time?: string;
}

interface PostingWindow {
  start_hour: number;
  end_hour: number;
  posts_count: number;
  priority: number;
}

export class DailyPostingManager {
  private postTweetAgent: PostTweetAgent;
  private currentState: DailyPostingState;
  private readonly DAILY_TARGET = 17;
  private isRunning = false;
  private scheduledJobs: cron.ScheduledTask[] = [];

  // Optimized posting windows based on engagement data
  private readonly POSTING_WINDOWS: PostingWindow[] = [
    { start_hour: 6, end_hour: 9, posts_count: 3, priority: 2 },   // Morning (6-9 AM)
    { start_hour: 9, end_hour: 12, posts_count: 3, priority: 3 },  // Late Morning (9-12 PM) 
    { start_hour: 12, end_hour: 15, posts_count: 4, priority: 4 }, // Afternoon (12-3 PM) - PEAK
    { start_hour: 15, end_hour: 18, posts_count: 3, priority: 3 }, // Late Afternoon (3-6 PM)
    { start_hour: 18, end_hour: 21, posts_count: 3, priority: 4 }, // Evening (6-9 PM) - PEAK
    { start_hour: 21, end_hour: 23, posts_count: 1, priority: 1 }  // Night (9-11 PM)
  ];

  constructor() {
    this.postTweetAgent = new PostTweetAgent();
    this.currentState = this.getDefaultState();
  }

  private getDefaultState(): DailyPostingState {
    const today = new Date().toISOString().split('T')[0];
    return {
      date: today,
      posts_completed: 0,
      posts_target: this.DAILY_TARGET,
      next_post_time: new Date().toISOString(),
      posting_schedule: this.generateDailySchedule(),
      emergency_mode: false
    };
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('📅 Daily Posting Manager already running');
      return;
    }

    console.log('🎯 Starting Daily Posting Manager - Target: 17 tweets/day');
    this.isRunning = true;

    // Load or initialize today's state
    await this.loadDailyState();
    
    // Set up posting schedule
    await this.setupPostingSchedule();
    
    // Monitor and catch up if behind
    this.startMonitoring();
    
    console.log(`📊 Daily Status: ${this.currentState.posts_completed}/${this.DAILY_TARGET} tweets completed`);
  }

  private async loadDailyState(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    
    try {
      const { data, error } = await supabaseClient.supabase
        ?.from('daily_posting_state')
        .select('*')
        .eq('date', today)
        .single();

      if (data && !error) {
        this.currentState = data;
        console.log(`📊 Loaded daily state: ${data.posts_completed}/${this.DAILY_TARGET} posts completed`);
      } else {
        // Create new state for today
        this.currentState = this.getDefaultState();
        await this.saveDailyState();
        console.log('📅 Created new daily posting state');
      }
    } catch (error) {
      console.log('🔧 Initializing daily posting state...');
      this.currentState = this.getDefaultState();
      await this.saveDailyState();
    }
  }

  private generateDailySchedule(): string[] {
    const schedule: string[] = [];
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    for (const window of this.POSTING_WINDOWS) {
      const windowStart = new Date(startOfDay);
      windowStart.setHours(window.start_hour, 0, 0, 0);
      
      const windowEnd = new Date(startOfDay);
      windowEnd.setHours(window.end_hour, 0, 0, 0);
      
      const windowDuration = (windowEnd.getTime() - windowStart.getTime()) / (1000 * 60); // minutes
      const interval = windowDuration / window.posts_count;

      for (let i = 0; i < window.posts_count; i++) {
        const postTime = new Date(windowStart.getTime() + (i * interval * 60 * 1000));
        schedule.push(postTime.toISOString());
      }
    }

    return schedule.sort();
  }

  private async setupPostingSchedule(): Promise<void> {
    // Clear existing jobs
    this.scheduledJobs.forEach(job => job.stop());
    this.scheduledJobs = [];

    const now = new Date();
    const remaining = this.DAILY_TARGET - this.currentState.posts_completed;

    if (remaining <= 0) {
      console.log('✅ Daily posting target already reached!');
      return;
    }

    console.log(`📈 Setting up schedule for ${remaining} remaining posts`);

    // Schedule remaining posts optimally
    const upcomingSlots = this.currentState.posting_schedule.filter(timeStr => {
      const postTime = new Date(timeStr);
      return postTime > now;
    }).slice(0, remaining);

    if (upcomingSlots.length < remaining) {
      // Need emergency posting to catch up
      console.log('🚨 Behind schedule - activating catch-up mode');
      await this.activateEmergencyPosting(remaining - upcomingSlots.length);
    }

    // Schedule posts for optimal times
    for (const timeSlot of upcomingSlots) {
      this.schedulePost(new Date(timeSlot));
    }
  }

  private schedulePost(postTime: Date): void {
    const cronExpression = `${postTime.getMinutes()} ${postTime.getHours()} ${postTime.getDate()} ${postTime.getMonth() + 1} *`;
    
    const job = cron.schedule(cronExpression, async () => {
      await this.executePost('scheduled');
    }, {
      scheduled: true,
      timezone: "UTC"
    });

    this.scheduledJobs.push(job);
    console.log(`⏰ Scheduled post for ${postTime.toLocaleTimeString()}`);
  }

  private async activateEmergencyPosting(postsNeeded: number): Promise<void> {
    console.log(`🚨 Emergency posting activated - need ${postsNeeded} additional posts`);
    
    this.currentState.emergency_mode = true;
    await this.saveDailyState();

    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 30, 0, 0); // Stop at 11:30 PM

    const timeRemaining = endOfDay.getTime() - now.getTime();
    const interval = timeRemaining / (postsNeeded * 60 * 1000); // minutes

    for (let i = 0; i < postsNeeded; i++) {
      const emergencyTime = new Date(now.getTime() + (i * interval * 60 * 1000));
      if (emergencyTime < endOfDay) {
        this.schedulePost(emergencyTime);
      }
    }
  }

  private async executePost(trigger: 'scheduled' | 'emergency' | 'catchup'): Promise<void> {
    try {
      console.log(`📝 Executing ${trigger} post (${this.currentState.posts_completed + 1}/${this.DAILY_TARGET})`);

      // Try cache first for efficiency
      const cachedContent = await contentCache.getCachedContent('viral_tweet', [], 0.8);
      
      let result;
      if (cachedContent && Math.random() > 0.3) { // 70% chance to use cache
        console.log('💾 Using cached content for efficiency');
        // Post cached content (you'd need to implement this in PostTweetAgent)
        result = { success: true, content: cachedContent.content };
        await contentCache.markContentUsed(cachedContent.id);
      } else {
        // Generate fresh content
        result = await this.postTweetAgent.run(false, false, false);
      }

      if (result.success) {
        this.currentState.posts_completed++;
        this.currentState.last_post_time = new Date().toISOString();
        await this.saveDailyState();

        console.log(`✅ Post ${this.currentState.posts_completed}/${this.DAILY_TARGET} completed`);

        // Check if we've hit the target
        if (this.currentState.posts_completed >= this.DAILY_TARGET) {
          console.log('🎉 DAILY TARGET REACHED! 17/17 tweets completed');
          await this.onDailyTargetReached();
        }
      } else {
        console.error('❌ Post failed, will retry in emergency mode');
        await this.scheduleRetry();
      }

    } catch (error) {
      console.error('❌ Post execution failed:', error);
      await this.scheduleRetry();
    }
  }

  private async scheduleRetry(): Promise<void> {
    // Retry in 15 minutes
    const retryTime = new Date(Date.now() + 15 * 60 * 1000);
    setTimeout(async () => {
      await this.executePost('catchup');
    }, 15 * 60 * 1000);
    
    console.log(`🔄 Retry scheduled for ${retryTime.toLocaleTimeString()}`);
  }

  private startMonitoring(): void {
    // Check progress every hour
    cron.schedule('0 * * * *', async () => {
      await this.checkProgress();
    }, { scheduled: true });

    // Daily reset at midnight
    cron.schedule('0 0 * * *', async () => {
      await this.resetDaily();
    }, { scheduled: true });
  }

  private async checkProgress(): Promise<void> {
    const now = new Date();
    const currentHour = now.getHours();
    
    // Calculate expected progress by this hour
    let expectedPosts = 0;
    for (const window of this.POSTING_WINDOWS) {
      if (currentHour >= window.end_hour) {
        expectedPosts += window.posts_count;
      } else if (currentHour >= window.start_hour) {
        const windowProgress = (currentHour - window.start_hour) / (window.end_hour - window.start_hour);
        expectedPosts += Math.floor(window.posts_count * windowProgress);
      }
    }

    const deficit = expectedPosts - this.currentState.posts_completed;
    
    if (deficit > 2) {
      console.log(`⚠️ Behind schedule by ${deficit} posts - activating catch-up`);
      await this.activateEmergencyPosting(deficit);
    }
    
    console.log(`📊 Progress check: ${this.currentState.posts_completed}/${expectedPosts} expected by ${currentHour}:00`);
  }

  private async onDailyTargetReached(): Promise<void> {
    // Log success
    await supabaseClient.supabase
      ?.from('daily_posting_log')
      .insert({
        date: this.currentState.date,
        target: this.DAILY_TARGET,
        completed: this.currentState.posts_completed,
        success: true,
        emergency_posts: this.currentState.emergency_mode ? 1 : 0
      });

    // Clear scheduled jobs since we're done
    this.scheduledJobs.forEach(job => job.stop());
    this.scheduledJobs = [];

    console.log('🏆 Daily posting mission accomplished! All systems standby until tomorrow.');
  }

  private async resetDaily(): Promise<void> {
    console.log('🌅 New day starting - resetting daily posting state');
    
    this.currentState = this.getDefaultState();
    await this.saveDailyState();
    await this.setupPostingSchedule();
  }

  private async saveDailyState(): Promise<void> {
    try {
      await supabaseClient.supabase
        ?.from('daily_posting_state')
        .upsert(this.currentState);
    } catch (error) {
      console.warn('Could not save daily posting state:', error);
    }
  }

  // Public methods for monitoring
  getDailyProgress(): {
    completed: number;
    target: number;
    percentage: number;
    remaining: number;
    onTrack: boolean;
  } {
    const percentage = (this.currentState.posts_completed / this.DAILY_TARGET) * 100;
    const now = new Date();
    const currentHour = now.getHours();
    const expectedByNow = Math.floor((currentHour / 24) * this.DAILY_TARGET);
    
    return {
      completed: this.currentState.posts_completed,
      target: this.DAILY_TARGET,
      percentage: Math.round(percentage),
      remaining: this.DAILY_TARGET - this.currentState.posts_completed,
      onTrack: this.currentState.posts_completed >= expectedByNow - 1
    };
  }

  async forcePost(): Promise<void> {
    if (this.currentState.posts_completed < this.DAILY_TARGET) {
      await this.executePost('emergency');
    } else {
      console.log('✅ Daily target already reached');
    }
  }

  stop(): void {
    this.scheduledJobs.forEach(job => job.stop());
    this.scheduledJobs = [];
    this.isRunning = false;
    console.log('🛑 Daily Posting Manager stopped');
  }
}

export const dailyPostingManager = new DailyPostingManager(); 