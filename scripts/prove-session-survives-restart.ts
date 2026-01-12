#!/usr/bin/env tsx
/**
 * 🎯 PROVE SESSION SURVIVES RESTART
 * 
 * Tests that session state persists across container restarts:
 * 1) Run force-create-session-state.ts first
 * 2) Start a NEW Playwright context/process
 * 3) Confirm loadTwitterState() reports LOADED and consent is NOT blocking
 * 4) Print file stats again
 */

import 'dotenv/config';
import { UnifiedBrowserPool } from '../src/browser/UnifiedBrowserPool';
import { loadTwitterState, getSessionPath, sessionFileExists } from '../src/playwright/twitterSession';
import { getSessionPathInfo } from '../src/utils/sessionPathResolver';
import { ensureConsentAccepted } from '../src/playwright/twitterSession';

async function proveSessionSurvivesRestart() {
  console.log('🧪 Proving session survives restart...\n');
  
  // Check file exists before loading
  const infoBefore = getSessionPathInfo();
  console.log('📋 BEFORE LOAD:');
  console.log(`   Resolved path: ${infoBefore.resolvedPath}`);
  console.log(`   File exists: ${infoBefore.exists}`);
  console.log(`   File size: ${infoBefore.size || 0} bytes`);
  console.log(`   Last modified: ${infoBefore.mtime || 'N/A'}\n`);
  
  if (!infoBefore.exists) {
    console.error(`❌ TEST FAILED: Session file does not exist. Run force-create-session-state.ts first.`);
    process.exit(1);
  }
  
  if (infoBefore.size === 0) {
    console.error(`❌ TEST FAILED: Session file is empty (size=0)`);
    process.exit(1);
  }
  
  const pool = UnifiedBrowserPool.getInstance();
  const testUrl = 'https://x.com/DrBryanJohnson';
  
  let stateLoaded = false;
  let cookieCount = 0;
  let consentDetected = false;
  let consentCleared = false;
  
  try {
    // Create a NEW context (simulating restart)
    await pool.withContext('prove_session_restart', async (context) => {
      const page = await context.newPage();
      
      // Load state (should exist from previous run)
      console.log(`📦 Loading session state...`);
      const state = await loadTwitterState();
      
      if (!state || state.cookies.length === 0) {
        console.error(`❌ TEST FAILED: No state loaded or empty cookies`);
        console.error(`   State: ${state ? 'exists' : 'null'}`);
        console.error(`   Cookies: ${state?.cookies.length || 0}`);
        process.exit(1);
      }
      
      stateLoaded = true;
      cookieCount = state.cookies.length;
      console.log(`✅ State loaded: ${cookieCount} cookies`);
      
      // Add cookies to context
      try {
        await context.addCookies(state.cookies);
        console.log(`✅ Cookies added to context`);
      } catch (e: any) {
        console.warn(`⚠️ Failed to add cookies: ${e.message}`);
      }
      
      // Navigate and check for consent wall
      console.log(`\n🌐 Navigating to ${testUrl}...`);
      await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);
      
      const containersBefore = await page.evaluate(() => {
        return document.querySelectorAll('article[data-testid="tweet"]').length;
      });
      console.log(`📊 Containers before consent check: ${containersBefore}`);
      
      // Check if consent wall is blocking
      const consentResult = await ensureConsentAccepted(page, async () => {
        await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000);
      });
      
      consentDetected = consentResult.detected;
      consentCleared = consentResult.cleared;
      
      const containersAfter = await page.evaluate(() => {
        return document.querySelectorAll('article[data-testid="tweet"]').length;
      });
      console.log(`📊 Containers after consent check: ${containersAfter}`);
      
      console.log(`\n🎯 Consent check result:`);
      console.log(`   Detected: ${consentDetected}`);
      console.log(`   Cleared: ${consentCleared}`);
      console.log(`   Containers: ${containersBefore} -> ${containersAfter}`);
      
      // Success criteria: consent should NOT be blocking (or cleared immediately)
      if (consentDetected && containersAfter === 0) {
        console.error(`\n❌ TEST FAILED: Consent wall is still blocking after loading state`);
        console.error(`   This indicates state persistence is not working correctly`);
        process.exit(1);
      }
    });
  } catch (error: any) {
    console.error(`❌ Error during restart test: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
  
  // Check file stats after
  const infoAfter = getSessionPathInfo();
  console.log(`\n📋 AFTER TEST:`);
  console.log(`   Resolved path: ${infoAfter.resolvedPath}`);
  console.log(`   File exists: ${infoAfter.exists}`);
  console.log(`   File size: ${infoAfter.size || 0} bytes`);
  console.log(`   Last modified: ${infoAfter.mtime || 'N/A'}`);
  
  // Verify success
  if (!stateLoaded) {
    console.error(`\n❌ TEST FAILED: State was not loaded`);
    process.exit(1);
  }
  
  if (cookieCount === 0) {
    console.error(`\n❌ TEST FAILED: No cookies in loaded state`);
    process.exit(1);
  }
  
  if (consentDetected && !consentCleared) {
    console.error(`\n❌ TEST FAILED: Consent wall detected and not cleared`);
    process.exit(1);
  }
  
  console.log(`\n✅ TEST PASSED: Session state survives restart`);
  console.log(`   State loaded: ${stateLoaded}`);
  console.log(`   Cookies: ${cookieCount}`);
  console.log(`   Consent blocking: ${consentDetected && !consentCleared ? 'YES' : 'NO'}`);
  process.exit(0);
}

proveSessionSurvivesRestart().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
