#!/usr/bin/env tsx
/**
 * 🎯 FORCE CREATE SESSION STATE
 * 
 * Deterministically creates /data/twitter_session.json:
 * 1) Starts Playwright using twitterSession manager
 * 2) Navigates to a known URL that triggers consent if needed
 * 3) Runs ensureConsentAccepted()
 * 4) ALWAYS calls saveTwitterState()
 * 5) Prints file stats
 * 6) Exits non-zero if file doesn't exist or is size==0
 */

import 'dotenv/config';
import { UnifiedBrowserPool } from '../src/browser/UnifiedBrowserPool';
import { ensureConsentAccepted, loadTwitterState, saveTwitterState, getSessionPath, sessionFileExists } from '../src/playwright/twitterSession';
import { getSessionPathInfo } from '../src/utils/sessionPathResolver';
import fs from 'fs';

async function forceCreateSessionState() {
  console.log('🎯 Force creating session state...\n');
  
  // Get path info before
  const infoBefore = getSessionPathInfo();
  console.log('📋 BEFORE:');
  console.log(`   Resolved path: ${infoBefore.resolvedPath}`);
  console.log(`   File exists: ${infoBefore.exists}`);
  console.log(`   File size: ${infoBefore.size || 0} bytes`);
  console.log(`   Directory writable: ${infoBefore.writable}\n`);
  
  const pool = UnifiedBrowserPool.getInstance();
  const testUrl = 'https://x.com/DrBryanJohnson'; // Known account that may trigger consent
  
  let consentDetected = false;
  let consentCleared = false;
  let attempts = 0;
  let variant: string | undefined;
  let screenshotPath: string | undefined;
  let htmlSnippet: string | undefined;
  
  try {
    await pool.withContext('force_create_session', async (context) => {
      const page = await context.newPage();
      
      // Load existing state if available
      const existingState = await loadTwitterState();
      if (existingState) {
        console.log(`✅ Loaded existing state (${existingState.cookies.length} cookies)`);
        try {
          await context.addCookies(existingState.cookies);
        } catch (e: any) {
          console.warn(`⚠️ Failed to add cookies: ${e.message}`);
        }
      } else {
        console.log(`⚠️ No existing state found`);
      }
      
      console.log(`\n🌐 Navigating to ${testUrl}...`);
      await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);
      
      const containersBefore = await page.evaluate(() => {
        return document.querySelectorAll('article[data-testid="tweet"]').length;
      });
      console.log(`📊 Containers before consent handling: ${containersBefore}`);
      
      // Ensure consent is accepted
      console.log(`\n🔍 Checking for consent wall...`);
      const consentResult = await ensureConsentAccepted(page, async () => {
        await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000);
      });
      
      consentDetected = consentResult.detected;
      consentCleared = consentResult.cleared;
      attempts = consentResult.attempts;
      variant = consentResult.variant;
      screenshotPath = consentResult.screenshotPath;
      htmlSnippet = consentResult.htmlSnippet;
      
      const containersAfter = await page.evaluate(() => {
        return document.querySelectorAll('article[data-testid="tweet"]').length;
      });
      console.log(`📊 Containers after consent handling: ${containersAfter}`);
      
      console.log(`\n🎯 Consent result:`);
      console.log(`   Detected: ${consentDetected}`);
      console.log(`   Cleared: ${consentCleared}`);
      console.log(`   Attempts: ${attempts}`);
      if (variant) console.log(`   Variant: ${variant}`);
      if (screenshotPath) console.log(`   Screenshot: ${screenshotPath}`);
      
      // ALWAYS save state (even if consent wasn't detected, cookies may have been set)
      console.log(`\n💾 Saving session state...`);
      const saved = await saveTwitterState(context);
      console.log(`   Saved: ${saved}`);
      
      if (!saved) {
        console.error(`❌ Failed to save session state`);
        process.exit(1);
      }
    });
  } catch (error: any) {
    console.error(`❌ Error during session creation: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
  
  // Verify file exists and has size > 0
  const infoAfter = getSessionPathInfo();
  console.log(`\n📋 AFTER:`);
  console.log(`   Resolved path: ${infoAfter.resolvedPath}`);
  console.log(`   File exists: ${infoAfter.exists}`);
  console.log(`   File size: ${infoAfter.size || 0} bytes`);
  console.log(`   Last modified: ${infoAfter.mtime || 'N/A'}`);
  
  if (!infoAfter.exists) {
    console.error(`\n❌ TEST FAILED: Session file does not exist`);
    process.exit(1);
  }
  
  if (infoAfter.size === 0) {
    console.error(`\n❌ TEST FAILED: Session file is empty (size=0)`);
    process.exit(1);
  }
  
  // Print failure details if consent wasn't cleared
  if (consentDetected && !consentCleared) {
    console.log(`\n⚠️ CONSENT WALL NOT CLEARED:`);
    console.log(`   Variant: ${variant || 'unknown'}`);
    console.log(`   Screenshot: ${screenshotPath || 'none'}`);
    if (htmlSnippet) {
      console.log(`   HTML snippet (first 500 chars):`);
      console.log(`   ${htmlSnippet.substring(0, 500)}`);
    }
    console.log(`   Current URL: ${testUrl}`);
  }
  
  console.log(`\n✅ TEST PASSED: Session file created successfully`);
  console.log(`   Path: ${infoAfter.resolvedPath}`);
  console.log(`   Size: ${infoAfter.size} bytes`);
  process.exit(0);
}

forceCreateSessionState().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
