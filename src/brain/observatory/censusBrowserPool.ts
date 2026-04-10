/**
 * Census Browser Pool
 *
 * Dedicated browser pool for census operations, separate from the feed scraping
 * pool (brainBrowserPool). Census work is latency-insensitive (can be batched),
 * while feed work is time-sensitive (trending/viral needs freshness).
 *
 * Keeping them separate prevents census from starving feeds or vice versa.
 *
 * Configured via BRAIN_CENSUS_BROWSER_COUNT (default 3).
 */

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

const LOG_PREFIX = '[census/pool]';

const BROWSER_COUNT = parseInt(process.env.BRAIN_CENSUS_BROWSER_COUNT || '3', 10);
const MAX_OPS_PER_BROWSER = 300; // Higher than feed pool — census pages are simpler
const BROWSER_ARGS = [
  '--disable-blink-features=AutomationControlled',
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
];
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

interface PooledBrowser {
  id: number;
  browser: Browser;
  context: BrowserContext;
  ops: number;
  busy: boolean;
}

let pool: PooledBrowser[] = [];
let initialized = false;

async function ensurePool(): Promise<void> {
  if (initialized && pool.length > 0) {
    // Check if browsers are still connected
    const alive = pool.filter(b => b.browser.isConnected());
    if (alive.length === pool.length) return;

    // Clean up dead browsers
    for (const dead of pool.filter(b => !b.browser.isConnected())) {
      try { await dead.context.close(); } catch {}
      try { await dead.browser.close(); } catch {}
    }
    pool = alive;
  }

  // Launch browsers to reach target count
  while (pool.length < BROWSER_COUNT) {
    const id = pool.length;
    try {
      const browser = await chromium.launch({ headless: true, args: BROWSER_ARGS });
      const context = await browser.newContext({
        userAgent: USER_AGENT,
        viewport: { width: 1280, height: 800 },
        locale: 'en-US',
      });
      pool.push({ id, browser, context, ops: 0, busy: false });
    } catch (err: any) {
      console.error(`${LOG_PREFIX} Failed to launch browser ${id}: ${err.message}`);
      break;
    }
  }

  initialized = true;
  if (pool.length > 0) {
    console.log(`${LOG_PREFIX} Pool ready: ${pool.length} browsers`);
  }
}

/**
 * Run a batch of census tasks in parallel across the pool.
 * Each task gets its own page from an available browser.
 */
export async function runCensusBatch(
  tasks: Array<{ username: string; execute: (page: Page) => Promise<void> }>,
): Promise<{ completed: number; errors: number }> {
  await ensurePool();

  if (pool.length === 0) {
    console.error(`${LOG_PREFIX} No browsers available`);
    return { completed: 0, errors: tasks.length };
  }

  let completed = 0;
  let errors = 0;

  // Process tasks in chunks equal to pool size
  for (let i = 0; i < tasks.length; i += pool.length) {
    const chunk = tasks.slice(i, i + pool.length);

    const promises = chunk.map(async (task, idx) => {
      const browser = pool[idx % pool.length];
      if (!browser || browser.busy) return;

      browser.busy = true;
      let page: Page | null = null;

      try {
        // Recycle browser if too many ops
        if (browser.ops >= MAX_OPS_PER_BROWSER) {
          try { await browser.context.close(); } catch {}
          browser.context = await browser.browser.newContext({
            userAgent: USER_AGENT,
            viewport: { width: 1280, height: 800 },
            locale: 'en-US',
          });
          browser.ops = 0;
        }

        page = await browser.context.newPage();
        await task.execute(page);
        browser.ops++;
        completed++;
      } catch (err: any) {
        errors++;
      } finally {
        if (page) {
          try { await page.close(); } catch {}
        }
        browser.busy = false;
      }
    });

    await Promise.all(promises);
  }

  return { completed, errors };
}

/**
 * Get pool status for monitoring.
 */
export function getCensusPoolStatus(): { browsers: number; totalOps: number } {
  return {
    browsers: pool.filter(b => b.browser.isConnected()).length,
    totalOps: pool.reduce((sum, b) => sum + b.ops, 0),
  };
}

/**
 * Shut down all census browsers.
 */
export async function shutdownCensusPool(): Promise<void> {
  for (const browser of pool) {
    try { await browser.context.close(); } catch {}
    try { await browser.browser.close(); } catch {}
  }
  pool = [];
  initialized = false;
  console.log(`${LOG_PREFIX} Pool shut down`);
}
