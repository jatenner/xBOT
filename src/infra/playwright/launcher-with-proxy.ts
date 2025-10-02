/**
 * 🌐 PLAYWRIGHT LAUNCHER WITH PROXY SUPPORT
 * Routes browser traffic through residential proxy to avoid IP blocks
 */

import { chromium, BrowserContext } from 'playwright';
import fs from 'node:fs';

const PROFILE_DIR = '/tmp/xbot-profile';

export async function launchPersistentWithProxy(): Promise<BrowserContext> {
  if (!fs.existsSync(PROFILE_DIR)) {
    fs.mkdirSync(PROFILE_DIR, { recursive: true });
  }

  // Proxy configuration from env
  const PROXY_SERVER = process.env.PROXY_SERVER; // e.g., 'http://proxy.example.com:8080'
  const PROXY_USERNAME = process.env.PROXY_USERNAME;
  const PROXY_PASSWORD = process.env.PROXY_PASSWORD;

  console.log(`[PW_LAUNCHER] Launching with ${PROXY_SERVER ? 'PROXY' : 'DIRECT'} connection...`);

  const contextOptions: any = {
    headless: true,
    chromiumSandbox: false,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.118 Safari/537.36',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--no-zygote',
      '--disable-gpu',
      '--disable-features=TranslateUI',
      '--ignore-certificate-errors',
      '--window-size=1920,1080',
      '--hide-scrollbars',
      '--mute-audio',
      '--disable-software-rasterizer',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-web-security',
    ],
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
    ignoreHTTPSErrors: true,
    permissions: ['geolocation', 'notifications'],
    geolocation: { longitude: -74.006, latitude: 40.7128 },
    colorScheme: 'light' as const,
  };

  // Add proxy if configured
  if (PROXY_SERVER) {
    contextOptions.proxy = {
      server: PROXY_SERVER,
      username: PROXY_USERNAME,
      password: PROXY_PASSWORD,
    };
    console.log(`[PW_LAUNCHER] 🌐 Using proxy: ${PROXY_SERVER.replace(/\/\/.+@/, '//***@')}`);
  } else {
    console.log('[PW_LAUNCHER] ⚠️ No proxy configured, using Railway IP (may be blocked)');
  }

  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, contextOptions);

  // Apply stealth
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    Object.defineProperty(navigator, 'plugins', {
      get: () => [
        { description: 'Portable Document Format', filename: 'internal-pdf-viewer', length: 1, name: 'PDF Viewer' }
      ],
    });
    (window as any).chrome = { runtime: {}, loadTimes: function() {}, csi: function() {}, app: {} };
  });

  console.log(`[PW_LAUNCHER] ✅ Context launched with STEALTH + ${PROXY_SERVER ? 'PROXY' : 'DIRECT'}`);
  return ctx;
}

