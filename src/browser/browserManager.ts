/**
 * 🌐 BROWSER MANAGER
 * 
 * Manages persistent Playwright browser context with X/Twitter authentication
 */

import { chromium, BrowserContext } from 'playwright';

let browserContext: BrowserContext | null = null;

/**
 * Get or create authenticated browser context
 */
export async function getBrowserContext(): Promise<BrowserContext | null> {
  if (browserContext) {
    return browserContext;
  }

  try {
    // Load existing session from storage
    // This assumes you have a stored browser state from your login automation
    const { loadBrowserSession } = await import('../login/sessionManager');
    browserContext = await loadBrowserSession();
    return browserContext;
  } catch (error: any) {
    console.error(`[BROWSER_MANAGER] ⚠️ Could not load browser context: ${error.message}`);
    return null;
  }
}

/**
 * Close browser context
 */
export async function closeBrowserContext(): Promise<void> {
  if (browserContext) {
    await browserContext.close();
    browserContext = null;
  }
}
