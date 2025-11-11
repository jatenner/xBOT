/**
 * 🕒 UNIFIED JOB MANAGER
 * Manages all recurring jobs: plan, reply, posting, learn with fail-fast in live mode
 */

import { log } from '../lib/logger';
import { flags } from '../config/featureFlags';
import { getConfig, getModeFlags } from '../config/config';
import { planContent } from './planJob'; // 🎯 SOPHISTICATED SYSTEM ACTIVE
import { generateReplies } from './replyJob';
import { processPostingQueue } from './postingQueue';
import { simulateOutcomes } from './shadowOutcomesJob';
import { collectRealOutcomes } from './realOutcomesJob';
import { collectRealOutcomes as collectAnalytics } from './analyticsCollectorJob';
import { runLearningCycle } from './learnJob';
import { runPhantomRecoveryJob } from './phantomRecoveryJob';

export interface JobStats {
  planRuns: number;
  replyRuns: number;
  postingRuns: number;
  outcomeRuns: number;
  learnRuns: number;
  accountDiscoveryRuns?: number;
  phantomRecoveryRuns?: number;
  lastPlanTime?: Date;
  lastReplyTime?: Date;
  lastPostingTime?: Date;
  lastOutcomeTime?: Date;
  lastLearnTime?: Date;
  lastAccountDiscoveryTime?: Date;
  lastPhantomRecoveryTime?: Date;
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
    log({ op: 'job_schedule', job: name, initial_delay_s: Math.round(initialDelayMs / 1000), interval_min: Math.round(intervalMs / 60000) });
    
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
    
    log({ op: 'job_manager_start', mode: 'staggered' });
    
    const envEnableReplies = process.env.ENABLE_REPLIES;
    const repliesEnabled = envEnableReplies !== 'false';

    // 🚨 CRITICAL: Check reply system environment variable
    // Default: enabled unless explicitly disabled
    if (!repliesEnabled) {
      console.warn('═══════════════════════════════════════════════════════');
      console.warn('⚠️  JOB_MANAGER: Reply system is DISABLED');
      console.warn('   Reason: ENABLE_REPLIES environment variable set to "false"');
      console.warn('');
      console.warn('   To enable replies:');
      console.warn('   1. Remove ENABLE_REPLIES or set ENABLE_REPLIES=true in your environment');
      console.warn('');
      console.warn('   Impact: 6 reply-related jobs will NOT run:');
      console.warn('   • mega_viral_harvester (finds viral tweets)');
      console.warn('   • reply_posting (generates and posts replies)');
      console.warn('   • reply_metrics_scraper (tracks reply performance)');
      console.warn('   • reply_learning (learns from reply success)');
      console.warn('   • engagement_calculator (calculates account engagement)');
      console.warn('   • reply_conversion_tracking (tracks follower attribution)');
      console.warn('═══════════════════════════════════════════════════════');
    } else {
      if (envEnableReplies === undefined) {
        console.log('✅ JOB_MANAGER: Reply system ENABLED (default). Set ENABLE_REPLIES=false to disable.');
      } else {
        console.log('✅ JOB_MANAGER: Reply system ENABLED (ENABLE_REPLIES=true)');
      }
      
      // Check if discovered_accounts table is empty on startup
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

    // Plan job - every 2 hours, with restart protection
    if (flags.plannerEnabled) {
      // 🔥 RESTART PROTECTION: Check if we need to run immediately
      const shouldRunImmediately = await this.shouldRunPlanJobImmediately();
      const startDelay = shouldRunImmediately ? 0 : (2 * MINUTE); // Immediate or 2min delay
      
      if (shouldRunImmediately) {
        console.log('🚀 JOB_MANAGER: Last plan run >2h ago, running immediately on startup');
      }
      
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
        startDelay // Immediate if needed, otherwise 2min delay
      );
    }

    // Reply job - REMOVED (replaced by aggressive reply_posting job below)

    // Velocity tracker - DISABLED (OPTIMIZATION: merged into analytics job)
    // Follower snapshots now handled by analytics job every 6 hours
    // This eliminates duplicate browser operations for follower tracking

    // Analytics - every 6 hours, offset 180 min (OPTIMIZED: reduced from 30min)
    // NOW INCLUDES: Follower snapshots (merged from velocity tracker)
    this.scheduleStaggeredJob(
      'analytics',
      async () => {
        await this.safeExecute('analytics', async () => {
          const { analyticsCollectorJobV2 } = await import('./analyticsCollectorJobV2');
          await analyticsCollectorJobV2();
          
          // OPTIMIZATION: Also run follower tracking here (was in velocity_tracker)
          try {
            const { runVelocityTracking } = await import('./velocityTrackerJob');
            await runVelocityTracking();
            console.log('[JOB_MANAGER] ✅ Follower tracking completed as part of analytics');
          } catch (velocityError: any) {
            console.warn('[JOB_MANAGER] ⚠️ Follower tracking failed:', velocityError.message);
          }
        });
      },
      360 * MINUTE, // Every 6 hours (was 30min)
      180 * MINUTE  // Offset 3 hours
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

    // Enhanced metrics - DISABLED (merged into analytics job for efficiency)
    // Was running every 30min, now consolidated into 6-hour analytics cycle
    // This eliminates redundant browser operations

    // Metrics scraper - every 20 minutes (balanced: frequent enough for fresh data, not too aggressive)
    this.scheduleStaggeredJob(
      'metrics_scraper',
      async () => {
        await this.safeExecute('metrics_scraper', async () => {
          const { metricsScraperJob } = await import('./metricsScraperJob');
          await metricsScraperJob();
        });
      },
      20 * MINUTE, // Every 20 minutes (balanced: was 6hr - too slow, was 10min - too aggressive)
      0 * MINUTE   // 🔥 START IMMEDIATELY on deploy (was 5min - too slow!)
    );

    // 🧠 Reply metrics scraper - every 30 minutes (METADATA GOATNESS: track reply performance)
    // Scrapes views/likes/followers for each reply to power learning system
    this.scheduleStaggeredJob(
      'reply_metrics_scraper',
      async () => {
        await this.safeExecute('reply_metrics_scraper', async () => {
          const { replyMetricsScraperJob } = await import('./replyMetricsScraperJob');
          await replyMetricsScraperJob();
        });
      },
      30 * MINUTE, // Every 30 minutes (replies need time to accumulate engagement)
      10 * MINUTE  // Offset 10 minutes (stagger from main metrics scraper)
    );

    // Data collection - every 6 hours, offset 220 min (OPTIMIZED: reduced from 60min)
    // EXTENDED: Also processes Visual Intelligence tweets (classification + analysis + intelligence building)
    this.scheduleStaggeredJob(
      'data_collection',
      async () => {
        await this.safeExecute('data_collection', async () => {
          const { DataCollectionEngine } = await import('../intelligence/dataCollectionEngine');
          const engine = DataCollectionEngine.getInstance();
          await engine.collectComprehensiveData();
          
          // NEW: Visual Intelligence processing (feature flagged)
          const { runVIProcessing } = await import('./vi-job-extensions');
          
          // AUTO-SEED on first run (if no accounts exist)
          const { autoSeedIfNeeded } = await import('./vi-job-extensions');
          await autoSeedIfNeeded();
          
          await runVIProcessing();
        });
      },
      360 * MINUTE, // Every 6 hours (was 60min)
      220 * MINUTE  // Offset ~3.7 hours
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
      
      // 🧠 Reply Learning Loop - every 2 hours (METADATA GOATNESS: analyze what works)
      // Learns from reply performance to improve future targeting
      this.scheduleStaggeredJob(
        'reply_learning',
        async () => {
          await this.safeExecute('reply_learning', async () => {
            const { ReplyLearningSystem } = await import('../learning/replyLearningSystem');
            await ReplyLearningSystem.getInstance().runLearningLoop();
          });
        },
        120 * MINUTE, // Every 2 hours (needs time to accumulate data)
        90 * MINUTE   // Offset 1.5 hours (after main learning)
      );
    }

    // News scraping - every 12 hours, offset 240 min (OPTIMIZED: reduced from 60min)
    this.scheduleStaggeredJob(
      'news_scraping',
      async () => {
        await this.safeExecute('news_scraping', async () => {
          const { twitterNewsScraperJob } = await import('../news/newsScraperJob');
          await twitterNewsScraperJob.runScrapingJob();
        });
      },
      720 * MINUTE, // Every 12 hours (was 60min)
      240 * MINUTE  // Offset 4 hours
    );

    // 🔥 Viral tweet scraper - every 4 hours, offset 180 min (NEW: format learning)
    // Scrapes trending viral tweets to learn universal formatting patterns
    // Populates viral_tweet_library for AI Visual Formatter
    // OPTIMIZED: 4 hours = 180 tweets/day (faster learning, reasonable costs)
    this.scheduleStaggeredJob(
      'viral_scraper',
      async () => {
        await this.safeExecute('viral_scraper', async () => {
          const { viralScraperJob } = await import('./viralScraperJob');
          await viralScraperJob();
        });
      },
      240 * MINUTE, // Every 4 hours (optimized: hits 500 tweets in 3 days, stays current)
      180 * MINUTE  // Offset 3 hours (spread out from other scrapers)
    );

    // 👥 Peer scraper - every 8 hours, offset 260 min (format learning from health accounts)
    // Scrapes hardcoded health Twitter accounts for niche-specific format patterns
    // Complements viral scraper (general patterns) with health-specific insights
    this.scheduleStaggeredJob(
      'peer_scraper',
      async () => {
        await this.safeExecute('peer_scraper', async () => {
          const { peerScraperJob } = await import('./peerScraperJob');
          await peerScraperJob();
        });
      },
      480 * MINUTE, // Every 8 hours (less frequent than viral scraper - more stable patterns)
      260 * MINUTE  // Offset ~4.3 hours (spread out from viral scraper)
    );

    // Account Discovery - every 90 min, offset 25 min (OPTIMIZED: reduced from 60min)
    // Pool of 874 accounts is healthy, reduce frequency to lower browser congestion
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
      90 * MINUTE, // Every 90 minutes (reduced from 60min - pool is healthy, reduces browser load)
      25 * MINUTE  // Start after 25 minutes (better stagger from tweet_harvester)
    );

    // 🔧 PHANTOM POST RECOVERY - DISABLED (OPTIMIZATION)
    // Edge case that's not worth browser overhead
    // Dashboard accuracy is good enough without this job

    // 🎯 TWEET-BASED HARVESTER - every 30 min, offset 10 min
    // NEW SYSTEM: Search Twitter directly for high-engagement tweets (not account-based)
    // Finds tweets with 2K+ likes OR 200+ comments from ANY account
    // No dependency on discovered_accounts - catches ALL viral health content
    // ⚠️ IMPORTANT: Only schedule if replies are enabled
    if (flags.replyEnabled && repliesEnabled) {
      console.log('═══════════════════════════════════════════════════════');
      console.log('💬 JOB_MANAGER: Reply jobs ENABLED - scheduling 6 jobs');
      console.log('═══════════════════════════════════════════════════════');
      
      // 🔥 MEGA-VIRAL REPLY HARVESTER - every 2 hours (UPGRADED: AI filtering + 10K-250K tiers)
      // Searches Twitter for truly massive viral health tweets only
      // Strategy: Broad discovery + AI health filtering + mega-viral thresholds
      // Frequency: Every 2 hours = 12 harvests/day = 720 opportunities/day (7.5x buffer for 96 replies/day)
      console.log('[JOB_MANAGER] 📋 Scheduling mega_viral_harvester (every 2 hours, offset 10min)');
      this.scheduleStaggeredJob(
        'mega_viral_harvester',
        async () => {
          console.log('[JOB_MANAGER] 🔥 HARVESTER: Job triggered, attempting to run...');
          try {
            await this.safeExecute('mega_viral_harvester', async () => {
              console.log('[JOB_MANAGER] 🔥 HARVESTER: Importing module...');
              const { replyOpportunityHarvester } = await import('./replyOpportunityHarvester');
              console.log('[JOB_MANAGER] 🔥 HARVESTER: Module imported, executing...');
              await replyOpportunityHarvester();
              console.log('[JOB_MANAGER] 🔥 HARVESTER: Execution complete');
            });
          } catch (error: any) {
            console.error('[JOB_MANAGER] 🔥 HARVESTER: FATAL ERROR:', error.message);
            console.error('[JOB_MANAGER] 🔥 HARVESTER: Stack:', error.stack);
            throw error;
          }
        },
        120 * MINUTE, // Every 2 hours - ensures 720+ opportunities/day (safe buffer)
        10 * MINUTE // Start after 10 minutes
      );
      console.log('[JOB_MANAGER] ✅ mega_viral_harvester scheduled successfully');

      // 📊 ENGAGEMENT RATE CALCULATOR - every 24 hours, offset 60 min
      // 🔥 NEW: Calculate real engagement rates for discovered accounts
      // Replaces 0.02 placeholders with actual data
      // Enables accurate account quality filtering (2%+ engagement filter)
      this.scheduleStaggeredJob(
        'engagement_calculator',
        async () => {
          await this.safeExecute('engagement_calculator', async () => {
            const { calculateEngagementRatesBatch } = await import('./engagementRateCalculator');
            await calculateEngagementRatesBatch(50); // Calculate 50 accounts per run
          });
        },
        1440 * MINUTE, // Every 24 hours (daily calculation)
        60 * MINUTE // Start after 60 minutes (give system time to start)
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
      
      // 📊 REPLY CONVERSION TRACKING JOB - every 90 min, offset 95 min (OPTIMIZED)
      // 🎯 Tracks which replies drive followers and updates account priorities
      // Not time-sensitive, reduced frequency to lower browser congestion
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
        90 * MINUTE, // Every 90 minutes (reduced from 60min - not time-sensitive)
        95 * MINUTE // Start after 95 minutes (better stagger, give time for replies to get engagement)
      );
    } else {
      console.warn('═══════════════════════════════════════════════════════');
      console.warn('⚠️  JOB_MANAGER: Reply jobs DISABLED');
      console.warn(`   • ENABLE_REPLIES: ${envEnableReplies || 'NOT SET (defaults to true)'}`);
      console.warn(`   • flags.replyEnabled: ${flags.replyEnabled}`);
      console.warn('');
      console.warn('   Reply system will NOT function without ENABLE_REPLIES=true');
      console.warn('   See startup warnings above for how to enable.');
      console.warn('═══════════════════════════════════════════════════════');
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

    // 🔍 ID Recovery - every 10 minutes, offset 4 min
    // Self-healing job to find real tweet IDs for posts with NULL tweet_id
    // Allows posting to succeed even if immediate ID extraction fails
    this.scheduleStaggeredJob(
      'id_recovery',
      async () => {
        await this.safeExecute('id_recovery', async () => {
          const { idRecoveryJob } = await import('./idRecoveryJob');
          await idRecoveryJob();
        });
      },
      10 * MINUTE,
      4 * MINUTE  // Run 4 minutes after startup (recovers IDs quickly)
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

  /**
   * 🔥 RESTART PROTECTION: Check if plan job should run immediately
   * Prevents long gaps after server restarts
   */
  private async shouldRunPlanJobImmediately(): Promise<boolean> {
    try {
      const { getSupabaseClient } = await import('../db/index');
      const supabase = getSupabaseClient();
      
      // Check when we last generated content
      const { data: lastGenerated, error } = await supabase
        .from('content_metadata')
        .select('created_at')
        .in('decision_type', ['single', 'thread'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error || !lastGenerated) {
        console.log('[RESTART_PROTECTION] No previous content found, running immediately');
        return true; // No previous content, run now
      }
      
      const lastGeneratedTime = new Date(String(lastGenerated.created_at));
      const hoursSinceLastGeneration = (Date.now() - lastGeneratedTime.getTime()) / (1000 * 60 * 60);
      
      console.log(`[RESTART_PROTECTION] Last content generated: ${hoursSinceLastGeneration.toFixed(1)}h ago`);
      
      // If last generation was >2 hours ago, run immediately
      if (hoursSinceLastGeneration > 2) {
        console.log('[RESTART_PROTECTION] ⚠️ Gap detected: Running plan job immediately');
        return true;
      }
      
      return false; // Recent content exists, use normal schedule
      
    } catch (error: any) {
      console.error('[RESTART_PROTECTION] Error checking last run:', error.message);
      return false; // On error, use normal schedule
    }
  }
}
