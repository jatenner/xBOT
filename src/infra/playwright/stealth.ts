/**
 * 🥷 STEALTH MODE - Make Playwright undetectable
 * Bypasses bot detection by mimicking real browser behavior
 */

import { BrowserContext, Page } from 'playwright';

/**
 * Apply stealth techniques to make browser undetectable
 */
export async function applyStealth(context: BrowserContext) {
  // Add init scripts to mask automation
  await context.addInitScript(() => {
    // Remove webdriver flag
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
    });

    // Mock languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });

    // Mock plugins
    Object.defineProperty(navigator, 'plugins', {
      get: () => [
        {
          0: { type: 'application/pdf' },
          description: 'Portable Document Format',
          filename: 'internal-pdf-viewer',
          length: 1,
          name: 'PDF Viewer',
        },
        {
          0: { type: 'application/x-google-chrome-pdf' },
          description: 'Portable Document Format',
          filename: 'internal-pdf-viewer',
          length: 1,
          name: 'Chrome PDF Viewer',
        },
      ],
    });

    // Mock chrome object
    (window as any).chrome = {
      runtime: {},
      loadTimes: function() {},
      csi: function() {},
      app: {},
    };

    // Override permissions
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters: any) =>
      parameters.name === 'notifications'
        ? Promise.resolve({ state: 'denied' } as PermissionStatus)
        : originalQuery(parameters);

    // Add realistic screen properties
    Object.defineProperty(screen, 'availTop', { get: () => 0 });
    Object.defineProperty(screen, 'availLeft', { get: () => 0 });
    Object.defineProperty(screen, 'availWidth', { get: () => 1920 });
    Object.defineProperty(screen, 'availHeight', { get: () => 1080 });

    // Mock battery API
    (navigator as any).getBattery = () =>
      Promise.resolve({
        charging: true,
        chargingTime: 0,
        dischargingTime: Infinity,
        level: 1,
      });
  });

  console.log('[STEALTH] ✅ Applied bot detection evasion');
}

/**
 * Add human-like behaviors to a page
 */
export async function addHumanBehaviors(page: Page) {
  // Random mouse movements
  await page.evaluate(() => {
    let lastX = 0;
    let lastY = 0;
    
    const randomMove = () => {
      const x = Math.random() * window.innerWidth;
      const y = Math.random() * window.innerHeight;
      
      const event = new MouseEvent('mousemove', {
        view: window,
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
      });
      
      document.dispatchEvent(event);
      lastX = x;
      lastY = y;
    };

    // Move mouse occasionally
    setInterval(randomMove, 3000 + Math.random() * 7000);
  });

  console.log('[STEALTH] ✅ Added human behavior simulation');
}

/**
 * Type text with human-like delays
 */
export async function humanType(page: Page, selector: string, text: string) {
  const element = page.locator(selector).first();
  await element.click(); // Focus first
  await page.waitForTimeout(200 + Math.random() * 300);
  
  for (const char of text) {
    await element.pressSequentially(char, { delay: 50 + Math.random() * 150 });
  }
  
  await page.waitForTimeout(300 + Math.random() * 500);
}

/**
 * Random scroll behavior
 */
export async function humanScroll(page: Page) {
  await page.evaluate(() => {
    window.scrollBy({
      top: 100 + Math.random() * 200,
      behavior: 'smooth',
    });
  });
  await page.waitForTimeout(500 + Math.random() * 1000);
}

/**
 * Random wait that mimics human reading/thinking time
 */
export function humanWait(): Promise<void> {
  const delay = 1000 + Math.random() * 3000; // 1-4 seconds
  return new Promise(resolve => setTimeout(resolve, delay));
}

