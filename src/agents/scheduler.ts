
import * as cron from 'node-cron';
import { PostTweetAgent } from './postTweet';

export class PostScheduler {
  private postTweetAgent: PostTweetAgent;
  private isRunning: boolean = false;
  private postingJob: cron.ScheduledTask | null = null;

  constructor() {
    this.postTweetAgent = new PostTweetAgent();
  }

  async start(): Promise<void> {
    // 🚨 EMERGENCY DISABLED: This scheduler was posting every 10 minutes with low-quality content
    console.log('🚫 EMERGENCY: Scheduler Agent completely disabled');
    console.log('⚠️ This was the main culprit posting incomplete hooks every 10 minutes');
    console.log('✅ Switched to viral content system with quality gates');
    
    this.isRunning = false;
    return;
  }

  async stop(): Promise<void> {
    console.log('🛑 Stopping scheduler...');
    this.isRunning = false;
    
    if (this.postingJob) {
      this.postingJob.stop();
      this.postingJob = null;
      console.log('✅ Posting job stopped');
    }
  }
}