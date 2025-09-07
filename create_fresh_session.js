/**
 * 🔄 CREATE FRESH SESSION
 * 
 * This will open a browser for you to manually log into Twitter
 * and save a fresh session that actually works
 */

const { chromium } = require('playwright');
const fs = require('fs');

async function createFreshSession() {
  console.log('🔄 FRESH_SESSION: Creating new Twitter session...');
  console.log('📋 INSTRUCTIONS: A browser will open - please log into Twitter manually');
  
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--no-sandbox']
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Go to Twitter login
    console.log('🌐 OPENING: Twitter login page...');
    await page.goto('https://x.com/login', { waitUntil: 'domcontentloaded' });
    
    console.log('');
    console.log('🔑 MANUAL LOGIN REQUIRED:');
    console.log('1. Log into Twitter in the browser that just opened');
    console.log('2. Make sure you can see your Twitter home timeline');
    console.log('3. Come back here and press ENTER when done');
    console.log('');
    
    // Wait for user input
    await new Promise(resolve => {
      process.stdin.resume();
      process.stdin.once('data', () => {
        process.stdin.pause();
        resolve();
      });
    });
    
    // Check if logged in
    console.log('🔍 CHECKING: Verifying login status...');
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    
    const isLoggedIn = await page.locator('[data-testid="SideNav_NewTweet_Button"]').isVisible({ timeout: 5000 }).catch(() => false);
    
    if (!isLoggedIn) {
      console.log('❌ LOGIN_FAILED: Could not verify login. Please try again.');
      await browser.close();
      return;
    }
    
    console.log('✅ LOGIN_SUCCESS: Verified Twitter login');
    
    // Save cookies
    console.log('💾 SAVING: Extracting and saving session cookies...');
    const cookies = await context.cookies();
    
    // Filter for Twitter/X cookies only
    const twitterCookies = cookies.filter(cookie => 
      cookie.domain.includes('x.com') || cookie.domain.includes('twitter.com')
    );
    
    console.log(`📋 COOKIES: Found ${twitterCookies.length} Twitter cookies`);
    
    // Check for essential cookies
    const hasAuthToken = twitterCookies.some(c => c.name === 'auth_token');
    const hasCt0 = twitterCookies.some(c => c.name === 'ct0');
    
    if (!hasAuthToken || !hasCt0) {
      console.log('❌ MISSING_COOKIES: Essential authentication cookies not found');
      console.log(`   auth_token: ${hasAuthToken ? '✅' : '❌'}`);
      console.log(`   ct0: ${hasCt0 ? '✅' : '❌'}`);
      await browser.close();
      return;
    }
    
    // Save session
    const sessionData = { cookies: twitterCookies };
    fs.writeFileSync('./data/twitter_session.json', JSON.stringify(sessionData, null, 2));
    
    console.log('✅ SESSION_SAVED: Fresh Twitter session saved to data/twitter_session.json');
    console.log(`📊 SUMMARY: ${twitterCookies.length} cookies saved with authentication tokens`);
    
    await browser.close();
    
    console.log('');
    console.log('🎉 SUCCESS: Fresh session created!');
    console.log('🚀 NEXT: You can now test the simple bot again');
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    await browser.close();
  }
}

createFreshSession().catch(console.error);
