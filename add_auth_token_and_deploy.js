#!/usr/bin/env node
/**
 * Add auth_token to existing cookies and deploy
 */

const fs = require('fs');
const readline = require('readline');
const { execSync } = require('child_process');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log('🍪 ADDING AUTH_TOKEN TO YOUR SESSION\n');
  
  // Read existing cookies
  let cookies = [];
  if (fs.existsSync('cookies_export.json')) {
    try {
      cookies = JSON.parse(fs.readFileSync('cookies_export.json', 'utf8'));
      console.log(`✅ Found ${cookies.length} existing cookies\n`);
    } catch (err) {
      console.log('⚠️  Could not read existing cookies, starting fresh\n');
    }
  }
  
  console.log('📋 STEP 1: Get auth_token from Chrome DevTools');
  console.log('   1. Open Chrome/Brave → https://x.com');
  console.log('   2. Press F12 (DevTools)');
  console.log('   3. Click "Application" tab');
  console.log('   4. Left sidebar: Cookies → https://x.com');
  console.log('   5. Find "auth_token" in the list');
  console.log('   6. Copy its VALUE\n');
  
  const authToken = await ask('🔐 Paste your auth_token value here: ');
  
  if (!authToken || authToken.length < 10) {
    console.error('❌ Invalid auth_token!');
    rl.close();
    process.exit(1);
  }
  
  // Remove old auth_token if exists
  cookies = cookies.filter(c => c.name !== 'auth_token');
  
  // Add auth_token
  cookies.unshift({
    name: 'auth_token',
    value: authToken,
    domain: '.x.com',
    path: '/',
    expires: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60),
    httpOnly: true,
    secure: true,
    sameSite: 'None'
  });
  
  console.log(`\n✅ Now have ${cookies.length} cookies (including auth_token)!\n`);
  
  // Save
  const session = { cookies, origins: [] };
  fs.writeFileSync('twitter_session_complete.json', JSON.stringify(session, null, 2));
  console.log('✅ Saved to twitter_session_complete.json');
  
  const sessionB64 = Buffer.from(JSON.stringify(session)).toString('base64');
  fs.writeFileSync('session_complete_b64.txt', sessionB64);
  console.log('✅ Created base64 string\n');
  
  console.log('📤 DEPLOYING TO RAILWAY...\n');
  
  try {
    execSync(`railway variables --set TWITTER_SESSION_B64="${sessionB64}"`, { 
      stdio: 'inherit',
      cwd: __dirname 
    });
    
    console.log('\n✅ Railway variable updated!');
    console.log('🔄 Restarting Railway service...\n');
    
    execSync('railway up --detach', { stdio: 'inherit', cwd: __dirname });
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log(`✅ DEPLOYED ${cookies.length} COOKIES (WITH AUTH_TOKEN)!`);
    console.log('═══════════════════════════════════════════════════════');
    console.log('\n📊 Wait 30s then: npm run logs\n');
    console.log('Look for:');
    console.log(`  [BROWSER_POOL] ✅ Session loaded (${cookies.length} cookies)`);
    console.log('  [REAL_DISCOVERY] ✅ Authenticated session confirmed\n');
    
  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
  }
  
  rl.close();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

