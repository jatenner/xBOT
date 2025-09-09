#!/usr/bin/env tsx

/**
 * DEBUG SCRIPT: Test what Twitter page actually loads
 * This will help us understand why the composer isn't found
 */

import { chromium } from 'playwright';

async function debugTwitterUI() {
  console.log('🔍 DEBUG: Testing Twitter UI accessibility...');
  
  const browser = await chromium.launch({ 
    headless: false,  // Run with GUI to see what happens
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    console.log('🌐 STEP 1: Loading x.com/home...');
    await page.goto('https://x.com/home', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    console.log('✅ STEP 2: Page loaded, taking screenshot...');
    await page.screenshot({ path: 'debug-twitter-page.png', fullPage: true });
    
    console.log('🔍 STEP 3: Looking for composer elements...');
    
    // Test all possible composer selectors
    const selectors = [
      '[data-testid="tweetTextarea_0"]',
      '[contenteditable="true"]',
      '[data-testid="tweetButton"]',
      '[placeholder*="happening"]',
      '[placeholder*="What"]',
      'div[contenteditable="true"]',
      '.public-DraftEditor-content',
      '.notranslate'
    ];
    
    for (const selector of selectors) {
      try {
        const element = await page.locator(selector).first();
        const count = await element.count();
        console.log(`📝 ${selector}: ${count > 0 ? '✅ FOUND' : '❌ NOT FOUND'} (${count} elements)`);
        
        if (count > 0) {
          const isVisible = await element.isVisible();
          console.log(`   👁️  Visible: ${isVisible}`);
        }
      } catch (error) {
        console.log(`📝 ${selector}: ❌ ERROR - ${error.message}`);
      }
    }
    
    console.log('📄 STEP 4: Getting page content info...');
    const title = await page.title();
    const url = page.url();
    console.log(`   Title: ${title}`);
    console.log(`   URL: ${url}`);
    
    // Check if we're logged in
    const loginCheck = await page.locator('text=Log in').count();
    console.log(`   🔐 Login required: ${loginCheck > 0 ? 'YES' : 'NO'}`);
    
    // Wait for user input
    console.log('\n⏸️  Check the screenshot and browser window. Press Enter to continue...');
    
  } catch (error) {
    console.error('❌ DEBUG ERROR:', error);
  } finally {
    await browser.close();
  }
}

// Run the debug
debugTwitterUI().catch(console.error);
