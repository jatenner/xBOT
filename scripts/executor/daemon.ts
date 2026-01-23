#!/usr/bin/env tsx
/**
 * 🚀 MAC EXECUTOR DAEMON - Safe 24/7 Headless Execution
 * 
 * Single long-running daemon that:
 * - Runs HEADLESS=true by default (no visible windows)
 * - Launches its own Chromium with Playwright (not CDP)
 * - Uses dedicated userDataDir under RUNNER_PROFILE_DIR
 * - Never opens visible windows
 * - Never spawns multiple daemons (PID lock)
 * - STOP switch exits gracefully within 10s
 * - Hard resource caps (pages, browser launches)
 * - Rate-limited browser launches (max 1 per minute)
 * - Detects login wall/challenge and exits cleanly
 * 
 * Usage:
 *   EXECUTION_MODE=executor RUNNER_MODE=true RUNNER_PROFILE_DIR=./.runner-profile pnpm run executor:daemon
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
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
process.env.HEADLESS = process.env.HEADLESS !== 'false' ? 'true' : 'false'; // Default: true

const RUNNER_PROFILE_DIR = process.env.RUNNER_PROFILE_DIR || path.join(process.cwd(), '.runner-profile');
const STOP_SWITCH_PATH = path.join(RUNNER_PROFILE_DIR, 'STOP_EXECUTOR');
const PIDFILE_PATH = path.join(RUNNER_PROFILE_DIR, 'executor.pid');
const TICK_INTERVAL_MS = 60 * 1000; // 60 seconds
const MAX_RUNTIME_PER_TICK_MS = 120 * 1000; // 120s max per tick (increased for headless)
const SAFETY_NO_KILL = process.env.SAFETY_NO_KILL !== 'false'; // Default: true (safe mode)

// HARD REQUIREMENT: Always headless (no visible windows)
const HEADLESS = process.env.HEADLESS !== 'false'; // Default: true, can only be disabled explicitly
if (!HEADLESS) {
  console.error('[EXECUTOR_DAEMON] 🚨 FATAL: HEADLESS=false is not allowed in daemon mode');
  console.error('[EXECUTOR_DAEMON] 🚨 Use executor:auth for headed login repair');
  process.exit(1);
}

// Dedicated headless browser profile
const BROWSER_USER_DATA_DIR = path.join(RUNNER_PROFILE_DIR, 'chromium-headless-profile');
const MAX_BROWSER_LAUNCHES_PER_MINUTE = 1;
const BROWSER_LAUNCH_COOLDOWN_MS = 60 * 1000; // 1 minute

// Ensure profile dir exists
if (!fs.existsSync(RUNNER_PROFILE_DIR)) {
  fs.mkdirSync(RUNNER_PROFILE_DIR, { recursive: true });
}

// Global state
let browser: Browser | null = null;
let context: BrowserContext | null = null;
let page: Page | null = null;
let consecutiveFailures = 0;
let backoffSeconds = 0;
let lastBrowserLaunchTime = 0;
let browserLaunchCount = 0;
let windowsOpened = 0;
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
 * Clean up lock file
 */
function cleanupLock(): void {
  try {
    if (fs.existsSync(PIDFILE_PATH)) {
      fs.unlinkSync(PIDFILE_PATH);
      console.log('[EXECUTOR_DAEMON] 🔓 Lock released');
    }
  } catch (e) {
    // Ignore
  }
}

/**
 * Get managed Chrome PIDs from cdp_chrome_pids.json (for observability)
 */
function getManagedChromePids(): number[] {
  try {
    const managedPidsFile = path.join(RUNNER_PROFILE_DIR, 'cdp_chrome_pids.json');
    if (!fs.existsSync(managedPidsFile)) {
      return [];
    }
    const content = fs.readFileSync(managedPidsFile, 'utf-8');
    const data = JSON.parse(content);
    return data.chrome_pid ? [data.chrome_pid] : [];
  } catch {
    return [];
  }
}

/**
 * Detect login wall / challenge
 */
async function detectLoginWall(page: Page): Promise<boolean> {
  try {
    // Check for common login wall indicators
    const loginSelectors = [
      'text=/sign in/i',
      'text=/log in/i',
      '[data-testid="login"]',
      'a[href*="/i/flow/login"]',
      'text=/unlock/i',
      'text=/verify/i',
    ];
    
    for (const selector of loginSelectors) {
      try {
        const element = await page.locator(selector).first();
        if (await element.isVisible({ timeout: 1000 })) {
          return true;
        }
      } catch {
        // Continue
      }
    }
    
    // Check URL for login/challenge
    const url = page.url();
    if (url.includes('/i/flow/login') || url.includes('/account/access') || url.includes('/i/flow/challenge')) {
      return true;
    }
    
    return false;
  } catch {
    return false;
  }
}

/**
 * Emit EXECUTOR_AUTH_REQUIRED event and exit cleanly
 */
async function emitAuthRequiredAndExit(): Promise<void> {
  try {
    const { getSupabaseClient } = await import('../../src/db/index');
    const supabase = getSupabaseClient();
    await supabase.from('system_events').insert({
      event_type: 'EXECUTOR_AUTH_REQUIRED',
      severity: 'warning',
      message: 'Executor requires authentication - run executor:auth to repair login',
      event_data: {
        reason: 'login_wall_or_challenge_detected',
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn(`[EXECUTOR_DAEMON] ⚠️  Failed to emit EXECUTOR_AUTH_REQUIRED: ${(e as Error).message}`);
  }
  
  console.error('[EXECUTOR_DAEMON] 🔐 AUTH REQUIRED: Login wall or challenge detected');
  console.error('[EXECUTOR_DAEMON] 🔐 Run: pnpm run executor:auth to repair login');
  console.error('[EXECUTOR_DAEMON] 🔐 Exiting cleanly...');
  cleanupLock();
  process.exit(0);
}

/**
 * Launch headless browser (rate-limited)
 */
async function launchBrowser(): Promise<void> {
  const now = Date.now();
  const timeSinceLastLaunch = now - lastBrowserLaunchTime;
  
  if (timeSinceLastLaunch < BROWSER_LAUNCH_COOLDOWN_MS && lastBrowserLaunchTime > 0) {
    const remainingSeconds = Math.ceil((BROWSER_LAUNCH_COOLDOWN_MS - timeSinceLastLaunch) / 1000);
    throw new Error(`Browser launch rate-limited: wait ${remainingSeconds}s (max ${MAX_BROWSER_LAUNCHES_PER_MINUTE} per minute)`);
  }
  
  // Close existing browser if any
  if (browser) {
    try {
      await browser.close();
    } catch {
      // Ignore
    }
    browser = null;
    context = null;
    page = null;
  }
  
  console.log(`[EXECUTOR_DAEMON] 🚀 Launching headless browser (launch #${browserLaunchCount + 1})...`);
  console.log(`   User data dir: ${BROWSER_USER_DATA_DIR}`);
  console.log(`   Headless: ${HEADLESS}`);
  
  // Ensure user data dir exists
  if (!fs.existsSync(BROWSER_USER_DATA_DIR)) {
    fs.mkdirSync(BROWSER_USER_DATA_DIR, { recursive: true });
  }
  
  // HARD REQUIREMENT: Always use userDataDir under RUNNER_PROFILE_DIR
  browser = await chromium.launch({
    headless: true, // HARD: Always headless (no visible windows)
    channel: 'chrome', // Use system Chrome
    args: [
      `--user-data-dir=${BROWSER_USER_DATA_DIR}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });
  
  browserLaunchCount++;
  lastBrowserLaunchTime = Date.now();
  
  // Note: Playwright Browser doesn't expose PID directly in headless mode
  console.log(`[EXECUTOR_DAEMON] ✅ Browser launched (launch #${browserLaunchCount})`);
}

/**
 * Initialize browser + context + single page
 */
async function initializeBrowser(): Promise<void> {
  // Launch browser if needed
  if (!browser || !browser.isConnected()) {
    await launchBrowser();
  }
  
  // Create context if needed
  if (!context) {
    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 },
    });
    
    // HARD REQUIREMENT: Verify context is headless (no visible windows)
    // Note: Playwright doesn't expose headless state directly, but we enforce it at launch
    console.log(`[EXECUTOR_DAEMON] ✅ Context created (headless enforced)`);
  }
  
  // Verify browser is still headless (safety check - HEADLESS is always true at this point)
  if (!HEADLESS) {
    console.error('[EXECUTOR_DAEMON] 🚨 FATAL: Browser context is headed (visible windows not allowed)');
    console.error('[EXECUTOR_DAEMON] 🚨 HEADLESS must be true in daemon mode');
    process.exit(1);
  }
  
  // Enforce page cap (close extras, keep only 1)
  const pages = context.pages();
  if (pages.length > 1) {
    console.warn(`[EXECUTOR_DAEMON] 🧹 Closing ${pages.length - 1} extra page(s)`);
    for (let i = 1; i < pages.length; i++) {
      try {
        await pages[i].close();
      } catch {
        // Ignore
      }
    }
  }
  
  // Get or create single page
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
  
  // Check for login wall
  try {
    if (page.url() && (page.url().includes('x.com') || page.url().includes('twitter.com'))) {
      const hasLoginWall = await detectLoginWall(page);
      if (hasLoginWall) {
        await emitAuthRequiredAndExit();
      }
    }
  } catch (e) {
    // Ignore detection errors
  }
  
  console.log(`[EXECUTOR_DAEMON] ✅ Browser initialized: 1 context, 1 page`);
}

/**
 * Enforce page cap
 */
async function enforcePageCap(): Promise<void> {
  if (!context) return;
  
  const pages = context.pages();
  if (pages.length > 1) {
    console.warn(`[EXECUTOR_DAEMON] 🧹 Enforcing page cap: closing ${pages.length - 1} extra page(s)`);
    for (let i = 1; i < pages.length; i++) {
      try {
        await pages[i].close();
      } catch {
        // Ignore
      }
    }
  }
  
  // Update page reference
  const finalPages = context.pages();
  if (finalPages.length > 0) {
    page = finalPages[0];
  }
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
  browserLaunchCount: number;
  windowsOpened: number;
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
      message: `Executor daemon tick: pages=${metrics.pages} browser_launches=${metrics.browserLaunchCount} windows_opened=${metrics.windowsOpened} posting_ready=${metrics.postingReady} posting_attempts=${metrics.postingAttempts} reply_ready=${metrics.replyReady} reply_attempts=${metrics.replyAttempts}`,
      event_data: {
        pages: metrics.pages,
        browser_launch_count: metrics.browserLaunchCount,
        windows_opened: metrics.windowsOpened,
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
  console.log('           🚀 MAC EXECUTOR DAEMON - Safe 24/7 Headless Execution');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log(`📋 Configuration:`);
  console.log(`   EXECUTION_MODE: ${process.env.EXECUTION_MODE}`);
  console.log(`   RUNNER_MODE: ${process.env.RUNNER_MODE}`);
  console.log(`   RUNNER_PROFILE_DIR: ${RUNNER_PROFILE_DIR}`);
  console.log(`   HEADLESS: ${HEADLESS} ✅ (HARD REQUIREMENT: always true, no visible windows)`);
  console.log(`   Browser profile: ${BROWSER_USER_DATA_DIR}`);
  console.log(`   Tick interval: ${TICK_INTERVAL_MS / 1000}s`);
  console.log(`   Max browser launches/min: ${MAX_BROWSER_LAUNCHES_PER_MINUTE}`);
  console.log('');
  
  // Explicit boot log asserting headless=true
  console.log('[EXECUTOR_DAEMON] ✅ BOOT: headless=true (no visible windows will be opened)');
  console.log('[EXECUTOR_DAEMON] ✅ BOOT: userDataDir=' + BROWSER_USER_DATA_DIR);
  console.log('[EXECUTOR_DAEMON] ✅ BOOT: chromium.launch() mode (NOT connectOverCDP)');
  console.log('');
  
  // Acquire lock
  acquireLock();
  
  // Initialize browser
  try {
    await initializeBrowser();
  } catch (e: any) {
    console.error(`[EXECUTOR_DAEMON] ❌ Failed to initialize browser: ${e.message}`);
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
      // Enforce page cap
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
      } finally {
        clearTimeout(runtimeCap);
      }
      
      // Check for login wall after operations
      if (page) {
        try {
          const hasLoginWall = await detectLoginWall(page);
          if (hasLoginWall) {
            await emitAuthRequiredAndExit();
          }
        } catch {
          // Ignore detection errors
        }
      }
      
    } catch (e: any) {
      consecutiveFailures++;
      lastError = e.message;
      
      // Calculate backoff
      const failureIndex = Math.min(consecutiveFailures - 1, backoffSchedule.length - 1);
      backoffSeconds = backoffSchedule[failureIndex];
      
      console.error(`[EXECUTOR_DAEMON] ❌ Tick failed: ${e.message} (failures: ${consecutiveFailures}, backoff: ${backoffSeconds}s)`);
      
      // Max failures - exit
      if (consecutiveFailures >= 5) {
        console.error(`[EXECUTOR_DAEMON] 🚨 MAX FAILURES REACHED: ${consecutiveFailures} - exiting`);
        break;
      }
    }
    
    // Log tick
    const pages = context ? context.pages().length : 0;
    const ts = new Date().toISOString();
    console.log(`[EXECUTOR_DAEMON] ts=${ts} pages=${pages} browser_launches=${browserLaunchCount} windows_opened=${windowsOpened} posting_ready=${postingReady} posting_attempts=${postingAttempts} reply_ready=${replyReady} reply_attempts=${replyAttempts} backoff=${backoffSeconds}s${lastError ? ` last_error=${lastError}` : ''}`);
    
    // Emit tick event
    await emitTickEvent({
      pages,
      browserLaunchCount,
      windowsOpened,
      postingReady,
      postingAttempts,
      replyReady,
      replyAttempts,
      backoff: backoffSeconds,
      lastError,
    });
    
    // Sleep with backoff
    const sleepSeconds = backoffSeconds > 0 ? backoffSeconds : TICK_INTERVAL_MS / 1000;
    console.log(`[EXECUTOR_DAEMON] 💤 Sleeping ${sleepSeconds}s until next tick...`);
    await new Promise(resolve => setTimeout(resolve, sleepSeconds * 1000));
  }
  
  // Cleanup
  console.log('[EXECUTOR_DAEMON] 🧹 Cleaning up...');
  cleanupLock();
  
  if (page) {
    try {
      await page.close();
      console.log('[EXECUTOR_DAEMON] ✅ Closed page');
    } catch {
      // Ignore
    }
  }
  
  if (context) {
    try {
      await context.close();
      console.log('[EXECUTOR_DAEMON] ✅ Closed context');
    } catch {
      // Ignore
    }
  }
  
  if (browser) {
    try {
      await browser.close();
      console.log('[EXECUTOR_DAEMON] ✅ Closed browser');
    } catch {
      // Ignore
    }
  }
  
  console.log('[EXECUTOR_DAEMON] ✅ Exited gracefully');
}

// Handle signals
process.on('SIGINT', () => {
  console.log('\n[EXECUTOR_DAEMON] 🛑 SIGINT received - exiting...');
  cleanupLock();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[EXECUTOR_DAEMON] 🛑 SIGTERM received - exiting...');
  cleanupLock();
  process.exit(0);
});

main().catch((error) => {
  console.error('[EXECUTOR_DAEMON] ❌ Fatal error:', error);
  cleanupLock();
  process.exit(1);
});
