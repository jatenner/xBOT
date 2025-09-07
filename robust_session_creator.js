/**
 * 🔄 ROBUST SESSION CREATOR
 * 
 * This will stay open and wait properly for you to log in
 */

const { chromium } = require('playwright');
const fs = require('fs');

async function createRobustSession() {
  console.log('🔄 ROBUST_SESSION: Creating new Twitter session...');
  
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-web-security']
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Go to Twitter login
    console.log('🌐 OPENING: Twitter login page...');
    await page.goto('https://x.com/login', { waitUntil: 'domcontentloaded' });
    
    console.log('');
    console.log('🔑 PLEASE LOG IN:');
    console.log('1. Log into Twitter in the browser that opened');
    console.log('2. Navigate to your home timeline');
    console.log('3. Press ENTER here when you can see your Twitter home feed');
    console.log('');
    console.log('⏳ Waiting for you to log in...');
    
    // Wait for user to press enter
    process.stdin.setRawMode(true);
    process.stdin.resume();
    
    await new Promise((resolve) => {
      process.stdin.on('data', (key) => {
        if (key[0] === 13) { // Enter key
          process.stdin.setRawMode(false);
          process.stdin.pause();
          resolve();
        }
      });
    });
    
    console.log('🔍 CHECKING: Verifying you are logged in...');
    
    // Navigate to home to check login
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    
    // Check for login indicators
    const loginChecks = [
      page.locator('[data-testid="SideNav_NewTweet_Button"]').isVisible({ timeout: 5000 }).catch(() => false),
      page.locator('[data-testid="primaryColumn"]').isVisible({ timeout: 5000 }).catch(() => false),
      page.locator('[aria-label="Home timeline"]').isVisible({ timeout: 5000 }).catch(() => false)
    ];
    
    const results = await Promise.all(loginChecks);
    const isLoggedIn = results.some(result => result === true);
    
    if (!isLoggedIn) {
      console.log('❌ LOGIN_FAILED: Could not verify login.');
      console.log('   Make sure you are logged in and can see your Twitter home timeline');
      console.log('   Then run this script again');
      await browser.close();
      return;
    }
    
    console.log('✅ LOGIN_SUCCESS: Verified you are logged into Twitter');
    
    // Get all cookies
    console.log('💾 SAVING: Getting session cookies...');
    const allCookies = await context.cookies();
    
    // Filter for Twitter cookies
    const twitterCookies = allCookies.filter(cookie => 
      cookie.domain.includes('x.com') || cookie.domain.includes('twitter.com')
    );
    
    console.log(`📋 COOKIES: Found ${twitterCookies.length} Twitter cookies`);
    
    // Check for essential authentication cookies
    const authToken = twitterCookies.find(c => c.name === 'auth_token');
    const ct0Token = twitterCookies.find(c => c.name === 'ct0');
    
    if (!authToken || !ct0Token) {
      console.log('❌ MISSING_AUTH: Essential authentication cookies not found');
      console.log(`   auth_token: ${authToken ? '✅ Found' : '❌ Missing'}`);
      console.log(`   ct0: ${ct0Token ? '✅ Found' : '❌ Missing'}`);
      console.log('   Please make sure you are fully logged into Twitter');
      await browser.close();
      return;
    }
    
    console.log('✅ AUTH_COOKIES: Found essential authentication cookies');
    console.log(`   auth_token: ${authToken.value.substring(0, 20)}...`);
    console.log(`   ct0: ${ct0Token.value.substring(0, 20)}...`);
    
    // Save session
    const sessionData = { cookies: twitterCookies };
    
    // Ensure data directory exists
    if (!fs.existsSync('./data')) {
      fs.mkdirSync('./data');
    }
    
    fs.writeFileSync('./data/twitter_session.json', JSON.stringify(sessionData, null, 2));
    
    console.log('✅ SESSION_SAVED: Twitter session saved successfully');
    console.log(`📊 SUMMARY: ${twitterCookies.length} cookies saved to data/twitter_session.json`);
    
    await browser.close();
    
    console.log('');
    console.log('🎉 SUCCESS: Fresh Twitter session created!');
    console.log('🚀 READY: Your bot can now post to Twitter');
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    try {
      await browser.close();
    } catch (e) {}
  }
}

createRobustSession().catch(console.error);
