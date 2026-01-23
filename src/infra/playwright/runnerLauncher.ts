/**
 * 🏃 MAC RUNNER LAUNCHER
 * Uses SYSTEM Google Chrome.app (not Chrome for Testing)
 * Supports both direct launch and CDP connection modes
 */

import { chromium, BrowserContext } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const RUNNER_PROFILE_DIR = process.env.RUNNER_PROFILE_DIR || path.join(process.cwd(), '.runner-profile');
const RUNNER_BROWSER = process.env.RUNNER_BROWSER || 'cdp'; // 'cdp' or 'direct'
const CDP_PORT = parseInt(process.env.CDP_PORT || '9222', 10);

/**
 * Find system Chrome executable on macOS
 */
function findSystemChrome(): string | null {
  // Check env override first
  if (process.env.RUNNER_CHROME_PATH) {
    if (fs.existsSync(process.env.RUNNER_CHROME_PATH)) {
      return process.env.RUNNER_CHROME_PATH;
    }
    console.warn(`[RUNNER_LAUNCHER] ⚠️  RUNNER_CHROME_PATH set but not found: ${process.env.RUNNER_CHROME_PATH}`);
  }
  
  // Try standard Chrome.app
  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (fs.existsSync(chromePath)) {
    return chromePath;
  }
  
  // Try Chrome Canary
  const canaryPath = '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary';
  if (fs.existsSync(canaryPath)) {
    return canaryPath;
  }
  
  return null;
}

/**
 * Check if CDP is running
 */
async function isCDPRunning(): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Launch persistent context using SYSTEM Chrome (for Mac Runner)
 * Supports CDP mode (connect to running Chrome) or direct launch
 */
export async function launchRunnerPersistent(headless: boolean = false): Promise<BrowserContext> {
  // CDP mode: connect to running Chrome
  if (RUNNER_BROWSER === 'cdp') {
    console.log(`[RUNNER_LAUNCHER] 🔌 CDP mode: connecting to Chrome on port ${CDP_PORT}`);
    
    // 🔍 TASK 1: Log Chrome profile path
    const CDP_PROFILE_DIR = path.join(RUNNER_PROFILE_DIR, '.chrome-cdp-profile');
    console.log(`[RUNNER_LAUNCHER] 📁 Chrome profile path: ${CDP_PROFILE_DIR}`);
    console.log(`[RUNNER_LAUNCHER] 📁 Profile directory (user-data-dir): ${CDP_PROFILE_DIR}`);
    
    // Check if CDP is running
    if (!(await isCDPRunning())) {
      throw new Error(`Chrome CDP not running on port ${CDP_PORT}. Run: pnpm run runner:chrome-cdp or pnpm run runner:login`);
    }
    
    try {
      // 🛡️ EXECUTOR GUARD: Check stop switch and Chrome process cap before connecting
      const { checkStopSwitch, closeExtraPages, logGuardState, checkChromeProcessCap } = await import('../executorGuard');
      checkStopSwitch();
      checkChromeProcessCap();
      
      const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);
      const contexts = browser.contexts();
      
      let context: BrowserContext;
      if (contexts.length > 0) {
        console.log(`[RUNNER_LAUNCHER] ✅ Connected to existing Chrome context (${contexts.length} contexts)`);
        context = contexts[0];
      } else {
        context = await browser.newContext();
        console.log(`[RUNNER_LAUNCHER] ✅ Created new context in CDP Chrome`);
      }
      
      // 🛡️ TAB LEAK GUARDRAIL: Close extra pages, keep only 1 (HARD CAP: exits if > 3)
      await closeExtraPages(context);
      await logGuardState(context);
      
      return context;
    } catch (error: any) {
      throw new Error(`Failed to connect to Chrome CDP: ${error.message}`);
    }
  }
  
  // Direct launch mode (fallback)
  // Ensure profile dir exists
  if (!fs.existsSync(RUNNER_PROFILE_DIR)) {
    fs.mkdirSync(RUNNER_PROFILE_DIR, { recursive: true });
  }

  // Remove SingletonLock if it exists (allows launching even if previous instance crashed)
  const singletonLockPath = path.join(RUNNER_PROFILE_DIR, 'SingletonLock');
  if (fs.existsSync(singletonLockPath)) {
    try {
      fs.unlinkSync(singletonLockPath);
      console.log(`[RUNNER_LAUNCHER] 🗑️  Removed stale SingletonLock`);
    } catch (e) {
      // Ignore - might be locked by running Chrome
    }
  }

  const systemChrome = findSystemChrome();
  const executablePath = systemChrome;
  
  if (executablePath) {
    console.log(`[RUNNER_LAUNCHER] 🏃 Using SYSTEM Chrome: ${executablePath}`);
  } else {
    console.warn(`[RUNNER_LAUNCHER] ⚠️  System Chrome not found, falling back to Playwright Chromium`);
    console.warn(`   Set RUNNER_CHROME_PATH=/path/to/chrome to use system Chrome`);
  }
  
  console.log(`[RUNNER_LAUNCHER] Profile directory: ${RUNNER_PROFILE_DIR}`);
  console.log(`[RUNNER_LAUNCHER] Headless: ${headless}`);

  const launchOptions: any = {
    headless,
    userDataDir: RUNNER_PROFILE_DIR,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: headless ? { width: 1920, height: 1080 } : null, // Let headed mode use natural size
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
    ],
  };

  // Only add executablePath if system Chrome found
  if (executablePath) {
    launchOptions.executablePath = executablePath;
  }

  // In headed mode, avoid args that break UI rendering
  // NOTE: We don't use direct launch in CDP mode, but keep this for fallback
  if (!headless) {
    // Minimal args - NO automation flags that cause Chrome banners
    launchOptions.args = [
      // Removed: --disable-blink-features=AutomationControlled (causes banner)
    ];
  } else {
    // More aggressive args for headless
    launchOptions.args.push(
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--headless=new',
      '--disable-gpu',
    );
  }

  // 🛡️ EXECUTOR GUARD: Check stop switch before launching
  const { checkStopSwitch, closeExtraPages, logGuardState } = await import('../executorGuard');
  checkStopSwitch();
  
  const ctx = await chromium.launchPersistentContext(RUNNER_PROFILE_DIR, launchOptions);

  // 🛡️ TAB LEAK GUARDRAIL: Close extra pages, keep only 1
  await closeExtraPages(ctx);
  await logGuardState(ctx);

  console.log(`[RUNNER_LAUNCHER] ✅ Context launched`);
  return ctx;
}
