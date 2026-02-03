#!/usr/bin/env tsx
/**
 * 🔐 OPERATOR RECOVERY WORKFLOW (Phase 3)
 * 
 * Single command to recover executor authentication.
 * Only use after Phase 1 (auth persistence proof) has proven stable.
 * 
 * Usage:
 *   pnpm run ops:recover:x-auth
 */

import 'dotenv/config';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

async function main(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🔐 OPERATOR AUTH RECOVERY WORKFLOW');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Step 1: Stop executor
  console.log('📋 Step 1: Stopping executor...');
  try {
    execSync('pnpm run executor:stop', { stdio: 'inherit', encoding: 'utf-8' });
    console.log('✅ Executor stopped\n');
  } catch (e: any) {
    console.warn(`⚠️  Executor stop warning: ${e.message}`);
  }

  // Step 2: Run headed auth repair
  console.log('📋 Step 2: Running headed auth repair...');
  console.log('   Complete login in the browser window, then press Enter.\n');
  try {
    execSync('pnpm run executor:auth', { stdio: 'inherit', encoding: 'utf-8' });
    console.log('✅ Auth repair completed\n');
  } catch (e: any) {
    console.error(`❌ Auth repair failed: ${e.message}`);
    console.error('   Next action: Manually run pnpm run executor:auth and complete login');
    process.exit(1);
  }

  // Step 3: Verify auth-readwrite
  console.log('📋 Step 3: Verifying auth-readwrite...');
  try {
    execSync('pnpm run executor:prove:auth-readwrite', { stdio: 'inherit', encoding: 'utf-8' });
    console.log('✅ Auth-readwrite proof passed\n');
  } catch (e: any) {
    console.error(`❌ Auth-readwrite proof failed: ${e.message}`);
    console.error('   Next action: Re-run pnpm run executor:auth');
    process.exit(1);
  }

  // Step 4: Quick smoke test (10 minutes)
  console.log('📋 Step 4: Running quick smoke test (10 minutes)...');
  try {
    execSync('PROOF_DURATION_MINUTES=10 pnpm run executor:prove:auth-persistence', {
      stdio: 'inherit',
      encoding: 'utf-8',
    });
    console.log('✅ Auth persistence smoke test passed\n');
  } catch (e: any) {
    console.error(`❌ Auth persistence smoke test failed: ${e.message}`);
    console.error('   Next action: Check auth persistence proof report in docs/proofs/auth/');
    process.exit(1);
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           ✅ AUTH RECOVERY COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('Executor authentication has been recovered and verified.');
  console.log('You can now start the executor daemon.');
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}
