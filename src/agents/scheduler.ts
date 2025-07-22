
import * as cron from 'node-cron';
import { PostTweetAgent } from './postTweet';
import { autonomousTwitterGrowthMaster } from './autonomousTwitterGrowthMaster';

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

    console.log('🚀 Starting Intelligent Twitter Bot Scheduler...');
    this.isRunning = true;

    // Start autonomous growth master
    try {
      await autonomousTwitterGrowthMaster.startAutonomousOperation();
      console.log('✅ Autonomous Twitter Growth Master operational');
    } catch (error) {
      console.error('❌ Failed to start Autonomous Growth Master:', error);
    }

    // Check every 30 minutes if we should post (intelligent timing)
    this.intelligentCheckJob = cron.schedule('*/30 * * * *', async () => {
      try {
        console.log('🧠 Intelligent posting check...');
        await this.performIntelligentPostingCycle();
      } catch (error) {
        console.error('❌ Intelligent posting check error:', error);
      }
    });

    console.log('✅ Intelligent Scheduler started - checking every 30 minutes for optimal posting opportunities');
    console.log('🧠 System will autonomously decide when, what, and if to post based on:');
    console.log('   📊 Content quality predictions');
    console.log('   ⏰ Optimal timing analysis'); 
    console.log('   🎯 Follower growth potential');
    console.log('   📈 Learned engagement patterns');
  }

  private async performIntelligentPostingCycle(): Promise<void> {
    try {
      console.log('🎯 === INTELLIGENT POSTING CYCLE ===');
      
      // Run the autonomous cycle to get intelligent decision
      const cycle = await autonomousTwitterGrowthMaster.runAutonomousCycle();
      
      console.log(`🤖 Decision: ${cycle.decision.action.toUpperCase()}`);
      console.log(`🧠 Reasoning: ${cycle.reasoning.join(', ')}`);
      console.log(`🎯 Confidence: ${Math.round(cycle.confidence * 100)}%`);
      
      if (cycle.shouldPost && cycle.optimizedContent) {
        console.log('🚀 Proceeding with intelligent post...');
        
        // Use the optimized content from the growth master
        const result = await this.postTweetAgent.run(false, false, cycle.optimizedContent);
        
        if (result.success) {
          console.log('✅ Intelligent post successful!');
          console.log(`📊 Expected performance: ${cycle.decision.expected_performance?.followers || 0} followers`);
          
          // Track the result for learning
          if (result.tweetId) {
            await this.trackPostingSuccess(result.tweetId, cycle.decision);
          }
        } else {
          console.log('❌ Intelligent post failed:', result.error);
        }
      } else {
        console.log('⏸️ Not posting - conditions not optimal');
        
        if (cycle.decision.action === 'delay' && cycle.decision.optimal_timing) {
          const delay = new Date(cycle.decision.optimal_timing).getTime() - Date.now();
          const delayHours = Math.round(delay / (1000 * 60 * 60 * 100)) / 10;
          console.log(`⏰ Will check again for optimal timing in ${delayHours} hours`);
        }
      }
      
    } catch (error) {
      console.error('❌ Intelligent posting cycle failed:', error);
    }
  }

  private async trackPostingSuccess(tweetId: string, decision: any): Promise<void> {
    try {
      console.log(`📊 Tracking performance for intelligent post: ${tweetId}`);
      // The growth master will handle the detailed tracking
      // This is just for immediate feedback
    } catch (error) {
      console.error('❌ Failed to track posting success:', error);
    }
  }

  async stop(): Promise<void> {
    console.log('🛑 Stopping intelligent scheduler...');
    this.isRunning = false;
    
    if (this.intelligentCheckJob) {
      this.intelligentCheckJob.stop();
      this.intelligentCheckJob = null;
    }
    
    console.log('✅ Intelligent scheduler stopped');
  }
}

export const scheduler = new Scheduler();
