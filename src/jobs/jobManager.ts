/**
 * 🕒 UNIFIED JOB MANAGER
 * Manages all recurring jobs: plan, reply, posting, learn with fail-fast in live mode
 */

import { flags } from '../config/featureFlags';
import { getConfig, getModeFlags } from '../config/config';
import { planContent } from './planJobUnified'; // 🚀 UNIFIED SYSTEM ACTIVE
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
      attribution: false,
      analytics: false,
      outcomes_real: false,
      data_collection: false,
      ai_orchestration: false,
      viral_thread: false,
      news_scraping: false,
      competitive_analysis: false,
      metrics_scraper: false,
      enhanced_metrics: false
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

    // Viral thread job timer - 1 AMAZING THREAD PER DAY 🔥
    if (flags.live) {
      const viralThreadIntervalMin = config.JOBS_VIRAL_THREAD_INTERVAL_MIN || 1440; // 24 hours
      this.timers.set('viral_thread', setInterval(async () => {
        await this.safeExecute('viral_thread', async () => {
          const { runViralThreadJob } = await import('./viralThreadJob');
          await runViralThreadJob();
          console.log('✅ JOB_MANAGER: Daily viral thread generated');
        });
      }, viralThreadIntervalMin * 60 * 1000));
      registered.viral_thread = true;
      console.log(`   • Viral thread: ENABLED (every ${viralThreadIntervalMin / 60} hours)`);
    }
    
    // ATTRIBUTION JOB - every 2 hours to update post performance
    this.timers.set('attribution', setInterval(async () => {
      await this.safeExecute('attribution', async () => {
        const { runAttributionJob } = await import('./attributionJob');
        await runAttributionJob();
      });
    }, 2 * 60 * 60 * 1000)); // 2 hours
    registered.attribution = true;
    
    // ANALYTICS COLLECTOR JOB - every 30 minutes to collect real metrics
    this.timers.set('analytics', setInterval(async () => {
      await this.safeExecute('analytics', async () => {
        const { analyticsCollectorJobV2 } = await import('./analyticsCollectorJobV2');
        await analyticsCollectorJobV2();
        console.log('✅ JOB_MANAGER: Analytics collection completed');
      });
    }, 30 * 60 * 1000)); // 30 minutes
    registered.analytics = true;
    
    // VELOCITY TRACKER JOB - every 30 minutes to track follower attribution & velocity
    this.timers.set('velocity_tracker', setInterval(async () => {
      await this.safeExecute('velocity_tracker', async () => {
        const { runVelocityTracking } = await import('./velocityTrackerJob');
        await runVelocityTracking();
        console.log('✅ JOB_MANAGER: Velocity tracking completed');
      });
    }, 30 * 60 * 1000)); // 30 minutes
    registered.velocity_tracker = true;
    
    // SYNC FOLLOWER DATA JOB - every 30 minutes to sync tracking data into outcomes table
    this.timers.set('sync_follower', setInterval(async () => {
      await this.safeExecute('sync_follower', async () => {
        const { syncFollowerData } = await import('./syncFollowerDataJob');
        await syncFollowerData();
      });
    }, 30 * 60 * 1000)); // 30 minutes
    registered.sync_follower = true;
    
    // REAL OUTCOMES JOB - every 2 hours to collect comprehensive engagement data
    this.timers.set('outcomes_real', setInterval(async () => {
      await this.safeExecute('outcomes_real', async () => {
        const { runRealOutcomesJob } = await import('./outcomeWriter');
        await runRealOutcomesJob();
        console.log('✅ JOB_MANAGER: Real outcomes collection completed');
      });
    }, 2 * 60 * 60 * 1000)); // 2 hours
    registered.outcomes_real = true;
    
    // DATA COLLECTION ENGINE - every hour for comprehensive tracking
    this.timers.set('data_collection', setInterval(async () => {
      await this.safeExecute('data_collection', async () => {
        const { DataCollectionEngine } = await import('../intelligence/dataCollectionEngine');
        const engine = DataCollectionEngine.getInstance();
        await engine.collectComprehensiveData();
        console.log('✅ JOB_MANAGER: Data collection engine completed');
      });
    }, 60 * 60 * 1000)); // 1 hour
    registered.data_collection = true;
    
    // AI ORCHESTRATION - every 6 hours to run AI systems within budget
    this.timers.set('ai_orchestration', setInterval(async () => {
      await this.safeExecute('ai_orchestration', async () => {
        const { runAIOrchestrationJob } = await import('./aiOrchestrationJob');
        await runAIOrchestrationJob();
      });
    }, 6 * 60 * 60 * 1000)); // 6 hours
    registered.ai_orchestration = true;
    
    // AUTONOMOUS OPTIMIZATION - every 6 hours to optimize generator weights based on performance
    this.timers.set('autonomous_optimization', setInterval(async () => {
      await this.safeExecute('autonomous_optimization', async () => {
        const { runAutonomousOptimization } = await import('./autonomousOptimizationJob');
        await runAutonomousOptimization();
      });
    }, 6 * 60 * 60 * 1000)); // 6 hours
    registered.autonomous_optimization = true;
    
    // NEWS SCRAPING - every 1 hour to scrape Twitter for health news
    this.timers.set('news_scraping', setInterval(async () => {
      await this.safeExecute('news_scraping', async () => {
        const { twitterNewsScraperJob } = await import('../news/newsScraperJob');
        await twitterNewsScraperJob.runScrapingJob();
      });
    }, 60 * 60 * 1000)); // 1 hour
    registered.news_scraping = true;

    // COMPETITIVE ANALYSIS - every 24 hours to learn from top accounts
    this.timers.set('competitive_analysis', setInterval(async () => {
      await this.safeExecute('competitive_analysis', async () => {
        const { competitiveAnalysisJob } = await import('./competitiveAnalysisJob');
        await competitiveAnalysisJob();
      });
    }, 24 * 60 * 60 * 1000)); // 24 hours
    registered.competitive_analysis = true;

    // SMART BATCH FIX: METRICS SCRAPER - every 10 minutes to collect fresh metrics
    this.timers.set('metrics_scraper', setInterval(async () => {
      await this.safeExecute('metrics_scraper', async () => {
        const { metricsScraperJob } = await import('./metricsScraperJob');
        await metricsScraperJob();
      });
    }, 10 * 60 * 1000)); // 10 minutes
    registered.metrics_scraper = true;

    // SMART BATCH FIX: ENHANCED METRICS - every 30 minutes for velocity tracking
    this.timers.set('enhanced_metrics', setInterval(async () => {
      await this.safeExecute('enhanced_metrics', async () => {
        const { enhancedMetricsScraperJob } = await import('./metricsScraperJob');
        await enhancedMetricsScraperJob();
      });
    }, 30 * 60 * 1000)); // 30 minutes
    registered.enhanced_metrics = true;

    // Log registration status (EXPLICIT for observability)
    console.log('════════════════════════════════════════════════════════');
    console.log('JOB_MANAGER: Timer Registration Complete');
    console.log(`  MODE: ${flags.mode}`);
    console.log(`  Timers registered:`);
    console.log(`    - plan:            ${registered.plan ? '✅' : '❌'} (every ${config.JOBS_PLAN_INTERVAL_MIN}min)`);
    console.log(`    - reply:           ${registered.reply ? '✅' : '❌'} (every ${config.JOBS_REPLY_INTERVAL_MIN}min)`);
    console.log(`    - posting:         ${registered.posting ? '✅' : '❌'} (every ${config.JOBS_POSTING_INTERVAL_MIN}min)`);
    console.log(`    - learn:           ${registered.learn ? '✅' : '❌'} (every ${config.JOBS_LEARN_INTERVAL_MIN}min)`);
    console.log(`    - attribution:     ${registered.attribution ? '✅' : '❌'} (every 2h)`);
    console.log(`    - analytics:       ${registered.analytics ? '✅' : '❌'} (every 30min)`);
    console.log(`    - outcomes_real:   ${registered.outcomes_real ? '✅' : '❌'} (every 2h)`);
    console.log(`    - data_collection: ${registered.data_collection ? '✅' : '❌'} (every 1h)`);
    console.log(`    - ai_orchestration:${registered.ai_orchestration ? '✅' : '❌'} (every 6h) ← AI-DRIVEN!`);
    console.log(`    - news_scraping:   ${registered.news_scraping ? '✅' : '❌'} (every 1h) ← REAL NEWS!`);
    console.log(`    - competitive:     ${registered.competitive_analysis ? '✅' : '❌'} (every 24h) ← LEARN FROM WINNERS!`);
    console.log(`    - metrics_scraper: ${registered.metrics_scraper ? '✅' : '❌'} (every 10min) ← SMART BATCH FIX!`);
    console.log(`    - enhanced_metrics:${registered.enhanced_metrics ? '✅' : '❌'} (every 30min) ← VELOCITY TRACKING!`);
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
