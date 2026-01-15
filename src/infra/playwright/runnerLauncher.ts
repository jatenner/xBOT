/**
 * 🏃 MAC RUNNER LAUNCHER
 * Uses SYSTEM Google Chrome.app (not Chrome for Testing)
 * For headed interactive login and session management
 */

import { chromium, BrowserContext } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const RUNNER_PROFILE_DIR = process.env.RUNNER_PROFILE_DIR || path.join(process.cwd(), '.runner-profile');

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
 * Launch persistent context using SYSTEM Chrome (for Mac Runner)
 * This is for headed interactive use (login, debugging)
 */
export async function launchRunnerPersistent(headless: boolean = false): Promise<BrowserContext> {
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
  if (!headless) {
    // Minimal args for headed mode - don't disable features that break rendering
    // Allow multiple instances to avoid SingletonLock errors
    launchOptions.args = [
      '--disable-blink-features=AutomationControlled',
      '--disable-features=ProcessSingleton', // Allow multiple instances
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

  const ctx = await chromium.launchPersistentContext(RUNNER_PROFILE_DIR, launchOptions);

  console.log(`[RUNNER_LAUNCHER] ✅ Context launched`);
  return ctx;
}
