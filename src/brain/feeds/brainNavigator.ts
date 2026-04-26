/**
 * Brain Navigator
 *
 * Handles navigation for brain feeds. Unlike the reply system which uses
 * safeGoto (which triggers consent wall cooldowns), brain feeds scrape
 * PUBLIC data and don't need authentication.
 *
 * When a consent wall appears, we ACCEPT it and continue.
 * When a login wall appears, we skip that page (can't scrape it anonymously).
 *
 * IMPORTANT: Brain feeds use their OWN anonymous browser, NOT the shared
 * UnifiedBrowserPool. This ensures:
 * 1. Brain never accidentally uses the auth session
 * 2. Brain scraping doesn't consume browser slots from the reply system
 * 3. Brain can run on Railway independently of the Mac runner
 */

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { applyStealth } from '../../infra/playwright/stealth';

const LOG_PREFIX = '[brain/nav]';

// Two browser contexts:
// 1. Anonymous — for profile/timeline scraping (no login needed)
// 2. Authenticated — for search/explore (X.com requires login for search)
//
// The auth context uses TWITTER_SESSION_B64 for READ-ONLY operations.
// It never posts, replies, or likes — only searches and reads.

let brainBrowser: Browser | null = null;
let anonContext: BrowserContext | null = null;
let authContext: BrowserContext | null = null;

// Age tracking. A browser/context that's alive but unresponsive (e.g. IPC wedge,
// CDP socket stalled) won't be caught by isConnected() — Playwright reports
// connected even when the process is hung. We force-recycle by wallclock too.
let brainBrowserCreatedAt: number | null = null;
let anonContextCreatedAt: number | null = null;
let authContextCreatedAt: number | null = null;
const CONTEXT_MAX_AGE_MS = 6 * 60 * 60 * 1000; // 6 hours
const BROWSER_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 hours
const BROWSER_PROBE_TIMEOUT_MS = 8000; // sanity probe must succeed in <8s
const PAGE_ACQUIRE_TIMEOUT_MS = 30_000; // total budget for getBrainPage / getBrainAuthPage

/**
 * Wrap a promise with a timeout. On timeout the rejected error is thrown,
 * but the underlying promise keeps running (we cannot cancel it from here —
 * the caller must arrange cleanup separately).
 */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms);
    p.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}

async function recycleContextIfStale(
  which: 'anon' | 'auth'
): Promise<void> {
  const now = Date.now();
  if (which === 'anon' && anonContext && anonContextCreatedAt) {
    if (now - anonContextCreatedAt > CONTEXT_MAX_AGE_MS) {
      console.log(`${LOG_PREFIX} Recycling anon context (age ${Math.round((now - anonContextCreatedAt) / 60000)}min)`);
      try { await anonContext.close(); } catch {}
      anonContext = null;
      anonContextCreatedAt = null;
    }
  }
  if (which === 'auth' && authContext && authContextCreatedAt) {
    if (now - authContextCreatedAt > CONTEXT_MAX_AGE_MS) {
      console.log(`${LOG_PREFIX} Recycling auth context (age ${Math.round((now - authContextCreatedAt) / 60000)}min)`);
      try { await authContext.close(); } catch {}
      authContext = null;
      authContextCreatedAt = null;
    }
  }
}

const BROWSER_ARGS = [
  '--disable-blink-features=AutomationControlled',
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
];

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Verify the browser is actually responsive — not just "isConnected".
 * Catches the failure mode where the browser process is alive but the CDP
 * socket / IPC is wedged (typical after long uptime or upstream X timeout).
 * Returns true on success; false on timeout/throw.
 */
async function probeBrowser(b: Browser): Promise<boolean> {
  try {
    await withTimeout(
      (async () => {
        const ctx = await b.newContext();
        try { await ctx.close(); } catch {}
      })(),
      BROWSER_PROBE_TIMEOUT_MS,
      'browser probe'
    );
    return true;
  } catch (e: any) {
    console.warn(`${LOG_PREFIX} browser probe failed: ${e.message}`);
    return false;
  }
}

async function ensureBrowser(): Promise<Browser> {
  // Wallclock age check — force-recycle stale browsers.
  if (brainBrowser && brainBrowserCreatedAt && Date.now() - brainBrowserCreatedAt > BROWSER_MAX_AGE_MS) {
    console.log(`${LOG_PREFIX} Browser too old (${Math.round((Date.now() - brainBrowserCreatedAt) / 60000)}min) — forcing recycle`);
    try { await brainBrowser.close(); } catch {}
    brainBrowser = null;
    brainBrowserCreatedAt = null;
  }

  // Connection check + responsiveness probe. isConnected() alone is not enough:
  // Playwright reports connected even when the underlying process has hung.
  if (brainBrowser?.isConnected()) {
    if (await probeBrowser(brainBrowser)) {
      return brainBrowser;
    }
    // Probe failed — browser is wedged. Tear it all down.
    console.warn(`${LOG_PREFIX} Browser unresponsive — recycling`);
  }

  try { await anonContext?.close(); } catch {}
  try { await authContext?.close(); } catch {}
  try { await brainBrowser?.close(); } catch {}
  anonContext = null;
  authContext = null;
  anonContextCreatedAt = null;
  authContextCreatedAt = null;
  brainBrowser = null;
  brainBrowserCreatedAt = null;

  console.log(`${LOG_PREFIX} Launching brain browser`);
  brainBrowser = await withTimeout(
    chromium.launch({ headless: true, args: BROWSER_ARGS }),
    20_000,
    'chromium.launch'
  );
  brainBrowserCreatedAt = Date.now();
  return brainBrowser;
}

/**
 * Get a page from the ANONYMOUS context.
 * For profile/timeline scraping — no login needed.
 *
 * Wrapped in a hard timeout: callers cannot hang indefinitely. On timeout we
 * tear the browser down so the next call gets a fresh one (recovery from
 * wedged-but-isConnected state).
 */
export async function getBrainPage(): Promise<Page> {
  return withTimeout(
    (async () => {
      const browser = await ensureBrowser();
      await recycleContextIfStale('anon');
      if (!anonContext) {
        anonContext = await browser.newContext({
          userAgent: USER_AGENT,
          viewport: { width: 1280, height: 800 },
          locale: 'en-US',
        });
        try { await applyStealth(anonContext); } catch (e: any) {
          console.warn(`${LOG_PREFIX} applyStealth failed on anon context: ${e.message}`);
        }
        anonContextCreatedAt = Date.now();
      }
      return anonContext.newPage();
    })(),
    PAGE_ACQUIRE_TIMEOUT_MS,
    'getBrainPage'
  ).catch(async (e: any) => {
    // Hard reset on timeout — kill the (likely wedged) browser so next caller gets a fresh one.
    if (String(e.message || e).includes('timeout')) {
      console.error(`${LOG_PREFIX} getBrainPage hard timeout — force-resetting browser`);
      try { await brainBrowser?.close(); } catch {}
      brainBrowser = null;
      brainBrowserCreatedAt = null;
      anonContext = null;
      anonContextCreatedAt = null;
      authContext = null;
      authContextCreatedAt = null;
    }
    throw e;
  });
}

/**
 * Get a page from the AUTHENTICATED context.
 * For search/explore — X.com requires login for these pages.
 * READ-ONLY: never writes, posts, or engages.
 *
 * Same hard-timeout + force-reset semantics as getBrainPage.
 */
export async function getBrainAuthPage(): Promise<Page> {
  return withTimeout(
    _getBrainAuthPageInner(),
    PAGE_ACQUIRE_TIMEOUT_MS,
    'getBrainAuthPage'
  ).catch(async (e: any) => {
    if (String(e.message || e).includes('timeout')) {
      console.error(`${LOG_PREFIX} getBrainAuthPage hard timeout — force-resetting browser`);
      try { await brainBrowser?.close(); } catch {}
      brainBrowser = null;
      brainBrowserCreatedAt = null;
      anonContext = null;
      anonContextCreatedAt = null;
      authContext = null;
      authContextCreatedAt = null;
    }
    throw e;
  });
}

async function _getBrainAuthPageInner(): Promise<Page> {
  const browser = await ensureBrowser();

  // Self-healing: recycle if context is too old (6h+)
  await recycleContextIfStale('auth');

  if (!authContext) {
    // Load session from environment or file
    let storageState: any = undefined;

    const sessionB64 = process.env.TWITTER_SESSION_B64;
    if (sessionB64) {
      try {
        const decoded = Buffer.from(sessionB64, 'base64').toString('utf-8');
        storageState = JSON.parse(decoded);
        console.log(`${LOG_PREFIX} Auth context: loaded session (${storageState.cookies?.length ?? 0} cookies)`);
      } catch (err: any) {
        console.warn(`${LOG_PREFIX} Auth context: failed to parse session: ${err.message}`);
      }
    }

    if (!storageState) {
      // Try loading from file
      const fs = await import('fs');
      const path = await import('path');
      const sessionPath = path.join(process.cwd(), 'twitter_session.b64');
      if (fs.existsSync(sessionPath)) {
        try {
          const raw = fs.readFileSync(sessionPath, 'utf-8').trim();
          const decoded = Buffer.from(raw, 'base64').toString('utf-8');
          storageState = JSON.parse(decoded);
          console.log(`${LOG_PREFIX} Auth context: loaded session from file (${storageState.cookies?.length ?? 0} cookies)`);
        } catch {}
      }
    }

    if (!storageState) {
      console.warn(`${LOG_PREFIX} Auth context: no session available — search/explore will hit login walls`);
    }

    authContext = await browser.newContext({
      userAgent: USER_AGENT,
      viewport: { width: 1280, height: 800 },
      locale: 'en-US',
      ...(storageState ? { storageState } : {}),
    });
    try { await applyStealth(authContext); } catch (e: any) {
      console.warn(`${LOG_PREFIX} applyStealth failed on auth context: ${e.message}`);
    }
    authContextCreatedAt = Date.now();
  }

  return authContext.newPage();
}

/**
 * Shutdown the brain browser (for graceful cleanup).
 */
export async function closeBrainBrowser(): Promise<void> {
  try { await anonContext?.close(); } catch {}
  try { await authContext?.close(); } catch {}
  try { await brainBrowser?.close(); } catch {}
  anonContext = null;
  authContext = null;
  anonContextCreatedAt = null;
  authContextCreatedAt = null;
  brainBrowser = null;
  brainBrowserCreatedAt = null;
  console.log(`${LOG_PREFIX} Brain browser closed`);
}

export interface NavResult {
  success: boolean;
  loginWall: boolean;
  consentAccepted: boolean;
}

/**
 * Navigate to a URL and handle consent/login walls for anonymous scraping.
 * Does NOT trigger the consent wall cooldown system — brain feeds are independent.
 */
export async function brainGoto(page: Page, url: string, timeoutMs: number = 25000): Promise<NavResult> {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await page.waitForTimeout(1500 + Math.random() * 1000);
  } catch (err: any) {
    console.warn(`${LOG_PREFIX} Navigation failed for ${url}: ${err.message}`);
    return { success: false, loginWall: false, consentAccepted: false };
  }

  // Handle consent wall — accept it
  let consentAccepted = false;
  try {
    // Look for common consent/cookie buttons
    const acceptBtn = page.getByRole('button', { name: /accept|agree|allow|continue|ok/i }).first();
    if (await acceptBtn.isVisible({ timeout: 3000 })) {
      await acceptBtn.click();
      await page.waitForTimeout(2000);
      consentAccepted = true;
      console.log(`${LOG_PREFIX} Consent wall accepted for ${url}`);
    }
  } catch {
    // No consent wall — good
  }

  // Check for login wall redirect
  if (page.url().includes('/i/flow/login')) {
    console.warn(`${LOG_PREFIX} Login wall hit for ${url} — skipping (anonymous scraping cannot bypass)`);
    return { success: false, loginWall: true, consentAccepted };
  }

  return { success: true, loginWall: false, consentAccepted };
}

/**
 * Wait for tweet articles to appear on the page.
 * Returns the count of articles found, or 0 if none.
 */
export async function waitForTweets(page: Page, timeoutMs: number = 12000): Promise<number> {
  try {
    await page.waitForSelector('article[data-testid="tweet"]', { timeout: timeoutMs });
    // Count them
    const count = await page.evaluate(() =>
      document.querySelectorAll('article[data-testid="tweet"]').length
    );
    return count;
  } catch {
    return 0;
  }
}

/**
 * Scroll the page to load more tweets.
 */
export async function scrollForMore(page: Page, scrollCount: number = 3, delayMs: number = 1500): Promise<void> {
  for (let i = 0; i < scrollCount; i++) {
    await page.evaluate(() => window.scrollBy(0, 1200));
    await page.waitForTimeout(delayMs + Math.random() * 500);
  }
}
