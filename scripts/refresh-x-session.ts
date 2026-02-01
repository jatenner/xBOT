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
import { join, dirname, basename } from 'path';
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
  // Support direct profile path (for executor profiles)
  const directProfilePath = process.env.CHROME_PROFILE_PATH;
  let chromeUserDataDir: string;
  let chromeProfileDir: string;
  let profilePath: string;
  
  if (directProfilePath) {
    // Direct profile path provided (e.g., executor-chrome-profile)
    profilePath = directProfilePath;
    chromeUserDataDir = dirname(profilePath);
    chromeProfileDir = basename(profilePath);
  } else {
    chromeUserDataDir = process.env.CHROME_USER_DATA_DIR || DEFAULT_CHROME_USER_DATA_DIR;
    chromeProfileDir = process.env.CHROME_PROFILE_DIR || DEFAULT_PROFILE_DIR;
    profilePath = join(chromeUserDataDir, chromeProfileDir);
  }
  
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
    
    // Try to remove SingletonLock if Chrome is running (allows access)
    const singletonLockPath = join(profilePath, 'SingletonLock');
    if (existsSync(singletonLockPath)) {
      try {
        const { unlinkSync } = await import('fs');
        unlinkSync(singletonLockPath);
        console.log('   Removed SingletonLock (Chrome may be running)\n');
      } catch {
        // Ignore - might be locked
      }
    }
    
    // Launch persistent context using real Chrome
    context = await chromium.launchPersistentContext(profilePath, {
      headless: false, // Visible for verification (user can see it's working)
      channel: 'chrome', // Use real Chrome, not test browser
      args: [
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=RendererCodeIntegrity', // Helps with profile access
      ],
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 },
    });
    
    const page = await context.newPage();
    
    console.log('🌐 Navigating to X.com/home...');
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Wait for page to load
    await page.waitForTimeout(3000);
    
    // DIAGNOSTIC: Check current page state FIRST
    const currentUrl = page.url();
    const pageTitle = await page.title().catch(() => 'unknown');
    
    // Check if we're on login page (fail fast)
    if (currentUrl.includes('/i/flow/login') || currentUrl.includes('/login') || currentUrl.includes('/i/flow/signup')) {
      console.log(`\n❌ Redirected to login page:`);
      console.log(`   URL: ${currentUrl}`);
      console.log(`   Title: ${pageTitle}`);
      console.log(`\n   This Chrome profile is not logged in to X.com`);
      console.log(`   Action: Log in to X.com in Chrome first, then re-run this script`);
      console.log(`   1. Open Chrome`);
      console.log(`   2. Navigate to x.com and log in`);
      console.log(`   3. Re-run: pnpm tsx scripts/refresh-x-session.ts\n`);
      process.exit(1);
    }
    
    // Wait for authenticated UI signal (sidebar Home/Profile)
    console.log('⏳ Waiting for authenticated UI...');
    let authenticatedUIDetected = false;
    try {
      // More specific selector - AccountSwitcher button is a strong signal of auth
      await page.waitForSelector('[data-testid="SideNav_AccountSwitcher_Button"]', {
        timeout: 10000,
      });
      authenticatedUIDetected = true;
      console.log('✅ Authenticated UI detected');
    } catch {
      // Fallback: check for timeline column
      try {
        await page.waitForSelector('[data-testid="primaryColumn"]', {
          timeout: 5000,
        });
        authenticatedUIDetected = true;
        console.log('✅ Timeline detected (authenticated)');
      } catch {
        console.log('⚠️  Authenticated UI not detected, checking cookies anyway...');
      }
    }
    
    const hasTimeline = await page.evaluate(() => {
      return !!(
        document.querySelector('[data-testid="primaryColumn"]') ||
        document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]')
      );
    });
    
    console.log(`\n🔍 Diagnostic:`);
    console.log(`   Current URL: ${currentUrl}`);
    console.log(`   Page title: ${pageTitle}`);
    console.log(`   Authenticated UI detected: ${authenticatedUIDetected}`);
    console.log(`   Has timeline elements: ${hasTimeline}`);
    
    // Wait a bit more for cookies to be fully loaded
    await page.waitForTimeout(2000);
    
    // Get cookies AFTER navigation - try multiple methods
    console.log('\n🍪 Extracting cookies from context...');
    
    // Method 1: Get cookies for specific URL
    const cookiesForUrl = await context.cookies('https://x.com');
    console.log(`   Cookies for https://x.com: ${cookiesForUrl.length}`);
    
    // Method 2: Get cookies for .x.com domain
    const cookiesForDomain = await context.cookies('https://x.com/home');
    console.log(`   Cookies for https://x.com/home: ${cookiesForDomain.length}`);
    
    // Method 3: Get ALL cookies (no filter)
    const allCookiesRaw = await context.cookies();
    console.log(`   Total cookies in context: ${allCookiesRaw.length}`);
    
    // Method 4: Get cookies via page context (might catch partitioned cookies)
    const pageCookies = await page.context().cookies();
    console.log(`   Cookies via page context: ${pageCookies.length}`);
    
    // Combine all methods and deduplicate by name+domain+path
    const uniqueCookies = new Map<string, any>();
    for (const cookie of [...cookiesForUrl, ...cookiesForDomain, ...allCookiesRaw, ...pageCookies]) {
      const key = `${cookie.name}:${cookie.domain}:${cookie.path || '/'}`;
      if (!uniqueCookies.has(key)) {
        uniqueCookies.set(key, cookie);
      }
    }
    
    const allCookiesArray = Array.from(uniqueCookies.values());
    
    // Print all cookie names for debugging (no values)
    const cookieNames = allCookiesArray.map(c => c.name).sort();
    console.log(`   Unique cookie names (${cookieNames.length}): ${cookieNames.slice(0, 10).join(', ')}${cookieNames.length > 10 ? '...' : ''}`);
    
    const twitterCookies = allCookiesArray.filter(c => 
      c.domain && (c.domain.includes('.x.com') || c.domain.includes('.twitter.com') || c.domain === 'x.com' || c.domain === 'twitter.com')
    );
    
    const authToken = twitterCookies.find(c => c.name === 'auth_token');
    const ct0 = twitterCookies.find(c => c.name === 'ct0');
    
    console.log(`\n🍪 Cookie Check:`);
    console.log(`   Total cookies extracted: ${allCookiesArray.length}`);
    console.log(`   X.com/Twitter cookies: ${twitterCookies.length}`);
    console.log(`   auth_token: ${authToken ? '✅ YES' : '❌ NO'}`);
    if (authToken) {
      console.log(`   auth_token domain: ${authToken.domain}`);
    }
    console.log(`   ct0: ${ct0 ? '✅ YES' : '❌ NO'}`);
    if (ct0) {
      console.log(`   ct0 domain: ${ct0.domain}`);
    }
    console.log('');
    
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
          console.log(`   - ${c.name} (domain: ${c.domain})`);
        });
      }
      
      process.exit(1);
    }
    
    // Verify we're actually logged in (reuse hasTimeline from diagnostic)
    console.log('🔍 Verifying login status...');
    const url = currentUrl;
    const title = pageTitle;
    
    if (!hasTimeline && (url.includes('/i/flow/login') || url.includes('/login'))) {
      console.error('❌ Not logged in - redirected to login page');
      console.error(`   URL: ${url}`);
      console.error(`   Title: ${title}`);
      process.exit(1);
    }
    
    console.log(`✅ Login verified (URL: ${url}, hasTimeline: ${hasTimeline})\n`);
    
    // Serialize ONLY required cookies in expected format
    console.log('💾 Serializing session...');
    const sessionCookies = twitterCookies.map(c => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path || '/',
      expires: c.expires || -1,
      httpOnly: c.httpOnly || false,
      secure: c.secure || false,
      sameSite: c.sameSite || 'Lax',
    }));
    
    const sessionData = {
      cookies: sessionCookies,
    };
    
    writeFileSync(SESSION_PATH, JSON.stringify(sessionData, null, 2));
    
    const authTokenCount = sessionCookies.filter(c => c.name === 'auth_token').length;
    const ct0Count = sessionCookies.filter(c => c.name === 'ct0').length;
    
    console.log(`✅ Session saved to ${SESSION_PATH}`);
    console.log(`   Total cookies: ${sessionCookies.length}`);
    console.log(`   auth_token cookies: ${authTokenCount}`);
    console.log(`   ct0 cookies: ${ct0Count}\n`);
    
    // Verification: confirm JSON structure
    console.log('🔍 Verifying session file...');
    const hasCookies = sessionData.cookies && Array.isArray(sessionData.cookies);
    const hasXDomain = sessionData.cookies?.some((c: any) => 
      c.domain && (c.domain.includes('.x.com') || c.domain.includes('.twitter.com'))
    );
    const hasAuthKey = sessionData.cookies?.some((c: any) => c.name === 'auth_token');
    const hasCt0Key = sessionData.cookies?.some((c: any) => c.name === 'ct0');
    
    console.log(`   Has cookies array: ${hasCookies ? '✅' : '❌'}`);
    console.log(`   Has .x.com/.twitter.com cookies: ${hasXDomain ? '✅' : '❌'}`);
    console.log(`   Has auth_token key: ${hasAuthKey ? '✅' : '❌'}`);
    console.log(`   Has ct0 key: ${hasCt0Key ? '✅' : '❌'}`);
    
    if (!hasAuthKey || !hasCt0Key) {
      console.error('\n❌ Session file missing required auth cookies - will not work!');
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
