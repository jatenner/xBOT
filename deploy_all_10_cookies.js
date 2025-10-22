#!/usr/bin/env node
/**
 * Deploy ALL 10 cookies manually
 */

const readline = require('readline');
const fs = require('fs');
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
  console.log('🍪 MANUAL 10-COOKIE SETUP\n');
  console.log('Go to Chrome: https://x.com → F12 → Application → Cookies → x.com\n');
  console.log('I\'ll ask for each cookie VALUE one by one:\n');
  
  const cookieConfigs = [
    { name: 'auth_token', httpOnly: true, critical: true },
    { name: 'ct0', httpOnly: false, critical: true },
    { name: 'guest_id_marketing', httpOnly: false },
    { name: 'guest_id_ads', httpOnly: false },
    { name: 'personalization_id', httpOnly: false },
    { name: 'guest_id', httpOnly: false },
    { name: 'twid', httpOnly: false },
    { name: '__cuid', httpOnly: false },
    { name: 'lang', httpOnly: false },
    { name: 'external_referer', httpOnly: false }
  ];
  
  const cookies = [];
  
  for (const config of cookieConfigs) {
    const critical = config.critical ? ' 🔥 CRITICAL' : '';
    const value = await ask(`🍪 ${config.name}${critical}: `);
    
    if (!value) {
      console.log(`   ⚠️ Skipped (empty)\n`);
      continue;
    }
    
    cookies.push({
      name: config.name,
      value: value,
      domain: '.x.com',
      path: '/',
      expires: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60),
      httpOnly: config.httpOnly,
      secure: true,
      sameSite: config.name === 'ct0' ? 'Lax' : 'None'
    });
    
    console.log(`   ✅ Added\n`);
  }
  
  console.log(`\n🎉 Collected ${cookies.length} cookies!\n`);
  
  const session = { cookies, origins: [] };
  fs.writeFileSync('twitter_session_final.json', JSON.stringify(session, null, 2));
  console.log('✅ Saved to twitter_session_final.json');
  
  const sessionB64 = Buffer.from(JSON.stringify(session)).toString('base64');
  fs.writeFileSync('session_final_b64.txt', sessionB64);
  console.log('✅ Created base64 string\n');
  
  console.log('📤 DEPLOYING TO RAILWAY...\n');
  
  try {
    execSync(`railway variables --set TWITTER_SESSION_B64="${sessionB64}"`, { 
      stdio: 'inherit',
      cwd: __dirname 
    });
    
    console.log('\n✅ Railway variable updated!');
    console.log('🔄 Restarting...\n');
    
    execSync('railway up --detach', { stdio: 'inherit', cwd: __dirname });
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log(`✅ DEPLOYED ${cookies.length} COOKIES!`);
    console.log('═══════════════════════════════════════════════════════\n');
    console.log('Wait 30s then run: npm run logs\n');
    
  } catch (error) {
    console.error('❌ Failed:', error.message);
  }
  
  rl.close();
}

main();


