#!/usr/bin/env tsx
/**
 * 🏃 MAC RUNNER DAEMON
 * 
 * Long-running daemon that:
 * - Ensures CDP is reachable
 * - Checks session validity
 * - Runs pipeline jobs (schedule-and-post)
 * - Writes heartbeats
 * - Sleeps with jitter and retry with exponential backoff
 * - Fail-closed if session invalid or CDP missing
 */

import fs from 'fs';
import path from 'path';

// Load .env.local first
const envLocalPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  require('dotenv').config({ path: envLocalPath });
} else {
  require('dotenv').config();
}

// Set runner mode
process.env.RUNNER_MODE = 'true';
if (!process.env.RUNNER_PROFILE_DIR) {
  process.env.RUNNER_PROFILE_DIR = path.join(process.cwd(), '.runner-profile');
}
if (!process.env.RUNNER_BROWSER) {
  process.env.RUNNER_BROWSER = 'cdp';
}

const CDP_PORT = parseInt(process.env.CDP_PORT || '9222', 10);
const DAEMON_SLEEP_SECONDS = parseInt(process.env.DAEMON_SLEEP_SECONDS || '60', 10);
const DAEMON_MAX_SLEEP = parseInt(process.env.DAEMON_MAX_SLEEP || '300', 10); // 5 min max
const NO_ACTIVITY_ALERT_HOURS = parseInt(process.env.NO_ACTIVITY_ALERT_HOURS || '6', 10);

let consecutiveFailures = 0;
let lastHeartbeat = new Date();
let lastPostSuccess: Date | null = null;
let lastPlanExecution: Date | null = null;

/**
 * Check if CDP is reachable
 */
async function checkCDP(): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Record heartbeat to database
 */
async function recordHeartbeat(status: 'OK' | 'CDP_DOWN' | 'SESSION_INVALID' | 'ERROR', details?: string): Promise<void> {
  try {
    const { getSupabaseClient } = await import('../../src/db');
    const supabase = getSupabaseClient();
    
    // Write to system_events
    await supabase.from('system_events').insert({
      event_type: 'RUNNER_DAEMON_HEARTBEAT',
      event_data: {
        status,
        details,
        timestamp: new Date().toISOString(),
      },
    });
    
    // Also update job_heartbeats if table exists
    try {
      const isSuccess = status === 'OK';
      await supabase.from('job_heartbeats').upsert({
        job_name: 'runner_daemon',
        last_success: isSuccess ? new Date().toISOString() : null,
        last_failure: !isSuccess ? new Date().toISOString() : null,
        last_run_status: status.toLowerCase(),
        last_error: !isSuccess ? details || null : null,
        consecutive_failures: !isSuccess ? (consecutiveFailures || 0) : 0,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'job_name',
      });
    } catch (err: any) {
      // Table might not exist, ignore
      if (!err.message?.includes('does not exist')) {
        console.warn(`[DAEMON] ⚠️  Could not update job_heartbeats: ${err.message}`);
      }
    }
    
    lastHeartbeat = new Date();
    console.log(`[DAEMON] 💓 Heartbeat recorded: ${status}${details ? ` (${details})` : ''}`);
  } catch (err: any) {
    console.error(`[DAEMON] ❌ Failed to record heartbeat: ${err.message}`);
  }
}

/**
 * Check for no activity and emit alert if needed
 */
async function checkActivityWatchdog(): Promise<void> {
  const now = new Date();
  const hoursSinceLastPost = lastPostSuccess 
    ? (now.getTime() - lastPostSuccess.getTime()) / (1000 * 60 * 60)
    : Infinity;
  
  const hoursSinceLastPlan = lastPlanExecution
    ? (now.getTime() - lastPlanExecution.getTime()) / (1000 * 60 * 60)
    : Infinity;
  
  const maxHoursSinceActivity = Math.max(hoursSinceLastPost, hoursSinceLastPlan);
  
  if (maxHoursSinceActivity >= NO_ACTIVITY_ALERT_HOURS) {
    const alertMessage = `NO_ACTIVITY_FOR_${Math.floor(maxHoursSinceActivity)}_HOURS`;
    console.error(`\n⚠️  ⚠️  ⚠️  ALERT: ${alertMessage} ⚠️  ⚠️  ⚠️`);
    console.error(`   Last POST_SUCCESS: ${lastPostSuccess ? lastPostSuccess.toISOString() : 'never'}`);
    console.error(`   Last plan execution: ${lastPlanExecution ? lastPlanExecution.toISOString() : 'never'}`);
    console.error(`   Threshold: ${NO_ACTIVITY_ALERT_HOURS} hours\n`);
    
    try {
      const { getSupabaseClient } = await import('../../src/db');
      const supabase = getSupabaseClient();
      
      await supabase.from('system_events').insert({
        event_type: 'ALERT_NO_ACTIVITY',
        event_data: {
          hours_since_post: lastPostSuccess ? hoursSinceLastPost : null,
          hours_since_plan: lastPlanExecution ? hoursSinceLastPlan : null,
          threshold_hours: NO_ACTIVITY_ALERT_HOURS,
          timestamp: now.toISOString(),
        },
      });
    } catch (err: any) {
      console.error(`[DAEMON] ❌ Failed to record alert: ${err.message}`);
    }
  }
}

/**
 * Update last activity timestamps from recent events
 */
async function updateActivityTimestamps(): Promise<void> {
  try {
    const { getSupabaseClient } = await import('../../src/db');
    const supabase = getSupabaseClient();
    
    // Check for recent POST_SUCCESS
    const { data: postSuccess } = await supabase
      .from('system_events')
      .select('created_at')
      .eq('event_type', 'POST_SUCCESS')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (postSuccess?.created_at) {
      lastPostSuccess = new Date(postSuccess.created_at);
    }
    
    // Check for recent plan execution (growth_execution updates)
    const { data: execution } = await supabase
      .from('growth_execution')
      .select('last_updated')
      .order('last_updated', { ascending: false })
      .limit(1)
      .single();
    
    if (execution?.last_updated) {
      lastPlanExecution = new Date(execution.last_updated);
    }
  } catch (err: any) {
    // Ignore errors, just use existing timestamps
  }
}

/**
 * Sleep with exponential backoff and jitter
 */
function sleep(seconds: number): Promise<void> {
  const jitter = Math.random() * 0.2 * seconds; // ±20% jitter
  const sleepTime = Math.min(seconds + jitter, DAEMON_MAX_SLEEP);
  return new Promise(resolve => setTimeout(resolve, sleepTime * 1000));
}

/**
 * Main daemon loop
 */
async function runDaemon() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🏃 xBOT MAC RUNNER DAEMON');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log(`📋 Configuration:`);
  console.log(`   CDP Port: ${CDP_PORT}`);
  console.log(`   Sleep: ${DAEMON_SLEEP_SECONDS}s (max: ${DAEMON_MAX_SLEEP}s)`);
  console.log(`   Activity Alert: ${NO_ACTIVITY_ALERT_HOURS}h`);
  console.log(`   Profile Dir: ${process.env.RUNNER_PROFILE_DIR}`);
  console.log('');
  
  // Record initial heartbeat
  await recordHeartbeat('OK', 'Daemon started');
  
  while (true) {
    try {
      // 1. Check CDP is reachable
      const cdpRunning = await checkCDP();
      if (!cdpRunning) {
        console.error(`[DAEMON] ❌ CDP not reachable on port ${CDP_PORT}`);
        await recordHeartbeat('CDP_DOWN', `CDP not reachable on port ${CDP_PORT}`);
        consecutiveFailures++;
        await sleep(DAEMON_SLEEP_SECONDS * Math.min(consecutiveFailures, 3));
        continue;
      }
      
      // 2. Check session
      console.log(`[DAEMON] 🔐 Checking session...`);
      const { checkSession } = await import('./session-check');
      const sessionResult = await checkSession();
      
      if (sessionResult.status !== 'SESSION_OK') {
        console.error(`[DAEMON] ❌ Session invalid: ${sessionResult.reason}`);
        await recordHeartbeat('SESSION_INVALID', sessionResult.reason);
        consecutiveFailures++;
        await sleep(DAEMON_SLEEP_SECONDS * Math.min(consecutiveFailures, 3));
        continue;
      }
      
      // 3. Reset failure counter on success
      if (consecutiveFailures > 0) {
        console.log(`[DAEMON] ✅ Recovered after ${consecutiveFailures} failures`);
        consecutiveFailures = 0;
      }
      
      // 4. Run pipeline (schedule-and-post in one-shot mode)
      console.log(`[DAEMON] 🎯 Running pipeline...`);
      try {
        const { execSync } = require('child_process');
        execSync('pnpm run runner:schedule-once', {
          stdio: 'inherit',
          cwd: process.cwd(),
          env: {
            ...process.env,
            RUNNER_MODE: 'true',
            RUNNER_BROWSER: 'cdp',
          },
        });
        console.log(`[DAEMON] ✅ Pipeline completed successfully`);
        await recordHeartbeat('OK', 'Pipeline completed');
      } catch (pipelineError: any) {
        console.error(`[DAEMON] ⚠️  Pipeline error: ${pipelineError.message}`);
        await recordHeartbeat('ERROR', `Pipeline error: ${pipelineError.message}`);
        consecutiveFailures++;
      }
      
      // 5. Update activity timestamps
      await updateActivityTimestamps();
      
      // 6. Check watchdog
      await checkActivityWatchdog();
      
      // 7. Sleep with backoff
      const sleepSeconds = DAEMON_SLEEP_SECONDS * (1 + consecutiveFailures * 0.5);
      console.log(`[DAEMON] 💤 Sleeping ${sleepSeconds.toFixed(1)}s...\n`);
      await sleep(sleepSeconds);
      
    } catch (err: any) {
      console.error(`[DAEMON] ❌ Unexpected error: ${err.message}`);
      if (err.stack) {
        console.error(err.stack);
      }
      await recordHeartbeat('ERROR', `Unexpected error: ${err.message}`);
      consecutiveFailures++;
      await sleep(DAEMON_SLEEP_SECONDS * Math.min(consecutiveFailures, 5));
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[DAEMON] 👋 Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[DAEMON] 👋 Shutting down gracefully...');
  process.exit(0);
});

// Start daemon
runDaemon().catch(err => {
  console.error('[DAEMON] ❌ Fatal error:', err);
  process.exit(1);
});
