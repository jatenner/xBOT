#!/usr/bin/env tsx
/**
 * 🚀 AUTO-RUN ONE-SHOT PIPELINE
 * 
 * Automatically runs the full pipeline with login handling:
 * 1. Auto-sync env
 * 2. Reset Chrome
 * 3. Check session (auto-login if needed)
 * 4. Run one-shot with freshness flags
 * 
 * Usage:
 *   pnpm exec tsx scripts/runner/auto-run-one-shot.ts
 */

import { execSync } from 'child_process';
import path from 'path';

const RUNNER_PROFILE_DIR = process.env.RUNNER_PROFILE_DIR || path.join(process.cwd(), '.runner-profile');

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🚀 AUTO-RUN ONE-SHOT PIPELINE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  try {
    // Step 1: Auto-sync env
    console.log('STEP 1: Auto-syncing env from Railway...');
    execSync('pnpm run runner:autosync', { stdio: 'inherit' });
    console.log('✅ Env synced\n');
    
    // Step 2: Reset Chrome
    console.log('STEP 2: Resetting Chrome CDP...');
    execSync('pnpm run runner:reset-chrome', { stdio: 'inherit' });
    console.log('✅ Chrome reset\n');
    
    // Step 3: Check session
    console.log('STEP 3: Checking session...');
    let sessionOutput = '';
    try {
      sessionOutput = execSync('RUNNER_MODE=true RUNNER_PROFILE_DIR=' + RUNNER_PROFILE_DIR + ' RUNNER_BROWSER=cdp pnpm run runner:session', {
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      
      if (sessionOutput.includes('SESSION_EXPIRED') || sessionOutput.includes('❌')) {
        throw new Error('SESSION_EXPIRED');
      }
      
      console.log('✅ Session OK\n');
    } catch (error: any) {
      console.error('\n❌ SESSION_EXPIRED - Running login helper...\n');
      
      // Run login helper
      execSync('pnpm run runner:login', { stdio: 'inherit' });
      
      console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('           🔐 LOGIN REQUIRED');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('\nPlease complete login/2FA in Chrome until you are on https://x.com/home');
      console.error('Then rerun:');
      console.error('  HARVEST_IGNORE_STATE=true ONE_SHOT_FRESH_ONLY=true pnpm run runner:one-shot');
      console.error('');
      process.exit(2);
    }
    
    // Step 4: Run one-shot with freshness flags
    console.log('STEP 4: Running one-shot pipeline with freshness flags...\n');
    execSync('HARVEST_IGNORE_STATE=true ONE_SHOT_FRESH_ONLY=true pnpm run runner:one-shot', {
      stdio: 'inherit'
    });
    
    console.log('\n✅ Auto-run complete\n');
  } catch (error: any) {
    console.error('\n❌ Auto-run failed:', error.message);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
