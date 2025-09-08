#!/usr/bin/env node

/**
 * Session Check Script for xBOT
 * Verifies Playwright can access Twitter compose box without overlays
 */

const { chromium } = require('playwright');
require('dotenv').config();

async function checkSession() {
  console.log('🔐 SESSION_CHECK: Verifying Twitter session and composer access...');
  
  const browser = await chromium.launch({
    headless: process.env.HEADLESS !== 'false'
  });
  
  let success = false;
  let errors = [];
  
  try {
    // Create context with session
    let contextOptions = {};
    
    if (process.env.TWITTER_SESSION_B64) {
      try {
        const storageState = JSON.parse(
          Buffer.from(process.env.TWITTER_SESSION_B64, 'base64').toString()
        );
        contextOptions.storageState = storageState;
        console.log('✅ SESSION_LOADED: Using base64 session state');
      } catch (error) {
        errors.push('Failed to parse TWITTER_SESSION_B64');
      }
    } else {
      errors.push('No TWITTER_SESSION_B64 found');
    }
    
    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();
    
    // Navigate to Twitter home
    console.log('🏠 NAVIGATING: Going to Twitter home...');
    await page.goto('https://x.com/home', { 
      waitUntil: 'networkidle', 
      timeout: 15000 
    });
    
    // Check if logged in
    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('/i/flow/login')) {
      errors.push('Session invalid - redirected to login page');
      throw new Error('Not logged in');
    }
    
    console.log('✅ SESSION_VALID: Successfully accessed Twitter home');
    
    // Check for composer accessibility
    console.log('🎯 COMPOSER_CHECK: Testing composer access...');
    
    const composerSelectors = [
      '[data-testid="tweetTextarea_0"]',
      '[role="textbox"][aria-label*="Post text"]',
      '[role="textbox"][aria-label*="What is happening"]'
    ];
    
    let composerFound = false;
    let composerSelector = null;
    
    for (const selector of composerSelectors) {
      try {
        const element = await page.waitForSelector(selector, { timeout: 5000 });
        if (element) {
          composerFound = true;
          composerSelector = selector;
          console.log(`✅ COMPOSER_FOUND: Using selector ${selector}`);
          break;
        }
      } catch (error) {
        continue;
      }
    }
    
    if (!composerFound) {
      errors.push('Composer not found with any selector');
      throw new Error('Composer inaccessible');
    }
    
    // Test clicking composer
    const composer = await page.$(composerSelector);
    
    if (!composer) {
      errors.push('Composer element not queryable');
      throw new Error('Composer element issue');
    }
    
    // Check for overlays blocking interaction
    const overlaySelectors = [
      '[role="dialog"]',
      '[data-testid="confirmationSheetDialog"]',
      '.modal'
    ];
    
    let overlaysFound = [];
    for (const overlaySelector of overlaySelectors) {
      const overlays = await page.$$(overlaySelector);
      for (const overlay of overlays) {
        const isVisible = await overlay.isVisible();
        if (isVisible) {
          overlaysFound.push(overlaySelector);
        }
      }
    }
    
    if (overlaysFound.length > 0) {
      console.log(`⚠️ OVERLAYS_DETECTED: Found ${overlaysFound.length} overlays - ${overlaysFound.join(', ')}`);
      errors.push(`Blocking overlays detected: ${overlaysFound.join(', ')}`);
    }
    
    // Test bulletproof composer typing
    try {
      await composer.click({ timeout: 3000 });
      console.log('✅ COMPOSER_CLICKABLE: Successfully clicked composer');
      
      // Test typing capability
      const testText = 'Session check typing test';
      
      // Clear any existing content
      await page.keyboard.press('ControlOrMeta+KeyA');
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Type test text
      await page.keyboard.type(testText);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Verify text was typed
      const typedContent = await composer.evaluate(el => el.textContent || el.innerText || '');
      
      if (typedContent.includes(testText)) {
        console.log('✅ COMPOSER_TYPING: Text input successful');
        success = true;
        
        // Clear test content
        await page.keyboard.press('ControlOrMeta+KeyA');
        await page.keyboard.press('Delete');
      } else {
        errors.push(`Typing test failed - expected "${testText}", got "${typedContent}"`);
        
        // Try contenteditable manipulation as fallback
        const manualResult = await composer.evaluate((el, text) => {
          try {
            el.textContent = text;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            return el.textContent || '';
          } catch (e) {
            return 'manual_failed';
          }
        }, testText);
        
        if (manualResult.includes(testText)) {
          console.log('⚠️ COMPOSER_MANUAL_TYPE: Manual typing worked as fallback');
          success = true;
          errors.push('Keyboard typing failed but manual contenteditable worked');
          
          // Clear test content
          await composer.evaluate(el => el.textContent = '');
        } else {
          errors.push('Both keyboard and manual typing failed');
        }
      }
      
    } catch (error) {
      errors.push(`Composer typing test failed: ${error.message}`);
    }
    
    await context.close();
    
  } catch (error) {
    errors.push(`Session check failed: ${error.message}`);
  }
  
  await browser.close();
  
  // Report results
  console.log('\n📊 SESSION_CHECK_RESULTS:');
  console.log('═'.repeat(50));
  
  if (success) {
    console.log('✅ STATUS: PASS - Session valid and composer accessible');
    console.log('🎯 COMPOSER: Ready for posting');
    console.log('🔐 SESSION: Valid and authenticated');
    
    if (errors.length > 0) {
      console.log('\n⚠️ WARNINGS:');
      errors.forEach(error => console.log(`   • ${error}`));
    }
    
    process.exit(0);
  } else {
    console.log('❌ STATUS: FAIL - Session or composer issues detected');
    console.log('\n❌ ERRORS:');
    errors.forEach(error => console.log(`   • ${error}`));
    
    console.log('\n🔧 SUGGESTED FIXES:');
    console.log('   • Update TWITTER_SESSION_B64 with fresh session');
    console.log('   • Run: npm run seed:session');
    console.log('   • Check for Twitter UI changes affecting selectors');
    console.log('   • Verify no blocking overlays or popups');
    
    process.exit(1);
  }
}

// Handle cleanup on exit
process.on('SIGINT', () => {
  console.log('\n⚠️ Session check interrupted');
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught error during session check:', error.message);
  process.exit(1);
});

checkSession().catch(error => {
  console.error('💥 Session check crashed:', error.message);
  process.exit(1);
});
