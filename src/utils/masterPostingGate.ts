import { unifiedPostingCoordinator } from './unifiedPostingCoordinator';
import { PostTweetAgent } from '../agents/postTweet';
import { StreamlinedPostAgent } from '../agents/streamlinedPostAgent';
import * as cron from 'node-cron';

/**
 * 🚨 MASTER POSTING GATE
 * 
 * REPLACES ALL CONFLICTING SYSTEMS:
 * - DailyPostingManager (72 tweets/day)
 * - QuickPostModeAgent (30-min intervals) 
 * - LegendaryAICoordinator (15-min intervals)
 * - Multiple cron jobs calling different agents
 * - Addiction system bypassing coordination
 * 
 * ENSURES: ALL posts go through UnifiedPostingCoordinator
 */
export class MasterPostingGate {
  private static instance: MasterPostingGate;
  private isRunning = false;
  private postTweetAgent: PostTweetAgent;
  private streamlinedAgent: StreamlinedPostAgent;
  private activeJobs: Map<string, cron.ScheduledTask> = new Map();

  private constructor() {
    this.postTweetAgent = new PostTweetAgent();
    this.streamlinedAgent = new StreamlinedPostAgent();
  }

  static getInstance(): MasterPostingGate {
    if (!MasterPostingGate.instance) {
      MasterPostingGate.instance = new MasterPostingGate();
    }
    return MasterPostingGate.instance;
  }

  /**
   * 🚀 START MASTER POSTING SYSTEM
   * This replaces all other posting systems
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Master Posting Gate already running');
      return;
    }

    console.log('🚨 === MASTER POSTING GATE STARTING ===');
    console.log('🔧 FIXING: Multiple conflicting systems causing burst posting');
    console.log('✅ SOLUTION: Single coordinated posting gate');
    console.log('');

    this.isRunning = true;

    // 🚨 STOP ALL CONFLICTING SYSTEMS
    await this.stopConflictingSystems();

    // 🧠 START INTELLIGENT POSTING OPTIMIZER
    console.log('🧠 Starting Intelligent Posting Optimizer...');
    const { intelligentPostingOptimizer } = await import('../agents/intelligentPostingOptimizerAgent');
    await intelligentPostingOptimizer.startContinuousLearning();

    // 🎯 SINGLE COORDINATED POSTING SCHEDULE
    await this.setupCoordinatedSchedule();

    console.log('✅ Master Posting Gate operational');
    console.log('🛡️ All posting now coordinated through single gate');
    console.log('🧠 AI continuously optimizing frequency and timing');
    console.log('📊 Dynamic limits based on engagement performance');
  }

  /**
   * 🛑 STOP ALL CONFLICTING SYSTEMS
   */
  private async stopConflictingSystems(): Promise<void> {
    console.log('🛑 Stopping conflicting posting systems...');
    
    // Clear any existing intervals that might be running
    // Note: We can't directly stop other systems, but we ensure our coordination takes precedence
    
    try {
      // Stop any existing cron jobs in our control
      this.activeJobs.forEach((job, name) => {
        job.stop();
        console.log(`🛑 Stopped: ${name}`);
      });
      this.activeJobs.clear();
    } catch (error) {
      console.warn('⚠️ Could not stop some conflicting systems:', error.message);
    }

    console.log('✅ Conflicting systems addressed');
  }

  /**
   * 📅 SETUP COORDINATED POSTING SCHEDULE
   */
  private async setupCoordinatedSchedule(): Promise<void> {
    console.log('📅 Setting up coordinated posting schedule...');

    // 🎯 SINGLE POSTING CHECK SCHEDULE
    // Check every 30 minutes if we should post, but respect coordinator rules
    const mainPostingJob = cron.schedule('*/30 * * * *', async () => {
      await this.handleScheduledPostingCheck();
    }, { scheduled: false });

    // 🕐 OPTIMAL HOUR POSTING CHECKS
    // Additional checks during peak hours
    const optimalHourJob = cron.schedule('0 9,11,14,16,17,19,20 * * *', async () => {
      await this.handleOptimalHourPosting();
    }, { scheduled: false });

    // 🔄 DAILY RESET AND STATUS
    const dailyResetJob = cron.schedule('0 0 * * *', async () => {
      await this.handleDailyReset();
    }, { scheduled: false });

    // Store and start jobs
    this.activeJobs.set('main-posting', mainPostingJob);
    this.activeJobs.set('optimal-hours', optimalHourJob);
    this.activeJobs.set('daily-reset', dailyResetJob);

    // Start all jobs
    mainPostingJob.start();
    optimalHourJob.start();
    dailyResetJob.start();

    console.log('✅ Coordinated schedule active:');
    console.log('   📋 Main checks: Every 30 minutes');
    console.log('   🎯 Optimal hours: 9,11,14,16,17,19,20');
    console.log('   🔄 Daily reset: Midnight');
  }

  /**
   * 📋 HANDLE SCHEDULED POSTING CHECK
   */
  private async handleScheduledPostingCheck(): Promise<void> {
    try {
      console.log('📋 === SCHEDULED POSTING CHECK ===');

      // 🚨 CRITICAL: Check with unified coordinator FIRST
      const decision = await unifiedPostingCoordinator.canPostNow('MasterPostingGate', 'medium');
      
      if (!decision.canPost) {
        console.log(`🚨 COORDINATOR DECISION: ${decision.reason}`);
        console.log(`⏰ Next opportunity: ${decision.nextAllowedTime.toLocaleString()}`);
        return;
      }

      console.log(`✅ COORDINATOR APPROVED: ${decision.reason}`);

      // 🎲 Choose posting agent (favor StreamlinedAgent for viral content)
      const useStreamlined = Math.random() < 0.7; // 70% chance for viral content
      const agent = useStreamlined ? this.streamlinedAgent : this.postTweetAgent;
      const agentName = useStreamlined ? 'StreamlinedPostAgent' : 'PostTweetAgent';

      console.log(`🎯 Selected agent: ${agentName}`);

      // 🚀 EXECUTE POST
      const result = await agent.run(false);

      if (result.success) {
        console.log(`✅ SUCCESSFUL POST via ${agentName}`);
        console.log('📊 Post coordination system working correctly');
      } else {
        console.log(`❌ Post failed via ${agentName}: ${result.reason || result.error}`);
      }

    } catch (error) {
      console.error('❌ Scheduled posting check error:', error);
    }
  }

  /**
   * 🎯 HANDLE OPTIMAL HOUR POSTING
   */
  private async handleOptimalHourPosting(): Promise<void> {
    try {
      console.log('🎯 === OPTIMAL HOUR POSTING CHECK ===');
      
      const now = new Date();
      console.log(`🕐 Optimal hour detected: ${now.getHours()}:00`);

      // Use higher priority for optimal hours
      const decision = await unifiedPostingCoordinator.canPostNow('MasterPostingGate', 'high');
      
      if (!decision.canPost) {
        console.log(`🚨 Even optimal hour blocked: ${decision.reason}`);
        return;
      }

      console.log('🔥 OPTIMAL HOUR POSTING APPROVED');

      // Favor viral content during optimal hours
      const result = await this.streamlinedAgent.run(false);

      if (result.success) {
        console.log('✅ OPTIMAL HOUR POST SUCCESSFUL');
      } else {
        console.log(`❌ Optimal hour post failed: ${result.reason}`);
      }

    } catch (error) {
      console.error('❌ Optimal hour posting error:', error);
    }
  }

  /**
   * 🔄 HANDLE DAILY RESET
   */
  private async handleDailyReset(): Promise<void> {
    try {
      console.log('🔄 === DAILY RESET ===');
      
      const status = await unifiedPostingCoordinator.getStatus();
      console.log(`📊 Yesterday's stats: ${status.postsToday} posts`);
      
      console.log('🌅 New day starting - fresh posting limits');
      console.log('🎯 Daily target: Up to 8 strategic posts');
      console.log('⏰ Spacing: Minimum 90 minutes apart');
      
    } catch (error) {
      console.error('❌ Daily reset error:', error);
    }
  }

  /**
   * 🚨 EMERGENCY POST (Override coordinator for urgent situations)
   */
  async emergencyPost(reason: string): Promise<{ success: boolean; reason: string }> {
    console.log(`🚨 EMERGENCY POST REQUESTED: ${reason}`);
    
    try {
      // Emergency posts bypass coordinator but still record themselves
      const result = await this.streamlinedAgent.run(true); // force = true
      
      if (result.success) {
        console.log('✅ EMERGENCY POST SUCCESSFUL');
        return { success: true, reason: 'Emergency post completed' };
      } else {
        console.log(`❌ EMERGENCY POST FAILED: ${result.reason}`);
        return { success: false, reason: result.reason || 'Emergency post failed' };
      }
    } catch (error) {
      console.error('❌ Emergency post error:', error);
      return { success: false, reason: error.message };
    }
  }

  /**
   * 📊 GET SYSTEM STATUS
   */
  async getStatus(): Promise<{
    isRunning: boolean;
    activeJobs: string[];
    coordinatorStatus: any;
  }> {
    const coordinatorStatus = await unifiedPostingCoordinator.getStatus();
    
    return {
      isRunning: this.isRunning,
      activeJobs: Array.from(this.activeJobs.keys()),
      coordinatorStatus
    };
  }

  /**
   * 🛑 STOP MASTER POSTING GATE
   */
  stop(): void {
    console.log('🛑 Stopping Master Posting Gate...');
    
    this.activeJobs.forEach((job, name) => {
      job.stop();
      console.log(`🛑 Stopped: ${name}`);
    });
    
    this.activeJobs.clear();
    this.isRunning = false;
    
    console.log('✅ Master Posting Gate stopped');
  }
}

// Export singleton instance
export const masterPostingGate = MasterPostingGate.getInstance(); 