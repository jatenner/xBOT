#!/usr/bin/env tsx
/**
 * 🔄 SYNC ENV FROM RAILWAY
 * 
 * Fetches required environment variables from Railway service "xBOT"
 * and writes them to .env.local (auto-generated, do not edit manually).
 * 
 * Usage:
 *   pnpm run runner:sync
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const SERVICE_NAME = 'xBOT';
const ENV_LOCAL_PATH = path.join(process.cwd(), '.env.local');
const SYNC_METADATA_PATH = path.join(process.cwd(), '.runner-profile', 'env.sync.json');

// Required keys from Railway
const REQUIRED_KEYS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'DATABASE_URL',
  'OPENAI_API_KEY',
];

// Runner defaults (always included)
const RUNNER_DEFAULTS: Record<string, string> = {
  RUNNER_MODE: 'true',
  RUNNER_PROFILE_DIR: './.runner-profile',
};

/**
 * Redact secret value (show last 4 chars only)
 */
function redactValue(value: string): string {
  if (value.length <= 4) return '****';
  return '****' + value.slice(-4);
}

/**
 * Compute SHA256 hash of content
 */
function computeHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Fetch variables from Railway CLI
 */
function fetchRailwayVariables(): Record<string, string> {
  console.log(`[SYNC] Fetching variables from Railway service: ${SERVICE_NAME}...`);

  try {
    // Use railway variables command with JSON output
    const output = execSync(`railway variables -s ${SERVICE_NAME} --json`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const variables = JSON.parse(output.trim());
    
    // Railway CLI returns array of { name, value } objects
    if (!Array.isArray(variables)) {
      throw new Error('Railway CLI output is not an array');
    }

    const result: Record<string, string> = {};
    for (const item of variables) {
      if (item.name && item.value) {
        result[item.name] = item.value;
      }
    }

    return result;
  } catch (error: any) {
    if (error.message.includes('command not found') || error.message.includes('railway: not found')) {
      throw new Error('Railway CLI not found. Install it: npm install -g @railway/cli');
    }
    if (error.message.includes('not logged in') || error.message.includes('authentication')) {
      throw new Error('Not logged into Railway. Run: railway login');
    }
    throw new Error(`Failed to fetch Railway variables: ${error.message}`);
  }
}

/**
 * Generate .env.local content
 */
function generateEnvContent(railwayVars: Record<string, string>): string {
  const lines: string[] = [
    '# AUTO-GENERATED. DO NOT EDIT. Source: Railway xBOT',
    '# Generated: ' + new Date().toISOString(),
    '',
  ];

  // Add required keys from Railway
  for (const key of REQUIRED_KEYS) {
    const value = railwayVars[key];
    if (!value) {
      throw new Error(`Missing required Railway variable: ${key}`);
    }
    lines.push(`${key}=${value}`);
  }

  lines.push('');

  // Add runner defaults
  for (const [key, value] of Object.entries(RUNNER_DEFAULTS)) {
    lines.push(`${key}=${value}`);
  }

  return lines.join('\n') + '\n';
}

/**
 * Write sync metadata
 */
function writeSyncMetadata(envContent: string, railwayVars: Record<string, string>): void {
  const hash = computeHash(envContent);
  const metadata = {
    service: SERVICE_NAME,
    generated_at: new Date().toISOString(),
    hash,
    keys: [...REQUIRED_KEYS, ...Object.keys(RUNNER_DEFAULTS)],
    railway_env_fingerprint: Object.keys(railwayVars).sort().join(','),
  };

  // Ensure .runner-profile directory exists
  const profileDir = path.dirname(SYNC_METADATA_PATH);
  if (!fs.existsSync(profileDir)) {
    fs.mkdirSync(profileDir, { recursive: true });
  }

  fs.writeFileSync(SYNC_METADATA_PATH, JSON.stringify(metadata, null, 2));
}

/**
 * Print redacted preview
 */
function printPreview(railwayVars: Record<string, string>): void {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           📋 ENV SYNC PREVIEW (REDACTED)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('From Railway:');
  for (const key of REQUIRED_KEYS) {
    const value = railwayVars[key];
    if (value) {
      console.log(`  ${key}=${redactValue(value)}`);
    } else {
      console.log(`  ${key}=❌ MISSING`);
    }
  }

  console.log('\nRunner defaults:');
  for (const [key, value] of Object.entries(RUNNER_DEFAULTS)) {
    console.log(`  ${key}=${value}`);
  }
  console.log('');
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🔄 SYNC ENV FROM RAILWAY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // Fetch variables from Railway
    const railwayVars = fetchRailwayVariables();

    // Validate required keys
    const missing: string[] = [];
    for (const key of REQUIRED_KEYS) {
      if (!railwayVars[key]) {
        missing.push(key);
      }
    }

    if (missing.length > 0) {
      throw new Error(`Missing required Railway variables: ${missing.join(', ')}`);
    }

    // Generate .env.local content
    const envContent = generateEnvContent(railwayVars);

    // Print redacted preview
    printPreview(railwayVars);

    // Write .env.local
    fs.writeFileSync(ENV_LOCAL_PATH, envContent);
    console.log(`✅ Wrote ${ENV_LOCAL_PATH}`);

    // Write sync metadata
    writeSyncMetadata(envContent, railwayVars);
    console.log(`✅ Wrote sync metadata: ${SYNC_METADATA_PATH}`);

    const hash = computeHash(envContent);
    console.log(`\n✅ Sync complete (hash: ${hash.slice(0, 8)}...)`);

  } catch (error: any) {
    console.error(`\n❌ Sync failed: ${error.message}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
