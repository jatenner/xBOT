/**
 * 🚀 ROBUST PLAYWRIGHT LAUNCHER FOR RAILWAY
 * Uses persistent context to avoid /dev/shm and sandbox issues in Docker
 * NO --single-process flag (causes crashes)
 */

import { chromium, BrowserContext } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const PROFILE_DIR = '/tmp/xbot-profile';

export async function launchPersistent(): Promise<BrowserContext> {
  // Ensure profile dir exists
  if (!fs.existsSync(PROFILE_DIR)) {
    fs.mkdirSync(PROFILE_DIR, { recursive: true });
  }

  console.log(`[PW_LAUNCHER] Launching persistent context with STEALTH mode...`);

  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: true,
    chromiumSandbox: false,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
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
      // ENHANCED STEALTH MODE for X.com
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process,VizDisplayCompositor',
      '--disable-web-security',
      '--disable-ipc-flooding-protection',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--disable-client-side-phishing-detection',
      '--disable-component-extensions-with-background-pages',
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-features=Translate,BackForwardCache,AcceptCHFrame,MediaRouter,OptimizationHints',
      '--disable-hang-monitor',
      '--disable-prompt-on-repost',
      '--disable-sync',
      '--metrics-recording-only',
      '--no-first-run',
      '--safebrowsing-disable-auto-update',
      '--enable-automation=false',
      '--password-store=basic',
      '--use-mock-keychain',
    ],
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
    ignoreHTTPSErrors: true,
    // Additional stealth settings
    permissions: ['geolocation', 'notifications'],
    geolocation: { longitude: -74.006, latitude: 40.7128 }, // New York
    colorScheme: 'light',
  });

  // Apply stealth techniques
  const { applyStealth } = await import('./stealth');
  await applyStealth(ctx);

  console.log(`[PW_LAUNCHER] ✅ Context launched with STEALTH mode enabled`);
  return ctx;
}

