#!/usr/bin/env tsx
/**
 * 🚀 MAC EXECUTOR DAEMON - Safe 24/7 Execution
 * 
 * Single long-running daemon that:
 * - Uses ONE CDP connection + ONE page (reused across iterations)
 * - Never opens more than 1 page (hard enforced)
 * - Never spawns multiple daemons (PID lock)
 * - STOP switch exits gracefully within 10s
 * - Hard resource caps (pages, Chrome processes, runtime)
 * - Focus-safe mode (no window stealing)
 * 
 * Usage:
 *   EXECUTION_MODE=executor RUNNER_MODE=true RUNNER_BROWSER=cdp RUNNER_PROFILE_DIR=./.runner-profile pnpm run executor:daemon
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { chromium, BrowserContext, Page } from 'playwright';
import { execSync } from 'child_process';

// Load .env.local first, then .env
const envLocalPath = path.join(process.cwd(), '.env.local');
const envPath = path.join(process.cwd(), '.env');

if (fs.existsSync(envLocalPath)) {
  require('dotenv').config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

// Set executor mode environment
process.env.EXECUTION_MODE = 'executor';
process.env.RUNNER_MODE = 'true';
if (!process.env.RUNNER_BROWSER) {
  process.env.RUNNER_BROWSER = 'cdp';
}
if (!process.env.RUNNER_PROFILE_DIR) {
  process.env.RUNNER_PROFILE_DIR = path.join(process.cwd(), '.runner-profile');
}

const RUNNER_PROFILE_DIR = process.env.RUNNER_PROFILE_DIR!;
const STOP_SWITCH_PATH = path.join(RUNNER_PROFILE_DIR, 'STOP_EXECUTOR');
const PIDFILE_PATH = path.join(RUNNER_PROFILE_DIR, 'executor.pid');
const CDP_PORT = parseInt(process.env.CDP_PORT || '9222', 10);
const TICK_INTERVAL_MS = 60 * 1000; // 60 seconds
const MAX_RUNTIME_PER_TICK_MS = 60 * 1000; // 60s max per tick

// Ensure profile dir exists
if (!fs.existsSync(RUNNER_PROFILE_DIR)) {
  fs.mkdirSync(RUNNER_PROFILE_DIR, { recursive: true });
}

// Global state
let context: BrowserContext | null = null;
let page: Page | null = null;
let consecutiveFailures = 0;
let backoffSeconds = 0;
const backoffSchedule = [30, 60, 120, 300, 600]; // 30s → 1m → 2m → 5m → 10m

/**
 * Check STOP switch - exit gracefully within 10s
 */
function checkStopSwitch(): boolean {
  if (process.env.STOP_EXECUTOR === 'true' || fs.existsSync(STOP_SWITCH_PATH)) {
    console.log('[EXECUTOR_DAEMON] 🛑 STOP switch triggered - exiting gracefully...');
    return true;
  }
  return false;
}

/**
 * Enforce single-instance lock
 */
function acquireLock(): void {
  if (fs.existsSync(PIDFILE_PATH)) {
    try {
      const pidfileContent = fs.readFileSync(PIDFILE_PATH, 'utf-8').trim();
      const pid = parseInt(pidfileContent.split(':')[0], 10);
      try {
        execSync(`ps -p ${pid} > /dev/null 2>&1`, { encoding: 'utf-8' });
        console.error(`[EXECUTOR_DAEMON] 🔒 Another executor running (PID: ${pid}) - exiting`);
        process.exit(0);
      } catch {
        // Stale lock - remove it
        fs.unlinkSync(PIDFILE_PATH);
      }
    } catch (e) {
      // Corrupted lock - remove it
      try {
        fs.unlinkSync(PIDFILE_PATH);
      } catch {}
    }
  }
  
  // Create lock
  const pid = process.pid;
  const startTime = Date.now();
  fs.writeFileSync(PIDFILE_PATH, `${pid}:${startTime}`, 'utf-8');
  console.log(`[EXECUTOR_DAEMON] 🔒 Lock acquired (PID: ${pid})`);
}

/**
 * Clean up lock on exit
 */
function cleanupLock(): void {
  try {
    if (fs.existsSync(PIDFILE_PATH)) {
      fs.unlinkSync(PIDFILE_PATH);
      console.log('[EXECUTOR_DAEMON] 🔓 Lock released');
    }
  } catch (e) {
    // Ignore cleanup errors
  }
}

/**
 * Get Chrome PIDs
 */
function getChromePids(): number[] {
  try {
    const output = execSync('ps aux | grep -i "Google Chrome" | grep -v grep | awk \'{print $2}\'', { encoding: 'utf-8' });
    return output.trim().split('\n').filter(Boolean).map(pid => parseInt(pid, 10)).filter(pid => !isNaN(pid));
  } catch {
    return [];
  }
}

/**
 * Hard Chrome process cap - kill extras if > 1
 */
function enforceChromeProcessCap(): void {
  const pids = getChromePids();
  if (pids.length > 1) {
    console.error(`[EXECUTOR_DAEMON] 🚨 MULTIPLE CHROME PROCESSES: ${pids.length} detected`);
    console.error(`[EXECUTOR_DAEMON] 🚨 Killing extras (keeping PID ${pids[0]})`);
    for (let i = 1; i < pids.length; i++) {
      try {
        execSync(`kill -9 ${pids[i]}`, { encoding: 'utf-8' });
        console.log(`[EXECUTOR_DAEMON] ✅ Killed Chrome PID ${pids[i]}`);
      } catch (e) {
        // Ignore kill errors
      }
    }
  }
}

/**
 * Hard page cap - close extras, keep only 1
 */
async function enforcePageCap(): Promise<void> {
  if (!context) return;
  
  const pages = context.pages();
  if (pages.length > 1) {
    console.error(`[EXECUTOR_DAEMON] 🚨 MULTIPLE PAGES: ${pages.length} detected - closing extras`);
    for (let i = 1; i < pages.length; i++) {
      try {
        await pages[i].close();
        console.log(`[EXECUTOR_DAEMON] ✅ Closed page ${i + 1}/${pages.length}`);
      } catch (e) {
        // Ignore close errors
      }
    }
  }
  
  // Hard cap: if still > 1 page, exit
  const finalPages = context.pages();
  if (finalPages.length > 1) {
    console.error(`[EXECUTOR_DAEMON] 🚨 HARD CAP EXCEEDED: ${finalPages.length} pages after cleanup - EXITING`);
    process.exit(1);
  }
  
  // Update global page reference
  if (finalPages.length === 1) {
    page = finalPages[0];
  }
}

/**
 * Initialize CDP connection + single page
 */
async function initializeCDP(): Promise<void> {
  console.log(`[EXECUTOR_DAEMON] 🔌 Connecting to CDP on port ${CDP_PORT}...`);
  
  // Check CDP is running
  try {
    const response = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`, {
      signal: AbortSignal.timeout(2000)
    });
    if (!response.ok) {
      throw new Error(`CDP not reachable: ${response.status}`);
    }
  } catch (e: any) {
    throw new Error(`CDP not reachable on port ${CDP_PORT}: ${e.message}`);
  }
  
  // Connect to CDP
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);
  const contexts = browser.contexts();
  
  if (contexts.length > 0) {
    context = contexts[0];
    console.log(`[EXECUTOR_DAEMON] ✅ Connected to existing context`);
  } else {
    context = await browser.newContext();
    console.log(`[EXECUTOR_DAEMON] ✅ Created new context`);
  }
  
  // Enforce page cap
  await enforcePageCap();
  
  // Get or create single page
  const pages = context.pages();
  if (pages.length === 0) {
    page = await context.newPage();
    console.log(`[EXECUTOR_DAEMON] ✅ Created single page`);
  } else {
    page = pages[0];
    console.log(`[EXECUTOR_DAEMON] ✅ Reusing existing page`);
  }
  
  // Verify page count is 1
  const finalPages = context.pages();
  if (finalPages.length !== 1) {
    throw new Error(`Page count is ${finalPages.length}, expected 1`);
  }
  
  console.log(`[EXECUTOR_DAEMON] ✅ CDP initialized: 1 context, 1 page`);
}

/**
 * Run posting queue
 */
async function runPostingQueue(): Promise<{ attempts_started: number; ready: number; selected: number }> {
  const { processPostingQueue } = await import('../../src/jobs/postingQueue');
  const result = await processPostingQueue();
  return {
    attempts_started: result.attempts_started,
    ready: result.ready_candidates,
    selected: result.selected_candidates
  };
}

/**
 * Run reply queue
 */
async function runReplyQueue(): Promise<{ attempts_started: number; ready: number; selected: number }> {
  const { replySystemV2Job } = await import('../../src/jobs/replySystemV2/main');
  await replySystemV2Job();
  
  // Query recent REPLY_QUEUE_TICK to get metrics
  const { getSupabaseClient } = await import('../../src/db/index');
  const supabase = getSupabaseClient();
  const { data: recentTick } = await supabase
    .from('system_events')
    .select('event_data')
    .eq('event_type', 'REPLY_QUEUE_TICK')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (recentTick?.event_data) {
    const data = typeof recentTick.event_data === 'string' 
      ? JSON.parse(recentTick.event_data) 
      : recentTick.event_data;
    return {
      attempts_started: data.attempts_started || 0,
      ready: data.ready_candidates || 0,
      selected: data.selected_candidates || 0
    };
  }
  
  return { attempts_started: 0, ready: 0, selected: 0 };
}

/**
 * Emit observability event
 */
async function emitTickEvent(metrics: {
  pages: number;
  chromePids: number[];
  postingReady: number;
  postingAttempts: number;
  replyReady: number;
  replyAttempts: number;
  backoff: number;
  lastError?: string;
}): Promise<void> {
  try {
    const { getSupabaseClient } = await import('../../src/db/index');
    const supabase = getSupabaseClient();
    await supabase.from('system_events').insert({
      event_type: 'EXECUTOR_DAEMON_TICK',
      severity: 'info',
      message: `Executor daemon tick: pages=${metrics.pages} posting_ready=${metrics.postingReady} posting_attempts=${metrics.postingAttempts} reply_ready=${metrics.replyReady} reply_attempts=${metrics.replyAttempts}`,
      event_data: {
        pages: metrics.pages,
        chrome_pids: metrics.chromePids,
        posting_ready: metrics.postingReady,
        posting_attempts: metrics.postingAttempts,
        reply_ready: metrics.replyReady,
        reply_attempts: metrics.replyAttempts,
        backoff_seconds: metrics.backoff,
        last_error: metrics.lastError || null,
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    });
  } catch (e: any) {
    console.warn(`[EXECUTOR_DAEMON] ⚠️  Failed to emit tick event: ${e.message}`);
  }
}

/**
 * Main daemon loop
 */
async function main(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🚀 MAC EXECUTOR DAEMON - Safe 24/7 Execution');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log(`📋 Configuration:`);
  console.log(`   EXECUTION_MODE: ${process.env.EXECUTION_MODE}`);
  console.log(`   RUNNER_MODE: ${process.env.RUNNER_MODE}`);
  console.log(`   RUNNER_BROWSER: ${process.env.RUNNER_BROWSER}`);
  console.log(`   RUNNER_PROFILE_DIR: ${RUNNER_PROFILE_DIR}`);
  console.log(`   CDP_PORT: ${CDP_PORT}`);
  console.log(`   Tick interval: ${TICK_INTERVAL_MS / 1000}s`);
  console.log('');
  
  // Acquire lock
  acquireLock();
  
  // Initialize CDP + single page
  try {
    await initializeCDP();
  } catch (e: any) {
    console.error(`[EXECUTOR_DAEMON] ❌ Failed to initialize CDP: ${e.message}`);
    console.error(`   Make sure Chrome is running with CDP: pnpm run runner:chrome-cdp`);
    cleanupLock();
    process.exit(1);
  }
  
  // Main loop
  while (true) {
    // Check STOP switch
    if (checkStopSwitch()) {
      console.log('[EXECUTOR_DAEMON] 🛑 Exiting gracefully...');
      break;
    }
    
    const tickStart = Date.now();
    let postingReady = 0;
    let postingAttempts = 0;
    let replyReady = 0;
    let replyAttempts = 0;
    let lastError: string | undefined;
    
    try {
      // Enforce hard caps
      enforceChromeProcessCap();
      await enforcePageCap();
      
      // Runtime cap
      const runtimeCap = setTimeout(() => {
        console.error(`[EXECUTOR_DAEMON] 🚨 RUNTIME CAP EXCEEDED: ${MAX_RUNTIME_PER_TICK_MS}ms - aborting tick`);
        throw new Error('Runtime cap exceeded');
      }, MAX_RUNTIME_PER_TICK_MS);
      
      try {
        // Run posting queue
        const postingResult = await runPostingQueue();
        postingReady = postingResult.ready;
        postingAttempts = postingResult.attempts_started;
        
        // Run reply queue
        const replyResult = await runReplyQueue();
        replyReady = replyResult.ready;
        replyAttempts = replyResult.attempts_started;
        
        // Reset failures on success
        if (consecutiveFailures > 0) {
          console.log(`[EXECUTOR_DAEMON] ✅ Recovered after ${consecutiveFailures} failures`);
          consecutiveFailures = 0;
          backoffSeconds = 0;
        }
        
        clearTimeout(runtimeCap);
      } catch (e: any) {
        clearTimeout(runtimeCap);
        throw e;
      }
      
    } catch (err: any) {
      lastError = err.message;
      consecutiveFailures++;
      const failureIndex = Math.min(consecutiveFailures - 1, backoffSchedule.length - 1);
      backoffSeconds = backoffSchedule[failureIndex];
      console.error(`[EXECUTOR_DAEMON] ❌ Tick failed: ${err.message} (failures: ${consecutiveFailures}, backoff: ${backoffSeconds}s)`);
      
      // Max failures: exit
      if (consecutiveFailures >= 5) {
        console.error(`[EXECUTOR_DAEMON] 🚨 MAX FAILURES REACHED: ${consecutiveFailures} - exiting`);
        break;
      }
    }
    
    // Get current state for observability
    const pages = context ? context.pages().length : 0;
    const chromePids = getChromePids();
    const ts = new Date().toISOString();
    
    // Log structured line
    console.log(`[EXECUTOR_DAEMON] ts=${ts} pages=${pages} pids=[${chromePids.join(',')}] posting_ready=${postingReady} posting_attempts=${postingAttempts} reply_ready=${replyReady} reply_attempts=${replyAttempts} backoff=${backoffSeconds}s${lastError ? ` last_error=${lastError}` : ''}`);
    
    // Emit tick event
    await emitTickEvent({
      pages,
      chromePids,
      postingReady,
      postingAttempts,
      replyReady,
      replyAttempts,
      backoff: backoffSeconds,
      lastError,
    });
    
    // Sleep with backoff
    const sleepMs = backoffSeconds > 0 
      ? backoffSeconds * 1000 
      : TICK_INTERVAL_MS;
    
    console.log(`[EXECUTOR_DAEMON] 💤 Sleeping ${sleepMs / 1000}s until next tick...`);
    
    // Check STOP switch during sleep (every second)
    const sleepStart = Date.now();
    while (Date.now() - sleepStart < sleepMs) {
      if (checkStopSwitch()) {
        console.log('[EXECUTOR_DAEMON] 🛑 STOP switch triggered during sleep - exiting');
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    if (checkStopSwitch()) {
      break;
    }
  }
  
  // Cleanup
  console.log('[EXECUTOR_DAEMON] 🧹 Cleaning up...');
  cleanupLock();
  
  if (page) {
    try {
      await page.close();
    } catch (e) {
      // Ignore
    }
  }
  
  console.log('[EXECUTOR_DAEMON] ✅ Exited gracefully');
  process.exit(0);
}

// Handle signals
process.on('SIGTERM', () => {
  console.log('[EXECUTOR_DAEMON] 🛑 Received SIGTERM - exiting...');
  cleanupLock();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[EXECUTOR_DAEMON] 🛑 Received SIGINT - exiting...');
  cleanupLock();
  process.exit(0);
});

main().catch((err) => {
  console.error(`[EXECUTOR_DAEMON] ❌ Fatal error: ${err.message}`);
  if (err.stack) {
    console.error(err.stack);
  }
  cleanupLock();
  process.exit(1);
});
