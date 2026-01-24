#!/usr/bin/env tsx
/**
 * 🔐 EXECUTOR AUTH - Headed Login Repair
 * 
 * Headed browser session for repairing login/challenge walls.
 * This is separate from the headless daemon.
 * 
 * Usage:
 *   RUNNER_PROFILE_DIR=./.runner-profile pnpm run executor:auth
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { ensureRunnerProfileDir, RUNNER_PROFILE_PATHS } from '../../src/infra/runnerProfile';

const RUNNER_PROFILE_DIR = ensureRunnerProfileDir();
const BROWSER_USER_DATA_DIR = RUNNER_PROFILE_PATHS.chromeProfile();
const AUTH_REQUIRED_PATH = RUNNER_PROFILE_PATHS.authRequired();
const PIDFILE_PATH = RUNNER_PROFILE_PATHS.pidFile();

async function main(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🔐 EXECUTOR AUTH - Login Repair');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log(`📋 Configuration:`);
  console.log(`   RUNNER_PROFILE_DIR: ${RUNNER_PROFILE_DIR}`);
  console.log(`   Browser profile: ${BROWSER_USER_DATA_DIR}`);
  console.log(`   Mode: HEADED (visible browser)`);
  console.log('');
  
  // Warn if daemon is running
  if (fs.existsSync(PIDFILE_PATH)) {
    try {
      const pidfileContent = fs.readFileSync(PIDFILE_PATH, 'utf-8').trim();
      const pid = parseInt(pidfileContent.split(':')[0], 10);
      try {
        execSync(`ps -p ${pid} > /dev/null 2>&1`, { encoding: 'utf-8' });
        console.log('⚠️  WARNING: Executor daemon is running (PID: ' + pid + ')');
        console.log('⚠️  Consider stopping daemon first: pnpm run executor:stop');
        console.log('');
      } catch {
        // Stale lock - ignore
      }
    } catch {
      // Ignore
    }
  }
  
  // Check if AUTH_REQUIRED file exists
  if (fs.existsSync(AUTH_REQUIRED_PATH)) {
    console.log('⚠️  AUTH_REQUIRED file detected - login repair needed');
  }
  
  // Ensure user data dir exists
  if (!fs.existsSync(BROWSER_USER_DATA_DIR)) {
    fs.mkdirSync(BROWSER_USER_DATA_DIR, { recursive: true });
  }
  
  console.log('🚀 Launching headed browser...');
  const browser = await chromium.launch({
    headless: false, // HEADED for login repair
    channel: 'chrome',
    args: [
      `--user-data-dir=${BROWSER_USER_DATA_DIR}`,
      '--no-first-run',
      '--no-default-browser-check',
    ],
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 },
  });
  
  const page = await context.newPage();
  
  console.log('🌐 Navigating to Twitter login...');
  await page.goto('https://x.com/i/flow/login', { waitUntil: 'networkidle' });
  
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           ⏸️  BROWSER OPEN');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('Complete login/challenge in the browser window.');
  console.log('Press Enter when done to close the browser.\n');
  
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  await new Promise<void>((resolve) => {
    rl.question('Press Enter to close browser... ', () => {
      rl.close();
      resolve();
    });
  });
  
  console.log('🧹 Closing browser...');
  await page.close();
  await context.close();
  await browser.close();
  
  // Remove AUTH_REQUIRED file if it exists
  if (fs.existsSync(AUTH_REQUIRED_PATH)) {
    fs.unlinkSync(AUTH_REQUIRED_PATH);
    console.log('✅ Removed AUTH_REQUIRED file');
  }
  
  console.log('✅ Auth session complete');
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
