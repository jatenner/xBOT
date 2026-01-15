#!/usr/bin/env tsx
/**
 * 🚀 GO-LIVE WORKFLOW
 * 
 * Orchestrates the full Mac Runner workflow:
 * 1. Sync env from Railway
 * 2. Check session
 * 3. Harvest opportunities
 * 4. Process posting queue
 * 5. Verify POST_SUCCESS
 * 
 * Usage:
 *   pnpm run runner:go-live
 */

import { execSync } from 'child_process';
import path from 'path';

function exec(command: string, description: string): { success: boolean; output: string } {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📋 ${description}`);
  console.log(`${'='.repeat(80)}\n`);
  
  try {
    const output = execSync(command, { 
      encoding: 'utf-8',
      stdio: 'inherit',
      cwd: process.cwd(),
    });
    return { success: true, output: output || '' };
  } catch (error: any) {
    return { success: false, output: error.message || '' };
  }
}

async function main() {
  console.log('\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🚀 MAC RUNNER GO-LIVE WORKFLOW');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  
  // Step 1: Auto-sync env
  console.log('STEP 1: Syncing environment from Railway...');
  const syncResult = exec('pnpm run runner:autosync', 'Auto-sync environment');
  if (!syncResult.success) {
    console.error('\n❌ Environment sync failed');
    process.exit(1);
  }
  
  // Step 2: Check session
  console.log('\nSTEP 2: Checking X.com session...');
  const sessionResult = exec('pnpm exec tsx scripts/runner/session-check.ts', 'Session check');
  
  if (!sessionResult.success) {
    console.log('\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('           ⚠️  LOGIN REQUIRED NOW');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('The X.com session has expired. Please run:');
    console.log('');
    console.log('   pnpm run runner:login');
    console.log('');
    console.log('Then complete the login in the browser window that opens.');
    console.log('After logging in, press Enter in the terminal.');
    console.log('');
    console.log('Then re-run this command:');
    console.log('');
    console.log('   pnpm run runner:go-live');
    console.log('');
    process.exit(1);
  }
  
  // Step 3: Harvest opportunities
  console.log('\nSTEP 3: Harvesting opportunities...');
  const harvestResult = exec('pnpm run runner:harvest-once', 'Harvest opportunities');
  if (!harvestResult.success) {
    console.error('\n⚠️  Harvest failed (non-fatal, continuing...)');
  }
  
  // Step 4: Process posting queue
  console.log('\nSTEP 4: Processing posting queue...');
  const postResult = exec('pnpm run runner:once', 'Process posting queue');
  if (!postResult.success) {
    console.error('\n⚠️  Posting failed (non-fatal, continuing...)');
  }
  
  // Step 5: Verify POST_SUCCESS
  console.log('\nSTEP 5: Verifying POST_SUCCESS events...');
  const verifyResult = exec('pnpm exec tsx scripts/verify-post-success.ts --minutes=240', 'Verify POST_SUCCESS');
  if (!verifyResult.success) {
    console.error('\n⚠️  Verification failed (non-fatal)');
  }
  
  console.log('\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           ✅ GO-LIVE WORKFLOW COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
}

main().catch((error) => {
  console.error('❌ Go-live workflow failed:', error);
  process.exit(1);
});
