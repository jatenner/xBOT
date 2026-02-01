#!/usr/bin/env tsx
/**
 * Check executor's actual browser profile for X.com auth cookies
 */

import { chromium } from 'playwright';
import { existsSync } from 'fs';
import { join } from 'path';

const RUNNER_PROFILE_DIR = process.env.RUNNER_PROFILE_DIR || './.runner-profile';
const EXECUTOR_CHROME_PROFILE = join(RUNNER_PROFILE_DIR, 'executor-chrome-profile');

async function main() {
  console.log('🔍 Checking Executor Browser Profile for Auth Cookies');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`Executor Chrome Profile: ${EXECUTOR_CHROME_PROFILE}\n`);
  
  if (!existsSync(EXECUTOR_CHROME_PROFILE)) {
    console.error(`❌ Profile directory not found: ${EXECUTOR_CHROME_PROFILE}`);
    process.exit(1);
  }
  
  let context;
  try {
    console.log('🚀 Launching Chrome with executor profile...');
    context = await chromium.launchPersistentContext(EXECUTOR_CHROME_PROFILE, {
      headless: true,
      channel: 'chrome',
      args: ['--no-first-run', '--disable-blink-features=AutomationControlled'],
    });
    
    console.log('🌐 Navigating to x.com/home to load cookies...');
    const page = await context.newPage();
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    
    const url = page.url();
    const cookies = await context.cookies();
    const twitterCookies = cookies.filter(c => 
      c.domain && (c.domain.includes('.x.com') || c.domain.includes('.twitter.com'))
    );
    
    const authToken = twitterCookies.find(c => c.name === 'auth_token');
    const ct0 = twitterCookies.find(c => c.name === 'ct0');
    
    console.log(`\n📄 Page URL: ${url}`);
    console.log(`\n🍪 Cookie Check:`);
    console.log(`   Total cookies: ${cookies.length}`);
    console.log(`   X.com/Twitter cookies: ${twitterCookies.length}`);
    console.log(`   auth_token: ${authToken ? '✅ YES (domain: ' + authToken.domain + ')' : '❌ NO'}`);
    console.log(`   ct0: ${ct0 ? '✅ YES (domain: ' + ct0.domain + ')' : '❌ NO'}\n`);
    
    if (twitterCookies.length > 0) {
      const domains = [...new Set(twitterCookies.map(c => c.domain))];
      console.log(`   Domains: ${domains.join(', ')}\n`);
    }
    
    // Check page state
    const hasTimeline = await page.evaluate(() => {
      return !!(
        document.querySelector('[data-testid="primaryColumn"]') ||
        document.querySelector('main') ||
        document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]')
      );
    });
    
    const isLoginPage = url.includes('/i/flow/login') || url.includes('/login');
    
    console.log(`🔍 Page State:`);
    console.log(`   Has timeline: ${hasTimeline}`);
    console.log(`   Is login page: ${isLoginPage}`);
    console.log(`   Appears logged in: ${hasTimeline && !isLoginPage}\n`);
    
    if (authToken && ct0) {
      console.log('✅ Executor profile HAS auth cookies!');
      console.log(`\n💡 Export command:`);
      console.log(`   CHROME_USER_DATA_DIR="${EXECUTOR_CHROME_PROFILE}" CHROME_PROFILE_DIR="." pnpm tsx scripts/refresh-x-session.ts`);
      console.log(`   (or modify refresh script to accept direct profile path)\n`);
    } else if (hasTimeline && !isLoginPage) {
      console.log('⚠️  Page shows logged in but no auth cookies found');
      console.log('   Cookies might be HttpOnly or stored differently');
    } else {
      console.log('❌ Executor profile does not have auth cookies');
    }
    
    await context.close();
    
    if (authToken && ct0) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (error: any) {
    if (error.message.includes('already in use')) {
      console.error('❌ Profile is locked (Chrome/executor might be running)');
      console.error('   Stop executor first: pnpm executor:stop');
    } else {
      console.error('❌ Error:', error.message);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
