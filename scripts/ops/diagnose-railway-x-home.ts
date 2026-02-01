#!/usr/bin/env tsx
/**
 * Railway X.com Home Page Auth Diagnostics
 * 
 * Runs on Railway to diagnose why auth check fails.
 * Captures page state, selectors, HTML, and screenshot.
 */

import 'dotenv/config';
import { UnifiedBrowserPool } from '../../src/browser/UnifiedBrowserPool';
import { writeFileSync } from 'fs';

async function main() {
  console.log('[AUTH_DIAG] 🔍 Starting Railway X.com home diagnostics...\n');

  const pool = UnifiedBrowserPool.getInstance();
  let page = null;

  try {
    // Acquire page (same method as harvester)
    page = await pool.acquirePage('auth_diagnostic');
    console.log('[AUTH_DIAG] ✅ Page acquired\n');

    // Navigate to x.com/home
    console.log('[AUTH_DIAG] 🌐 Navigating to https://x.com/home...');
    await page.goto('https://x.com/home', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForTimeout(3000); // Let page settle

    const finalUrl = page.url();
    const title = await page.title().catch(() => 'unknown');

    console.log(`[AUTH_DIAG] Final URL: ${finalUrl}`);
    console.log(`[AUTH_DIAG] Page title: ${title}\n`);

    // Check selectors
    console.log('[AUTH_DIAG] 🔍 Checking selectors...');

    const checks = await page.evaluate(() => {
      return {
        // Logged-in indicators
        hasAccountSwitcher: !!document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]'),
        hasPrimaryColumn: !!document.querySelector('[data-testid="primaryColumn"]'),
        hasComposeButton: !!document.querySelector('[data-testid="SideNav_NewTweet_Button"]'),
        hasHomeNav: !!document.querySelector('a[href="/home"]'),
        
        // Login indicators
        hasLoginForm: !!document.querySelector('form[action*="login"]'),
        hasLoginFlow: window.location.href.includes('/i/flow/login') || window.location.href.includes('/login'),
        hasLoginButton: !!document.querySelector('a[href*="/i/flow/login"]') || !!document.querySelector('button[data-testid*="login"]'),
        
        // Challenge/block indicators
        hasChallengeText: document.body.textContent?.includes('unusual traffic') || 
                          document.body.textContent?.includes('verify you\'re human') ||
                          document.body.textContent?.includes('challenge'),
        hasCloudflare: document.body.textContent?.includes('Just a moment') ||
                       document.body.textContent?.includes('Checking your browser'),
        
        // Timeline content
        hasTimeline: !!document.querySelector('[data-testid="primaryColumn"]') ||
                     !!document.querySelector('main section'),
        hasTweetCards: document.querySelectorAll('[data-testid="tweet"]').length > 0,
      };
    });

    // Classify
    let classification = 'unknown';
    if (checks.hasLoginFlow || checks.hasLoginForm || checks.hasLoginButton) {
      classification = 'login_required';
    } else if (checks.hasChallengeText || checks.hasCloudflare) {
      classification = 'challenge_wall';
    } else if (checks.hasAccountSwitcher && checks.hasPrimaryColumn && checks.hasTimeline) {
      classification = 'ok_timeline';
    } else if (checks.hasTimeline && !checks.hasAccountSwitcher) {
      classification = 'partial_timeline';
    } else if (finalUrl.includes('/i/flow/login') || finalUrl.includes('/login')) {
      classification = 'redirected_to_login';
    } else {
      classification = 'no_timeline';
    }

    // Save HTML
    const htmlContent = await page.content();
    writeFileSync('/tmp/x-home.html', htmlContent);
    console.log('[AUTH_DIAG] 💾 Saved HTML to /tmp/x-home.html');

    // Save screenshot
    await page.screenshot({ path: '/tmp/x-home.png', fullPage: false });
    console.log('[AUTH_DIAG] 📸 Saved screenshot to /tmp/x-home.png\n');

    // Print classification line
    console.log(`[AUTH_DIAG] classification=${classification} finalUrl=${finalUrl} title=${title}`);
    console.log(`[AUTH_DIAG] hasAccountSwitcher=${checks.hasAccountSwitcher} hasPrimaryColumn=${checks.hasPrimaryColumn} hasTimeline=${checks.hasTimeline}`);
    console.log(`[AUTH_DIAG] hasLoginFlow=${checks.hasLoginFlow} hasChallengeText=${checks.hasChallengeText}\n`);

    // Exit code based on classification
    if (classification === 'ok_timeline') {
      console.log('[AUTH_DIAG] ✅ Authentication OK');
      process.exit(0);
    } else {
      console.log(`[AUTH_DIAG] ❌ Authentication failed: ${classification}`);
      process.exit(1);
    }

  } catch (error: any) {
    console.error(`[AUTH_DIAG] ❌ Error: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    if (page) {
      await pool.releasePage(page);
    }
  }
}

main().catch(console.error);
