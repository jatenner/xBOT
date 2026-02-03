#!/usr/bin/env tsx
/**
 * 🔐 EXECUTOR B64 AUTH READ/WRITE PROOF
 * 
 * Proves X.com authentication + read/write UI access using B64 cookie injection.
 * Uses a brand new temp profile dir per run.
 * 
 * Usage:
 *   TWITTER_SESSION_B64=<b64> pnpm run executor:prove:auth-b64-readwrite
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { chromium, BrowserContext, Page, Cookie } from 'playwright';

const BROWSER_USER_DATA_DIR = path.join(process.cwd(), '.tmp', `b64-auth-readwrite-${Date.now()}`);

function loadB64Cookies(): { cookies: Cookie[]; origins: any[] } {
  const b64 = process.env.TWITTER_SESSION_B64?.trim();
  if (!b64) {
    throw new Error('TWITTER_SESSION_B64 environment variable is required');
  }
  
  try {
    const decoded = Buffer.from(b64, 'base64').toString('utf8');
    const state = JSON.parse(decoded);
    
    if (!Array.isArray(state?.cookies)) {
      throw new Error('Invalid session format: cookies array not found');
    }
    
    // Normalize domains
    const normalizedCookies: Cookie[] = [];
    for (const cookie of state.cookies) {
      if (cookie.domain && (cookie.domain.includes('x.com') || cookie.domain.includes('twitter.com'))) {
        normalizedCookies.push({
          ...cookie,
          domain: '.x.com',
        });
        if (!cookie.domain.includes('twitter.com')) {
          normalizedCookies.push({
            ...cookie,
            domain: '.twitter.com',
          });
        }
      } else {
        normalizedCookies.push(cookie);
      }
    }
    
    return {
      cookies: normalizedCookies,
      origins: state.origins || [],
    };
  } catch (error: any) {
    throw new Error(`Failed to decode TWITTER_SESSION_B64: ${error.message}`);
  }
}

async function main(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🔐 EXECUTOR B64 AUTH READ/WRITE PROOF');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Load B64 cookies
  let sessionState: { cookies: Cookie[]; origins: any[] };
  try {
    sessionState = loadB64Cookies();
    console.log(`✅ Loaded ${sessionState.cookies.length} cookies from TWITTER_SESSION_B64\n`);
  } catch (error: any) {
    console.error(`❌ FATAL: Failed to load cookies: ${error.message}`);
    process.exit(1);
  }
  
  // Create temp profile dir
  fs.mkdirSync(BROWSER_USER_DATA_DIR, { recursive: true });
  
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  
  try {
    // Launch browser with temp profile
    console.log(`[B64_AUTH_PROVE] 🚀 Launching browser with temp profile...`);
    context = await chromium.launchPersistentContext(BROWSER_USER_DATA_DIR, {
      headless: true,
      channel: 'chrome',
      args: [
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 },
    });
    
    // Inject cookies
    await context.addCookies(sessionState.cookies);
    console.log(`[B64_AUTH_PROVE] ✅ Injected ${sessionState.cookies.length} cookies\n`);
    
    page = await context.newPage();
    
    // Step 1: Visit home
    console.log(`[B64_AUTH_PROVE] 📍 Step 1: Visiting https://x.com/home...`);
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);
    
    const currentUrl = page.url();
    console.log(`[B64_AUTH_PROVE]   Current URL: ${currentUrl}`);
    
    // Step 2: Check for login redirect
    if (currentUrl.includes('/i/flow/login')) {
      console.error(`[B64_AUTH_PROVE] ❌ FAIL: Redirected to login flow`);
      process.exit(1);
    }
    
    // Step 3: Check for consent wall (simplified)
    const hasConsentWall = await page.evaluate(() => {
      const bodyText = document.body.textContent || '';
      return bodyText.includes('Accept all cookies') || 
             bodyText.includes('Accept cookies') ||
             !!document.querySelector('[role="dialog"][aria-label*="cookie" i]');
    });
    
    if (hasConsentWall) {
      console.log(`[B64_AUTH_PROVE] ⚠️  Consent wall detected, attempting dismissal...`);
      // Try to dismiss (simplified)
      try {
        const acceptButton = await page.locator('button:has-text("Accept"), button:has-text("Accept all")').first();
        if (await acceptButton.isVisible({ timeout: 5000 })) {
          await acceptButton.click();
          await page.waitForTimeout(2000);
        }
      } catch {
        // Ignore
      }
    }
    
    // Step 4: Verify logged-in state
    console.log(`[B64_AUTH_PROVE] 📍 Step 2: Verifying logged-in state...`);
    const composeBox = await page.locator('[data-testid="tweetTextarea_0"]').first();
    const hasComposeBox = await composeBox.isVisible({ timeout: 10000 }).catch(() => false);
    
    if (!hasComposeBox) {
      console.error(`[B64_AUTH_PROVE] ❌ FAIL: Compose box not found`);
      process.exit(1);
    }
    
    console.log(`[B64_AUTH_PROVE] ✅ Compose box found`);
    
    // Step 5: Test write access
    console.log(`[B64_AUTH_PROVE] 📍 Step 3: Testing write access...`);
    await composeBox.fill('test');
    await page.waitForTimeout(1000);
    
    // Step 6: Check submit button
    const submitButton = page.locator('[data-testid="tweetButton"]').first();
    const isEnabled = await submitButton.isEnabled().catch(() => false);
    
    if (!isEnabled) {
      console.error(`[B64_AUTH_PROVE] ❌ FAIL: Submit button not enabled`);
      process.exit(1);
    }
    
    console.log(`[B64_AUTH_PROVE] ✅ Submit button is enabled`);
    
    // Step 7: Clear test text (don't submit)
    await composeBox.fill('');
    
    // PASS
    console.log(`\n[B64_AUTH_PROVE] ✅ PASS: Auth + read/write access verified`);
    console.log(`[B64_AUTH_PROVE]   - No login redirect`);
    console.log(`[B64_AUTH_PROVE]   - Logged-in state verified`);
    console.log(`[B64_AUTH_PROVE]   - Compose UI accessible`);
    console.log(`[B64_AUTH_PROVE]   - Submit button enabled`);
    console.log(`[B64_AUTH_PROVE]   - No tweet submitted (proof only)\n`);
    
  } catch (error: any) {
    console.error(`[B64_AUTH_PROVE] ❌ FATAL ERROR: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
    if (context) {
      await context.close().catch(() => {});
    }
    // Cleanup temp profile
    try {
      fs.rmSync(BROWSER_USER_DATA_DIR, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
