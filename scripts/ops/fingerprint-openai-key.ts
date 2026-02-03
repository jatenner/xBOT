#!/usr/bin/env tsx
/**
 * 🔍 OpenAI API Key Fingerprint
 * 
 * Generates a fingerprint (hash) of the OpenAI API key without exposing the key itself.
 * Used for drift detection between environments.
 * 
 * Usage:
 *   pnpm run ops:fingerprint:openai
 */

import * as fs from 'fs';
import * as path from 'path';

// Load .env.local first (preferred), then .env (same pattern as daemon)
const envLocalPath = path.join(process.cwd(), '.env.local');
const envPath = path.join(process.cwd(), '.env');

if (fs.existsSync(envLocalPath)) {
  require('dotenv').config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

import * as crypto from 'crypto';

/**
 * Mask API key for logging (show first 6 chars + last 4 chars)
 */
function maskApiKey(key: string): string {
  if (!key || key.length < 10) {
    return '***';
  }
  return `${key.substring(0, 6)}…${key.substring(key.length - 4)}`;
}

/**
 * Generate SHA256 hash of API key (for drift detection)
 */
function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key.trim()).digest('hex');
}

/**
 * Analyze and fingerprint API key
 */
function fingerprintApiKey(key: string | undefined): {
  present: boolean;
  length: number;
  masked: string;
  prefix: string;
  suffix: string;
  hash: string;
  hasWhitespace: boolean;
  hasQuotes: boolean;
  envVarName: string;
} | null {
  if (!key) {
    return null;
  }

  const trimmed = key.trim();
  const hasLeadingTrailingWhitespace = key !== trimmed;
  const hasQuotes = (key.startsWith('"') && key.endsWith('"')) || 
                   (key.startsWith("'") && key.endsWith("'"));
  const prefix = trimmed.substring(0, 6);
  const suffix = trimmed.substring(Math.max(0, trimmed.length - 4));

  // Determine which env var was used
  let envVarName = 'OPENAI_API_KEY';
  if (!process.env.OPENAI_API_KEY && process.env.OPENAI_KEY) {
    envVarName = 'OPENAI_KEY';
  } else if (!process.env.OPENAI_API_KEY && process.env.OPENAI_API_TOKEN) {
    envVarName = 'OPENAI_API_TOKEN';
  }

  return {
    present: true,
    length: trimmed.length,
    masked: maskApiKey(trimmed),
    prefix,
    suffix,
    hash: hashApiKey(trimmed),
    hasWhitespace: hasLeadingTrailingWhitespace,
    hasQuotes,
    envVarName,
  };
}

async function main() {
  const rawKey = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || process.env.OPENAI_API_TOKEN;
  const fingerprint = fingerprintApiKey(rawKey);

  if (!fingerprint) {
    console.error('❌ OPENAI_API_KEY not set');
    process.exit(1);
  }

  // Output fingerprint in JSON format for easy parsing
  const output = {
    present: fingerprint.present,
    length: fingerprint.length,
    masked: fingerprint.masked,
    prefix: fingerprint.prefix,
    suffix: fingerprint.suffix,
    hash: fingerprint.hash,
    hasWhitespace: fingerprint.hasWhitespace,
    hasQuotes: fingerprint.hasQuotes,
    envVarName: fingerprint.envVarName,
  };

  // Human-readable output
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🔍 OpenAI API Key Fingerprint');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`Environment Variable: ${fingerprint.envVarName}`);
  console.log(`Length: ${fingerprint.length} chars`);
  console.log(`Masked: ${fingerprint.masked}`);
  console.log(`Prefix: ${fingerprint.prefix}`);
  console.log(`Suffix: ${fingerprint.suffix}`);
  console.log(`Hash (SHA256): ${fingerprint.hash}`);
  console.log(`Has whitespace: ${fingerprint.hasWhitespace ? '⚠️  yes' : '✅ no'}`);
  console.log(`Has quotes: ${fingerprint.hasQuotes ? '⚠️  yes' : '✅ no'}`);
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('JSON Output (for drift detection):');
  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error('\n❌ FATAL: Fingerprint script error:', error.message);
  process.exit(1);
});
