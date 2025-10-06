#!/usr/bin/env node

/**
 * 🍪 MANUAL COOKIE EXTRACTOR V2
 * Alternative method: Extract cookies from your regular browser
 */

const fs = require('fs');
const path = require('path');

console.log('🍪 MANUAL COOKIE EXTRACTOR V2');
console.log('=============================');
console.log('');
console.log('This method extracts cookies from your regular browser where you\'re already logged in.');
console.log('');
console.log('📋 INSTRUCTIONS:');
console.log('');
console.log('1. Open your regular browser (Chrome, Safari, etc.)');
console.log('2. Go to https://x.com and make sure you\'re logged in');
console.log('3. Open Developer Tools (F12 or Cmd+Option+I)');
console.log('4. Go to the "Application" or "Storage" tab');
console.log('5. Click on "Cookies" → "https://x.com"');
console.log('6. Find these important cookies and copy their values:');
console.log('');
console.log('   🔑 REQUIRED COOKIES:');
console.log('   - auth_token');
console.log('   - ct0');
console.log('   - twid');
console.log('');
console.log('   📝 OPTIONAL BUT HELPFUL:');
console.log('   - kdt');
console.log('   - guest_id');
console.log('   - personalization_id');
console.log('');
console.log('7. Enter the cookie values below when prompted');
console.log('');

const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function extractManualCookies() {
  try {
    console.log('🔑 Enter your X.com cookie values:');
    console.log('(Press Enter to skip optional cookies)');
    console.log('');
    
    const authToken = await askQuestion('auth_token (REQUIRED): ');
    if (!authToken) {
      console.log('❌ auth_token is required! Cannot proceed without it.');
      process.exit(1);
    }
    
    const ct0 = await askQuestion('ct0 (REQUIRED): ');
    if (!ct0) {
      console.log('❌ ct0 is required! Cannot proceed without it.');
      process.exit(1);
    }
    
    const twid = await askQuestion('twid (REQUIRED): ');
    if (!twid) {
      console.log('❌ twid is required! Cannot proceed without it.');
      process.exit(1);
    }
    
    const kdt = await askQuestion('kdt (optional): ');
    const guestId = await askQuestion('guest_id (optional): ');
    const personalizationId = await askQuestion('personalization_id (optional): ');
    
    console.log('');
    console.log('🔨 Building session file...');
    
    // Create cookies for both domains
    const cookies = [];
    const timestamp = Date.now();
    const expiry = timestamp + (365 * 24 * 60 * 60 * 1000); // 1 year from now
    
    // Required cookies
    const requiredCookies = [
      { name: 'auth_token', value: authToken, httpOnly: true, secure: true, sameSite: 'None' },
      { name: 'ct0', value: ct0, httpOnly: false, secure: true, sameSite: 'Lax' },
      { name: 'twid', value: twid, httpOnly: false, secure: true, sameSite: 'None' }
    ];
    
    // Optional cookies
    const optionalCookies = [];
    if (kdt) optionalCookies.push({ name: 'kdt', value: kdt, httpOnly: true, secure: true, sameSite: 'None' });
    if (guestId) optionalCookies.push({ name: 'guest_id', value: guestId, httpOnly: false, secure: true, sameSite: 'None' });
    if (personalizationId) optionalCookies.push({ name: 'personalization_id', value: personalizationId, httpOnly: false, secure: true, sameSite: 'None' });
    
    // Add cookies for both domains
    [...requiredCookies, ...optionalCookies].forEach(cookieTemplate => {
      // Add for .x.com
      cookies.push({
        ...cookieTemplate,
        domain: '.x.com',
        path: '/',
        expires: expiry
      });
      
      // Add for .twitter.com
      cookies.push({
        ...cookieTemplate,
        domain: '.twitter.com',
        path: '/',
        expires: expiry
      });
    });
    
    // Add some common additional cookies
    const additionalCookies = [
      { name: 'lang', value: 'en', domain: '.x.com', path: '/', httpOnly: false, secure: false, sameSite: 'Lax' },
      { name: 'lang', value: 'en', domain: '.twitter.com', path: '/', httpOnly: false, secure: false, sameSite: 'Lax' }
    ];
    
    cookies.push(...additionalCookies);
    
    // Create storage state
    const storageState = {
      cookies: cookies,
      origins: [
        {
          origin: 'https://x.com',
          localStorage: []
        },
        {
          origin: 'https://twitter.com',
          localStorage: []
        }
      ]
    };
    
    // Save to file
    const sessionPath = path.join(__dirname, 'data', 'twitter_session.json');
    
    // Ensure data directory exists
    const dataDir = path.dirname(sessionPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    fs.writeFileSync(sessionPath, JSON.stringify(storageState, null, 2));
    
    console.log('✅ Session file created successfully!');
    console.log(`📁 Saved to: ${sessionPath}`);
    console.log(`📊 Created ${cookies.length} cookies`);
    console.log('');
    
    // Show summary
    console.log('🔑 Cookie Summary:');
    const cookiesByName = {};
    cookies.forEach(cookie => {
      if (!cookiesByName[cookie.name]) cookiesByName[cookie.name] = [];
      cookiesByName[cookie.name].push(cookie.domain);
    });
    
    Object.entries(cookiesByName).forEach(([name, domains]) => {
      console.log(`   ✅ ${name}: ${domains.join(', ')}`);
    });
    
    console.log('');
    console.log('🚀 NEXT STEPS:');
    console.log('   1. Test your session: node test-x-automation.js');
    console.log('   2. Test posting: BROWSER_SERVER_SECRET="test123" node local-browser-server.js');
    console.log('   3. Start your bot: npm run start');
    console.log('');
    console.log('🎉 Manual cookie extraction complete!');
    
  } catch (error) {
    console.error('❌ Error during cookie extraction:', error.message);
  } finally {
    rl.close();
  }
}

extractManualCookies();
