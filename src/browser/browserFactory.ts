import { chromium, Browser, BrowserContext } from 'playwright';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { loadTwitterStorageState, cloneStorageState, type TwitterStorageState } from '../utils/twitterSessionState';

const RESOURCE_ERROR_PATTERNS = [
  'Resource temporarily unavailable',
  'Target page, context or browser has been closed',
  'zygote could not fork',
  'pthread_create'
];

const parseCooldown = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.max(60000, Math.min(parsed, 900000));
};

const RESOURCE_COOLDOWN_MS = parseCooldown(process.env.BROWSER_RESOURCE_COOLDOWN_MS, 180000);

let lastResourceErrorAt = 0;

const isResourceError = (error: any): boolean => {
  if (!error || typeof error.message !== 'string') {
    return false;
  }
  const message = error.message.toLowerCase();
  return RESOURCE_ERROR_PATTERNS.some(pattern => message.includes(pattern.toLowerCase()));
};

const markResourceError = (message: string): void => {
  lastResourceErrorAt = Date.now();
  console.error(`BROWSER_FACTORY: ❌ Resource exhaustion detected (${message})`);
};

const assertResourceCooldown = (): void => {
  if (lastResourceErrorAt === 0) {
    return;
  }
  const elapsed = Date.now() - lastResourceErrorAt;
  if (elapsed < RESOURCE_COOLDOWN_MS) {
    const remaining = Math.max(0, RESOURCE_COOLDOWN_MS - elapsed);
    console.warn(`BROWSER_FACTORY: ⏳ Resource cooldown active (${Math.ceil(remaining / 1000)}s remaining)`);
    throw new Error(`Browser resources exhausted - cooldown ${Math.ceil(remaining / 1000)}s remaining`);
  }
};

let browser: Browser | null = null;
let isInitializing = false;

/**
 * Reliable browser factory for Railway/container environments
 * Enforces headless mode and minimal, stable configuration
 */
export async function getBrowser(): Promise<Browser> {
  // If browser exists and is connected, return it
  if (browser && browser.isConnected()) {
    return browser;
  }

  // Prevent concurrent initialization
  if (isInitializing) {
    while (isInitializing) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (browser && browser.isConnected()) {
      return browser;
    }
  }

  isInitializing = true;
  
  try {
    // Close any existing browser
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        console.warn('BROWSER_FACTORY: Failed to close existing browser:', e);
      }
      browser = null;
    }

    // Launch with minimal, stable configuration
    console.log('BROWSER_FACTORY: Launching headless browser...');
    assertResourceCooldown();
    try {
      browser = await chromium.launch({
        headless: true, // Always headless in containers
        args: [
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--headless=new' // Force new headless mode (fixes zygote crash)
        ],
        timeout: 45000
      });
      lastResourceErrorAt = 0;
    } catch (error: any) {
      if (isResourceError(error)) {
        markResourceError(error.message || 'launch failed');
      }
      throw error;
    }

    console.log('BROWSER_FACTORY: Browser initialized successfully');
    return browser;
  } finally {
    isInitializing = false;
  }
}

/**
 * Creates a new context with session management
 */
export async function createContext(storageStatePath?: string): Promise<BrowserContext> {
  const b = await getBrowser();
  
  const contextOptions: any = {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 },
    locale: 'en-US',
    timezoneId: 'America/New_York'
  };

  // Load storage state from TWITTER_SESSION_B64 environment variable first
  let storageState: TwitterStorageState | undefined;

  const sessionResult = await loadTwitterStorageState();
  if (sessionResult.warnings && sessionResult.warnings.length > 0) {
    for (const warning of sessionResult.warnings) {
      console.warn(`BROWSER_FACTORY: ⚠️ Session warning - ${warning}`);
    }
  }
  if (sessionResult.storageState && sessionResult.cookieCount > 0) {
    storageState = cloneStorageState(sessionResult.storageState);
    console.log(`BROWSER_FACTORY: ✅ Loaded session from ${sessionResult.source} (${sessionResult.cookieCount} cookies)`);
  } else if (storageStatePath && existsSync(storageStatePath)) {
    console.log(`BROWSER_FACTORY: Loading storage state from ${storageStatePath}`);
    contextOptions.storageState = storageStatePath;
  } else {
    if (sessionResult.source === 'none') {
      console.warn('BROWSER_FACTORY: ⚠️ No Twitter session found - context will be unauthenticated');
    }
  }

  if (storageState) {
    contextOptions.storageState = storageState;
  }

  assertResourceCooldown();
  let context: BrowserContext;
  try {
    context = await b.newContext(contextOptions);
    lastResourceErrorAt = 0;
  } catch (error: any) {
    if (isResourceError(error)) {
      markResourceError(error.message || 'context creation failed');
    }
    throw error;
  }
  
  // Ensure artifacts directory exists
  const artifactsDir = join(process.cwd(), 'artifacts');
  if (!existsSync(artifactsDir)) {
    mkdirSync(artifactsDir, { recursive: true });
  }

  return context;
}

/**
 * Cleanup browser resources
 */
export async function closeBrowser(): Promise<void> {
  if (browser) {
    try {
      await browser.close();
      console.log('BROWSER_FACTORY: Browser closed successfully');
    } catch (e) {
      console.warn('BROWSER_FACTORY: Error closing browser:', e);
    } finally {
      browser = null;
    }
  }
}
