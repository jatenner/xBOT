/**
 * 🚂 RAILWAY ENTRYPOINT - Fail-open healthcheck + background init
 * 
 * CRITICAL REQUIREMENTS:
 * 1. Server MUST start and listen within 2 seconds
 * 2. /status MUST respond 200 without ANY async imports or DB calls
 * 3. Background init MUST NEVER crash the process (log errors, stay alive)
 * 4. Server stays up even if Supabase/Twitter/Playwright/env are broken
 */

import express from 'express';

const app = express();

// Middleware
app.use(express.json());

/**
 * 🔍 BOOT STATE - Tracks system readiness and health
 */
interface BootState {
  ready: boolean;
  degraded: boolean;
  lastError: string | null;
  startedAt: number;
  lastHeartbeatAt: number | null;
  lastInitAt: number | null;
  envOk: boolean;
  dbOk: boolean;
  jobsOk: boolean;
  recoveryOk: boolean;
  invariantCheckOk: boolean;
}

const bootState: BootState = {
  ready: false,
  degraded: false,
  lastError: null,
  startedAt: Date.now(),
  lastHeartbeatAt: null,
  lastInitAt: null,
  envOk: false,
  dbOk: false,
  jobsOk: false,
  recoveryOk: false,
  invariantCheckOk: false
};

/**
 * ⚡ INSTANT HEALTHCHECK - No DB, no async imports, no env validation
 * Always returns 200 (Railway healthcheck requirement)
 */
app.get('/status', (req, res) => {
  res.status(200).json({
    ok: true,
    ts: Date.now(),
    version: '1.0.0',
    uptime: Math.floor(process.uptime()),
    pid: process.pid,
    ready: bootState.ready,
    degraded: bootState.degraded,
    lastError: bootState.lastError
  });
});

/**
 * 🎯 READINESS CHECK - Returns 200 ONLY when system is truly ready
 * Used by external monitoring to verify the bot is actually running
 */
app.get('/ready', (req, res) => {
  if (bootState.ready) {
    res.status(200).json({
      ready: true,
      ts: Date.now(),
      uptime: Math.floor(process.uptime()),
      envOk: bootState.envOk,
      dbOk: bootState.dbOk,
      jobsOk: bootState.jobsOk,
      recoveryOk: bootState.recoveryOk,
      invariantCheckOk: bootState.invariantCheckOk,
      degraded: bootState.degraded,
      lastError: bootState.lastError
    });
  } else {
    res.status(503).json({
      ready: false,
      ts: Date.now(),
      uptime: Math.floor(process.uptime()),
      envOk: bootState.envOk,
      dbOk: bootState.dbOk,
      jobsOk: bootState.jobsOk,
      recoveryOk: bootState.recoveryOk,
      invariantCheckOk: bootState.invariantCheckOk,
      degraded: bootState.degraded,
      lastError: bootState.lastError,
      message: 'System not ready yet - background initialization in progress'
    });
  }
});

/**
 * Root endpoint
 */
app.get('/', (req, res) => {
  res.json({
    name: 'xBOT Railway Entrypoint',
    status: 'listening',
    healthcheck: '/status',
    timestamp: new Date().toISOString()
  });
});

/**
 * Start server IMMEDIATELY (before any heavy init)
 */
const port = Number(process.env.PORT || 3000);
const host = '0.0.0.0';

const server = app.listen(port, host, () => {
  console.log(`[BOOT] listening host=${host} port=${port} pid=${process.pid}`);
  console.log(`[BOOT] healthcheck ready: http://${host}:${port}/status`);
  console.log(`[BOOT] timestamp=${new Date().toISOString()}`);
});

/**
 * Graceful shutdown handlers
 */
const shutdown = (signal: string) => {
  console.log(`[BOOT] shutdown signal=${signal}`);
  server.close(() => {
    console.log('[BOOT] server closed');
    process.exit(0);
  });
  
  // Force exit after 10s if graceful shutdown hangs
  setTimeout(() => {
    console.error('[BOOT] forced exit after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

/**
 * Error handlers - NEVER crash the process
 */
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  const errorMessage = reason instanceof Error ? reason.message : String(reason);
  console.error('[BOOT] unhandledRejection:', errorMessage);
  console.error('[BOOT] promise:', promise);
  // DO NOT exit - keep server alive
});

process.on('uncaughtException', (error: Error) => {
  console.error('[BOOT] uncaughtException:', error.message);
  console.error('[BOOT] stack:', error.stack);
  // DO NOT exit - keep server alive
});

/**
 * Background initialization (non-blocking, fail-safe)
 * 
 * This runs AFTER the server is listening, so Railway healthcheck passes
 * even if initialization fails.
 */
setImmediate(async () => {
  console.log('[BOOT] background_init start');
  bootState.lastInitAt = Date.now();
  
  try {
    // Step 1: Validate environment (soft check - warn only, don't exit)
    console.log('[BOOT] env_validation start');
    try {
      const { validateEnvironment } = await import('./config/env');
      const isValid = validateEnvironment();
      if (!isValid) {
        console.warn('[BOOT] ⚠️ env_validation failed - running in degraded mode');
        bootState.degraded = true;
        bootState.lastError = 'Environment validation failed (missing required env vars)';
        bootState.envOk = false;
      } else {
        console.log('[BOOT] env_validation ok');
        bootState.envOk = true;
      }
    } catch (envError: any) {
      console.error('[BOOT] ⚠️ env_validation error:', envError.message);
      console.error('[BOOT] continuing in degraded mode...');
      bootState.degraded = true;
      bootState.lastError = `Env validation error: ${envError.message}`;
      bootState.envOk = false;
    }
    
    // Step 2: Database connectivity check (cheap ping)
    console.log('[BOOT] db_ping start');
    try {
      const { getSupabaseClient } = await import('./db/index');
      const supabase = getSupabaseClient();
      
      // Cheap query to verify DB connectivity
      const { error } = await supabase
        .from('content_metadata')
        .select('decision_id', { count: 'exact', head: true })
        .limit(1);
      
      if (error) {
        throw new Error(`DB query failed: ${error.message}`);
      }
      
      console.log('[BOOT] db_ping ok');
      bootState.dbOk = true;
    } catch (dbError: any) {
      console.error('[BOOT] ⚠️ db_ping error:', dbError.message);
      console.error('[BOOT] continuing without database...');
      bootState.degraded = true;
      bootState.lastError = `Database ping failed: ${dbError.message}`;
      bootState.dbOk = false;
    }
    
    // Step 3: Run database migrations (if DB is ok)
    if (bootState.dbOk) {
      console.log('[BOOT] migrations start');
      try {
        const { runMigrationsOnStartup } = await import('./db/runMigrations');
        await runMigrationsOnStartup();
        console.log('[BOOT] migrations ok');
      } catch (migError: any) {
        console.error('[BOOT] ⚠️ migrations error:', migError.message);
        console.error('[BOOT] continuing without migrations...');
        // Don't set degraded for migration failures - they might already be applied
      }
    }
    
    // Step 4: Validate database schema (if DB is ok)
    if (bootState.dbOk) {
      console.log('[BOOT] schema_validation start');
      try {
        const { validateDatabaseSchema } = await import('./db/schemaValidator');
        const schemaResult = await validateDatabaseSchema();
        if (!schemaResult.valid) {
          console.error('[BOOT] ⚠️ schema_validation failed');
          console.error(`[BOOT]    errors=${schemaResult.errors.length}`);
          console.error(`[BOOT]    missing_tables=${schemaResult.missingTables.length}`);
          console.error(`[BOOT]    missing_columns=${schemaResult.missingColumns.length}`);
          schemaResult.errors.slice(0, 5).forEach(err => console.error(`[BOOT]    - ${err}`));
          console.error('[BOOT] continuing in degraded mode...');
          bootState.degraded = true;
          bootState.lastError = 'Database schema validation failed';
        } else {
          console.log('[BOOT] schema_validation ok');
        }
      } catch (schemaError: any) {
        console.error('[BOOT] ⚠️ schema_validation error:', schemaError.message);
        console.error('[BOOT] continuing without schema validation...');
      }
    }
    
    // Step 5: Start the main application system (jobs/scheduler)
    console.log('[BOOT] jobs_start attempt');
    try {
      // Import and start the job manager directly
      const { JobManager } = await import('./jobs/jobManager');
      const jobManager = JobManager.getInstance();
      
      await jobManager.startJobs();
      
      console.log('[BOOT] jobs_started ok');
      bootState.jobsOk = true;
      
    } catch (jobError: any) {
      console.error('[BOOT] ⚠️ jobs_start error:', jobError.message);
      console.error('[BOOT] stack:', jobError.stack);
      console.error('[BOOT] continuing with server only (no jobs)...');
      bootState.degraded = true;
      bootState.lastError = `Job manager failed: ${jobError.message}`;
      bootState.jobsOk = false;
    }
    
    // Step 6: Start self-healing recovery job
    if (bootState.dbOk) {
      console.log('[BOOT] recovery_job_start attempt');
      try {
        const { startPostingRecoveryJob } = await import('./jobs/postingRecoveryJob');
        startPostingRecoveryJob();
        console.log('[BOOT] recovery_job_started ok');
        bootState.recoveryOk = true;
      } catch (recoveryError: any) {
        console.error('[BOOT] ⚠️ recovery_job_start error:', recoveryError.message);
        bootState.recoveryOk = false;
        // Non-critical - don't mark as degraded
      }
    } else {
      console.log('[BOOT] ⚠️ recovery_job_skipped (db not ok)');
      bootState.recoveryOk = false;
    }
    
    // Step 7: Start truth invariant checker
    if (bootState.dbOk) {
      console.log('[BOOT] invariant_check_start attempt');
      try {
        const { startTruthInvariantCheck } = await import('./jobs/truthInvariantCheck');
        startTruthInvariantCheck();
        console.log('[BOOT] invariant_check_started ok');
        bootState.invariantCheckOk = true;
      } catch (invariantError: any) {
        console.error('[BOOT] ⚠️ invariant_check_start error:', invariantError.message);
        bootState.invariantCheckOk = false;
        // Non-critical - don't mark as degraded
      }
    } else {
      console.log('[BOOT] ⚠️ invariant_check_skipped (db not ok)');
      bootState.invariantCheckOk = false;
    }
    
    // Step 8: Determine final readiness state
    if (bootState.envOk && bootState.dbOk && bootState.jobsOk) {
      bootState.ready = true;
      console.log('[BOOT] ✅ system_ready (all critical systems operational)');
    } else {
      console.log('[BOOT] ⚠️ system_degraded (some systems failed but jobs running)');
      bootState.degraded = true;
    }
    
    console.log('[BOOT] ✅ background_init complete');
    console.log(`[BOOT] final_state: ready=${bootState.ready} degraded=${bootState.degraded} envOk=${bootState.envOk} dbOk=${bootState.dbOk} jobsOk=${bootState.jobsOk} recoveryOk=${bootState.recoveryOk} invariantCheckOk=${bootState.invariantCheckOk}`);
    
  } catch (error: any) {
    console.error('[BOOT] ❌ background_init fatal error:', error.message);
    console.error('[BOOT] stack:', error.stack);
    console.error('[BOOT] server stays alive in minimal mode (healthcheck only)');
    bootState.degraded = true;
    bootState.lastError = `Fatal init error: ${error.message}`;
    // DO NOT exit - server continues to respond to healthcheck
  }
});

/**
 * 💓 HEARTBEAT - Log system health every 60 seconds
 */
setInterval(() => {
  bootState.lastHeartbeatAt = Date.now();
  const uptimeMin = Math.floor(process.uptime() / 60);
  
  console.log(
    `[HEARTBEAT] ready=${bootState.ready} degraded=${bootState.degraded} ` +
    `envOk=${bootState.envOk} dbOk=${bootState.dbOk} jobsOk=${bootState.jobsOk} ` +
    `recoveryOk=${bootState.recoveryOk} invariantCheckOk=${bootState.invariantCheckOk} ` +
    `uptime=${uptimeMin}m lastError=${bootState.lastError || 'none'}`
  );
}, 60 * 1000); // Every 60 seconds

console.log('[BOOT] entrypoint loaded, server starting...');

