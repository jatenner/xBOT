import { chromium, Browser, BrowserContext } from 'playwright';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

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
    browser = await chromium.launch({
      headless: true, // Always headless in containers
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        // Remove all headed-only flags
      ],
      timeout: 45000
    });

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

  // Load storage state if provided and exists
  if (storageStatePath && existsSync(storageStatePath)) {
    console.log(`BROWSER_FACTORY: Loading storage state from ${storageStatePath}`);
    contextOptions.storageState = storageStatePath;
  }

  const context = await b.newContext(contextOptions);
  
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
