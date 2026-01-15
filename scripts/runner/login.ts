#!/usr/bin/env tsx
/**
 * 🔐 MAC RUNNER LOGIN HELPER
 * 
 * Interactive one-time X login using SYSTEM Chrome with persistent profile.
 * Login persists across runner restarts.
 * 
 * Usage:
 *   RUNNER_MODE=true RUNNER_PROFILE_DIR=./.runner-profile pnpm exec tsx scripts/runner/login.ts
 */

import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import readline from 'readline';

// Set runner mode
process.env.RUNNER_MODE = 'true';
const RUNNER_PROFILE_DIR = process.env.RUNNER_PROFILE_DIR || path.join(process.cwd(), '.runner-profile');

async function main() {
  // 🔒 CHECK ENV SYNC FIRST
  try {
    const { execSync } = require('child_process');
    execSync('pnpm exec tsx scripts/runner/check-env-sync.ts', {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
  } catch (error: any) {
    console.error('\n❌ Env sync check failed. Login helper will not start.');
    process.exit(1);
  }

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

  // Set browser mode to CDP
  if (!process.env.RUNNER_BROWSER) {
    process.env.RUNNER_BROWSER = 'cdp';
  }
  
  console.log('🚀 Resetting Chrome CDP...\n');
  
  // Use reset-chrome script
  const { execSync } = require('child_process');
  execSync('RUNNER_MODE=true RUNNER_PROFILE_DIR=' + RUNNER_PROFILE_DIR + ' tsx scripts/runner/reset-chrome.ts', {
    stdio: 'inherit',
    cwd: process.cwd(),
  });
  
  console.log('\n✅ Chrome CDP reset complete\n');
  
  // Wait a moment for Chrome to fully start
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Connect via CDP
  const { launchRunnerPersistent } = await import('../../src/infra/playwright/runnerLauncher');
  const browser = await launchRunnerPersistent(false); // CDP mode

  try {
    // Navigate to home (Chrome already opened to home via reset-chrome)
    const page = browser.pages()[0] || await browser.newPage();
    
    // Navigate to home if not already there
    const currentUrl = page.url();
    if (!currentUrl.includes('x.com/home')) {
      console.log('🌐 Navigating to https://x.com/home...');
      await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(2000);
    } else {
      console.log('✅ Already on home page');
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('           ⏸️  WAITING FOR LOGIN');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📝 Instructions:');
    console.log('   1. Complete any consent/challenge prompts in the Chrome window');
    console.log('   2. Log in to X.com if needed');
    console.log('   3. Complete 2FA if prompted');
    console.log('   4. Verify you see your Home timeline (left nav should be visible)');
    console.log('   5. Press Enter in this terminal when done\n');

    // Wait for user to press Enter
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    await new Promise<void>((resolve) => {
      rl.question('Press Enter after you\'re logged in and see the Home timeline... ', () => {
        rl.close();
        resolve();
      });
    });

    // Don't close browser - keep Chrome running for CDP
    await browser.close();
    
    console.log('\n✅ Login step complete. Chrome is still running for CDP.');

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('           ✅ LOGIN COMPLETE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`Login stored in RUNNER_PROFILE_DIR=${RUNNER_PROFILE_DIR}`);
    console.log(`\nNext steps:`);
    console.log(`  1. Verify session: pnpm exec tsx scripts/runner/session-check.ts`);
    console.log(`  2. Run go-live: pnpm run runner:go-live2\n`);

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
