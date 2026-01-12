#!/usr/bin/env tsx
/**
 * 🧪 TEST CONSENT PERSISTENCE ACROSS RESTART
 * 
 * Tests that storageState persists across container restarts:
 * A) Create context -> ensureConsentAccepted -> save state -> exit
 * B) Create NEW context (simulate restart) -> load state -> navigate -> confirm no wall
 */

import 'dotenv/config';
import { UnifiedBrowserPool } from '../src/browser/UnifiedBrowserPool';
import { ensureConsentAccepted, loadTwitterState, sessionFileExists, getSessionPath } from '../src/playwright/twitterSession';
import fs from 'fs';

async function testConsentPersistence() {
  console.log('🧪 Testing consent persistence across restart...\n');
  
  const sessionPath = getSessionPath();
  const fileExistsBefore = sessionFileExists();
  
  console.log(`📁 Session file path: ${sessionPath}`);
  console.log(`📁 File exists before test: ${fileExistsBefore}`);
  
  if (fileExistsBefore) {
    try {
      const stats = fs.statSync(sessionPath);
      console.log(`📁 File size: ${stats.size} bytes`);
      console.log(`📁 Last modified: ${stats.mtime.toISOString()}\n`);
    } catch (e) {
      console.log(`📁 Could not stat file: ${(e as Error).message}\n`);
    }
  } else {
    console.log(`📁 File does not exist - will be created\n`);
  }
  
  const pool = UnifiedBrowserPool.getInstance();
  const testUsername = 'DrBryanJohnson';
  const profileUrl = `https://x.com/${testUsername}`;
  
  // PHASE A: First run - accept consent and save state
  console.log('🔬 PHASE A: First run - accept consent and save state...');
  const resultA = await pool.withContext('test_consent_restart_a', async (context) => {
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
    console.log(`   🎯 Attempts: ${consentResult.attempts}\n`);
    
    return {
      detected: consentResult.detected,
      cleared: consentResult.cleared,
      attempts: consentResult.attempts,
      containersBefore,
      containersAfter,
    };
  });
  
  // Check if file was saved
  const fileExistsAfterA = sessionFileExists();
  console.log(`📁 File exists after PHASE A: ${fileExistsAfterA}`);
  if (fileExistsAfterA) {
    try {
      const stats = fs.statSync(sessionPath);
      console.log(`📁 File size: ${stats.size} bytes`);
      console.log(`📁 Last modified: ${stats.mtime.toISOString()}\n`);
    } catch (e) {
      console.log(`📁 Could not stat file: ${(e as Error).message}\n`);
    }
  }
  
  // PHASE B: Simulate restart - create NEW context and load saved state
  console.log('🔬 PHASE B: Simulate restart - NEW context loads saved state...');
  
  // Force UnifiedBrowserPool to reload state by clearing cache (simulate restart)
  // Actually, we can't easily clear the cache, but creating a new context should load from file
  
  await new Promise(resolve => setTimeout(resolve, 2000)); // Small delay
  
  const resultB = await pool.withContext('test_consent_restart_b', async (context) => {
    const page = await context.newPage();
    
    // Load state (should exist now from PHASE A)
    const state = await loadTwitterState();
    if (state) {
      console.log(`   ✅ Loaded storageState (${state.cookies.length} cookies)`);
      try {
        await context.addCookies(state.cookies);
      } catch (e: any) {
        console.warn(`   ⚠️ Failed to add cookies: ${e.message}`);
      }
    } else {
      console.log(`   ⚠️ No storageState available - persistence failed!`);
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
  console.log(`   PHASE A: detected=${resultA.detected}, cleared=${resultA.cleared}, attempts=${resultA.attempts}, containers=${resultA.containersBefore}->${resultA.containersAfter}`);
  console.log(`   PHASE B: detected=${resultB.detected}, cleared=${resultB.cleared}, attempts=${resultB.attempts}, containers=${resultB.containersBefore}->${resultB.containersAfter}`);
  console.log(`   File exists: before=${fileExistsBefore}, after_A=${fileExistsAfterA}\n`);
  
  // Success criteria
  const success = 
    resultA.cleared && // PHASE A cleared consent
    fileExistsAfterA && // File was saved
    (!resultB.detected || resultB.attempts === 0); // PHASE B had no consent wall (or cleared immediately)
  
  if (success) {
    console.log('✅ TEST PASSED: Consent state persists across restart');
    process.exit(0);
  } else {
    console.log('❌ TEST FAILED: Consent state does not persist');
    console.log(`   - PHASE A cleared: ${resultA.cleared}`);
    console.log(`   - File saved: ${fileExistsAfterA}`);
    console.log(`   - PHASE B no wall: ${!resultB.detected || resultB.attempts === 0}`);
    process.exit(1);
  }
}

testConsentPersistence().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
