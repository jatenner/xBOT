#!/usr/bin/env tsx
/**
 * 🔐 EXECUTOR AUTH - Headed Login Repair
 * 
 * Separate command for repairing login when EXECUTOR_AUTH_REQUIRED is emitted.
 * Runs in HEADED mode (visible browser) for manual login/challenge completion.
 * 
 * Usage:
 *   pnpm run executor:auth
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { chromium, Browser, BrowserContext, Page } from 'playwright';

// Load .env.local first, then .env
const envLocalPath = path.join(process.cwd(), '.env.local');
const envPath = path.join(process.cwd(), '.env');

if (fs.existsSync(envLocalPath)) {
  require('dotenv').config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

const RUNNER_PROFILE_DIR = process.env.RUNNER_PROFILE_DIR || path.join(process.cwd(), '.runner-profile');
const USER_DATA_DIR = path.join(RUNNER_PROFILE_DIR, 'chrome-profile-bot');

async function main(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🔐 EXECUTOR AUTH - Login Repair');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log(`📋 Configuration:`);
  console.log(`   RUNNER_PROFILE_DIR: ${RUNNER_PROFILE_DIR}`);
  console.log(`   USER_DATA_DIR: ${USER_DATA_DIR}`);
  console.log(`   HEADLESS: false (headed mode for login)`);
  console.log('');
  
  // Ensure userDataDir exists
  if (!fs.existsSync(USER_DATA_DIR)) {
    fs.mkdirSync(USER_DATA_DIR, { recursive: true });
  }
  
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  
  try {
    // Launch browser in HEADED mode
    console.log(`[EXECUTOR_AUTH] 🚀 Launching Chromium (headed mode)...`);
    browser = await chromium.launch({
      headless: false, // HEADED for login
      channel: 'chrome',
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-first-run',
        '--no-default-browser-check',
      ],
    });
    
    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    
    page = await context.newPage();
    
    console.log(`[EXECUTOR_AUTH] ✅ Browser launched (headed mode)`);
    console.log(`[EXECUTOR_AUTH] 🌐 Navigating to x.com/home...`);
    
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    console.log(`[EXECUTOR_AUTH] ✅ Page loaded`);
    console.log(`[EXECUTOR_AUTH] 📋 Instructions:`);
    console.log(`   1. Complete login/challenge in the browser window`);
    console.log(`   2. Wait for timeline to appear`);
    console.log(`   3. Press Enter here to verify and close`);
    console.log('');
    
    // Wait for user input
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    
    await new Promise<void>((resolve) => {
      rl.question('Press Enter after completing login... ', () => {
        rl.close();
        resolve();
      });
    });
    
    // Verify login
    console.log(`[EXECUTOR_AUTH] 🔍 Verifying login...`);
    await page.waitForTimeout(2000);
    
    const hasTimeline = await page.evaluate(() => {
      return !!document.querySelector('article[data-testid="tweet"]');
    });
    
    if (hasTimeline) {
      console.log(`[EXECUTOR_AUTH] ✅ Login verified - timeline found`);
      console.log(`[EXECUTOR_AUTH] ✅ Session saved to ${USER_DATA_DIR}`);
      console.log(`[EXECUTOR_AUTH] ✅ You can now run 'pnpm run executor:daemon'`);
    } else {
      console.log(`[EXECUTOR_AUTH] ⚠️  Timeline not found - login may not be complete`);
      console.log(`[EXECUTOR_AUTH] ⚠️  Run this command again if needed`);
    }
    
  } catch (error: any) {
    console.error(`[EXECUTOR_AUTH] ❌ Error: ${error.message}`);
    process.exit(1);
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
    if (context) {
      await context.close().catch(() => {});
    }
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

main().catch((error) => {
  console.error('❌ Auth script failed:', error);
  process.exit(1);
});
