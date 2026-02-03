#!/usr/bin/env tsx
/**
 * 🔄 EXTRACT COOKIES FROM PROFILE AND TEST COMPREHENSIVE AUTH
 * 
 * Extracts cookies from existing executor profile, updates B64, then runs comprehensive tests:
 * - Read/write proof
 * - Post capability test
 * - Reply capability test
 * - Harvest capability test
 * - Navigation test
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { chromium, BrowserContext, Page, Cookie } from 'playwright';
import { execSync } from 'child_process';
import { getRunnerPaths } from '../../src/infra/runnerProfile';

const paths = getRunnerPaths();
const BROWSER_USER_DATA_DIR = paths.user_data_dir_abs;
const COOKIE_OUTPUT_PATH = path.join(paths.runner_profile_dir_abs, 'cookies_input.json');

async function extractCookiesFromProfile(): Promise<Cookie[]> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🍪 EXTRACTING COOKIES FROM PROFILE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log(`📋 Profile: ${BROWSER_USER_DATA_DIR}`);
  
  let context: BrowserContext | null = null;
  
  try {
    // Launch browser with existing profile
    console.log('🚀 Launching browser with existing profile...');
    context = await chromium.launchPersistentContext(BROWSER_USER_DATA_DIR, {
      headless: true,
      channel: 'chrome',
      args: [
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-blink-features=AutomationControlled',
      ],
    });
    
    const page = await context.newPage();
    
    // Navigate to X.com to ensure cookies are loaded
    console.log('📍 Navigating to https://x.com/home...');
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    // Extract cookies
    console.log('🍪 Extracting cookies...');
    const cookies = await context.cookies();
    
    // Filter for X.com/Twitter cookies
    const twitterCookies = cookies.filter(c => 
      c.domain.includes('x.com') || c.domain.includes('twitter.com')
    );
    
    console.log(`✅ Extracted ${twitterCookies.length} Twitter cookies (out of ${cookies.length} total)`);
    
    // Check for critical cookies
    const authToken = twitterCookies.find(c => c.name === 'auth_token');
    const ct0 = twitterCookies.find(c => c.name === 'ct0');
    const twid = twitterCookies.find(c => c.name === 'twid');
    
    console.log('\n🔍 Critical cookies:');
    console.log(`   auth_token: ${authToken ? '✅ Found' : '❌ Missing'}`);
    console.log(`   ct0: ${ct0 ? '✅ Found' : '❌ Missing'}`);
    console.log(`   twid: ${twid ? '✅ Found' : '❌ Missing'}`);
    
    if (!authToken) {
      throw new Error('auth_token cookie not found - profile may not be authenticated');
    }
    
    // Normalize cookies for Playwright format
    const normalizedCookies: Cookie[] = twitterCookies.map(c => ({
      name: c.name,
      value: c.value,
      domain: c.domain.startsWith('.') ? c.domain : `.${c.domain}`,
      path: c.path || '/',
      expires: c.expires || -1,
      httpOnly: c.httpOnly || false,
      secure: c.secure !== false,
      sameSite: c.sameSite || 'None',
    }));
    
    // Save to file
    const cookieData = { cookies: normalizedCookies };
    fs.writeFileSync(COOKIE_OUTPUT_PATH, JSON.stringify(cookieData, null, 2), 'utf-8');
    console.log(`\n✅ Saved cookies to: ${COOKIE_OUTPUT_PATH}`);
    
    return normalizedCookies;
    
  } finally {
    if (context) {
      await context.close().catch(() => {});
    }
  }
}

async function testComprehensiveAuth(cookies: Cookie[]): Promise<void> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🧪 COMPREHENSIVE AUTH TESTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const TEMP_PROFILE_BASE = path.join(process.cwd(), '.tmp', 'b64-auth-tests');
  const RUN_ID = `comprehensive-${Date.now()}`;
  const TEMP_PROFILE_DIR = path.join(TEMP_PROFILE_BASE, RUN_ID);
  
  if (!fs.existsSync(TEMP_PROFILE_DIR)) {
    fs.mkdirSync(TEMP_PROFILE_DIR, { recursive: true });
  }
  
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  
  try {
    // Launch browser with temp profile
    console.log('🚀 Launching browser with temp profile...');
    context = await chromium.launchPersistentContext(TEMP_PROFILE_DIR, {
      headless: true,
      channel: 'chrome',
      args: [
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-blink-features=AutomationControlled',
      ],
    });
    
    page = await context.newPage();
    
    // Inject cookies
    console.log('🍪 Injecting cookies...');
    await context.addCookies(cookies);
    console.log(`✅ Injected ${cookies.length} cookies\n`);
    
    const tests: Array<{ name: string; fn: () => Promise<boolean> }> = [];
    
    // Test 1: Read/Write (Compose)
    tests.push({
      name: 'Read/Write (Compose UI)',
      fn: async () => {
        console.log('📋 Test 1: Read/Write (Compose UI)...');
        await page!.goto('https://x.com/compose/tweet', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page!.waitForTimeout(2000);
        
        const textarea = page!.locator('[data-testid="tweetTextarea_0"]').first();
        await textarea.waitFor({ timeout: 10000 });
        await textarea.fill('Test');
        
        const submitButton = page!.locator('[data-testid="tweetButton"]').first();
        const isEnabled = await submitButton.isEnabled().catch(() => false);
        
        if (isEnabled) {
          console.log('   ✅ Compose UI accessible, submit button enabled');
          return true;
        } else {
          console.log('   ❌ Submit button not enabled');
          return false;
        }
      },
    });
    
    // Test 2: Navigation (Home Timeline)
    tests.push({
      name: 'Navigation (Home Timeline)',
      fn: async () => {
        console.log('📋 Test 2: Navigation (Home Timeline)...');
        await page!.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page!.waitForTimeout(2000);
        
        const timeline = await page!.evaluate(() => {
          return !!document.querySelector('[data-testid="primaryColumn"]') ||
                 !!document.querySelector('[aria-label="Home timeline"]');
        });
        
        if (timeline) {
          console.log('   ✅ Home timeline accessible');
          return true;
        } else {
          console.log('   ❌ Home timeline not found');
          return false;
        }
      },
    });
    
    // Test 3: Reply Capability (Find a tweet and check reply button)
    tests.push({
      name: 'Reply Capability',
      fn: async () => {
        console.log('📋 Test 3: Reply Capability...');
        await page!.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page!.waitForTimeout(3000);
        
        // Look for reply buttons
        const replyButtons = await page!.locator('[data-testid="reply"]').count();
        
        if (replyButtons > 0) {
          console.log(`   ✅ Found ${replyButtons} reply buttons`);
          
          // Try clicking first reply button
          const firstReply = page!.locator('[data-testid="reply"]').first();
          await firstReply.click();
          await page!.waitForTimeout(1000);
          
          // Check if reply compose box appeared
          const replyBox = await page!.locator('[data-testid="tweetTextarea_0"]').count();
          if (replyBox > 0) {
            console.log('   ✅ Reply compose box accessible');
            return true;
          } else {
            console.log('   ⚠️  Reply button clicked but compose box not found');
            return false;
          }
        } else {
          console.log('   ⚠️  No reply buttons found (may need to scroll)');
          return false;
        }
      },
    });
    
    // Test 4: Harvest Capability (Search/Explore)
    tests.push({
      name: 'Harvest Capability (Search)',
      fn: async () => {
        console.log('📋 Test 4: Harvest Capability (Search)...');
        await page!.goto('https://x.com/search?q=test&src=typed_query', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page!.waitForTimeout(2000);
        
        const searchResults = await page!.evaluate(() => {
          return !!document.querySelector('[data-testid="tweet"]') ||
                 !!document.querySelector('[aria-label*="Timeline"]');
        });
        
        if (searchResults) {
          console.log('   ✅ Search results accessible');
          return true;
        } else {
          console.log('   ❌ Search results not found');
          return false;
        }
      },
    });
    
    // Test 5: Profile Access
    tests.push({
      name: 'Profile Access',
      fn: async () => {
        console.log('📋 Test 5: Profile Access...');
        
        // Try to get handle from cookies or page
        const handleCookie = cookies.find(c => c.name === 'screen_name' || c.name === 'username');
        let handle: string | null = null;
        
        if (handleCookie) {
          handle = handleCookie.value;
        } else {
          // Try to extract from home page
          await page!.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
          await page!.waitForTimeout(2000);
          
          const extractedHandle = await page!.evaluate(() => {
            const accountButton = document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]');
            if (accountButton) {
              const text = accountButton.textContent || '';
              const match = text.match(/@(\w+)/);
              return match ? match[1] : null;
            }
            return null;
          });
          
          handle = extractedHandle;
        }
        
        if (handle) {
          console.log(`   ✅ Profile handle found: @${handle}`);
          await page!.goto(`https://x.com/${handle}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await page!.waitForTimeout(2000);
          
          const profilePage = await page!.evaluate(() => {
            return !!document.querySelector('[data-testid="UserProfileHeader"]') ||
                   !!document.querySelector('[data-testid="primaryColumn"]');
          });
          
          if (profilePage) {
            console.log('   ✅ Profile page accessible');
            return true;
          } else {
            console.log('   ⚠️  Profile page may not be fully loaded');
            return false;
          }
        } else {
          console.log('   ⚠️  Could not determine handle');
          return false;
        }
      },
    });
    
    // Run all tests
    const results: Array<{ name: string; passed: boolean }> = [];
    
    for (const test of tests) {
      try {
        const passed = await test.fn();
        results.push({ name: test.name, passed });
        console.log('');
      } catch (error: any) {
        console.log(`   ❌ Test failed with error: ${error.message}`);
        results.push({ name: test.name, passed: false });
        console.log('');
      }
    }
    
    // Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('           📊 TEST SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    const passedCount = results.filter(r => r.passed).length;
    const totalCount = results.length;
    
    results.forEach(r => {
      console.log(`${r.passed ? '✅' : '❌'} ${r.name}: ${r.passed ? 'PASS' : 'FAIL'}`);
    });
    
    console.log(`\n📊 Results: ${passedCount}/${totalCount} tests passed`);
    
    if (passedCount === totalCount) {
      console.log('\n✅ ALL TESTS PASSED - Comprehensive auth verified!');
    } else {
      console.log(`\n⚠️  ${totalCount - passedCount} test(s) failed`);
    }
    
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
    if (context) {
      await context.close().catch(() => {});
    }
    
    // Cleanup temp profile
    try {
      fs.rmSync(TEMP_PROFILE_DIR, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

async function main(): Promise<void> {
  try {
    // Step 1: Extract cookies from profile
    const cookies = await extractCookiesFromProfile();
    
    // Step 2: Update cookies using ops:update:cookies
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('           🔄 UPDATING COOKIES');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('Running ops:update:cookies...');
    execSync('pnpm run ops:update:cookies', {
      stdio: 'inherit',
      encoding: 'utf-8',
      env: {
        ...process.env,
        COOKIE_INPUT_PATH: COOKIE_OUTPUT_PATH,
      },
    });
    
    // Step 3: Run comprehensive tests
    await testComprehensiveAuth(cookies);
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('           ✅ COMPREHENSIVE AUTH TEST COMPLETE');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
  } catch (error: any) {
    console.error('\n❌ FATAL ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}
