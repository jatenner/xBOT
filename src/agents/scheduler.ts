
import * as cron from 'node-cron';
import { PostTweetAgent } from './postTweet';
import { autonomousTwitterGrowthMaster } from './autonomousTwitterGrowthMaster';

export class Scheduler {
  private postTweetAgent: PostTweetAgent;
  private isRunning = false;
  private mainJob: cron.ScheduledTask | null = null;

  constructor() {
    this.postTweetAgent = new PostTweetAgent();
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Scheduler is already running');
      return;
    }

    console.log('🚀 Starting Clean Twitter Bot Scheduler...');
    this.isRunning = true;

    // Start autonomous growth master
    try {
      await autonomousTwitterGrowthMaster.startAutonomousOperation();
      console.log('✅ Autonomous Twitter Growth Master operational');
    } catch (error) {
      console.error('❌ Failed to start Autonomous Growth Master:', error);
    }

    // Schedule main posting every 2 hours
    this.mainJob = cron.schedule('0 */2 * * *', async () => {
      try {
        console.log('🎯 Scheduled posting cycle...');
        const result = await this.postTweetAgent.run();
        if (result.success) {
          console.log('✅ Scheduled post successful');
        } else {
          console.log('❌ Scheduled post failed:', result.error);
        }
      } catch (error) {
        console.error('❌ Scheduled post error:', error);
      }
    });

    console.log('✅ Scheduler started - posting every 2 hours');
  }

  async stop(): Promise<void> {
    console.log('🛑 Stopping scheduler...');
    this.isRunning = false;
    
    if (this.mainJob) {
      this.mainJob.destroy();
      this.mainJob = null;
    }
    
    console.log('✅ Scheduler stopped');
  }
}

export const scheduler = new Scheduler();
