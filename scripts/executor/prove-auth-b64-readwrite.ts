#!/usr/bin/env tsx
/**
 * 🔐 EXECUTOR B64 AUTH READ/WRITE PROOF
 * 
 * Proves X.com authentication + read/write UI access using cookies from TWITTER_SESSION_B64.
 * Uses a brand new temp profile dir per run (no persistent profile).
 * Does NOT submit tweets - only verifies compose UI is accessible.
 * 
 * Usage:
 *   TWITTER_SESSION_B64=<b64> pnpm run executor:prove:auth-b64-readwrite
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { chromium, BrowserContext, Page, Cookie } from 'playwright';
import { getSupabaseClient } from '../../src/db/index';

// Create temp profile dir per run
const TEMP_PROFILE_BASE = path.join(process.cwd(), '.tmp', 'b64-auth-proofs');
const RUN_ID = `b64-readwrite-${Date.now()}`;
const TEMP_PROFILE_DIR = path.join(TEMP_PROFILE_BASE, RUN_ID);

/**
 * Load cookies from TWITTER_SESSION_B64 environment variable
 */
function loadCookiesFromB64(): Cookie[] {
  const sessionB64 = process.env.TWITTER_SESSION_B64?.trim();
  
  if (!sessionB64) {
    throw new Error('TWITTER_SESSION_B64 environment variable is required');
  }

  try {
    // Decode base64
    const decoded = Buffer.from(sessionB64, 'base64').toString('utf8');
    const sessionData = JSON.parse(decoded);
    
    // Normalize cookie format
    let cookies: any[] = [];
    if (Array.isArray(sessionData.cookies)) {
      cookies = sessionData.cookies;
    } else if (Array.isArray(sessionData)) {
      cookies = sessionData;
    } else {
      throw new Error('Invalid session format: expected {cookies: [...]} or [...]');
    }
    
    // Normalize to Playwright cookie format
    const normalizedCookies: Cookie[] = cookies.map((c: any) => {
      const domain = c.domain || c.Domain || '';
      const normalizedDomain = domain.startsWith('.') ? domain : `.${domain}`;
      
      return {
        name: c.name || c.Name || '',
        value: c.value || c.Value || '',
        domain: normalizedDomain.includes('x.com') ? '.x.com' : '.twitter.com',
        path: c.path || c.Path || '/',
        expires: c.expires || c.Expires || -1,
        httpOnly: c.httpOnly !== undefined ? c.httpOnly : (c.HttpOnly !== undefined ? c.HttpOnly : false),
        secure: c.secure !== undefined ? c.secure : (c.Secure !== false),
        sameSite: c.sameSite || c.SameSite || 'None',
      };
    });
    
    // Duplicate for both domains
    const duplicatedCookies: Cookie[] = [];
    for (const cookie of normalizedCookies) {
      duplicatedCookies.push(cookie);
      if (cookie.domain === '.x.com') {
        duplicatedCookies.push({ ...cookie, domain: '.twitter.com' });
      } else if (cookie.domain === '.twitter.com') {
        duplicatedCookies.push({ ...cookie, domain: '.x.com' });
      }
    }
    
    console.log(`[B64_AUTH_PROOF] ✅ Loaded ${duplicatedCookies.length} cookies from TWITTER_SESSION_B64`);
    return duplicatedCookies;
    
  } catch (error: any) {
    throw new Error(`Failed to load cookies from TWITTER_SESSION_B64: ${error.message}`);
  }
}

async function dismissConsent(page: Page, maxAttempts: number = 2): Promise<{ cleared: boolean; attempts: number }> {
  const { detectConsentWall, acceptConsentWall } = await import('../../src/playwright/twitterSession');
  
  const detection = await detectConsentWall(page);
  
  if (!detection.detected || detection.wallType !== 'consent') {
    return { cleared: true, attempts: 0 };
  }
  
  console.log(`[B64_AUTH_PROOF] 🚧 Consent interstitial detected, attempting dismissal...`);
  
  const result = await acceptConsentWall(page, maxAttempts);
  
  if (result.cleared) {
    console.log(`[B64_AUTH_PROOF] ✅ Consent dismissed successfully (attempts: ${result.attempts})`);
    
    try {
      const supabase = getSupabaseClient();
      await supabase.from('system_events').insert({
        event_type: 'EXECUTOR_B64_CONSENT_DISMISSED',
        event_data: {
          attempts: result.attempts,
          temp_profile_dir: TEMP_PROFILE_DIR,
        },
      });
    } catch {
      // Non-blocking
    }
  } else {
    console.log(`[B64_AUTH_PROOF] ❌ Failed to dismiss consent after ${result.attempts} attempts`);
    
    try {
      const supabase = getSupabaseClient();
      await supabase.from('system_events').insert({
        event_type: 'EXECUTOR_B64_CONSENT_BLOCKED',
        event_data: {
          attempts: result.attempts,
          temp_profile_dir: TEMP_PROFILE_DIR,
        },
      });
    } catch {
      // Non-blocking
    }
  }
  
  return result;
}

async function main(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🔐 B64 AUTH READ/WRITE PROOF');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log(`📋 Configuration:`);
  console.log(`   Temp Profile: ${TEMP_PROFILE_DIR}`);
  console.log(`   Mode: HEADLESS (proof only, no submit)\n`);
  
  // Ensure temp profile dir exists
  if (!fs.existsSync(TEMP_PROFILE_DIR)) {
    fs.mkdirSync(TEMP_PROFILE_DIR, { recursive: true });
  }
  
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  
  try {
    // Load cookies
    const cookies = loadCookiesFromB64();
    
    // Launch browser with temp profile
    console.log(`[B64_AUTH_PROOF] 🚀 Launching browser with temp profile...`);
    context = await chromium.launchPersistentContext(TEMP_PROFILE_DIR, {
      headless: true,
      channel: 'chrome',
      args: [
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-blink-features=AutomationControlled',
      ],
    });
    
    page = await context.newPage();
    
    // Inject cookies
    console.log(`[B64_AUTH_PROOF] 📋 Injecting ${cookies.length} cookies...`);
    await context.addCookies(cookies);
    console.log(`[B64_AUTH_PROOF] ✅ Cookies injected`);
    
    // Step 1: Visit https://x.com/home
    console.log(`[B64_AUTH_PROOF] 📍 Step 1: Visiting https://x.com/home...`);
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);
    
    const currentUrl = page.url();
    console.log(`[B64_AUTH_PROOF]   Current URL: ${currentUrl}`);
    
    // Step 2: Check for login redirect
    if (currentUrl.includes('/i/flow/login') || currentUrl.includes('/login')) {
      console.error(`[B64_AUTH_PROOF] ❌ FAIL: Redirected to login flow`);
      
      try {
        const supabase = getSupabaseClient();
        await supabase.from('system_events').insert({
          event_type: 'EXECUTOR_B64_AUTH_REQUIRED',
          event_data: {
            url: currentUrl,
            reason: 'redirected_to_login',
            temp_profile_dir: TEMP_PROFILE_DIR,
          },
        });
      } catch {
        // Non-blocking
      }
      
      process.exit(1);
    }
    
    // Step 3: Check for consent interstitial
    console.log(`[B64_AUTH_PROOF] 📍 Step 2: Checking for consent interstitial...`);
    const consentResult = await dismissConsent(page, 2);
    
    if (!consentResult.cleared) {
      console.error(`[B64_AUTH_PROOF] ❌ FAIL: Consent wall blocked`);
      process.exit(1);
    }
    
    // Step 4: Verify logged-in state
    console.log(`[B64_AUTH_PROOF] 📍 Step 3: Verifying logged-in state...`);
    await page.waitForTimeout(2000);
    
    const loggedInCheck = await page.evaluate(() => {
      const composeBox = document.querySelector('[data-testid="tweetTextarea_0"]');
      const accountMenu = document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]');
      const timeline = document.querySelector('[data-testid="primaryColumn"]');
      
      return {
        hasComposeBox: !!composeBox,
        hasAccountMenu: !!accountMenu,
        hasTimeline: !!timeline,
      };
    });
    
    if (!loggedInCheck.hasComposeBox && !loggedInCheck.hasAccountMenu && !loggedInCheck.hasTimeline) {
      console.error(`[B64_AUTH_PROOF] ❌ FAIL: Not logged in (no indicators found)`);
      process.exit(1);
    }
    
    console.log(`[B64_AUTH_PROOF] ✅ Logged-in state verified`);
    
    // Step 5: Navigate to compose
    console.log(`[B64_AUTH_PROOF] 📍 Step 4: Navigating to compose...`);
    await page.goto('https://x.com/compose/tweet', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    // Step 6: Find compose textarea
    console.log(`[B64_AUTH_PROOF] 📍 Step 5: Finding compose textarea...`);
    const textarea = page.locator('[data-testid="tweetTextarea_0"]').first();
    await textarea.waitFor({ timeout: 10000 });
    
    // Step 7: Type test text
    console.log(`[B64_AUTH_PROOF] 📍 Step 6: Typing test text...`);
    await textarea.fill('Test');
    await page.waitForTimeout(1000);
    
    // Step 8: Check submit button
    console.log(`[B64_AUTH_PROOF] 📍 Step 7: Checking submit button...`);
    const submitButton = page.locator('[data-testid="tweetButton"]').first();
    const isEnabled = await submitButton.isEnabled().catch(() => false);
    
    if (!isEnabled) {
      console.error(`[B64_AUTH_PROOF] ❌ FAIL: Submit button not enabled`);
      process.exit(1);
    }
    
    console.log(`[B64_AUTH_PROOF] ✅ Submit button is enabled`);
    
    // Step 9: PASS - exit without clicking submit
    console.log(`[B64_AUTH_PROOF] ✅ PASS: Auth + read/write access verified`);
    console.log(`[B64_AUTH_PROOF]   - No login redirect`);
    console.log(`[B64_AUTH_PROOF]   - Consent dismissed (${consentResult.attempts} attempts)`);
    console.log(`[B64_AUTH_PROOF]   - Logged-in state verified`);
    console.log(`[B64_AUTH_PROOF]   - Compose UI accessible`);
    console.log(`[B64_AUTH_PROOF]   - Text typed successfully`);
    console.log(`[B64_AUTH_PROOF]   - Submit button enabled`);
    console.log(`[B64_AUTH_PROOF]   - No tweet submitted (proof only)`);
    
  } catch (error: any) {
    console.error(`[B64_AUTH_PROOF] ❌ FATAL ERROR: ${error.message}`);
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
      fs.rmSync(TEMP_PROFILE_DIR, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}
