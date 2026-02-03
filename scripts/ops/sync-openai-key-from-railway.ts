#!/usr/bin/env tsx
/**
 * 🔄 Sync OpenAI API Key from Railway to Local
 * 
 * Reads OPENAI_API_KEY from Railway environment injection,
 * updates .env.local, and validates the sync.
 * 
 * NEVER prints the raw key - only masked prefix/suffix and hash.
 * 
 * Usage:
 *   railway run --service xBOT -- pnpm tsx scripts/ops/sync-openai-key-from-railway.ts
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
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
 * Generate SHA256 hash of API key
 */
function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key.trim()).digest('hex');
}

/**
 * Update .env.local file with new OPENAI_API_KEY
 */
function updateEnvLocal(apiKey: string, envLocalPath: string): void {
  let content = '';
  let keyLineFound = false;

  // Read existing .env.local if it exists
  if (fs.existsSync(envLocalPath)) {
    content = fs.readFileSync(envLocalPath, 'utf-8');
  }

  // Process each line
  const lines = content.split('\n');
  const updatedLines: string[] = [];

  for (const line of lines) {
    // Check if this is the OPENAI_API_KEY line (including commented out)
    if (line.match(/^\s*#?\s*OPENAI_API_KEY\s*=/)) {
      // Replace existing line (uncomment if needed)
      updatedLines.push(`OPENAI_API_KEY=${apiKey.trim()}`);
      keyLineFound = true;
    } else {
      // Keep other lines as-is
      updatedLines.push(line);
    }
  }

  // If key line wasn't found, append it
  if (!keyLineFound) {
    // Ensure file ends with newline if it has content
    if (updatedLines.length > 0 && updatedLines[updatedLines.length - 1] !== '') {
      updatedLines.push('');
    }
    updatedLines.push(`OPENAI_API_KEY=${apiKey.trim()}`);
  }

  // Write updated content
  fs.writeFileSync(envLocalPath, updatedLines.join('\n') + '\n', 'utf-8');
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🔄 Sync OpenAI Key from Railway to Local');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Step 1: Read key from Railway environment injection
  console.log('📋 Step 1: Reading OPENAI_API_KEY from Railway environment...');
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error('❌ FAIL: OPENAI_API_KEY not present in Railway environment injection');
    console.error('\n   This script must be run via:');
    console.error('   railway run --service xBOT -- pnpm tsx scripts/ops/sync-openai-key-from-railway.ts');
    process.exit(1);
  }

  // Validate key format
  const trimmedKey = apiKey.trim();
  if (!trimmedKey.startsWith('sk-')) {
    console.error('❌ FAIL: OPENAI_API_KEY does not have expected format (should start with "sk-")');
    process.exit(1);
  }

  const masked = maskApiKey(trimmedKey);
  const hash = hashApiKey(trimmedKey);

  console.log(`   ✅ Key found: ${masked}`);
  console.log(`   ✅ Hash: ${hash.substring(0, 16)}...`);
  console.log(`   ✅ Length: ${trimmedKey.length} chars`);
  console.log();

  // Step 2: Update both .env.local and .env (dotenv/config loads .env first)
  console.log('📋 Step 2: Updating environment files...');
  const repoRoot = process.cwd();
  const envLocalPath = path.join(repoRoot, '.env.local');
  const envPath = path.join(repoRoot, '.env');

  try {
    // Update .env.local (preferred for local development)
    updateEnvLocal(trimmedKey, envLocalPath);
    console.log(`   ✅ Updated: ${envLocalPath}`);
    
    // Also update .env (dotenv/config loads this first, so it must match)
    if (fs.existsSync(envPath)) {
      updateEnvLocal(trimmedKey, envPath);
      console.log(`   ✅ Updated: ${envPath}`);
    } else {
      console.log(`   ⚠️  .env not found (only .env.local updated)`);
    }
    
    console.log(`   ✅ Key written: ${masked}`);
  } catch (error: any) {
    console.error(`   ❌ Failed to update environment files: ${error.message}`);
    process.exit(1);
  }
  console.log();

  // Step 3: Validate the synced key
  console.log('📋 Step 3: Validating synced key...');
  try {
    execSync('pnpm run ops:validate:openai', {
      stdio: 'inherit',
      encoding: 'utf-8',
      cwd: repoRoot,
    });
    console.log('   ✅ Validation passed\n');
  } catch (error: any) {
    console.error('\n   ❌ FAIL: Synced key validation failed');
    console.error('   The key was written but does not work');
    process.exit(1);
  }

  // Step 4: Check drift (should now match)
  console.log('📋 Step 4: Checking for drift...');
  try {
    execSync('pnpm run ops:check:openai-drift', {
      stdio: 'inherit',
      encoding: 'utf-8',
      cwd: repoRoot,
    });
    console.log('   ✅ No drift detected\n');
  } catch (error: any) {
    console.error('\n   ⚠️  WARNING: Drift still detected after sync');
    console.error('   This may indicate:');
    console.error('   - .env.local was not reloaded');
    console.error('   - Multiple .env files are being loaded');
    console.error('   - LaunchAgent needs to be reloaded');
    console.error('\n   Run: pnpm run ops:reload:launchagent');
    // Don't fail here - drift check will show details
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Sync complete');
  console.log(`   Key synced: ${masked}`);
  console.log(`   Hash: ${hash.substring(0, 16)}...`);
  console.log('\n   Next step: Reload LaunchAgent to pick up new key');
  console.log('   Run: pnpm run ops:reload:launchagent');
}

main().catch((error) => {
  console.error('\n❌ FATAL: Sync script error:', error.message);
  process.exit(1);
});
