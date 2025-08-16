import { chromium, Browser, BrowserContext, Page } from 'playwright';

let browser: Browser | null = null;
let isInitializing = false;

/**
 * Singleton browser factory that prevents "browser closed" errors
 * by maintaining a persistent browser instance and auto-resetting on failure
 */
export async function getBrowser(): Promise<Browser> {
  // If browser exists and is connected, return it
  if (browser && browser.isConnected()) {
    return browser;
  }

  // Prevent concurrent initialization
  if (isInitializing) {
    // Wait for ongoing initialization
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
        console.warn('Failed to close existing browser:', e);
      }
      browser = null;
    }

    // Launch new browser with optimized settings
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--memory-pressure-off',
        '--max_old_space_size=4096'
      ]
    });

    console.log('🌐 Browser initialized successfully');
    return browser;
  } finally {
    isInitializing = false;
  }
}

/**
 * Creates a new context with Twitter-optimized settings
 */
export async function createContext(): Promise<BrowserContext> {
  const b = await getBrowser();
  const context = await b.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'en-US',
    timezoneId: 'America/New_York'
  });
  
  return context;
}

/**
 * Force reset browser (use when encountering persistent errors)
 */
export async function resetBrowser(): Promise<void> {
  console.log('🔄 Resetting browser...');
  try {
    if (browser) {
      await browser.close();
    }
  } catch (e) {
    console.warn('Error closing browser during reset:', e);
  } finally {
    browser = null;
    isInitializing = false;
  }
}

/**
 * Graceful shutdown - call during process exit
 */
export async function closeBrowser(): Promise<void> {
  console.log('🛑 Shutting down browser...');
  if (browser) {
    try {
      await browser.close();
    } catch (e) {
      console.warn('Error during browser shutdown:', e);
    } finally {
      browser = null;
      isInitializing = false;
    }
  }
}

/**
 * Health check for browser status
 */
export function getBrowserStatus(): { connected: boolean, isInitializing: boolean } {
  return {
    connected: browser?.isConnected() ?? false,
    isInitializing
  };
}
