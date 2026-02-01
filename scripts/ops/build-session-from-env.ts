#!/usr/bin/env tsx
/**
 * Build Twitter session from .x_cookies.env file
 * Reads AUTH_TOKEN and CT0 from .x_cookies.env and creates twitter_session.json
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const ENV_FILE = join(process.cwd(), '.x_cookies.env');
const SESSION_FILE = join(process.cwd(), 'twitter_session.json');

interface Cookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'Lax' | 'Strict' | 'None';
}

function main() {
  console.log('🔨 Building session from .x_cookies.env');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Read .x_cookies.env
  if (!existsSync(ENV_FILE)) {
    console.error(`❌ File not found: ${ENV_FILE}`);
    console.error('   Create .x_cookies.env with:');
    console.error('   AUTH_TOKEN=your_auth_token_value');
    console.error('   CT0=your_ct0_value');
    process.exit(1);
  }

  const envContent = readFileSync(ENV_FILE, 'utf8');
  const lines = envContent.split('\n').filter(line => line.trim() && !line.trim().startsWith('#'));

  let authToken: string | undefined;
  let ct0: string | undefined;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    // Handle KEY=value format (allow any case)
    const equalIndex = trimmed.indexOf('=');
    if (equalIndex === -1) continue;
    
    const key = trimmed.substring(0, equalIndex).trim();
    let value = trimmed.substring(equalIndex + 1).trim();
    
    // Remove quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    
    // Case-insensitive key matching
    const keyUpper = key.toUpperCase();
    if (keyUpper === 'AUTH_TOKEN') {
      authToken = value;
    } else if (keyUpper === 'CT0') {
      ct0 = value;
    }
  }

  // Validate
  console.log('📋 Cookie Check:');
  console.log(`   auth_token: ${authToken ? '✅ YES' : '❌ NO'}`);
  console.log(`   ct0: ${ct0 ? '✅ YES' : '❌ NO'}\n`);

  if (!authToken || !ct0) {
    console.error('❌ Missing required cookies');
    if (!authToken) console.error('   Missing: AUTH_TOKEN');
    if (!ct0) console.error('   Missing: CT0');
    process.exit(1);
  }

  // Build session in Playwright storageState format
  const cookies: Cookie[] = [
    {
      name: 'auth_token',
      value: authToken,
      domain: '.x.com',
      path: '/',
      expires: -1,
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    },
    {
      name: 'ct0',
      value: ct0,
      domain: '.x.com',
      path: '/',
      expires: -1,
      httpOnly: false,
      secure: true,
      sameSite: 'Lax',
    },
  ];

  const sessionData = {
    cookies,
    origins: [],
  };

  // Write session file
  writeFileSync(SESSION_FILE, JSON.stringify(sessionData, null, 2));

  const fileSize = Buffer.byteLength(JSON.stringify(sessionData), 'utf8');
  console.log(`✅ Session file created: ${SESSION_FILE}`);
  console.log(`   File size: ${fileSize} bytes`);
  console.log(`   Cookie count: ${cookies.length}\n`);

  console.log('📋 Next steps:');
  console.log('   1. Push to Railway:');
  console.log('      RAILWAY_SERVICE=serene-cat TWITTER_SESSION_PATH=./twitter_session.json \\');
  console.log('        pnpm exec tsx scripts/ops/push-twitter-session-to-railway.ts');
  console.log('   2. Verify auth:');
  console.log('      railway run --service serene-cat pnpm exec tsx scripts/ops/run-harvester-single-cycle.ts | grep "\\[HARVESTER_AUTH\\]"');
}

main();
