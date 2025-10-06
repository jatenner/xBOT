#!/usr/bin/env node

/**
 * 🚀 DIRECT POSTING TEST
 * Test posting directly using our fixed session
 */

const { chromium } = require('playwright');
const fs = require('fs');

async function testDirectPosting() {
  console.log('🚀 Testing Direct X.com Posting...');
  
  // Load session
  const sessionPath = './data/twitter_session.json';
  const sessionData = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
  console.log(`✅ Loaded ${sessionData.cookies?.length || 0} cookies`);
  
  // Launch browser
  const browser = await chromium.launch({
    headless: false, // Keep visible to see what happens
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=VizDisplayCompositor,TranslateUI',
      '--disable-web-security'
    ]
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 }
  });

  // Apply cookies
  await context.addCookies(sessionData.cookies);
  console.log('✅ Applied cookies to browser');

  const page = await context.newPage();
  
  try {
    console.log('🌐 Navigating to X.com...');
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Wait for page to load
    await page.waitForTimeout(3000);
    
    const title = await page.title();
    const url = page.url();
    console.log(`📄 Page loaded: "${title}" at ${url}`);
    
    // Check if logged in
    const composeButton = await page.$('[data-testid="SideNav_NewTweet_Button"]');
    if (!composeButton) {
      throw new Error('Compose button not found - not logged in');
    }
    console.log('✅ Compose button found - logged in successfully');
    
    // Click compose button
    console.log('🖱️ Clicking compose button...');
    await composeButton.click();
    await page.waitForTimeout(2000);
    
    // Find text area
    const textArea = await page.waitForSelector('[data-testid="tweetTextarea_0"]', { timeout: 10000 });
    if (!textArea) {
      throw new Error('Text area not found');
    }
    console.log('✅ Text area found');
    
    // Type test message
    const testMessage = `🎉 X automation is working! Test post at ${new Date().toLocaleTimeString()}`;
    console.log(`✍️ Typing message: "${testMessage}"`);
    await textArea.fill(testMessage);
    await page.waitForTimeout(1000);
    
    // Find and click post button
    const postButton = await page.waitForSelector('[data-testid="tweetButtonInline"]', { timeout: 5000 });
    if (!postButton) {
      throw new Error('Post button not found');
    }
    
    const isEnabled = await postButton.isEnabled();
    if (!isEnabled) {
      throw new Error('Post button is disabled');
    }
    console.log('✅ Post button found and enabled');
    
    console.log('📤 Clicking post button...');
    await postButton.click();
    
    // Wait for posting to complete
    console.log('⏳ Waiting for post to complete...');
    await page.waitForTimeout(5000);
    
    // Check for success
    const currentUrl = page.url();
    console.log(`📍 Current URL: ${currentUrl}`);
    
    if (currentUrl.includes('/status/') || currentUrl.includes('/home')) {
      console.log('🎉 SUCCESS! Post appears to have been successful!');
      
      // Try to extract tweet ID
      const tweetIdMatch = currentUrl.match(/\/status\/(\d+)/);
      if (tweetIdMatch) {
        console.log(`🆔 Tweet ID: ${tweetIdMatch[1]}`);
        console.log(`🔗 Tweet URL: https://x.com/i/status/${tweetIdMatch[1]}`);
      }
    } else {
      console.log('⚠️ Unclear if post was successful - check manually');
    }
    
    // Keep browser open for manual verification
    console.log('');
    console.log('🔍 Browser window is open for manual verification');
    console.log('📝 Check if your test post appeared on your timeline');
    console.log('⏳ Press ENTER when done checking...');
    
    await new Promise(resolve => {
      process.stdin.once('data', () => resolve());
    });
    
  } catch (error) {
    console.error('❌ Posting failed:', error.message);
    
    // Take screenshot for debugging
    await page.screenshot({ path: './posting-error.png', fullPage: true });
    console.log('📸 Error screenshot saved: posting-error.png');
  } finally {
    await browser.close();
  }
  
  console.log('✅ Direct posting test complete');
}

testDirectPosting().catch(console.error);
