/**
 * 🕒 UNIFIED JOB MANAGER
 * Manages all recurring jobs: plan, reply, posting, learn with fail-fast in live mode
 */

import { flags } from '../config/featureFlags';
import { getConfig, getModeFlags } from '../config/config';
import { planContent } from './planJobNew';
import { generateReplies } from './replyJob';
import { processPostingQueue } from './postingQueue';
import { simulateOutcomes } from './shadowOutcomesJob';
import { collectRealOutcomes } from './realOutcomesJob';
import { collectRealOutcomes as collectAnalytics } from './analyticsCollectorJob';
import { runLearningCycle } from './learnJob';

export interface JobStats {
  planRuns: number;
  replyRuns: number;
  postingRuns: number;
  outcomeRuns: number;
  learnRuns: number;
  lastPlanTime?: Date;
  lastReplyTime?: Date;
  lastPostingTime?: Date;
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
    postingRuns: 0,
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
   * FAIL-FAST: If MODE=live and posting job doesn't register, exit with error
   */
  public async startJobs(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ JOB_MANAGER: Jobs already running');
      return;
    }

    const config = getConfig();
    const modeFlags = getModeFlags(config);

    if (!modeFlags.enableJobScheduling) {
      console.log('🕒 JOB_MANAGER: Job scheduling disabled (JOBS_AUTOSTART=false)');
      return;
    }

    console.log('🕒 JOB_MANAGER: Starting job timers...');
    console.log(`   • Mode: ${flags.mode} (live=${flags.live})`);
    console.log(`   • Plan: ${flags.plannerEnabled ? 'ENABLED' : 'DISABLED'}`);
    console.log(`   • Reply: ${flags.replyEnabled ? 'ENABLED' : 'DISABLED'}`);
    console.log(`   • Posting: ${flags.postingEnabled ? 'ENABLED' : 'DISABLED'}`);
    console.log(`   • Learn: ${flags.learnEnabled ? 'ENABLED' : 'DISABLED'}`);
    console.log(`   • Attribution: ENABLED (every 2h)`);
    
    const registered: Record<string, boolean> = {
      plan: false,
      reply: false,
      posting: false,
      learn: false,
      attribution: false
    };

    // Plan job timer
    if (flags.plannerEnabled) {
      this.timers.set('plan', setInterval(async () => {
        await this.safeExecute('plan', async () => {
          await planContent();
          this.stats.planRuns++;
          this.stats.lastPlanTime = new Date();
        });
      }, config.JOBS_PLAN_INTERVAL_MIN * 60 * 1000));
      registered.plan = true;
    }

    // Reply job timer
    if (flags.replyEnabled) {
      this.timers.set('reply', setInterval(async () => {
        await this.safeExecute('reply', async () => {
          await generateReplies();
          this.stats.replyRuns++;
          this.stats.lastReplyTime = new Date();
        });
      }, config.JOBS_REPLY_INTERVAL_MIN * 60 * 1000));
      registered.reply = true;
    }

    // Posting queue timer (CRITICAL in live mode)
    if (flags.postingEnabled) {
      const postingIntervalMin = config.JOBS_POSTING_INTERVAL_MIN || 5;
      this.timers.set('posting', setInterval(async () => {
        await this.safeExecute('posting', async () => {
          await processPostingQueue();
          this.stats.postingRuns++;
          this.stats.lastPostingTime = new Date();
        });
      }, postingIntervalMin * 60 * 1000));
      registered.posting = true;
    }

    // Shadow outcomes job (only in shadow mode)
    if (modeFlags.simulateOutcomes) {
      this.timers.set('outcomes', setInterval(async () => {
        await this.safeExecute('outcomes', async () => {
          await simulateOutcomes();
          this.stats.outcomeRuns++;
          this.stats.lastOutcomeTime = new Date();
        });
      }, config.JOBS_LEARN_INTERVAL_MIN * 60 * 1000));
    }

    // Learn job timer - Real-time learning loop
    if (flags.learnEnabled) {
      this.timers.set('learn', setInterval(async () => {
        await this.safeExecute('learn', async () => {
          // Use real-time learning loop for continuous improvement
          const { getRealTimeLearningLoop } = await import('../intelligence/realTimeLearningLoop');
          await getRealTimeLearningLoop().runLearningCycle();
          console.log('✅ JOB_MANAGER: Real-time learning cycle completed');
          this.stats.learnRuns++;
          this.stats.lastLearnTime = new Date();
        });
      }, config.JOBS_LEARN_INTERVAL_MIN * 60 * 1000));
      registered.learn = true;
    }
    
    // ATTRIBUTION JOB - every 2 hours to update post performance
    this.timers.set('attribution', setInterval(async () => {
      await this.safeExecute('attribution', async () => {
        const { runAttributionJob } = await import('./attributionJob');
        await runAttributionJob();
      });
    }, 2 * 60 * 60 * 1000)); // 2 hours
    registered.attribution = true;

    // Log registration status (EXPLICIT for observability)
    console.log('════════════════════════════════════════════════════════');
    console.log('JOB_MANAGER: Timer Registration Complete');
    console.log(`  MODE: ${flags.mode}`);
    console.log(`  Timers registered:`);
    console.log(`    - plan:        ${registered.plan ? '✅' : '❌'}`);
    console.log(`    - reply:       ${registered.reply ? '✅' : '❌'}`);
    console.log(`    - posting:     ${registered.posting ? '✅' : '❌'}`);
    console.log(`    - learn:       ${registered.learn ? '✅' : '❌'}`);
    console.log(`    - attribution: ${registered.attribution ? '✅' : '❌'}`);
    console.log('════════════════════════════════════════════════════════');

    // FAIL-FAST: Posting job MUST be registered in live mode
    if (flags.live && !registered.posting) {
      console.error('════════════════════════════════════════════════════════');
      console.error('❌ FATAL: Posting job not registered despite MODE=live');
      console.error('   This indicates a configuration error.');
      console.error('   Exiting to prevent silent failure...');
      console.error('════════════════════════════════════════════════════════');
      process.exit(1);
    }

    this.isRunning = true;
    const jobCount = Object.values(registered).filter(Boolean).length;
    console.log(`✅ JOB_MANAGER: Started ${jobCount} job timers (mode=${flags.mode})`);

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
    console.log(`   • Posting runs: ${this.stats.postingRuns}`);
    console.log(`   • Outcome runs: ${this.stats.outcomeRuns}`);
    console.log(`   • Learn runs: ${this.stats.learnRuns}`);
    console.log(`   • Errors: ${this.stats.errors}`);
    console.log(`   • Last learn: ${this.stats.lastLearnTime?.toISOString() || 'never'}`);
  }

  /**
   * Force run a specific job (for testing/manual trigger)
   */
  public async runJobNow(jobName: 'plan' | 'reply' | 'posting' | 'outcomes' | 'realOutcomes' | 'analyticsCollector' | 'learn' | 'trainPredictor'): Promise<void> {
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
      
      case 'posting':
        await this.safeExecute('posting', async () => {
          await processPostingQueue();
          this.stats.postingRuns++;
          this.stats.lastPostingTime = new Date();
        });
        break;
      
      case 'outcomes':
        await this.safeExecute('outcomes', async () => {
          await simulateOutcomes();
          this.stats.outcomeRuns++;
          this.stats.lastOutcomeTime = new Date();
        });
        break;
      
      case 'realOutcomes':
        await this.safeExecute('realOutcomes', async () => {
          await collectRealOutcomes();
          this.stats.outcomeRuns++;
          this.stats.lastOutcomeTime = new Date();
        });
        break;
      
      case 'analyticsCollector':
        await this.safeExecute('analyticsCollector', async () => {
          await collectAnalytics();
          // Analytics collection doesn't have dedicated stats yet
        });
        break;
      
      case 'learn':
        await this.safeExecute('learn', async () => {
          await runLearningCycle();
          this.stats.learnRuns++;
          this.stats.lastLearnTime = new Date();
        });
        break;
      
      case 'trainPredictor':
        await this.safeExecute('trainPredictor', async () => {
          const { trainWeeklyModel, persistCoefficients } = await import('./predictorTrainer');
          const coefficients = await trainWeeklyModel();
          await persistCoefficients(coefficients);
          console.log(`✅ Predictor ${coefficients.version} trained and persisted`);
        });
        break;
    }
  }
}
