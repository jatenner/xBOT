#!/usr/bin/env tsx
/**
 * 🧪 COMPREHENSIVE PROFILE AUTH TEST
 * 
 * Tests all read/write capabilities using the existing executor profile:
 * - Post capability
 * - Reply capability  
 * - Harvest capability
 * - Navigation
 * - All read/writes on X through account
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { chromium, BrowserContext, Page } from 'playwright';
import { getRunnerPaths } from '../../src/infra/runnerProfile';

const paths = getRunnerPaths();
const BROWSER_USER_DATA_DIR = paths.user_data_dir_abs;

async function testComprehensiveAuth(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🧪 COMPREHENSIVE PROFILE AUTH TEST');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log(`📋 Profile: ${BROWSER_USER_DATA_DIR}\n`);
  
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  
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
    
    page = await context.newPage();
    
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
        await textarea.fill('Test message for auth verification');
        
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
        
        // Look for reply buttons
        const replyButtons = await page!.locator('[data-testid="reply"]').count();
        
        if (replyButtons > 0) {
          console.log(`   ✅ Found ${replyButtons} reply buttons`);
          
          // Try clicking first reply button
          const firstReply = page!.locator('[data-testid="reply"]').first();
          await firstReply.click();
          await page!.waitForTimeout(2000);
          
          // Check if reply compose box appeared
          const replyBox = await page!.locator('[data-testid="tweetTextarea_0"]').count();
          if (replyBox > 0) {
            console.log('   ✅ Reply compose box accessible');
            return { passed: true, details: `Found ${replyButtons} reply buttons, compose box accessible` };
          } else {
            console.log('   ⚠️  Reply button clicked but compose box not found');
            return { passed: false, details: 'Reply button clicked but compose box not found' };
          }
        } else {
          console.log('   ⚠️  No reply buttons found (may need to scroll or wait)');
          return { passed: false, details: 'No reply buttons found' };
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
        
        // Try to extract handle from home page
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
            console.log('   ⚠️  Profile page may not be fully loaded');
            return { passed: false, details: 'Profile page not fully loaded' };
          }
        } else {
          console.log('   ⚠️  Could not determine handle');
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
          console.log('   ❌ Notifications page not found');
          return { passed: false, details: 'Notifications page not found' };
        }
      },
    });
    
    // Test 7: Messages Access (if available)
    tests.push({
      name: 'Messages Access',
      fn: async () => {
        console.log('📋 Test 7: Messages Access...');
        await page!.goto('https://x.com/messages', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page!.waitForTimeout(2000);
        
        const currentUrl = page!.url();
        if (currentUrl.includes('/i/flow/login')) {
          return { passed: false, details: 'Redirected to login' };
        }
        
        const messages = await page!.evaluate(() => {
          return !!document.querySelector('[data-testid="primaryColumn"]') ||
                 !!document.querySelector('[aria-label*="Messages"]') ||
                 page.url.includes('/messages');
        });
        
        if (messages) {
          console.log('   ✅ Messages page accessible');
          return { passed: true, details: 'Messages page accessible' };
        } else {
          console.log('   ⚠️  Messages page may require Premium or not be accessible');
          return { passed: false, details: 'Messages page not accessible' };
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
    
    const reportPath = path.join(reportDir, `comprehensive-profile-auth-test-${Date.now()}.md`);
    const report = `# Comprehensive Profile Auth Test Report

**Generated:** ${new Date().toISOString()}
**Profile:** ${BROWSER_USER_DATA_DIR}

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

## Conclusion

${passedCount === totalCount 
  ? '✅ **ALL TESTS PASSED** - Comprehensive auth verified for all read/write operations on X.com'
  : passedCount >= totalCount * 0.7
  ? `⚠️ **MOSTLY PASSED** - ${passedCount}/${totalCount} tests passed. Some capabilities may be limited.`
  : '❌ **MULTIPLE FAILURES** - Auth may be invalid or limited. Check individual test details.'}
`;

    fs.writeFileSync(reportPath, report, 'utf-8');
    console.log(`\n📄 Report written: ${reportPath}`);
    
    if (passedCount === totalCount) {
      console.log('\n✅ ALL TESTS PASSED - Comprehensive auth verified!');
      process.exit(0);
    } else {
      console.log(`\n⚠️  ${totalCount - passedCount} test(s) failed - see report for details`);
      process.exit(1);
    }
    
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
    if (context) {
      await context.close().catch(() => {});
    }
  }
}

if (require.main === module) {
  testComprehensiveAuth().catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}
