#!/usr/bin/env tsx
/**
 * 🔄 UPDATE COOKIES FROM FILE
 * 
 * Operator command to refresh cookies from a file and update TWITTER_SESSION_B64.
 * Supports Playwright cookie array JSON format.
 * 
 * Usage:
 *   pnpm run ops:update:cookies
 *   COOKIE_INPUT_PATH=./cookies.json pnpm run ops:update:cookies
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { Cookie } from 'playwright';
import { execSync } from 'child_process';

const DEFAULT_COOKIE_INPUT_PATH = path.join(process.cwd(), '.runner-profile', 'cookies_input.json');
const COOKIE_INPUT_PATH = process.env.COOKIE_INPUT_PATH || DEFAULT_COOKIE_INPUT_PATH;
const ENV_LOCAL_PATH = path.join(process.cwd(), '.env.local');
const ENV_PATH = path.join(process.cwd(), '.env');

interface CookieInput {
  cookies?: Cookie[];
  [key: string]: any;
}

/**
 * Normalize cookie format to Playwright Cookie array
 */
function normalizeCookies(input: any): Cookie[] {
  // Handle direct array
  if (Array.isArray(input)) {
    return input.map(normalizeSingleCookie);
  }
  
  // Handle {cookies: [...]}
  if (input.cookies && Array.isArray(input.cookies)) {
    return input.cookies.map(normalizeSingleCookie);
  }
  
  throw new Error('Invalid cookie format: expected array or {cookies: [...]}');
}

function normalizeSingleCookie(c: any): Cookie {
  const domain = c.domain || c.Domain || '';
  const normalizedDomain = domain.startsWith('.') ? domain : `.${domain}`;
  
  return {
    name: c.name || c.Name || '',
    value: c.value || c.Value || '',
    domain: normalizedDomain.includes('x.com') ? '.x.com' : '.twitter.com',
    path: c.path || c.Path || '/',
    expires: c.expires || c.Expires || -1,
    httpOnly: c.httpOnly !== undefined ? c.httpOnly : (c.HttpOnly !== undefined ? c.HttpOnly : false),
    secure: c.secure !== undefined ? c.secure : (c.Secure !== false),
    sameSite: c.sameSite || c.SameSite || 'None',
  };
}

/**
 * Duplicate cookies for both .x.com and .twitter.com domains
 */
function duplicateForBothDomains(cookies: Cookie[]): Cookie[] {
  const duplicated: Cookie[] = [];
  
  for (const cookie of cookies) {
    duplicated.push(cookie);
    
    // Also add for the other domain
    if (cookie.domain === '.x.com') {
      duplicated.push({ ...cookie, domain: '.twitter.com' });
    } else if (cookie.domain === '.twitter.com') {
      duplicated.push({ ...cookie, domain: '.x.com' });
    }
  }
  
  return duplicated;
}

/**
 * Encode cookies to B64 format
 */
function encodeToB64(cookies: Cookie[]): string {
  const sessionData = { cookies };
  const json = JSON.stringify(sessionData);
  return Buffer.from(json).toString('base64');
}

/**
 * Update .env.local with new TWITTER_SESSION_B64
 */
function updateEnvFile(b64Value: string, filePath: string): void {
  let content = '';
  
  if (fs.existsSync(filePath)) {
    content = fs.readFileSync(filePath, 'utf-8');
  }
  
  // Remove existing TWITTER_SESSION_B64 line
  const lines = content.split('\n');
  const filteredLines = lines.filter(line => {
    const trimmed = line.trim();
    return !trimmed.startsWith('TWITTER_SESSION_B64=') && trimmed.length > 0;
  });
  
  // Add new line
  filteredLines.push(`TWITTER_SESSION_B64=${b64Value}`);
  
  // Write back
  fs.writeFileSync(filePath, filteredLines.join('\n') + '\n', 'utf-8');
}

/**
 * Mask B64 value for logging (first 12 chars + last 4 chars)
 */
function maskB64(b64: string): string {
  if (b64.length <= 16) {
    return '***';
  }
  return `${b64.substring(0, 12)}...${b64.substring(b64.length - 4)}`;
}

async function main(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🔄 UPDATE COOKIES FROM FILE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log(`📋 Configuration:`);
  console.log(`   Cookie Input Path: ${COOKIE_INPUT_PATH}\n`);
  
  // Step 1: Validate file exists
  if (!fs.existsSync(COOKIE_INPUT_PATH)) {
    console.error(`❌ Cookie input file not found: ${COOKIE_INPUT_PATH}`);
    console.error(`\n📋 Expected format (Playwright cookie array JSON):`);
    console.error(`   {`);
    console.error(`     "cookies": [`);
    console.error(`       {`);
    console.error(`         "name": "auth_token",`);
    console.error(`         "value": "...",`);
    console.error(`         "domain": ".x.com",`);
    console.error(`         "path": "/",`);
    console.error(`         "expires": -1,`);
    console.error(`         "httpOnly": true,`);
    console.error(`         "secure": true,`);
    console.error(`         "sameSite": "None"`);
    console.error(`       }`);
    console.error(`     ]`);
    console.error(`   }`);
    console.error(`\n   Or direct array format:`);
    console.error(`   [`);
    console.error(`     { "name": "...", "value": "...", "domain": ".x.com", ... }`);
    console.error(`   ]`);
    process.exit(1);
  }
  
  // Step 2: Read and parse cookies
  console.log(`📋 Reading cookie file...`);
  let cookieData: any;
  try {
    const fileContent = fs.readFileSync(COOKIE_INPUT_PATH, 'utf-8');
    cookieData = JSON.parse(fileContent);
  } catch (error: any) {
    console.error(`❌ Failed to parse cookie file: ${error.message}`);
    console.error(`\n📋 Expected format: Valid JSON with cookies array`);
    process.exit(1);
  }
  
  // Step 3: Normalize cookies
  console.log(`📋 Normalizing cookies...`);
  let cookies: Cookie[];
  try {
    cookies = normalizeCookies(cookieData);
    console.log(`✅ Loaded ${cookies.length} cookies`);
  } catch (error: any) {
    console.error(`❌ Failed to normalize cookies: ${error.message}`);
    process.exit(1);
  }
  
  // Step 4: Duplicate for both domains
  const duplicatedCookies = duplicateForBothDomains(cookies);
  console.log(`✅ Duplicated to ${duplicatedCookies.length} cookies (both domains)`);
  
  // Step 5: Encode to B64
  const b64Value = encodeToB64(duplicatedCookies);
  console.log(`✅ Encoded to B64: ${maskB64(b64Value)}`);
  
  // Step 6: Update .env.local
  console.log(`\n📋 Updating .env.local...`);
  updateEnvFile(b64Value, ENV_LOCAL_PATH);
  console.log(`✅ Updated ${ENV_LOCAL_PATH}`);
  
  // Also update .env if it exists (for Railway compatibility)
  if (fs.existsSync(ENV_PATH)) {
    updateEnvFile(b64Value, ENV_PATH);
    console.log(`✅ Updated ${ENV_PATH}`);
  }
  
  // Step 7: Verify auth-readwrite proof
  console.log(`\n📋 Verifying auth with executor:prove:auth-b64-readwrite...`);
  try {
    execSync('pnpm run executor:prove:auth-b64-readwrite', {
      stdio: 'inherit',
      encoding: 'utf-8',
      env: {
        ...process.env,
        TWITTER_SESSION_B64: b64Value,
      },
    });
    console.log(`✅ Auth-readwrite proof passed\n`);
  } catch (error: any) {
    console.error(`❌ Auth-readwrite proof failed`);
    console.error(`   This means the cookies are invalid or expired.`);
    console.error(`   Check the proof report in docs/proofs/auth/`);
    process.exit(1);
  }
  
  // Step 8: Create/update AUTH_OK.json marker
  const authOkPath = path.join(process.cwd(), '.runner-profile', 'AUTH_OK.json');
  const authOkDir = path.dirname(authOkPath);
  if (!fs.existsSync(authOkDir)) {
    fs.mkdirSync(authOkDir, { recursive: true });
  }
  
  // Try to extract handle from cookies
  let handle: string | null = null;
  const usernameCookie = duplicatedCookies.find(c => 
    c.name === 'username' || c.name === 'screen_name' || c.name.toLowerCase().includes('username')
  );
  if (usernameCookie) {
    handle = usernameCookie.value;
  }
  
  const authOkData = {
    timestamp: new Date().toISOString(),
    handle: handle || 'unknown',
    cookie_auth_mode: true,
    cookie_count: duplicatedCookies.length,
    source: 'cookie_file',
    cookie_input_path: COOKIE_INPUT_PATH,
  };
  
  fs.writeFileSync(authOkPath, JSON.stringify(authOkData, null, 2), 'utf-8');
  console.log(`✅ Created AUTH_OK.json marker: ${authOkPath}`);
  console.log(`   Handle: ${handle || 'unknown'}`);
  console.log(`   Cookie Auth Mode: true\n`);
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           ✅ COOKIE UPDATE COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('Cookies have been updated and verified.');
  console.log('You can now run:');
  console.log('  PROOF_DURATION_MINUTES=30 TWITTER_SESSION_B64=<b64> pnpm run executor:prove:auth-b64-persistence');
  console.log('  COOKIE_AUTH_MODE=true pnpm run ops:up:fast');
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}
