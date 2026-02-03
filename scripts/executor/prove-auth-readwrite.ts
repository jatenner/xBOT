#!/usr/bin/env tsx
/**
 * 🔐 EXECUTOR AUTH READ/WRITE PROOF
 * 
 * Proves X.com authentication + read/write UI access from executor profile.
 * Does NOT submit tweets - only verifies compose UI is accessible.
 * 
 * Usage:
 *   RUNNER_PROFILE_DIR=./.runner-profile pnpm run executor:prove:auth-readwrite
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { chromium, BrowserContext, Page } from 'playwright';
import { ensureRunnerProfileDir, RUNNER_PROFILE_PATHS, getRunnerPaths } from '../../src/infra/runnerProfile';
import { getSupabaseClient } from '../../src/db/index';

const RUNNER_PROFILE_DIR = ensureRunnerProfileDir();
const BROWSER_USER_DATA_DIR = RUNNER_PROFILE_PATHS.chromeProfile();

interface ConsentDismissResult {
  dismissed: boolean;
  attempts: number;
  error?: string;
}

/**
 * Dismiss consent interstitial deterministically
 * Uses existing acceptConsentWall logic with retry
 */
async function dismissConsent(page: Page, maxAttempts: number = 2): Promise<ConsentDismissResult> {
  const { detectConsentWall, acceptConsentWall } = await import('../../src/playwright/twitterSession');
  
  // Detect consent wall
  const detection = await detectConsentWall(page);
  
  if (!detection.detected || detection.wallType !== 'consent') {
    return { dismissed: true, attempts: 0 };
  }
  
  console.log(`[EXECUTOR_PROVE] 🚧 Consent interstitial detected, attempting dismissal...`);
  
  // Use existing acceptConsentWall with maxAttempts
  const result = await acceptConsentWall(page, maxAttempts);
  
  if (result.cleared) {
    console.log(`[EXECUTOR_PROVE] ✅ Consent dismissed successfully (attempts: ${result.attempts})`);
    
    // Emit event
    try {
      const supabase = getSupabaseClient();
      await supabase.from('system_events').insert({
        event_type: 'EXECUTOR_CONSENT_DISMISSED',
        event_data: {
          attempts: result.attempts,
          matched_selector: result.matchedSelector,
          variant: result.variant,
        },
      });
    } catch {
      // Non-blocking
    }
    
    return { dismissed: true, attempts: result.attempts };
  } else {
    console.error(`[EXECUTOR_PROVE] ❌ Consent dismissal failed after ${result.attempts} attempts`);
    
    // Emit event
    try {
      const supabase = getSupabaseClient();
      await supabase.from('system_events').insert({
        event_type: 'EXECUTOR_CONSENT_BLOCKED',
        event_data: {
          attempts: result.attempts,
          variant: result.variant,
          detail: result.detail,
          screenshot_path: result.screenshotPath,
        },
      });
    } catch {
      // Non-blocking
    }
    
    return { 
      dismissed: false, 
      attempts: result.attempts,
      error: `Consent wall not cleared after ${result.attempts} attempts`,
    };
  }
}

async function main(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🔐 EXECUTOR AUTH READ/WRITE PROOF');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const paths = getRunnerPaths();
  console.log(`📋 Configuration:`);
  console.log(`   RUNNER_PROFILE_DIR: ${paths.runner_profile_dir_raw}`);
  console.log(`   Browser profile: ${BROWSER_USER_DATA_DIR}`);
  console.log(`   Mode: HEADLESS (proof only, no submit)\n`);
  
  // Ensure user data dir exists
  if (!fs.existsSync(BROWSER_USER_DATA_DIR)) {
    fs.mkdirSync(BROWSER_USER_DATA_DIR, { recursive: true });
  }
  
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  
  try {
    // Launch executor context using RUNNER_PROFILE_DIR
    console.log(`[EXECUTOR_PROVE] 🚀 Launching executor browser context...`);
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
    
    page = await context.newPage();
    
    // Step 1: Visit https://x.com/home
    console.log(`[EXECUTOR_PROVE] 📍 Step 1: Visiting https://x.com/home...`);
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000); // Wait for page to settle
    
    const currentUrl = page.url();
    console.log(`[EXECUTOR_PROVE]   Current URL: ${currentUrl}`);
    
    // Step 2: Check for login redirect
    if (currentUrl.includes('/i/flow/login')) {
      console.error(`[EXECUTOR_PROVE] ❌ FAIL: Redirected to login flow`);
      
      try {
        const supabase = getSupabaseClient();
        await supabase.from('system_events').insert({
          event_type: 'EXECUTOR_AUTH_REQUIRED',
          event_data: {
            url: currentUrl,
            reason: 'redirected_to_login',
          },
        });
      } catch {
        // Non-blocking
      }
      
      console.error(`[EXECUTOR_PROVE] ❌ EXECUTOR_AUTH_REQUIRED: Login required`);
      process.exit(1);
    }
    
    // Step 3: Check for consent interstitial
    console.log(`[EXECUTOR_PROVE] 📍 Step 2: Checking for consent interstitial...`);
    console.log(`[EXECUTOR_PROVE]   Current URL: ${currentUrl}`);
    
    // Phase B: Diagnostic logging
    const frames = page.frames();
    console.log(`[EXECUTOR_PROVE]   Frames count: ${frames.length}`);
    for (let i = 0; i < frames.length; i++) {
      try {
        const frameUrl = frames[i].url();
        console.log(`[EXECUTOR_PROVE]   Frame ${i}: ${frameUrl}`);
      } catch {
        console.log(`[EXECUTOR_PROVE]   Frame ${i}: (unable to get URL)`);
      }
    }
    
    // Log candidate buttons
    try {
      const candidates = await page.evaluate(() => {
        const buttons: Array<{ text: string; ariaLabel: string | null }> = [];
        document.querySelectorAll('button, [role="button"], a[role="button"]').forEach(el => {
          const text = el.textContent?.trim() || '';
          const ariaLabel = el.getAttribute('aria-label');
          if (/accept|agree|allow|continue|ok/i.test(text) || (ariaLabel && /accept|agree|allow|continue|ok/i.test(ariaLabel))) {
            buttons.push({ text: text.substring(0, 50), ariaLabel });
          }
        });
        return buttons;
      });
      console.log(`[EXECUTOR_PROVE]   Candidate buttons on page: ${candidates.length}`);
      candidates.slice(0, 5).forEach((c, i) => {
        console.log(`[EXECUTOR_PROVE]     Button ${i + 1}: text="${c.text}" aria-label="${c.ariaLabel || 'none'}"`);
      });
      
      // Check frames for buttons
      for (let i = 0; i < frames.length; i++) {
        if (frames[i] === page.mainFrame()) continue;
        try {
          const frameCandidates = await frames[i].evaluate(() => {
            const buttons: Array<{ text: string; ariaLabel: string | null }> = [];
            document.querySelectorAll('button, [role="button"], a[role="button"]').forEach(el => {
              const text = el.textContent?.trim() || '';
              const ariaLabel = el.getAttribute('aria-label');
              if (/accept|agree|allow|continue|ok/i.test(text) || (ariaLabel && /accept|agree|allow|continue|ok/i.test(ariaLabel))) {
                buttons.push({ text: text.substring(0, 50), ariaLabel });
              }
            });
            return buttons;
          });
          if (frameCandidates.length > 0) {
            console.log(`[EXECUTOR_PROVE]   Candidate buttons in frame ${i}: ${frameCandidates.length}`);
            frameCandidates.slice(0, 3).forEach((c, j) => {
              console.log(`[EXECUTOR_PROVE]     Frame ${i} Button ${j + 1}: text="${c.text}" aria-label="${c.ariaLabel || 'none'}"`);
            });
          }
        } catch {
          // Frame may not be accessible
        }
      }
    } catch (e: any) {
      console.log(`[EXECUTOR_PROVE]   ⚠️ Could not log candidate buttons: ${e.message}`);
    }
    
    const consentResult = await dismissConsent(page, 2);
    
    if (!consentResult.dismissed) {
      console.error(`[EXECUTOR_PROVE] ❌ FAIL: Consent interstitial not dismissed`);
      console.error(`[EXECUTOR_PROVE] ❌ EXECUTOR_CONSENT_BLOCKED: ${consentResult.error}`);
      
      // Emit event with diagnostic info
      try {
        const supabase = getSupabaseClient();
        const frameUrls = frames.map(f => {
          try {
            return f.url();
          } catch {
            return '(unable to get URL)';
          }
        });
        await supabase.from('system_events').insert({
          event_type: 'EXECUTOR_CONSENT_BLOCKED',
          event_data: {
            url: currentUrl,
            frames: frameUrls,
            attempts: consentResult.attempts,
            error: consentResult.error,
          },
        });
      } catch {
        // Non-blocking
      }
      
      process.exit(1);
    }
    
    // Step 4: Verify logged-in state (check for logged-in-only selectors)
    console.log(`[EXECUTOR_PROVE] 📍 Step 3: Verifying logged-in state...`);
    await page.waitForTimeout(2000); // Wait for page to settle
    
    const loggedInSelectors = [
      '[data-testid="tweetTextarea_0"]', // Compose box
      '[data-testid="SideNav_AccountSwitcher_Button"]', // Account menu
      'article[data-testid="tweet"]', // Tweet containers
    ];
    
    let loggedIn = false;
    for (const selector of loggedInSelectors) {
      try {
        const element = await page.locator(selector).first();
        if (await element.isVisible({ timeout: 3000 }).catch(() => false)) {
          loggedIn = true;
          console.log(`[EXECUTOR_PROVE] ✅ Logged-in selector found: ${selector}`);
          break;
        }
      } catch {
        // Continue
      }
    }
    
    if (!loggedIn) {
      console.error(`[EXECUTOR_PROVE] ❌ FAIL: No logged-in selectors found`);
      process.exit(1);
    }
    
    // Step 5: Open compose UI
    console.log(`[EXECUTOR_PROVE] 📍 Step 4: Opening compose UI...`);
    await page.goto('https://x.com/compose/post', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000); // Wait for page to settle
    
    // Check for consent again after navigation
    const consentResult2 = await dismissConsent(page, 2);
    if (!consentResult2.dismissed) {
      console.error(`[EXECUTOR_PROVE] ❌ FAIL: Consent interstitial on compose page`);
      process.exit(1);
    }
    
    // Step 6: Type test text into compose box
    console.log(`[EXECUTOR_PROVE] 📍 Step 5: Typing test text into compose box...`);
    const testText = 'P1 auth probe (no submit)';
    
    // Wait for compose textarea (may be contenteditable div)
    const composeTextarea = page.locator('[data-testid="tweetTextarea_0"]').first();
    await composeTextarea.waitFor({ state: 'visible', timeout: 10000 });
    
    // Click to focus
    await composeTextarea.click();
    await page.waitForTimeout(500);
    
    // Type text (works for both textarea and contenteditable div)
    await composeTextarea.type(testText, { delay: 50 });
    await page.waitForTimeout(1000); // Wait for text to be set
    
    // Step 7: Verify text is present and submit button is enabled
    console.log(`[EXECUTOR_PROVE] 📍 Step 6: Verifying text and submit button...`);
    
    // Get text content (works for both textarea and contenteditable)
    const textareaValue = await composeTextarea.evaluate((el: any) => {
      if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
        return el.value || '';
      }
      return el.textContent || el.innerText || '';
    });
    
    if (!textareaValue.includes(testText)) {
      console.error(`[EXECUTOR_PROVE] ❌ FAIL: Text not found in textarea`);
      console.error(`[EXECUTOR_PROVE]   Expected: "${testText}"`);
      console.error(`[EXECUTOR_PROVE]   Got: "${textareaValue}"`);
      process.exit(1);
    }
    
    console.log(`[EXECUTOR_PROVE] ✅ Text verified in textarea`);
    
    // Check submit button (tweet button)
    const submitButton = page.locator('[data-testid="tweetButton"]').first();
    const isEnabled = await submitButton.isEnabled().catch(() => false);
    
    if (!isEnabled) {
      console.error(`[EXECUTOR_PROVE] ❌ FAIL: Submit button not enabled`);
      process.exit(1);
    }
    
    console.log(`[EXECUTOR_PROVE] ✅ Submit button is enabled`);
    
    // Step 8: PASS - exit without clicking submit
    console.log(`[EXECUTOR_PROVE] ✅ PASS: Auth + read/write access verified`);
    console.log(`[EXECUTOR_PROVE]   - No login redirect`);
    console.log(`[EXECUTOR_PROVE]   - Consent dismissed (${consentResult.attempts} attempts)`);
    console.log(`[EXECUTOR_PROVE]   - Logged-in state verified`);
    console.log(`[EXECUTOR_PROVE]   - Compose UI accessible`);
    console.log(`[EXECUTOR_PROVE]   - Text typed successfully`);
    console.log(`[EXECUTOR_PROVE]   - Submit button enabled`);
    console.log(`[EXECUTOR_PROVE]   - No tweet submitted (proof only)`);
    
  } catch (error: any) {
    console.error(`[EXECUTOR_PROVE] ❌ FATAL ERROR: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
    if (context) {
      await context.close().catch(() => {});
    }
  }
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
