#!/usr/bin/env tsx
/**
 * Check Default Chrome profile by navigating to x.com and checking for auth cookies
 */

import { chromium } from 'playwright';
import { join } from 'path';
import { homedir } from 'os';

const profilePath = join(homedir(), 'Library/Application Support/Google/Chrome/Default');

async function main() {
  console.log('🔍 Checking Default Chrome Profile with Navigation');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`Profile Path: ${profilePath}\n`);
  
  const context = await chromium.launchPersistentContext(profilePath, {
    headless: false, // Visible to see what's happening
    channel: 'chrome',
    args: ['--no-first-run', '--disable-blink-features=AutomationControlled'],
  });
  
  const page = await context.newPage();
  
  console.log('🌐 Navigating to x.com/home...');
  await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000); // Wait for page to fully load
  
  const url = page.url();
  const title = await page.title();
  
  console.log(`\n📄 Page Info:`);
  console.log(`   URL: ${url}`);
  console.log(`   Title: ${title}\n`);
  
  // Check cookies before and after navigation
  const cookiesBefore = await context.cookies();
  console.log(`🍪 Cookies before check: ${cookiesBefore.length}`);
  
  // Try interacting with page to trigger cookie loading
  try {
    await page.evaluate(() => {
      window.scrollBy(0, 500);
    });
    await page.waitForTimeout(2000);
  } catch {}
  
  // Check cookies again
  const cookies = await context.cookies();
  const twitterCookies = cookies.filter(c => 
    c.domain && (c.domain.includes('.x.com') || c.domain.includes('.twitter.com'))
  );
  
  const authToken = twitterCookies.find(c => c.name === 'auth_token');
  const ct0 = twitterCookies.find(c => c.name === 'ct0');
  
  console.log(`🍪 Cookie Check:`);
  console.log(`   Total cookies: ${cookies.length}`);
  console.log(`   Twitter/X cookies: ${twitterCookies.length}`);
  console.log(`   auth_token: ${authToken ? '✅ YES (domain: ' + authToken.domain + ')' : '❌ NO'}`);
  console.log(`   ct0: ${ct0 ? '✅ YES (domain: ' + ct0.domain + ')' : '❌ NO'}\n`);
  
  if (twitterCookies.length > 0) {
    console.log(`   Cookie names: ${twitterCookies.map(c => c.name).join(', ')}\n`);
  }
  
  // Check if we're actually logged in by looking at page content
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
    console.log('✅ Profile has auth cookies - ready to export!');
  } else if (hasTimeline && !isLoginPage) {
    console.log('⚠️  Page shows logged in but no auth cookies found');
    console.log('   This might mean cookies are HttpOnly or stored differently');
  } else {
    console.log('❌ Profile is not logged in to X.com');
  }
  
  // Keep browser open for 5 seconds so user can see
  await page.waitForTimeout(5000);
  
  await context.close();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
