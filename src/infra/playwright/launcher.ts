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
      // STEALTH MODE: Additional args to avoid detection
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-web-security',
      '--flag-switches-begin --disable-site-isolation-trials --flag-switches-end',
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

