/**
 * 🥷 STEALTH MODE - Make Playwright undetectable
 * Bypasses bot detection by mimicking real browser behavior
 */

import { BrowserContext, Page } from 'playwright';

/**
 * Apply stealth techniques to make browser undetectable
 * Enhanced for X.com (Twitter) anti-bot systems
 */
export async function applyStealth(context: BrowserContext) {
  // Add init scripts to mask automation
  await context.addInitScript(() => {
    // Remove webdriver flag completely
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
    
    // Remove automation traces from window
    delete (window as any).__webdriver_evaluate;
    delete (window as any).__selenium_evaluate;
    delete (window as any).__webdriver_script_function;
    delete (window as any).__webdriver_script_func;
    delete (window as any).__webdriver_script_fn;
    delete (window as any).__fxdriver_evaluate;
    delete (window as any).__driver_unwrapped;
    delete (window as any).__webdriver_unwrapped;
    delete (window as any).__driver_evaluate;
    delete (window as any).__selenium_unwrapped;
    delete (window as any).__fxdriver_unwrapped;

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

    // Mock chrome object with more realistic properties
    (window as any).chrome = {
      runtime: {
        onConnect: null,
        onMessage: null,
        onStartup: null,
        onInstalled: null,
        onSuspend: null,
        onSuspendCanceled: null,
        onUpdateAvailable: null,
        onBrowserUpdateAvailable: null,
        onRestartRequired: null,
        onPerformanceWarning: null,
        connect: function() {},
        sendMessage: function() {},
        getURL: function() {},
        getManifest: function() { return {}; },
        reload: function() {},
        requestUpdateCheck: function() {},
        restart: function() {},
        restartAfterDelay: function() {},
        connectNative: function() {},
        sendNativeMessage: function() {},
        getPlatformInfo: function() {},
        getPackageDirectoryEntry: function() {}
      },
      loadTimes: function() {
        return {
          requestTime: Date.now() / 1000 - Math.random() * 10,
          startLoadTime: Date.now() / 1000 - Math.random() * 5,
          commitLoadTime: Date.now() / 1000 - Math.random() * 3,
          finishDocumentLoadTime: Date.now() / 1000 - Math.random() * 2,
          finishLoadTime: Date.now() / 1000 - Math.random(),
          firstPaintTime: Date.now() / 1000 - Math.random(),
          firstPaintAfterLoadTime: 0,
          navigationType: 'Other'
        };
      },
      csi: function() {
        return {
          startE: Date.now() - Math.random() * 1000,
          onloadT: Date.now() - Math.random() * 500,
          pageT: Math.random() * 100,
          tran: 15
        };
      },
      app: {
        isInstalled: false,
        InstallState: {
          DISABLED: 'disabled',
          INSTALLED: 'installed',
          NOT_INSTALLED: 'not_installed'
        },
        RunningState: {
          CANNOT_RUN: 'cannot_run',
          READY_TO_RUN: 'ready_to_run',
          RUNNING: 'running'
        }
      }
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

    // Mock battery API with realistic values
    (navigator as any).getBattery = () =>
      Promise.resolve({
        charging: Math.random() > 0.5,
        chargingTime: Math.random() > 0.5 ? 0 : Math.random() * 7200,
        dischargingTime: Math.random() * 28800 + 3600,
        level: 0.8 + Math.random() * 0.2,
        addEventListener: function() {},
        removeEventListener: function() {},
        dispatchEvent: function() { return true; }
      });
    
    // Mock connection API
    (navigator as any).connection = {
      effectiveType: '4g',
      rtt: 50 + Math.random() * 50,
      downlink: 8 + Math.random() * 2,
      saveData: false,
      addEventListener: function() {},
      removeEventListener: function() {},
      dispatchEvent: function() { return true; }
    };
    
    // Mock media devices
    if (navigator.mediaDevices) {
      const originalEnumerateDevices = navigator.mediaDevices.enumerateDevices;
      navigator.mediaDevices.enumerateDevices = function() {
        return Promise.resolve([
          { deviceId: 'default', groupId: 'group1', kind: 'audioinput' as MediaDeviceKind, label: 'Default - Microphone', toJSON: () => ({}) },
          { deviceId: 'default', groupId: 'group2', kind: 'audiooutput' as MediaDeviceKind, label: 'Default - Speaker', toJSON: () => ({}) },
          { deviceId: 'default', groupId: 'group3', kind: 'videoinput' as MediaDeviceKind, label: 'Default - Camera', toJSON: () => ({}) }
        ] as MediaDeviceInfo[]);
      };
    }
    
    // Override toString methods to hide automation
    const originalToString = Function.prototype.toString;
    Function.prototype.toString = function() {
      if (this === navigator.webdriver) {
        return 'function webdriver() { [native code] }';
      }
      return originalToString.call(this);
    };
  });

  console.log('[STEALTH] ✅ Applied enhanced X.com bot detection evasion');
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

