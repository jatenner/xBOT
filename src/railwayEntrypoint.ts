/**
 * 🚀 RAILWAY ENTRYPOINT - Fail-open healthcheck + background init
 */

import express from 'express';
import { getJobHeartbeats, getStalledJobs } from './jobs/jobHeartbeatRegistry';
import { sendDiscordAlert, alertOnStateTransition } from './monitoring/discordAlerts';
import { requireAdminToken, triggerPostingQueue, triggerReplyJob, triggerPlanJob, triggerHarvester } from './server/adminEndpoints';

// Get build info from env or fallback
const buildSha = process.env.GIT_SHA || 
                 process.env.RAILWAY_GIT_COMMIT_SHA || 
                 process.env.RAILWAY_GIT_BRANCH || 
                 `local-${Date.now()}`;
const version = process.env.npm_package_version || '1.0.0';

interface BootState {
  ready: boolean;
  degraded: boolean;
  envOk: boolean;
  dbOk: boolean;
  jobsOk: boolean;
  stalled: boolean;
  stalledJobs: string[];
  lastError: string | null;
  startedAt: Date;
  buildSha: string;
  version: string;
}

const bootState: BootState = {
  ready: false,
  degraded: false,
  envOk: false,
  dbOk: false,
  jobsOk: false,
  stalled: false,
  stalledJobs: [],
  lastError: null,
  startedAt: new Date(),
  buildSha,
  version,
};

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '0.0.0.0';

// Parse JSON bodies for admin endpoints
app.use(express.json());

// 🔒 ADMIN ENDPOINTS - Manual job triggers (protected)
app.post('/admin/run/postingQueue', requireAdminToken, triggerPostingQueue);
app.post('/admin/run/replyJob', requireAdminToken, triggerReplyJob);
app.post('/admin/run/planJob', requireAdminToken, triggerPlanJob);
app.post('/admin/run/harvester', requireAdminToken, triggerHarvester);

// Instant /status route - NO slow operations
app.get('/status', (req, res) => {
  const jobHeartbeats = getJobHeartbeats();
  
  res.json({
    ok: true,
    ready: bootState.ready,
    degraded: bootState.degraded,
    stalled: bootState.stalled,
    stalledJobs: bootState.stalledJobs,
    env: bootState.envOk,
    db: bootState.dbOk,
    jobs: bootState.jobsOk,
    buildSha: bootState.buildSha,
    version: bootState.version,
    uptime: Date.now() - bootState.startedAt.getTime(),
    timestamp: new Date().toISOString(),
    heartbeats: jobHeartbeats,
    jobStatuses: Object.entries(jobHeartbeats).reduce((acc, [name, hb]) => {
      acc[name] = hb.lastError === null;
      return acc;
    }, {} as Record<string, boolean>),
  });
});

// 🎯 /status/reply - Detailed reply metrics endpoint
app.get('/status/reply', async (req, res) => {              
  try {
    const { getSystemStatus } = await import('./api/status');                   
    const fullStatus = await getSystemStatus();             
    
    res.json({
      ok: true,
      timestamp: new Date().toISOString(),                  
      reply_metrics: fullStatus.reply_metrics,              
      posting: fullStatus.posting,      
      memory: fullStatus.memory,        
    });
  } catch (error: any) {                
    res.status(500).json({              
      ok: false,
      error: error.message,             
    });
  }
});

// 🎯 CANDIDATE INSPECTION ENDPOINT
app.get('/status/reply/candidates', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const { pgPool } = await import('./db/pg');
    
    const result = await pgPool.query(`
      SELECT 
        target_tweet_id,
        target_username,
        target_tweet_content,
        like_count,
        view_count,
        EXTRACT(EPOCH FROM (NOW() - tweet_posted_at))/60 as age_minutes,
        like_count / GREATEST(EXTRACT(EPOCH FROM (NOW() - tweet_posted_at))/60, 10) as velocity,
        tier,
        harvest_tier,
        target_quality_score,
        target_quality_tier,
        opportunity_score,
        harvest_source,
        harvest_source_detail,
        tweet_posted_at
      FROM reply_opportunities
      WHERE replied_to = false
        AND (expires_at IS NULL OR expires_at > NOW())
        AND (target_quality_score IS NULL OR target_quality_score >= 70)
      ORDER BY 
        COALESCE(view_count, 0) DESC,
        like_count DESC,
        opportunity_score DESC
      LIMIT $1
    `, [limit]);
    
    const candidates = result.rows.map(row => ({
      tweet_id: row.target_tweet_id,
      author: row.target_username,
      preview: (row.target_tweet_content || '').substring(0, 120) + '...',
      likes: parseInt(row.like_count || 0),
      views: row.view_count ? parseInt(row.view_count) : null,
      age_minutes: Math.round(parseFloat(row.age_minutes || 0)),
      velocity: Math.round(parseFloat(row.velocity || 0)),
      tier: row.tier || row.harvest_tier,
      quality_score: parseInt(row.target_quality_score || 0),
      quality_tier: row.target_quality_tier,
      score: Math.round(parseFloat(row.opportunity_score || 0)),
      harvest_source: row.harvest_source,
      harvest_source_detail: row.harvest_source_detail,
      posted_at: row.tweet_posted_at,
    }));
    
    res.json({
      ok: true,
      count: candidates.length,
      candidates,
    });
  } catch (error: any) {
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

// /ready route - returns 200 only when truly ready
app.get('/ready', (req, res) => {
  if (!bootState.ready) {
    return res.status(503).json({
      ready: false,
      message: 'System not ready',
      env: bootState.envOk,
      db: bootState.dbOk,
      jobs: bootState.jobsOk,
      degraded: bootState.degraded,
      lastError: bootState.lastError,
    });
  }
  
  res.json({
    ready: true,
    degraded: bootState.degraded,
    env: bootState.envOk,
    db: bootState.dbOk,
    jobs: bootState.jobsOk,
    stalled: bootState.stalled,
    stalledJobs: bootState.stalledJobs,
    buildSha: bootState.buildSha,
    version: bootState.version,
  });
});

// Start server immediately
app.listen(PORT, HOST, () => {
  console.log(`[BOOT] listening host=${HOST} port=${PORT}`);
  console.log(`[BOOT] buildSha=${buildSha} version=${version}`);
  console.log('[BOOT] /status and /ready routes active');
});

// Background initialization (NON-BLOCKING)
setImmediate(async () => {
  try {
    console.log('[BOOT] background_init start');
    
    // Step 1: Validate environment variables
    console.log('[BOOT] env_check start');
    const requiredEnvVars = ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'OPENAI_API_KEY'];
    const missingEnvVars = requiredEnvVars.filter(key => !process.env[key]);
    
    if (missingEnvVars.length > 0) {
      console.error('[BOOT] ⚠️ missing_env_vars:', missingEnvVars.join(', '));
      bootState.degraded = true;
      bootState.lastError = `Missing env vars: ${missingEnvVars.join(', ')}`;
    } else {
      console.log('[BOOT] env_check ok');
      bootState.envOk = true;
    }
    
    // Step 2: Test database connection
    console.log('[BOOT] db_check start');
    try {
      const { getSupabaseClient } = await import('./db/index');
      const supabase = getSupabaseClient();
      
      const { data, error } = await supabase
        .from('content_metadata')
        .select('decision_id')
        .limit(1);
      
      if (error) {
        console.error('[BOOT] ⚠️ db_check error:', error.message);
        bootState.degraded = true;
        bootState.lastError = `DB error: ${error.message}`;
      } else {
        console.log('[BOOT] db_check ok');
        bootState.dbOk = true;
      }
    } catch (dbError: any) {
      console.error('[BOOT] ⚠️ db_check exception:', dbError.message);
      bootState.degraded = true;
      bootState.lastError = `DB exception: ${dbError.message}`;
    }
    
    // Step 3: Check Playwright browser
    console.log('[BOOT] browser_check start');
    try {
      const { checkBrowserHealth } = await import('./browser/BrowserHealthGate');
      const browserOk = await checkBrowserHealth();
      
      if (browserOk) {
        console.log('[BOOT] browser_check ok');
      } else {
        console.warn('[BOOT] ⚠️ browser_check degraded (will retry)');
        bootState.degraded = true;
      }
    } catch (browserError: any) {
      console.error('[BOOT] ⚠️ browser_check error:', browserError.message);
      console.error('[BOOT] continuing without browser...');
      bootState.degraded = true;
    }
    
    // Step 4: Check and auto-apply reply schema columns
    if (bootState.dbOk) {
      console.log('[BOOT] schema_guard_reply start');
      try {
        const { ensureReplySchemaColumnsWithAutoApply } = await import('./db/autoMigrationGuard');
        const schemaCheck = await ensureReplySchemaColumnsWithAutoApply();
        console.log(`[SCHEMA] root_fields present=${schemaCheck.allPresent} action=${schemaCheck.action} reason=${schemaCheck.reason}`);
        
        if (!schemaCheck.allPresent) {
          console.warn('[BOOT] ⚠️ Reply schema incomplete - reply system may run in degraded mode');
          bootState.degraded = true;
        }
      } catch (schemaError: any) {
        console.error('[BOOT] ⚠️ schema_guard_reply error:', schemaError.message);
        console.error('[BOOT] continuing without schema guard...');
      }
    }
    
    // Step 5: Start the main application system (jobs/scheduler)
    console.log('[BOOT] jobs_start attempt');
    console.log(`[BOOT] JOBS_AUTOSTART env var: "${process.env.JOBS_AUTOSTART}" (type: ${typeof process.env.JOBS_AUTOSTART})`);
    console.log(`[BOOT] JOBS_AUTOSTART === 'true': ${process.env.JOBS_AUTOSTART === 'true'}`);
    try {
      // Import and start the job manager directly
      const { JobManager } = await import('./jobs/jobManager');
      const jobManager = JobManager.getInstance();
      
      console.log('[BOOT] JOB_MANAGER starting...');
      await jobManager.startJobs();
      
      console.log('[BOOT] jobs_started ok');
      bootState.jobsOk = true;
      
      // Start production watchdog
      try {
        const { getWatchdog } = await import('./jobs/productionWatchdog');
        const watchdog = getWatchdog();
        await watchdog.start();
        console.log('[BOOT] watchdog_started ok');
      } catch (watchdogError: any) {
        console.warn('[BOOT] watchdog_start failed:', watchdogError.message);
      }
      
    } catch (jobError: any) {
      console.error('[BOOT] ⚠️ jobs_start error:', jobError.message);
      console.error('[BOOT] stack:', jobError.stack);
      console.error('[BOOT] continuing with server only (no jobs)...');
      bootState.degraded = true;
      bootState.lastError = `Job manager failed: ${jobError.message}`;
      bootState.jobsOk = false;
    }
    
    // Step 6: Mark as ready
    bootState.ready = true;
    console.log('[BOOT] background_init complete');
    console.log(`[BOOT] ready=${bootState.ready} degraded=${bootState.degraded} env=${bootState.envOk} db=${bootState.dbOk} jobs=${bootState.jobsOk}`);
    
  } catch (error: any) {
    console.error('[BOOT] ❌ background_init fatal:', error.message);
    console.error('[BOOT] stack:', error.stack);
    bootState.degraded = true;
    bootState.lastError = `Init failed: ${error.message}`;
    // Still mark ready (degraded mode)
    bootState.ready = true;
  }
});

// Heartbeat logging every 60s
let lastDegradedState = bootState.degraded;

setInterval(() => {
  const stalledJobs = getStalledJobs(15); // 15 minute threshold
  const wasStalled = bootState.stalled;
  bootState.stalled = stalledJobs.length > 0;
  bootState.stalledJobs = stalledJobs;
  
  // Update degraded state if jobs are stalled
  const wasDegraded = bootState.degraded;
  if (bootState.stalled) {
    bootState.degraded = true;
  }
  
  // Alert on state transitions
  if (bootState.degraded !== lastDegradedState) {
    const message = bootState.degraded
      ? `🚨 System degraded: ${bootState.stalled ? `stalled jobs: ${stalledJobs.join(', ')}` : bootState.lastError || 'unknown'}`
      : `✅ System recovered`;
    
    alertOnStateTransition(bootState.degraded, lastDegradedState, message, bootState.degraded);
    lastDegradedState = bootState.degraded;
  }
  
  console.log(`[HEARTBEAT] ready=${bootState.ready} degraded=${bootState.degraded} stalled=${bootState.stalled} env=${bootState.envOk} db=${bootState.dbOk} jobs=${bootState.jobsOk}`);
  
  if (bootState.stalled) {
    console.error(`🚨 CRITICAL: SYSTEM STALL DETECTED`);
    console.error(`   Stalled jobs: ${stalledJobs.join(', ')}`);
    console.error(`   These jobs haven't run in >15 minutes`);
  }
}, 60 * 1000);

// Process handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('[PROCESS] unhandledRejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[PROCESS] uncaughtException:', error);
  // Don't exit - let Railway restart if needed
});

process.on('SIGTERM', () => {
  console.log('[PROCESS] SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[PROCESS] SIGINT received, shutting down gracefully...');
  process.exit(0);
});
