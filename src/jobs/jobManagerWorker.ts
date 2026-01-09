/**
 * 🔧 RAILWAY WORKER SERVICE
 * Dedicated worker process that ONLY runs jobManager
 * Worker-first architecture for reliable job scheduling
 */

import 'dotenv/config';
import { getSupabaseClient } from '../db/index';

async function probeDatabase(): Promise<void> {
  console.log('[WORKER] 🔍 Probing database connectivity...');
  const supabase = getSupabaseClient();
  
  try {
    // Attempt simple INSERT to verify DB connectivity
    const testEvent = {
      event_type: 'worker_db_probe',
      severity: 'info',
      message: 'Worker DB connectivity probe',
      event_data: {
        worker_started_at: new Date().toISOString(),
        git_sha: process.env.RAILWAY_GIT_COMMIT_SHA || 'unknown',
      },
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('system_events').insert(testEvent);
    
    if (error) {
      console.error('[WORKER] ❌ Database probe FAILED:');
      console.error(`  Error Code: ${error.code || 'UNKNOWN'}`);
      console.error(`  Error Message: ${error.message}`);
      console.error(`  Error Details: ${JSON.stringify(error)}`);
      
      // Check for specific error types
      if (error.message?.includes('SSL') || error.message?.includes('certificate')) {
        console.error('[WORKER] ❌ SSL/Certificate error detected');
      }
      if (error.message?.includes('ECONNREFUSED') || error.message?.includes('connection')) {
        console.error('[WORKER] ❌ Connection refused - database unreachable');
      }
      if (error.message?.includes('timeout')) {
        console.error('[WORKER] ❌ Connection timeout');
      }
      
      console.error('[WORKER] 💀 FAILING FAST - Database unreachable');
      process.exit(1);
    }
    
    console.log('[WORKER] ✅ Database connectivity verified');
  } catch (error: any) {
    console.error('[WORKER] ❌ Database probe exception:');
    console.error(`  Error: ${error.message}`);
    console.error(`  Stack: ${error.stack}`);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('[WORKER] ❌ Connection refused - check DATABASE_URL');
    } else if (error.code === 'ENOTFOUND') {
      console.error('[WORKER] ❌ DNS resolution failed - check DATABASE_URL hostname');
    } else if (error.message?.includes('SSL')) {
      console.error('[WORKER] ❌ SSL error - check certificate configuration');
    }
    
    console.error('[WORKER] 💀 FAILING FAST - Database unreachable');
    process.exit(1);
  }
}

async function startWorker() {
  console.log('========================================');
  console.log('RAILWAY WORKER: Starting Job Manager');
  console.log('========================================\n');
  
  // Boot logging: Railway environment info
  console.log('RAILWAY BOOT INFO:');
  console.log(`RAILWAY_GIT_COMMIT_SHA: ${process.env.RAILWAY_GIT_COMMIT_SHA || 'NOT SET'}`);
  console.log(`RAILWAY_ENVIRONMENT_NAME: ${process.env.RAILWAY_ENVIRONMENT_NAME || 'NOT SET'}`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV || 'NOT SET'}`);
  console.log(`JOBS_AUTOSTART env var: "${process.env.JOBS_AUTOSTART || 'NOT SET'}"`);
  const computedJobsAutostart = process.env.JOBS_AUTOSTART === 'false' 
    ? false 
    : (process.env.JOBS_AUTOSTART === 'true' || process.env.RAILWAY_ENVIRONMENT_NAME === 'production');
  console.log(`Computed JOBS_AUTOSTART: ${computedJobsAutostart}`);
  console.log(`MODE: ${process.env.MODE || 'NOT SET'}`);
  console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? 'SET (' + process.env.DATABASE_URL.substring(0, 20) + '...)' : 'NOT SET'}\n`);
  
  // Step 1: Probe database connectivity (fail fast if unreachable)
  await probeDatabase();
  
  try {
    // Step 2: Import and start job manager (this will start watchdog + boot heartbeat)
    const { JobManager } = await import('./jobManager');
    const jobManager = JobManager.getInstance();
    
    console.log('[WORKER] 🕒 Calling jobManager.startJobs()...');
    console.log('[WORKER] 🕒 This will start: jobs + watchdog + boot heartbeat');
    
    await jobManager.startJobs();
    
    console.log('[WORKER] ✅ Job Manager started successfully');
    
    // 🔥 GUARANTEE: Immediately run reply_v2_fetch once to ensure it works
    // This is a non-posting dry run - only fetch/evaluate/queue, no posting
    console.log('[WORKER] 🔥 GUARANTEE: Running initial reply_v2_fetch to verify it works...');
    console.log('[WORKER] 🔥 This will fetch/evaluate/queue candidates (no posting)');
    
    // Run initial fetch in background (non-blocking) so worker startup completes
    setImmediate(async () => {
      try {
        console.log('[WORKER] 🔥 Initial fetch: Importing orchestrator...');
        const { runFullCycle } = await import('./replySystemV2/orchestrator');
        console.log('[WORKER] 🔥 Initial fetch: Orchestrator imported, calling runFullCycle...');
        
        const startTime = Date.now();
        await runFullCycle();
        const duration = Date.now() - startTime;
        
        console.log(`[WORKER] ✅ Initial reply_v2_fetch completed successfully (${duration}ms)`);
        
        // Log to system_events for proof
        const supabase = getSupabaseClient();
        const { error: logError } = await supabase.from('system_events').insert({
          event_type: 'worker_initial_fetch_completed',
          severity: 'info',
          message: `Worker initial reply_v2_fetch completed successfully (${duration}ms)`,
          event_data: {
            worker_started_at: new Date().toISOString(),
            git_sha: process.env.RAILWAY_GIT_COMMIT_SHA || 'unknown',
            duration_ms: duration,
          },
          created_at: new Date().toISOString(),
        });
        
        if (logError) {
          console.error('[WORKER] ⚠️ Failed to log initial fetch completion:', logError.message);
        }
      } catch (error: any) {
        console.error('[WORKER] ❌ Initial reply_v2_fetch failed:', error.message);
        console.error('[WORKER] Error type:', error.constructor.name);
        console.error('[WORKER] Stack:', error.stack);
        
        // Log error to system_events
        try {
          const supabase = getSupabaseClient();
          await supabase.from('system_events').insert({
            event_type: 'worker_initial_fetch_failed',
            severity: 'error',
            message: `Worker initial reply_v2_fetch failed: ${error.message}`,
            event_data: {
              error: error.message,
              error_type: error.constructor.name,
              stack: error.stack?.substring(0, 1000),
              git_sha: process.env.RAILWAY_GIT_COMMIT_SHA || 'unknown',
            },
            created_at: new Date().toISOString(),
          });
        } catch (logError: any) {
          console.error('[WORKER] ❌ Failed to log initial fetch error:', logError.message);
        }
      }
    });
    
    console.log('[WORKER] 🕒 Jobs are now running. Worker will stay alive to keep jobs active.');
    console.log('[WORKER] 📊 Watchdog will write reports every 5 minutes');
    
    // Step 3: Keep process alive
    process.on('SIGTERM', () => {
      console.log('[WORKER] 🕒 SIGTERM received, shutting down gracefully...');
      process.exit(0);
    });
    
    process.on('SIGINT', () => {
      console.log('[WORKER] 🕒 SIGINT received, shutting down gracefully...');
      process.exit(0);
    });
    
    // Keep alive heartbeat
    let heartbeatCount = 0;
    setInterval(() => {
      heartbeatCount++;
      if (heartbeatCount % 5 === 0) {
        console.log(`[WORKER] 💓 Worker alive (${heartbeatCount} minutes)`);
      }
    }, 60000);
    
    console.log('[WORKER] ✅ Worker started successfully and keeping process alive');
    
  } catch (error: any) {
    console.error('[WORKER] ❌ Failed to start job manager:', error.message);
    console.error('[WORKER] Stack:', error.stack);
    
    // Write error to system_events if possible
    try {
      const supabase = getSupabaseClient();
      await supabase.from('system_events').insert({
        event_type: 'worker_startup_failed',
        severity: 'critical',
        message: `Worker failed to start: ${error.message}`,
        event_data: { error: error.message, stack: error.stack },
        created_at: new Date().toISOString(),
      });
    } catch (logError) {
      // Ignore logging errors
    }
    
    process.exit(1);
  }
}

startWorker().catch((error) => {
  console.error('[WORKER] ❌ Fatal error:', error);
  process.exit(1);
});

