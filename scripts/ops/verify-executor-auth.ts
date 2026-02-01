#!/usr/bin/env tsx
/**
 * Executor Auth Verification
 * 
 * Checks if TWITTER_SESSION_B64 is valid in executor context (CDP mode).
 */

import 'dotenv/config';
import { checkWhoami } from '../../src/utils/whoamiAuth';

async function main() {
  console.log('🔍 Executor Auth Verification (CDP Mode)');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const sessionB64 = process.env.TWITTER_SESSION_B64?.trim();
  
  if (!sessionB64) {
    console.log('❌ TWITTER_SESSION_B64 is not set');
    process.exit(1);
  }
  
  console.log(`✅ TWITTER_SESSION_B64 is set (length: ${sessionB64.length})`);
  
  try {
    // Use CDP mode like executor
    if (process.env.RUNNER_MODE === 'true' && process.env.RUNNER_BROWSER === 'cdp') {
      const { launchRunnerPersistent } = await import('../../src/infra/playwright/runnerLauncher');
      const context = await launchRunnerPersistent(true);
      const page = await context.newPage();
      
      console.log('🔍 Checking authentication via CDP...');
      const whoami = await checkWhoami(page);
      
      console.log('\n📊 Auth Status:');
      console.log(`   logged_in: ${whoami.logged_in ? '✅ true' : '❌ false'}`);
      console.log(`   handle: ${whoami.handle || 'unknown'}`);
      console.log(`   url: ${whoami.url}`);
      console.log(`   reason: ${whoami.reason}\n`);
      
      await page.close();
      await context.close();
      
      if (whoami.logged_in) {
        console.log('✅ Session is valid! Executor should work.');
        process.exit(0);
      } else {
        console.log('❌ Session is invalid or expired.');
        process.exit(1);
      }
    } else {
      console.log('⚠️  RUNNER_MODE or RUNNER_BROWSER not set for CDP mode');
      console.log('   Set: RUNNER_MODE=true RUNNER_BROWSER=cdp');
      process.exit(1);
    }
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
