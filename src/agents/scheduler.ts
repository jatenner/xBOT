
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

    // Check every 30 minutes for posting opportunities
    this.intelligentCheckJob = cron.schedule('*/30 * * * *', async () => {
      try {
        console.log('🍌 Checking for optimal posting time...');
        
        const now = new Date();
        const hour = now.getHours();
        
        // Optimal health content times: 7AM, 12PM, 6PM, 8PM
        const optimalHours = [7, 12, 18, 20];
        
        if (optimalHours.includes(hour)) {
          console.log('🎯 Optimal time detected - posting simple health content...');
          const result = await this.postTweetAgent.run();
          
          if (result.success) {
            console.log('✅ Simple health tip posted successfully!');
          } else {
            console.log('❌ Post failed:', result.error);
          }
        } else {
          console.log(`⏰ Not optimal time (current: ${hour}h, optimal: ${optimalHours.join(', ')}h)`);
        }
      } catch (error) {
        console.error('❌ Scheduler error:', error);
      }
    });

    console.log('✅ Scheduler started - checking every 30 minutes');
    console.log('🎯 Optimal posting times: 7AM, 12PM, 6PM, 8PM');
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
