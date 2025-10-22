#!/usr/bin/env node
/**
 * Convert tab-separated cookie data from DevTools to Playwright session
 * Works with data copied directly from Chrome DevTools Application → Cookies
 */

const fs = require('fs');
const { execSync } = require('child_process');

console.log('🍪 DEVTOOLS COOKIE CONVERTER\n');

// Check if raw cookie file exists
if (!fs.existsSync('cookies_raw.txt')) {
  console.error('❌ cookies_raw.txt not found!\n');
  console.log('📋 How to create this file:');
  console.log('   1. Open Twitter (x.com) in Chrome/Brave');
  console.log('   2. Open DevTools (F12) → Application tab');
  console.log('   3. Click: Cookies → https://x.com');
  console.log('   4. Select ALL cookies (Shift+Click)');
  console.log('   5. Right-click → Copy');
  console.log('   6. Paste into a file called: cookies_raw.txt');
  console.log('   7. Run this script again\n');
  process.exit(1);
}

try {
  const rawData = fs.readFileSync('cookies_raw.txt', 'utf8');
  const lines = rawData.trim().split('\n');
  
  console.log(`📦 Found ${lines.length} lines of cookie data\n`);
  
  const cookies = [];
  let hasAuthToken = false;
  let hasCt0 = false;
  
  for (const line of lines) {
    // DevTools format is tab-separated: Name, Value, Domain, Path, Expires, Size, HttpOnly, Secure, SameSite, Partition Key, Priority
    const parts = line.split('\t');
    
    if (parts.length < 2) continue; // Skip invalid lines
    
    const name = parts[0].trim();
    const value = parts[1].trim();
    const domain = parts[2]?.trim() || '.x.com';
    const path = parts[3]?.trim() || '/';
    const expires = parts[4]?.trim();
    const httpOnly = parts[6]?.trim().toLowerCase() === 'true' || parts[6]?.trim() === '✓';
    const secure = parts[7]?.trim().toLowerCase() === 'true' || parts[7]?.trim() === '✓';
    const sameSite = parts[8]?.trim() || 'None';
    
    if (!name || !value) continue;
    
    // Track critical cookies
    if (name === 'auth_token') hasAuthToken = true;
    if (name === 'ct0') hasCt0 = true;
    
    // Calculate expiry (1 year from now if not specified)
    let expiresTimestamp;
    if (expires && expires !== 'Session') {
      expiresTimestamp = Math.floor(new Date(expires).getTime() / 1000);
    } else {
      expiresTimestamp = Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60);
    }
    
    cookies.push({
      name,
      value,
      domain: domain.startsWith('.') ? domain : `.${domain}`,
      path,
      expires: expiresTimestamp,
      httpOnly,
      secure,
      sameSite: sameSite === 'Lax' ? 'Lax' : sameSite === 'Strict' ? 'Strict' : 'None'
    });
  }
  
  console.log(`✅ Parsed ${cookies.length} cookies\n`);
  
  // Verify critical cookies
  console.log('🔍 Cookie validation:');
  console.log(`   ${hasAuthToken ? '✅' : '❌'} auth_token (CRITICAL)`);
  console.log(`   ${hasCt0 ? '✅' : '❌'} ct0 (CRITICAL)`);
  
  if (!hasAuthToken) {
    console.error('\n❌ MISSING auth_token! This is REQUIRED for authentication.');
    console.error('   Make sure you:');
    console.error('   1. Are logged into Twitter');
    console.error('   2. Copied ALL cookies from DevTools');
    console.error('   3. The auth_token cookie exists\n');
    process.exit(1);
  }
  
  if (!hasCt0) {
    console.warn('\n⚠️  WARNING: Missing ct0 token. This may cause issues.\n');
  }
  
  console.log('\n📋 All cookies:');
  cookies.forEach(c => {
    const flags = [];
    if (c.httpOnly) flags.push('HttpOnly');
    if (c.secure) flags.push('Secure');
    console.log(`   ${c.name} ${flags.length ? '(' + flags.join(', ') + ')' : ''}`);
  });
  
  // Create session object
  const session = {
    cookies: cookies,
    origins: []
  };
  
  // Save files
  fs.writeFileSync('twitter_session_complete.json', JSON.stringify(session, null, 2));
  console.log('\n✅ Saved to twitter_session_complete.json');
  
  const sessionB64 = Buffer.from(JSON.stringify(session)).toString('base64');
  fs.writeFileSync('session_complete_b64.txt', sessionB64);
  console.log('✅ Created base64 string (session_complete_b64.txt)');
  
  console.log('\n📤 DEPLOYING TO RAILWAY...\n');
  
  try {
    // Deploy to Railway
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
    console.log('\n📊 Next steps:');
    console.log('   1. Wait 30 seconds for Railway to restart');
    console.log('   2. Run: npm run logs');
    console.log('   3. Look for: "✅ Session loaded"');
    console.log('   4. Look for: "[POSTING_QUEUE]" activity');
    console.log('\n🎯 System should start posting within 5-15 minutes!\n');
    
  } catch (error) {
    console.error('\n❌ Railway deployment failed:', error.message);
    console.log('\n📋 MANUAL STEPS:');
    console.log('   1. Copy the base64 string from session_complete_b64.txt');
    console.log('   2. Run: railway variables --set TWITTER_SESSION_B64="<paste here>"');
    console.log('   3. Run: railway up --detach');
  }
  
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error('\nMake sure cookies_raw.txt contains valid tab-separated cookie data!');
  process.exit(1);
}

