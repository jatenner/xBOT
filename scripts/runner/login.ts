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

  console.log('🚀 Launching SYSTEM Chrome in headed mode...');
  console.log('   Browser will open - please log in to X.com\n');

  const { launchRunnerPersistent } = await import('../../src/infra/playwright/runnerLauncher');
  const browser = await launchRunnerPersistent(false); // headed mode

  try {
    const page = browser.pages()[0] || await browser.newPage();
    
    // Capture console messages
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      if (!text.includes('password') && !text.includes('token') && !text.includes('secret')) {
        consoleMessages.push(`[CONSOLE] ${msg.type()}: ${text}`);
      }
    });
    
    // Capture failed requests
    const failedRequests: string[] = [];
    page.on('requestfailed', request => {
      failedRequests.push(`[FAILED] ${request.method()} ${request.url()} - ${request.failure()?.errorText || 'unknown'}`);
    });
    page.on('response', response => {
      if (response.status() >= 400) {
        failedRequests.push(`[ERROR] ${response.status()} ${response.url()}`);
      }
    });
    
    console.log('🌐 Navigating to https://x.com/i/flow/login...');
    await page.goto('https://x.com/i/flow/login', { waitUntil: 'domcontentloaded', timeout: 45000 });
    
    // Wait a bit for page to render
    await page.waitForTimeout(3000);
    
    // Save step 1 screenshot
    const step1Path = path.join(RUNNER_PROFILE_DIR, 'login_step1.png');
    await page.screenshot({ path: step1Path, fullPage: true }).catch(() => {});
    console.log(`📸 Screenshot saved: ${step1Path}`);
    
    // Wait for login form or other elements
    console.log('⏳ Waiting for page elements to load...');
    try {
      await Promise.race([
        page.waitForSelector('input[autocomplete="username"]', { timeout: 10000 }).catch(() => null),
        page.waitForSelector('[data-testid="loginButton"]', { timeout: 10000 }).catch(() => null),
        page.waitForSelector('[data-testid="primaryColumn"]', { timeout: 10000 }).catch(() => null),
      ]);
    } catch (e) {
      // Continue anyway
    }
    
    await page.waitForTimeout(2000);
    
    // Save step 2 screenshot
    const step2Path = path.join(RUNNER_PROFILE_DIR, 'login_step2.png');
    await page.screenshot({ path: step2Path, fullPage: true }).catch(() => {});
    console.log(`📸 Screenshot saved: ${step2Path}`);
    
    // Detect what's on the page
    const pageState = await page.evaluate(() => {
      const bodyText = document.body.textContent || '';
      const hasLoginForm = !!document.querySelector('input[autocomplete="username"]');
      const hasTimeline = !!document.querySelector('[data-testid="primaryColumn"]');
      const hasConsent = bodyText.toLowerCase().includes('consent') || bodyText.toLowerCase().includes('cookies');
      const hasChallenge = bodyText.toLowerCase().includes('verify') || bodyText.toLowerCase().includes('challenge');
      const bodyLength = document.body.innerHTML.length;
      
      return {
        hasLoginForm,
        hasTimeline,
        hasConsent,
        hasChallenge,
        bodyLength,
        url: window.location.href,
      };
    });
    
    console.log('\n📊 Page state detected:');
    console.log(`   URL: ${pageState.url}`);
    console.log(`   Has login form: ${pageState.hasLoginForm}`);
    console.log(`   Has timeline: ${pageState.hasTimeline}`);
    console.log(`   Has consent wall: ${pageState.hasConsent}`);
    console.log(`   Has challenge: ${pageState.hasChallenge}`);
    console.log(`   Body HTML length: ${pageState.bodyLength}`);
    
    // Save artifacts
    const htmlPath = path.join(RUNNER_PROFILE_DIR, 'login_page.html');
    const htmlContent = await page.content();
    // Redact sensitive data
    const redactedHtml = htmlContent
      .replace(/password="[^"]*"/gi, 'password="[REDACTED]"')
      .replace(/token="[^"]*"/gi, 'token="[REDACTED]"')
      .substring(0, 50000); // Limit size
    fs.writeFileSync(htmlPath, redactedHtml);
    console.log(`📄 HTML saved: ${htmlPath} (redacted, truncated)`);
    
    const consolePath = path.join(RUNNER_PROFILE_DIR, 'login_console.log');
    fs.writeFileSync(consolePath, consoleMessages.slice(0, 100).join('\n'));
    console.log(`📋 Console log saved: ${consolePath}`);
    
    const requestsPath = path.join(RUNNER_PROFILE_DIR, 'login_requests.log');
    fs.writeFileSync(requestsPath, failedRequests.slice(0, 50).join('\n'));
    console.log(`🌐 Requests log saved: ${requestsPath}`);
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('           ⏸️  WAITING FOR LOGIN');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📝 Instructions:');
    console.log('   1. Complete any consent/challenge prompts in the browser');
    console.log('   2. Log in to X.com');
    console.log('   3. Complete 2FA if prompted');
    console.log('   4. Verify you see your timeline (not login page)');
    console.log('   5. Press Enter in this terminal when done\n');

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
      return !!document.querySelector('[data-testid="primaryColumn"]') ||
             !!document.querySelector('article[data-testid="tweet"]') ||
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
