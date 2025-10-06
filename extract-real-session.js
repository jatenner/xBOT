// Extract real Twitter session using Playwright
// This gets ALL cookies including httpOnly ones that JavaScript can't access

const { chromium } = require('playwright');
const fs = require('fs');

async function extractRealSession() {
  console.log('🔍 Extracting REAL Twitter session with Playwright...');
  
  // Launch browser in non-headless mode so you can log in
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  });
  
  const page = await context.newPage();
  
  console.log('🌐 Opening Twitter...');
  await page.goto('https://twitter.com/login');
  
  console.log('');
  console.log('🔐 PLEASE LOG IN TO TWITTER IN THE BROWSER WINDOW');
  console.log('   1. Enter your username/email');
  console.log('   2. Enter your password'); 
  console.log('   3. Complete any 2FA');
  console.log('   4. Wait until you see your HOME TIMELINE');
  console.log('   5. Press ENTER in this terminal when ready');
  console.log('');
  
  // Wait for user input
  await new Promise(resolve => {
    process.stdin.once('data', () => resolve());
  });
  
  console.log('📋 Extracting session state...');
  
  // Get complete storage state (includes httpOnly cookies!)
  const storageState = await context.storageState();
  
  console.log(`✅ Extracted ${storageState.cookies.length} cookies (including httpOnly)`);
  
  // Check for auth_token
  const authToken = storageState.cookies.find(c => c.name === 'auth_token');
  if (authToken) {
    console.log('🎉 Found auth_token cookie - session is valid!');
  } else {
    console.log('⚠️ No auth_token found - you may not be logged in');
  }
  
  // Save to session file
  const sessionPath = './data/twitter_session.json';
  await fs.promises.writeFile(sessionPath, JSON.stringify(storageState, null, 2));
  console.log(`💾 Saved session to ${sessionPath}`);
  
  // Also create base64 for environment variable
  const b64 = Buffer.from(JSON.stringify(storageState)).toString('base64');
  console.log('');
  console.log('🔐 Base64 for TWITTER_SESSION_B64 environment variable:');
  console.log(b64);
  
  await browser.close();
  console.log('✅ Done! Session extracted successfully.');
}

extractRealSession().catch(console.error);
