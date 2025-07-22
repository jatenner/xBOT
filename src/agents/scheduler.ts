
import * as cron from 'node-cron';
import { PostTweetAgent } from './postTweet';

export class Scheduler {
  private postTweetAgent: PostTweetAgent;
  private isRunning = false;
  private intelligentCheckJob: cron.ScheduledTask | null = null;

  constructor() {
    this.postTweetAgent = new PostTweetAgent();
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Scheduler is already running');
      return;
    }

    console.log('🚀 Starting Simple Health Bot Scheduler...');
    this.isRunning = true;

    // Post immediately if we're in an optimal window or it's been a while
    console.log('🍌 Checking for immediate posting opportunity...');
    await this.checkAndPost();

    // Check every 15 minutes for posting opportunities (more frequent)
    this.intelligentCheckJob = cron.schedule('*/15 * * * *', async () => {
      try {
        console.log('🍌 Scheduled check for posting...');
        await this.checkAndPost();
      } catch (error) {
        console.error('❌ Scheduler error:', error);
      }
    });

    console.log('✅ Scheduler started - checking every 15 minutes');
    console.log('🎯 Simple health tips will post throughout the day');
    console.log('🍌 Focus: "Eat 2 bananas daily" style content ONLY');
  }

  private async checkAndPost(): Promise<void> {
    const now = new Date();
    const hour = now.getHours();
    
    // Optimal health content times: 7AM, 12PM, 3PM, 6PM, 8PM (expanded for more posts)
    const optimalHours = [7, 12, 15, 18, 20];
    
    // Also allow posting if it's been more than 3 hours since optimal time
    const currentMinutes = now.getMinutes();
    const shouldPostAnyway = currentMinutes < 30; // First 30 mins of any hour
    
    if (optimalHours.includes(hour) || shouldPostAnyway) {
      console.log('🎯 Posting simple health content now...');
      console.log('🍌 Generating banana-style simple health tip...');
      
      const result = await this.postTweetAgent.run();
      
      if (result.success) {
        console.log('✅ Simple health tip posted successfully!');
        console.log(`📝 Content: "${result.content}"`);
      } else {
        console.log('❌ Post failed:', result.error);
      }
    } else {
      console.log(`⏰ Not optimal time (current: ${hour}:${currentMinutes.toString().padStart(2, '0')}, next optimal: ${this.getNextOptimalTime(hour)}h)`);
    }
  }

  private getNextOptimalTime(currentHour: number): number {
    const optimalHours = [7, 12, 15, 18, 20];
    for (const hour of optimalHours) {
      if (hour > currentHour) {
        return hour;
      }
    }
    return optimalHours[0] + 24; // Next day
  }

  async stop(): Promise<void> {
    console.log('🛑 Stopping scheduler...');
    this.isRunning = false;
    
    if (this.intelligentCheckJob) {
      this.intelligentCheckJob.stop();
      this.intelligentCheckJob = null;
    }
    
    console.log('✅ Scheduler stopped');
  }
}

export const scheduler = new Scheduler();
