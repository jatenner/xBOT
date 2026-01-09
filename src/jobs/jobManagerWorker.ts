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

/**
 * 🔒 PROBE ON BOOT: Run one-time probe if flag is set
 */
async function runProbeOnBoot(): Promise<void> {
  const supabase = getSupabaseClient();
  const gitSha = process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_SHA || 'unknown';
  const probeRunId = `probe_boot_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  
  console.log('[WORKER] 🔍 PROBE ON BOOT: Checking if probe already ran...');
  
  // Check if probe already ran in last 24 hours
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: priorProbe } = await supabase
    .from('system_events')
    .select('created_at, event_data')
    .eq('event_type', 'reply_v2_probe_boot_result')
    .gte('created_at', twentyFourHoursAgo)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (priorProbe) {
    console.log('[WORKER] ⏭️  PROBE ON BOOT: Already ran within last 24h, skipping...');
    await supabase.from('system_events').insert({
      event_type: 'reply_v2_probe_boot_skipped',
      severity: 'info',
      message: 'Probe on boot skipped: already ran within last 24h',
      event_data: {
        probe_run_id: probeRunId,
        git_sha: gitSha,
        prior_probe_at: priorProbe.created_at,
        prior_probe_result: priorProbe.event_data,
      },
      created_at: new Date().toISOString(),
    });
    return;
  }
  
  console.log('[WORKER] 🚀 PROBE ON BOOT: Starting probe...');
  
  // Log probe start
  await supabase.from('system_events').insert({
    event_type: 'reply_v2_probe_boot_started',
    severity: 'info',
    message: `Reply V2 probe on boot started: probe_run_id=${probeRunId}`,
    event_data: {
      probe_run_id: probeRunId,
      git_sha: gitSha,
      worker_started_at: new Date().toISOString(),
    },
    created_at: new Date().toISOString(),
  });
  
  // Get queue size before
  const { count: queueSizeBefore } = await supabase
    .from('reply_candidate_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'queued')
    .gt('expires_at', new Date().toISOString());
  
  let probeResult: any = {
    probe_run_id: probeRunId,
    git_sha: gitSha,
    queue_size_before: queueSizeBefore || 0,
    posted: false,
  };
  
  try {
    // Run probe (same logic as probe_scheduler_run.ts)
    const { attemptScheduledReply } = await import('./replySystemV2/tieredScheduler');
    const result = await attemptScheduledReply();
    
    probeResult.posted = result.posted;
    probeResult.candidate_tweet_id = result.candidate_tweet_id;
    probeResult.tier = result.tier;
    probeResult.reason = result.reason;
    probeResult.behind_schedule = result.behind_schedule;
    
    // If posted, get decision_id and permit_id
    if (result.posted && result.candidate_tweet_id) {
      // Find the decision_id from recent SLO events
      const { data: sloEvent } = await supabase
        .from('reply_slo_events')
        .select('decision_id, candidate_tweet_id')
        .eq('candidate_tweet_id', result.candidate_tweet_id)
        .eq('posted', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (sloEvent?.decision_id) {
        probeResult.decision_id = sloEvent.decision_id;
        
        // Find permit_id
        const { data: permit } = await supabase
          .from('post_attempts')
          .select('permit_id, actual_tweet_id')
          .eq('decision_id', sloEvent.decision_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        if (permit) {
          probeResult.permit_id = permit.permit_id;
          probeResult.posted_tweet_id = permit.actual_tweet_id;
        }
      }
    }
    
    // Get queue size after
    const { count: queueSizeAfter } = await supabase
      .from('reply_candidate_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'queued')
      .gt('expires_at', new Date().toISOString());
    
    probeResult.queue_size_after = queueSizeAfter || 0;
    
    console.log(`[WORKER] ✅ PROBE ON BOOT: Completed - posted=${result.posted} reason=${result.reason}`);
    
  } catch (error: any) {
    console.error('[WORKER] ❌ PROBE ON BOOT: Failed:', error.message);
    console.error('[WORKER] Stack:', error.stack);
    
    probeResult.posted = false;
    probeResult.failure_reason = error.message;
    probeResult.stack_trace = error.stack?.substring(0, 1000);
  }
  
  // Log probe result
  await supabase.from('system_events').insert({
    event_type: 'reply_v2_probe_boot_result',
    severity: probeResult.posted ? 'info' : 'warning',
    message: `Reply V2 probe on boot result: posted=${probeResult.posted} reason=${probeResult.reason || probeResult.failure_reason || 'N/A'}`,
    event_data: probeResult,
    created_at: new Date().toISOString(),
  });
  
  console.log('[WORKER] ✅ PROBE ON BOOT: Result logged');
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
  console.log(`RUN_REPLY_V2_PROBE_ON_BOOT: ${process.env.RUN_REPLY_V2_PROBE_ON_BOOT || 'NOT SET'}`);
  console.log(`MODE: ${process.env.MODE || 'NOT SET'}`);
  console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? 'SET (' + process.env.DATABASE_URL.substring(0, 20) + '...)' : 'NOT SET'}\n`);
  
  // Step 1: Probe database connectivity (fail fast if unreachable)
  await probeDatabase();
  
  // 🔒 PROBE ON BOOT: Run one-time probe if flag is set
  if (process.env.RUN_REPLY_V2_PROBE_ON_BOOT === 'true') {
    await runProbeOnBoot();
  }
  
  try {
    // Step 2: Import and start job manager (this will start watchdog + boot heartbeat)
    const { JobManager } = await import('./jobManager');
    const jobManager = JobManager.getInstance();
    
    console.log('[WORKER] 🕒 Calling jobManager.startJobs()...');
    console.log('[WORKER] 🕒 This will start: jobs + watchdog + boot heartbeat');
    
    await jobManager.startJobs();
    
    console.log('[WORKER] ✅ Job Manager started successfully');
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

