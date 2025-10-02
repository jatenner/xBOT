/**
 * 🚀 ROBUST PLAYWRIGHT LAUNCHER FOR RAILWAY
 * Uses persistent context to avoid /dev/shm and sandbox issues in Docker
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

  console.log(`[PW_LAUNCHER] Launching persistent context at ${PROFILE_DIR}...`);

  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: true,
    chromiumSandbox: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',  // Critical: avoid /dev/shm
      '--no-zygote',              // No subprocess zygote
      '--disable-gpu',
      '--disable-features=TranslateUI',
      '--ignore-certificate-errors',
      '--window-size=1920,1080',
      '--hide-scrollbars',
      '--mute-audio'
    ],
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
    ignoreHTTPSErrors: true
  });

  console.log(`[PW_LAUNCHER] ✅ Context launched successfully`);
  return ctx;
}

