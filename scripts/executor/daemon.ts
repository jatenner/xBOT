#!/usr/bin/env tsx
/**
 * 🚀 MAC EXECUTOR DAEMON - True Headless 24/7 Execution
 * 
 * Single long-running daemon that:
 * - Runs HEADLESS=true by default (NO visible windows)
 * - Launches its own Chromium with Playwright (NOT CDP)
 * - Uses dedicated userDataDir under RUNNER_PROFILE_DIR
 * - Never opens visible windows
 * - Detects auth walls and exits cleanly
 * - Exponential backoff (min 60s, max 10m)
 * - Single-instance lock
 * - STOP switch (exits within 10s)
 * - Hard page cap (pages <= 1)
 * 
 * Usage:
 *   EXECUTION_MODE=executor RUNNER_MODE=true RUNNER_PROFILE_DIR=./.runner-profile pnpm run executor:daemon
 */

import * as fs from 'fs';
import * as path from 'path';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { execSync } from 'child_process';
import { resolveRunnerProfileDir, ensureRunnerProfileDir, RUNNER_PROFILE_PATHS } from '../../src/infra/runnerProfile';
import { requireExecutorMode, getModeLabel, isExecutor } from '../../src/infra/executionMode';

// Load .env.local first, then .env
// IMPORTANT: Do NOT use 'dotenv/config' import - it loads .env before we can check .env.local
const envLocalPath = path.join(process.cwd(), '.env.local');
const envPath = path.join(process.cwd(), '.env');

let envFileLoaded: string | null = null;
let envLoadedFromDotenv = false;

if (fs.existsSync(envLocalPath)) {
  require('dotenv').config({ path: envLocalPath });
  envFileLoaded = envLocalPath;
  envLoadedFromDotenv = true;
} else if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
  envFileLoaded = envPath;
  envLoadedFromDotenv = true;
}

// 🔍 OPENAI API KEY DIAGNOSTICS
function diagnoseOpenAIKey(): void {
  const crypto = require('crypto');
  
  // Check for alternative env var names
  const openaiKey = process.env.OPENAI_API_KEY;
  const openaiKeyAlt = process.env.OPENAI_KEY;
  const openaiToken = process.env.OPENAI_API_TOKEN;
  
  // Check if key came from process.env (before dotenv) or dotenv file
  const keyFromProcessEnv = !!process.env.OPENAI_API_KEY && !envLoadedFromDotenv;
  
  // Get key info (safe - never print full key)
  const keyLength = openaiKey ? openaiKey.length : 0;
  const keyPrefix = openaiKey ? openaiKey.slice(0, 7) : 'none';
  const keySuffix = openaiKey && keyLength > 4 ? openaiKey.slice(-4) : 'none';
  
  // Compute SHA256 hash for comparison
  const keyHash = openaiKey 
    ? crypto.createHash('sha256').update(openaiKey).digest('hex').substring(0, 16)
    : 'none';
  
  // Check for whitespace issues
  const hasLeadingWhitespace = openaiKey ? /^\s/.test(openaiKey) : false;
  const hasTrailingWhitespace = openaiKey ? /\s$/.test(openaiKey) : false;
  const hasQuotes = openaiKey ? /^["']|["']$/.test(openaiKey) : false;
  
  // Trim and clean key if needed
  let cleanedKey = openaiKey;
  if (cleanedKey) {
    cleanedKey = cleanedKey.trim();
    if (cleanedKey.startsWith('"') && cleanedKey.endsWith('"')) {
      cleanedKey = cleanedKey.slice(1, -1);
    } else if (cleanedKey.startsWith("'") && cleanedKey.endsWith("'")) {
      cleanedKey = cleanedKey.slice(1, -1);
    }
    cleanedKey = cleanedKey.trim();
    
    // Update process.env with cleaned key
    if (cleanedKey !== openaiKey) {
      process.env.OPENAI_API_KEY = cleanedKey;
      console.log(`[OPENAI_KEY_DIAG] ⚠️ Key cleaned: removed whitespace/quotes`);
    }
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('     🔍 OPENAI API KEY DIAGNOSTICS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Env file loaded: ${envFileLoaded || 'none'}`);
  console.log(`Key source: ${keyFromProcessEnv ? 'process.env (before dotenv)' : (envLoadedFromDotenv ? 'dotenv file' : 'not found')}`);
  console.log(`Key present: ${!!openaiKey}`);
  console.log(`Key length: ${keyLength}`);
  console.log(`Key prefix: ${keyPrefix}`);
  console.log(`Key suffix: ${keySuffix}`);
  console.log(`Key hash (SHA256, first 16): ${keyHash}`);
  
  if (hasLeadingWhitespace || hasTrailingWhitespace) {
    console.log(`⚠️ WARNING: Key has ${hasLeadingWhitespace ? 'leading' : ''}${hasLeadingWhitespace && hasTrailingWhitespace ? ' and ' : ''}${hasTrailingWhitespace ? 'trailing' : ''} whitespace`);
  }
  
  if (hasQuotes) {
    console.log(`⚠️ WARNING: Key has quotes around it`);
  }
  
  if (openaiKeyAlt) {
    console.log(`⚠️ WARNING: OPENAI_KEY env var also set (may override)`);
  }
  
  if (openaiToken) {
    console.log(`⚠️ WARNING: OPENAI_API_TOKEN env var also set (may override)`);
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

// Run diagnostics immediately after env loading
diagnoseOpenAIKey();

// Set executor mode environment
process.env.EXECUTION_MODE = 'executor';
process.env.RUNNER_MODE = 'true';

// HARD REQUIREMENT: Always headless (no visible windows)
const HEADLESS = process.env.HEADLESS !== 'false'; // Default: true
if (!HEADLESS) {
  console.error('[EXECUTOR_DAEMON] 🚨 FATAL: HEADLESS=false is not allowed in daemon mode');
  console.error('[EXECUTOR_DAEMON] 🚨 Use executor:auth for headed login repair');
  process.exit(1);
}

// HARD REQUIREMENT: NEVER use CDP mode (CDP requires visible Chrome windows)
const RUNNER_BROWSER = process.env.RUNNER_BROWSER || '';
if (RUNNER_BROWSER.toLowerCase() === 'cdp') {
  console.error('[EXECUTOR_DAEMON] 🚨 FATAL: RUNNER_BROWSER=cdp is not allowed in daemon mode');
  console.error('[EXECUTOR_DAEMON] 🚨 CDP mode requires visible Chrome windows (chrome-cdp.ts)');
  console.error('[EXECUTOR_DAEMON] 🚨 Daemon MUST use direct Playwright launch (headless=true)');
  console.error('[EXECUTOR_DAEMON] 🚨 Remove RUNNER_BROWSER=cdp from LaunchAgent plist');
  process.exit(1);
}

// Resolve paths using single source of truth
const RUNNER_PROFILE_DIR = ensureRunnerProfileDir();
const BROWSER_USER_DATA_DIR = RUNNER_PROFILE_PATHS.chromeProfile();
const STOP_SWITCH_PATH = RUNNER_PROFILE_PATHS.stopSwitch();
const PIDFILE_PATH = RUNNER_PROFILE_PATHS.pidFile();
const AUTH_REQUIRED_PATH = RUNNER_PROFILE_PATHS.authRequired();
const CONFIG_PATH = RUNNER_PROFILE_PATHS.executorConfig();

const TICK_INTERVAL_MS = 60 * 1000; // 60 seconds
const MAX_RUNTIME_PER_TICK_MS = 300 * 1000; // 300s max per tick
const MAX_BROWSER_LAUNCHES_PER_MINUTE = 1;
const BROWSER_LAUNCH_COOLDOWN_MS = 60 * 1000; // 1 minute minimum
const BACKOFF_MIN_MS = 60 * 1000; // 60s minimum
const BACKOFF_MAX_MS = 10 * 60 * 1000; // 10m maximum
const backoffSchedule = [60, 120, 300, 600]; // 60s → 2m → 5m → 10m

// Global state
let browser: Browser | null = null;
let context: BrowserContext | null = null;
let page: Page | null = null;
let consecutiveFailures = 0;
let backoffSeconds = 0;
let lastBrowserLaunchTime = 0;
let browserLaunchCount = 0;
let tickCounter = 0; // Phase 5A.1: Track tick count for health events
const HEALTH_OK_INTERVAL_MS = 60 * 1000; // Phase 5A.1: Emit HEALTH_OK every 60 seconds
let healthOkIntervalId: NodeJS.Timeout | null = null; // Dedicated interval for HEALTH_OK emission
let lastHealthOkEmittedTime = 0; // Track when HEALTH_OK was last emitted (for watchdog)
// Global state for HEALTH_OK emission (updated by main loop)
let postingReady = 0;
let postingAttempts = 0;
let replyReady = 0;
let replyAttempts = 0;
let lastError: string | undefined;

/**
 * Check STOP switch - exit gracefully within 10s
 * 🔒 PROOF_MODE BYPASS: When PROOF_MODE=true, STOP is bypassed and event is emitted instead
 */
function checkStopSwitch(): boolean {
  const proofMode = process.env.PROOF_MODE === 'true';
  const stopRequested = process.env.STOP_EXECUTOR === 'true' || fs.existsSync(STOP_SWITCH_PATH);
  
  if (stopRequested && proofMode) {
    // 🔒 PROOF_MODE: Bypass STOP, emit event instead
    (async () => {
      try {
        const { getSupabaseClient } = await import('../../src/db/index');
        const supabase = getSupabaseClient();
        const stopState = {
          env_stop: process.env.STOP_EXECUTOR === 'true',
          file_exists: fs.existsSync(STOP_SWITCH_PATH),
          file_path: STOP_SWITCH_PATH,
        };
        await supabase.from('system_events').insert({
          event_type: 'EXECUTOR_STOP_BYPASS',
          severity: 'info',
          message: 'STOP bypassed in PROOF_MODE',
          event_data: {
            reason: 'proof_mode',
            stop_state: stopState,
            proof_mode: true,
            timestamp: new Date().toISOString(),
          },
          created_at: new Date().toISOString(),
        });
        console.log(`[EXECUTOR_DAEMON] 🔒 PROOF_MODE: STOP bypassed (env=${stopState.env_stop}, file=${stopState.file_exists})`);
      } catch (e) {
        console.warn(`[EXECUTOR_DAEMON] ⚠️ Failed to emit STOP_BYPASS event: ${(e as Error).message}`);
      }
    })();
    return false; // Don't stop in PROOF_MODE
  }
  
  return stopRequested;
}

/**
 * Handle STOP switch detection - immediate cleanup and exit
 */
function handleStopSwitch(): never {
  console.log('[EXECUTOR] STOP detected');
  
  // Cleanup lock immediately (synchronous)
  cleanupLock();
  
  // Start async cleanup in background (fire and forget)
  // Don't wait for it - exit immediately
  if (page || browser) {
    (async () => {
      try {
        if (page) {
          await page.close().catch(() => {});
        }
        if (browser) {
          await browser.close().catch(() => {});
        }
      } catch {
        // Ignore all cleanup errors
      }
    })();
  }
  
  // Exit immediately without waiting for async cleanup
  process.exit(0);
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
 * Detect login wall / challenge
 */
async function detectLoginWall(page: Page): Promise<boolean> {
  try {
    const url = page.url();
    if (url.includes('/i/flow/login') || url.includes('/account/access') || url.includes('/i/flow/challenge')) {
      return true;
    }
    
    // Check for common login wall indicators
    const loginSelectors = [
      'text=/sign in/i',
      'text=/log in/i',
      '[data-testid="login"]',
      'a[href*="/i/flow/login"]',
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
  
  // Write AUTH_REQUIRED file
  try {
    fs.writeFileSync(AUTH_REQUIRED_PATH, JSON.stringify({
      detected_at: new Date().toISOString(),
      reason: 'login_wall_or_challenge_detected',
    }, null, 2), 'utf-8');
  } catch (e) {
    // Ignore
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
  
  // Ensure user data dir exists
  if (!fs.existsSync(BROWSER_USER_DATA_DIR)) {
    fs.mkdirSync(BROWSER_USER_DATA_DIR, { recursive: true });
  }
  
  // HARD REQUIREMENT: Always headless=true, userDataDir under RUNNER_PROFILE_DIR
  // Use launchPersistentContext for userDataDir support (Playwright requirement)
  context = await chromium.launchPersistentContext(BROWSER_USER_DATA_DIR, {
    headless: true, // HARD: Always headless (no visible windows)
    channel: 'chrome', // Use system Chrome
    args: [
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 },
  });
  
  // Get browser from context
  browser = context.browser();
  
  browserLaunchCount++;
  lastBrowserLaunchTime = Date.now();
  
  console.log(`[EXECUTOR_DAEMON] ✅ Browser launched (launch #${browserLaunchCount})`);
}

/**
 * Initialize browser + context + single page
 */
async function initializeBrowser(): Promise<void> {
  // Launch browser + context if needed (launchPersistentContext creates both)
  if (!context || !browser || !browser.isConnected()) {
    await launchBrowser();
  }
  
  // Context is created by launchPersistentContext, so we don't need to create it separately
  
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
  const finalPages = context.pages();
  if (finalPages.length === 0) {
    page = await context.newPage();
    console.log(`[EXECUTOR_DAEMON] ✅ Created single page`);
  } else {
    page = finalPages[0];
    console.log(`[EXECUTOR_DAEMON] ✅ Reusing existing page`);
  }
  
  // Verify page count is 1
  const verifyPages = context.pages();
  if (verifyPages.length !== 1) {
    console.error(`[EXECUTOR_DAEMON] 🚨 FATAL: Page count is ${verifyPages.length}, expected 1`);
    process.exit(1);
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
  
  // Hard cap: if still > 1, exit
  if (finalPages.length > 1) {
    console.error(`[EXECUTOR_DAEMON] 🚨 FATAL: Page count is ${finalPages.length} after cleanup, expected 1`);
    process.exit(1);
  }
}

/**
 * Run posting queue
 */
async function runPostingQueue(): Promise<{ attempts_started: number; ready: number; selected: number }> {
  try {
    const { processPostingQueue } = await import('../../src/jobs/postingQueue');
    const result = await processPostingQueue();
    return {
      attempts_started: result.attempts_started,
      ready: result.ready_candidates,
      selected: result.selected_candidates
    };
  } catch (error: any) {
    // 🔧 FIX: Catch posting queue errors to prevent daemon crash
    console.error(`[EXECUTOR_DAEMON] ⚠️  Posting queue error: ${error?.message || error}`);
    // Emit error event but don't crash daemon
    try {
      const { getSupabaseClient } = await import('../../src/db/index');
      const supabase = getSupabaseClient();
      await supabase.from('system_events').insert({
        event_type: 'EXECUTOR_POSTING_QUEUE_ERROR',
        severity: 'error',
        message: `Posting queue error: ${error?.message || String(error)}`,
        event_data: {
          error_name: error?.name || 'Error',
          error_message: error?.message || String(error),
          stack: error?.stack?.substring(0, 1000) || null,
          proof_mode: process.env.PROOF_MODE === 'true',
        },
        created_at: new Date().toISOString(),
      });
    } catch (eventError: any) {
      console.warn(`[EXECUTOR_DAEMON] ⚠️  Failed to emit error event: ${eventError.message}`);
    }
    // Return empty result to continue daemon operation
    return { attempts_started: 0, ready: 0, selected: 0 };
  }
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
    
    // Get browser pool metrics
    let browserPoolMetrics: any = {};
    try {
      const { UnifiedBrowserPool } = await import('../../src/browser/UnifiedBrowserPool');
      const pool = UnifiedBrowserPool.getInstance();
      const poolAny = pool as any;
      browserPoolMetrics = {
        browser_pool_queue_len: poolAny.queue?.length || 0,
        browser_pool_active: poolAny.getActiveCount?.() || 0,
        browser_pool_max_contexts: poolAny.MAX_CONTEXTS || 0,
        proof_queue_len: (poolAny.queue || []).filter((op: any) => op.priority === -1).length || 0,
      };
    } catch (poolError: any) {
      console.warn(`[EXECUTOR_DAEMON] Failed to get browser pool metrics: ${poolError.message}`);
    }
    
    await supabase.from('system_events').insert({
      event_type: 'EXECUTOR_DAEMON_TICK',
      severity: 'info',
      message: `Executor daemon tick: pages=${metrics.pages} browser_launches=${metrics.browserLaunchCount} posting_ready=${metrics.postingReady} posting_attempts=${metrics.postingAttempts} reply_ready=${metrics.replyReady} reply_attempts=${metrics.replyAttempts}`,
      event_data: {
        pages: metrics.pages,
        browser_launch_count: metrics.browserLaunchCount,
        posting_ready: metrics.postingReady,
        posting_attempts: metrics.postingAttempts,
        reply_ready: metrics.replyReady,
        reply_attempts: metrics.replyAttempts,
        backoff_seconds: metrics.backoff,
        last_error: metrics.lastError || null,
        profile_dir: RUNNER_PROFILE_DIR,
        mode: getModeLabel(),
        timestamp: new Date().toISOString(),
        ...browserPoolMetrics,
      },
      created_at: new Date().toISOString(),
    });
  } catch (e: any) {
    console.warn(`[EXECUTOR_DAEMON] ⚠️  Failed to emit tick event: ${e.message}`);
  }
}

/**
 * Write executor config file
 */
function writeExecutorConfig(): void {
  const config = {
    profile_dir: RUNNER_PROFILE_DIR,
    user_data_dir: BROWSER_USER_DATA_DIR,
    headless: true,
    mode: getModeLabel(),
    timestamp: new Date().toISOString(),
  };
  
  // Validate paths
  if (!path.isAbsolute(RUNNER_PROFILE_DIR)) {
    console.error(`[EXECUTOR_DAEMON] 🚨 FATAL: profile_dir is not absolute: ${RUNNER_PROFILE_DIR}`);
    process.exit(1);
  }
  
  if (!path.isAbsolute(BROWSER_USER_DATA_DIR)) {
    console.error(`[EXECUTOR_DAEMON] 🚨 FATAL: user_data_dir is not absolute: ${BROWSER_USER_DATA_DIR}`);
    process.exit(1);
  }
  
  if (!BROWSER_USER_DATA_DIR.startsWith(RUNNER_PROFILE_DIR)) {
    console.error(`[EXECUTOR_DAEMON] 🚨 FATAL: user_data_dir must be under profile_dir`);
    console.error(`[EXECUTOR_DAEMON] 🚨 profile_dir: ${RUNNER_PROFILE_DIR}`);
    console.error(`[EXECUTOR_DAEMON] 🚨 user_data_dir: ${BROWSER_USER_DATA_DIR}`);
    process.exit(1);
  }
  
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
  console.log(`[EXECUTOR_CONFIG] profile_dir=${RUNNER_PROFILE_DIR} user_data_dir=${BROWSER_USER_DATA_DIR} headless=true mode=${getModeLabel()}`);
}

/**
 * Emit lifecycle event (fire-and-forget, non-blocking)
 */
async function emitLifecycleEvent(eventType: string, eventData: any): Promise<void> {
  try {
    const { getSupabaseClient } = await import('../../src/db/index');
    const supabase = getSupabaseClient();
    await supabase.from('system_events').insert({
      event_type: eventType,
      severity: eventType.includes('CRASH') ? 'error' : 'info',
      message: `${eventType}: ${eventData.reason || eventData.phase || 'unknown'}`,
      event_data: eventData,
      created_at: new Date().toISOString(),
    });
  } catch (e: any) {
    console.warn(`[EXECUTOR_DAEMON] ⚠️  Failed to emit ${eventType}: ${e.message}`);
  }
}

/**
 * Emit HEALTH_OK event (non-blocking, fire-and-forget)
 * This function is called by setInterval and must never block or await
 */
function emitHealthOk(): void {
  // Fire-and-forget: don't await anything
  (async () => {
    try {
      const { getSupabaseClient } = await import('../../src/db/index');
      const supabase = getSupabaseClient();
      
      // Get browser pool metrics if available (non-blocking)
      let browserPoolMetrics: any = {};
      try {
        const { UnifiedBrowserPool } = await import('../../src/browser/UnifiedBrowserPool');
        const pool = UnifiedBrowserPool.getInstance();
        const poolAny = pool as any;
        browserPoolMetrics = {
          browser_pool_queue_len: poolAny.queue?.length || 0,
          browser_pool_active: poolAny.getActiveCount?.() || 0,
          browser_pool_max_contexts: poolAny.MAX_CONTEXTS || 0,
        };
      } catch (poolError: any) {
        // Ignore pool errors - don't block HEALTH_OK
      }
      
      // Get current state snapshot (read-only, no await)
      const currentTickCounter = tickCounter;
      const currentPages = page ? 1 : 0;
      const currentBrowserLaunches = browserLaunchCount;
      const currentPostingReady = postingReady;
      const currentPostingAttempts = postingAttempts;
      const currentReplyReady = replyReady;
      const currentReplyAttempts = replyAttempts;
      const currentBackoffSeconds = backoffSeconds;
      const currentLastError = lastError || null;
      
      // Insert event (fire-and-forget, don't await)
      supabase.from('system_events').insert({
        event_type: 'EXECUTOR_HEALTH_OK',
        severity: 'info',
        message: `Executor health OK: tick_count=${currentTickCounter} pages=${currentPages} browser_launches=${currentBrowserLaunches}`,
        event_data: {
          ts: new Date().toISOString(),
          tick_count: currentTickCounter,
          pages: currentPages,
          browser_launches: currentBrowserLaunches,
          posting_ready: currentPostingReady,
          posting_attempts: currentPostingAttempts,
          reply_ready: currentReplyReady,
          reply_attempts: currentReplyAttempts,
          backoff_seconds: currentBackoffSeconds,
          last_error: currentLastError,
          proof_mode: process.env.PROOF_MODE === 'true',
          ...browserPoolMetrics,
        },
        created_at: new Date().toISOString(),
      }).then(() => {
        // Success: update last emission time
        lastHealthOkEmittedTime = Date.now();
      }).catch((e: any) => {
        // Failure: log but don't stop future ticks
        console.warn(`[EXECUTOR_DAEMON] ⚠️  Failed to emit health OK event: ${e.message}`);
      });
    } catch (e: any) {
      // Catch-all: log but don't stop future ticks
      console.warn(`[EXECUTOR_DAEMON] ⚠️  Failed to emit health OK event: ${e.message}`);
    }
  })();
}

/**
 * Health watchdog: logs warning if HEALTH_OK hasn't been emitted in >90s
 * This is diagnostic only, not fatal
 */
function startHealthWatchdog(): void {
  setInterval(() => {
    const now = Date.now();
    const timeSinceLastHealthOk = now - lastHealthOkEmittedTime;
    
    if (lastHealthOkEmittedTime > 0 && timeSinceLastHealthOk > 90 * 1000) {
      console.warn(`[EXECUTOR_DAEMON] ⚠️  HEALTH_OK watchdog: ${Math.floor(timeSinceLastHealthOk / 1000)}s since last HEALTH_OK emission (threshold: 90s)`);
    }
  }, 30 * 1000); // Check every 30 seconds
}

/**
 * Main daemon loop
 */
async function main(): Promise<void> {
  // 🔒 FAIL-FAST: Check for OpenAI API key if RUNNER_MODE is enabled
  const runnerMode = process.env.RUNNER_MODE === 'true';
  if (runnerMode) {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey || !openaiApiKey.startsWith('sk-')) {
      console.error('[EXECUTOR_DAEMON] 🚨 FATAL: OPENAI_API_KEY missing or invalid');
      console.error('[EXECUTOR_DAEMON] 🚨 Mac Runner requires OPENAI_API_KEY for PLAN_ONLY content generation');
      console.error('[EXECUTOR_DAEMON] 🚨 Key present:', !!openaiApiKey);
      console.error('[EXECUTOR_DAEMON] 🚨 Key prefix:', openaiApiKey ? openaiApiKey.slice(0, 3) : 'none');
      
      // Log to system_events
      try {
        const { getSupabaseClient } = await import('../../src/db/index');
        const supabase = getSupabaseClient();
        await supabase.from('system_events').insert({
          event_type: 'mac_runner_missing_openai_key',
          severity: 'critical',
          message: 'OPENAI_API_KEY missing/invalid; Mac Runner cannot generate PLAN_ONLY content',
          event_data: {
            runner_mode: runnerMode,
            key_present: !!openaiApiKey,
            key_prefix: openaiApiKey ? openaiApiKey.slice(0, 3) : 'none',
          },
          created_at: new Date().toISOString(),
        });
      } catch (logError: any) {
        console.warn(`[EXECUTOR_DAEMON] ⚠️ Failed to log error: ${logError.message}`);
      }
      
      // Exit with code 1 (fail fast)
      process.exit(1);
    } else {
      console.log('[EXECUTOR_DAEMON] ✅ OPENAI_API_KEY present (prefix: sk-)');
    }
  }
  const daemonPid = process.pid;
  let exitCode = 0;
  let exitReason: 'normal' | 'crash' | 'signal' = 'normal';
  let exitSignal: string | null = null;
  
  // 🔧 A) Emit EXECUTOR_DAEMON_BOOT immediately at process start (before any async init)
  await emitLifecycleEvent('EXECUTOR_DAEMON_BOOT', {
    ts: new Date().toISOString(),
    pid: daemonPid,
    proof_mode: process.env.PROOF_MODE === 'true',
    execution_mode: process.env.EXECUTION_MODE || 'unknown',
    runner_profile_dir: RUNNER_PROFILE_DIR,
    node_version: process.version,
    phase: 'process_start',
  });
  
  // Phase 5A.1: Emit EXECUTOR_HEALTH_BOOT
  await emitLifecycleEvent('EXECUTOR_HEALTH_BOOT', {
    ts: new Date().toISOString(),
    pid: daemonPid,
    proof_mode: process.env.PROOF_MODE === 'true',
    execution_mode: process.env.EXECUTION_MODE || 'unknown',
    runner_profile_dir: RUNNER_PROFILE_DIR,
    node_version: process.version,
  });
  
  // 🔍 EXECUTOR STARTUP: Print current SHA and ROOT_CHECK status
  let currentSha = 'unknown';
  try {
    currentSha = execSync('git rev-parse --short HEAD', { encoding: 'utf-8', cwd: process.cwd() }).trim();
  } catch {
    // Ignore if git not available
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🚀 MAC EXECUTOR DAEMON - True Headless 24/7 Execution');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`[EXECUTOR_STARTUP] Current SHA: ${currentSha}`);
  console.log(`[EXECUTOR_STARTUP] ROOT_CHECK logging enabled (checks comprehensive table for pipeline_source)`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  try {
    // Validate executor mode
    try {
      requireExecutorMode();
    } catch (e: any) {
      console.error(`[EXECUTOR_DAEMON] 🚨 FATAL: ${e.message}`);
      exitCode = 1;
      exitReason = 'crash';
      throw e;
    }
  
  // Write config and validate paths
  writeExecutorConfig();
  
  console.log(`📋 Configuration:`);
  console.log(`   EXECUTION_MODE: ${process.env.EXECUTION_MODE}`);
  console.log(`   RUNNER_MODE: ${process.env.RUNNER_MODE}`);
  console.log(`   RUNNER_PROFILE_DIR: ${RUNNER_PROFILE_DIR}`);
  console.log(`   HEADLESS: true ✅ (HARD REQUIREMENT: always true, no visible windows)`);
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
      exitCode = 1;
      exitReason = 'crash';
      throw e;
    }
    
    // 🔧 A) Emit EXECUTOR_DAEMON_READY after browser init succeeds
    await emitLifecycleEvent('EXECUTOR_DAEMON_READY', {
      ts: new Date().toISOString(),
      pid: daemonPid,
      phase: 'browser_ready',
    });
    
    // Phase 5A.1: Emit EXECUTOR_HEALTH_READY
    await emitLifecycleEvent('EXECUTOR_HEALTH_READY', {
      ts: new Date().toISOString(),
      pid: daemonPid,
      phase: 'browser_ready',
    });
    
    console.log(`[EXECUTOR_DAEMON] ✅ Ready event emitted (PID: ${daemonPid})`);
    
    // 🔒 P1 EXECUTOR AUTH VERIFICATION: Verify logged-in state on startup
    try {
      if (context) {
        // Create a new page for auth check (don't reuse the main page)
        const authPage = await context.newPage();
        try {
          const { checkWhoami } = await import('../../src/utils/whoamiAuth');
          console.log(`[EXECUTOR_AUTH] 🔍 Verifying executor authentication...`);
          const authResult = await checkWhoami(authPage);
          
          if (authResult.logged_in) {
            console.log(`[EXECUTOR_AUTH] ✅ logged_in=true handle=${authResult.handle || 'unknown'} reason=${authResult.reason}`);
            
            // Emit system event for auth verification
            try {
              const { getSupabaseClient } = await import('../../src/db/index');
              const supabase = getSupabaseClient();
              await supabase.from('system_events').insert({
                event_type: 'EXECUTOR_AUTH_VERIFIED',
                severity: 'info',
                message: `Executor auth verified: logged_in=true handle=${authResult.handle || 'unknown'}`,
                event_data: {
                  logged_in: true,
                  handle: authResult.handle,
                  url: authResult.url,
                  reason: authResult.reason,
                  timestamp: new Date().toISOString(),
                },
                created_at: new Date().toISOString(),
              });
            } catch (e: any) {
              console.warn(`[EXECUTOR_AUTH] ⚠️ Failed to emit auth event: ${e.message}`);
            }
          } else {
            console.error(`[EXECUTOR_AUTH] ❌ logged_in=false reason=${authResult.reason}`);
            console.error(`[EXECUTOR_AUTH] 🚫 Executor is not logged in - pausing processing`);
            
            // Emit system event for invalid auth
            try {
              const { getSupabaseClient } = await import('../../src/db/index');
              const supabase = getSupabaseClient();
              await supabase.from('system_events').insert({
                event_type: 'EXECUTOR_AUTH_INVALID',
                severity: 'error',
                message: `Executor auth invalid: logged_in=false reason=${authResult.reason}`,
                event_data: {
                  logged_in: false,
                  handle: authResult.handle,
                  url: authResult.url,
                  reason: authResult.reason,
                  timestamp: new Date().toISOString(),
                },
                created_at: new Date().toISOString(),
              });
            } catch (e: any) {
              console.warn(`[EXECUTOR_AUTH] ⚠️ Failed to emit auth invalid event: ${e.message}`);
            }
            
            // Don't exit - let the daemon run but log the issue
            // The posting queue will fail gracefully if auth is invalid
          }
        } finally {
          // Always close the auth check page
          await authPage.close().catch(() => {});
        }
      } else {
        console.warn(`[EXECUTOR_AUTH] ⚠️ Context not available for auth check`);
      }
    } catch (authError: any) {
      console.error(`[EXECUTOR_AUTH] ❌ Auth verification failed: ${authError.message}`);
      // Don't exit - continue running but log the issue
    }
  
    // Start dedicated HEALTH_OK interval (non-blocking, independent of main loop)
    lastHealthOkEmittedTime = Date.now(); // Initialize timestamp
    healthOkIntervalId = setInterval(() => {
      emitHealthOk();
    }, HEALTH_OK_INTERVAL_MS);
    console.log(`[EXECUTOR_DAEMON] ✅ HEALTH_OK interval started (every ${HEALTH_OK_INTERVAL_MS / 1000}s)`);
    
    // Start health watchdog (diagnostic only)
    startHealthWatchdog();
    console.log(`[EXECUTOR_DAEMON] ✅ Health watchdog started`);
  
  // Main loop
  // tickCounter is already declared globally (Phase 5A.1)
  while (true) {
    // Check STOP switch - exit immediately if detected
    if (checkStopSwitch()) {
      handleStopSwitch();
    }
    
    // 🔒 PROOF_MODE: Emit event and skip background work
    const proofMode = process.env.PROOF_MODE === 'true';
    if (proofMode) {
      try {
        const { getSupabaseClient } = await import('../../src/db/index');
        const supabase = getSupabaseClient();
        await supabase.from('system_events').insert({
          event_type: 'EXECUTOR_PROOF_MODE_ENABLED',
          severity: 'info',
          message: 'PROOF_MODE enabled - background work paused',
          event_data: {
            proof_mode: true,
            timestamp: new Date().toISOString(),
          },
          created_at: new Date().toISOString(),
        });
        console.log(`[EXECUTOR_DAEMON] 🔒 PROOF_MODE: Background work paused`);
      } catch (e: any) {
        console.warn(`[EXECUTOR_DAEMON] Failed to emit PROOF_MODE event: ${e.message}`);
      }
    }
    
    // 🔒 GLOBAL RATE LIMIT CIRCUIT BREAKER: Check before processing any decisions
    const { isRateLimitActive, getRateLimitSecondsRemaining, emitBackoffActiveEvent, clearRateLimitState, getRateLimitState } = await import('../../src/utils/rateLimitCircuitBreaker');
    
    // Phase 5A.2: Check for expired rate limits (even if state says inactive, it might have expired)
    const rateLimitState = getRateLimitState();
    if (rateLimitState.rate_limit_until) {
      const until = new Date(rateLimitState.rate_limit_until);
      const now = new Date();
      if (now >= until) {
        // Rate limit expired - clear it (idempotent)
        await clearRateLimitState();
        console.log(`[EXECUTOR_DAEMON] ✅ Rate limit expired - cleared`);
      } else if (isRateLimitActive()) {
        // Rate limit still active
        const secondsRemaining = getRateLimitSecondsRemaining();
        console.log(`[EXECUTOR_DAEMON] ⛔ RATE LIMIT ACTIVE: Backing off for ${secondsRemaining}s (circuit breaker)`);
        await emitBackoffActiveEvent(); // Phase 5A.2: Emits EXECUTOR_RATE_LIMIT_ACTIVE
        
        // Phase 5A.2: In PROOF_MODE=false, skip claiming decisions (backoff)
        // In PROOF_MODE=true, proof decisions can bypass (handled in postingQueue)
        if (!proofMode) {
          // Sleep for 30s and continue loop (don't claim anything)
          await new Promise(resolve => setTimeout(resolve, 30000));
          
          // Phase 5A.2: After waking from backoff sleep, immediately re-check expiry
          // This ensures we detect expiry even if it happened during sleep
          const stateAfterSleep = getRateLimitState();
          if (stateAfterSleep.rate_limit_until) {
            const untilAfterSleep = new Date(stateAfterSleep.rate_limit_until);
            const nowAfterSleep = new Date();
            if (nowAfterSleep >= untilAfterSleep) {
              // Rate limit expired during sleep - clear it now (idempotent)
              await clearRateLimitState();
              console.log(`[EXECUTOR_DAEMON] ✅ Rate limit expired during backoff - cleared`);
            }
          }
          
          continue; // Skip this tick
        } else {
          // PROOF_MODE: Allow proof decisions to proceed (they will emit BYPASS events in postingQueue)
          console.log(`[EXECUTOR_DAEMON] 🔒 PROOF_MODE: Rate limit active but allowing proof decisions to proceed`);
        }
      }
    }
    
    // 🔧 A) Emit EXECUTOR_DAEMON_TICK_START event immediately before entering tick loop
    tickCounter++;
    const tickId = require('crypto').randomUUID();
    const tickStart = Date.now();
    try {
      const { getSupabaseClient } = await import('../../src/db/index');
      const supabase = getSupabaseClient();
      await supabase.from('system_events').insert({
        event_type: 'EXECUTOR_DAEMON_TICK_START',
        severity: 'info',
        message: `Executor daemon tick start: tick_id=${tickId}`,
        event_data: {
          ts: new Date().toISOString(),
          tick_id: tickId,
          tick_number: tickCounter,
          proof_mode: process.env.PROOF_MODE === 'true',
        },
        created_at: new Date().toISOString(),
      });
      
      // Phase 5A.1: Emit EXECUTOR_HEALTH_TICK
      await supabase.from('system_events').insert({
        event_type: 'EXECUTOR_HEALTH_TICK',
        severity: 'info',
        message: `Executor health tick: tick_id=${tickId} tick_count=${tickCounter}`,
        event_data: {
          ts: new Date().toISOString(),
          tick_id: tickId,
          tick_count: tickCounter,
          proof_mode: process.env.PROOF_MODE === 'true',
        },
        created_at: new Date().toISOString(),
      });
    } catch (e: any) {
      console.warn(`[EXECUTOR_DAEMON] ⚠️  Failed to emit tick start event: ${e.message}`);
    }
    
    // Update global state for HEALTH_OK emission
    postingReady = 0;
    postingAttempts = 0;
    replyReady = 0;
    replyAttempts = 0;
    lastError = undefined;
    
    try {
      // Enforce page cap
      await enforcePageCap();
      
      // Runtime cap
      const runtimeCap = setTimeout(() => {
        console.error(`[EXECUTOR_DAEMON] 🚨 RUNTIME CAP EXCEEDED: ${MAX_RUNTIME_PER_TICK_MS}ms - aborting tick`);
        throw new Error('Runtime cap exceeded');
      }, MAX_RUNTIME_PER_TICK_MS);
      
      try {
        // Check STOP switch before posting queue
        if (checkStopSwitch()) {
          handleStopSwitch();
        }
        
        // Run posting queue
        const postingResult = await runPostingQueue();
        postingReady = postingResult.ready;
        postingAttempts = postingResult.attempts_started;
        
        // Check STOP switch after posting queue
        if (checkStopSwitch()) {
          handleStopSwitch();
        }
        
        // 🔒 PROOF_MODE: Skip reply queue background work (feeds/discovery), only process proof decisions
        if (proofMode) {
          console.log(`[EXECUTOR_DAEMON] 🔒 PROOF_MODE: Skipping reply queue background work`);
          replyReady = 0;
          replyAttempts = 0;
        } else {
          // Run reply queue
          const replyResult = await runReplyQueue();
          replyReady = replyResult.ready;
          replyAttempts = replyResult.attempts_started;
        }
        
        // Check STOP switch after reply queue
        if (checkStopSwitch()) {
          handleStopSwitch();
        }
        
        // 🔧 C) Claim watchdog: Check for proof decisions selected but not claimed within 30s
        if (proofMode) {
          try {
            const { getSupabaseClient } = await import('../../src/db/index');
            const supabase = getSupabaseClient();
            const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString();
            
            // Find proof POST decisions that were selected but not claimed
            const { data: selectedPostProofDecisions } = await supabase
              .from('system_events')
              .select('event_data, created_at')
              .eq('event_type', 'EXECUTOR_PROOF_POST_SELECTED')
              .gte('created_at', thirtySecondsAgo)
              .order('created_at', { ascending: false });
            
            if (selectedPostProofDecisions && selectedPostProofDecisions.length > 0) {
              for (const selectedEvent of selectedPostProofDecisions) {
                const eventData = typeof selectedEvent.event_data === 'string' 
                  ? JSON.parse(selectedEvent.event_data) 
                  : selectedEvent.event_data;
                const decisionId = eventData.decision_id;
                
                if (!decisionId) continue;
                
                // Check if this decision was claimed
                const { data: claimEvents } = await supabase
                  .from('system_events')
                  .select('id')
                  .in('event_type', ['EXECUTOR_DECISION_CLAIM_OK', 'EXECUTOR_DECISION_CLAIM_FAIL'])
                  .eq('event_data->>decision_id', decisionId)
                  .gte('created_at', selectedEvent.created_at)
                  .limit(1);
                
                // Check if decision is still queued (not claimed)
                const { data: decisionRow } = await supabase
                  .from('content_metadata')
                  .select('status')
                  .eq('decision_id', decisionId)
                  .maybeSingle();
                
                if ((!claimEvents || claimEvents.length === 0) && decisionRow?.status === 'queued') {
                  // Selected but not claimed - emit stall event
                  const selectedTime = new Date(selectedEvent.created_at).getTime();
                  const elapsedMs = Date.now() - selectedTime;
                  
                  if (elapsedMs >= 30000) { // 30s threshold
                    await supabase.from('system_events').insert({
                      event_type: 'EXECUTOR_PROOF_POST_CLAIM_STALL',
                      severity: 'warning',
                      message: `Proof post claim stall: decision_id=${decisionId} selected ${Math.floor(elapsedMs / 1000)}s ago`,
                      event_data: {
                        decision_id: decisionId,
                        proof_tag: eventData.proof_tag || null,
                        ts: new Date().toISOString(),
                        elapsed_ms: elapsedMs,
                        selected_at: selectedEvent.created_at,
                      },
                      created_at: new Date().toISOString(),
                    });
                    console.warn(`[EXECUTOR_DAEMON] ⚠️ Claim stall detected: ${decisionId} selected ${Math.floor(elapsedMs / 1000)}s ago`);
                  }
                }
              }
            }
            
            // Find proof REPLY decisions that were selected but not claimed
            const { data: selectedReplyProofDecisions } = await supabase
              .from('system_events')
              .select('event_data, created_at')
              .eq('event_type', 'EXECUTOR_PROOF_REPLY_SELECTED')
              .gte('created_at', thirtySecondsAgo)
              .order('created_at', { ascending: false });
            
            if (selectedReplyProofDecisions && selectedReplyProofDecisions.length > 0) {
              for (const selectedEvent of selectedReplyProofDecisions) {
                const eventData = typeof selectedEvent.event_data === 'string' 
                  ? JSON.parse(selectedEvent.event_data) 
                  : selectedEvent.event_data;
                const decisionId = eventData.decision_id;
                
                if (!decisionId) continue;
                
                // Check if this decision was claimed
                const { data: claimEvents } = await supabase
                  .from('system_events')
                  .select('id')
                  .in('event_type', ['EXECUTOR_DECISION_CLAIM_OK', 'EXECUTOR_DECISION_CLAIM_FAIL'])
                  .eq('event_data->>decision_id', decisionId)
                  .gte('created_at', selectedEvent.created_at)
                  .limit(1);
                
                // Check if decision is still queued (not claimed)
                const { data: decisionRow } = await supabase
                  .from('content_metadata')
                  .select('status')
                  .eq('decision_id', decisionId)
                  .maybeSingle();
                
                if ((!claimEvents || claimEvents.length === 0) && decisionRow?.status === 'queued') {
                  // Selected but not claimed - emit stall event
                  const selectedTime = new Date(selectedEvent.created_at).getTime();
                  const elapsedMs = Date.now() - selectedTime;
                  
                  if (elapsedMs >= 30000) { // 30s threshold
                    await supabase.from('system_events').insert({
                      event_type: 'EXECUTOR_PROOF_REPLY_CLAIM_STALL',
                      severity: 'warning',
                      message: `Proof reply claim stall: decision_id=${decisionId} selected ${Math.floor(elapsedMs / 1000)}s ago`,
                      event_data: {
                        decision_id: decisionId,
                        proof_tag: eventData.proof_tag || null,
                        ts: new Date().toISOString(),
                        elapsed_ms: elapsedMs,
                        selected_at: selectedEvent.created_at,
                      },
                      created_at: new Date().toISOString(),
                    });
                    console.warn(`[EXECUTOR_DAEMON] ⚠️ Reply claim stall detected: ${decisionId} selected ${Math.floor(elapsedMs / 1000)}s ago`);
                  }
                }
              }
            }
          } catch (watchdogErr: any) {
            console.warn(`[EXECUTOR_DAEMON] ⚠️ Claim watchdog error: ${watchdogErr.message}`);
          }
        }
        
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
      
      // Calculate backoff (min 60s, max 10m)
      const failureIndex = Math.min(consecutiveFailures - 1, backoffSchedule.length - 1);
      backoffSeconds = Math.max(BACKOFF_MIN_MS / 1000, Math.min(BACKOFF_MAX_MS / 1000, backoffSchedule[failureIndex]));
      
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
    console.log(`[EXECUTOR_DAEMON] ts=${ts} pages=${pages} browser_launches=${browserLaunchCount} posting_ready=${postingReady} posting_attempts=${postingAttempts} reply_ready=${replyReady} reply_attempts=${replyAttempts} backoff=${backoffSeconds}s${lastError ? ` last_error=${lastError}` : ''}`);
    
    // Emit tick event (keep existing EXECUTOR_DAEMON_TICK for backward compatibility)
    await emitTickEvent({
      pages,
      browserLaunchCount,
      postingReady,
      postingAttempts,
      replyReady,
      replyAttempts,
      backoff: backoffSeconds,
      lastError,
    });
    
    // HEALTH_OK is now emitted by dedicated setInterval (started after browser init)
    // Removed from main loop to prevent blocking/starvation under load
    
    // 🔧 A) Emit EXECUTOR_DAEMON_TICK_END event after tick completes
    const tickEnd = Date.now();
    const tickDurationMs = tickEnd - tickStart;
    try {
      const { getSupabaseClient } = await import('../../src/db/index');
      const supabase = getSupabaseClient();
      await supabase.from('system_events').insert({
        event_type: 'EXECUTOR_DAEMON_TICK_END',
        severity: 'info',
        message: `Executor daemon tick end: tick_id=${tickId} duration=${tickDurationMs}ms`,
        event_data: {
          ts: new Date().toISOString(),
          tick_id: tickId,
          tick_number: tickCounter,
          duration_ms: tickDurationMs,
          posting_ready: postingReady,
          posting_attempts: postingAttempts,
          reply_ready: replyReady,
          reply_attempts: replyAttempts,
          pages: pages,
          backoff_seconds: backoffSeconds,
          last_error: lastError || null,
        },
        created_at: new Date().toISOString(),
      });
    } catch (e: any) {
      console.warn(`[EXECUTOR_DAEMON] ⚠️  Failed to emit tick end event: ${e.message}`);
    }
    
    // Sleep with backoff (check STOP switch every second)
    const sleepSeconds = backoffSeconds > 0 ? backoffSeconds : TICK_INTERVAL_MS / 1000;
    console.log(`[EXECUTOR_DAEMON] 💤 Sleeping ${sleepSeconds}s until next tick...`);
    
    // Sleep in 1-second chunks to check STOP switch frequently
    for (let i = 0; i < sleepSeconds; i++) {
      if (checkStopSwitch()) {
        handleStopSwitch();
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  } catch (error: any) {
    // 🔧 A) Emit EXECUTOR_DAEMON_CRASH on exception
    exitCode = 1;
    exitReason = 'crash';
    const errorStack = error?.stack || '';
    const stackLines = errorStack.split('\n');
    const sourceFile = stackLines.length > 1 ? stackLines[1]?.trim() : null;
    
    await emitLifecycleEvent('EXECUTOR_DAEMON_CRASH', {
      ts: new Date().toISOString(),
      pid: daemonPid,
      phase: 'main_loop',
      error_name: error?.name || 'Error',
      error_message: error?.message || String(error),
      stack: errorStack.substring(0, 2000), // Limit stack size
      source_file: sourceFile || null,
    });
    
    console.error(`[EXECUTOR_DAEMON] ❌ Fatal error: ${error?.message || error}`);
    throw error; // Re-throw to be caught by outer handler
  } finally {
    // 🔧 A) Emit EXECUTOR_DAEMON_EXIT in finally
    await emitLifecycleEvent('EXECUTOR_DAEMON_EXIT', {
      ts: new Date().toISOString(),
      pid: daemonPid,
      exit_code: exitCode,
      reason: exitReason,
      signal: exitSignal || null,
    });
    
    // Cleanup
    console.log('[EXECUTOR_DAEMON] 🧹 Cleaning up...');
    
    // Clear HEALTH_OK interval
    if (healthOkIntervalId) {
      clearInterval(healthOkIntervalId);
      healthOkIntervalId = null;
      console.log('[EXECUTOR_DAEMON] ✅ Cleared HEALTH_OK interval');
    }
    
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
    
    cleanupLock();
    console.log('[EXECUTOR_DAEMON] ✅ Exited gracefully');
  }
}

// 🔧 FIX: Handle unhandled promise rejections to prevent daemon crash
process.on('unhandledRejection', async (reason: any, promise: Promise<any>) => {
  const errorMessage = reason?.message || String(reason);
  const errorStack = reason?.stack || '';
  console.error(`[EXECUTOR_DAEMON] ⚠️  Unhandled promise rejection: ${errorMessage}`);
  console.error(`[EXECUTOR_DAEMON] Stack: ${errorStack.substring(0, 500)}`);
  
  // Emit crash event but don't exit (allow daemon to continue)
  try {
    const { getSupabaseClient } = await import('../../src/db/index');
    const supabase = getSupabaseClient();
    await supabase.from('system_events').insert({
      event_type: 'EXECUTOR_UNHANDLED_REJECTION',
      severity: 'error',
      message: `Unhandled promise rejection: ${errorMessage}`,
      event_data: {
        error_name: reason?.name || 'UnhandledRejection',
        error_message: errorMessage,
        stack: errorStack.substring(0, 2000),
        proof_mode: process.env.PROOF_MODE === 'true',
      },
      created_at: new Date().toISOString(),
    });
  } catch (eventError: any) {
    console.warn(`[EXECUTOR_DAEMON] ⚠️  Failed to emit unhandled rejection event: ${eventError.message}`);
  }
  
  // Don't exit - allow daemon to continue running
  // The error is logged and event is emitted, but daemon keeps running
});

// Handle signals
process.on('SIGINT', async () => {
  console.log('\n[EXECUTOR_DAEMON] 🛑 SIGINT received - exiting...');
  await emitLifecycleEvent('EXECUTOR_DAEMON_EXIT', {
    ts: new Date().toISOString(),
    pid: process.pid,
    exit_code: 0,
    reason: 'signal',
    signal: 'SIGINT',
  });
  cleanupLock();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n[EXECUTOR_DAEMON] 🛑 SIGTERM received - exiting...');
  await emitLifecycleEvent('EXECUTOR_DAEMON_EXIT', {
    ts: new Date().toISOString(),
    pid: process.pid,
    exit_code: 0,
    reason: 'signal',
    signal: 'SIGTERM',
  });
  cleanupLock();
  process.exit(0);
});

main().catch(async (error) => {
  console.error('[EXECUTOR_DAEMON] ❌ Fatal error:', error);
  await emitLifecycleEvent('EXECUTOR_DAEMON_CRASH', {
    ts: new Date().toISOString(),
    pid: process.pid,
    phase: 'main_catch',
    error_name: error?.name || 'Error',
    error_message: error?.message || String(error),
    stack: error?.stack?.substring(0, 2000) || null,
  });
  cleanupLock();
  process.exit(1);
});
