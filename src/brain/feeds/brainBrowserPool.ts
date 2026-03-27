/**
 * Brain Browser Pool
 *
 * Manages N parallel anonymous Chromium browser instances for high-throughput
 * scraping. Each browser is independent with its own context.
 *
 * Replaces the singleton pattern in brainNavigator.ts for the Growth Observatory.
 *
 * Design:
 * - N browsers controlled by BRAIN_BROWSER_COUNT env var (default 3)
 * - Work queue with priority levels (census > archive > analysis)
 * - Auto-restart browsers after MAX_OPS_PER_BROWSER operations
 * - Each browser has its own anonymous context (no auth)
 * - One optional auth browser for search/explore pages
 */

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

const LOG_PREFIX = '[brain/pool]';

const BROWSER_COUNT = parseInt(process.env.BRAIN_BROWSER_COUNT || '3', 10);
const MAX_OPS_PER_BROWSER = 200;
const BROWSER_ARGS = [
  '--disable-blink-features=AutomationControlled',
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
];
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// =============================================================================
// Types
// =============================================================================

export type TaskPriority = 'high' | 'medium' | 'low';

interface PooledBrowser {
  id: number;
  browser: Browser;
  context: BrowserContext;
  ops: number;
  createdAt: number;
  busy: boolean;
}

interface QueuedTask {
  priority: TaskPriority;
  priorityNum: number; // 3=high, 2=medium, 1=low
  execute: (page: Page) => Promise<void>;
  resolve: () => void;
  reject: (err: Error) => void;
  queuedAt: number;
}

// =============================================================================
// Pool State
// =============================================================================

let browsers: PooledBrowser[] = [];
const taskQueue: QueuedTask[] = [];
let initialized = false;
let processing = false;

// =============================================================================
// Initialization
// =============================================================================

async function ensureInitialized(): Promise<void> {
  if (initialized && browsers.length > 0) return;

  console.log(`${LOG_PREFIX} Initializing ${BROWSER_COUNT} anonymous browsers...`);

  const startTime = Date.now();
  browsers = [];

  for (let i = 0; i < BROWSER_COUNT; i++) {
    try {
      const browser = await chromium.launch({ headless: true, args: BROWSER_ARGS });
      const context = await browser.newContext({
        userAgent: USER_AGENT,
        viewport: { width: 1280, height: 800 },
        locale: 'en-US',
      });

      browsers.push({
        id: i,
        browser,
        context,
        ops: 0,
        createdAt: Date.now(),
        busy: false,
      });
    } catch (err: any) {
      console.error(`${LOG_PREFIX} Failed to create browser ${i}: ${err.message}`);
    }
  }

  initialized = true;
  const duration = Date.now() - startTime;
  console.log(`${LOG_PREFIX} Pool ready: ${browsers.length}/${BROWSER_COUNT} browsers (${duration}ms)`);
}

// =============================================================================
// Browser lifecycle
// =============================================================================

async function recycleBrowser(pooled: PooledBrowser): Promise<void> {
  const id = pooled.id;
  try {
    await pooled.context.close();
    await pooled.browser.close();
  } catch { /* ignore cleanup errors */ }

  try {
    const browser = await chromium.launch({ headless: true, args: BROWSER_ARGS });
    const context = await browser.newContext({
      userAgent: USER_AGENT,
      viewport: { width: 1280, height: 800 },
      locale: 'en-US',
    });

    pooled.browser = browser;
    pooled.context = context;
    pooled.ops = 0;
    pooled.createdAt = Date.now();
    pooled.busy = false;

    console.log(`${LOG_PREFIX} Browser ${id} recycled (was at ${pooled.ops} ops)`);
  } catch (err: any) {
    console.error(`${LOG_PREFIX} Failed to recycle browser ${id}: ${err.message}`);
    // Remove from pool
    browsers = browsers.filter(b => b.id !== id);
  }
}

// =============================================================================
// Task Queue
// =============================================================================

function getAvailableBrowser(): PooledBrowser | null {
  return browsers.find(b => !b.busy && b.browser.isConnected()) || null;
}

async function processQueue(): Promise<void> {
  if (processing) return;
  processing = true;

  try {
    while (taskQueue.length > 0) {
      const browser = getAvailableBrowser();
      if (!browser) break; // All busy, wait for one to free up

      // Sort queue by priority (highest first), then age (oldest first)
      taskQueue.sort((a, b) => b.priorityNum - a.priorityNum || a.queuedAt - b.queuedAt);

      const task = taskQueue.shift()!;
      browser.busy = true;

      // Execute task without blocking the queue processor
      executeTask(browser, task).catch(() => {});
    }
  } finally {
    processing = false;
  }
}

async function executeTask(pooled: PooledBrowser, task: QueuedTask): Promise<void> {
  let page: Page | null = null;

  try {
    // Check if browser needs recycling
    if (pooled.ops >= MAX_OPS_PER_BROWSER) {
      await recycleBrowser(pooled);
    }

    page = await pooled.context.newPage();
    await task.execute(page);
    pooled.ops++;
    task.resolve();
  } catch (err: any) {
    task.reject(err);
  } finally {
    try { await page?.close(); } catch {}
    pooled.busy = false;
    // Check if more tasks are waiting
    if (taskQueue.length > 0) {
      processQueue().catch(() => {});
    }
  }
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Submit a task to the browser pool.
 * Returns a promise that resolves when the task is complete.
 *
 * Usage:
 *   await submitTask('high', async (page) => {
 *     await page.goto('https://x.com/someuser');
 *     const followers = await extractFollowerCount(page);
 *   });
 */
export async function submitTask(
  priority: TaskPriority,
  execute: (page: Page) => Promise<void>,
): Promise<void> {
  await ensureInitialized();

  const priorityNum = priority === 'high' ? 3 : priority === 'medium' ? 2 : 1;

  return new Promise<void>((resolve, reject) => {
    taskQueue.push({
      priority,
      priorityNum,
      execute,
      resolve,
      reject,
      queuedAt: Date.now(),
    });

    processQueue().catch(() => {});
  });
}

/**
 * Submit a batch of tasks. Returns when ALL are complete.
 * Tasks run in parallel across available browsers.
 */
export async function submitBatch(
  priority: TaskPriority,
  tasks: ((page: Page) => Promise<void>)[],
): Promise<{ completed: number; errors: number }> {
  let completed = 0;
  let errors = 0;

  const promises = tasks.map(task =>
    submitTask(priority, task)
      .then(() => { completed++; })
      .catch(() => { errors++; })
  );

  await Promise.all(promises);
  return { completed, errors };
}

/**
 * Get pool status for monitoring.
 */
export function getPoolStatus(): {
  browsers_total: number;
  browsers_busy: number;
  browsers_idle: number;
  queue_length: number;
  total_ops: number;
} {
  return {
    browsers_total: browsers.length,
    browsers_busy: browsers.filter(b => b.busy).length,
    browsers_idle: browsers.filter(b => !b.busy).length,
    queue_length: taskQueue.length,
    total_ops: browsers.reduce((sum, b) => sum + b.ops, 0),
  };
}

/**
 * Shutdown the pool gracefully.
 */
export async function shutdownPool(): Promise<void> {
  console.log(`${LOG_PREFIX} Shutting down ${browsers.length} browsers...`);
  for (const pooled of browsers) {
    try {
      await pooled.context.close();
      await pooled.browser.close();
    } catch {}
  }
  browsers = [];
  initialized = false;
  console.log(`${LOG_PREFIX} Pool shutdown complete`);
}
