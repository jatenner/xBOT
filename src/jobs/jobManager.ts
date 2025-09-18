/**
 * 🕒 UNIFIED JOB MANAGER
 * Manages all recurring jobs: plan, reply, outcomes, learn with shadow mode support
 */

import { getConfig, getModeFlags } from '../config/config';
import { planContent } from './planJob';
import { generateReplies } from './replyJob';
import { simulateOutcomes } from './shadowOutcomesJob';
import { runLearningCycle } from './learnJob';

export interface JobStats {
  planRuns: number;
  replyRuns: number;
  outcomeRuns: number;
  learnRuns: number;
  lastPlanTime?: Date;
  lastReplyTime?: Date;
  lastOutcomeTime?: Date;
  lastLearnTime?: Date;
  errors: number;
}

export class JobManager {
  private static instance: JobManager;
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private stats: JobStats = {
    planRuns: 0,
    replyRuns: 0,
    outcomeRuns: 0,
    learnRuns: 0,
    errors: 0
  };
  private isRunning = false;

  public static getInstance(): JobManager {
    if (!JobManager.instance) {
      JobManager.instance = new JobManager();
    }
    return JobManager.instance;
  }

  /**
   * Start all job timers based on configuration
   */
  public async startJobs(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ JOB_MANAGER: Jobs already running');
      return;
    }

    const config = getConfig();
    const flags = getModeFlags(config);

    if (!flags.enableJobScheduling) {
      console.log('🕒 JOB_MANAGER: Job scheduling disabled (JOBS_AUTOSTART=false)');
      return;
    }

    console.log('🕒 JOB_MANAGER: Starting job timers...');
    console.log(`   • Mode: ${config.MODE}`);
    console.log(`   • Plan interval: ${config.JOBS_PLAN_INTERVAL_MIN}min`);
    console.log(`   • Reply interval: ${config.JOBS_REPLY_INTERVAL_MIN}min`);
    console.log(`   • Learn interval: ${config.JOBS_LEARN_INTERVAL_MIN}min`);
    
    // Log next run ETAs
    const now = new Date();
    console.log('🕐 Next job ETAs:');
    console.log(`   • Plan: ${new Date(now.getTime() + config.JOBS_PLAN_INTERVAL_MIN * 60 * 1000).toISOString()}`);
    console.log(`   • Reply: ${new Date(now.getTime() + config.JOBS_REPLY_INTERVAL_MIN * 60 * 1000).toISOString()}`);
    console.log(`   • Learn: ${new Date(now.getTime() + config.JOBS_LEARN_INTERVAL_MIN * 60 * 1000).toISOString()}`);
    if (flags.simulateOutcomes) {
      console.log(`   • ShadowOutcomes: ${new Date(now.getTime() + config.JOBS_LEARN_INTERVAL_MIN * 60 * 1000).toISOString()}`);
    }

    // Plan job timer
    this.timers.set('plan', setInterval(async () => {
      await this.safeExecute('plan', async () => {
        await planContent();
        this.stats.planRuns++;
        this.stats.lastPlanTime = new Date();
      });
    }, config.JOBS_PLAN_INTERVAL_MIN * 60 * 1000));

    // Reply job timer
    this.timers.set('reply', setInterval(async () => {
      await this.safeExecute('reply', async () => {
        await generateReplies();
        this.stats.replyRuns++;
        this.stats.lastReplyTime = new Date();
      });
    }, config.JOBS_REPLY_INTERVAL_MIN * 60 * 1000));

    // Shadow outcomes job (only in shadow mode)
    if (flags.simulateOutcomes) {
      this.timers.set('outcomes', setInterval(async () => {
        await this.safeExecute('outcomes', async () => {
          await simulateOutcomes();
          this.stats.outcomeRuns++;
          this.stats.lastOutcomeTime = new Date();
        });
      }, config.JOBS_LEARN_INTERVAL_MIN * 60 * 1000)); // Run at learn frequency
    }

    // Learn job timer
    this.timers.set('learn', setInterval(async () => {
      await this.safeExecute('learn', async () => {
        await runLearningCycle();
        this.stats.learnRuns++;
        this.stats.lastLearnTime = new Date();
      });
    }, config.JOBS_LEARN_INTERVAL_MIN * 60 * 1000));

    this.isRunning = true;
    console.log(`✅ JOB_MANAGER: Started ${this.timers.size} job timers`);

    // Print hourly status
    this.timers.set('status', setInterval(() => {
      this.printHourlyStatus();
    }, 60 * 60 * 1000)); // 1 hour
  }

  /**
   * Stop all job timers
   */
  public stopJobs(): void {
    console.log('🛑 JOB_MANAGER: Stopping all job timers...');
    
    this.timers.forEach((timer, name) => {
      clearInterval(timer);
      console.log(`   • Stopped ${name} timer`);
    });
    
    this.timers.clear();
    this.isRunning = false;
    
    console.log('✅ JOB_MANAGER: All timers stopped');
  }

  /**
   * Get current job statistics
   */
  public getStats(): JobStats {
    return { ...this.stats };
  }

  /**
   * Execute job with error handling
   */
  private async safeExecute(jobName: string, jobFn: () => Promise<void>): Promise<void> {
    try {
      console.log(`🕒 JOB_${jobName.toUpperCase()}: Starting...`);
      await jobFn();
      console.log(`✅ JOB_${jobName.toUpperCase()}: Completed successfully`);
    } catch (error) {
      this.stats.errors++;
      console.error(`❌ JOB_${jobName.toUpperCase()}: Failed -`, error.message);
    }
  }

  /**
   * Print hourly status summary
   */
  private printHourlyStatus(): void {
    const config = getConfig();
    const flags = getModeFlags(config);
    
    console.log('💓 HOURLY_HEARTBEAT:');
    console.log(`   • Mode: ${config.MODE}`);
    console.log(`   • Jobs running: ${flags.enableJobScheduling}`);
    console.log(`   • Plan runs: ${this.stats.planRuns}`);
    console.log(`   • Reply runs: ${this.stats.replyRuns}`);
    console.log(`   • Outcome runs: ${this.stats.outcomeRuns}`);
    console.log(`   • Learn runs: ${this.stats.learnRuns}`);
    console.log(`   • Errors: ${this.stats.errors}`);
    console.log(`   • Last learn: ${this.stats.lastLearnTime?.toISOString() || 'never'}`);
  }

  /**
   * Force run a specific job (for testing/manual trigger)
   */
  public async runJobNow(jobName: 'plan' | 'reply' | 'outcomes' | 'learn'): Promise<void> {
    console.log(`🔄 JOB_MANAGER: Force running ${jobName} job...`);
    
    switch (jobName) {
      case 'plan':
        await this.safeExecute('plan', async () => {
          await planContent();
          this.stats.planRuns++;
          this.stats.lastPlanTime = new Date();
        });
        break;
      
      case 'reply':
        await this.safeExecute('reply', async () => {
          await generateReplies();
          this.stats.replyRuns++;
          this.stats.lastReplyTime = new Date();
        });
        break;
      
      case 'outcomes':
        await this.safeExecute('outcomes', async () => {
          await simulateOutcomes();
          this.stats.outcomeRuns++;
          this.stats.lastOutcomeTime = new Date();
        });
        break;
      
      case 'learn':
        await this.safeExecute('learn', async () => {
          await runLearningCycle();
          this.stats.learnRuns++;
          this.stats.lastLearnTime = new Date();
        });
        break;
    }
  }
}
