#!/usr/bin/env tsx
/**
 * 🔄 UPDATE COOKIES FROM FILE
 * 
 * Operator command to refresh cookies from a file and update TWITTER_SESSION_B64.
 * Supports Playwright cookie array JSON format.
 * 
 * Usage:
 *   COOKIE_INPUT_PATH=./cookies.json pnpm run ops:update:cookies
 *   pnpm run ops:update:cookies  # Uses default: ./.runner-profile/cookies_input.json
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { Cookie } from 'playwright';
import { execSync } from 'child_process';
import { getRunnerPaths } from '../../src/infra/runnerProfile';

const DEFAULT_INPUT_PATH = path.join(process.cwd(), '.runner-profile', 'cookies_input.json');

interface PlaywrightCookie {
  name: string;
  value: string;
  domain: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

function normalizeCookies(input: any): Cookie[] {
  // Handle Playwright cookie array format
  if (Array.isArray(input)) {
    return input.map((c: any) => ({
      name: c.name,
      value: c.value,
      domain: c.domain || '.x.com',
      path: c.path || '/',
      expires: c.expires || Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60),
      httpOnly: c.httpOnly || false,
      secure: c.secure !== undefined ? c.secure : true,
      sameSite: c.sameSite || 'None',
    }));
  }
  
  // Handle session object with cookies array
  if (input.cookies && Array.isArray(input.cookies)) {
    return normalizeCookies(input.cookies);
  }
  
  throw new Error('Invalid cookie format: Expected array of cookies or object with cookies array');
}

function encodeToB64(cookies: Cookie[]): string {
  const session = {
    cookies,
    origins: [],
  };
  
  const json = JSON.stringify(session);
  return Buffer.from(json).toString('base64');
}

function updateEnvFile(envPath: string, b64Value: string): void {
  let content = '';
  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, 'utf-8');
  }
  
  const lines = content.split('\n');
  let found = false;
  const newLines = lines.map(line => {
    if (line.startsWith('TWITTER_SESSION_B64=')) {
      found = true;
      return `TWITTER_SESSION_B64=${b64Value}`;
    }
    return line;
  });
  
  if (!found) {
    newLines.push(`TWITTER_SESSION_B64=${b64Value}`);
  }
  
  // Remove trailing empty lines and add one
  while (newLines.length > 0 && newLines[newLines.length - 1].trim() === '') {
    newLines.pop();
  }
  newLines.push('');
  
  fs.writeFileSync(envPath, newLines.join('\n'), 'utf-8');
}

async function main(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🔄 UPDATE COOKIES FROM FILE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const inputPath = process.env.COOKIE_INPUT_PATH || DEFAULT_INPUT_PATH;
  
  // Validate file exists
  if (!fs.existsSync(inputPath)) {
    console.error(`❌ Cookie input file not found: ${inputPath}`);
    console.error('\n📋 Expected format (Playwright cookie array JSON):');
    console.error(JSON.stringify([
      {
        name: 'auth_token',
        value: '...',
        domain: '.x.com',
        path: '/',
        expires: 1234567890,
        httpOnly: true,
        secure: true,
        sameSite: 'None',
      },
    ], null, 2));
    console.error('\n💡 Create this file with your cookies and run again.');
    process.exit(1);
  }
  
  // Read and parse
  let cookies: Cookie[];
  try {
    const content = fs.readFileSync(inputPath, 'utf-8');
    const parsed = JSON.parse(content);
    cookies = normalizeCookies(parsed);
    console.log(`✅ Loaded ${cookies.length} cookies from ${inputPath}\n`);
  } catch (error: any) {
    console.error(`❌ Failed to parse cookie file: ${error.message}`);
    console.error('\n📋 Expected format (Playwright cookie array JSON):');
    console.error(JSON.stringify([
      {
        name: 'auth_token',
        value: '...',
        domain: '.x.com',
        path: '/',
        expires: 1234567890,
        httpOnly: true,
        secure: true,
        sameSite: 'None',
      },
    ], null, 2));
    process.exit(1);
  }
  
  // Encode to B64
  const b64Value = encodeToB64(cookies);
  const maskedB64 = `${b64Value.substring(0, 20)}...${b64Value.substring(b64Value.length - 10)}`;
  console.log(`📦 Encoded to B64: ${maskedB64}\n`);
  
  // Update .env.local
  const envLocalPath = path.join(process.cwd(), '.env.local');
  updateEnvFile(envLocalPath, b64Value);
  console.log(`✅ Updated ${envLocalPath}`);
  
  // Also update .env if it exists
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    updateEnvFile(envPath, b64Value);
    console.log(`✅ Updated ${envPath}`);
  }
  
  console.log('\n🔍 Verifying auth-readwrite proof...\n');
  
  // Run auth-readwrite proof
  try {
    execSync('pnpm run executor:prove:auth-b64-readwrite', {
      stdio: 'inherit',
      encoding: 'utf-8',
      env: {
        ...process.env,
        TWITTER_SESSION_B64: b64Value,
      },
    });
    
    console.log('\n✅ Auth-readwrite proof PASSED\n');
    
    // Create/update AUTH_OK marker
    const paths = getRunnerPaths();
    const authOkPath = paths.auth_marker_path;
    const authOkDir = path.dirname(authOkPath);
    if (!fs.existsSync(authOkDir)) {
      fs.mkdirSync(authOkDir, { recursive: true });
    }
    
    // Extract handle if possible (would need to run proof to get it)
    const authOkData = {
      timestamp: new Date().toISOString(),
      handle: null, // Will be populated by proof if available
      runner_profile_dir_abs: paths.runner_profile_dir_abs,
      user_data_dir_abs: paths.user_data_dir_abs,
      last_success_url: 'https://x.com/home',
      cookie_auth_mode: true,
    };
    
    fs.writeFileSync(authOkPath, JSON.stringify(authOkData, null, 2), 'utf-8');
    console.log(`✅ Created AUTH_OK marker: ${authOkPath}`);
    console.log(`   cookie_auth_mode: true\n`);
    
  } catch (e: any) {
    console.error('\n❌ Auth-readwrite proof FAILED');
    console.error(`   Reason: ${e.message}`);
    console.error('\n📋 Next steps:');
    console.error('   1. Verify cookie file format is correct');
    console.error('   2. Check that cookies are valid and not expired');
    console.error('   3. Re-run: pnpm run ops:update:cookies');
    process.exit(1);
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           ✅ COOKIE UPDATE COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('Cookies have been updated and verified.');
  console.log('You can now run: COOKIE_AUTH_MODE=true pnpm run ops:up:fast');
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}
