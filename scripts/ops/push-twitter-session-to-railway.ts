#!/usr/bin/env tsx
/**
 * Push Twitter session to Railway
 * Reads session from executor machine and updates Railway env var
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

async function main() {
  const sessionPath = process.env.TWITTER_SESSION_PATH || './twitter_session.json';
  const railwayService = process.env.RAILWAY_SERVICE || 'serene-cat';
  
  console.log('🔄 Push Twitter Session to Railway');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // 1. Read session file
  if (!fs.existsSync(sessionPath)) {
    console.error(`❌ Session file not found: ${sessionPath}`);
    console.log('💡 Run scripts/refresh-x-session.ts first to generate session');
    process.exit(1);
  }
  
  const sessionData = fs.readFileSync(sessionPath, 'utf8');
  console.log(`📁 Read session file: ${sessionPath} (${sessionData.length} bytes)`);
  
  // 2. Base64 encode
  const sessionB64 = Buffer.from(sessionData).toString('base64');
  console.log(`📦 Encoded to base64: ${sessionB64.length} chars`);
  
  // 3. Update Railway variable
  console.log(`\n🚀 Updating Railway service: ${railwayService}`);
  try {
    execSync(`railway variables --service ${railwayService} --set "TWITTER_SESSION_B64=${sessionB64}"`, {
      stdio: 'inherit',
      encoding: 'utf8',
    });
    console.log('✅ Railway variable updated');
  } catch (error: any) {
    console.error(`❌ Failed to update Railway: ${error.message}`);
    process.exit(1);
  }
  
  // 4. Verify by running harvester single cycle (checks auth and prints [HARVESTER_AUTH])
  console.log('\n🔍 Verifying session on Railway...');
  let verificationPassed = false;
  try {
    const output = execSync(
      `railway run --service ${railwayService} pnpm exec tsx scripts/ops/run-harvester-single-cycle.ts`,
      {
        stdio: 'pipe',
        encoding: 'utf8',
        timeout: 120000, // 2 minutes for harvester cycle
      }
    );
    
    // Check if output contains successful auth log
    if (output.includes('[HARVESTER_AUTH] logged_in=true')) {
      verificationPassed = true;
      console.log('✅ Session verified on Railway (auth check passed)');
    } else {
      console.warn('⚠️ Verification output did not contain expected auth success message');
      console.log('Output preview:', output.slice(0, 500));
    }
  } catch (error: any) {
    // Check if error output contains auth success (sometimes exit code is non-zero for other reasons)
    const errorOutput = error.stdout || error.stderr || error.message || '';
    if (errorOutput.includes('[HARVESTER_AUTH] logged_in=true')) {
      verificationPassed = true;
      console.log('✅ Session verified on Railway (auth check passed, but harvester exited with error)');
    } else {
      console.warn(`⚠️ Verification failed: ${error.message}`);
      console.log('💡 Session may still be valid - check Railway logs for [HARVESTER_AUTH]');
      if (error.stdout) {
        console.log('Stdout:', error.stdout.slice(0, 500));
      }
      if (error.stderr) {
        console.log('Stderr:', error.stderr.slice(0, 500));
      }
    }
  }
  
  if (!verificationPassed) {
    console.log('💡 Continuing anyway - session push succeeded, verification may have failed for non-auth reasons');
  }
  
  console.log('\n✅ Session sync complete');
}

main().catch(console.error);
