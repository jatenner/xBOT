// 🔍 SENTRY: Must be imported FIRST to capture all errors
import './observability/instrument';
import { Sentry } from './observability/instrument';

import { createServer } from "http";
import { spawn } from "child_process";
import { ENV, isProduction } from './config/env';
import { log } from './lib/logger';
import { getConfig, printConfigSummary, printDeprecationWarnings, getModeFlags } from './config/config';
import { JobManager } from './jobs/jobManager';
import { validateEnvironmentVariables } from './config/envValidation';

// CRITICAL: Process-level error handlers to prevent crashes
process.on('uncaughtException', (error: Error) => {
  log({ op: 'uncaught_exception', error: error.message, stack: error.stack });
  
  // Send to Sentry for tracking
  Sentry.captureException(error, {
    level: 'error',
    tags: { error_type: 'uncaught_exception' }
  });
  
  // Handle specific known errors gracefully
  if (error.message?.includes('Target page, context or browser has been closed')) {
    log({ op: 'browser_closed', recoverable: true });
    // Don't crash - let the system continue
  } else if (error.message?.includes('Timeout')) {
    log({ op: 'timeout_error', recoverable: true });
    // Don't crash - let the system continue  
  } else if (error.message?.includes('Network verification')) {
    log({ op: 'network_error', recoverable: true });
    // Don't crash - continue operation
  } else {
    // For truly fatal errors, log and restart
    log({ op: 'fatal_error', error_type: error.name, fatal: true });
    // In production, you might want to: process.exit(1);
    // For now, we let it continue to prevent unnecessary crashes
  }
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  log({ op: 'unhandled_rejection', reason: reason?.message || String(reason) });
  
  // Send to Sentry for tracking
  Sentry.captureException(reason, {
    level: 'warning',
    tags: { error_type: 'unhandled_rejection' }
  });
  
  // Log but don't crash - most rejections can be recovered from
  if (reason?.message?.includes('closed') || reason?.message?.includes('Timeout')) {
    log({ op: 'recoverable_rejection', continue: true });
  }
});

// Startup configuration summary
function getStartupSummary() {
  const config = {
    node_env: ENV.NODE_ENV,
    mode: ENV.MODE,
    has_database: !!ENV.DATABASE_URL,
    has_redis: !!ENV.REDIS_URL,
    has_twitter_session: !!ENV.TWITTER_SESSION_B64,
    port: ENV.PORT
  };

  log({ op: 'startup_summary', config });
  
  return config;
}

// Run a script and capture result
async function runScript(scriptPath: string, args: string[] = []): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn('node', [scriptPath, ...args], {
      stdio: 'inherit',
      env: process.env
    });
    
    child.on('close', (code) => {
      resolve(code === 0);
    });
    
    child.on('error', () => {
      resolve(false);
    });
  });
}

async function runStartupGates(config: any) {
  log({ op: 'startup_gates', status: 'running' });
  
  // 🔒 CRITICAL: Validate environment variables FIRST (fail-fast if broken)
  log({ op: 'env_validation', status: 'running' });
  validateEnvironmentVariables(); // This will crash if critical vars missing
  log({ op: 'env_validation', status: 'passed' });
  
  // Startup acceptance
  if (config.startup_acceptance) {
    log({ op: 'startup_acceptance', status: 'running' });
    const acceptanceOk = await runScript('dist/scripts/startup-acceptance.js');
    log({ op: 'startup_acceptance', outcome: acceptanceOk ? 'pass' : 'fail' });
  } else {
    log({ op: 'startup_acceptance', status: 'skipped' });
  }
  
  // Dry-run plan
  if (config.startup_dryrun_plan) {
    log({ op: 'dryrun_plan', status: 'running' });
    const planOk = await runScript('dist/scripts/dryrun-plan.js', ['3']);
    log({ op: 'dryrun_plan', outcome: planOk ? 'completed' : 'failed' });
  } else {
    console.log('📝 Dry-run plan: skipped (STARTUP_RUN_DRYRUN_PLAN=false)');
  }
  
  // Dry-run reply
  if (config.startup_dryrun_reply) {
    console.log('💬 Running dry-run reply...');
    const replyOk = await runScript('dist/scripts/dryrun-reply.js');
    console.log(`💬 Dry-run reply: ${replyOk ? 'COMPLETED' : 'FAILED'}`);
  } else {
    console.log('💬 Dry-run reply: skipped (STARTUP_RUN_DRYRUN_REPLY=false)');
  }
  
  // Load latest predictor model
  console.log('🤖 Loading latest predictor model...');
  try {
    const { loadLatestCoefficients } = await import('./jobs/predictorTrainer');
    const coefficients = await loadLatestCoefficients();
    
    if (coefficients) {
      console.log(`✅ Loaded predictor ${coefficients.version} from KV (trained: ${coefficients.meta.trainedAt})`);
    } else {
      console.log('ℹ️ No persisted predictor found, will use defaults');
    }
  } catch (error) {
    console.warn('⚠️ Failed to load predictor, will use defaults:', error.message);
  }
  
  console.log('🧪 STARTUP_GATES: All gates processed (non-blocking)');
}

async function runBackgroundMigrations() {
  console.log('🗄️ MIGRATIONS: Starting background migrations...');
  try {
    const { spawn } = await import('child_process');
    const migrationProcess = spawn('node', ['scripts/migrate-bulletproof.js'], {
      stdio: 'inherit',
      env: process.env,
      detached: false
    });
    
    migrationProcess.on('close', (code) => {
      console.log(`🗄️ MIGRATIONS: Completed with code ${code}`);
    });
    
    migrationProcess.on('error', (error) => {
      console.log(`⚠️ MIGRATIONS: Error: ${error.message} (non-fatal)`);
    });
  } catch (error) {
    console.log(`⚠️ MIGRATIONS: Could not start: ${error.message} (continuing...)`);
  }
}

async function boot() {
  console.log('🔄 XBOT_BOOT: Starting bulletproof production runtime...');
  
  // Load and display unified configuration
  const config = getConfig();
  printConfigSummary(config);
  printDeprecationWarnings();
  
  // Log shadow prod activation
  if (config.MODE === 'shadow') {
    console.log('🎭 SHADOW_PROD ACTIVE: Zero-cost learning loop with synthetic outcomes');
  }
  
  // Try common server modules in priority order - START IMMEDIATELY
  const candidates = ["./server", "./main", "./index", "./api/index"];
  let started = false;

  for (const mod of candidates) {
    try {
      const m = await import(mod);
      if (typeof m.start === "function") {
        console.log(`✅ Using runtime entry: ${mod}.start()`);
        await m.start();
        started = true;
        break;
      }
      if (m.app?.listen) {
        const port = Number(config.PORT);
        console.log(`✅ Using runtime entry: ${mod}.app.listen(${port})`);
        m.app.listen(port);
        started = true;
        break;
      }
    } catch (err) {
      console.log(`❌ Failed to load ${mod}: ${err.message}`);
    }
  }

  if (!started) {
    // fallback: bare HTTP server to keep container alive + health
    const port = Number(config.PORT);
    createServer((req, res) => {
      const url = req.url || '/';
      
      if (url === '/status' || url === '/health') {
        res.writeHead(200, { "content-type": "application/json" });
        const flags = getModeFlags(config);
        res.end(JSON.stringify({ 
          ok: true, 
          message: "xBOT up (fallback)", 
          posting_disabled: flags.postingDisabled,
          dry_run: flags.dryRun,
          timestamp: new Date().toISOString()
        }));
      } else {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true, message: "xBOT fallback server" }));
      }
    }).listen(port, () => {
      console.log(`🏥 Fallback health server listening on 0.0.0.0:${port}`);
      console.log(`📊 Status endpoint: http://0.0.0.0:${port}/status`);
    });
  }
  
  console.log('✅ HEALTH_SERVER: Server is ready, starting background tasks...');
  
  // NOW run background tasks after server is up
  // Run migrations in background (non-blocking)
  runBackgroundMigrations();
  
  // Legacy config for startup gates
  const legacyConfig = getStartupSummary();
  
  // Run startup gates (non-blocking, in background)
  runStartupGates(legacyConfig).catch((error) => {
    console.log(`⚠️ STARTUP_GATES: Error during gates: ${error.message} (continuing...)`);
  });
  
  // Load latest predictor model (background)
  (async () => {
    try {
      console.log('🤖 Loading latest predictor model...');
      const { loadLatestCoefficients } = await import('./jobs/predictorTrainer');
      const coeffs = await loadLatestCoefficients();
      if (coeffs) {
        console.log(`✅ Loaded predictor ${coeffs.version} (R²=${coeffs.ridge.rSquared.toFixed(3)})`);
      } else {
        console.log('ℹ️ No persisted predictor found, will use defaults');
      }
    } catch (error) {
      console.log('⚠️ Predictor loading failed:', error.message);
    }
  })();

  // Initialize job manager (background)
  (async () => {
    const jobManager = JobManager.getInstance();
    try {
      console.log('🕒 JOB_MANAGER: Initializing job timers...');
      await jobManager.startJobs();
      console.log('✅ JOB_MANAGER: All timers started successfully');
      
      // 🔥 CRITICAL: Run plan job IMMEDIATELY with retry logic
      console.log('🚀 STARTUP: Running immediate plan job to populate queue...');
      let startupPlanSuccess = false;
      
      for (let i = 1; i <= 3; i++) {
        try {
          await jobManager.runJobNow('plan');
          console.log('✅ STARTUP: Initial plan job completed');
          startupPlanSuccess = true;
          break;
        } catch (error) {
          console.error(`❌ STARTUP: Plan job attempt ${i}/3 failed:`, error.message);
          if (i < 3) {
            const delay = i * 2000; // 2s, 4s
            console.log(`🔄 Retrying in ${delay/1000}s...`);
            await new Promise(r => setTimeout(r, delay));
          }
        }
      }
      
      if (!startupPlanSuccess) {
        console.error(`🚨 CRITICAL: Startup plan job failed all 3 retries!`);
        console.error(`⚠️ System will rely on scheduled plan jobs (every 2 hours)`);
      }
      
      // Schedule health check every 30 minutes
      console.log('🏥 HEALTH_CHECK: Starting content pipeline health monitor (30min intervals)');
      setInterval(() => {
        jobManager.checkContentPipelineHealth().catch(err => {
          console.error('❌ HEALTH_CHECK: Health check failed:', err.message);
        });
      }, 30 * 60 * 1000); // 30 minutes
      
      // Run first health check after 10 minutes (give system time to settle)
      setTimeout(() => {
        console.log('🏥 HEALTH_CHECK: Running first health check...');
        jobManager.checkContentPipelineHealth().catch(err => {
          console.error('❌ HEALTH_CHECK: First health check failed:', err.message);
        });
      }, 10 * 60 * 1000);
      
    } catch (error) {
      // 🚨 FATAL ERROR: Job manager startup itself failed
      console.error(`❌ FATAL: JOB_MANAGER failed to start: ${error.message}`);
      console.error(`Stack: ${error.stack}`);
      console.error(`❌ System cannot function without job manager!`);
      console.error(`❌ ❌ ❌ JOB MANAGER STARTUP FAILED ❌ ❌ ❌`);
      // Exit with error code to force Railway restart
      process.exit(1);
    }
  })();
  
  // Start heartbeat
  setInterval(() => {
    const flags = getModeFlags(config);
    console.log(`💓 HEARTBEAT: ${new Date().toISOString()} - posting_disabled=${flags.postingDisabled}, dry_run=${flags.dryRun}, mode=${config.MODE}`);
  }, 60000); // 1-minute heartbeat

  // 🛡️ PROCESS KEEP-ALIVE: Prevent silent process exits
  // This ensures the process never exits gracefully even if all timers are cleared
  const keepAliveInterval = setInterval(() => {
    // Keep-alive heartbeat - prevents process from exiting
  }, 30000); // Every 30 seconds

  // 🔥 CRITICAL JOB MONITOR: Auto-restart if critical jobs fail
  // If posting/plan jobs haven't succeeded in 30 minutes, force Railway restart
  let lastCriticalJobSuccess = Date.now();
  const CRITICAL_JOB_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  const CRITICAL_JOB_CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes

  setInterval(() => {
    const jobManager = JobManager.getInstance();
    const stats = jobManager.getStats();
    
    // Check if critical jobs have succeeded recently
    const now = Date.now();
    const lastPostingTime = stats.lastPostingTime?.getTime() || 0;
    const lastPlanTime = stats.lastPlanTime?.getTime() || 0;
    const mostRecentSuccess = Math.max(lastPostingTime, lastPlanTime);
    
    if (mostRecentSuccess > 0) {
      lastCriticalJobSuccess = mostRecentSuccess;
    }
    
    const timeSinceLastSuccess = now - lastCriticalJobSuccess;
    
    if (timeSinceLastSuccess > CRITICAL_JOB_TIMEOUT) {
      console.error('═══════════════════════════════════════════════════════');
      console.error('🚨 CRITICAL: No successful jobs in 30 minutes!');
      console.error(`   Last success: ${new Date(lastCriticalJobSuccess).toISOString()}`);
      console.error(`   Time since: ${Math.round(timeSinceLastSuccess / 60000)} minutes`);
      console.error('   This indicates system is stuck - forcing Railway restart...');
      console.error('═══════════════════════════════════════════════════════');
      
          // Log to system_events before exiting
          (async () => {
            try {
              const { getSupabaseClient } = await import('./db');
              const supabase = getSupabaseClient();
              await supabase.from('system_events').insert({
                event_type: 'critical_job_timeout',
                severity: 'critical',
                event_data: {
                  time_since_last_success_minutes: Math.round(timeSinceLastSuccess / 60000),
                  last_posting_time: stats.lastPostingTime?.toISOString(),
                  last_plan_time: stats.lastPlanTime?.toISOString()
                },
                created_at: new Date().toISOString()
              });
            } catch (e) {
              // Ignore DB errors during emergency exit
            }
          })();
      
      // Force Railway restart by exiting with error code
      process.exit(1);
    } else {
      // Update last success time from stats
      if (stats.lastPostingTime || stats.lastPlanTime) {
        const mostRecent = Math.max(
          stats.lastPostingTime?.getTime() || 0,
          stats.lastPlanTime?.getTime() || 0
        );
        if (mostRecent > lastCriticalJobSuccess) {
          lastCriticalJobSuccess = mostRecent;
        }
      }
    }
  }, CRITICAL_JOB_CHECK_INTERVAL);

  console.log('✅ PROCESS_KEEP_ALIVE: Keep-alive and critical job monitor started');
  console.log('   • Keep-alive heartbeat: every 30 seconds');
  console.log('   • Critical job timeout: 30 minutes');
  console.log('   • Auto-restart if no successful jobs in 30 minutes');

  // 🧠 MEMORY MONITOR: Check memory every 5 minutes and BACKGROUND cleanup
  // ✅ OPTIMIZED: Cleanup runs in background - never blocks operations
  (async () => {
    const { MemoryMonitor } = await import('./utils/memoryMonitor');
    const { scheduleBackgroundMemoryCleanup, scheduleBackgroundBrowserCleanup } = await import('./utils/backgroundCleanup');
    
    setInterval(() => {
      const memory = MemoryMonitor.checkMemory();
      
      // 🔥 BACKGROUND CLEANUP: Schedule cleanup to run in background (non-blocking)
      // Operations continue normally - cleanup happens independently
      if (memory.rssMB > 350) {
        console.log(`🧹 [BACKGROUND_CLEANUP] Scheduling memory cleanup: ${memory.rssMB}MB (${Math.round(memory.rssMB/512*100)}% of limit)`);
        
        // Schedule cleanup in background (fire and forget - never blocks)
        scheduleBackgroundMemoryCleanup().catch(err => {
          console.error(`🧹 [BACKGROUND_CLEANUP] Failed to schedule cleanup:`, err.message);
        });
        
        // Also schedule browser cleanup if memory is high
        if (memory.rssMB > 400) {
          scheduleBackgroundBrowserCleanup(memory.rssMB > 450).catch(err => {
            console.error(`🧹 [BACKGROUND_CLEANUP] Failed to schedule browser cleanup:`, err.message);
          });
        }
      } else if (memory.status === 'critical') {
        console.error(`🧠 [MEMORY_MONITOR] ${MemoryMonitor.getStatusMessage()} - scheduling emergency cleanup in background`);
        // Schedule critical cleanup in background (non-blocking)
        scheduleBackgroundMemoryCleanup().catch(err => {
          console.error(`🧠 [MEMORY_MONITOR] Emergency cleanup scheduling failed:`, err);
        });
        scheduleBackgroundBrowserCleanup(true).catch(err => {
          console.error(`🧠 [MEMORY_MONITOR] Emergency browser cleanup scheduling failed:`, err);
        });
      } else if (memory.status === 'warning') {
        console.warn(`🧠 [MEMORY_MONITOR] ${MemoryMonitor.getStatusMessage()}`);
      }
    }, 5 * 60 * 1000); // ✅ OPTIMIZED: Every 5 minutes
    
    console.log('✅ MEMORY_MONITOR: Started (checks every 5 minutes)');
    console.log('   • Background cleanup: Runs independently, never blocks operations');
    console.log('   • Proactive cleanup threshold: 350MB (68% of limit)');
    console.log('   • Warning threshold: 400MB (78% of limit)');
    console.log('   • Critical threshold: 450MB (88% of limit)');
    console.log('   • Cleanup happens in background - operations continue normally');
  })();

  // 🔐 SESSION MONITOR: Check Twitter session every 10 minutes and auto-refresh if expired
  (async () => {
    const { SessionMonitor } = await import('./utils/sessionMonitor');
    
    // Initial check after 2 minutes (give system time to start)
    setTimeout(async () => {
      await SessionMonitor.autoCheckAndRefresh();
    }, 2 * 60 * 1000);
    
    // Then check every 10 minutes
    setInterval(async () => {
      await SessionMonitor.autoCheckAndRefresh();
    }, 10 * 60 * 1000); // Every 10 minutes
    
    console.log('✅ SESSION_MONITOR: Started (checks every 10 minutes)');
    console.log('   • Auto-detects expired sessions');
    console.log('   • Auto-refreshes from TWITTER_SESSION_B64');
    console.log('   • First check after 2 minutes');
  })();
}

boot().catch((e) => {
  console.error("💥 FATAL_BOOT_ERROR:", e.message);
  process.exit(1);
});