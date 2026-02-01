#!/usr/bin/env tsx
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const b64 = process.env.TWITTER_SESSION_B64;
if (!b64) {
  console.error('❌ TWITTER_SESSION_B64 not found in env');
  process.exit(1);
}

const sessionJson = Buffer.from(b64, 'base64').toString('utf8');
const session = JSON.parse(sessionJson);

const cookies = session.cookies || [];
const twitterCookies = cookies.filter((c: any) => 
  c.domain && (c.domain.includes('.x.com') || c.domain.includes('.twitter.com'))
);

const authToken = twitterCookies.find((c: any) => c.name === 'auth_token');
const ct0 = twitterCookies.find((c: any) => c.name === 'ct0');

console.log('🔍 Checking .env TWITTER_SESSION_B64');
console.log('═══════════════════════════════════════════════════════════\n');
console.log(`Total cookies: ${cookies.length}`);
console.log(`X.com/Twitter cookies: ${twitterCookies.length}`);
console.log(`auth_token: ${authToken ? '✅ YES (domain: ' + authToken.domain + ')' : '❌ NO'}`);
console.log(`ct0: ${ct0 ? '✅ YES (domain: ' + ct0.domain + ')' : '❌ NO'}\n`);

if (authToken && ct0) {
  console.log('✅ .env session HAS auth cookies!');
  writeFileSync(join(process.cwd(), 'twitter_session.json'), sessionJson);
  console.log('✅ Exported to twitter_session.json\n');
  process.exit(0);
} else {
  console.log('❌ .env session does NOT have auth cookies');
  process.exit(1);
}
