#!/usr/bin/env tsx
/**
 * Push Twitter session B64 to Railway
 * Reads from twitter_session.b64 and updates Railway TWITTER_SESSION_B64 variable
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import * as crypto from 'crypto';

const B64_FILE = path.join(process.cwd(), 'twitter_session.b64');
const RAILWAY_SERVICE = process.env.RAILWAY_SERVICE || 'serene-cat';

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('        🚀 PUSH TWITTER_SESSION_B64 TO RAILWAY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 1. Read B64 file
  if (!fs.existsSync(B64_FILE)) {
    console.error(`❌ B64 file not found: ${B64_FILE}`);
    process.exit(1);
  }

  const sessionB64 = fs.readFileSync(B64_FILE, 'utf8').trim();
  const b64Len = sessionB64.length;
  const hash = crypto.createHash('sha256').update(sessionB64).digest('hex');
  const sha12 = hash.substring(0, 12);

  console.log(`📁 Read B64 file: ${B64_FILE}`);
  console.log(`   Length: ${b64Len} characters`);
  console.log(`   SHA12: ${sha12}\n`);

  // 2. Check Railway auth
  console.log('🔐 Checking Railway authentication...');
  try {
    execSync('railway whoami', { stdio: 'pipe' });
    console.log('✅ Railway authenticated\n');
  } catch (error: any) {
    console.error('❌ Not authenticated to Railway');
    console.error('   Run: railway login');
    console.error('   Then run this script again');
    process.exit(1);
  }

  // 3. Update Railway variable
  console.log(`🚀 Updating Railway service: ${RAILWAY_SERVICE}`);
  console.log(`   Variable: TWITTER_SESSION_B64`);
  console.log(`   Value: [REDACTED - ${b64Len} chars, SHA12: ${sha12}]\n`);

  try {
    execSync(
      `railway variables --service ${RAILWAY_SERVICE} --set "TWITTER_SESSION_B64=${sessionB64}"`,
      {
        stdio: 'inherit',
        encoding: 'utf8',
      }
    );
    console.log('\n✅ Railway variable updated successfully');
  } catch (error: any) {
    console.error(`\n❌ Failed to update Railway: ${error.message}`);
    process.exit(1);
  }

  // 4. Trigger redeploy
  console.log('\n🔄 Triggering Railway redeploy...');
  try {
    execSync(`railway up --service ${RAILWAY_SERVICE} --detach`, {
      stdio: 'inherit',
      encoding: 'utf8',
    });
    console.log('\n✅ Redeploy triggered');
  } catch (error: any) {
    console.warn(`\n⚠️  Redeploy may need to be triggered manually`);
    console.warn(`   Run: railway up --service ${RAILWAY_SERVICE} --detach`);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('                    COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`✅ TWITTER_SESSION_B64 updated on Railway`);
  console.log(`   Service: ${RAILWAY_SERVICE}`);
  console.log(`   Length: ${b64Len} characters`);
  console.log(`   SHA12: ${sha12}`);
  console.log(`\n💡 Railway will redeploy automatically with the new session`);
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
