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
  
  // 4. Verify by running freshness check
  console.log('\n🔍 Verifying session on Railway...');
  try {
    execSync(`railway run --service ${railwayService} pnpm tsx -e "
      import('dotenv/config').then(() => import('./src/utils/authFreshnessCheck')).then(async ({ checkAuthFreshness }) => {
        const { UnifiedBrowserPool } = await import('./src/browser/UnifiedBrowserPool');
        const pool = UnifiedBrowserPool.getInstance();
        const page = await pool.acquirePage('auth_verify');
        try {
          const result = await checkAuthFreshness(page);
          console.log('Auth check result:', JSON.stringify(result, null, 2));
          process.exit(result.valid ? 0 : 1);
        } finally {
          await pool.releasePage(page);
        }
      });
    "`, {
      stdio: 'inherit',
      encoding: 'utf8',
      timeout: 60000,
    });
    console.log('✅ Session verified on Railway');
  } catch (error: any) {
    console.warn(`⚠️ Verification failed: ${error.message}`);
    console.log('💡 Session may still be valid - check Railway logs');
  }
  
  console.log('\n✅ Session sync complete');
}

main().catch(console.error);
