#!/usr/bin/env tsx
/**
 * 🔐 REFRESH TWITTER SESSION B64
 * 
 * Exports Twitter session cookies from an authenticated Chrome profile
 * and outputs a base64-encoded string suitable for TWITTER_SESSION_B64.
 * 
 * Two modes:
 * 1) From existing authenticated Chrome profile (preferred)
 * 2) Manual login assist (fallback)
 */

import { chromium, BrowserContext, Page } from 'playwright';
import fs from 'fs';
import path from 'path';
import { homedir } from 'os';

const RUNTIME_SECRETS_DIR = path.join(process.cwd(), 'runtime', 'secrets');

// Ensure secrets directory exists and is gitignored
if (!fs.existsSync(RUNTIME_SECRETS_DIR)) {
  fs.mkdirSync(RUNTIME_SECRETS_DIR, { recursive: true });
}

/**
 * Expand ~ to home directory
 */
function expandHomeDir(p: string): string {
  if (p.startsWith('~')) {
    return p.replace('~', homedir());
  }
  return p;
}

/**
 * Resolve Chrome profile directory
 */
function resolveChromeProfileDir(): string | null {
  // Priority order:
  // 1. SESSION_CANONICAL_PATH (if it's a directory)
  // 2. PW_USER_DATA_DIR
  // 3. CHROME_USER_DATA_DIR
  // 4. RUNNER_PROFILE_DIR
  // 5. Default Chrome location

  if (process.env.SESSION_CANONICAL_PATH) {
    const p = expandHomeDir(process.env.SESSION_CANONICAL_PATH);
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) {
      return p;
    }
  }

  if (process.env.PW_USER_DATA_DIR) {
    return expandHomeDir(process.env.PW_USER_DATA_DIR);
  }

  if (process.env.CHROME_USER_DATA_DIR) {
    return expandHomeDir(process.env.CHROME_USER_DATA_DIR);
  }

  if (process.env.RUNNER_PROFILE_DIR) {
    return expandHomeDir(process.env.RUNNER_PROFILE_DIR);
  }

  // Default Chrome location (macOS)
  const defaultChromeDir = path.join(homedir(), 'Library', 'Application Support', 'Google', 'Chrome');
  if (fs.existsSync(defaultChromeDir)) {
    return defaultChromeDir;
  }

  return null;
}

/**
 * Check if user is logged in to X.com
 */
async function checkLoggedIn(page: Page): Promise<boolean> {
  const finalUrl = page.url();
  const pageTitle = await page.title().catch(() => 'unknown');

  const isLoginRedirect = finalUrl.includes('/i/flow/login') || finalUrl.includes('/login');
  const isLoginTitle = pageTitle.toLowerCase().includes('log in') || pageTitle === 'X' || pageTitle === 'X / X';

  const hasTimeline = await page.evaluate(() => {
    return !!(
      document.querySelector('[data-testid="primaryColumn"]') ||
      document.querySelector('main') ||
      document.querySelector('section') ||
      document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]')
    );
  }).catch(() => false);

  return !isLoginRedirect && !isLoginTitle && hasTimeline;
}

/**
 * Validate cookies have required auth tokens
 */
function validateAuthCookies(cookies: any[]): { valid: boolean; reason?: string } {
  const twitterCookies = cookies.filter((c: any) =>
    c.domain && (c.domain.includes('.x.com') || c.domain.includes('.twitter.com'))
  );

  const authToken = twitterCookies.find((c: any) => c.name === 'auth_token');
  const ct0 = twitterCookies.find((c: any) => c.name === 'ct0');

  if (!authToken) {
    return { valid: false, reason: 'auth_token cookie missing' };
  }

  if (!ct0) {
    return { valid: false, reason: 'ct0 cookie missing' };
  }

  return { valid: true };
}

/**
 * Mode 1: Export from existing Chrome profile
 */
async function exportFromProfile(): Promise<string> {
  const profileDir = resolveChromeProfileDir();

  if (!profileDir) {
    throw new Error(
      'No Chrome profile directory found. Set one of: SESSION_CANONICAL_PATH, PW_USER_DATA_DIR, CHROME_USER_DATA_DIR, or RUNNER_PROFILE_DIR'
    );
  }

  if (!fs.existsSync(profileDir)) {
    throw new Error(`Chrome profile directory not found: ${profileDir}`);
  }

  console.log(`[REFRESH_SESSION] 📁 Using profile directory: ${profileDir}`);

  const usePersistentBrowser = process.env.PLAYWRIGHT_PERSIST_BROWSER === 'true';
  const headless = process.env.HEADLESS !== 'false';

  console.log(`[REFRESH_SESSION] 🚀 Launching ${usePersistentBrowser ? 'persistent' : 'temporary'} context (headless=${headless})...`);

  let context: BrowserContext;

  if (usePersistentBrowser) {
    context = await chromium.launchPersistentContext(profileDir, {
      headless,
      channel: 'chrome',
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
      ],
      viewport: { width: 1280, height: 720 },
    });
  } else {
    const browser = await chromium.launch({
      headless,
      channel: 'chrome',
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
      ],
    });

    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
  }

  try {
    const page = context.pages()[0] || await context.newPage();

    console.log(`[REFRESH_SESSION] 📍 Navigating to https://x.com/home...`);
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 60000 });

    await page.waitForTimeout(3000);

    console.log(`[REFRESH_SESSION] 🔍 Checking authentication status...`);
    const loggedIn = await checkLoggedIn(page);

    if (!loggedIn) {
      throw new Error(
        'Not logged in to X.com. Please log in manually in Chrome, then rerun this script.'
      );
    }

    console.log(`[REFRESH_SESSION] ✅ Authentication confirmed`);

    const storageState = await context.storageState();
    const cookies = storageState.cookies || [];

    const validation = validateAuthCookies(cookies);
    if (!validation.valid) {
      throw new Error(`Auth validation failed: ${validation.reason}`);
    }

    // Save intermediate JSON to secrets directory (gitignored)
    const timestamp = Date.now();
    const cookiesFile = path.join(RUNTIME_SECRETS_DIR, `cookies-${timestamp}.json`);
    const storageFile = path.join(RUNTIME_SECRETS_DIR, `storage-${timestamp}.json`);

    fs.writeFileSync(cookiesFile, JSON.stringify(cookies, null, 2));
    fs.writeFileSync(storageFile, JSON.stringify(storageState, null, 2));

    console.log(`[REFRESH_SESSION] 💾 Saved intermediate files:`);
    console.log(`   Cookies: ${cookiesFile}`);
    console.log(`   Storage: ${storageFile}`);

    const storageStateJson = JSON.stringify(storageState);
    const base64String = Buffer.from(storageStateJson).toString('base64');

    return base64String;
  } finally {
    await context.close();
  }
}

/**
 * Mode 2: Manual login assist
 */
async function manualLoginAssist(): Promise<string> {
  console.log(`[REFRESH_SESSION] 🔐 Manual login mode`);
  console.log(`[REFRESH_SESSION] 🚀 Launching headed browser (isolated profile, won't conflict with open Chrome)...`);

  // Always use isolated temp profile for manual mode - avoids ProcessSingleton conflict with open Chrome
  const profileDir = path.join(process.cwd(), '.temp-profile');

  if (!fs.existsSync(profileDir)) {
    fs.mkdirSync(profileDir, { recursive: true });
  }

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    channel: 'chrome',
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
    ],
    viewport: { width: 1280, height: 720 },
  });

  try {
    const page = context.pages()[0] || await context.newPage();

    console.log(`[REFRESH_SESSION] 📍 Opening https://x.com/home`);
    console.log(`[REFRESH_SESSION] ⏳ Please log in manually in the browser window...`);
    console.log(`[REFRESH_SESSION] ⏳ Waiting for login...`);

    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Poll for login
    let loggedIn = false;
    for (let i = 0; i < 60; i++) {
      await page.waitForTimeout(2000);
      loggedIn = await checkLoggedIn(page);
      if (loggedIn) {
        break;
      }
      if (i % 5 === 0) {
        console.log(`[REFRESH_SESSION] ⏳ Still waiting for login... (${i * 2}s)`);
      }
    }

    if (!loggedIn) {
      throw new Error('Login timeout. Please ensure you are logged in to X.com.');
    }

    console.log(`[REFRESH_SESSION] ✅ Login detected`);

    const storageState = await context.storageState();
    const cookies = storageState.cookies || [];

    const validation = validateAuthCookies(cookies);
    if (!validation.valid) {
      throw new Error(`Auth validation failed: ${validation.reason}`);
    }

    // Save intermediate JSON to secrets directory
    const timestamp = Date.now();
    const cookiesFile = path.join(RUNTIME_SECRETS_DIR, `cookies-${timestamp}.json`);
    const storageFile = path.join(RUNTIME_SECRETS_DIR, `storage-${timestamp}.json`);

    fs.writeFileSync(cookiesFile, JSON.stringify(cookies, null, 2));
    fs.writeFileSync(storageFile, JSON.stringify(storageState, null, 2));

    console.log(`[REFRESH_SESSION] 💾 Saved intermediate files:`);
    console.log(`   Cookies: ${cookiesFile}`);
    console.log(`   Storage: ${storageFile}`);

    const storageStateJson = JSON.stringify(storageState);
    const base64String = Buffer.from(storageStateJson).toString('base64');

    return base64String;
  } finally {
    await context.close();
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const mode = process.env.MODE || 'profile'; // 'profile' or 'manual'

  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔐 Refresh Twitter Session B64');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    let base64String: string;

    if (mode === 'manual') {
      base64String = await manualLoginAssist();
    } else {
      base64String = await exportFromProfile();
    }

    const cookieCount = JSON.parse(Buffer.from(base64String, 'base64').toString('utf8')).cookies?.length || 0;

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ Session Export Complete');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`Cookies count: ${cookieCount}`);
    console.log(`Base64 length: ${base64String.length}\n`);
    console.log('TWITTER_SESSION_B64=' + base64String);
    console.log('');

  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main().catch(console.error);
