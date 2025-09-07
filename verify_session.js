/**
 * 🔍 VERIFY SESSION
 * 
 * This script verifies if a session has the required authentication cookies
 */

const fs = require('fs');

function verifySession() {
  try {
    console.log('🔍 VERIFYING: Checking session authentication...');
    
    // Check if session file exists
    if (!fs.existsSync('data/twitter_session.json')) {
      console.log('❌ ERROR: No session file found at data/twitter_session.json');
      console.log('   Run: npm run auth:session');
      return false;
    }
    
    // Read and parse session
    const sessionData = JSON.parse(fs.readFileSync('data/twitter_session.json', 'utf8'));
    
    if (!sessionData.cookies || !Array.isArray(sessionData.cookies)) {
      console.log('❌ ERROR: Invalid session format - no cookies array');
      return false;
    }
    
    console.log(`📋 COOKIES: Found ${sessionData.cookies.length} total cookies`);
    
    // Check for critical authentication cookies
    const authToken = sessionData.cookies.find(c => c.name === 'auth_token');
    const ct0 = sessionData.cookies.find(c => c.name === 'ct0');
    const twid = sessionData.cookies.find(c => c.name === 'twid');
    
    console.log('');
    console.log('🔍 AUTHENTICATION CHECK:');
    console.log(`   auth_token: ${authToken ? '✅ FOUND' : '❌ MISSING'}`);
    console.log(`   ct0 (CSRF): ${ct0 ? '✅ FOUND' : '❌ MISSING'}`);
    console.log(`   twid (User ID): ${twid ? '✅ FOUND' : '❌ MISSING'}`);
    
    if (authToken) {
      console.log(`   🔐 Auth Token: ${authToken.value.substring(0, 10)}...`);
      const authExpiry = new Date(authToken.expirationDate * 1000);
      console.log(`   ⏰ Expires: ${authExpiry.toLocaleString()}`);
      
      if (authExpiry < new Date()) {
        console.log('   ⚠️ WARNING: Auth token is EXPIRED!');
      }
    }
    
    if (ct0) {
      console.log(`   🛡️ CSRF Token: ${ct0.value.substring(0, 10)}...`);
    }
    
    if (twid) {
      console.log(`   👤 User ID: ${twid.value}`);
    }
    
    // Check for other important cookies
    const otherImportant = [
      'kdt', 'personalization_id', '__cf_bm'
    ];
    
    console.log('');
    console.log('🔧 OTHER COOKIES:');
    otherImportant.forEach(cookieName => {
      const cookie = sessionData.cookies.find(c => c.name === cookieName);
      console.log(`   ${cookieName}: ${cookie ? '✅' : '❌'}`);
    });
    
    const isValid = !!(authToken && ct0 && twid);
    
    console.log('');
    if (isValid) {
      console.log('✅ SESSION VALID: All required authentication cookies present');
      
      // Generate base64 for Railway
      const base64Session = Buffer.from(JSON.stringify(sessionData)).toString('base64');
      fs.writeFileSync('session_b64.txt', base64Session);
      
      console.log('');
      console.log('📋 READY FOR RAILWAY:');
      console.log('   1. Session base64 saved to session_b64.txt');
      console.log('   2. Copy contents to Railway TWITTER_SESSION_B64');
      console.log('   3. Restart Railway service');
      console.log(`   4. Base64 length: ${base64Session.length} characters`);
      
    } else {
      console.log('❌ SESSION INVALID: Missing required authentication cookies');
      console.log('   Run: npm run auth:session (and actually log in!)');
    }
    
    return isValid;
    
  } catch (error) {
    console.error('❌ VERIFY_ERROR:', error.message);
    return false;
  }
}

// Run verification
const isValid = verifySession();
process.exit(isValid ? 0 : 1);
