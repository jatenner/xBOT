#!/usr/bin/env tsx

/**
 * 🔄 X (Twitter) Session Refresh Script
 * 
 * Extracts authenticated session from real Chrome profile (no login required).
 * Uses launchPersistentContext to access existing logged-in Chrome cookies.
 * 
 * Usage:
 *   pnpm exec tsx scripts/refresh-x-session.ts
 * 
 * Environment variables:
 *   CHROME_USER_DATA_DIR: Chrome user data directory (default: ~/Library/Application Support/Google/Chrome)
 *   CHROME_PROFILE_DIR: Profile directory name (default: "Default")
 * 
 * After export:
 *   1. Session saved to ./twitter_session.json
 *   2. Push to Railway: RAILWAY_SERVICE=serene-cat TWITTER_SESSION_PATH=./twitter_session.json pnpm tsx scripts/ops/push-twitter-session-to-railway.ts
 */

import { chromium, BrowserContext } from 'playwright';
import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const SESSION_PATH = join(process.cwd(), 'twitter_session.json');

// Default Chrome paths on Mac
const DEFAULT_CHROME_USER_DATA_DIR = join(homedir(), 'Library/Application Support/Google/Chrome');
const DEFAULT_PROFILE_DIR = 'Default';

async function findChromeProfiles(userDataDir: string): Promise<string[]> {
  if (!existsSync(userDataDir)) {
    return [];
  }
  
  const profiles: string[] = [];
  
  // Check for Default profile
  if (existsSync(join(userDataDir, 'Default'))) {
    profiles.push('Default');
  }
  
  // Check for Profile 1, Profile 2, etc.
  for (let i = 1; i <= 10; i++) {
    const profilePath = join(userDataDir, `Profile ${i}`);
    if (existsSync(profilePath)) {
      profiles.push(`Profile ${i}`);
    }
  }
  
  return profiles;
}

async function checkProfileForXCookies(userDataDir: string, profileDir: string): Promise<{ hasAuth: boolean; cookieCount: number }> {
  const profilePath = join(userDataDir, profileDir);
  if (!existsSync(profilePath)) {
    return { hasAuth: false, cookieCount: 0 };
  }
  
  try {
    // Quick launch to check cookies (headless, short timeout)
    const context = await chromium.launchPersistentContext(profilePath, {
      headless: true,
      channel: 'chrome',
      args: ['--no-first-run', '--disable-blink-features=AutomationControlled'],
    });
    
    try {
      const cookies = await context.cookies();
      const twitterCookies = cookies.filter(c => 
        c.domain && (c.domain.includes('.x.com') || c.domain.includes('.twitter.com'))
      );
      const hasAuth = twitterCookies.some(c => c.name === 'auth_token') && 
                     twitterCookies.some(c => c.name === 'ct0');
      
      await context.close();
      return { hasAuth, cookieCount: twitterCookies.length };
    } catch {
      await context.close();
      return { hasAuth: false, cookieCount: 0 };
    }
  } catch {
    return { hasAuth: false, cookieCount: 0 };
  }
}

async function refreshSession(): Promise<void> {
  console.log('🔄 X Session Refresh (Real Chrome Profile)');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Resolve Chrome paths
  const chromeUserDataDir = process.env.CHROME_USER_DATA_DIR || DEFAULT_CHROME_USER_DATA_DIR;
  const chromeProfileDir = process.env.CHROME_PROFILE_DIR || DEFAULT_PROFILE_DIR;
  const profilePath = join(chromeUserDataDir, chromeProfileDir);
  
  console.log(`📁 Chrome User Data Dir: ${chromeUserDataDir}`);
  console.log(`📁 Profile Dir: ${chromeProfileDir}`);
  console.log(`📁 Full Profile Path: ${profilePath}\n`);
  
  // Check if profile exists
  if (!existsSync(profilePath)) {
    console.error(`❌ Profile not found: ${profilePath}`);
    console.error('\n🔍 Checking available profiles for X.com cookies...');
    const profiles = await findChromeProfiles(chromeUserDataDir);
    if (profiles.length === 0) {
      console.error('   No profiles found');
    } else {
      for (const p of profiles) {
        const check = await checkProfileForXCookies(chromeUserDataDir, p);
        const status = check.hasAuth ? '✅ (has auth cookies)' : `(${check.cookieCount} X cookies, no auth)`;
        console.error(`   - ${p}: ${status}`);
      }
    }
    console.error('\nSet CHROME_PROFILE_DIR to use a different profile:');
    console.error('   CHROME_PROFILE_DIR="Profile 1" pnpm tsx scripts/refresh-x-session.ts');
    process.exit(1);
  }
  
  let context: BrowserContext | null = null;
  
  try {
    console.log('🚀 Launching Chrome with persistent context...');
    console.log('   Using real Chrome (channel: chrome), NOT test browser\n');
    
    // Launch persistent context using real Chrome
    context = await chromium.launchPersistentContext(profilePath, {
      headless: false, // Visible for verification (user can see it's working)
      channel: 'chrome', // Use real Chrome, not test browser
      args: [
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-blink-features=AutomationControlled',
      ],
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 },
    });
    
    const page = await context.newPage();
    
    console.log('🌐 Navigating to X.com to verify session...');
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000); // Let page load
    
    // Get cookies
    const cookies = await context.cookies();
    const twitterCookies = cookies.filter(c => 
      c.domain && (c.domain.includes('.x.com') || c.domain.includes('.twitter.com'))
    );
    
    const authToken = twitterCookies.find(c => c.name === 'auth_token');
    const ct0 = twitterCookies.find(c => c.name === 'ct0');
    
    console.log(`\n🍪 Cookie Check:`);
    console.log(`   Total cookies: ${cookies.length}`);
    console.log(`   Twitter/X cookies: ${twitterCookies.length}`);
    console.log(`   auth_token: ${authToken ? '✅ YES' : '❌ NO'}`);
    console.log(`   ct0: ${ct0 ? '✅ YES' : '❌ NO'}\n`);
    
    if (!authToken || !ct0) {
      console.error('❌ Required auth cookies not found!');
      console.error('   This Chrome profile is not logged in to X.com');
      console.error('\nAction: Log in to X.com in Chrome first, then re-run this script');
      console.error('   1. Open Chrome');
      console.error('   2. Navigate to x.com and log in');
      console.error('   3. Re-run: pnpm tsx scripts/refresh-x-session.ts\n');
      
      if (twitterCookies.length > 0) {
        console.log('Found Twitter cookies (but missing auth_token/ct0):');
        twitterCookies.slice(0, 5).forEach(c => {
          console.log(`   - ${c.name} (domain: ${c.domain}, value length: ${c.value?.length || 0})`);
        });
      }
      
      process.exit(1);
    }
    
    // Verify we're actually logged in
    console.log('🔍 Verifying login status...');
    const url = page.url();
    const title = await page.title().catch(() => 'unknown');
    
    const hasTimeline = await page.evaluate(() => {
      return !!(
        document.querySelector('[data-testid="primaryColumn"]') ||
        document.querySelector('main') ||
        document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]')
      );
    });
    
    if (!hasTimeline && (url.includes('/i/flow/login') || url.includes('/login'))) {
      console.error('❌ Not logged in - redirected to login page');
      console.error(`   URL: ${url}`);
      console.error(`   Title: ${title}`);
      process.exit(1);
    }
    
    console.log(`✅ Login verified (URL: ${url}, hasTimeline: ${hasTimeline})\n`);
    
    // Save storage state
    console.log('💾 Saving session state...');
    const storageState = await context.storageState();
    writeFileSync(SESSION_PATH, JSON.stringify(storageState, null, 2));
    
    const cookieCount = storageState.cookies.length;
    const authTokenCount = storageState.cookies.filter((c: any) => c.name === 'auth_token').length;
    const ct0Count = storageState.cookies.filter((c: any) => c.name === 'ct0').length;
    const xCookies = storageState.cookies.filter((c: any) => 
      c.domain && (c.domain.includes('.x.com') || c.domain.includes('.twitter.com'))
    ).length;
    
    console.log(`✅ Session saved to ${SESSION_PATH}`);
    console.log(`   Total cookies: ${cookieCount}`);
    console.log(`   X.com/Twitter cookies: ${xCookies}`);
    console.log(`   auth_token cookies: ${authTokenCount}`);
    console.log(`   ct0 cookies: ${ct0Count}\n`);
    
    // Verification: confirm JSON structure
    console.log('🔍 Verifying session file...');
    const sessionData = JSON.parse(storageState.cookies ? JSON.stringify(storageState) : '{}');
    const hasCookies = sessionData.cookies && Array.isArray(sessionData.cookies);
    const hasXDomain = sessionData.cookies?.some((c: any) => 
      c.domain && (c.domain.includes('.x.com') || c.domain.includes('.twitter.com'))
    );
    const hasAuthKey = sessionData.cookies?.some((c: any) => c.name === 'auth_token');
    
    console.log(`   Has cookies array: ${hasCookies ? '✅' : '❌'}`);
    console.log(`   Has .x.com/.twitter.com cookies: ${hasXDomain ? '✅' : '❌'}`);
    console.log(`   Has auth_token key: ${hasAuthKey ? '✅' : '❌'}`);
    
    if (!hasAuthKey) {
      console.error('\n❌ Session file missing auth_token - will not work!');
      process.exit(1);
    }
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📋 Next Steps:');
    console.log('');
    console.log('1. Push session to Railway:');
    console.log('');
    console.log('   RAILWAY_SERVICE=serene-cat TWITTER_SESSION_PATH=./twitter_session.json \\');
    console.log('     pnpm tsx scripts/ops/push-twitter-session-to-railway.ts');
    console.log('');
    console.log('2. Verify auth on Railway:');
    console.log('');
    console.log('   railway run --service serene-cat pnpm tsx scripts/ops/run-harvester-single-cycle.ts');
    console.log('');
    console.log('   Look for: [HARVESTER_AUTH] logged_in=true');
    console.log('');
    
    // Keep browser open briefly for verification
    console.log('⏳ Keeping browser open for 3 seconds (verify login)...');
    await page.waitForTimeout(3000);
    
  } catch (error: any) {
    console.error('');
    console.error('❌ Error:', error.message);
    console.error('');
    
    if (error.message.includes('profile is already in use')) {
      console.error('Troubleshooting:');
      console.error('  - Close all Chrome windows');
      console.error('  - Or use a different profile: CHROME_PROFILE_DIR="Profile 1" pnpm tsx scripts/refresh-x-session.ts');
    } else {
      console.error('Troubleshooting:');
      console.error('  - Ensure Chrome is installed');
      console.error('  - Check that the profile path exists');
      console.error('  - Try a different profile: CHROME_PROFILE_DIR="Profile 1"');
    }
    process.exit(1);
  } finally {
    if (context) {
      await context.close();
    }
  }
}

// Run
refreshSession().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
