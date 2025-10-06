const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function captureFullSession() {
  console.log('🚀 Advanced session capture starting...');
  console.log('📝 This will open a browser where you can log in manually');
  console.log('⚡ After logging in, press ENTER in this terminal to capture the full session');
  
  const browser = await chromium.launch({ 
    headless: false,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor'
    ]
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  
  const page = await context.newPage();
  
  console.log('🌐 Opening X (Twitter)...');
  await page.goto('https://x.com/home');
  
  console.log('');
  console.log('⚡ MANUAL LOGIN INSTRUCTIONS:');
  console.log('   1. Log into X (Twitter) in the browser window that just opened');
  console.log('   2. Make sure you can see your timeline (not login page)');
  console.log('   3. Press ENTER in this terminal when ready');
  console.log('');
  
  // Wait for user input
  await new Promise(resolve => {
    process.stdin.once('data', () => resolve());
  });
  
  console.log('📋 Capturing full session state...');
  
  // Get storage state (includes all cookies, localStorage, etc.)
  const storageState = await context.storageState();
  
  // Save to file
  const sessionPath = path.join(__dirname, 'data', 'twitter_session.json');
  fs.writeFileSync(sessionPath, JSON.stringify(storageState, null, 2));
  
  console.log(`✅ Session saved to: ${sessionPath}`);
  console.log(`📊 Captured ${storageState.cookies.length} cookies`);
  
  // Show important cookies
  const importantCookies = storageState.cookies.filter(c => 
    ['auth_token', 'ct0', 'twid', 'kdt'].includes(c.name)
  );
  
  console.log('🔑 Important auth cookies found:');
  importantCookies.forEach(cookie => {
    console.log(`   - ${cookie.name}: ${cookie.value.substring(0, 20)}...`);
  });
  
  if (importantCookies.length === 0) {
    console.log('⚠️  No critical auth cookies found - you may not be logged in');
  }
  
  await browser.close();
  console.log('✅ Session capture complete!');
}

captureFullSession().catch(console.error);
