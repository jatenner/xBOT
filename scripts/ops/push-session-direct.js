#!/usr/bin/env node
/**
 * Direct push script - bypasses shell issues
 */

const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const SESSION_PATH = path.join(__dirname, '../../twitter_session.json');
const RAILWAY_SERVICE = 'serene-cat';

console.log('🚀 Pushing Session to Railway');
console.log('═══════════════════════════════════════════════════════════\n');

// Read session
if (!fs.existsSync(SESSION_PATH)) {
  console.error(`❌ Session file not found: ${SESSION_PATH}`);
  process.exit(1);
}

const sessionData = fs.readFileSync(SESSION_PATH, 'utf8');
console.log(`📁 Session file: ${SESSION_PATH} (${sessionData.length} bytes)`);

// Check cookies
const session = JSON.parse(sessionData);
const cookies = session.cookies || [];
const authToken = cookies.find(c => c.name === 'auth_token');
const ct0 = cookies.find(c => c.name === 'ct0');

console.log(`\n🍪 Cookie Check:`);
console.log(`   auth_token: ${authToken ? '✅ YES' : '❌ NO'}`);
console.log(`   ct0: ${ct0 ? '✅ YES' : '❌ NO'}\n`);

if (!authToken || !ct0) {
  console.error('❌ Missing required auth cookies!');
  process.exit(1);
}

// Base64 encode
const sessionB64 = Buffer.from(sessionData).toString('base64');
console.log(`📦 Encoded to base64: ${sessionB64.length} chars\n`);

// Push to Railway
console.log(`🚀 Updating Railway service: ${RAILWAY_SERVICE}`);
try {
  execSync(`railway variables --service ${RAILWAY_SERVICE} --set "TWITTER_SESSION_B64=${sessionB64}"`, {
    stdio: 'inherit',
    encoding: 'utf8',
  });
  console.log('✅ Railway variable updated\n');
} catch (error) {
  console.error(`❌ Failed to update Railway: ${error.message}`);
  process.exit(1);
}

// Verify
console.log('🔍 Verifying auth on Railway...');
console.log('═══════════════════════════════════════════════════════════\n');
try {
  const output = execSync(
    `railway run --service ${RAILWAY_SERVICE} pnpm exec tsx scripts/ops/run-harvester-single-cycle.ts`,
    {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      timeout: 120000,
    }
  );
  
  const authLines = output.split('\n').filter(line => line.includes('[HARVESTER_AUTH]'));
  
  if (authLines.length > 0) {
    console.log('📋 [HARVESTER_AUTH] lines:');
    authLines.forEach(line => console.log(`   ${line}`));
    
    const loggedIn = authLines.some(line => line.includes('logged_in=true'));
    if (loggedIn) {
      console.log('\n✅ PASS: logged_in=true');
      process.exit(0);
    } else {
      console.log('\n❌ FAIL: logged_in=false');
      process.exit(1);
    }
  } else {
    console.log('⚠️  No [HARVESTER_AUTH] lines found');
    console.log('\nLast 50 lines of output:');
    const lines = output.split('\n');
    lines.slice(-50).forEach(line => console.log(line));
    process.exit(1);
  }
} catch (error) {
  console.error(`❌ Verification failed: ${error.message}`);
  if (error.stdout) {
    const authLines = error.stdout.split('\n').filter(line => line.includes('[HARVESTER_AUTH]'));
    if (authLines.length > 0) {
      console.log('\n[HARVESTER_AUTH] lines from stdout:');
      authLines.forEach(line => console.log(`   ${line}`));
    }
  }
  process.exit(1);
}
