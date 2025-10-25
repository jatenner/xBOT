import { createServer } from "http";
import { spawn } from "child_process";
import { getConfig, printConfigSummary, printDeprecationWarnings, getModeFlags } from './config/config';
import { JobManager } from './jobs/jobManager';

// CRITICAL: Process-level error handlers to prevent crashes
process.on('uncaughtException', (error: Error) => {
  console.error('🚨 UNCAUGHT EXCEPTION:', error.message);
  console.error('Stack:', error.stack);
  
  // Handle specific known errors gracefully
  if (error.message?.includes('Target page, context or browser has been closed')) {
    console.log('⚠️  Browser closed unexpectedly - will recover on next cycle');
    // Don't crash - let the system continue
  } else if (error.message?.includes('Timeout')) {
    console.log('⚠️  Operation timed out - will retry on next cycle');
    // Don't crash - let the system continue  
  } else if (error.message?.includes('Network verification')) {
    console.log('⚠️  Network verification error - non-fatal');
    // Don't crash - continue operation
  } else {
    // For truly fatal errors, log and restart
    console.error('💥 FATAL ERROR - System may need restart');
    console.error('Error type:', error.name);
    console.error('This will be logged but system continues...');
    // In production, you might want to: process.exit(1);
    // For now, we let it continue to prevent unnecessary crashes
  }
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('🚨 UNHANDLED REJECTION at:', promise);
  console.error('Reason:', reason);
  // Log but don't crash - most rejections can be recovered from
  if (reason?.message?.includes('closed') || reason?.message?.includes('Timeout')) {
    console.log('⚠️  Recoverable rejection - continuing operation');
  }
});

// Startup configuration summary
function getStartupSummary() {
  const config = {
    posting_disabled: process.env.POSTING_DISABLED === 'true',
    dry_run: process.env.DRY_RUN === 'true', 
    startup_acceptance: process.env.STARTUP_ACCEPTANCE_ENABLED === 'true',
    startup_dryrun_plan: process.env.STARTUP_RUN_DRYRUN_PLAN === 'true',
    startup_dryrun_reply: process.env.STARTUP_RUN_DRYRUN_REPLY === 'true',
    log_level: process.env.LOG_LEVEL || 'info',
    db_ssl_mode: process.env.DATABASE_URL?.includes('sslmode=require') ? 'verified' : 'disabled',
    node_env: process.env.NODE_ENV || 'development',
    port: process.env.PORT || '8080'
  };

  console.log('🚀 XBOT_STARTUP_SUMMARY:');
  console.log(`   • Posting: ${config.posting_disabled ? 'DISABLED' : 'ENABLED'}`);
  console.log(`   • Dry Run: ${config.dry_run ? 'ENABLED' : 'DISABLED'}`);
  console.log(`   • Acceptance: ${config.startup_acceptance ? 'ENABLED' : 'DISABLED'}`);
  console.log(`   • DB SSL: ${config.db_ssl_mode}`);
  console.log(`   • Node ENV: ${config.node_env}`);
  console.log(`   • Port: ${config.port}`);
  
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
  console.log('🧪 STARTUP_GATES: Running optional startup checks...');
  
  // Startup acceptance
  if (config.startup_acceptance) {
    console.log('🧪 Running startup acceptance...');
    const acceptanceOk = await runScript('dist/scripts/startup-acceptance.js');
    console.log(`🧪 Startup acceptance: ${acceptanceOk ? 'PASS' : 'FAIL'}`);
      } else {
    console.log('🧪 Acceptance smoke: skipped (STARTUP_ACCEPTANCE_ENABLED=false)');
  }
  
  // Dry-run plan
  if (config.startup_dryrun_plan) {
    console.log('📝 Running dry-run plan...');
    const planOk = await runScript('dist/scripts/dryrun-plan.js', ['3']);
    console.log(`📝 Dry-run plan: ${planOk ? 'COMPLETED' : 'FAILED'}`);
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
  
  // 🏗️ PERMANENT FIX: Initialize singleton managers FIRST
  // This prevents resource exhaustion (Redis max clients, browser spawn errors)
  console.log('🏗️ SINGLETONS: Initializing core managers...');
  try {
    const { initializeSingletons } = await import('./core/singletonManagers');
    await initializeSingletons();
    console.log('✅ SINGLETONS: Core managers initialized (ONE Redis, ONE Browser for entire app)');
  } catch (error: any) {
    console.error('❌ SINGLETONS: Failed to initialize:', error.message);
    console.log('⚠️ System will continue but may have resource issues');
  }
  
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
}

boot().catch((e) => {
  console.error("💥 FATAL_BOOT_ERROR:", e.message);
  process.exit(1);
});