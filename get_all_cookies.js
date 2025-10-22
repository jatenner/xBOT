#!/usr/bin/env node
/**
 * COMPREHENSIVE COOKIE EXTRACTOR
 * Gets ALL Twitter cookies for full session authentication
 */

const readline = require('readline');
const fs = require('fs');
const { execSync } = require('child_process');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🍪 COMPREHENSIVE TWITTER COOKIE EXTRACTOR');
console.log('═══════════════════════════════════════════════════════\n');
console.log('📋 STEP 1: Open Chrome/Brave and log into Twitter');
console.log('   → Go to https://x.com');
console.log('   → Make sure you\'re logged in\n');
console.log('📋 STEP 2: Open Developer Tools');
console.log('   → Press F12 or Cmd+Option+I');
console.log('   → Click "Application" tab');
console.log('   → On left sidebar: Cookies → https://x.com\n');
console.log('📋 STEP 3: You should see 10-20 cookies');
console.log('   → We need ALL of them for analytics access!\n');
console.log('📋 STEP 4: For EACH cookie, copy its Name and Value');
console.log('   → Important ones: auth_token, ct0, guest_id, personalization_id, kdt, twid\n');
console.log('═══════════════════════════════════════════════════════\n');

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function main() {
  const cookies = [];
  
  console.log('I\'ll help you add cookies one by one.\n');
  console.log('💡 TIP: Press Enter with empty name when done.\n');
  
  while (true) {
    const name = await ask('🍪 Cookie name (or press Enter if done): ');
    if (!name) break;
    
    const value = await ask(`   Cookie value for "${name}": `);
    if (!value) {
      console.log('   ⚠️ Skipping (no value provided)\n');
      continue;
    }
    
    cookies.push({
      name: name,
      value: value,
      domain: '.x.com',
      path: '/',
      expires: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60), // 1 year
      httpOnly: name === 'auth_token' || name.includes('auth'), // Auth cookies are usually httpOnly
      secure: true,
      sameSite: name === 'ct0' ? 'Lax' : 'None'
    });
    
    console.log(`   ✅ Added "${name}"\n`);
  }
  
  if (cookies.length === 0) {
    console.error('❌ No cookies added. Please try again.');
    process.exit(1);
  }
  
  console.log(`\n✅ Collected ${cookies.length} cookies!\n`);
  console.log('Cookie summary:');
  cookies.forEach(c => console.log(`  - ${c.name}`));
  
  // Create session object
  const session = {
    cookies: cookies,
    origins: []
  };
  
  // Save to file
  fs.writeFileSync('twitter_session_full.json', JSON.stringify(session, null, 2));
  console.log('\n✅ Saved to twitter_session_full.json');
  
  // Create base64
  const sessionB64 = Buffer.from(JSON.stringify(session)).toString('base64');
  fs.writeFileSync('session_full_b64.txt', sessionB64);
  console.log('✅ Created base64 string (session_full_b64.txt)');
  
  console.log('\n📤 DEPLOYING TO RAILWAY...\n');
  
  try {
    // Update Railway environment variable
    console.log('🚀 Setting TWITTER_SESSION_B64 on Railway...');
    execSync(`railway variables --set TWITTER_SESSION_B64="${sessionB64}"`, { 
      stdio: 'inherit',
      cwd: __dirname 
    });
    
    console.log('\n✅ Railway variable updated!');
    console.log('🔄 Restarting Railway service...\n');
    
    // Restart Railway
    execSync('railway up --detach', { stdio: 'inherit', cwd: __dirname });
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('✅ FULL SESSION DEPLOYED!');
    console.log('═══════════════════════════════════════════════════════');
    console.log('\n📊 Next steps:');
    console.log('   1. Wait 30 seconds for Railway to restart');
    console.log('   2. Run: npm run logs');
    console.log('   3. Look for: "[BROWSER_POOL] ✅ Session loaded (X cookies)"');
    console.log(`   4. Should see: ${cookies.length} cookies loaded`);
    console.log('   5. Check if analytics scraping works now!\n');
    
  } catch (error) {
    console.error('\n❌ Railway deployment failed:', error.message);
    console.log('\n📋 MANUAL STEPS:');
    console.log('   1. Copy the base64 string from session_full_b64.txt');
    console.log('   2. Run: railway variables --set TWITTER_SESSION_B64="<paste here>"');
    console.log('   3. Run: railway up --detach');
  }
  
  rl.close();
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  rl.close();
  process.exit(1);
});

