#!/usr/bin/env tsx
/**
 * Execute push and verify commands directly
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const SESSION_PATH = path.join(process.cwd(), 'twitter_session.json');
const RAILWAY_SERVICE = 'serene-cat';

async function main() {
  console.log('🚀 Pushing Session to Railway');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Verify session file exists
  if (!fs.existsSync(SESSION_PATH)) {
    console.error(`❌ Session file not found: ${SESSION_PATH}`);
    process.exit(1);
  }
  
  const sessionData = fs.readFileSync(SESSION_PATH, 'utf8');
  console.log(`📁 Session file: ${SESSION_PATH} (${sessionData.length} bytes)`);
  
  // Check for auth cookies
  try {
    const session = JSON.parse(sessionData);
    const cookies = session.cookies || [];
    const authToken = cookies.find((c: any) => c.name === 'auth_token');
    const ct0 = cookies.find((c: any) => c.name === 'ct0');
    
    console.log(`\n🍪 Cookie Check:`);
    console.log(`   auth_token: ${authToken ? '✅ YES' : '❌ NO'}`);
    console.log(`   ct0: ${ct0 ? '✅ YES' : '❌ NO'}\n`);
    
    if (!authToken || !ct0) {
      console.error('❌ Missing required auth cookies!');
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Invalid JSON in session file');
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
  } catch (error: any) {
    console.error(`❌ Failed to update Railway: ${error.message}`);
    process.exit(1);
  }
  
  // Verify auth
  console.log('🔍 Verifying auth on Railway...');
  console.log('═══════════════════════════════════════════════════════════\n');
  try {
    const output = execSync(
      `railway run --service ${RAILWAY_SERVICE} pnpm exec tsx scripts/ops/run-harvester-single-cycle.ts`,
      {
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024, // 10MB
        timeout: 120000, // 2 minutes
      }
    );
    
    const authLines = output.split('\n').filter((line: string) => line.includes('[HARVESTER_AUTH]'));
    
    if (authLines.length > 0) {
      console.log('📋 [HARVESTER_AUTH] lines:');
      authLines.forEach((line: string) => console.log(`   ${line}`));
      
      const loggedIn = authLines.some((line: string) => line.includes('logged_in=true'));
      if (loggedIn) {
        console.log('\n✅ PASS: logged_in=true');
        process.exit(0);
      } else {
        console.log('\n❌ FAIL: logged_in=false');
        process.exit(1);
      }
    } else {
      console.log('⚠️  No [HARVESTER_AUTH] lines found in output');
      console.log('\nFull output (last 50 lines):');
      const lines = output.split('\n');
      lines.slice(-50).forEach((line: string) => console.log(line));
      process.exit(1);
    }
  } catch (error: any) {
    console.error(`❌ Verification failed: ${error.message}`);
    if (error.stdout) {
      const authLines = error.stdout.split('\n').filter((line: string) => line.includes('[HARVESTER_AUTH]'));
      if (authLines.length > 0) {
        console.log('\n[HARVESTER_AUTH] lines from stdout:');
        authLines.forEach((line: string) => console.log(`   ${line}`));
      }
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
