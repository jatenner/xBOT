#!/usr/bin/env tsx
/**
 * ✅ CHECK ENV SYNC
 * 
 * Verifies that .env.local matches the last sync from Railway.
 * Runner entrypoints call this before starting.
 * 
 * Usage:
 *   pnpm run runner:check
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const ENV_LOCAL_PATH = path.join(process.cwd(), '.env.local');
const SYNC_METADATA_PATH = path.join(process.cwd(), '.runner-profile', 'env.sync.json');

/**
 * Compute SHA256 hash of content
 */
function computeHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function main() {
  // Check if .env.local exists
  if (!fs.existsSync(ENV_LOCAL_PATH)) {
    console.error('❌ ENV OUT OF SYNC — .env.local not found');
    console.error('   Run: pnpm run runner:sync');
    process.exit(1);
  }

  // Check if sync metadata exists
  if (!fs.existsSync(SYNC_METADATA_PATH)) {
    console.error('❌ ENV OUT OF SYNC — sync metadata not found');
    console.error('   Run: pnpm run runner:sync');
    process.exit(1);
  }

  // Load sync metadata
  let metadata: any;
  try {
    const metadataContent = fs.readFileSync(SYNC_METADATA_PATH, 'utf-8');
    metadata = JSON.parse(metadataContent);
  } catch (error: any) {
    console.error('❌ ENV OUT OF SYNC — invalid sync metadata');
    console.error(`   Error: ${error.message}`);
    console.error('   Run: pnpm run runner:sync');
    process.exit(1);
  }

  // Compute current hash
  const envContent = fs.readFileSync(ENV_LOCAL_PATH, 'utf-8');
  const currentHash = computeHash(envContent);

  // Compare hashes
  if (currentHash !== metadata.hash) {
    console.error('❌ ENV OUT OF SYNC — hash mismatch');
    console.error(`   Expected: ${metadata.hash.slice(0, 8)}...`);
    console.error(`   Current:  ${currentHash.slice(0, 8)}...`);
    console.error(`   Generated: ${metadata.generated_at}`);
    console.error('   Run: pnpm run runner:sync');
    process.exit(1);
  }

  // Success
  console.log('✅ ENV SYNC OK');
  console.log(`   Service: ${metadata.service}`);
  console.log(`   Generated: ${metadata.generated_at}`);
  console.log(`   Hash: ${metadata.hash.slice(0, 8)}...`);
  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Check failed:', error);
  process.exit(1);
});
