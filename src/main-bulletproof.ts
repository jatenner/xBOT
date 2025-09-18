import { createServer } from "http";
import { spawn } from "child_process";
import { getConfig, printConfigSummary, printDeprecationWarnings, getModeFlags } from './config/config';
import { JobManager } from './jobs/jobManager';

// Startup configuration summary
function getStartupSummary() {
  const config = {
    posting_disabled: process.env.POSTING_DISABLED === 'true',
    dry_run: process.env.DRY_RUN === 'true', 
    startup_acceptance: process.env.STARTUP_ACCEPTANCE_ENABLED === 'true',
    startup_dryrun_plan: process.env.STARTUP_RUN_DRYRUN_PLAN === 'true',
    startup_dryrun_reply: process.env.STARTUP_RUN_DRYRUN_REPLY === 'true',
    log_level: process.env.LOG_LEVEL || 'info',
    db_ssl_mode: process.env.DATABASE_URL?.includes('sslmode=require') ? 'no-verify' : 'disabled',
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
  
  console.log('🧪 STARTUP_GATES: All gates processed (non-blocking)');
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
  
  // Legacy config for startup gates
  const legacyConfig = getStartupSummary();
  
  // Run startup gates (non-blocking)
  try {
    await runStartupGates(legacyConfig);
    } catch (error) {
    console.log(`⚠️ STARTUP_GATES: Error during gates: ${error.message} (continuing...)`);
  }
  
  // Load latest predictor model
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

  // Initialize job manager
  const jobManager = JobManager.getInstance();
  try {
    await jobManager.startJobs();
    } catch (error) {
    console.log(`⚠️ JOB_MANAGER: Error starting jobs: ${error.message} (continuing...)`);
  }
  
  // Try common server modules in priority order
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