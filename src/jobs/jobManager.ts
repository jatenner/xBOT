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
import { recordJobFailure, recordJobSkip, recordJobStart, recordJobSuccess } from './jobHeartbeat';
import { recordJobRun, recordJobError, getJobHeartbeats } from './jobHeartbeatRegistry';

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
  // 🔥 CRITICAL JOB FAILURE TRACKING: Track consecutive failures for emergency recovery
  private criticalJobFailures = new Map<string, number>();

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
    let isRunning = false;
    
    // 🔍 TIMER TRACKING: Log timer scheduling to DB
    const logTimerScheduled = async () => {
      try {
        const { getSupabaseClient } = await import('../db/index');
        const supabase = getSupabaseClient();
        await supabase.from('system_events').insert({
          event_type: 'timer_scheduled',
          severity: 'info',
          message: `Timer scheduled: ${name}`,
          event_data: {
            job_name: name,
            initial_delay_ms: initialDelayMs,
            interval_ms: intervalMs,
            scheduled_at: new Date().toISOString(),
          },
          created_at: new Date().toISOString(),
        });
      } catch (e) {
        // Non-critical - continue
      }
    };
    
    const logTimerFired = async (phase: 'initial' | 'recurring') => {
      try {
        const { getSupabaseClient } = await import('../db/index');
        const supabase = getSupabaseClient();
        await supabase.from('system_events').insert({
          event_type: 'timer_fired',
          severity: 'info',
          message: `Timer fired: ${name} (${phase})`,
          event_data: {
            job_name: name,
            phase,
            fired_at: new Date().toISOString(),
          },
          created_at: new Date().toISOString(),
        });
      } catch (e) {
        // Non-critical - continue
      }
    };
    
    const executeJob = async (phase: 'initial' | 'recurring') => {
      if (isRunning) {
        console.warn('[JOB_' + name.toUpperCase() + '] Previous run still executing, skipping ' + phase + ' trigger');
        await recordJobSkip(name, 'previous_run_in_progress');
        return;
      }
      isRunning = true;
      try {
        await logTimerFired(phase);
        console.log('[JOB_' + name.toUpperCase() + '] Timer fired (' + phase + '), calling jobFn...');
        await jobFn();
        console.log('[JOB_' + name.toUpperCase() + '] Job function completed successfully');
      } catch (error: any) {
        console.error('[JOB_' + name.toUpperCase() + '] Job function failed:', error?.message || String(error));
        console.error('[JOB_' + name.toUpperCase() + '] Stack:', error?.stack);
        
        // Log to DB for visibility
        try {
          const { getSupabaseClient } = await import('../db/index');
          const supabase = getSupabaseClient();
          await supabase.from('system_events').insert({
            event_type: `${name}_job_execution_failed`,
            severity: 'error',
            message: `Job execution failed after timer fired: ${error?.message || String(error)}`,
            event_data: {
              job_name: name,
              phase,
              error: error?.message || String(error),
              stack: error?.stack?.substring(0, 500),
            },
            created_at: new Date().toISOString(),
          });
        } catch (dbError) {
          // Non-critical
        }
        
        throw error; // Re-throw to let safeExecute handle retries
      } finally {
        isRunning = false;
      }
    };

    log({ op: 'job_schedule', job: name, initial_delay_s: Math.round(initialDelayMs / 1000), interval_min: Math.round(intervalMs / 60000) });
    
    // Log timer scheduling to DB
    logTimerScheduled().catch(() => {});
    
    // Schedule first run after initial delay
    console.log('[JOB_MANAGER] Scheduling ' + name + ' - initial delay: ' + Math.round(initialDelayMs / 1000) + 's, interval: ' + Math.round(intervalMs / 60000) + 'min');
    if (name === 'hourly_tick') {
      console.log('[SCHEDULE_STAGGERED_JOB] hourly_tick registered: initial_delay=' + Math.round(initialDelayMs / 1000) + 's, interval=' + Math.round(intervalMs / 60000) + 'min');
    }
    const initialTimer = setTimeout(async () => {
      try {
        console.log('[JOB_MANAGER] ' + name + ' initial timer fired - executing job...');
        await executeJob('initial'); // First execution
        
        // Then set up recurring interval
        console.log('[JOB_MANAGER] ' + name + ' initial run complete - setting up recurring timer...');
        const recurringTimer = setInterval(async () => {
          try {
            await executeJob('recurring');
          } catch (error) {
            console.error('[JOB_' + name.toUpperCase() + '] Recurring execution failed:', error?.message || String(error));
          }
        }, intervalMs);
        this.timers.set(name, recurringTimer);
        console.log('[JOB_MANAGER] ' + name + ' recurring timer set (interval: ' + Math.round(intervalMs / 60000) + 'min)');
      } catch (error) {
        console.error('[JOB_' + name.toUpperCase() + '] Initial execution failed:', error?.message || String(error));
        console.error('[JOB_' + name.toUpperCase() + '] Stack:', error?.stack);
      }
    }, initialDelayMs);
    
    // Store initial timer (will be replaced by recurring timer after first run)
    this.timers.set(`${name}_initial`, initialTimer);
    console.log('[JOB_MANAGER] ' + name + ' initial timer scheduled (fires in ' + Math.round(initialDelayMs / 1000) + 's)');
  }

  /**
   * 🚀 START STAGGERED JOBS
   * Spread job execution across time to prevent browser resource collisions
   */
  private async startStaggeredJobs(config: any, modeFlags: any): Promise<void> {
    this.isRunning = true;
    
    log({ op: 'job_manager_start', mode: 'staggered' });
    
    const envEnableReplies = process.env.ENABLE_REPLIES;
    const repliesEnabled = envEnableReplies === 'true';

    // 🚨 CRITICAL: Check reply system environment variable
    // Default: DISABLED unless explicitly enabled
    if (!repliesEnabled) {
      console.warn('═══════════════════════════════════════════════════════');
      console.warn('[JOB_MANAGER] Reply system is DISABLED');
      console.warn('   Reason: ENABLE_REPLIES not set to "true" (defaults to disabled)');
      console.warn('');
      console.warn('   To enable replies:');
      console.warn('   1. Set ENABLE_REPLIES=true in your environment');
      console.warn('');
      console.warn('   Impact: 6 reply-related jobs will NOT run:');
      console.warn('   • mega_viral_harvester (finds viral tweets)');
      console.warn('   • reply_posting (generates and posts replies)');
      console.warn('   • reply_metrics_scraper (tracks reply performance)');
      console.warn('   • reply_performance_snapshot (30m/2h/24h/72h snapshots for learning)');
      console.warn('   • reply_learning (learns from reply success)');
      console.warn('   • engagement_calculator (calculates account engagement)');
      console.warn('   • reply_conversion_tracking (tracks follower attribution)');
      console.warn('═══════════════════════════════════════════════════════');
    } else {
      console.log('[JOB_MANAGER] Reply system ENABLED (ENABLE_REPLIES=true)');
    }
      
      // Check if discovered_accounts table is empty on startup
    // If empty, trigger account discovery IMMEDIATELY so reply system can work
    try {
      const { getAccountPoolHealth } = await import('./accountDiscoveryJob');
      const poolHealth = await getAccountPoolHealth();
      
      if (poolHealth.status === 'critical' && poolHealth.total_accounts === 0) {
        console.log('[JOB_MANAGER] discovered_accounts table is EMPTY - triggering immediate discovery...');
        const { runAccountDiscovery } = await import('./accountDiscoveryJob');
        
        // Run in background, don't block startup
        runAccountDiscovery()
          .then(() => {
            console.log('[JOB_MANAGER] Initial account discovery completed');
            this.stats.accountDiscoveryRuns = (this.stats.accountDiscoveryRuns || 0) + 1;
            this.stats.lastAccountDiscoveryTime = new Date();
          })
          .catch((err) => {
            console.error('[JOB_MANAGER] Initial account discovery failed:', err.message);
            console.log('[JOB_MANAGER] Will retry in 25 minutes on scheduled run');
          });
      } else {
        console.log('[JOB_MANAGER] Account pool status: ' + poolHealth.status + ' (' + poolHealth.total_accounts + ' accounts) - reply system ready');
      }
    } catch (error: any) {
      console.error('[JOB_MANAGER] Failed to check account pool health:', error.message);
    }
    
    // Define stagger offsets (in seconds) to spread jobs across time
    const MINUTE = 60 * 1000;
    const SECOND = 1000;
    
    // 🎯 RATE CONTROLLER: Hourly tick replaces 5-min posting queue
    // Posting/replies now scheduled within hourly tick with jitter
    console.log('[JOB_MANAGER] Checking postingEnabled flag: mode=' + flags.mode + ', live=' + flags.live + ', postingEnabled=' + flags.postingEnabled);
    if (flags.postingEnabled) {
      // 🔒 SCHEMA PREFLIGHT: Run on boot
      (async () => {
        try {
          const { runSchemaPreflight } = await import('../rateController/schemaPreflight');
          const preflight = await runSchemaPreflight();
          if (!preflight.passed) {
            console.error('[JOB_MANAGER] Schema preflight failed on boot - SAFE_MODE activated');
            console.error('[JOB_MANAGER] Missing: ' + preflight.missing.join(', '));
            console.error('[JOB_MANAGER] Hourly tick will be disabled until schema is applied');
          }
        } catch (e: any) {
          console.error('[JOB_MANAGER] Schema preflight check failed: ' + e.message);
        }
      })();

      console.log('[HOURLY_TICK_SCHEDULE] Scheduled: cadence=60min, initial_delay=0s (postingEnabled=true)');
      this.scheduleStaggeredJob(
        'hourly_tick',
        async () => {
          await this.safeExecute('hourly_tick', async () => {
            const { executeHourlyTick } = await import('../rateController/hourlyTick');
            await executeHourlyTick();
            this.stats.postingRuns++;
            this.stats.lastPostingTime = new Date();
          });
        },
        60 * MINUTE, // Every hour
        0 // Start immediately
      );
      console.log('[HOURLY_TICK_SCHEDULE] hourly_tick scheduled successfully');
      
      // Keep legacy posting queue as fallback (disabled by default via env)
      // Can be re-enabled for testing: ENABLE_LEGACY_POSTING_QUEUE=true
      if (process.env.ENABLE_LEGACY_POSTING_QUEUE === 'true') {
        console.log('[JOB_MANAGER] Legacy 5-min posting queue enabled (testing mode)');
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
          0
        );
      } else {
        console.log('[JOB_MANAGER] Rate controller hourly tick enabled (legacy 5-min queue disabled)');
      }
    } else {
      console.log('[HOURLY_TICK_SCHEDULE] Skipped: posting disabled (flags.postingEnabled=' + flags.postingEnabled + ', mode=' + flags.mode + ', DISABLE_POSTING=' + (process.env.DISABLE_POSTING || 'unset') + ')');
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
    // NOW INCLUDES: Follower snapshots (merged from velocity tracker) + Performance Analytics
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
            console.log('[JOB_MANAGER] Follower tracking completed as part of analytics');
          } catch (velocityError: any) {
            console.warn('[JOB_MANAGER] Follower tracking failed:', velocityError.message);
          }
          
          // NEW: Performance Analytics (engagement tiers, generators, etc.)
          try {
            const { analyticsJob } = await import('./analyticsJob');
            await analyticsJob();
            console.log('[JOB_MANAGER] Performance analytics completed');
          } catch (perfError: any) {
            console.warn('[JOB_MANAGER] Performance analytics failed:', perfError.message);
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
          // 🚨 POSTING PRIORITY: Skip metrics scraping if disabled via env flag
          // 🔒 HARDENING: Default to false if not set (ensure metrics collection is enabled by default)
          const disableMetricsJob = (process.env.DISABLE_METRICS_JOB || 'false').toLowerCase() === 'true';
          if (disableMetricsJob) {
            console.log('[METRICS_SCRAPER] Skipped (DISABLE_METRICS_JOB=true)');
            await (await import('./jobHeartbeat')).recordJobSkip('metrics_scraper', 'disabled_via_env');
            return;
          }
          const { shouldRunLowPriority } = await import('../browser/BrowserHealthGate');
          if (!(await shouldRunLowPriority())) {
            await (await import('./jobHeartbeat')).recordJobSkip('metrics_scraper', 'browser_degraded');
            return;
          }
          await this.safeExecute('metrics_scraper', async () => {
            const { metricsScraperJob } = await import('./metricsScraperJob');
            await metricsScraperJob();
          });
      },
      20 * MINUTE, // Every 20 minutes (balanced: was 6hr - too slow, was 10min - too aggressive)
      0 * MINUTE   // 🔥 START IMMEDIATELY on deploy (was 5min - too slow!)
    );

    // 👻 Ghost reconciliation - every 15 minutes (per mandate: until stable, then hourly)
    this.scheduleStaggeredJob(
      'ghost_recon',
      async () => {
        if (process.env.SHADOW_MODE === 'true' || process.env.MODE === 'shadow') { return; }
        await this.safeExecute('ghost_recon', async () => {
          const { getSupabaseClient } = await import('../db/index');
          const supabase = getSupabaseClient();
          const { runGhostReconciliation } = await import('./ghostReconciliationJob');
          const result = await runGhostReconciliation();
          console.log('[GHOST_RECON] Completed: checked=' + result.checked + ' ghosts=' + result.ghosts_found + ' inserted=' + result.ghosts_inserted);
          
          // If no ghosts found for 2 hours, switch to hourly schedule
          const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
          const { count: recentGhosts } = await supabase
            .from('ghost_tweets')
            .select('*', { count: 'exact', head: true })
            .gte('detected_at', twoHoursAgo);
          
          if ((recentGhosts || 0) === 0) {
            // System stable - can reduce frequency (but keep 15min for now per mandate)
            console.log('[GHOST_RECON] No ghosts in last 2h - system stable');
          }
        });
      },
      15 * MINUTE, // Every 15 minutes (per mandate: until stable, then hourly - but keep 15min for safety)
      5 * MINUTE   // Start after 5 minutes (let system stabilize)
    );
    
    // 📊 Production proof rollup - every 10 minutes (dashboard)
    this.scheduleStaggeredJob(
      'production_proof_rollup',
      async () => {
        await this.safeExecute('production_proof_rollup', async () => {
          const { runProductionProofRollup } = await import('./replySystemV2/productionProofRollup');
          await runProductionProofRollup();
        });
      },
      10 * MINUTE, // Every 10 minutes
      1 * MINUTE   // Start after 1 minute
    );

    // 🎼 Reply System V2 - fetch/evaluate/queue every 5 minutes
    console.log('[JOB_MANAGER] 🎼 Scheduling reply_v2_fetch job (interval: 5min, initial delay: 2min)');
    this.scheduleStaggeredJob(
      'reply_v2_fetch',
      async () => {
        if (process.env.SHADOW_MODE === 'true' || process.env.MODE === 'shadow') { return; }
        console.log('[JOB_MANAGER] 🎼 reply_v2_fetch job timer fired - calling safeExecute...');
        await this.safeExecute('reply_v2_fetch', async () => {
          console.log('[JOB_MANAGER] 🎼 reply_v2_fetch safeExecute started - importing orchestrator...');
          const { runFullCycle } = await import('./replySystemV2/orchestrator');
          console.log('[JOB_MANAGER] 🎼 reply_v2_fetch orchestrator imported - calling runFullCycle...');
          await runFullCycle();
          console.log('[JOB_MANAGER] 🎼 reply_v2_fetch runFullCycle completed');
        });
      },
      5 * MINUTE, // Every 5 minutes
      2 * MINUTE  // Start after 2 minutes
    );

    // ⏰ Reply System V2 - scheduled posting (DISABLED - now handled by hourly tick)
    // Replies are now scheduled within hourly tick with jitter spacing
    if (process.env.ENABLE_LEGACY_REPLY_SCHEDULER === 'true') {
      console.log('[JOB_MANAGER] Legacy reply_v2_scheduler enabled (testing mode)');
      const REPLY_V2_TICK_SECONDS = parseInt(process.env.REPLY_V2_TICK_SECONDS || '900', 10); // Default: 15 min
      const REPLY_V2_TICK_MS = REPLY_V2_TICK_SECONDS * 1000;
      this.scheduleStaggeredJob(
        'reply_v2_scheduler',
        async () => {
          await this.safeExecute('reply_v2_scheduler', async () => {
            const { attemptScheduledReply } = await import('./replySystemV2/tieredScheduler');
            const result = await attemptScheduledReply();
            if (!result.posted) {
              console.log('[REPLY_V2_SCHEDULER] No reply posted: ' + result.reason);
            }
          });
        },
        REPLY_V2_TICK_MS,
        3 * MINUTE
      );
    } else {
      console.log('[JOB_MANAGER] Reply scheduling handled by hourly tick (legacy reply_v2_scheduler disabled)');
    }

    // 📊 Reply System V2 - performance tracking every 30 minutes
    this.scheduleStaggeredJob(
      'reply_v2_performance',
      async () => {
        if (process.env.SHADOW_MODE === 'true' || process.env.MODE === 'shadow') { return; }
        await this.safeExecute('reply_v2_performance', async () => {
          const { updatePerformanceMetrics } = await import('./replySystemV2/performanceTracker');
          await updatePerformanceMetrics();
        });
      },
      30 * MINUTE, // Every 30 minutes
      10 * MINUTE  // Start after 10 minutes
    );

    // 📊 Reply System V2 - hourly summary report + control plane adjustment
    this.scheduleStaggeredJob(
      'reply_v2_hourly_summary',
      async () => {
        await this.safeExecute('reply_v2_hourly_summary', async () => {
          const { generateHourlySummary } = await import('./replySystemV2/summaryReporter');
          await generateHourlySummary();
          
          // Run hourly control plane adjustment
          const { runHourlyControlPlane } = await import('./replySystemV2/controlPlaneAgent');
          await runHourlyControlPlane();
        });
      },
      60 * MINUTE, // Every hour
      5 * MINUTE   // Start after 5 minutes
    );

    // 🧠 Learning loop - daily (updates outcome scores and strategy/hour weights)
    this.scheduleStaggeredJob(
      'learning_loop',
      async () => {
        await this.safeExecute('learning_loop', async () => {
          const { runLearningCycle } = await import('./learnJob');
          await runLearningCycle();
        });
      },
      24 * 60 * MINUTE, // Every 24 hours
      60 * MINUTE // Start after 1 hour
    );

    // 📊 Reply System V2 - daily summary report + control plane adjustment
    this.scheduleStaggeredJob(
      'reply_v2_daily_summary',
      async () => {
        await this.safeExecute('reply_v2_daily_summary', async () => {
          const { generateDailySummary } = await import('./replySystemV2/summaryReporter');
          await generateDailySummary();
          
          // Run daily control plane adjustment
          const { runDailyControlPlane } = await import('./replySystemV2/controlPlaneAgent');
          await runDailyControlPlane();
        });
      },
      24 * 60 * MINUTE, // Daily
      0 * MINUTE  // Start immediately (will check if it's a new day)
    );

    // 📈 Reply System V2 - weekly ratchet (every Monday)
    this.scheduleStaggeredJob(
      'reply_v2_ratchet',
      async () => {
        await this.safeExecute('reply_v2_ratchet', async () => {
          const { replyRatchetJob } = await import('./replySystemV2/main');
          await replyRatchetJob();
        });
      },
      7 * 24 * 60 * MINUTE, // Weekly
      0 * MINUTE  // Start immediately (will check if it's Monday)
    );

    // 📸 Follower snapshot job - every 30 minutes, offset 20 min
    // Captures 2h, 24h, 48h snapshots for accurate follower attribution
    this.scheduleStaggeredJob(
      'follower_snapshot',
      async () => {
        await this.safeExecute('follower_snapshot', async () => {
          const { followerSnapshotJob } = await import('./followerSnapshotJob');
          await followerSnapshotJob();
        });
      },
      30 * MINUTE,
      20 * MINUTE
    );

    // 🧠 Reply metrics scraper - every 30 minutes (METADATA GOATNESS: track reply performance)
    // Scrapes views/likes/followers for each reply to power learning system
    this.scheduleStaggeredJob(
      'reply_metrics_scraper',
      async () => {
          if (process.env.SHADOW_MODE === 'true' || process.env.MODE === 'shadow') { return; }
          const { shouldRunLowPriority } = await import('../browser/BrowserHealthGate');
          if (!(await shouldRunLowPriority())) {
            await (await import('./jobHeartbeat')).recordJobSkip('reply_metrics_scraper', 'browser_degraded');
            return;
          }
          await this.safeExecute('reply_metrics_scraper', async () => {
            const { replyMetricsScraperJob } = await import('./replyMetricsScraperJob');
            await replyMetricsScraperJob();
          });
      },
      30 * MINUTE, // Every 30 minutes (replies need time to accumulate engagement)
      10 * MINUTE  // Offset 10 minutes (stagger from main metrics scraper)
    );

    // Reply performance snapshots (30m, 2h, 24h, 72h) — run after reply_metrics_scraper has had a cycle
    this.scheduleStaggeredJob(
      'reply_performance_snapshot',
      async () => {
        const { shouldRunLowPriority } = await import('../browser/BrowserHealthGate');
        if (!(await shouldRunLowPriority())) {
          await (await import('./jobHeartbeat')).recordJobSkip('reply_performance_snapshot', 'browser_degraded');
          return;
        }
        await this.safeExecute('reply_performance_snapshot', async () => {
          const { runReplyPerformanceSnapshotJob } = await import('./replySystemV2/replyPerformanceSnapshotJob');
          await runReplyPerformanceSnapshotJob();
        });
      },
      45 * MINUTE, // Every 45 minutes (after scraper has populated content_metadata)
      25 * MINUTE  // Offset 25 min (stagger after reply_metrics_scraper at 10 min)
    );

    // Data collection - every 2 hours, offset 220 min (OPTIMIZED: increased frequency for faster VI analysis)
    // EXTENDED: Also processes Visual Intelligence tweets (classification + analysis + intelligence building)
    // ✅ OPTIMIZED: Runs every 2 hours (was 6 hours) to analyze 6,000 tweets/day instead of 400
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
      120 * MINUTE, // ✅ OPTIMIZED: Every 2 hours (was 6 hours) - 6x more frequent for faster analysis
      220 * MINUTE  // Offset ~3.7 hours
    );

    // ✅ NEW: Expert Analysis - every 6 hours, offset 240 min
    // Analyzes successful tweets with GPT-4o as expert social media manager
    this.scheduleStaggeredJob(
      'expert_analysis',
      async () => {
        await this.safeExecute('expert_analysis', async () => {
          const { expertAnalysisJob } = await import('./expertAnalysisJob');
          await expertAnalysisJob();
        });
      },
      360 * MINUTE, // Every 6 hours
      240 * MINUTE  // Offset 4 hours
    );

    // ✅ NEW: Expert Insights Aggregator - every 12 hours, offset 480 min
    // Synthesizes expert analyses into strategic recommendations
    this.scheduleStaggeredJob(
      'expert_insights_aggregator',
      async () => {
        await this.safeExecute('expert_insights_aggregator', async () => {
          const { expertInsightsAggregatorJob } = await import('./expertInsightsAggregatorJob');
          await expertInsightsAggregatorJob();
        });
      },
      720 * MINUTE, // Every 12 hours
      480 * MINUTE  // Offset 8 hours
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
      
      // 🎯 Phase 3: Reply Priority Learning - every 90 minutes
      // Updates discovered_accounts.priority_score based on v2 reply metrics
      this.scheduleStaggeredJob(
        'reply_priority_learning',
        async () => {
          await this.safeExecute('reply_priority_learning', async () => {
            const { replyLearningJob } = await import('./replyLearningJob');
            await replyLearningJob();
          });
        },
        90 * MINUTE, // Every 90 minutes (faster than main reply learning for priority updates)
        100 * MINUTE  // Offset 100 minutes (stagger from main reply learning)
      );
      
      // 🎯 v2: Offline Weight Map Job - every 6 hours
      // Computes weight maps from vw_learning for content generation guidance
      this.scheduleStaggeredJob(
        'offline_weight_map',
        async () => {
          await this.safeExecute('offline_weight_map', async () => {
            const { offlineWeightMapJob } = await import('./offlineWeightMapJob');
            await offlineWeightMapJob();
          });
        },
        360 * MINUTE, // Every 6 hours (needs enough data to compute meaningful weights)
        300 * MINUTE  // Offset 5 hours (after learning cycles have run)
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

    // 🧠 VI Deep Analysis - every 12 hours, offset 240 min (NEW: deep semantic/visual understanding)
    // Deep AI-driven analysis of high-performing tweets to understand essence, not just structure
    this.scheduleStaggeredJob(
      'vi_deep_analysis',
      async () => {
        await this.safeExecute('vi_deep_analysis', async () => {
          const { viDeepAnalysisJob } = await import('./viDeepAnalysisJob');
          await viDeepAnalysisJob();
        });
      },
      12 * 60 * MINUTE, // Every 12 hours
      240 * MINUTE      // Start after 4 hours
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

    // 👥 Peer scraper - every 2 hours, offset 260 min (MAXIMIZED: format learning from health accounts)
    // Scrapes hardcoded health Twitter accounts for niche-specific format patterns
    // Complements viral scraper (general patterns) with health-specific insights
    // OPTIMIZED: 2 hours = 12 runs/day = ~12,600 tweets/day (was 8 hours = 3,150/day)
    // 🔥 CRITICAL: VI Collection needs to run continuously until 10k-100k tweets collected
    // Reduced initial delay to 10 minutes (was 260 min) so it starts quickly
    this.scheduleStaggeredJob(
      'peer_scraper',
      async () => {
        // 🚨 POSTING PRIORITY: Skip VI scraping if disabled via env flag
        if (process.env.DISABLE_VI_SCRAPE === 'true') {
          console.log('[PEER_SCRAPER] Skipped (DISABLE_VI_SCRAPE=true)');
          await (await import('./jobHeartbeat')).recordJobSkip('peer_scraper', 'disabled_via_env');
          return;
        }
        // VI collection is critical - ensure it runs with retries
        await this.safeExecute('peer_scraper', async () => {
          const { peerScraperJob } = await import('./peerScraperJob');
          await peerScraperJob();
        });
      },
      120 * MINUTE, // Every 2 hours (MAXIMIZED: 12 runs/day for maximum collection)
      10 * MINUTE   // 🔥 REDUCED: Start after 10 minutes (was 260 min = 4.3 hours)
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
      
      // 🔥 MEGA-VIRAL REPLY HARVESTER - configurable interval (UPGRADED: AI filtering + 10K-250K tiers)
      // Searches Twitter for truly massive viral health tweets only
      // Strategy: Broad discovery + AI health filtering + mega-viral thresholds
      // Frequency: Configurable via JOBS_HARVEST_INTERVAL_MIN (default: 15 min for production)
      const harvestIntervalMin = config.JOBS_HARVEST_INTERVAL_MIN;
      console.log('[JOB_MANAGER] Scheduling mega_viral_harvester (every ' + harvestIntervalMin + ' min, offset 10min)');
      this.scheduleStaggeredJob(
        'mega_viral_harvester',
        async () => {
          // 🔧 PERMANENT FIX #1: Allow degraded mode operation instead of hard block
          const { getBrowserHealth } = await import('../browser/BrowserHealthGate');
          const browserHealth = await getBrowserHealth();
          
          if (browserHealth === 'degraded') {
            console.warn('[JOB_MANAGER] HARVESTER: Browser degraded, running in degraded mode');
            // Continue with degraded mode - reduced operations but still functional
            // Set environment variable to signal degraded mode to harvester
            process.env.HARVESTER_DEGRADED_MODE = 'true';
          } else {
            // Healthy mode - full operation
            delete process.env.HARVESTER_DEGRADED_MODE;
          }
          
          // 🚫 HARVESTING_ENABLED CHECK: Skip harvesting if disabled (Railway split architecture)
          const harvestingEnabled = process.env.HARVESTING_ENABLED !== 'false';
          if (!harvestingEnabled) {
            console.log('[JOB_MANAGER] [HARVEST] disabled_by_env HARVESTING_ENABLED=false (harvesting runs locally, not on Railway)');
            return;
          }

          console.log('[JOB_MANAGER] HARVESTER: Job triggered, attempting to run...');
          try {
            await this.safeExecute('mega_viral_harvester', async () => {
              console.log('[JOB_MANAGER] HARVESTER: Importing module...');
              const { replyOpportunityHarvester } = await import('./replyOpportunityHarvester');
              console.log('[JOB_MANAGER] HARVESTER: Module imported, executing...');
              await replyOpportunityHarvester();
              console.log('[JOB_MANAGER] HARVESTER: Execution complete');
            });
          } catch (error: any) {
            console.error('[JOB_MANAGER] HARVESTER: FATAL ERROR:', error.message);
            console.error('[JOB_MANAGER] HARVESTER: Stack:', error.stack);
            // 🔧 PERMANENT FIX: Don't throw - allow retry on next cycle
            // Log error but don't crash the job scheduler
            console.warn('[JOB_MANAGER] HARVESTER: Error logged, will retry on next cycle');
          }
        },
        harvestIntervalMin * MINUTE, // Configurable interval (default: 15 min)
        10 * MINUTE // Start after 10 minutes
      );
      console.log('[JOB_MANAGER] mega_viral_harvester scheduled successfully');

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

      // 🔥 PRIORITY 2 FIX: DATABASE RETRY QUEUE JOB - every 10 minutes
      // Processes failed database saves from retry queue
      this.scheduleStaggeredJob(
        'db_retry_queue',
        async () => {
          await this.safeExecute('db_retry_queue', async () => {
            const { processDbRetryQueue } = await import('./dbRetryQueueJob');
            await processDbRetryQueue();
          });
        },
        10 * MINUTE, // Every 10 minutes (frequent retries for fast recovery)
        15 * MINUTE // Start after 15 minutes (after system is stable)
      );

      // 🔥 PRIORITY 1 FIX: BACKUP FILE CLEANUP - daily at 2 AM
      // Cleans up old backup entries (older than 30 days)
      this.scheduleStaggeredJob(
        'backup_cleanup',
        async () => {
          await this.safeExecute('backup_cleanup', async () => {
            const { cleanupOldBackups } = await import('../utils/tweetIdBackup');
            cleanupOldBackups();
          });
        },
        1440 * MINUTE, // Daily
        120 * MINUTE // Start at 2 AM (2 hours after startup)
      );

      // 🔥 PRIORITY 4 FIX: TWEET RECONCILIATION JOB - every 24 hours, offset 120 min
      // Finds tweets posted to Twitter but missing from database
      // Auto-recovers matched tweets and processes retry queue
      this.scheduleStaggeredJob(
        'tweet_reconciliation',
        async () => {
          await this.safeExecute('tweet_reconciliation', async () => {
            const { reconcileMissingTweets } = await import('./tweetReconciliationJob');
            await reconcileMissingTweets();
          });
        },
        1440 * MINUTE, // Every 24 hours (daily reconciliation)
        120 * MINUTE // Start after 120 minutes (2 hours - after system is stable)
      );
      
      // 🔄 POSTING ATTEMPT RECONCILIATION: Clean up stuck posting_attempt rows (>5 min old)
      // Runs every 10 minutes to ensure no rows stay stuck
      this.scheduleStaggeredJob(
        'posting_attempt_reconciliation',
        async () => {
          await this.safeExecute('posting_attempt_reconciliation', async () => {
            // Runtime-only import (TypeScript cannot statically resolve this)
            const scriptPath = '../../scripts/reconcile-posting-attempts';
            const { reconcilePostingAttempts } = await import(scriptPath);
            await reconcilePostingAttempts();
          });
        },
        10 * MINUTE, // Every 10 minutes
        2 * MINUTE // Start after 2 minutes
      );

      // 💬 REPLY POSTING JOB - every 30 min (configurable via JOBS_REPLY_INTERVAL_MIN)
      // 🎯 CRITICAL: Generate and queue replies
      // ⏰ TIMING: Starts immediately, has own internal rate limiting
      this.scheduleStaggeredJob(
        'reply_posting',
        async () => {
          await this.safeExecute('reply_posting', async () => {
            // Use enhanced reply job with Phase 2 & 3 features
            const { generateRepliesEnhanced } = await import('./replyJobEnhanced');
            await generateRepliesEnhanced();
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

      // 🏥 REPLY HEALTH MONITOR - every 30 min, offset 20 min (pool & SLO watchdog)
      // Logs system_events warnings before the reply system starves
      this.scheduleStaggeredJob(
        'reply_health_monitor',
        async () => {
          await this.safeExecute('reply_health_monitor', async () => {
            const { runReplyHealthMonitor } = await import('./replyHealthMonitor');
            await runReplyHealthMonitor();
          });
        },
        30 * MINUTE, // Every 30 minutes to catch pool depletion quickly
        20 * MINUTE // Start after 20 minutes (after first harvest + reply cycles)
      );
    } else {
      console.warn('═══════════════════════════════════════════════════════');
      console.warn('[JOB_MANAGER] Reply jobs DISABLED');
      console.warn('   ENABLE_REPLIES: ' + (envEnableReplies || 'NOT SET (defaults to true)'));
      console.warn('   flags.replyEnabled: ' + flags.replyEnabled);
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

      // Note: tweet_reconciliation is scheduled above in reply jobs section (line 486-499)

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

    // Reply outcome aggregation (account/source learning) - every 2 hours, offset 90 min
    this.scheduleStaggeredJob(
      'reply_outcome_aggregation',
      async () => {
        await this.safeExecute('reply_outcome_aggregation', async () => {
          const { aggregateReplyOutcomes } = await import('./replySystemV2/outcomeAggregation');
          const result = await aggregateReplyOutcomes();
          if (result.accounts_updated > 0 || result.sources_updated > 0) {
            console.log(`[JOB_MANAGER] reply_outcome_aggregation: accounts=${result.accounts_updated} sources=${result.sources_updated}`);
          }
        });
      },
      2 * 60 * MINUTE,
      90 * MINUTE
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

    // 🏥 SYSTEM HEALTH MONITOR - every 30 minutes, offset 15 min (comprehensive health tracking)
    // 🔧 NEW: Enhanced health monitoring with error tracking and recommendations
    this.scheduleStaggeredJob(
      'system_health_monitor',
      async () => {
        await this.safeExecute('system_health_monitor', async () => {
          const { runSystemHealthMonitor } = await import('./systemHealthMonitorJob');
          await runSystemHealthMonitor();
        });
      },
      30 * MINUTE, // Every 30 minutes
      15 * MINUTE  // Start after 15 minutes
    );

    // 🤖 AUTONOMOUS HEALTH MONITOR - every 15 minutes, offset 5 min (self-healing system)
    // 🔧 NEW: Autonomous diagnosis and self-healing
    this.scheduleStaggeredJob(
      'autonomous_health_monitor',
      async () => {
        await this.safeExecute('autonomous_health_monitor', async () => {
          const { runAutonomousHealthCheck } = await import('./autonomousHealthMonitor');
          await runAutonomousHealthCheck();
        });
      },
      15 * MINUTE, // Every 15 minutes
      5 * MINUTE   // Start after 5 minutes
    );

    // 📊 ERROR ANALYSIS - every 6 hours, offset 120 min (analyze error patterns)
    // 🔧 NEW: Comprehensive error tracking and analysis
    this.scheduleStaggeredJob(
      'error_analysis',
      async () => {
        await this.safeExecute('error_analysis', async () => {
          const { runErrorAnalysis } = await import('./errorAnalysisJob');
          await runErrorAnalysis();
        });
      },
      360 * MINUTE, // Every 6 hours
      120 * MINUTE  // Start after 2 hours
    );

    // 🤖 AUTONOMOUS OPTIMIZER - every 4 hours, offset 180 min (self-optimizing system)
    // 🔧 NEW: Autonomous optimization based on performance data
    this.scheduleStaggeredJob(
      'autonomous_optimizer',
      async () => {
        await this.safeExecute('autonomous_optimizer', async () => {
          const { runAutonomousOptimization } = await import('./autonomousOptimizerJob');
          await runAutonomousOptimization();
        });
      },
      240 * MINUTE, // Every 4 hours
      180 * MINUTE  // Start after 3 hours
    );

    // 🔧 SELF-HEALING - every 15 minutes, offset 5 min (auto-recovery system)
    // 🔧 NEW: Automatically detects and recovers from common failures
    this.scheduleStaggeredJob(
      'self_healing',
      async () => {
        await this.safeExecute('self_healing', async () => {
          const { runSelfHealing } = await import('./selfHealingJob');
          await runSelfHealing();
        });
      },
      15 * MINUTE, // Every 15 minutes
      5 * MINUTE   // Start after 5 minutes
    );

    // ⚡ PERFORMANCE OPTIMIZER - every 2 hours, offset 60 min (performance monitoring)
    // 🔧 NEW: Monitors system performance and suggests optimizations
    this.scheduleStaggeredJob(
      'performance_optimizer',
      async () => {
        await this.safeExecute('performance_optimizer', async () => {
          const { runPerformanceOptimization } = await import('./performanceOptimizerJob');
          await runPerformanceOptimization();
        });
      },
      120 * MINUTE, // Every 2 hours
      60 * MINUTE   // Start after 1 hour
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
    // 🔒 TWEET ID RECOVERY: Recover missing tweet IDs (runs alongside existing id_recovery)
    this.scheduleStaggeredJob(
      'tweet_id_recovery',
      async () => {
        await this.safeExecute('tweet_id_recovery', async () => {
          const { runTweetIdRecovery } = await import('./tweetIdRecoveryJob');
          await runTweetIdRecovery();
        });
      },
      30 * MINUTE, // Every 30 minutes
      5 * MINUTE   // Start after 5 minutes
    );
    
    // 🔒 ID HEALTH MONITOR: Check ID health every hour
    this.scheduleStaggeredJob(
      'id_health_monitor',
      async () => {
        await this.safeExecute('id_health_monitor', async () => {
          const { checkIDHealth } = await import('../monitoring/idHealthMonitor');
          await checkIDHealth();
        });
      },
      60 * MINUTE, // Every hour
      10 * MINUTE  // Start after 10 minutes
    );
    
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
    
    // 🔥 NEW: ID Recovery Queue - Process file backups every 5 minutes
    // Ensures rapid recovery of tweet IDs from file backups
    this.scheduleStaggeredJob(
      'id_recovery_queue',
      async () => {
        await this.safeExecute('id_recovery_queue', async () => {
          const { idRecoveryQueueJob } = await import('./idRecoveryQueue');
          await idRecoveryQueueJob();
        });
      },
      5 * MINUTE, // Every 5 minutes (rapid recovery)
      2 * MINUTE  // Start after 2 minutes
    );
    
    // 🔥 NEW: ID Verification - Check for missing IDs every 10 minutes
    // Recovers IDs using content matching and alerts if recovery fails
    this.scheduleStaggeredJob(
      'id_verification',
      async () => {
        await this.safeExecute('id_verification', async () => {
          const { idVerificationJob } = await import('./idVerificationJob');
          await idVerificationJob();
        });
      },
      10 * MINUTE, // Every 10 minutes
      3 * MINUTE   // Start after 3 minutes
    );

    // 🔥 TRUTH GAP FIX: Reconciliation job - every 5 minutes (feature flagged)
    if (process.env.ENABLE_TRUTH_RECONCILE === 'true') {
      this.scheduleStaggeredJob(
        'truth_reconcile',
        async () => {
          await this.safeExecute('truth_reconcile', async () => {
            const { reconcileAllDecisions } = await import('./reconcileDecisionJob');
            await reconcileAllDecisions();
          });
        },
        5 * MINUTE, // Every 5 minutes
        2 * MINUTE // Offset 2 min
      );
      console.log('[JOB_MANAGER] Truth reconciliation job enabled (ENABLE_TRUTH_RECONCILE=true)');
    } else {
      console.log('[JOB_MANAGER] Truth reconciliation job disabled (set ENABLE_TRUTH_RECONCILE=true to enable)');
    }

    // 🔒 TRUTH INTEGRITY VERIFICATION JOB - every 15 minutes (optional)
    // Audits truth invariants and reports violations
    if (process.env.ENABLE_TRUTH_INTEGRITY_CHECK === 'true') {
      this.scheduleStaggeredJob(
        'truth_integrity',
        async () => {
          await this.safeExecute('truth_integrity', async () => {
            const { runTruthIntegrityCheck } = await import('./truthIntegrityJob');
            await runTruthIntegrityCheck();
          });
        },
        15 * MINUTE, // Every 15 minutes
        10 * MINUTE  // Start after 10 minutes (offset)
      );
      console.log('[JOB_MANAGER] Truth integrity verification enabled (ENABLE_TRUTH_INTEGRITY_CHECK=true)');
    } else {
      console.log('[JOB_MANAGER] Truth integrity verification disabled (set ENABLE_TRUTH_INTEGRITY_CHECK=true to enable)');
    }
    
    // Watchdog - every 5 minutes to enforce SLAs
    this.scheduleStaggeredJob(
      'job_watchdog',
      async () => {
        await this.safeExecute('job_watchdog', async () => {
          // Opportunistically prewarm the browser first in case launches are failing
          // Skip in shadow mode — brain has its own browser, UnifiedBrowserPool not needed
          if (process.env.SHADOW_MODE === 'true' || process.env.MODE === 'shadow') {
            // no-op
          } else try {
            const { prewarmBrowserJob } = await import('./prewarmBrowserJob');
            await prewarmBrowserJob();
          } catch (prewarmError: any) {
            console.warn('[JOB_MANAGER] Prewarm failed:', prewarmError.message);
          }
          const { runJobWatchdog } = await import('./jobWatchdog');
          await runJobWatchdog(async (jobTarget) => {
            await this.runJobNow(jobTarget);
          });
        });
      },
      5 * MINUTE,
      2 * MINUTE
    );

    // 🧵 THREAD CANARY: Ensures threads are posted periodically for reliability verification
    this.scheduleStaggeredJob(
      'thread_canary',
      async () => {
        if (process.env.SHADOW_MODE === 'true' || process.env.MODE === 'shadow') { return; }
        await this.safeExecute('thread_canary', async () => {
          const { runThreadCanary } = await import('./threadCanaryJob');
          await runThreadCanary();
        });
      },
      60 * MINUTE, // Every 60 minutes
      10 * MINUTE  // Start after 10 minutes
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

    // Shadow Controller (Growth Controller plan generation) - every hour
    // Run at start of hour (0 minutes) to ensure plan is available for the full hour
    this.scheduleStaggeredJob(
      'shadow_controller',
      async () => {
        await this.safeExecute('shadow_controller', async () => {
          const { generateShadowPlan } = await import('./shadowControllerJob');
          await generateShadowPlan();
        });
      },
      60 * MINUTE, // Every 60 minutes
      0 * MINUTE   // Start immediately (at hour boundary) - ensures plan ready for current hour
    );

    // =========================================================================
    // BRAIN SYSTEM v2 — Self-growing Twitter intelligence
    // Gated by BRAIN_FEEDS_ENABLED env var (default: false)
    // =========================================================================
    if (process.env.BRAIN_FEEDS_ENABLED === 'true') {
      console.log('[JOB_MANAGER] 🧠 Brain feeds ENABLED — registering brain jobs');

      // Brain: Trending scraper — Explore page, no filters (every 10 min)
      this.scheduleStaggeredJob(
        'brain_trending',
        async () => {
          await this.safeExecute('brain_trending', async () => {
            const { runTrendingScraper } = await import('../brain/feeds/trendingScraper');
            await runTrendingScraper();
          });
        },
        10 * MINUTE,
        30 * 1000 // 30s delay
      );

      // Brain: Keyword searcher — self-expanding pool (every 10 min)
      this.scheduleStaggeredJob(
        'brain_keywords',
        async () => {
          await this.safeExecute('brain_keywords', async () => {
            const { runBroadKeywordSearcher } = await import('../brain/feeds/broadKeywordSearcher');
            await runBroadKeywordSearcher();
          });
        },
        10 * MINUTE,
        1 * MINUTE // 60s delay
      );

      // Brain: Account timeline scraper — staleness-ordered (every 10 min)
      this.scheduleStaggeredJob(
        'brain_timelines',
        async () => {
          await this.safeExecute('brain_timelines', async () => {
            const { runAccountTimelineScraper } = await import('../brain/feeds/accountTimelineScraper');
            await runAccountTimelineScraper();
          });
        },
        10 * MINUTE,
        2 * MINUTE // 120s delay
      );

      // Brain: For You scraper — algorithm feed (every 15 min)
      this.scheduleStaggeredJob(
        'brain_foryou',
        async () => {
          await this.safeExecute('brain_foryou', async () => {
            const { runForYouScraper } = await import('../brain/feeds/forYouScraper');
            await runForYouScraper();
          });
        },
        15 * MINUTE,
        3 * MINUTE // 180s delay
      );

      // Brain: Viral hunter — specifically hunts mega-viral tweets across all domains (every 20 min)
      this.scheduleStaggeredJob(
        'brain_viral_hunter',
        async () => {
          await this.safeExecute('brain_viral_hunter', async () => {
            const { runViralHunter } = await import('../brain/feeds/viralHunter');
            await runViralHunter();
          });
        },
        20 * MINUTE,
        4 * MINUTE // 240s delay — staggers after foryou
      );

      // Brain: Account discovery — auto-expand pool (every 30 min)
      this.scheduleStaggeredJob(
        'brain_discover_accounts',
        async () => {
          await this.safeExecute('brain_discover_accounts', async () => {
            const { runAccountDiscovery } = await import('../brain/accountDiscoveryEngine');
            await runAccountDiscovery();
          });
        },
        30 * MINUTE,
        4 * MINUTE // 240s delay
      );

      // Brain: Account tiering — percentile re-tier (every 24h)
      this.scheduleStaggeredJob(
        'brain_tier_accounts',
        async () => {
          await this.safeExecute('brain_tier_accounts', async () => {
            const { runAccountTiering } = await import('../brain/accountTiering');
            await runAccountTiering();
          });
        },
        24 * 60 * MINUTE,
        5 * MINUTE // 5min delay
      );

      // Brain: Keyword pool management — expand/prune/reprioritize (every 1h)
      this.scheduleStaggeredJob(
        'brain_keyword_pool',
        async () => {
          await this.safeExecute('brain_keyword_pool', async () => {
            const { runKeywordPoolManagement } = await import('../brain/keywordPool');
            await runKeywordPoolManagement();
          });
        },
        60 * MINUTE,
        6 * MINUTE // 360s delay
      );

      // Brain: Stage 2 AI classification — batch classify above-threshold tweets (every 15 min)
      this.scheduleStaggeredJob(
        'brain_classify_stage2',
        async () => {
          await this.safeExecute('brain_classify_stage2', async () => {
            const { brainClassifyStage2Job } = await import('../brain/classificationJobs');
            await brainClassifyStage2Job();
          });
        },
        15 * MINUTE,
        7 * MINUTE // 420s delay
      );

      // Brain: Stage 3 re-scrape — track engagement trajectory (every 30 min)
      this.scheduleStaggeredJob(
        'brain_rescrape_stage3',
        async () => {
          await this.safeExecute('brain_rescrape_stage3', async () => {
            const { brainRescrapeStage3Job } = await import('../brain/classificationJobs');
            await brainRescrapeStage3Job();
          });
        },
        30 * MINUTE,
        8 * MINUTE // 480s delay
      );

      // Brain: Stage 4 deep analysis — reply trees + amplifiers for viral tweets (every 60 min)
      this.scheduleStaggeredJob(
        'brain_deep_stage4',
        async () => {
          await this.safeExecute('brain_deep_stage4', async () => {
            const { brainDeepStage4Job } = await import('../brain/classificationJobs');
            await brainDeepStage4Job();
          });
        },
        60 * MINUTE,
        9 * MINUTE // 540s delay
      );

      // Brain: Self-model update — tracks our account state, phase, expectations (every 30 min)
      this.scheduleStaggeredJob(
        'brain_self_model',
        async () => {
          await this.safeExecute('brain_self_model', async () => {
            const { runSelfModelUpdate } = await import('../brain/selfModel');
            await runSelfModelUpdate();
          });
        },
        30 * MINUTE,
        10 * MINUTE // 600s delay
      );

      // Brain: Feedback loop — records expected vs actual, diagnoses failures (every 15 min)
      this.scheduleStaggeredJob(
        'brain_feedback',
        async () => {
          await this.safeExecute('brain_feedback', async () => {
            const { runFeedbackLoop } = await import('../brain/feedbackLoop');
            await runFeedbackLoop();
          });
        },
        15 * MINUTE,
        11 * MINUTE // 660s delay
      );

      // Brain: Stagnation detector — detects when strategy is failing and triggers pivots (every 6h)
      this.scheduleStaggeredJob(
        'brain_stagnation',
        async () => {
          await this.safeExecute('brain_stagnation', async () => {
            const { runStagnationDetector } = await import('../brain/stagnationDetector');
            await runStagnationDetector();
          });
        },
        360 * MINUTE, // Every 6 hours
        15 * MINUTE   // 15min delay
      );

      // Brain: Analytics engine — pattern scoring, outperformance, trend detection (every 2h)
      this.scheduleStaggeredJob(
        'brain_analytics',
        async () => {
          await this.safeExecute('brain_analytics', async () => {
            const { runBrainAnalytics } = await import('../brain/analyticsEngine');
            await runBrainAnalytics();
          });
        },
        120 * MINUTE,
        12 * MINUTE // 720s delay
      );
    } else {
      console.log('[JOB_MANAGER] 🧠 Brain feeds DISABLED (set BRAIN_FEEDS_ENABLED=true to enable)');
    }

    // =========================================================================
    // GROWTH OBSERVATORY — Account tracking intelligence system
    // Gated by GROWTH_OBSERVATORY_ENABLED env var (default: false)
    // =========================================================================
    if (process.env.GROWTH_OBSERVATORY_ENABLED === 'true') {
      console.log('[JOB_MANAGER] 🔭 Growth Observatory ENABLED — registering observatory jobs');

      // Observatory: Census scheduler — picks accounts due for follower check (every 5 min)
      this.scheduleStaggeredJob(
        'observatory_census_scheduler',
        async () => {
          await this.safeExecute('observatory_census_scheduler', async () => {
            const { runCensusScheduler } = await import('../brain/observatory/censusScheduler');
            await runCensusScheduler();
          });
        },
        5 * MINUTE,
        1 * MINUTE
      );

      // Observatory: Census worker — visits profiles, grabs follower counts (every 2 min)
      this.scheduleStaggeredJob(
        'observatory_census_worker',
        async () => {
          await this.safeExecute('observatory_census_worker', async () => {
            const { runCensusWorker } = await import('../brain/observatory/censusWorker');
            await runCensusWorker();
          });
        },
        2 * MINUTE,
        2 * MINUTE
      );
      // Observatory: Growth detector — compares snapshots, detects acceleration (every 30 min)
      this.scheduleStaggeredJob(
        'observatory_growth_detector',
        async () => {
          await this.safeExecute('observatory_growth_detector', async () => {
            const { runGrowthDetector } = await import('../brain/observatory/growthDetector');
            await runGrowthDetector();
          });
        },
        30 * MINUTE,
        5 * MINUTE
      );

      // Observatory: Content archiver — scrapes timelines of growing accounts (every 15 min)
      this.scheduleStaggeredJob(
        'observatory_content_archiver',
        async () => {
          await this.safeExecute('observatory_content_archiver', async () => {
            const { runContentArchiver } = await import('../brain/observatory/contentArchiver');
            await runContentArchiver();
          });
        },
        15 * MINUTE,
        8 * MINUTE
      );
      // Observatory: Account profiler — classifies type, niche, voice (every 60 min)
      this.scheduleStaggeredJob(
        'observatory_account_profiler',
        async () => {
          await this.safeExecute('observatory_account_profiler', async () => {
            const { runAccountProfiler } = await import('../brain/observatory/accountProfiler');
            await runAccountProfiler();
          });
        },
        60 * MINUTE,
        12 * MINUTE
      );

      // Observatory: Retrospective analyzer — what did growing accounts change? (every 120 min)
      this.scheduleStaggeredJob(
        'observatory_retrospective',
        async () => {
          await this.safeExecute('observatory_retrospective', async () => {
            const { runRetrospectiveAnalyzer } = await import('../brain/observatory/retrospectiveAnalyzer');
            await runRetrospectiveAnalyzer();
          });
        },
        120 * MINUTE,
        15 * MINUTE
      );

      // Observatory: Engagement baseline — per-author outperformance via viral_multiplier (every 120 min)
      // Scheduling the previously-orphaned runEngagementBaseline. Populates brain_accounts.avg_likes_30d
      // and brain_tweets.viral_multiplier — the 80/20 win for "was this tweet unusual for this author?"
      this.scheduleStaggeredJob(
        'observatory_engagement_baseline',
        async () => {
          await this.safeExecute('observatory_engagement_baseline', async () => {
            const { runEngagementBaseline } = await import('../brain/observatory/engagementBaseline');
            await runEngagementBaseline();
          });
        },
        120 * MINUTE,
        20 * MINUTE
      );

      // Observatory: Tweet-to-follower attribution — Phase B Gap 1 (every 60 min)
      // For every brain_tweets row from a growing account, link it to the follower
      // delta in the window between baseline and next snapshot. Enables the SQL-level
      // answer to "which specific tweet drove the follower spike for this account"
      this.scheduleStaggeredJob(
        'observatory_tweet_attribution',
        async () => {
          await this.safeExecute('observatory_tweet_attribution', async () => {
            const { runTweetAttribution } = await import('../brain/observatory/tweetAttributionJob');
            await runTweetAttribution();
          });
        },
        60 * MINUTE,
        18 * MINUTE
      );

      // Observatory: Baseline builder — stratified engagement baselines (every 6h)
      // Computes median + p25/p75 of views/likes by (tier, domain, posted_hour_utc)
      // over rolling 30-day window. Feeds the outcome scorer.
      this.scheduleStaggeredJob(
        'observatory_baseline_builder',
        async () => {
          await this.safeExecute('observatory_baseline_builder', async () => {
            const { runBaselineBuilder } = await import('../brain/observatory/baselineBuilder');
            await runBaselineBuilder();
          });
        },
        360 * MINUTE,
        30 * MINUTE
      );

      // Observatory: Outcome scorer — per-tweet expected-vs-actual (every 30 min)
      // Classifies every new brain_tweets row as breakout/above/expected/below/failure
      // vs its stratified baseline. Falls back to per-author viral_multiplier when
      // no stratified bucket matches. SOLE writer of brain_tweet_outcomes.
      this.scheduleStaggeredJob(
        'observatory_outcome_scorer',
        async () => {
          await this.safeExecute('observatory_outcome_scorer', async () => {
            const { runOutcomeScorer } = await import('../brain/observatory/outcomeScorer');
            await runOutcomeScorer();
          });
        },
        30 * MINUTE,
        25 * MINUTE
      );

      // Observatory: Dead-man's-switch monitor — Phase C (every 10 min)
      // Checks that brain_tweets, brain_account_snapshots, and brain_daily_context
      // are receiving fresh writes. Raises critical alarms in system_events if any
      // write stream stalls. This is how we would have caught the silent census
      // failure months earlier — the entire point of this job is to prevent
      // "Completed successfully with zero writes" from going undetected.
      this.scheduleStaggeredJob(
        'observatory_deadman_monitor',
        async () => {
          await this.safeExecute('observatory_deadman_monitor', async () => {
            const { runDeadmanMonitor } = await import('../brain/observatory/deadmanMonitor');
            await runDeadmanMonitor();
          });
        },
        10 * MINUTE,
        8 * MINUTE
      );

      // Observatory: Strategy library builder — aggregates retrospectives into playbooks (every 6h)
      this.scheduleStaggeredJob(
        'observatory_strategy_builder',
        async () => {
          await this.safeExecute('observatory_strategy_builder', async () => {
            const { runStrategyLibraryBuilder } = await import('../brain/observatory/strategyLibraryBuilder');
            await runStrategyLibraryBuilder();
          });
        },
        360 * MINUTE,
        20 * MINUTE
      );

      // Observatory: Strategy memory — evaluate completed tests, resurface shelved (every 6h)
      this.scheduleStaggeredJob(
        'observatory_strategy_memory',
        async () => {
          await this.safeExecute('observatory_strategy_memory', async () => {
            const { evaluateCompletedTests, resurfaceShelvedStrategies } = await import('../brain/observatory/strategyMemory');
            await evaluateCompletedTests();
            await resurfaceShelvedStrategies();
          });
        },
        360 * MINUTE,
        25 * MINUTE
      );

      // Observatory: Evidence generator — assembles JSONL packages (every 6h)
      this.scheduleStaggeredJob(
        'observatory_evidence_generator',
        async () => {
          await this.safeExecute('observatory_evidence_generator', async () => {
            const { runEvidenceGenerator } = await import('../brain/observatory/evidenceGenerator');
            await runEvidenceGenerator();
          });
        },
        360 * MINUTE,
        30 * MINUTE
      );

      // Observatory: Daily context capture — trending topics (every 60 min)
      this.scheduleStaggeredJob(
        'observatory_daily_context',
        async () => {
          await this.safeExecute('observatory_daily_context', async () => {
            const { runDailyContextCapture } = await import('../brain/observatory/dailyContextCapture');
            await runDailyContextCapture();
          });
        },
        60 * MINUTE,
        3 * MINUTE
      );
      // Observatory: Search seeder — discover accounts via Twitter search (every 15 min)
      this.scheduleStaggeredJob(
        'observatory_search_seeder',
        async () => {
          await this.safeExecute('observatory_search_seeder', async () => {
            const { runSearchSeeder } = await import('../brain/observatory/searchSeeder');
            await runSearchSeeder();
          });
        },
        15 * MINUTE,
        5 * MINUTE
      );

      // Observatory: Profile hop seeder — discover accounts from following/followers lists (every 10 min)
      this.scheduleStaggeredJob(
        'observatory_profile_hop_seeder',
        async () => {
          await this.safeExecute('observatory_profile_hop_seeder', async () => {
            const { runProfileHopSeeder } = await import('../brain/observatory/profileHopSeeder');
            await runProfileHopSeeder();
          });
        },
        10 * MINUTE,
        7 * MINUTE
      );

      // Observatory: Niche diversity tracker — coverage matrix + auto-campaigns (every 60 min)
      this.scheduleStaggeredJob(
        'observatory_niche_diversity',
        async () => {
          await this.safeExecute('observatory_niche_diversity', async () => {
            const { runNicheDiversityTracker } = await import('../brain/observatory/nicheDiversityTracker');
            await runNicheDiversityTracker();
          });
        },
        60 * MINUTE,
        35 * MINUTE
      );

      // Observatory: Follower range backfill — one-time (runs once then no-ops)
      this.scheduleStaggeredJob(
        'observatory_range_backfill',
        async () => {
          await this.safeExecute('observatory_range_backfill', async () => {
            const { runFollowerRangeBackfill } = await import('../brain/observatory/followerRangeBackfill');
            await runFollowerRangeBackfill();
          });
        },
        24 * 60 * MINUTE, // Run daily (backfill catches any new accounts without range)
        2 * MINUTE         // Run soon after boot to backfill existing data
      );

      // Observatory: Range strategy builder — playbooks by follower range (every 6h)
      this.scheduleStaggeredJob(
        'observatory_range_strategy_builder',
        async () => {
          await this.safeExecute('observatory_range_strategy_builder', async () => {
            const { runRangeStrategyBuilder } = await import('../brain/observatory/rangeStrategyBuilder');
            await runRangeStrategyBuilder();
          });
        },
        360 * MINUTE,
        22 * MINUTE
      );

      // Observatory: Growth path analyzer — cross-range transitions (every 12h)
      this.scheduleStaggeredJob(
        'observatory_growth_path_analyzer',
        async () => {
          await this.safeExecute('observatory_growth_path_analyzer', async () => {
            const { runGrowthPathAnalyzer } = await import('../brain/observatory/growthPathAnalyzer');
            await runGrowthPathAnalyzer();
          });
        },
        720 * MINUTE,
        40 * MINUTE
      );

      // Observatory: Reply context enricher — backfill reply delay + target followers (every 15 min)
      this.scheduleStaggeredJob(
        'observatory_reply_enricher',
        async () => {
          await this.safeExecute('observatory_reply_enricher', async () => {
            const { runReplyContextEnricher } = await import('../brain/observatory/replyContextEnricher');
            await runReplyContextEnricher();
          });
        },
        15 * MINUTE,
        8 * MINUTE
      );

      // Observatory: Behavioral analyzer — reply timing, targeting, mix intelligence (every 2h)
      this.scheduleStaggeredJob(
        'observatory_behavioral_analyzer',
        async () => {
          await this.safeExecute('observatory_behavioral_analyzer', async () => {
            const { runBehavioralAnalyzer } = await import('../brain/observatory/behavioralAnalyzer');
            await runBehavioralAnalyzer();
          });
        },
        120 * MINUTE,
        45 * MINUTE
      );

      // Observatory: Behavioral hypothesis engine — generate + validate hypotheses (every 2h, after analyzer)
      this.scheduleStaggeredJob(
        'observatory_behavioral_hypotheses',
        async () => {
          await this.safeExecute('observatory_behavioral_hypotheses', async () => {
            const { runBehavioralHypothesisEngine } = await import('../brain/observatory/behavioralHypothesisEngine');
            await runBehavioralHypothesisEngine();
          });
        },
        120 * MINUTE,
        50 * MINUTE // 5 min after behavioral analyzer
      );
    } else {
      console.log('[JOB_MANAGER] 🔭 Growth Observatory DISABLED (set GROWTH_OBSERVATORY_ENABLED=true to enable)');
    }

    // Status reporting - every hour
    this.timers.set('status', setInterval(() => {
      this.printHourlyStatus();
    }, 60 * MINUTE));

    console.log('[JOB_MANAGER] All jobs scheduled with staggered timing');
    console.log('[JOB_MANAGER] Jobs spread across 60 minutes to prevent resource collisions');
    console.log('[JOB_MANAGER] Posting runs every 5 min with NO delay (highest priority)');
    console.log('   ⏰ Other jobs staggered: 2m, 7m, 12m, 15m, 22m, 32m, 35m, 42m, 45m, 52m...');
  }

  /**
   * Start all job timers based on configuration
   * FAIL-FAST: If MODE=live and posting job doesn't register, exit with error
   */
  public async startJobs(): Promise<void> {
    // 🔍 BOOT SHA LOGGING: Print runtime SHA for deploy verification
    const shaSources = [
      process.env.APP_COMMIT_SHA,
      process.env.DEPLOY_SHA,
      process.env.GIT_SHA,
      process.env.RAILWAY_GIT_COMMIT_SHA,
      process.env.VERCEL_GIT_COMMIT_SHA,
    ].filter(Boolean);
    const runtimeSha = shaSources[0] || 'unknown';
    const shaDisplay = runtimeSha.length >= 8 ? runtimeSha.substring(0, 8) : runtimeSha;
    console.log('[JOB_MANAGER_BOOT] Starting job manager (SHA: ' + shaDisplay + ')');
    
    console.log('🕒 JOB_MANAGER: startJobs() called');
    console.log('[JOB_MANAGER] process.env.JOBS_AUTOSTART = "' + (process.env.JOBS_AUTOSTART || '') + '"');
    console.log('[JOB_MANAGER] process.env.JOBS_AUTOSTART === \'true\' = ' + (process.env.JOBS_AUTOSTART === 'true'));
    
    if (this.isRunning) {
      console.log('[JOB_MANAGER] Jobs already running');
      return;
    }

    // Validate environment variables before starting jobs
    const { validateEnvironmentVariables } = await import('../config/envValidation');
    validateEnvironmentVariables();

    const config = getConfig();
    const modeFlags = getModeFlags(config);
    
    console.log('[JOB_MANAGER] config.JOBS_AUTOSTART = ' + config.JOBS_AUTOSTART);
    console.log('[JOB_MANAGER] modeFlags.enableJobScheduling = ' + modeFlags.enableJobScheduling);

    if (!modeFlags.enableJobScheduling) {
      console.log('🕒 JOB_MANAGER: Job scheduling disabled (JOBS_AUTOSTART=false)');
      console.log('🕒 JOB_MANAGER: This means jobs will NOT run. Check Railway Variables: JOBS_AUTOSTART must be exactly "true"');
      return;
    }
    
    console.log('🕒 JOB_MANAGER: Job scheduling ENABLED - proceeding to start jobs...');

    // Start production watchdog (same codepath as job scheduling)
    try {
      const { getWatchdog } = await import('./productionWatchdog');
      const watchdog = getWatchdog();
      await watchdog.start();
      console.log('🕒 JOB_MANAGER: Production watchdog started');
    } catch (watchdogError: any) {
      console.warn('🕒 JOB_MANAGER: Watchdog start failed:', watchdogError.message);
    }

    // 🎯 FEATURE FLAG: Choose scheduling strategy
    const USE_STAGGERED = process.env.USE_STAGGERED_SCHEDULING !== 'false'; // Default ON
    
    console.log('🕒 JOB_MANAGER: Starting job timers...');
    console.log('   Mode: ' + flags.mode + ' (live=' + flags.live + ')');
    console.log('   Scheduling: ' + (USE_STAGGERED ? 'STAGGERED (optimized)' : 'LEGACY (simultaneous)'));
    console.log('   Plan: ' + (flags.plannerEnabled ? 'ENABLED' : 'DISABLED'));
    console.log('   Reply: ' + (flags.replyEnabled ? 'ENABLED' : 'DISABLED'));
    console.log('   Posting: ' + (flags.postingEnabled ? 'ENABLED' : 'DISABLED'));
    console.log('   Learn: ' + (flags.learnEnabled ? 'ENABLED' : 'DISABLED'));
    console.log('   Attribution: ENABLED (every 2h)');
    
    // 🔒 METRICS JOB HARDENING: Log DISABLE_METRICS_JOB status
    const disableMetricsJob = process.env.DISABLE_METRICS_JOB === 'true';
    const metricsJobScheduled = !disableMetricsJob;
    console.log('   Metrics Scraper: ' + (metricsJobScheduled ? 'ENABLED' : 'DISABLED') + ' (DISABLE_METRICS_JOB=' + (process.env.DISABLE_METRICS_JOB || 'false') + ')');
    if (disableMetricsJob) {
      console.warn('   WARNING: Metrics scraper is DISABLED - metrics will not be collected!');
    }
    
    if (USE_STAGGERED) {
      await this.startStaggeredJobs(config, modeFlags);
      return;
    }
    
    // LEGACY SCHEDULING (fallback)
    console.log('[JOB_MANAGER] Using legacy simultaneous scheduling');
    
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
          console.log('[JOB_MANAGER] Real-time learning cycle completed');
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
          console.log('[JOB_MANAGER] Daily viral thread generated');
        });
      }, viralThreadIntervalMin * 60 * 1000));
      registered.viral_thread = true;
      console.log('   Viral thread: ENABLED (every ' + (viralThreadIntervalMin / 60) + ' hours)');
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
        console.log('[JOB_MANAGER] Analytics collection completed');
      });
    }, 30 * 60 * 1000)); // 30 minutes
    registered.analytics = true;
    
    // VELOCITY TRACKER JOB - every 30 minutes to track follower attribution & velocity
    this.timers.set('velocity_tracker', setInterval(async () => {
      await this.safeExecute('velocity_tracker', async () => {
        const { runVelocityTracking } = await import('./velocityTrackerJob');
        await runVelocityTracking();
        console.log('[JOB_MANAGER] Velocity tracking completed');
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
        console.log('[JOB_MANAGER] Real outcomes collection completed');
      });
    }, 2 * 60 * 60 * 1000)); // 2 hours
    registered.outcomes_real = true;
    
    // DATA COLLECTION ENGINE - every hour for comprehensive tracking
    this.timers.set('data_collection', setInterval(async () => {
      await this.safeExecute('data_collection', async () => {
        const { DataCollectionEngine } = await import('../intelligence/dataCollectionEngine');
        const engine = DataCollectionEngine.getInstance();
        await engine.collectComprehensiveData();
        console.log('[JOB_MANAGER] Data collection engine completed');
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
    console.log('  MODE: ' + flags.mode);
    console.log('  Timers registered:');
    console.log('    - plan:            ' + (registered.plan ? 'YES' : 'NO') + ' (every ' + config.JOBS_PLAN_INTERVAL_MIN + 'min)');
    console.log('    - reply:           ' + (registered.reply ? 'YES' : 'NO') + ' (every ' + config.JOBS_REPLY_INTERVAL_MIN + 'min)');
    console.log('    - posting:         ' + (registered.posting ? 'YES' : 'NO') + ' (every ' + config.JOBS_POSTING_INTERVAL_MIN + 'min)');
    console.log('    - learn:           ' + (registered.learn ? 'YES' : 'NO') + ' (every ' + config.JOBS_LEARN_INTERVAL_MIN + 'min)');
    console.log('    - attribution:     ' + (registered.attribution ? 'YES' : 'NO') + ' (every 2h)');
    console.log('    - analytics:       ' + (registered.analytics ? 'YES' : 'NO') + ' (every 30min)');
    console.log('    - outcomes_real:   ' + (registered.outcomes_real ? 'YES' : 'NO') + ' (every 2h)');
    console.log('    - data_collection: ' + (registered.data_collection ? 'YES' : 'NO') + ' (every 1h)');
    console.log('    - ai_orchestration:' + (registered.ai_orchestration ? 'YES' : 'NO') + ' (every 6h)');
    console.log('    - news_scraping:   ' + (registered.news_scraping ? 'YES' : 'NO') + ' (every 1h)');
    console.log('    - competitive:     ' + (registered.competitive_analysis ? 'YES' : 'NO') + ' (every 24h)');
    console.log('    - metrics_scraper: ' + (registered.metrics_scraper ? 'YES' : 'NO') + ' (every 10min)');
    console.log('    - enhanced_metrics:' + (registered.enhanced_metrics ? 'YES' : 'NO') + ' (every 30min)');
    console.log('════════════════════════════════════════════════════════');

    // FAIL-FAST: Posting job MUST be registered in live mode
    if (flags.live && !registered.posting) {
      console.error('════════════════════════════════════════════════════════');
      console.error('[JOB_MANAGER] FATAL: Posting job not registered despite MODE=live');
      console.error('   This indicates a configuration error.');
      console.error('   Exiting to prevent silent failure...');
      console.error('════════════════════════════════════════════════════════');
      process.exit(1);
    }

    this.isRunning = true;
    const jobCount = Object.values(registered).filter(Boolean).length;
    console.log('[JOB_MANAGER] Started ' + jobCount + ' job timers (mode=' + flags.mode + ')');

    // Print hourly status
    this.timers.set('status', setInterval(() => {
      this.printHourlyStatus();
    }, 60 * 60 * 1000)); // 1 hour
    
    // 🔥 NEW: Job watchdog - monitors job execution and auto-restarts stopped jobs
    this.timers.set('watchdog', setInterval(() => {
      this.watchdogCheck().catch(err => {
        console.error('[JOB_MANAGER] Watchdog check failed:', err.message);
      });
    }, 10 * 60 * 1000)); // Every 10 minutes
  }
  
  /**
   * 🔥 NEW: Watchdog to monitor job execution and auto-restart stopped jobs
   */
  private async watchdogCheck(): Promise<void> {
    try {
      const { getSupabaseClient } = await import('../db/index');
      const supabase = getSupabaseClient();
      
      // Check critical jobs: plan, posting
      const criticalJobs = ['plan', 'posting'];
      const now = new Date();
      
      for (const jobName of criticalJobs) {
        // Check job heartbeats
        const { data: heartbeat } = await supabase
          .from('job_heartbeats')
          .select('last_success, last_failure, consecutive_failures, updated_at')
          .eq('job_name', jobName)
          .single();
        
        if (!heartbeat) {
          console.warn('[WATCHDOG] No heartbeat found for ' + jobName + ' - job may not be running');
          continue;
        }
        
        const lastSuccess = heartbeat.last_success ? new Date(String(heartbeat.last_success)) : null;
        const lastFailure = heartbeat.last_failure ? new Date(String(heartbeat.last_failure)) : null;
        const consecutiveFailures = heartbeat.consecutive_failures || 0;
        
        // If job hasn't succeeded in 2 hours and has consecutive failures, trigger it
        if (lastSuccess) {
          const hoursSinceSuccess = (now.getTime() - lastSuccess.getTime()) / (1000 * 60 * 60);
          
          if (hoursSinceSuccess > 2 && consecutiveFailures >= 3) {
            console.warn('[WATCHDOG] ' + jobName + ' has not succeeded in ' + hoursSinceSuccess.toFixed(1) + 'h (' + consecutiveFailures + ' failures) - triggering now');
            
            // Trigger job immediately
            await this.runJobNow(jobName as 'plan' | 'posting');
          }
        } else if (lastFailure && consecutiveFailures >= 5) {
          // No success recorded, but many failures - trigger recovery
          console.warn('[WATCHDOG] ' + jobName + ' has ' + consecutiveFailures + ' consecutive failures - triggering recovery');
          await this.runJobNow(jobName as 'plan' | 'posting');
        }
      }
      
      // Check circuit breaker status
      try {
        const { getCircuitBreakerStatus } = await import('./postingQueue');
        const cbStatus = getCircuitBreakerStatus();
        
        if (cbStatus.state === 'open') {
          const timeSinceFailure = cbStatus.lastFailure 
            ? (now.getTime() - cbStatus.lastFailure.getTime()) / 1000 
            : Infinity;
          
          // If circuit breaker open for >10 minutes, log warning
          if (timeSinceFailure > 600) {
            console.warn('[WATCHDOG] Posting circuit breaker open for ' + Math.round(timeSinceFailure/60) + 'min');
            
            // Log to system_events
            await supabase.from('system_events').insert({
              event_type: 'circuit_breaker_watchdog_alert',
              severity: 'warning',
              event_data: {
                state: cbStatus.state,
                failures: cbStatus.failures,
                time_open_seconds: timeSinceFailure
              },
              created_at: now.toISOString()
            });
          }
        }
      } catch (cbError) {
        // Non-critical
      }
      
    } catch (error: any) {
      console.error('[WATCHDOG] Watchdog check failed: ', error.message);
    }
  }

  /**
   * Stop all job timers
   */
  public stopJobs(): void {
    console.log('🛑 JOB_MANAGER: Stopping all job timers...');
    
    this.timers.forEach((timer, name) => {
      clearInterval(timer);
      console.log('   Stopped ' + name + ' timer');
    });
    
    this.timers.clear();
    this.isRunning = false;
    
    console.log('[JOB_MANAGER] All timers stopped');
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
    // 🔥 VI Collection is critical - treat peer_scraper as critical for continuous collection
    // 🔥 Growth Controller is critical - shadow_controller must run hourly to generate plans
    const isCritical = jobName === 'plan' || jobName === 'posting' || jobName === 'peer_scraper' || jobName === 'shadow_controller';
    const maxRetries = isCritical ? 3 : 1;
    
    // 🧠 MEMORY CHECK: Ensure we have enough memory before starting job
    // ✅ OPTIMIZED: Skip non-critical operations if memory > 400MB
    try {
      // ✅ MEMORY OPTIMIZATION: Check memory before starting job
      const { MemoryMonitor } = await import('../utils/memoryMonitor');
      const { isMemorySafeForOperation } = await import('../utils/memoryOptimization');
      
      const memory = MemoryMonitor.checkMemory();
      
      // 🔥 CRITICAL FIX: Critical jobs (plan, posting) should NEVER skip due to memory
      // They should attempt cleanup but proceed to ensure system keeps running
      if (isCritical) {
        // For critical jobs, try cleanup if memory is tight but always proceed
        if (memory.status === 'critical' || memory.rssMB > 1600) {
          console.warn('[JOB_' + jobName.toUpperCase() + '] Memory pressure (' + memory.rssMB + 'MB) - performing emergency cleanup for critical job');
          const cleanupResult = await MemoryMonitor.emergencyCleanup();
          const afterCleanup = MemoryMonitor.checkMemory();
          console.log('[JOB_' + jobName.toUpperCase() + '] After cleanup: ' + afterCleanup.rssMB + 'MB (freed ' + cleanupResult.freedMB + 'MB)');
          
          // Only skip if memory is truly exhausted (>1800MB on 2GB Railway Pro limit)
          if (afterCleanup.rssMB > 1800) {
            console.error('[JOB_' + jobName.toUpperCase() + '] Memory exhausted (' + afterCleanup.rssMB + 'MB > 500MB) - CRITICAL JOB BLOCKED');
            await recordJobSkip(jobName, `memory_exhausted_${afterCleanup.rssMB}mb`);
            return;
          }
          
          // Proceed with critical job (cleanup should have helped)
          console.warn('[JOB_' + jobName.toUpperCase() + '] Memory tight but proceeding (critical job must run)');
        } else if (memory.status === 'warning') {
          console.warn('[JOB_' + jobName.toUpperCase() + '] Memory warning: ' + MemoryMonitor.getStatusMessage());
        }
      } else {
        // Non-critical jobs: Check memory safety and skip if needed
        const memoryCheck = await isMemorySafeForOperation(100, 1400);
        if (!memoryCheck.safe) {
          console.warn('[JOB_' + jobName.toUpperCase() + '] Low memory (' + memoryCheck.currentMB + 'MB), skipping non-critical job');
          await recordJobSkip(jobName, `low_memory_${memoryCheck.currentMB}MB`);
          return;
        }
        
        // Skip non-critical operations if memory is high (prevents spikes)
        if (memory.rssMB > 1600) {
          console.warn('[JOB_' + jobName.toUpperCase() + '] Memory high (' + memory.rssMB + 'MB) - skipping non-critical job to prevent spikes');
          await recordJobSkip(jobName, `memory_high_${memory.rssMB}mb`);
          return;
        }
        
        if (memory.status === 'critical') {
          console.error('[JOB_' + jobName.toUpperCase() + '] Memory critical (' + memory.rssMB + 'MB) - performing aggressive emergency cleanup');
          const cleanupResult = await MemoryMonitor.emergencyCleanup();
          const afterCleanup = MemoryMonitor.checkMemory();
          
          // For non-critical jobs, skip if still critical after cleanup
          if (afterCleanup.status === 'critical') {
            console.error('[JOB_' + jobName.toUpperCase() + '] Memory still critical after cleanup (' + afterCleanup.rssMB + 'MB) - skipping non-critical job');
            await recordJobSkip(jobName, `memory_critical_${afterCleanup.rssMB}mb`);
            return;
          }
        } else if (memory.status === 'warning') {
          console.warn('[JOB_' + jobName.toUpperCase() + '] Memory warning: ' + MemoryMonitor.getStatusMessage());
        }
      }
    } catch (memoryError) {
      // Don't block jobs if memory monitor fails
      console.warn('[JOB_' + jobName.toUpperCase() + '] Memory check failed:', memoryError);
    }
    
    // Per-job memory budget — soft budgets by job category.
    // We don't kill mid-job (partial state risk); we log warnings and track consecutive
    // exceeds so downstream tooling can detect runaway jobs.
    const JOB_MEMORY_BUDGET_MB = (() => {
      if (jobName.startsWith('brain_') || jobName.startsWith('observatory_')) return 500;
      if (jobName.includes('classify') || jobName.includes('expert') || jobName.includes('llm')) return 1000;
      return 200;
    })();

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await recordJobStart(jobName);
        if (attempt > 1) {
          console.log('[JOB_' + jobName.toUpperCase() + ']: Starting (attempt ' + attempt + '/' + maxRetries + ')...');
        } else {
          console.log('[JOB_' + jobName.toUpperCase() + ']: Starting...');
        }

        // Snapshot RSS before job runs so we can measure delta
        const rssBefore = Math.round(process.memoryUsage().rss / 1024 / 1024);

        await jobFn();
        console.log('[JOB_' + jobName.toUpperCase() + ']: Completed successfully');
        await recordJobSuccess(jobName);

        // Memory delta check (post-success) — warn if job exceeded its soft budget
        try {
          const rssAfter = Math.round(process.memoryUsage().rss / 1024 / 1024);
          const deltaMB = rssAfter - rssBefore;
          if (deltaMB > JOB_MEMORY_BUDGET_MB) {
            console.warn(
              '[JOB_' + jobName.toUpperCase() + '] ⚠️ Memory delta ' + deltaMB + 'MB exceeds soft budget ' +
              JOB_MEMORY_BUDGET_MB + 'MB (rss ' + rssBefore + ' → ' + rssAfter + ')'
            );
          }
        } catch {
          // non-fatal; memory tracking is best-effort
        }
        
        // Reset consecutive failure counter on success
        if (isCritical) {
          this.criticalJobFailures.set(jobName, 0);
        }
        
        return; // Success!
        
      } catch (error) {
        const errorMsg = error?.message || String(error);
        console.error('[JOB_' + jobName.toUpperCase() + '] Attempt ' + attempt + ' failed - ' + errorMsg);
        await recordJobFailure(jobName, errorMsg);
        
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 30000); // Exponential backoff: 2s, 4s, 8s (max 30s)
          console.log('Retrying in ' + (delay/1000) + 's...');
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          this.stats.errors++;
          console.error('[JOB_' + jobName.toUpperCase() + '] All ' + maxRetries + ' attempts failed');
          
          if (isCritical) {
            // Track consecutive failures
            const consecutiveFailures = (this.criticalJobFailures.get(jobName) || 0) + 1;
            this.criticalJobFailures.set(jobName, consecutiveFailures);
            
            console.error('CRITICAL: ' + jobName.toUpperCase() + ' job completely failed! System may not post content.');
            console.error('   Consecutive failures: ' + consecutiveFailures);
            
            // 🔥 PERMANENT FIX: Alert after 3 consecutive failures (reduced from 5)
            if (consecutiveFailures >= 3) {
              console.error('CRITICAL: ' + jobName.toUpperCase() + ' has failed ' + consecutiveFailures + ' times consecutively!');
              
              // Log to database
              try {
                const { getSupabaseClient } = await import('../db/index');
                const supabase = getSupabaseClient();
                await supabase.from('system_events').insert({
                  event_type: `${jobName}_consecutive_failures`,
                  severity: 'critical',
                  event_data: {
                    job_name: jobName,
                    consecutive_failures: consecutiveFailures,
                    max_retries: maxRetries,
                    last_error: errorMsg
                  },
                  created_at: new Date().toISOString()
                });
              } catch (dbError) {
                // Non-critical - continue
              }
            }
            
            // After 5 consecutive failures, log emergency event
            if (consecutiveFailures >= 5) {
              console.error('═══════════════════════════════════════════════════════');
              console.error('EMERGENCY: ' + jobName.toUpperCase() + ' failed ' + consecutiveFailures + ' times consecutively!');
              console.error('   This indicates a persistent system issue.');
              console.error('   The watchdog will attempt recovery.');
              console.error('═══════════════════════════════════════════════════════');
              
              // Log to system_events for monitoring
              try {
                const { getSupabaseClient } = await import('../db');
                const supabase = getSupabaseClient();
                await supabase.from('system_events').insert({
                  event_type: 'critical_job_consecutive_failure',
                  severity: 'critical',
                  event_data: {
                    job: jobName,
                    consecutive_failures: consecutiveFailures,
                    last_error: errorMsg.substring(0, 500)
                  },
                  created_at: new Date().toISOString()
                });
              } catch (dbError) {
                // Don't block on DB errors
                console.error('Failed to log critical job failure to DB:', dbError);
              }
            }
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
      const { getSupabaseClient } = await import('../db/index');
      const supabase = getSupabaseClient();
      
      // Check 1: Has content been generated recently? (Database check - more reliable than stats)
      const { data: lastGenerated, error: genError } = await supabase
        .from('content_metadata')
        .select('created_at')
        .in('decision_type', ['single', 'thread'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (genError || !lastGenerated) {
        console.warn('HEALTH_CHECK: No content found in database - running plan job...');
        await this.runJobNow('plan');
        return;
      }
      
      const lastGenTime = new Date(String(lastGenerated.created_at));
      const hoursSinceLastGen = (now.getTime() - lastGenTime.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceLastGen > 3) {
        console.error('HEALTH_CHECK: Last content generated ' + hoursSinceLastGen.toFixed(1) + 'h ago (>3h threshold)!');
        console.error('ATTEMPTING EMERGENCY PLAN RUN...');
        await this.runJobNow('plan');
        return; // Exit early after emergency run
      }
      
      // Check 2: Has plan job run recently? (Stats check - secondary)
      if (this.stats.lastPlanTime) {
        const hoursSinceLastPlan = (now.getTime() - this.stats.lastPlanTime.getTime()) / (1000 * 60 * 60);
        
        if (hoursSinceLastPlan > 3) {
          console.warn('HEALTH_CHECK: Plan job stats show ' + hoursSinceLastPlan.toFixed(1) + 'h since last run (but content exists)');
        }
      } else {
        console.warn('HEALTH_CHECK: Plan job has never run (according to stats)');
      }
      
      // Check 3: Does queue have content ready?
      const { data: queuedContent, error: queueError } = await supabase
        .from('content_metadata')
        .select('decision_id, status, scheduled_at')
        .eq('status', 'queued')
        .limit(5);
      
      if (queueError) {
        console.error('HEALTH_CHECK: Failed to query queue:', queueError.message);
        return;
      }
      
      if (!queuedContent || queuedContent.length === 0) {
        console.warn('HEALTH_CHECK: No queued content found! Generating now...');
        await this.runJobNow('plan');
        return;
      }
      
      // Check 4: Are there stuck posts?
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
      const { data: stuckPosts } = await supabase
        .from('content_metadata')
        .select('decision_id')
        .eq('status', 'posting')
        .lt('created_at', thirtyMinAgo.toISOString());
      
      if (stuckPosts && stuckPosts.length > 0) {
        console.warn('HEALTH_CHECK: Found ' + stuckPosts.length + ' stuck posts (status=posting >30min) - will be recovered by posting queue');
      }
      
      // All checks passed
      const readyCount = queuedContent.filter(c => {
        const scheduled = new Date(String(c.scheduled_at));
        return scheduled <= new Date(Date.now() + 5 * 60 * 1000); // Within 5min grace
      }).length;
      
      console.log('HEALTH_CHECK: Content pipeline healthy (' + queuedContent.length + ' queued, ' + readyCount + ' ready, last gen ' + hoursSinceLastGen.toFixed(1) + 'h ago)');
      
      // Check 5: Profile optimization for follower conversion
      try {
        const { ProfileOptimizer } = await import('../intelligence/profileOptimizer');
        const profileOptimizer = ProfileOptimizer.getInstance();
        const profileAudit = await profileOptimizer.auditProfile();
        
        if (profileAudit.score < 70) {
          console.warn('[HEALTH_CHECK] Profile optimization needed: Score ' + profileAudit.score + '/100');
          console.warn('[HEALTH_CHECK] Issues: ' + profileAudit.issues.join(', '));
          console.warn('[HEALTH_CHECK] Recommendations: ' + profileAudit.recommendations.join('; '));
          
          // Log to system_events for monitoring
          await supabase.from('system_events').insert({
            event_type: 'profile_optimization_needed',
            severity: 'warning',
            event_data: {
              score: profileAudit.score,
              issues: profileAudit.issues,
              recommendations: profileAudit.recommendations,
              content_mix: profileAudit.contentMix
            },
            created_at: new Date().toISOString()
          });
        } else {
          console.log('[HEALTH_CHECK] Profile optimized for follower conversion (score: ' + profileAudit.score + '/100)');
        }
      } catch (profileError: any) {
        console.warn('[HEALTH_CHECK] Profile audit failed: ' + profileError.message);
      }
      
    } catch (error: any) {
      console.error('HEALTH_CHECK: Error during health check:', error.message);
    }
  }

  /**
   * Print hourly status summary
   */
  private printHourlyStatus(): void {
    const config = getConfig();
    const flags = getModeFlags(config);
    
    console.log('💓 HOURLY_HEARTBEAT:');
    console.log('   Mode: ' + config.MODE);
    console.log('   Jobs running: ' + flags.enableJobScheduling);
    console.log('   Plan runs: ' + this.stats.planRuns);
    console.log('   Reply runs: ' + this.stats.replyRuns);
    console.log('   Posting runs: ' + this.stats.postingRuns);
    console.log('   Outcome runs: ' + this.stats.outcomeRuns);
    console.log('   Learn runs: ' + this.stats.learnRuns);
    console.log('   Errors: ' + this.stats.errors);
    console.log('   Last plan: ' + (this.stats.lastPlanTime?.toISOString() || 'never'));
    console.log('   Last learn: ' + (this.stats.lastLearnTime?.toISOString() || 'never'));
  }

  /**
   * Force run a specific job (for testing/manual trigger)
   */
  public async runJobNow(jobName: 'plan' | 'reply' | 'reply_posting' | 'posting' | 'outcomes' | 'realOutcomes' | 'analyticsCollector' | 'learn' | 'trainPredictor' | 'account_discovery' | 'metrics_scraper' | 'reply_metrics_scraper' | 'reply_performance_snapshot' | 'mega_viral_harvester' | 'peer_scraper' | 'reply_v2_fetch'): Promise<void> {
    console.log('[JOB_MANAGER] Force running ' + jobName + ' job...');
    
    switch (jobName) {
      case 'plan':
        await this.safeExecute('plan', async () => {
          await planContent();
          this.stats.planRuns++;
          this.stats.lastPlanTime = new Date();
        });
        break;
      
      case 'reply':
      case 'reply_posting':
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
          console.log('[JOB_MANAGER] Predictor ' + coefficients.version + ' trained and persisted');
        });
        break;
      
      case 'metrics_scraper':
        await this.safeExecute('metrics_scraper', async () => {
          const { metricsScraperJob } = await import('./metricsScraperJob');
          await metricsScraperJob();
        });
        break;
      
      case 'reply_metrics_scraper':
        await this.safeExecute('reply_metrics_scraper', async () => {
          const { replyMetricsScraperJob } = await import('./replyMetricsScraperJob');
          await replyMetricsScraperJob();
        });
        break;

      case 'reply_performance_snapshot':
        await this.safeExecute('reply_performance_snapshot', async () => {
          const { runReplyPerformanceSnapshotJob } = await import('./replySystemV2/replyPerformanceSnapshotJob');
          await runReplyPerformanceSnapshotJob();
        });
        break;

      case 'mega_viral_harvester':
        await this.safeExecute('mega_viral_harvester', async () => {
          const { replyOpportunityHarvester } = await import('./replyOpportunityHarvester');
          await replyOpportunityHarvester();
        });
        break;
      
      case 'peer_scraper':
        await this.safeExecute('peer_scraper', async () => {
          const { peerScraperJob } = await import('./peerScraperJob');
          await peerScraperJob();
        });
        break;
      
      case 'reply_v2_fetch':
        await this.safeExecute('reply_v2_fetch', async () => {
          const { runFullCycle } = await import('./replySystemV2/orchestrator');
          await runFullCycle();
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
      
      console.log('[RESTART_PROTECTION] Last content generated: ' + hoursSinceLastGeneration.toFixed(1) + 'h ago');
      
      // If last generation was >2 hours ago, run immediately
      if (hoursSinceLastGeneration > 2) {
        console.log('[RESTART_PROTECTION] Gap detected: Running plan job immediately');
        return true;
      }
      
      return false; // Recent content exists, use normal schedule
      
    } catch (error: any) {
      console.error('[RESTART_PROTECTION] Error checking last run:', error.message);
      return false; // On error, use normal schedule
    }
  }
}
