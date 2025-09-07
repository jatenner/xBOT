/**
 * 🔐 CREATE AUTHENTICATED SESSION
 * 
 * This script creates a proper Twitter session with authentication cookies
 * that will actually work for posting tweets.
 */

const { chromium } = require('playwright');
const fs = require('fs');

async function createAuthenticatedSession() {
  console.log('🔐 AUTHENTICATED_SESSION: Creating proper Twitter session...');
  console.log('');
  console.log('📋 CRITICAL INSTRUCTIONS:');
  console.log('   1. A browser will open to Twitter login');
  console.log('   2. ✅ ENTER YOUR USERNAME/EMAIL');
  console.log('   3. ✅ ENTER YOUR PASSWORD');
  console.log('   4. ✅ COMPLETE ANY 2FA/VERIFICATION');
  console.log('   5. ✅ WAIT until you see your HOME TIMELINE');
  console.log('   6. ✅ VERIFY you can see the compose tweet button');
  console.log('   7. ✅ ONLY THEN close the browser');
  console.log('');
  
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--no-sandbox']
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Go to Twitter login
    console.log('🌐 NAVIGATING: Opening Twitter login page...');
    await page.goto('https://x.com/i/flow/login', { waitUntil: 'networkidle' });
    
    console.log('⏳ WAITING: Please log in manually...');
    console.log('   👆 Complete login in the browser window');
    console.log('   🏠 Navigate to your home timeline');
    console.log('   ✅ Verify you can see the compose button');
    console.log('   ❌ Close browser when ready');
    
    // Wait for the browser to close
    await page.waitForEvent('close', { timeout: 10 * 60 * 1000 }); // 10 minute timeout
    
  } catch (error) {
    console.log('');
    console.log('✅ READY: Browser closed, extracting session...');
  }
  
  try {
    // Get all cookies
    const cookies = await context.cookies();
    
    // Filter for Twitter/X cookies only
    const twitterCookies = cookies.filter(cookie => 
      cookie.domain.includes('x.com') || cookie.domain.includes('twitter.com')
    );
    
    console.log(`📋 COOKIES: Found ${twitterCookies.length} Twitter cookies`);
    
    // Check for critical authentication cookies
    const authToken = twitterCookies.find(c => c.name === 'auth_token');
    const ct0 = twitterCookies.find(c => c.name === 'ct0');
    const twid = twitterCookies.find(c => c.name === 'twid');
    
    console.log('');
    console.log('🔍 AUTHENTICATION CHECK:');
    console.log(`   auth_token: ${authToken ? '✅ FOUND' : '❌ MISSING'}`);
    console.log(`   ct0: ${ct0 ? '✅ FOUND' : '❌ MISSING'}`);
    console.log(`   twid: ${twid ? '✅ FOUND' : '❌ MISSING'}`);
    
    if (!authToken || !ct0 || !twid) {
      console.log('');
      console.log('❌ ERROR: Missing critical authentication cookies!');
      console.log('   This means you did not complete the login process.');
      console.log('   Please run the script again and ensure you:');
      console.log('   1. Actually log in with username/password');
      console.log('   2. Wait until you see your home timeline');
      console.log('   3. Can see tweet compose button');
      await browser.close();
      return;
    }
    
    // Create session data
    const sessionData = {
      cookies: twitterCookies,
      timestamp: Date.now(),
      isValid: true,
      authTokenPresent: !!authToken,
      csrfTokenPresent: !!ct0,
      userIdPresent: !!twid
    };
    
    // Save to file
    const sessionPath = 'data/twitter_session.json';
    await fs.promises.mkdir('data', { recursive: true });
    await fs.promises.writeFile(sessionPath, JSON.stringify(sessionData, null, 2));
    
    console.log('');
    console.log('✅ SUCCESS: Authenticated session saved!');
    console.log(`📁 LOCATION: ${sessionPath}`);
    console.log(`📊 COOKIES: ${twitterCookies.length} total`);
    console.log(`🔐 AUTH_TOKEN: ${authToken.value.substring(0, 10)}...`);
    console.log(`🛡️ CSRF_TOKEN: ${ct0.value.substring(0, 10)}...`);
    console.log(`👤 USER_ID: ${twid.value}`);
    
    // Generate base64
    const base64Session = Buffer.from(JSON.stringify(sessionData)).toString('base64');
    await fs.promises.writeFile('session_b64.txt', base64Session);
    
    console.log('');
    console.log('📋 NEXT STEPS:');
    console.log('   1. Copy the base64 from session_b64.txt');
    console.log('   2. Update TWITTER_SESSION_B64 in Railway');
    console.log('   3. Restart your Railway service');
    console.log('');
    console.log('🔑 BASE64 (first 50 chars):');
    console.log(`   ${base64Session.substring(0, 50)}...`);
    
  } catch (error) {
    console.error('❌ EXTRACTION_ERROR:', error.message);
  } finally {
    await browser.close();
  }
}

// Run the script
createAuthenticatedSession().catch(console.error);
