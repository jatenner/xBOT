#!/usr/bin/env tsx
/**
 * 🔐 MAC RUNNER LOGIN HELPER
 * 
 * Interactive one-time X login using persistent Playwright profile.
 * Login persists across runner restarts.
 * 
 * Usage:
 *   RUNNER_MODE=true RUNNER_PROFILE_DIR=./.runner-profile pnpm exec tsx scripts/runner/login.ts
 */

import 'dotenv/config';
import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import readline from 'readline';

const RUNNER_PROFILE_DIR = process.env.RUNNER_PROFILE_DIR || path.join(process.cwd(), '.runner-profile');

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🔐 MAC RUNNER LOGIN HELPER');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log(`Profile directory: ${RUNNER_PROFILE_DIR}`);
  console.log(`Mode: Interactive (headed browser)\n`);

  // Ensure profile dir exists
  if (!fs.existsSync(RUNNER_PROFILE_DIR)) {
    fs.mkdirSync(RUNNER_PROFILE_DIR, { recursive: true });
    console.log(`✅ Created profile directory: ${RUNNER_PROFILE_DIR}\n`);
  }

  console.log('🚀 Launching Chromium in headed mode...');
  console.log('   Browser will open - please log in to X.com\n');

  const browser = await chromium.launchPersistentContext(RUNNER_PROFILE_DIR, {
    headless: false, // Show browser for interactive login
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
    ],
    viewport: { width: 1280, height: 720 },
  });

  try {
    const page = browser.pages()[0] || await browser.newPage();
    
    console.log('🌐 Navigating to https://x.com/home...');
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('           ⏸️  WAITING FOR LOGIN');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📝 Instructions:');
    console.log('   1. Log in to X.com in the browser window');
    console.log('   2. Verify you see your timeline (not login page)');
    console.log('   3. Press Enter in this terminal when done\n');

    // Wait for user to press Enter
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    await new Promise<void>((resolve) => {
      rl.question('Press Enter after you\'re logged in... ', () => {
        rl.close();
        resolve();
      });
    });

    // Verify login by checking for timeline elements
    console.log('\n🔍 Verifying login...');
    const isLoggedIn = await page.evaluate(() => {
      return !!document.querySelector('[data-testid="tweetTextarea_0"]') || 
             !!document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]');
    });

    if (isLoggedIn) {
      console.log('✅ Login verified - timeline elements found');
    } else {
      console.log('⚠️  Warning: Login may not be complete (timeline elements not found)');
      console.log('   Profile will still be saved, but runner may need to login again');
    }

    // Close browser (profile is saved automatically)
    await browser.close();

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('           ✅ LOGIN COMPLETE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`Login stored in RUNNER_PROFILE_DIR=${RUNNER_PROFILE_DIR}`);
    console.log(`\nNext steps:`);
    console.log(`  1. Start runner: pm2 start pnpm --name "xbot-runner" -- exec tsx scripts/runner/poll-and-post.ts`);
    console.log(`  2. Check health: pnpm exec tsx scripts/runner/health.ts\n`);

  } catch (error: any) {
    console.error(`❌ Login helper failed: ${error.message}`);
    await browser.close().catch(() => {});
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
