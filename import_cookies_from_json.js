#!/usr/bin/env node
/**
 * Import cookies from browser console export
 * Use this if you extracted cookies using the console method
 */

const fs = require('fs');
const { execSync } = require('child_process');

console.log('🍪 IMPORTING COOKIES FROM JSON\n');

// Check if file exists
if (!fs.existsSync('cookies_export.json')) {
  console.error('❌ cookies_export.json not found!');
  console.log('\n📋 To create this file:');
  console.log('   1. Open Twitter in Chrome');
  console.log('   2. Open DevTools Console (F12)');
  console.log('   3. Run this code:\n');
  console.log('   copy(JSON.stringify(document.cookie.split("; ").map(c => {');
  console.log('     const [name, ...v] = c.split("=");');
  console.log('     return { name, value: v.join("=") };');
  console.log('   })))\n');
  console.log('   4. Paste into a file called cookies_export.json');
  console.log('   5. Run this script again\n');
  process.exit(1);
}

try {
  // Read exported cookies
  const rawCookies = JSON.parse(fs.readFileSync('cookies_export.json', 'utf8'));
  
  console.log(`📦 Found ${rawCookies.length} cookies in export\n`);
  
  // Convert to Playwright format
  const cookies = rawCookies.map(c => ({
    name: c.name,
    value: c.value,
    domain: '.x.com',
    path: '/',
    expires: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60),
    httpOnly: c.name === 'auth_token' || c.name.includes('auth'),
    secure: true,
    sameSite: c.name === 'ct0' ? 'Lax' : 'None'
  }));
  
  console.log('Cookie names:');
  cookies.forEach(c => console.log(`  ✓ ${c.name}`));
  
  // Create session
  const session = {
    cookies: cookies,
    origins: []
  };
  
  // Save
  fs.writeFileSync('twitter_session_full.json', JSON.stringify(session, null, 2));
  console.log('\n✅ Saved to twitter_session_full.json');
  
  const sessionB64 = Buffer.from(JSON.stringify(session)).toString('base64');
  fs.writeFileSync('session_full_b64.txt', sessionB64);
  console.log('✅ Created base64 string (session_full_b64.txt)');
  
  console.log('\n📤 DEPLOYING TO RAILWAY...\n');
  
  // Deploy
  console.log('🚀 Setting TWITTER_SESSION_B64 on Railway...');
  execSync(`railway variables --set TWITTER_SESSION_B64="${sessionB64}"`, { 
    stdio: 'inherit',
    cwd: __dirname 
  });
  
  console.log('\n✅ Railway variable updated!');
  console.log('🔄 Restarting Railway service...\n');
  
  execSync('railway up --detach', { stdio: 'inherit', cwd: __dirname });
  
  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`✅ DEPLOYED ${cookies.length} COOKIES TO RAILWAY!`);
  console.log('═══════════════════════════════════════════════════════');
  console.log('\n📊 Next: Wait 30s then run: npm run logs\n');
  
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error('\nMake sure cookies_export.json is valid JSON!');
  process.exit(1);
}


