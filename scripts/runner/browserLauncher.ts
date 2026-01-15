/**
 * 🏃 RUNNER BROWSER LAUNCHER
 * 
 * Uses persistent context with profile directory for Mac Runner.
 * Profile persists X login across restarts.
 */

import { chromium, BrowserContext } from 'playwright';
import fs from 'fs';
import path from 'path';

const RUNNER_PROFILE_DIR = process.env.RUNNER_PROFILE_DIR || path.join(process.cwd(), '.runner-profile');

/**
 * Launch persistent browser context for runner
 */
export async function launchRunnerBrowser(): Promise<BrowserContext> {
  // Ensure profile dir exists
  if (!fs.existsSync(RUNNER_PROFILE_DIR)) {
    fs.mkdirSync(RUNNER_PROFILE_DIR, { recursive: true });
    console.log(`[RUNNER_BROWSER] ✅ Created profile directory: ${RUNNER_PROFILE_DIR}`);
  }

  console.log(`[RUNNER_BROWSER] 🚀 Launching persistent context with profile: ${RUNNER_PROFILE_DIR}`);

  const ctx = await chromium.launchPersistentContext(RUNNER_PROFILE_DIR, {
    headless: true,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox',
    ],
    viewport: { width: 1280, height: 720 },
    acceptDownloads: false,
  });

  console.log(`[RUNNER_BROWSER] ✅ Persistent context launched`);

  return ctx;
}
