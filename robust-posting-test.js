#!/usr/bin/env node

/**
 * 🛡️ ROBUST POSTING TEST
 * Handles common X.com posting issues like disabled post button
 */

const { chromium } = require('playwright');
const fs = require('fs');

async function robustPostingTest() {
  console.log('🛡️ Starting Robust X.com Posting Test...');
  
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
    
    // Find text area with multiple attempts
    let textArea = null;
    const textAreaSelectors = [
      '[data-testid="tweetTextarea_0"]',
      '[role="textbox"][aria-label*="Post"]',
      '[role="textbox"][placeholder*="What is happening"]',
      '.public-DraftEditor-content'
    ];
    
    for (const selector of textAreaSelectors) {
      try {
        textArea = await page.waitForSelector(selector, { timeout: 5000 });
        if (textArea) {
          console.log(`✅ Text area found with selector: ${selector}`);
          break;
        }
      } catch (e) {
        console.log(`⚠️ Selector ${selector} not found, trying next...`);
      }
    }
    
    if (!textArea) {
      throw new Error('No text area found with any selector');
    }
    
    // Clear any existing text and type new message
    const testMessage = `🎉 X automation is working! Robust test at ${new Date().toLocaleTimeString()}`;
    console.log(`✍️ Typing message: "${testMessage}"`);
    
    // Clear field first
    await textArea.click();
    await page.keyboard.press('Meta+a'); // Select all
    await page.keyboard.press('Delete'); // Delete
    await page.waitForTimeout(500);
    
    // Type character by character to simulate human typing
    for (const char of testMessage) {
      await page.keyboard.type(char);
      await page.waitForTimeout(50 + Math.random() * 100); // Random delay
    }
    
    console.log('✅ Message typed successfully');
    
    // Wait for X to process the text
    await page.waitForTimeout(2000);
    
    // Find post button with multiple selectors
    const postButtonSelectors = [
      '[data-testid="tweetButtonInline"]',
      '[data-testid="tweetButton"]',
      '[role="button"][aria-label*="Post"]',
      'button:has-text("Post")',
      '[data-testid="toolBar"] [role="button"]:last-child'
    ];
    
    let postButton = null;
    for (const selector of postButtonSelectors) {
      try {
        postButton = await page.$(selector);
        if (postButton) {
          const isVisible = await postButton.isVisible();
          const isEnabled = await postButton.isEnabled();
          console.log(`🔍 Post button ${selector}: visible=${isVisible}, enabled=${isEnabled}`);
          
          if (isVisible && isEnabled) {
            console.log(`✅ Using post button: ${selector}`);
            break;
          } else {
            postButton = null; // Reset if not usable
          }
        }
      } catch (e) {
        console.log(`⚠️ Post button selector ${selector} failed: ${e.message}`);
      }
    }
    
    if (!postButton) {
      // Try waiting a bit longer for the button to become enabled
      console.log('⏳ Post button not ready, waiting for it to become enabled...');
      
      for (let i = 0; i < 10; i++) {
        await page.waitForTimeout(1000);
        
        for (const selector of postButtonSelectors) {
          try {
            const btn = await page.$(selector);
            if (btn) {
              const isEnabled = await btn.isEnabled();
              if (isEnabled) {
                postButton = btn;
                console.log(`✅ Post button became enabled: ${selector}`);
                break;
              }
            }
          } catch (e) {
            // Continue
          }
        }
        
        if (postButton) break;
        console.log(`⏳ Attempt ${i + 1}/10: Still waiting for post button...`);
      }
    }
    
    if (!postButton) {
      throw new Error('Post button never became enabled - check if message meets X requirements');
    }
    
    console.log('📤 Clicking post button...');
    await postButton.click();
    
    // Wait for posting to complete
    console.log('⏳ Waiting for post to complete...');
    await page.waitForTimeout(5000);
    
    // Check for success indicators
    const currentUrl = page.url();
    console.log(`📍 Current URL: ${currentUrl}`);
    
    // Look for success indicators
    const successIndicators = [
      () => currentUrl.includes('/status/'),
      () => currentUrl.includes('/home'),
      async () => {
        const successText = await page.$('text=Your post was sent');
        return !!successText;
      },
      async () => {
        // Check if compose dialog closed
        const composeDialog = await page.$('[data-testid="tweetTextarea_0"]');
        return !composeDialog;
      }
    ];
    
    let success = false;
    for (const indicator of successIndicators) {
      try {
        if (await indicator()) {
          success = true;
          break;
        }
      } catch (e) {
        // Continue checking
      }
    }
    
    if (success) {
      console.log('🎉 SUCCESS! Post appears to have been successful!');
      
      // Try to extract tweet ID
      const tweetIdMatch = currentUrl.match(/\/status\/(\d+)/);
      if (tweetIdMatch) {
        console.log(`🆔 Tweet ID: ${tweetIdMatch[1]}`);
        console.log(`🔗 Tweet URL: https://x.com/i/status/${tweetIdMatch[1]}`);
      }
    } else {
      console.log('⚠️ Could not confirm post success - check manually');
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
    await page.screenshot({ path: './robust-posting-error.png', fullPage: true });
    console.log('📸 Error screenshot saved: robust-posting-error.png');
  } finally {
    await browser.close();
  }
  
  console.log('✅ Robust posting test complete');
}

robustPostingTest().catch(console.error);
