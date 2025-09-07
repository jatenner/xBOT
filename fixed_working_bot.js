/**
 * 🔧 FIXED WORKING BOT
 * 
 * This uses the fresh session and proper login detection
 */

const { chromium } = require('playwright');
const fs = require('fs');

async function fixedWorkingBot() {
  console.log('🔧 FIXED_BOT: Starting with improved login detection...');
  
  try {
    // Load fresh session
    const sessionData = JSON.parse(fs.readFileSync('./data/twitter_session.json', 'utf8'));
    console.log(`📋 SESSION: Loaded ${sessionData.cookies.length} cookies`);
    
    // Launch isolated browser
    const browser = await chromium.launch({ 
      headless: false,
      args: ['--no-sandbox', '--disable-web-security']
    });
    
    const context = await browser.newContext();
    await context.addCookies(sessionData.cookies);
    
    const page = await context.newPage();
    
    console.log('🌐 NAVIGATING: Going to Twitter home first...');
    await page.goto('https://x.com/home', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    await page.waitForTimeout(3000);
    
    // Better login detection
    console.log('🔍 CHECKING: Multiple login indicators...');
    
    const loginChecks = await Promise.allSettled([
      page.locator('[data-testid="SideNav_NewTweet_Button"]').isVisible({ timeout: 5000 }),
      page.locator('[data-testid="primaryColumn"]').isVisible({ timeout: 5000 }),
      page.locator('[aria-label="Home timeline"]').isVisible({ timeout: 5000 }),
      page.locator('[data-testid="tweet"]').isVisible({ timeout: 5000 })
    ]);
    
    const loginResults = loginChecks.map((result, index) => {
      const indicators = ['NewTweet_Button', 'primaryColumn', 'Home timeline', 'tweet'];
      const isVisible = result.status === 'fulfilled' && result.value === true;
      console.log(`   ${indicators[index]}: ${isVisible ? '✅' : '❌'}`);
      return isVisible;
    });
    
    const isLoggedIn = loginResults.some(result => result === true);
    
    if (!isLoggedIn) {
      console.log('❌ NOT_LOGGED_IN: Could not detect login with any indicator');
      console.log('🔍 DEBUGGING: Current page info...');
      console.log(`   URL: ${page.url()}`);
      console.log(`   Title: ${await page.title()}`);
      
      // Try to see what's actually on the page
      const bodyText = await page.locator('body').textContent();
      if (bodyText.includes('Sign in') || bodyText.includes('Log in')) {
        console.log('   Status: Login page detected');
      } else if (bodyText.includes('Home') || bodyText.includes('Timeline')) {
        console.log('   Status: Looks like home page but selectors not found');
      }
      
      await browser.close();
      return;
    }
    
    console.log('✅ LOGGED_IN: Successfully detected login');
    
    // Now try to post
    console.log('📝 POSTING: Opening compose...');
    
    // Try keyboard shortcut first (but properly isolated)
    await page.keyboard.press('n');
    await page.waitForTimeout(2000);
    
    // Look for composer
    let composer = await page.locator('[data-testid="tweetTextarea_0"]').first().isVisible({ timeout: 3000 }).catch(() => false);
    
    if (!composer) {
      console.log('🔄 FALLBACK: Trying compose page directly...');
      await page.goto('https://x.com/compose/tweet', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      composer = await page.locator('[data-testid="tweetTextarea_0"]').first().isVisible({ timeout: 5000 }).catch(() => false);
    }
    
    if (!composer) {
      console.log('❌ NO_COMPOSER: Could not find tweet composer');
      await browser.close();
      return;
    }
    
    console.log('✅ COMPOSER_FOUND: Tweet composer is ready');
    
    // Post content
    const content = 'Testing fixed bot - proper browser automation working!';
    console.log(`📝 CONTENT: "${content}"`);
    
    const textArea = page.locator('[data-testid="tweetTextarea_0"]').first();
    await textArea.click();
    await textArea.fill(content);
    
    console.log('✅ TYPED: Content entered');
    
    await page.waitForTimeout(1000);
    
    // Check post button
    const postButton = page.locator('[data-testid="tweetButtonInline"]');
    const isEnabled = await postButton.isEnabled();
    
    console.log(`🔘 POST_BUTTON: Enabled = ${isEnabled}`);
    
    if (isEnabled) {
      console.log('🚀 POSTING: Clicking post button...');
      await postButton.click();
      
      // Wait and check for success
      await page.waitForTimeout(3000);
      
      const currentUrl = page.url();
      console.log(`🌐 RESULT_URL: ${currentUrl}`);
      
      if (currentUrl.includes('/home') && !currentUrl.includes('/compose')) {
        console.log('✅ SUCCESS: Post appears successful - returned to home timeline!');
        console.log('🎉 WORKING: Your bot is now posting successfully!');
      } else {
        console.log('⚠️ UNCERTAIN: May or may not have posted');
      }
    } else {
      console.log('❌ DISABLED: Post button is disabled');
      
      // Debug why
      const text = await textArea.textContent();
      console.log(`   Text length: ${text?.length || 0} characters`);
      console.log(`   Text content: "${text?.substring(0, 50)}..."`);
    }
    
    // Keep browser open so you can see the result
    console.log('⏳ KEEPING_OPEN: Browser will stay open for 15 seconds...');
    await page.waitForTimeout(15000);
    
    await browser.close();
    console.log('✅ COMPLETE: Test finished');
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
  }
}

fixedWorkingBot().catch(console.error);
