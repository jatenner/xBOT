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
 * Check STOP switch - exit immediately if exists (works even in hot loops)
 */
export function checkStopSwitch(): void {
  // Check file AND env var (env var works even if file system is slow)
  if (process.env.STOP_EXECUTOR === 'true' || fs.existsSync(STOP_SWITCH_PATH)) {
    console.error('[EXECUTOR_GUARD] 🛑 STOP SWITCH TRIGGERED');
    console.error('[EXECUTOR_GUARD] 🛑 STOP_EXECUTOR=true OR ./.runner-profile/STOP_EXECUTOR exists');
    console.error('[EXECUTOR_GUARD] 🛑 Exiting immediately (works even in hot loops)');
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
 * HARD CAP: If > 3 pages, exit immediately (do not retry)
 */
export async function closeExtraPages(context: any): Promise<void> {
  try {
    if (!context) return;
    const pages = context.pages ? context.pages() : [];
    
    // 🚨 HARD CAP: If > 3 pages, exit immediately (tab explosion detected)
    if (pages.length > 3) {
      console.error(`[EXECUTOR_GUARD] 🚨 TAB EXPLOSION DETECTED: ${pages.length} pages (hard cap: 3)`);
      console.error(`[EXECUTOR_GUARD] 🚨 Exiting immediately to prevent Mac freeze`);
      console.error(`[EXECUTOR_GUARD] 🚨 Stack trace:`);
      console.error(new Error().stack);
      process.exit(1); // Exit 1 = hard failure
    }
    
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
 * Check Chrome process count - HARD CAP: if > 1 Chrome instance, exit
 */
export function checkChromeProcessCap(): void {
  const chromePids = getChromePids();
  if (chromePids.length > 1) {
    console.error(`[EXECUTOR_GUARD] 🚨 MULTIPLE CHROME PROCESSES DETECTED: ${chromePids.length} instances`);
    console.error(`[EXECUTOR_GUARD] 🚨 Chrome PIDs: ${chromePids.join(', ')}`);
    console.error(`[EXECUTOR_GUARD] 🚨 Hard cap: 1 instance max - exiting immediately`);
    process.exit(1); // Hard failure
  }
}

/**
 * Create page with instrumentation and guardrails
 * Use this instead of context.newPage() everywhere
 */
export async function createPageWithGuard(context: any, callerFile?: string, callerFunction?: string): Promise<any> {
  // Check stop switch first (works even in hot loops)
  checkStopSwitch();
  
  // Check Chrome process cap
  checkChromeProcessCap();
  
  // Get caller info from stack if not provided
  if (!callerFile || !callerFunction) {
    const stack = new Error().stack?.split('\n') || [];
    const callerLine = stack[2] || 'unknown';
    callerFile = callerLine.split('/').pop()?.split(':')[0] || 'unknown';
    callerFunction = callerLine.match(/at (\w+)/)?.[1] || 'unknown';
  }
  
  // Check page count before creating
  const pageCountBefore = await getPageCount(context);
  if (pageCountBefore >= 3) {
    console.error(`[EXECUTOR_GUARD] 🚨 Cannot create page: already at hard cap (${pageCountBefore} pages)`);
    console.error(`[EXECUTOR_GUARD] 🚨 Caller: ${callerFile}::${callerFunction}`);
    throw new Error(`TAB_EXPLOSION_PREVENTED: Page count at hard cap (${pageCountBefore})`);
  }
  
  // Log page creation with stack trace
  const stack = new Error().stack?.split('\n').slice(0, 5).join('\n') || 'no stack';
  console.log(`[EXECUTOR_GUARD] 📄 Creating page - caller: ${callerFile}::${callerFunction}`);
  console.log(`[EXECUTOR_GUARD] 📄 Stack: ${stack}`);
  
  const page = await context.newPage();
  
  // Verify page count after creation
  const pageCountAfter = await getPageCount(context);
  console.log(`[EXECUTOR_GUARD] 📄 Page created - count: ${pageCountBefore} → ${pageCountAfter}`);
  
  // Hard cap check after creation
  if (pageCountAfter > 3) {
    console.error(`[EXECUTOR_GUARD] 🚨 TAB EXPLOSION AFTER CREATE: ${pageCountAfter} pages`);
    await page.close().catch(() => {});
    process.exit(1);
  }
  
  return page;
}

/**
 * Wrap context.newPage() to add guardrails automatically
 * Call this once per context to get a guarded newPage function
 */
export function wrapContextWithGuard(context: any): any {
  const originalNewPage = context.newPage.bind(context);
  
  context.newPage = async function(...args: any[]) {
    return createPageWithGuard(context);
  };
  
  return context;
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
  checkChromeProcessCap();
  
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
 * HARD RUNTIME CAP: Abort tick after 60 seconds
 */
export function createRuntimeCap(timeoutMs: number = 60000): () => void {
  const startTime = Date.now();
  let aborted = false;
  
  const timeoutId = setTimeout(() => {
    if (!aborted) {
      console.error(`[EXECUTOR_GUARD] 🚨 RUNTIME CAP EXCEEDED: ${timeoutMs}ms (hard cap)`);
      console.error(`[EXECUTOR_GUARD] 🚨 Aborting tick immediately`);
      process.exit(1); // Hard exit
    }
  }, timeoutMs);
  
  return () => {
    aborted = true;
    clearTimeout(timeoutId);
  };
}

/**
 * Get guard state (for external monitoring)
 */
export function getGuardState(): ExecutorGuardState {
  return { ...guardState };
}
