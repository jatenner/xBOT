#!/usr/bin/env node

/**
 * 🔍 TWITTER PAGE DIAGNOSTIC
 * Debug what's actually on the Twitter page to fix selectors
 */

require('dotenv').config();

async function diagnoseTwitterPage() {
  console.log('🔍 TWITTER PAGE DIAGNOSTIC STARTING...');
  
  try {
    const { BrowserManager } = require('./dist/posting/BrowserManager.js');
    
    console.log('🌐 Launching browser...');
    const browserManager = BrowserManager.getInstance();
    await browserManager.ensureBrowser();
    
    const context = await browserManager.browser.newContext();
    const page = await context.newPage();
    
    console.log('🔐 Loading Twitter session...');
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    
    // Check if we're logged in
    const currentUrl = page.url();
    console.log(`📍 Current URL: ${currentUrl}`);
    
    if (currentUrl.includes('login') || currentUrl.includes('signin')) {
      console.log('❌ NOT LOGGED IN - Session expired or invalid');
      console.log('🔧 Need to refresh Twitter session');
      await context.close();
      return false;
    }
    
    console.log('✅ Twitter session appears valid');
    console.log('');
    
    // Try compose page
    console.log('🔍 CHECKING COMPOSE PAGE...');
    await page.goto('https://x.com/compose/tweet', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    
    // Get page title and URL
    const title = await page.title();
    const composeUrl = page.url();
    console.log(`📍 Compose URL: ${composeUrl}`);
    console.log(`📄 Page Title: ${title}`);
    
    // Find all text input elements
    console.log('🔍 FINDING ALL TEXT INPUT ELEMENTS...');
    const textInputs = await page.$$eval('input[type="text"], textarea, div[contenteditable="true"], div[role="textbox"]', 
      elements => elements.map(el => ({
        tagName: el.tagName,
        type: el.type || 'N/A',
        id: el.id || 'N/A',
        className: el.className || 'N/A',
        dataTestId: el.getAttribute('data-testid') || 'N/A',
        ariaLabel: el.getAttribute('aria-label') || 'N/A',
        placeholder: el.placeholder || 'N/A',
        role: el.getAttribute('role') || 'N/A'
      }))
    );
    
    console.log('📝 TEXT INPUT ELEMENTS FOUND:');
    textInputs.forEach((input, i) => {
      console.log(`   ${i + 1}. ${input.tagName}`);
      console.log(`      data-testid: ${input.dataTestId}`);
      console.log(`      aria-label: ${input.ariaLabel}`);
      console.log(`      role: ${input.role}`);
      console.log(`      class: ${input.className.substring(0, 50)}...`);
      console.log('');
    });
    
    // Look for tweet/post related elements
    console.log('🔍 LOOKING FOR TWITTER COMPOSE ELEMENTS...');
    const twitterElements = await page.$$eval('[data-testid*="tweet"], [data-testid*="post"], [aria-label*="Tweet"], [aria-label*="Post"]', 
      elements => elements.map(el => ({
        tagName: el.tagName,
        dataTestId: el.getAttribute('data-testid') || 'N/A',
        ariaLabel: el.getAttribute('aria-label') || 'N/A',
        className: el.className.substring(0, 100) || 'N/A'
      }))
    );
    
    console.log('🐦 TWITTER-SPECIFIC ELEMENTS:');
    twitterElements.forEach((el, i) => {
      console.log(`   ${i + 1}. ${el.tagName} - ${el.dataTestId} - ${el.ariaLabel}`);
    });
    
    // Try the keyboard shortcut approach
    console.log('🔍 TESTING KEYBOARD SHORTCUT...');
    await page.keyboard.press('n'); // Twitter shortcut for new tweet
    await page.waitForTimeout(2000);
    
    // Check again for compose elements
    const afterShortcut = await page.$$eval('div[contenteditable="true"], [data-testid*="tweet"], [role="textbox"]', 
      elements => elements.map(el => ({
        tagName: el.tagName,
        dataTestId: el.getAttribute('data-testid') || 'N/A',
        ariaLabel: el.getAttribute('aria-label') || 'N/A',
        visible: el.offsetWidth > 0 && el.offsetHeight > 0
      }))
    );
    
    console.log('🔍 AFTER KEYBOARD SHORTCUT:');
    afterShortcut.forEach((el, i) => {
      console.log(`   ${i + 1}. ${el.tagName} - ${el.dataTestId} - visible: ${el.visible}`);
    });
    
    // Take a screenshot for debugging
    console.log('📸 Taking screenshot for debugging...');
    await page.screenshot({ path: 'twitter-debug.png', fullPage: true });
    console.log('✅ Screenshot saved as twitter-debug.png');
    
    await context.close();
    
    console.log('');
    console.log('🎯 DIAGNOSTIC COMPLETE!');
    console.log('📋 FINDINGS:');
    console.log(`   - Session status: ${currentUrl.includes('login') ? 'INVALID' : 'VALID'}`);
    console.log(`   - Text inputs found: ${textInputs.length}`);
    console.log(`   - Twitter elements found: ${twitterElements.length}`);
    console.log(`   - Screenshot saved for visual inspection`);
    
    return true;
    
  } catch (error) {
    console.error('💥 DIAGNOSTIC FAILED:', error.message);
    return false;
  }
}

// Execute diagnostic
diagnoseTwitterPage().then((success) => {
  if (success) {
    console.log('');
    console.log('✅ DIAGNOSTIC COMPLETED SUCCESSFULLY');
    console.log('🔧 Use the findings above to fix the Twitter selectors');
  } else {
    console.log('');
    console.log('❌ DIAGNOSTIC FAILED');
    console.log('🔧 Check Twitter session and browser setup');
  }
}).catch(console.error);
