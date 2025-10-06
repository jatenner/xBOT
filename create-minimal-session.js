// Minimal session creator - opens browser briefly for login, then goes headless
const { chromium } = require('playwright');
const fs = require('fs');

async function createSession() {
  console.log('🔐 Creating fresh Twitter session...');
  console.log('📝 This will open a browser window BRIEFLY for login, then close it.');
  console.log('');
  
  // Launch visible browser for login
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  });
  
  const page = await context.newPage();
  
  console.log('🌐 Opening Twitter login...');
  await page.goto('https://twitter.com/login');
  
  console.log('');
  console.log('⚡ QUICK LOGIN REQUIRED:');
  console.log('   1. Log in to Twitter in the browser window');
  console.log('   2. Wait until you see your HOME TIMELINE');
  console.log('   3. Press ENTER here when ready');
  console.log('');
  console.log('💡 The browser will close automatically after extracting cookies');
  console.log('');
  
  // Wait for user to complete login
  await new Promise(resolve => {
    process.stdin.once('data', () => resolve());
  });
  
  console.log('📋 Extracting session...');
  
  // Get storage state with all cookies
  const storageState = await context.storageState();
  
  // Check for required tokens
  const authToken = storageState.cookies.find(c => c.name === 'auth_token');
  const csrfToken = storageState.cookies.find(c => c.name === 'ct0');
  const userId = storageState.cookies.find(c => c.name === 'twid');
  
  if (!authToken) {
    console.log('❌ No auth_token found - login may have failed');
    await browser.close();
    return;
  }
  
  console.log('✅ Session extracted successfully!');
  console.log(`🔐 Auth token: ${authToken.value.substring(0, 10)}...`);
  console.log(`🛡️ CSRF token: ${csrfToken ? 'Present' : 'Missing'}`);
  console.log(`👤 User ID: ${userId ? 'Present' : 'Missing'}`);
  
  // Duplicate cookies for both domains
  const duplicatedCookies = [];
  storageState.cookies.forEach(cookie => {
    duplicatedCookies.push(cookie);
    
    if (cookie.domain.includes('x.com') || cookie.domain.includes('twitter.com')) {
      duplicatedCookies.push({ ...cookie, domain: '.twitter.com' });
      duplicatedCookies.push({ ...cookie, domain: '.x.com' });
    }
  });
  
  // Remove duplicates
  const uniqueCookies = duplicatedCookies.filter((cookie, index, self) => 
    index === self.findIndex(c => 
      c.name === cookie.name && 
      c.domain === cookie.domain && 
      c.path === cookie.path
    )
  );
  
  const finalSession = {
    cookies: uniqueCookies,
    origins: storageState.origins || []
  };
  
  // Save session
  fs.writeFileSync('./data/twitter_session.json', JSON.stringify(finalSession, null, 2));
  console.log(`💾 Saved ${uniqueCookies.length} cookies to data/twitter_session.json`);
  
  // Create base64 version
  const b64 = Buffer.from(JSON.stringify(finalSession)).toString('base64');
  fs.writeFileSync('./session_b64.txt', b64);
  console.log('💾 Saved base64 version to session_b64.txt');
  
  await browser.close();
  console.log('✅ Browser closed. Session ready for use!');
}

createSession().catch(console.error);
