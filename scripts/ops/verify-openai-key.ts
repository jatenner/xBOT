#!/usr/bin/env tsx
/**
 * 🔍 VERIFY OPENAI API KEY
 * 
 * Standalone script to verify OpenAI API key is correctly loaded and valid.
 * Uses the same env loading logic as executor:daemon.
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import OpenAI from 'openai';

// Load .env.local first, then .env (same as daemon.ts)
const envLocalPath = path.join(process.cwd(), '.env.local');
const envPath = path.join(process.cwd(), '.env');

let envFileLoaded: string | null = null;
let envLoadedFromDotenv = false;

if (fs.existsSync(envLocalPath)) {
  require('dotenv').config({ path: envLocalPath });
  envFileLoaded = envLocalPath;
  envLoadedFromDotenv = true;
} else if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
  envFileLoaded = envPath;
  envLoadedFromDotenv = true;
}

// Check for alternative env var names
const openaiKey = process.env.OPENAI_API_KEY;
const openaiKeyAlt = process.env.OPENAI_KEY;
const openaiToken = process.env.OPENAI_API_TOKEN;

// Check if key came from process.env (before dotenv) or dotenv file
const keyFromProcessEnv = !!openaiKey && !envLoadedFromDotenv;

// Get key info (safe - never print full key)
const keyLength = openaiKey ? openaiKey.length : 0;
const keyPrefix = openaiKey ? openaiKey.slice(0, 7) : 'none';
const keySuffix = openaiKey && keyLength > 4 ? openaiKey.slice(-4) : 'none';

// Compute SHA256 hash for comparison
const keyHash = openaiKey 
  ? crypto.createHash('sha256').update(openaiKey).digest('hex').substring(0, 16)
  : 'none';

// Check for whitespace issues
const hasLeadingWhitespace = openaiKey ? /^\s/.test(openaiKey) : false;
const hasTrailingWhitespace = openaiKey ? /\s$/.test(openaiKey) : false;
const hasQuotes = openaiKey ? /^["']|["']$/.test(openaiKey) : false;

// Clean key
let cleanedKey = openaiKey;
if (cleanedKey) {
  cleanedKey = cleanedKey.trim();
  if (cleanedKey.startsWith('"') && cleanedKey.endsWith('"')) {
    cleanedKey = cleanedKey.slice(1, -1);
  } else if (cleanedKey.startsWith("'") && cleanedKey.endsWith("'")) {
    cleanedKey = cleanedKey.slice(1, -1);
  }
  cleanedKey = cleanedKey.trim();
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('     🔍 OPENAI API KEY VERIFICATION');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log(`📁 Env file loaded: ${envFileLoaded || 'none'}`);
console.log(`📂 Key source: ${keyFromProcessEnv ? 'process.env (before dotenv)' : (envLoadedFromDotenv ? 'dotenv file' : 'not found')}`);
console.log(`🔑 Key present: ${!!openaiKey}`);
console.log(`📏 Key length: ${keyLength}`);
console.log(`🔤 Key prefix: ${keyPrefix}`);
console.log(`🔤 Key suffix: ${keySuffix}`);
console.log(`🔐 Key hash (SHA256, first 16): ${keyHash}`);

if (hasLeadingWhitespace || hasTrailingWhitespace) {
  console.log(`⚠️  WARNING: Key has ${hasLeadingWhitespace ? 'leading' : ''}${hasLeadingWhitespace && hasTrailingWhitespace ? ' and ' : ''}${hasTrailingWhitespace ? 'trailing' : ''} whitespace`);
}

if (hasQuotes) {
  console.log(`⚠️  WARNING: Key has quotes around it`);
}

if (openaiKeyAlt) {
  console.log(`⚠️  WARNING: OPENAI_KEY env var also set (may override)`);
}

if (openaiToken) {
  console.log(`⚠️  WARNING: OPENAI_API_TOKEN env var also set (may override)`);
}

if (cleanedKey !== openaiKey) {
  console.log(`✅ Key cleaned: removed whitespace/quotes`);
  console.log(`   Original length: ${openaiKey?.length || 0}`);
  console.log(`   Cleaned length: ${cleanedKey.length}`);
}

async function testOpenAIKey(): Promise<void> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 Testing OpenAI API call...\n');

  // Test API call with cleaned key
  if (!cleanedKey) {
    console.error('❌ OPENAI_API_KEY not set - cannot test');
    process.exit(1);
  }

  const startTime = Date.now();
  
  try {
    const openai = new OpenAI({
      apiKey: cleanedKey
    });
    
    // Make minimal API call (list models - very lightweight)
    console.log('📡 Calling OpenAI API: models.list()...');
    
    const response = await openai.models.list();
    const elapsed = Date.now() - startTime;
    
    console.log(`✅ API call succeeded (${elapsed}ms)`);
    console.log(`   Status: OK`);
    console.log(`   Models returned: ${response.data.length}`);
    console.log(`   Sample models: ${response.data.slice(0, 3).map(m => m.id).join(', ')}`);
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ VERIFICATION PASSED: OpenAI API key is valid');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    process.exit(0);
    
  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    const statusCode = error.status || error.response?.status || 'unknown';
    const errorMessage = error.message || String(error);
    
    console.error(`❌ API call failed (${elapsed}ms)`);
    console.error(`   Status code: ${statusCode}`);
    console.error(`   Error: ${errorMessage}`);
    
    if (statusCode === 401) {
      console.error('\n🚨 AUTHENTICATION FAILED: API key is invalid or expired');
      console.error('   Action required:');
      console.error('   1. Check https://platform.openai.com/account/api-keys');
      console.error('   2. Verify key is active and not revoked');
      console.error('   3. Update OPENAI_API_KEY in .env or .env.local');
      console.error('   4. Ensure key starts with "sk-" (user key) or "sk-proj-" (project key)');
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('❌ VERIFICATION FAILED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    process.exit(1);
  }
}

testOpenAIKey().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
