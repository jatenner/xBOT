/**
 * Robust Browser Launcher for Playwright
 * Handles missing browser binaries gracefully and provides runtime controls
 */

import { chromium, Browser } from 'playwright';

/**
 * Attempts to launch Chromium with graceful fallback handling
 * Returns null if browser unavailable or disabled by environment
 */
export async function tryLaunchChromium(): Promise<Browser | null> {
  if (process.env.REAL_METRICS_ENABLED === 'false') {
    console.log('🚫 REAL_METRICS: disabled by env');
    return null;
  }

  try {
    const browser = await chromium.launch({
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--mute-audio',
        '--disable-extensions',
        '--no-first-run',
        '--disable-default-apps',
        '--memory-pressure-off'
      ]
    });
    
    console.log('✅ CHROMIUM: Browser launched successfully');
    return browser;
    
  } catch (err: any) {
    const msg = String(err?.message || err);
    
    if (msg.includes('Executable doesn\'t exist') || msg.includes('playwright install')) {
      console.warn('🚫 BROWSER_DISABLED: Chromium not installed — disabling real metrics.');
      return null; // Signal caller to skip metrics
    }
    
    // Re-throw other errors (permissions, etc.)
    throw err;
  }
}

/**
 * Check if browser functionality is available
 */
export function isBrowserEnabled(): boolean {
  return process.env.REAL_METRICS_ENABLED !== 'false';
}
