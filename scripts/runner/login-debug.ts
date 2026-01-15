#!/usr/bin/env tsx
/**
 * 🔍 LOGIN DEBUG
 * 
 * Debug script to diagnose login UI rendering issues
 * 
 * Usage:
 *   pnpm run runner:login-debug
 */

import fs from 'fs';
import path from 'path';

// Load .env.local first
const envLocalPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  require('dotenv').config({ path: envLocalPath });
}

// Set runner mode
process.env.RUNNER_MODE = 'true';
const RUNNER_PROFILE_DIR = process.env.RUNNER_PROFILE_DIR || path.join(process.cwd(), '.runner-profile');

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🔍 LOGIN DEBUG');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Step 1: Auto-sync
  console.log('STEP 1: Syncing environment from Railway...');
  try {
    const { execSync } = require('child_process');
    execSync('pnpm run runner:autosync', { stdio: 'inherit' });
  } catch (error: any) {
    console.error('❌ Auto-sync failed:', error.message);
    process.exit(1);
  }
  
  console.log('\nSTEP 2: Launching browser...\n');
  
  const { launchRunnerPersistent } = await import('../../src/infra/playwright/runnerLauncher');
  const browser = await launchRunnerPersistent(false); // headed mode
  
  try {
    const page = browser.pages()[0] || await browser.newPage();
    
    // Capture diagnostics
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      if (!text.toLowerCase().includes('password') && !text.toLowerCase().includes('token')) {
        consoleMessages.push(`[${msg.type()}] ${text}`);
      }
    });
    
    const failedRequests: string[] = [];
    page.on('requestfailed', request => {
      failedRequests.push(`FAILED: ${request.method()} ${request.url()}`);
    });
    page.on('response', response => {
      if (response.status() >= 400) {
        failedRequests.push(`ERROR ${response.status()}: ${response.url()}`);
      }
    });
    
    console.log('🌐 Navigating to https://x.com/i/flow/login...');
    await page.goto('https://x.com/i/flow/login', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(5000);
    
    // Save screenshot
    const screenshotPath = path.join(RUNNER_PROFILE_DIR, 'login_debug.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 Screenshot saved: ${screenshotPath}`);
    
    // Detect page state
    const state = await page.evaluate(() => {
      const bodyText = document.body.textContent || '';
      const htmlLength = document.body.innerHTML.length;
      const hasLoginForm = !!document.querySelector('input[autocomplete="username"]');
      const hasTimeline = !!document.querySelector('[data-testid="primaryColumn"]');
      const hasConsent = bodyText.toLowerCase().includes('consent') || bodyText.toLowerCase().includes('cookies');
      const hasChallenge = bodyText.toLowerCase().includes('verify') || bodyText.toLowerCase().includes('challenge');
      const hasLoginButton = bodyText.includes('Sign in') || bodyText.includes('Log in');
      const hasXLogo = !!document.querySelector('svg[aria-label="X"]') || bodyText.includes('X');
      const bodyVisible = document.body.offsetHeight > 100;
      
      return {
        url: window.location.href,
        htmlLength,
        hasLoginForm,
        hasTimeline,
        hasConsent,
        hasChallenge,
        hasLoginButton,
        hasXLogo,
        bodyVisible,
        bodyHeight: document.body.offsetHeight,
      };
    });
    
    console.log('\n📊 Page State:');
    console.log(`   URL: ${state.url}`);
    console.log(`   HTML length: ${state.htmlLength}`);
    console.log(`   Body visible: ${state.bodyVisible} (height: ${state.bodyHeight}px)`);
    console.log(`   Has login form: ${state.hasLoginForm}`);
    console.log(`   Has timeline: ${state.hasTimeline}`);
    console.log(`   Has consent wall: ${state.hasConsent}`);
    console.log(`   Has challenge: ${state.hasChallenge}`);
    console.log(`   Has login button: ${state.hasLoginButton}`);
    console.log(`   Has X logo: ${state.hasXLogo}`);
    
    // Determine status
    let status = 'UNKNOWN';
    if (state.hasTimeline) {
      status = 'ALREADY_LOGGED_IN';
    } else if (state.hasLoginForm) {
      status = 'LOGIN_FORM_VISIBLE';
    } else if (state.hasConsent) {
      status = 'CONSENT_WALL';
    } else if (state.hasChallenge) {
      status = 'CHALLENGE';
    } else if (state.hasLoginButton) {
      status = 'LOGIN_BUTTON_VISIBLE';
    } else if (!state.bodyVisible || state.htmlLength < 1000) {
      status = 'UI_NOT_RENDERING';
    } else {
      status = 'UNKNOWN_STATE';
    }
    
    console.log(`\n🎯 Status: ${status}`);
    
    // Save artifacts
    const htmlPath = path.join(RUNNER_PROFILE_DIR, 'login_debug.html');
    const html = await page.content();
    const redacted = html
      .replace(/password="[^"]*"/gi, 'password="[REDACTED]"')
      .replace(/token="[^"]*"/gi, 'token="[REDACTED]"')
      .substring(0, 50000);
    fs.writeFileSync(htmlPath, redacted);
    console.log(`📄 HTML saved: ${htmlPath}`);
    
    const consolePath = path.join(RUNNER_PROFILE_DIR, 'login_debug_console.log');
    fs.writeFileSync(consolePath, consoleMessages.slice(0, 100).join('\n'));
    console.log(`📋 Console log saved: ${consolePath}`);
    
    const requestsPath = path.join(RUNNER_PROFILE_DIR, 'login_debug_requests.log');
    fs.writeFileSync(requestsPath, failedRequests.slice(0, 50).join('\n'));
    console.log(`🌐 Requests log saved: ${requestsPath}`);
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('           ⏸️  BROWSER OPEN - INTERACT IF NEEDED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('Press Enter to close browser...\n');
    
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    
    await new Promise<void>((resolve) => {
      rl.question('', () => {
        rl.close();
        resolve();
      });
    });
    
    await browser.close();
    
    console.log('\n✅ Debug complete. Check artifacts in:', RUNNER_PROFILE_DIR);
    
  } catch (error: any) {
    console.error(`❌ Debug failed: ${error.message}`);
    await browser.close().catch(() => {});
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
