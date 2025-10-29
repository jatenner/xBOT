/**
 * 🕒 UNIFIED JOB MANAGER
 * Manages all recurring jobs: plan, reply, posting, learn with fail-fast in live mode
 */

import { flags } from '../config/featureFlags';
import { getConfig, getModeFlags } from '../config/config';
import { planContent } from './planJob'; // 🎯 DIVERSITY SYSTEM ACTIVE
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
  accountDiscoveryRuns?: number;
  lastPlanTime?: Date;
  lastReplyTime?: Date;
  lastPostingTime?: Date;
  lastOutcomeTime?: Date;
  lastLearnTime?: Date;
  lastAccountDiscoveryTime?: Date;
  errors: number;
}

export class JobManager {
  private static instance: JobManager;
  private timers: Map<string, NodeJS.Timeout> = new Map();
  public stats: JobStats = {
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
   * 🎯 STAGGERED JOB SCHEDULING
   * Prevents resource stampede by spreading job starts across time
   * Critical fix: Ensures only ONE job uses browser resources at a time
   */
  private scheduleStaggeredJob(
    name: string,
    jobFn: () => Promise<void>,
    intervalMs: number,
    initialDelayMs: number
  ): void {
    console.log(`🕒 JOB_MANAGER: Scheduling ${name} - first run in ${Math.round(initialDelayMs / 1000)}s, then every ${Math.round(intervalMs / 60000)}min`);
    
    // Schedule first run after initial delay
    const initialTimer = setTimeout(async () => {
      try {
        await jobFn(); // First execution
        
        // Then set up recurring interval
        const recurringTimer = setInterval(async () => {
          try {
            await jobFn();
          } catch (error) {
            console.error(`❌ JOB_${name.toUpperCase()}: Recurring execution failed:`, error?.message || String(error));
          }
        }, intervalMs);
        this.timers.set(name, recurringTimer);
      } catch (error) {
        console.error(`❌ JOB_${name.toUpperCase()}: Initial execution failed:`, error?.message || String(error));
      }
    }, initialDelayMs);
    
    // Store initial timer (will be replaced by recurring timer after first run)
    this.timers.set(`${name}_initial`, initialTimer);
  }

  /**
   * 🚀 START STAGGERED JOBS
   * Spread job execution across time to prevent browser resource collisions
   */
  private async startStaggeredJobs(config: any, modeFlags: any): Promise<void> {
    this.isRunning = true;
    
    console.log('🎯 JOB_MANAGER: Starting STAGGERED scheduling (prevents resource collisions)');
    
    // 🚨 CRITICAL: Check if discovered_accounts table is empty on startup
    // If empty, trigger account discovery IMMEDIATELY so reply system can work
    try {
      const { getAccountPoolHealth } = await import('./accountDiscoveryJob');
      const poolHealth = await getAccountPoolHealth();
      
      if (poolHealth.status === 'critical' && poolHealth.total_accounts === 0) {
        console.log('[JOB_MANAGER] 🚨 discovered_accounts table is EMPTY - triggering immediate discovery...');
        const { runAccountDiscovery } = await import('./accountDiscoveryJob');
        
        // Run in background, don't block startup
        runAccountDiscovery()
          .then(() => {
            console.log('[JOB_MANAGER] ✅ Initial account discovery completed');
            this.stats.accountDiscoveryRuns = (this.stats.accountDiscoveryRuns || 0) + 1;
            this.stats.lastAccountDiscoveryTime = new Date();
          })
          .catch((err) => {
            console.error('[JOB_MANAGER] ❌ Initial account discovery failed:', err.message);
            console.log('[JOB_MANAGER] 💡 Will retry in 25 minutes on scheduled run');
          });
      } else {
        console.log(`[JOB_MANAGER] ℹ️ Account pool status: ${poolHealth.status} (${poolHealth.total_accounts} accounts) - reply system ready`);
      }
    } catch (error: any) {
      console.error('[JOB_MANAGER] ⚠️ Failed to check account pool health:', error.message);
    }
    
    // Define stagger offsets (in seconds) to spread jobs across time
    const MINUTE = 60 * 1000;
    const SECOND = 1000;
    
    // 🔥 CRITICAL: Posting queue - runs every 5 min, NO delay (highest priority)
    if (flags.postingEnabled) {
      this.scheduleStaggeredJob(
        'posting',
        async () => {
          await this.safeExecute('posting', async () => {
            await processPostingQueue();
            this.stats.postingRuns++;
            this.stats.lastPostingTime = new Date();
          });
        },
        5 * MINUTE,
        0 // NO DELAY - start immediately
      );
    }

    // Plan job - every 30 min, offset 2 min
    if (flags.plannerEnabled) {
      this.scheduleStaggeredJob(
        'plan',
        async () => {
          await this.safeExecute('plan', async () => {
            await planContent();
            this.stats.planRuns++;
            this.stats.lastPlanTime = new Date();
          });
        },
        config.JOBS_PLAN_INTERVAL_MIN * MINUTE,
        2 * MINUTE // Start after 2 minutes
      );
    }

    // Reply job - REMOVED (replaced by aggressive reply_posting job below)

    // Velocity tracker - every 30 min, offset 12 min
    this.scheduleStaggeredJob(
      'velocity_tracker',
      async () => {
        await this.safeExecute('velocity_tracker', async () => {
          const { runVelocityTracking } = await import('./velocityTrackerJob');
          await runVelocityTracking();
        });
      },
      30 * MINUTE,
      12 * MINUTE
    );

    // Analytics - every 30 min, offset 22 min
    this.scheduleStaggeredJob(
      'analytics',
      async () => {
        await this.safeExecute('analytics', async () => {
          const { analyticsCollectorJobV2 } = await import('./analyticsCollectorJobV2');
          await analyticsCollectorJobV2();
        });
      },
      30 * MINUTE,
      22 * MINUTE
    );

    // Sync follower - every 30 min, offset 32 min (no browser needed)
    this.scheduleStaggeredJob(
      'sync_follower',
      async () => {
        await this.safeExecute('sync_follower', async () => {
          const { syncFollowerData } = await import('./syncFollowerDataJob');
          await syncFollowerData();
        });
      },
      30 * MINUTE,
      32 * MINUTE
    );

    // Enhanced metrics - every 30 min, offset 42 min
    this.scheduleStaggeredJob(
      'enhanced_metrics',
      async () => {
        await this.safeExecute('enhanced_metrics', async () => {
          const { enhancedMetricsScraperJob } = await import('./metricsScraperJob');
          await enhancedMetricsScraperJob();
        });
      },
      30 * MINUTE,
      42 * MINUTE
    );

    // Metrics scraper - every 10 min, offset 7 min
    this.scheduleStaggeredJob(
      'metrics_scraper',
      async () => {
        await this.safeExecute('metrics_scraper', async () => {
          const { metricsScraperJob } = await import('./metricsScraperJob');
          await metricsScraperJob();
        });
      },
      10 * MINUTE,
      7 * MINUTE
    );

    // Data collection - every 60 min, offset 52 min
    this.scheduleStaggeredJob(
      'data_collection',
      async () => {
        await this.safeExecute('data_collection', async () => {
          const { DataCollectionEngine } = await import('../intelligence/dataCollectionEngine');
          const engine = DataCollectionEngine.getInstance();
          await engine.collectComprehensiveData();
        });
      },
      60 * MINUTE,
      52 * MINUTE
    );

    // Learn job - every 60 min, offset 45 min (no browser)
    if (flags.learnEnabled) {
      this.scheduleStaggeredJob(
        'learn',
        async () => {
          await this.safeExecute('learn', async () => {
            const { getRealTimeLearningLoop } = await import('../intelligence/realTimeLearningLoop');
            await getRealTimeLearningLoop().runLearningCycle();
            this.stats.learnRuns++;
            this.stats.lastLearnTime = new Date();
          });
        },
        config.JOBS_LEARN_INTERVAL_MIN * MINUTE,
        45 * MINUTE
      );
    }

    // News scraping - every 60 min, offset 35 min
    this.scheduleStaggeredJob(
      'news_scraping',
      async () => {
        await this.safeExecute('news_scraping', async () => {
          const { twitterNewsScraperJob } = await import('../news/newsScraperJob');
          await twitterNewsScraperJob.runScrapingJob();
        });
      },
      60 * MINUTE,
      35 * MINUTE
    );

    // Account Discovery - every 30 min, offset 5 min (CRITICAL for reply system - AGGRESSIVE MODE!)
    // 🔥 USER REQUEST: Speed up discovery - was 6 hours, now 30 min to build pool faster
    this.scheduleStaggeredJob(
      'account_discovery',
      async () => {
        await this.safeExecute('account_discovery', async () => {
          const { runAccountDiscovery } = await import('./accountDiscoveryJob');
          await runAccountDiscovery();
          this.stats.accountDiscoveryRuns = (this.stats.accountDiscoveryRuns || 0) + 1;
          this.stats.lastAccountDiscoveryTime = new Date();
        });
      },
      30 * MINUTE, // Every 30 minutes (was 6 hours - MUCH faster now!)
      5 * MINUTE // Start after 5 minutes (was 25 min - start sooner!)
    );

    // 🎯 TWEET-BASED HARVESTER - every 30 min, offset 10 min
    // NEW SYSTEM: Search Twitter directly for high-engagement tweets (not account-based)
    // Finds tweets with 2K+ likes OR 200+ comments from ANY account
    // No dependency on discovered_accounts - catches ALL viral health content
    // ⚠️ IMPORTANT: Only schedule if replies are enabled
    if (flags.replyEnabled && process.env.ENABLE_REPLIES === 'true') {
      console.log('💬 JOB_MANAGER: Reply jobs ENABLED - scheduling TWEET-BASED harvester and posting');
      
      this.scheduleStaggeredJob(
        'tweet_harvester',
        async () => {
          await this.safeExecute('tweet_harvester', async () => {
            const { tweetBasedHarvester } = await import('./tweetBasedHarvester');
            await tweetBasedHarvester();
          });
        },
        30 * MINUTE, // Every 30 minutes - continuously find viral tweets
        10 * MINUTE // Start after 10 minutes
      );

      // 💬 REPLY POSTING JOB - every 30 min (configurable via JOBS_REPLY_INTERVAL_MIN)
      // 🎯 CRITICAL: Generate and queue replies
      // ⏰ TIMING: Starts immediately, has own internal rate limiting
      this.scheduleStaggeredJob(
        'reply_posting',
        async () => {
          await this.safeExecute('reply_posting', async () => {
            await generateReplies();
            this.stats.replyRuns = (this.stats.replyRuns || 0) + 1;
            this.stats.lastReplyTime = new Date();
          });
        },
        config.JOBS_REPLY_INTERVAL_MIN * MINUTE, // Use config value (default: 30 min = 2 runs/hour)
        1 * MINUTE // Start after 1 minute (immediate but allow harvester to populate)
      );
      
      // 📊 REPLY CONVERSION TRACKING JOB - every 60 min, offset 60 min
      // 🎯 Tracks which replies drive followers and updates account priorities
      this.scheduleStaggeredJob(
        'reply_conversion_tracking',
        async () => {
          await this.safeExecute('reply_conversion_tracking', async () => {
            const { getReplyConversionTracker } = await import('../learning/replyConversionTracker');
            const tracker = getReplyConversionTracker();
            await tracker.trackPendingReplies();
            await tracker.updateAccountPriorities();
          });
        },
        60 * MINUTE, // Every 60 minutes
        60 * MINUTE // Start after 60 minutes (give time for replies to get engagement)
      );
    } else {
      console.log('⚠️  JOB_MANAGER: Reply jobs DISABLED (ENABLE_REPLIES not set or flags.replyEnabled false)');
      console.log(`   • ENABLE_REPLIES: ${process.env.ENABLE_REPLIES}`);
      console.log(`   • flags.replyEnabled: ${flags.replyEnabled}`);
    }

    // Attribution - every 2 hours, offset 70 min
    this.scheduleStaggeredJob(
      'attribution',
      async () => {
        await this.safeExecute('attribution', async () => {
          const { runAttributionJob } = await import('./attributionJob');
          await runAttributionJob();
        });
      },
      2 * 60 * MINUTE,
      70 * MINUTE
    );

    // Real outcomes - every 2 hours, offset 100 min
    this.scheduleStaggeredJob(
      'outcomes_real',
      async () => {
        await this.safeExecute('outcomes_real', async () => {
          const { runRealOutcomesJob } = await import('./outcomeWriter');
          await runRealOutcomesJob();
        });
      },
      2 * 60 * MINUTE,
      100 * MINUTE
    );

    // AI orchestration - every 6 hours, offset 200 min
    this.scheduleStaggeredJob(
      'ai_orchestration',
      async () => {
        await this.safeExecute('ai_orchestration', async () => {
          const { runAIOrchestrationJob } = await import('./aiOrchestrationJob');
          await runAIOrchestrationJob();
        });
      },
      6 * 60 * MINUTE,
      200 * MINUTE
    );

    // Autonomous optimization - every 6 hours, offset 230 min
    this.scheduleStaggeredJob(
      'autonomous_optimization',
      async () => {
        await this.safeExecute('autonomous_optimization', async () => {
          const { runAutonomousOptimization } = await import('./autonomousOptimizationJob');
          await runAutonomousOptimization();
        });
      },
      6 * 60 * MINUTE,
      230 * MINUTE
    );

    // 🏥 HEALTH CHECK - every 10 minutes, offset 3 min (continuous monitoring)
    this.scheduleStaggeredJob(
      'health_check',
      async () => {
        await this.safeExecute('health_check', async () => {
          const { runHealthCheck } = await import('./healthCheckJob');
          await runHealthCheck();
        });
      },
      10 * MINUTE, // Every 10 minutes
      3 * MINUTE   // Start after 3 minutes
    );

    // Competitive analysis - every 24 hours, offset 270 min
    this.scheduleStaggeredJob(
      'competitive_analysis',
      async () => {
        await this.safeExecute('competitive_analysis', async () => {
          const { competitiveAnalysisJob } = await import('./competitiveAnalysisJob');
          await competitiveAnalysisJob();
        });
      },
      24 * 60 * MINUTE,
      270 * MINUTE
    );

    // Viral thread - every 24 hours if enabled
    if (flags.live) {
      const viralThreadIntervalMin = config.JOBS_VIRAL_THREAD_INTERVAL_MIN || 1440;
      this.scheduleStaggeredJob(
        'viral_thread',
        async () => {
          await this.safeExecute('viral_thread', async () => {
            const { runViralThreadJob } = await import('./viralThreadJob');
            await runViralThreadJob();
          });
        },
        viralThreadIntervalMin * MINUTE,
        300 * MINUTE
      );
    }

    // Shadow outcomes (only in shadow mode)
    if (modeFlags.simulateOutcomes) {
      this.scheduleStaggeredJob(
        'outcomes',
        async () => {
          await this.safeExecute('outcomes', async () => {
            await simulateOutcomes();
            this.stats.outcomeRuns++;
            this.stats.lastOutcomeTime = new Date();
          });
        },
        config.JOBS_LEARN_INTERVAL_MIN * MINUTE,
        25 * MINUTE
      );
    }

    // Status reporting - every hour
    this.timers.set('status', setInterval(() => {
      this.printHourlyStatus();
    }, 60 * MINUTE));

    console.log('✅ JOB_MANAGER: All jobs scheduled with staggered timing');
    console.log('   📊 Jobs spread across 60 minutes to prevent resource collisions');
    console.log('   🔥 Posting runs every 5 min with NO delay (highest priority)');
    console.log('   ⏰ Other jobs staggered: 2m, 7m, 12m, 15m, 22m, 32m, 35m, 42m, 45m, 52m...');
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

    // Validate environment variables before starting jobs
    const { validateEnvironmentVariables } = await import('../config/envValidation');
    validateEnvironmentVariables();

    const config = getConfig();
    const modeFlags = getModeFlags(config);

    if (!modeFlags.enableJobScheduling) {
      console.log('🕒 JOB_MANAGER: Job scheduling disabled (JOBS_AUTOSTART=false)');
      return;
    }

    // 🎯 FEATURE FLAG: Choose scheduling strategy
    const USE_STAGGERED = process.env.USE_STAGGERED_SCHEDULING !== 'false'; // Default ON
    
    console.log('🕒 JOB_MANAGER: Starting job timers...');
    console.log(`   • Mode: ${flags.mode} (live=${flags.live})`);
    console.log(`   • Scheduling: ${USE_STAGGERED ? 'STAGGERED (optimized)' : 'LEGACY (simultaneous)'}`);
    console.log(`   • Plan: ${flags.plannerEnabled ? 'ENABLED' : 'DISABLED'}`);
    console.log(`   • Reply: ${flags.replyEnabled ? 'ENABLED' : 'DISABLED'}`);
    console.log(`   • Posting: ${flags.postingEnabled ? 'ENABLED' : 'DISABLED'}`);
    console.log(`   • Learn: ${flags.learnEnabled ? 'ENABLED' : 'DISABLED'}`);
    console.log(`   • Attribution: ENABLED (every 2h)`);
    
    if (USE_STAGGERED) {
      await this.startStaggeredJobs(config, modeFlags);
      return;
    }
    
    // LEGACY SCHEDULING (fallback)
    console.log('⚠️  JOB_MANAGER: Using legacy simultaneous scheduling');
    
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
  /**
   * 🔄 Execute job with retry logic for critical jobs
   * Critical jobs (plan, posting) get 3 attempts with exponential backoff
   * Non-critical jobs fail fast after 1 attempt
   */
  private async safeExecute(jobName: string, jobFn: () => Promise<void>): Promise<void> {
    const isCritical = jobName === 'plan' || jobName === 'posting';
    const maxRetries = isCritical ? 3 : 1;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          console.log(`🕒 JOB_${jobName.toUpperCase()}: Starting (attempt ${attempt}/${maxRetries})...`);
        } else {
          console.log(`🕒 JOB_${jobName.toUpperCase()}: Starting...`);
        }
        
        await jobFn();
        console.log(`✅ JOB_${jobName.toUpperCase()}: Completed successfully`);
        return; // Success!
        
      } catch (error) {
        const errorMsg = error?.message || String(error);
        console.error(`❌ JOB_${jobName.toUpperCase()}: Attempt ${attempt} failed - ${errorMsg}`);
        
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 30000); // Exponential backoff: 2s, 4s, 8s (max 30s)
          console.log(`🔄 Retrying in ${delay/1000}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          this.stats.errors++;
          console.error(`❌ JOB_${jobName.toUpperCase()}: All ${maxRetries} attempts failed`);
          
          if (isCritical) {
            console.error(`🚨 CRITICAL: ${jobName.toUpperCase()} job completely failed! System may not post content.`);
          }
        }
      }
    }
  }

  /**
   * 🏥 Content Pipeline Health Check
   * Ensures plan job is running and queue has content
   * Runs every 30 minutes to catch stuck pipelines
   */
  public async checkContentPipelineHealth(): Promise<void> {
    try {
      const now = new Date();
      
      // Check 1: Has plan job run recently?
      if (this.stats.lastPlanTime) {
        const hoursSinceLastPlan = (now.getTime() - this.stats.lastPlanTime.getTime()) / (1000 * 60 * 60);
        
        if (hoursSinceLastPlan > 3) {
          console.error(`🚨 HEALTH_CHECK: Plan job hasn't run in ${hoursSinceLastPlan.toFixed(1)} hours!`);
          console.error(`🔧 ATTEMPTING EMERGENCY PLAN RUN...`);
          await this.runJobNow('plan');
          return; // Exit early after emergency run
        }
      } else {
        console.warn(`⚠️ HEALTH_CHECK: Plan job has never run!`);
        console.log(`🔧 Running plan job now...`);
        await this.runJobNow('plan');
        return;
      }
      
      // Check 2: Does queue have content?
      const { getSupabaseClient } = await import('../db/index');
      const supabase = getSupabaseClient();
      
      const { data: queuedContent, error } = await supabase
        .from('content_metadata')
        .select('id')
        .is('posted_at', null)
        .limit(1);
      
      if (error) {
        console.error(`❌ HEALTH_CHECK: Failed to query queue:`, error.message);
        return;
      }
      
      if (!queuedContent || queuedContent.length === 0) {
        console.warn(`⚠️ HEALTH_CHECK: No content in queue! Generating now...`);
        await this.runJobNow('plan');
        return;
      }
      
      // All checks passed
      console.log(`✅ HEALTH_CHECK: Content pipeline healthy (${queuedContent.length} posts queued)`);
      
    } catch (error) {
      console.error(`❌ HEALTH_CHECK: Error during health check:`, error.message);
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
    console.log(`   • Last plan: ${this.stats.lastPlanTime?.toISOString() || 'never'}`);
    console.log(`   • Last learn: ${this.stats.lastLearnTime?.toISOString() || 'never'}`);
  }

  /**
   * Force run a specific job (for testing/manual trigger)
   */
  public async runJobNow(jobName: 'plan' | 'reply' | 'posting' | 'outcomes' | 'realOutcomes' | 'analyticsCollector' | 'learn' | 'trainPredictor' | 'account_discovery'): Promise<void> {
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
      
      case 'account_discovery':
        await this.safeExecute('account_discovery', async () => {
          const { runAccountDiscovery } = await import('./accountDiscoveryJob');
          await runAccountDiscovery();
          this.stats.accountDiscoveryRuns = (this.stats.accountDiscoveryRuns || 0) + 1;
          this.stats.lastAccountDiscoveryTime = new Date();
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
