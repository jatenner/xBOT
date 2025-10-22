#!/usr/bin/env node
/**
 * INTERACTIVE SESSION REFRESHER
 * This script will help you create a fresh Twitter session for Railway
 */

const readline = require('readline');
const fs = require('fs');
const { execSync } = require('child_process');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🔐 TWITTER SESSION REFRESHER');
console.log('═══════════════════════════════════════════════════════\n');
console.log('📋 STEP 1: Open Chrome/Brave and log into Twitter');
console.log('   → Go to https://x.com');
console.log('   → Make sure you\'re logged in\n');
console.log('📋 STEP 2: Open Developer Tools');
console.log('   → Press F12 or Cmd+Option+I');
console.log('   → Click "Application" tab');
console.log('   → On left sidebar: Cookies → https://x.com\n');
console.log('📋 STEP 3: Find these 2 cookies:');
console.log('   → auth_token');
console.log('   → ct0\n');
console.log('═══════════════════════════════════════════════════════\n');

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log('Ready? Let\'s collect your cookies!\n');
  
  const authToken = await ask('🍪 Paste your auth_token value: ');
  if (!authToken || authToken.length < 10) {
    console.error('❌ Invalid auth_token. It should be a long string.');
    process.exit(1);
  }
  
  const ct0 = await ask('🍪 Paste your ct0 value: ');
  if (!ct0 || ct0.length < 10) {
    console.error('❌ Invalid ct0. It should be a long string.');
    process.exit(1);
  }
  
  console.log('\n✅ Cookies received! Building session...\n');
  
  // Create session object in Playwright format
  const session = {
    cookies: [
      {
        name: 'auth_token',
        value: authToken,
        domain: '.x.com',
        path: '/',
        expires: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60), // 1 year
        httpOnly: true,
        secure: true,
        sameSite: 'None'
      },
      {
        name: 'ct0',
        value: ct0,
        domain: '.x.com',
        path: '/',
        expires: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60),
        httpOnly: false,
        secure: true,
        sameSite: 'Lax'
      }
    ],
    origins: []
  };
  
  // Save to file
  fs.writeFileSync('twitter_session.json', JSON.stringify(session, null, 2));
  console.log('✅ Saved to twitter_session.json');
  
  // Create base64
  const sessionB64 = Buffer.from(JSON.stringify(session)).toString('base64');
  fs.writeFileSync('session_b64.txt', sessionB64);
  console.log('✅ Created base64 string (session_b64.txt)');
  
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
    console.log('✅ SESSION REFRESH COMPLETE!');
    console.log('═══════════════════════════════════════════════════════');
    console.log('\n📊 Next steps:');
    console.log('   1. Wait 30 seconds for Railway to restart');
    console.log('   2. Run: npm run logs');
    console.log('   3. Look for: "[BROWSER_POOL] ✅ Session loaded"');
    console.log('   4. Look for: "[POSTING_QUEUE]" activity');
    console.log('\n🎯 Your system should start posting within 5 minutes!\n');
    
  } catch (error) {
    console.error('\n❌ Railway deployment failed:', error.message);
    console.log('\n📋 MANUAL STEPS:');
    console.log('   1. Copy the base64 string from session_b64.txt');
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


