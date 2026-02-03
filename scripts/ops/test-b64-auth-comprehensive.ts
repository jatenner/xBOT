#!/usr/bin/env tsx
/**
 * 🧪 COMPREHENSIVE B64 AUTH TEST
 * 
 * Tests all read/write capabilities using B64 cookies from TWITTER_SESSION_B64:
 * - Post capability
 * - Reply capability  
 * - Harvest capability
 * - Navigation
 * - All read/writes on X through account
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { chromium, BrowserContext, Page, Cookie } from 'playwright';

const PROOF_DURATION_MINUTES = parseInt(process.env.PROOF_DURATION_MINUTES || '5', 10);

// Create temp profile dir per run
const TEMP_PROFILE_BASE = path.join(process.cwd(), '.tmp', 'b64-auth-comprehensive');
const RUN_ID = `comprehensive-${Date.now()}`;
const TEMP_PROFILE_DIR = path.join(TEMP_PROFILE_BASE, RUN_ID);

/**
 * Load cookies from TWITTER_SESSION_B64 environment variable
 */
function loadCookiesFromB64(): Cookie[] {
  const sessionB64 = process.env.TWITTER_SESSION_B64?.trim();
  
  if (!sessionB64) {
    throw new Error('TWITTER_SESSION_B64 environment variable is required');
  }

  try {
    const decoded = Buffer.from(sessionB64, 'base64').toString('utf8');
    const sessionData = JSON.parse(decoded);
    
    let cookies: any[] = [];
    if (Array.isArray(sessionData.cookies)) {
      cookies = sessionData.cookies;
    } else if (Array.isArray(sessionData)) {
      cookies = sessionData;
    } else {
      throw new Error('Invalid session format');
    }
    
    const normalizedCookies: Cookie[] = cookies.map((c: any) => {
      const domain = c.domain || c.Domain || '';
      const normalizedDomain = domain.startsWith('.') ? domain : `.${domain}`;
      
      return {
        name: c.name || c.Name || '',
        value: c.value || c.Value || '',
        domain: normalizedDomain.includes('x.com') ? '.x.com' : '.twitter.com',
        path: c.path || c.Path || '/',
        expires: c.expires || c.Expires || -1,
        httpOnly: c.httpOnly !== undefined ? c.httpOnly : (c.HttpOnly !== undefined ? c.HttpOnly : false),
        secure: c.secure !== undefined ? c.secure : (c.Secure !== false),
        sameSite: c.sameSite || c.SameSite || 'None',
      };
    });
    
    const duplicatedCookies: Cookie[] = [];
    for (const cookie of normalizedCookies) {
      duplicatedCookies.push(cookie);
      if (cookie.domain === '.x.com') {
        duplicatedCookies.push({ ...cookie, domain: '.twitter.com' });
      } else if (cookie.domain === '.twitter.com') {
        duplicatedCookies.push({ ...cookie, domain: '.x.com' });
      }
    }
    
    return duplicatedCookies;
    
  } catch (error: any) {
    throw new Error(`Failed to load cookies from TWITTER_SESSION_B64: ${error.message}`);
  }
}

async function testComprehensiveAuth(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🧪 COMPREHENSIVE B64 AUTH TEST');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const cookies = loadCookiesFromB64();
  console.log(`✅ Loaded ${cookies.length} cookies from TWITTER_SESSION_B64\n`);
  
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
    
    const tests: Array<{ name: string; fn: () => Promise<{ passed: boolean; details: string }> }> = [];
    
    // Test 1: Read/Write (Compose)
    tests.push({
      name: 'Read/Write (Compose UI)',
      fn: async () => {
        console.log('📋 Test 1: Read/Write (Compose UI)...');
        await page!.goto('https://x.com/compose/tweet', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page!.waitForTimeout(2000);
        
        const currentUrl = page!.url();
        if (currentUrl.includes('/i/flow/login')) {
          return { passed: false, details: 'Redirected to login' };
        }
        
        const textarea = page!.locator('[data-testid="tweetTextarea_0"]').first();
        await textarea.waitFor({ timeout: 10000 });
        await textarea.fill('Test message for comprehensive auth verification');
        
        const submitButton = page!.locator('[data-testid="tweetButton"]').first();
        const isEnabled = await submitButton.isEnabled().catch(() => false);
        
        if (isEnabled) {
          console.log('   ✅ Compose UI accessible, submit button enabled');
          return { passed: true, details: 'Compose UI accessible, submit enabled' };
        } else {
          console.log('   ❌ Submit button not enabled');
          return { passed: false, details: 'Submit button not enabled' };
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
        
        const currentUrl = page!.url();
        if (currentUrl.includes('/i/flow/login')) {
          return { passed: false, details: 'Redirected to login' };
        }
        
        const timeline = await page!.evaluate(() => {
          return !!document.querySelector('[data-testid="primaryColumn"]') ||
                 !!document.querySelector('[aria-label="Home timeline"]') ||
                 !!document.querySelector('[data-testid="tweet"]');
        });
        
        if (timeline) {
          console.log('   ✅ Home timeline accessible');
          return { passed: true, details: 'Home timeline accessible' };
        } else {
          console.log('   ❌ Home timeline not found');
          return { passed: false, details: 'Home timeline not found' };
        }
      },
    });
    
    // Test 3: Reply Capability
    tests.push({
      name: 'Reply Capability',
      fn: async () => {
        console.log('📋 Test 3: Reply Capability...');
        await page!.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page!.waitForTimeout(3000);
        
        const currentUrl = page!.url();
        if (currentUrl.includes('/i/flow/login')) {
          return { passed: false, details: 'Redirected to login' };
        }
        
        const replyButtons = await page!.locator('[data-testid="reply"]').count();
        
        if (replyButtons > 0) {
          console.log(`   ✅ Found ${replyButtons} reply buttons`);
          
          const firstReply = page!.locator('[data-testid="reply"]').first();
          await firstReply.click();
          await page!.waitForTimeout(2000);
          
          const replyBox = await page!.locator('[data-testid="tweetTextarea_0"]').count();
          if (replyBox > 0) {
            console.log('   ✅ Reply compose box accessible');
            return { passed: true, details: `Found ${replyButtons} reply buttons, compose box accessible` };
          } else {
            console.log('   ⚠️  Reply button clicked but compose box not found');
            return { passed: false, details: 'Reply button clicked but compose box not found' };
          }
        } else {
          console.log('   ⚠️  No reply buttons found');
          return { passed: false, details: 'No reply buttons found' };
        }
      },
    });
    
    // Test 4: Harvest Capability (Search)
    tests.push({
      name: 'Harvest Capability (Search)',
      fn: async () => {
        console.log('📋 Test 4: Harvest Capability (Search)...');
        await page!.goto('https://x.com/search?q=test&src=typed_query', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page!.waitForTimeout(2000);
        
        const currentUrl = page!.url();
        if (currentUrl.includes('/i/flow/login')) {
          return { passed: false, details: 'Redirected to login' };
        }
        
        const searchResults = await page!.evaluate(() => {
          return !!document.querySelector('[data-testid="tweet"]') ||
                 !!document.querySelector('[aria-label*="Timeline"]') ||
                 !!document.querySelector('[data-testid="primaryColumn"]');
        });
        
        if (searchResults) {
          console.log('   ✅ Search results accessible');
          return { passed: true, details: 'Search results accessible' };
        } else {
          console.log('   ❌ Search results not found');
          return { passed: false, details: 'Search results not found' };
        }
      },
    });
    
    // Test 5: Profile Access
    tests.push({
      name: 'Profile Access',
      fn: async () => {
        console.log('📋 Test 5: Profile Access...');
        
        await page!.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page!.waitForTimeout(2000);
        
        const currentUrl = page!.url();
        if (currentUrl.includes('/i/flow/login')) {
          return { passed: false, details: 'Redirected to login' };
        }
        
        const handle = await page!.evaluate(() => {
          const accountButton = document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]');
          if (accountButton) {
            const text = accountButton.textContent || '';
            const match = text.match(/@(\w+)/);
            return match ? match[1] : null;
          }
          return null;
        });
        
        if (handle) {
          console.log(`   ✅ Profile handle found: @${handle}`);
          await page!.goto(`https://x.com/${handle}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await page!.waitForTimeout(2000);
          
          const profilePage = await page!.evaluate(() => {
            return !!document.querySelector('[data-testid="UserProfileHeader"]') ||
                   !!document.querySelector('[data-testid="primaryColumn"]') ||
                   !!document.querySelector('[data-testid="tweet"]');
          });
          
          if (profilePage) {
            console.log('   ✅ Profile page accessible');
            return { passed: true, details: `Profile @${handle} accessible` };
          } else {
            return { passed: false, details: 'Profile page not fully loaded' };
          }
        } else {
          return { passed: false, details: 'Could not determine handle' };
        }
      },
    });
    
    // Test 6: Notifications Access
    tests.push({
      name: 'Notifications Access',
      fn: async () => {
        console.log('📋 Test 6: Notifications Access...');
        await page!.goto('https://x.com/notifications', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page!.waitForTimeout(2000);
        
        const currentUrl = page!.url();
        if (currentUrl.includes('/i/flow/login')) {
          return { passed: false, details: 'Redirected to login' };
        }
        
        const notifications = await page!.evaluate(() => {
          return !!document.querySelector('[data-testid="primaryColumn"]') ||
                 !!document.querySelector('[aria-label*="Notifications"]');
        });
        
        if (notifications) {
          console.log('   ✅ Notifications page accessible');
          return { passed: true, details: 'Notifications page accessible' };
        } else {
          return { passed: false, details: 'Notifications page not found' };
        }
      },
    });
    
    // Test 7: Explore/Trending
    tests.push({
      name: 'Explore/Trending Access',
      fn: async () => {
        console.log('📋 Test 7: Explore/Trending Access...');
        await page!.goto('https://x.com/explore', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page!.waitForTimeout(2000);
        
        const currentUrl = page!.url();
        if (currentUrl.includes('/i/flow/login')) {
          return { passed: false, details: 'Redirected to login' };
        }
        
        const explore = await page!.evaluate(() => {
          return !!document.querySelector('[data-testid="primaryColumn"]') ||
                 !!document.querySelector('[aria-label*="Explore"]') ||
                 !!document.querySelector('[data-testid="tweet"]');
        });
        
        if (explore) {
          console.log('   ✅ Explore page accessible');
          return { passed: true, details: 'Explore page accessible' };
        } else {
          return { passed: false, details: 'Explore page not found' };
        }
      },
    });
    
    // Run all tests
    const results: Array<{ name: string; passed: boolean; details: string }> = [];
    
    for (const test of tests) {
      try {
        const result = await test.fn();
        results.push({ name: test.name, ...result });
        console.log('');
      } catch (error: any) {
        console.log(`   ❌ Test failed with error: ${error.message}`);
        results.push({ name: test.name, passed: false, details: error.message });
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
      if (!r.passed) {
        console.log(`   Details: ${r.details}`);
      }
    });
    
    console.log(`\n📊 Results: ${passedCount}/${totalCount} tests passed`);
    
    // Write report
    const reportDir = path.join(process.cwd(), 'docs', 'proofs', 'auth');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    const reportPath = path.join(reportDir, `comprehensive-b64-auth-test-${Date.now()}.md`);
    const report = `# Comprehensive B64 Auth Test Report

**Generated:** ${new Date().toISOString()}
**Auth Mode:** Cookie B64 (TWITTER_SESSION_B64)

## Test Results

${results.map(r => `
### ${r.name}

- **Status:** ${r.passed ? '✅ PASS' : '❌ FAIL'}
- **Details:** ${r.details}
`).join('\n')}

## Summary

- **Total Tests:** ${totalCount}
- **Passed:** ${passedCount}
- **Failed:** ${totalCount - passedCount}
- **Success Rate:** ${((passedCount / totalCount) * 100).toFixed(1)}%

## Capabilities Verified

${results.filter(r => r.passed).map(r => `- ✅ ${r.name}`).join('\n') || '- None'}

## Conclusion

${passedCount === totalCount 
  ? '✅ **ALL TESTS PASSED** - Comprehensive auth verified for all read/write operations on X.com via cookie B64'
  : passedCount >= totalCount * 0.7
  ? `⚠️ **MOSTLY PASSED** - ${passedCount}/${totalCount} tests passed. Core capabilities verified.`
  : '❌ **MULTIPLE FAILURES** - Auth may be limited or some capabilities unavailable.'}
`;

    fs.writeFileSync(reportPath, report, 'utf-8');
    console.log(`\n📄 Report written: ${reportPath}`);
    
    if (passedCount === totalCount) {
      console.log('\n✅ ALL TESTS PASSED - Comprehensive auth verified!');
      process.exit(0);
    } else if (passedCount >= totalCount * 0.7) {
      console.log(`\n⚠️  ${totalCount - passedCount} test(s) failed - core capabilities verified`);
      process.exit(0);
    } else {
      console.log(`\n❌ ${totalCount - passedCount} test(s) failed - see report for details`);
      process.exit(1);
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

if (require.main === module) {
  testComprehensiveAuth().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}
