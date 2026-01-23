#!/usr/bin/env tsx
/**
 * 🚀 MAC EXECUTOR DAEMON - True Headless Background Execution
 * 
 * Single long-running daemon that:
 * - Launches OWN Chromium instance (headless=true by default)
 * - NEVER opens visible windows (headless mode enforced)
 * - Uses dedicated userDataDir under RUNNER_PROFILE_DIR
 * - Never uses connectOverCDP (except in executor:auth for login repair)
 * - Detects login wall/challenge and emits EXECUTOR_AUTH_REQUIRED + exits cleanly
 * - Rate-limits browser launches (max once per minute)
 * - Tracks browser launches and windows opened for monitoring
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
if (!process.env.RUNNER_PROFILE_DIR) {
  process.env.RUNNER_PROFILE_DIR = path.join(process.cwd(), '.runner-profile');
}

const RUNNER_PROFILE_DIR = process.env.RUNNER_PROFILE_DIR!;
const STOP_SWITCH_PATH = path.join(RUNNER_PROFILE_DIR, 'STOP_EXECUTOR');
const PIDFILE_PATH = path.join(RUNNER_PROFILE_DIR, 'executor.pid');
const BROWSER_LAUNCH_LOG = path.join(RUNNER_PROFILE_DIR, 'browser_launches.json');
const TICK_INTERVAL_MS = 60 * 1000; // 60 seconds
const MAX_RUNTIME_PER_TICK_MS = 5 * 60 * 1000; // 5 minutes max per tick
const HEADLESS = process.env.HEADLESS !== 'false'; // Default: true (headless)
const MIN_BROWSER_LAUNCH_INTERVAL_MS = 60 * 1000; // 1 minute minimum between launches

// Ensure profile dir exists
if (!fs.existsSync(RUNNER_PROFILE_DIR)) {
  fs.mkdirSync(RUNNER_PROFILE_DIR, { recursive: true });
}

// Dedicated userDataDir for bot Chrome (separate from user's Chrome)
const USER_DATA_DIR = path.join(RUNNER_PROFILE_DIR, 'chrome-profile-bot');

// Global state
let browser: Browser | null = null;
let context: BrowserContext | null = null;
let page: Page | null = null;
let consecutiveFailures = 0;
let backoffSeconds = 0;
let browserLaunchCount = 0;
let lastBrowserLaunchTime = 0;
let windowsOpenedCount = 0;
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
 * Cleanup lock file
 */
function cleanupLock(): void {
  try {
    if (fs.existsSync(PIDFILE_PATH)) {
      fs.unlinkSync(PIDFILE_PATH);
      console.log('[EXECUTOR_DAEMON] 🔓 Lock released');
    }
  } catch (error: any) {
    console.warn(`[EXECUTOR_DAEMON] ⚠️  Failed to cleanup lock: ${error.message}`);
  }
}

/**
 * Log browser launch
 */
function logBrowserLaunch(): void {
  const launchLog = {
    timestamp: new Date().toISOString(),
    launch_count: browserLaunchCount,
    headless: HEADLESS,
    user_data_dir: USER_DATA_DIR,
  };
  
  let launches: any[] = [];
  if (fs.existsSync(BROWSER_LAUNCH_LOG)) {
    try {
      launches = JSON.parse(fs.readFileSync(BROWSER_LAUNCH_LOG, 'utf-8'));
    } catch {}
  }
  
  launches.push(launchLog);
  // Keep only last 100 launches
  if (launches.length > 100) {
    launches = launches.slice(-100);
  }
  
  fs.writeFileSync(BROWSER_LAUNCH_LOG, JSON.stringify(launches, null, 2), 'utf-8');
}

/**
 * Check rate limit for browser launches
 */
function checkBrowserLaunchRateLimit(): void {
  const now = Date.now();
  const timeSinceLastLaunch = now - lastBrowserLaunchTime;
  
  if (lastBrowserLaunchTime > 0 && timeSinceLastLaunch < MIN_BROWSER_LAUNCH_INTERVAL_MS) {
    const remainingSeconds = Math.ceil((MIN_BROWSER_LAUNCH_INTERVAL_MS - timeSinceLastLaunch) / 1000);
    throw new Error(`Browser launch rate limit: must wait ${remainingSeconds}s (last launch was ${Math.floor(timeSinceLastLaunch / 1000)}s ago)`);
  }
}

/**
 * Detect login wall or challenge page
 */
async function detectAuthRequired(page: Page): Promise<{ required: boolean; reason: string }> {
  try {
    const currentUrl = page.url();
    
    // Check URL patterns
    if (currentUrl.includes('/i/flow/login') || currentUrl.includes('/i/flow/consent') || currentUrl.includes('/i/flow/verify')) {
      return {
        required: true,
        reason: currentUrl.includes('/i/flow/login') ? 'LOGIN_WALL' :
                currentUrl.includes('/i/flow/consent') ? 'CONSENT_WALL' :
                'CHALLENGE_WALL'
      };
    }
    
    // Check page content
    const pageState = await page.evaluate(() => {
      const bodyText = (document.body?.textContent || '').toLowerCase();
      const htmlContent = document.body?.innerHTML || '';
      
      return {
        hasLoginForm: !!document.querySelector('input[autocomplete="username"]'),
        hasLoginButton: bodyText.includes('sign in') || bodyText.includes('log in'),
        hasConsent: bodyText.includes('consent') || bodyText.includes('cookies') || htmlContent.toLowerCase().includes('consent'),
        hasChallenge: bodyText.includes('verify') || bodyText.includes('challenge') || bodyText.includes('unusual activity'),
        hasTimeline: !!document.querySelector('article[data-testid="tweet"]'),
        hasLeftNav: !!document.querySelector('nav[role="navigation"]'),
        hasCompose: !!document.querySelector('[data-testid="SideNav_NewTweet_Button"]'),
        url: window.location.href,
      };
    });
    
    // If we have timeline indicators, we're logged in
    if (pageState.hasTimeline || (pageState.hasLeftNav && pageState.hasCompose)) {
      return { required: false, reason: 'LOGGED_IN' };
    }
    
    // If we see login form/button without timeline, auth required
    if (pageState.hasLoginForm || pageState.hasLoginButton) {
      return { required: true, reason: 'LOGIN_WALL' };
    }
    
    // If we see consent indicators, auth required
    if (pageState.hasConsent) {
      return { required: true, reason: 'CONSENT_WALL' };
    }
    
    // If we see challenge indicators, auth required
    if (pageState.hasChallenge) {
      return { required: true, reason: 'CHALLENGE_WALL' };
    }
    
    return { required: false, reason: 'UNKNOWN' };
  } catch (error: any) {
    console.warn(`[EXECUTOR_DAEMON] ⚠️  Auth detection failed: ${error.message}`);
    return { required: false, reason: 'DETECTION_ERROR' };
  }
}

/**
 * Emit EXECUTOR_AUTH_REQUIRED event
 */
async function emitAuthRequired(reason: string): Promise<void> {
  try {
    const { getSupabaseClient } = await import('../../src/db/index');
    const supabase = getSupabaseClient();
    await supabase.from('system_events').insert({
      event_type: 'EXECUTOR_AUTH_REQUIRED',
      severity: 'warning',
      message: `Executor requires authentication: ${reason}. Run 'pnpm run executor:auth' to repair login.`,
      event_data: {
        reason,
        timestamp: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    });
    console.log(`[EXECUTOR_DAEMON] 📢 Emitted EXECUTOR_AUTH_REQUIRED: ${reason}`);
  } catch (error: any) {
    console.warn(`[EXECUTOR_DAEMON] ⚠️  Failed to emit auth required event: ${error.message}`);
  }
}

/**
 * Enforce page cap (keep only 1 page)
 */
async function enforcePageCap(): Promise<void> {
  if (!context) return;
  
  const pages = context.pages();
  
  // Hard cap: if > 1 page, close extras
  if (pages.length > 1) {
    console.warn(`[EXECUTOR_DAEMON] 🧹 Closing ${pages.length - 1} extra page(s) (keeping 1)`);
    for (let i = 1; i < pages.length; i++) {
      try {
        await pages[i].close();
      } catch (error: any) {
        console.warn(`[EXECUTOR_DAEMON] ⚠️  Failed to close page ${i + 1}: ${error.message}`);
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
 * Initialize browser (headless Chromium launch)
 */
async function initializeBrowser(): Promise<void> {
  // Check rate limit
  checkBrowserLaunchRateLimit();
  
  console.log(`[EXECUTOR_DAEMON] 🚀 Launching Chromium (headless=${HEADLESS})...`);
  console.log(`[EXECUTOR_DAEMON]    userDataDir: ${USER_DATA_DIR}`);
  
  // Ensure userDataDir exists
  if (!fs.existsSync(USER_DATA_DIR)) {
    fs.mkdirSync(USER_DATA_DIR, { recursive: true });
  }
  
  // Launch browser
  browser = await chromium.launch({
    headless: HEADLESS,
    channel: 'chrome', // Use system Chrome if available
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });
  
  browserLaunchCount++;
  lastBrowserLaunchTime = Date.now();
  logBrowserLaunch();
  
  console.log(`[EXECUTOR_DAEMON] ✅ Browser launched (launch #${browserLaunchCount}, headless=${HEADLESS})`);
  
  // Create context
  context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  
  console.log(`[EXECUTOR_DAEMON] ✅ Context created`);
  
  // Create single page
  page = await context.newPage();
  windowsOpenedCount = context.pages().length;
  
  console.log(`[EXECUTOR_DAEMON] ✅ Page created (windows_opened=${windowsOpenedCount})`);
  
  // Verify page count is 1
  const pages = context.pages();
  if (pages.length !== 1) {
    throw new Error(`Page count is ${pages.length}, expected 1`);
  }
  
  // Navigate to home to check auth status
  try {
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.waitForTimeout(2000); // Wait for dynamic content
    
    const authCheck = await detectAuthRequired(page);
    if (authCheck.required) {
      console.error(`[EXECUTOR_DAEMON] ❌ Auth required: ${authCheck.reason}`);
      await emitAuthRequired(authCheck.reason);
      await cleanup();
      console.log(`[EXECUTOR_DAEMON] 💡 Run 'pnpm run executor:auth' to repair login`);
      process.exit(0); // Clean exit
    }
    
    console.log(`[EXECUTOR_DAEMON] ✅ Auth check passed: ${authCheck.reason}`);
  } catch (error: any) {
    console.warn(`[EXECUTOR_DAEMON] ⚠️  Auth check failed: ${error.message}`);
    // Continue anyway - might be network issue
  }
  
  console.log(`[EXECUTOR_DAEMON] ✅ Browser initialized: 1 context, 1 page`);
}

/**
 * Cleanup browser resources
 */
async function cleanup(): Promise<void> {
  try {
    if (page) {
      await page.close().catch(() => {});
      console.log('[EXECUTOR_DAEMON] ✅ Closed page');
    }
    if (context) {
      await context.close().catch(() => {});
      console.log('[EXECUTOR_DAEMON] ✅ Closed context');
    }
    if (browser) {
      await browser.close().catch(() => {});
      console.log('[EXECUTOR_DAEMON] ✅ Closed browser');
    }
  } catch (error: any) {
    console.warn(`[EXECUTOR_DAEMON] ⚠️  Cleanup error: ${error.message}`);
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
  browserLaunches: number;
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
      message: `Executor daemon tick: pages=${metrics.pages} browser_launches=${metrics.browserLaunches} windows_opened=${metrics.windowsOpened} posting_ready=${metrics.postingReady} posting_attempts=${metrics.postingAttempts} reply_ready=${metrics.replyReady} reply_attempts=${metrics.replyAttempts}`,
      event_data: {
        pages: metrics.pages,
        browser_launches: metrics.browserLaunches,
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
  console.log('           🚀 MAC EXECUTOR DAEMON - True Headless Execution');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log(`📋 Configuration:`);
  console.log(`   EXECUTION_MODE: ${process.env.EXECUTION_MODE}`);
  console.log(`   RUNNER_MODE: ${process.env.RUNNER_MODE}`);
  console.log(`   RUNNER_PROFILE_DIR: ${RUNNER_PROFILE_DIR}`);
  console.log(`   HEADLESS: ${HEADLESS} (default: true)`);
  console.log(`   Tick interval: ${TICK_INTERVAL_MS / 1000}s`);
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
  
  // Cleanup on exit
  process.on('exit', () => {
    cleanupLock();
  });
  process.on('SIGINT', async () => {
    await cleanup();
    cleanupLock();
    process.exit(0);
  });
  process.on('SIGTERM', async () => {
    await cleanup();
    cleanupLock();
    process.exit(0);
  });
  
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
      } catch (error: any) {
        lastError = error.message;
        consecutiveFailures++;
        const failureIndex = Math.min(consecutiveFailures - 1, backoffSchedule.length - 1);
        backoffSeconds = backoffSchedule[failureIndex];
        
        console.error(`[EXECUTOR_DAEMON] ❌ Tick failed: ${error.message} (failures: ${consecutiveFailures}, backoff: ${backoffSeconds}s)`);
        
        // Check for auth required
        if (error.message.includes('LOGIN_WALL') || error.message.includes('CONSENT_WALL') || error.message.includes('CHALLENGE_WALL')) {
          await emitAuthRequired(error.message);
          console.log(`[EXECUTOR_DAEMON] 💡 Run 'pnpm run executor:auth' to repair login`);
          break; // Exit cleanly
        }
        
        // Max failures reached
        if (consecutiveFailures >= 5) {
          console.error(`[EXECUTOR_DAEMON] 🚨 MAX FAILURES REACHED: ${consecutiveFailures} - exiting`);
          break;
        }
      } finally {
        clearTimeout(runtimeCap);
      }
      
      // Log tick
      const pages = context ? context.pages().length : 0;
      const ts = new Date().toISOString();
      console.log(`[EXECUTOR_DAEMON] ts=${ts} pages=${pages} browser_launches=${browserLaunchCount} windows_opened=${windowsOpenedCount} posting_ready=${postingReady} posting_attempts=${postingAttempts} reply_ready=${replyReady} reply_attempts=${replyAttempts} backoff=${backoffSeconds}s${lastError ? ` last_error=${lastError}` : ''}`);
      
      // Emit event
      await emitTickEvent({
        pages,
        browserLaunches: browserLaunchCount,
        windowsOpened: windowsOpenedCount,
        postingReady,
        postingAttempts,
        replyReady,
        replyAttempts,
        backoff: backoffSeconds,
        lastError,
      });
      
    } catch (error: any) {
      console.error(`[EXECUTOR_DAEMON] ❌ Fatal error: ${error.message}`);
      break;
    }
    
    // Sleep until next tick (with backoff if needed)
    const sleepMs = backoffSeconds > 0 ? backoffSeconds * 1000 : TICK_INTERVAL_MS;
    console.log(`[EXECUTOR_DAEMON] 💤 Sleeping ${sleepMs / 1000}s until next tick...`);
    await new Promise(resolve => setTimeout(resolve, sleepMs));
  }
  
  // Cleanup
  await cleanup();
  cleanupLock();
  console.log('[EXECUTOR_DAEMON] ✅ Exited gracefully');
}

main().catch((error) => {
  console.error('❌ Daemon failed:', error);
  process.exit(1);
});
