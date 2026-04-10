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

// Context age tracking for self-healing recycle.
// Long-lived browser contexts accumulate memory over hours of operation —
// old contexts get recycled even if technically still working.
let anonContextCreatedAt: number | null = null;
let authContextCreatedAt: number | null = null;
const CONTEXT_MAX_AGE_MS = 6 * 60 * 60 * 1000; // 6 hours

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

async function ensureBrowser(): Promise<Browser> {
  if (brainBrowser?.isConnected()) return brainBrowser;

  try { await anonContext?.close(); } catch {}
  try { await authContext?.close(); } catch {}
  try { await brainBrowser?.close(); } catch {}
  anonContext = null;
  authContext = null;
  anonContextCreatedAt = null;
  authContextCreatedAt = null;

  console.log(`${LOG_PREFIX} Launching brain browser`);
  brainBrowser = await chromium.launch({ headless: true, args: BROWSER_ARGS });
  return brainBrowser;
}

/**
 * Get a page from the ANONYMOUS context.
 * For profile/timeline scraping — no login needed.
 */
export async function getBrainPage(): Promise<Page> {
  const browser = await ensureBrowser();

  // Self-healing: recycle if context is too old (6h+)
  await recycleContextIfStale('anon');

  if (!anonContext) {
    anonContext = await browser.newContext({
      userAgent: USER_AGENT,
      viewport: { width: 1280, height: 800 },
      locale: 'en-US',
    });
    anonContextCreatedAt = Date.now();
  }

  return anonContext.newPage();
}

/**
 * Get a page from the AUTHENTICATED context.
 * For search/explore — X.com requires login for these pages.
 * READ-ONLY: never writes, posts, or engages.
 */
export async function getBrainAuthPage(): Promise<Page> {
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
