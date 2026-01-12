#!/usr/bin/env tsx
/**
 * 🧪 DETERMINISTIC CONSENT STATE TEST
 * 
 * Tests that storageState persistence works across contexts:
 * 1. First fetch: should detect consent wall, accept it, save state
 * 2. Second fetch (same run): should load saved state, no consent wall
 * 3. Third fetch (new context): should load saved state, no consent wall
 */

import 'dotenv/config';
import { UnifiedBrowserPool } from '../src/browser/UnifiedBrowserPool';
import { ensureConsentAccepted, loadTwitterState, sessionFileExists, getSessionPath } from '../src/playwright/twitterSession';

async function testConsentState() {
  console.log('🧪 Testing consent state persistence...\n');
  
  const sessionPath = getSessionPath();
  const fileExistsBefore = sessionFileExists();
  
  console.log(`📁 Session file path: ${sessionPath}`);
  console.log(`📁 File exists before test: ${fileExistsBefore}\n`);
  
  const pool = UnifiedBrowserPool.getInstance();
  const testUsername = 'DrBryanJohnson'; // Use a known account
  const profileUrl = `https://x.com/${testUsername}`;
  
  // Test 1: First fetch (should encounter consent wall)
  console.log('🔬 TEST 1: First fetch (expect consent wall)...');
  const result1 = await pool.withContext('test_consent_1', async (context) => {
    const page = await context.newPage();
    
    // Load state if available
    const state = await loadTwitterState();
    if (state) {
      console.log(`   ✅ Loaded storageState (${state.cookies.length} cookies)`);
      try {
        await context.addCookies(state.cookies);
      } catch (e: any) {
        console.warn(`   ⚠️ Failed to add cookies: ${e.message}`);
      }
    } else {
      console.log(`   ⚠️ No storageState available`);
    }
    
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    
    const containersBefore = await page.evaluate(() => {
      return document.querySelectorAll('article[data-testid="tweet"]').length;
    });
    
    console.log(`   📊 Containers before consent handling: ${containersBefore}`);
    
    const consentResult = await ensureConsentAccepted(page, async () => {
      await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);
    });
    
    const containersAfter = await page.evaluate(() => {
      return document.querySelectorAll('article[data-testid="tweet"]').length;
    });
    
    console.log(`   📊 Containers after consent handling: ${containersAfter}`);
    console.log(`   🎯 Consent detected: ${consentResult.detected}`);
    console.log(`   🎯 Consent cleared: ${consentResult.cleared}`);
    console.log(`   🎯 Attempts: ${consentResult.attempts}`);
    console.log(`   🎯 Matched selector: ${consentResult.matchedSelector || 'none'}\n`);
    
    return {
      detected: consentResult.detected,
      cleared: consentResult.cleared,
      attempts: consentResult.attempts,
      containersBefore,
      containersAfter,
    };
  });
  
  // Check if file was saved
  const fileExistsAfter = sessionFileExists();
  console.log(`📁 File exists after TEST 1: ${fileExistsAfter}`);
  if (fileExistsAfter && !fileExistsBefore) {
    console.log(`   ✅ Session file created!\n`);
  } else if (fileExistsAfter) {
    console.log(`   ✅ Session file updated!\n`);
  } else {
    console.log(`   ⚠️ Session file not found after consent acceptance\n`);
  }
  
  // Test 2: Second fetch (same run, should use saved state)
  console.log('🔬 TEST 2: Second fetch (same run, expect no consent wall)...');
  await new Promise(resolve => setTimeout(resolve, 2000)); // Small delay
  
  const result2 = await pool.withContext('test_consent_2', async (context) => {
    const page = await context.newPage();
    
    // Load state (should exist now)
    const state = await loadTwitterState();
    if (state) {
      console.log(`   ✅ Loaded storageState (${state.cookies.length} cookies)`);
      try {
        await context.addCookies(state.cookies);
      } catch (e: any) {
        console.warn(`   ⚠️ Failed to add cookies: ${e.message}`);
      }
    } else {
      console.log(`   ⚠️ No storageState available`);
    }
    
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    
    const containersBefore = await page.evaluate(() => {
      return document.querySelectorAll('article[data-testid="tweet"]').length;
    });
    
    console.log(`   📊 Containers before consent handling: ${containersBefore}`);
    
    const consentResult = await ensureConsentAccepted(page, async () => {
      await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);
    });
    
    const containersAfter = await page.evaluate(() => {
      return document.querySelectorAll('article[data-testid="tweet"]').length;
    });
    
    console.log(`   📊 Containers after consent handling: ${containersAfter}`);
    console.log(`   🎯 Consent detected: ${consentResult.detected}`);
    console.log(`   🎯 Consent cleared: ${consentResult.cleared}`);
    console.log(`   🎯 Attempts: ${consentResult.attempts}\n`);
    
    return {
      detected: consentResult.detected,
      cleared: consentResult.cleared,
      attempts: consentResult.attempts,
      containersBefore,
      containersAfter,
    };
  });
  
  // Summary
  console.log('📊 TEST SUMMARY:');
  console.log(`   TEST 1: detected=${result1.detected}, cleared=${result1.cleared}, attempts=${result1.attempts}, containers=${result1.containersBefore}->${result1.containersAfter}`);
  console.log(`   TEST 2: detected=${result2.detected}, cleared=${result2.cleared}, attempts=${result2.attempts}, containers=${result2.containersBefore}->${result2.containersAfter}`);
  console.log(`   File exists: before=${fileExistsBefore}, after=${fileExistsAfter}\n`);
  
  // Success criteria
  const success = 
    result1.cleared && // First fetch cleared consent
    fileExistsAfter && // File was saved
    (!result2.detected || result2.attempts === 0); // Second fetch had no consent wall (or cleared immediately)
  
  if (success) {
    console.log('✅ TEST PASSED: Consent state persistence working');
    process.exit(0);
  } else {
    console.log('❌ TEST FAILED: Consent state persistence not working');
    console.log(`   - TEST 1 cleared: ${result1.cleared}`);
    console.log(`   - File saved: ${fileExistsAfter}`);
    console.log(`   - TEST 2 no wall: ${!result2.detected || result2.attempts === 0}`);
    process.exit(1);
  }
}

testConsentState().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
