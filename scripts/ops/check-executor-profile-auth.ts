#!/usr/bin/env tsx
/**
 * Check Executor Profile Auth Status
 * 
 * Checks if executor Chrome profile is logged in to X.
 */

import 'dotenv/config';
import { chromium } from 'playwright';
import { checkWhoami } from '../../src/utils/whoamiAuth';
import { ensureRunnerProfileDir, RUNNER_PROFILE_PATHS } from '../../src/infra/runnerProfile';

async function main() {
  const RUNNER_PROFILE_DIR = ensureRunnerProfileDir();
  const BROWSER_USER_DATA_DIR = RUNNER_PROFILE_PATHS.chromeProfile(); // Use executor-chrome-profile (same as executor daemon)
  
  console.log('🔍 Checking Executor Profile Auth Status');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`Profile: ${BROWSER_USER_DATA_DIR}\n`);
  
  const context = await chromium.launchPersistentContext(BROWSER_USER_DATA_DIR, {
    headless: true,
    channel: 'chrome',
    args: [
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 },
  });
  
  const page = await context.newPage();
  
  try {
    const whoami = await checkWhoami(page);
    
    console.log('📊 Auth Status:');
    console.log(`   logged_in: ${whoami.logged_in ? '✅ true' : '❌ false'}`);
    console.log(`   handle: ${whoami.handle || 'unknown'}`);
    console.log(`   url: ${whoami.url}`);
    console.log(`   reason: ${whoami.reason}\n`);
    
    await page.close();
    await context.close();
    
    if (whoami.logged_in) {
      console.log('✅ Executor profile is authenticated!');
      process.exit(0);
    } else {
      console.log('❌ Executor profile is NOT authenticated.');
      process.exit(1);
    }
  } catch (error: any) {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
