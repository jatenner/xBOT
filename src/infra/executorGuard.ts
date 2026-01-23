/**
 * 🛡️ EXECUTOR GUARD SYSTEM
 * Prevents runaway Chrome/CDP loops and tab leaks
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const RUNNER_PROFILE_DIR = process.env.RUNNER_PROFILE_DIR || './.runner-profile';
const STOP_SWITCH_PATH = path.join(RUNNER_PROFILE_DIR, 'STOP_EXECUTOR');
const PIDFILE_PATH = path.join(RUNNER_PROFILE_DIR, 'executor.pid');

interface ExecutorGuardState {
  stopSwitchTriggered: boolean;
  lockTriggered: boolean;
  consecutiveFailures: number;
  backoffSeconds: number;
  lastFailureTime: number | null;
  pageCount: number;
  chromePids: number[];
}

let guardState: ExecutorGuardState = {
  stopSwitchTriggered: false,
  lockTriggered: false,
  consecutiveFailures: 0,
  backoffSeconds: 0,
  lastFailureTime: null,
  pageCount: 0,
  chromePids: [],
};

/**
 * Check STOP switch - exit immediately if exists
 */
export function checkStopSwitch(): void {
  if (fs.existsSync(STOP_SWITCH_PATH)) {
    console.error('[EXECUTOR_GUARD] 🛑 STOP SWITCH TRIGGERED: ./.runner-profile/STOP_EXECUTOR exists');
    console.error('[EXECUTOR_GUARD] 🛑 Exiting immediately before launching Chrome');
    process.exit(0);
  }
}

/**
 * Check single-instance lock - exit if another executor is running
 */
export function checkSingleInstanceLock(): void {
  // Ensure profile dir exists
  if (!fs.existsSync(RUNNER_PROFILE_DIR)) {
    fs.mkdirSync(RUNNER_PROFILE_DIR, { recursive: true });
  }

  // Check if pidfile exists
  if (fs.existsSync(PIDFILE_PATH)) {
    try {
      const pidfileContent = fs.readFileSync(PIDFILE_PATH, 'utf-8').trim();
      const [pidStr, startTimeStr] = pidfileContent.split(':');
      const pid = parseInt(pidStr, 10);
      const startTime = parseInt(startTimeStr, 10);

      // Check if process is still alive
      try {
        // Use ps to check if process exists (works on Mac/Linux)
        execSync(`ps -p ${pid} > /dev/null 2>&1`, { encoding: 'utf-8' });
        
        // Process is alive - another executor is running
        const ageMinutes = Math.floor((Date.now() - startTime) / 60000);
        console.error(`[EXECUTOR_GUARD] 🔒 LOCK TRIGGERED: Another executor is running (PID: ${pid}, started ${ageMinutes}m ago)`);
        console.error(`[EXECUTOR_GUARD] 🔒 Exiting to prevent duplicate execution`);
        guardState.lockTriggered = true;
        process.exit(0);
      } catch {
        // Process is dead - stale lock file, remove it
        console.warn(`[EXECUTOR_GUARD] ⚠️  Stale lock file detected (PID ${pid} not running), removing`);
        fs.unlinkSync(PIDFILE_PATH);
      }
    } catch (error: any) {
      console.warn(`[EXECUTOR_GUARD] ⚠️  Failed to read lock file: ${error.message}`);
      // Remove corrupted lock file
      try {
        fs.unlinkSync(PIDFILE_PATH);
      } catch {}
    }
  }

  // Create lock file
  const pid = process.pid;
  const startTime = Date.now();
  fs.writeFileSync(PIDFILE_PATH, `${pid}:${startTime}`, 'utf-8');
  console.log(`[EXECUTOR_GUARD] 🔒 Lock acquired (PID: ${pid})`);
}

/**
 * Clean up lock file on exit
 */
export function cleanupLock(): void {
  try {
    if (fs.existsSync(PIDFILE_PATH)) {
      fs.unlinkSync(PIDFILE_PATH);
      console.log('[EXECUTOR_GUARD] 🔓 Lock released');
    }
  } catch (error: any) {
    console.warn(`[EXECUTOR_GUARD] ⚠️  Failed to cleanup lock: ${error.message}`);
  }
}

/**
 * Get Chrome PIDs (Mac-specific)
 */
function getChromePids(): number[] {
  try {
    const output = execSync('ps aux | grep -i "Google Chrome" | grep -v grep | awk \'{print $2}\'', { encoding: 'utf-8' });
    return output
      .trim()
      .split('\n')
      .filter(line => line.trim())
      .map(pid => parseInt(pid, 10))
      .filter(pid => !isNaN(pid));
  } catch {
    return [];
  }
}

/**
 * Get page count from browser context
 */
export async function getPageCount(context: any): Promise<number> {
  try {
    if (!context) return 0;
    const pages = context.pages ? context.pages() : [];
    return pages.length;
  } catch {
    return 0;
  }
}

/**
 * Close extra pages - keep only 1
 */
export async function closeExtraPages(context: any): Promise<void> {
  try {
    if (!context) return;
    const pages = context.pages ? context.pages() : [];
    
    if (pages.length > 1) {
      console.warn(`[EXECUTOR_GUARD] 🧹 Closing ${pages.length - 1} extra page(s) (keeping 1)`);
      
      // Close all except the first one
      for (let i = 1; i < pages.length; i++) {
        try {
          await pages[i].close();
          console.log(`[EXECUTOR_GUARD] ✅ Closed page ${i + 1}/${pages.length}`);
        } catch (error: any) {
          console.warn(`[EXECUTOR_GUARD] ⚠️  Failed to close page ${i + 1}: ${error.message}`);
        }
      }
    }
  } catch (error: any) {
    console.warn(`[EXECUTOR_GUARD] ⚠️  Failed to close extra pages: ${error.message}`);
  }
}

/**
 * Record failure and calculate backoff
 */
export function recordFailure(): void {
  guardState.consecutiveFailures++;
  guardState.lastFailureTime = Date.now();
  
  // Exponential backoff: 30s → 60s → 2m → 5m → 10m max
  const backoffSchedule = [30, 60, 120, 300, 600]; // seconds
  const failureIndex = Math.min(guardState.consecutiveFailures - 1, backoffSchedule.length - 1);
  guardState.backoffSeconds = backoffSchedule[failureIndex];
  
  console.warn(`[EXECUTOR_GUARD] ⚠️  Failure recorded (consecutive: ${guardState.consecutiveFailures}, backoff: ${guardState.backoffSeconds}s)`);
  
  // After 5 consecutive failures, emit cooldown event
  if (guardState.consecutiveFailures >= 5) {
    console.error(`[EXECUTOR_GUARD] 🚨 EXECUTOR_COOLDOWN: 5+ consecutive failures, sleeping ${guardState.backoffSeconds}s`);
    // Emit to system_events if available
    try {
      const { getSupabaseClient } = require('../../db/index');
      const supabase = getSupabaseClient();
      supabase.from('system_events').insert({
        event_type: 'EXECUTOR_COOLDOWN',
        severity: 'warning',
        message: `Executor cooldown: ${guardState.consecutiveFailures} consecutive failures`,
        event_data: {
          consecutive_failures: guardState.consecutiveFailures,
          backoff_seconds: guardState.backoffSeconds,
        },
        created_at: new Date().toISOString(),
      }).catch(() => {}); // Non-critical
    } catch {}
  }
}

/**
 * Record success - reset failure counter
 */
export function recordSuccess(): void {
  if (guardState.consecutiveFailures > 0) {
    console.log(`[EXECUTOR_GUARD] ✅ Success recorded (reset failure counter from ${guardState.consecutiveFailures})`);
  }
  guardState.consecutiveFailures = 0;
  guardState.backoffSeconds = 0;
  guardState.lastFailureTime = null;
}

/**
 * Apply backoff if needed
 */
export async function applyBackoff(): Promise<void> {
  if (guardState.backoffSeconds > 0 && guardState.lastFailureTime) {
    const timeSinceFailure = (Date.now() - guardState.lastFailureTime) / 1000;
    if (timeSinceFailure < guardState.backoffSeconds) {
      const remainingSeconds = Math.ceil(guardState.backoffSeconds - timeSinceFailure);
      console.log(`[EXECUTOR_GUARD] ⏸️  Backoff active: waiting ${remainingSeconds}s (${guardState.consecutiveFailures} failures)`);
      await new Promise(resolve => setTimeout(resolve, remainingSeconds * 1000));
    }
  }
}

/**
 * Log guard state
 */
export async function logGuardState(context?: any): Promise<void> {
  guardState.pageCount = context ? await getPageCount(context) : 0;
  guardState.chromePids = getChromePids();
  
  const chromePidsStr = guardState.chromePids.length > 0 
    ? guardState.chromePids.join(',') 
    : 'none';
  
  console.log(
    `[EXECUTOR_GUARD] pages=${guardState.pageCount} ` +
    `chrome_pids=${chromePidsStr} ` +
    `failures=${guardState.consecutiveFailures} ` +
    `backoff=${guardState.backoffSeconds}s ` +
    `stop=${guardState.stopSwitchTriggered ? 'YES' : 'NO'} ` +
    `lock=${guardState.lockTriggered ? 'YES' : 'NO'}`
  );
}

/**
 * Initialize guard - check stop switch and lock
 */
export function initializeGuard(): void {
  checkStopSwitch();
  checkSingleInstanceLock();
  
  // Cleanup on exit
  process.on('exit', cleanupLock);
  process.on('SIGINT', () => {
    cleanupLock();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    cleanupLock();
    process.exit(0);
  });
  
  console.log('[EXECUTOR_GUARD] ✅ Guard initialized');
}

/**
 * Get guard state (for external monitoring)
 */
export function getGuardState(): ExecutorGuardState {
  return { ...guardState };
}
