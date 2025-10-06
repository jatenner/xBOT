// Quick session grab - minimal browser window time
const { chromium } = require('playwright');
const fs = require('fs');

async function quickSessionGrab() {
  console.log('🚀 Quick session grab starting...');
  console.log('📝 Browser window will open for ~30 seconds, then auto-close');
  
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  });
  
  const page = await context.newPage();
  
  console.log('🌐 Opening Twitter...');
  await page.goto('https://twitter.com/home');
  
  console.log('');
  console.log('⚡ QUICK LOGIN CHECK:');
  console.log('   - If you see your timeline → Press ENTER immediately');
  console.log('   - If you see login page → Log in quickly, then press ENTER');
  console.log('   - Browser will auto-close in 45 seconds');
  console.log('');
  
  // Auto-close timer
  const autoCloseTimer = setTimeout(async () => {
    console.log('⏰ Auto-closing browser...');
    await browser.close();
    process.exit(0);
  }, 45000);
  
  // Wait for user input or timeout
  await Promise.race([
    new Promise(resolve => {
      process.stdin.once('data', () => {
        clearTimeout(autoCloseTimer);
        resolve();
      });
    })
  ]);
  
  console.log('📋 Extracting session...');
  
  // Get complete storage state (includes httpOnly cookies!)
  const storageState = await context.storageState();
  
  // Check for auth token
  const authToken = storageState.cookies.find(c => c.name === 'auth_token');
  const csrfToken = storageState.cookies.find(c => c.name === 'ct0');
  
  if (!authToken) {
    console.log('❌ No auth_token found - login may have failed');
    await browser.close();
    return;
  }
  
  console.log('✅ Session extracted successfully!');
  console.log(`🔐 Auth token: ${authToken.value.substring(0, 10)}...`);
  console.log(`🛡️ CSRF token: ${csrfToken ? 'Present' : 'Missing'}`);
  
  // Save session
  fs.writeFileSync('./data/twitter_session.json', JSON.stringify(storageState, null, 2));
  console.log(`💾 Saved ${storageState.cookies.length} cookies to data/twitter_session.json`);
  
  // Also save base64
  const b64 = Buffer.from(JSON.stringify(storageState)).toString('base64');
  fs.writeFileSync('./session_b64.txt', b64);
  
  await browser.close();
  console.log('✅ Done! Session ready for headless use.');
}

quickSessionGrab().catch(console.error);
