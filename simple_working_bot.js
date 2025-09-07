/**
 * 🔄 SIMPLE WORKING BOT
 * 
 * This is a return to basics - simple, working Twitter posting
 * No complex systems, no keyboard shortcuts, just proper browser automation
 */

const { chromium } = require('playwright');
const fs = require('fs');

async function simpleWorkingBot() {
  console.log('🔄 SIMPLE_BOT: Starting basic working Twitter bot...');
  
  try {
    // Load session
    const sessionData = JSON.parse(fs.readFileSync('./data/twitter_session.json', 'utf8'));
    console.log(`📋 SESSION: Loaded ${sessionData.cookies.length} cookies`);
    
    // Launch ISOLATED browser (not your browser)
    const browser = await chromium.launch({ 
      headless: false,  // Show browser so you can see it's separate
      args: ['--no-sandbox', '--disable-web-security']
    });
    
    const context = await browser.newContext();
    await context.addCookies(sessionData.cookies);
    
    const page = await context.newPage();
    
    console.log('🌐 NAVIGATING: Going to Twitter compose page...');
    await page.goto('https://x.com/compose/tweet', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    await page.waitForTimeout(3000);
    
    // Check if we're logged in
    const isLoggedIn = await page.locator('[data-testid="tweetTextarea_0"]').isVisible({ timeout: 10000 }).catch(() => false);
    
    if (!isLoggedIn) {
      console.log('❌ NOT_LOGGED_IN: Session may be expired');
      await browser.close();
      return;
    }
    
    console.log('✅ LOGGED_IN: Found tweet composer');
    
    // Simple content
    const content = 'Testing simple bot - back to basics approach';
    console.log(`📝 CONTENT: "${content}"`);
    
    // Find and use the text area (proper way)
    const textArea = page.locator('[data-testid="tweetTextarea_0"]').first();
    await textArea.click();
    await textArea.fill(content);
    
    console.log('✅ TYPED: Content entered successfully');
    
    await page.waitForTimeout(2000);
    
    // Find post button
    const postButton = page.locator('[data-testid="tweetButtonInline"]');
    const isEnabled = await postButton.isEnabled();
    
    console.log(`🔘 POST_BUTTON: Enabled = ${isEnabled}`);
    
    if (isEnabled) {
      console.log('🚀 POSTING: Clicking post button...');
      await postButton.click();
      
      // Wait for success indicators
      await page.waitForTimeout(3000);
      
      // Check if we're back on timeline (success indicator)
      const currentUrl = page.url();
      if (currentUrl.includes('/home') || currentUrl.includes('/timeline')) {
        console.log('✅ SUCCESS: Post appears to have been successful!');
        console.log(`🌐 URL: ${currentUrl}`);
      } else {
        console.log('⚠️ UNCERTAIN: Post may or may not have succeeded');
        console.log(`🌐 URL: ${currentUrl}`);
      }
    } else {
      console.log('❌ CANNOT_POST: Post button is disabled');
    }
    
    // Keep browser open for 10 seconds so you can see what happened
    console.log('⏳ WAITING: Keeping browser open for 10 seconds...');
    await page.waitForTimeout(10000);
    
    await browser.close();
    console.log('✅ COMPLETE: Simple bot test finished');
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
  }
}

// Run the simple bot
simpleWorkingBot().catch(console.error);
