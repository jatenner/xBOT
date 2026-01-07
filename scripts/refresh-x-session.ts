#!/usr/bin/env tsx

/**
 * 🔄 X (Twitter) Session Refresh Script
 * 
 * Interactive script to refresh expired Twitter session state.
 * Opens a browser window, waits for manual login, then saves session state.
 * 
 * Usage:
 *   pnpm exec tsx scripts/refresh-x-session.ts
 * 
 * After login completes:
 *   1. Session saved to ./twitter_session.json
 *   2. Base64 encode it: base64 -i twitter_session.json | pbcopy (mac)
 *   3. Update Railway: railway variables --set "TWITTER_SESSION_B64=<paste>"
 */

import { chromium, Browser, BrowserContext } from 'playwright';
import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const SESSION_PATH = join(process.cwd(), 'twitter_session.json');

async function refreshSession(): Promise<void> {
  console.log('🔄 X Session Refresh');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log('📋 Instructions:');
  console.log('  1. A browser window will open');
  console.log('  2. Log in to X (Twitter) in the opened browser');
  console.log('  3. Wait until you see your timeline/home feed');
  console.log('  4. Return here and press Enter');
  console.log('');
  console.log('⚠️  IMPORTANT: Keep the browser window open until prompted!');
  console.log('');
  
  // Wait for user confirmation
  await new Promise<void>((resolve) => {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.once('data', () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      resolve();
    });
    console.log('Press any key to open browser...');
  });

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;

  try {
    console.log('');
    console.log('🚀 Launching browser (headed mode)...');
    
    // Launch browser in headed mode (visible)
    browser = await chromium.launch({
      headless: false,
      channel: 'chromium', // Use system Chromium if available
    });

    // Create context with realistic user agent
    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 },
    });

    const page = await context.newPage();
    
    console.log('🌐 Navigating to X.com...');
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    console.log('');
    console.log('⏳ Waiting for login...');
    console.log('   (Browser window should be visible - log in there)');
    console.log('');
    
    // Wait for login indicators
    let loggedIn = false;
    const maxWaitTime = 300000; // 5 minutes max wait
    const startTime = Date.now();
    
    while (!loggedIn && (Date.now() - startTime) < maxWaitTime) {
      try {
        // Check for account switcher button (indicates logged in)
        const accountSwitcher = await page.waitForSelector(
          '[data-testid="SideNav_AccountSwitcher_Button"], [data-testid="SideNav_NewTweet_Button"], [aria-label*="Account"], [aria-label*="Profile"]',
          { timeout: 5000, state: 'visible' }
        ).catch(() => null);
        
        if (accountSwitcher) {
          // Double-check we're on home/timeline
          const url = page.url();
          if (url.includes('/home') || url.includes('/i/') || url.includes('/compose')) {
            loggedIn = true;
            console.log('✅ Login detected!');
            break;
          }
        }
        
        // Also check for timeline content
        const timeline = await page.evaluate(() => {
          return !!(
            document.querySelector('[data-testid="primaryColumn"]') ||
            document.querySelector('main') ||
            document.querySelector('[data-testid="tweet"]')
          );
        });
        
        if (timeline) {
          loggedIn = true;
          console.log('✅ Timeline detected - login confirmed!');
          break;
        }
        
        // Wait a bit before checking again
        await page.waitForTimeout(2000);
        process.stdout.write('.');
      } catch (error) {
        // Continue waiting
        await page.waitForTimeout(2000);
        process.stdout.write('.');
      }
    }
    
    console.log('');
    
    if (!loggedIn) {
      throw new Error('Login timeout - please ensure you are logged in and try again');
    }
    
    // Wait a bit more to ensure session is fully established
    console.log('⏳ Waiting for session to stabilize...');
    await page.waitForTimeout(3000);
    
    // Save storage state
    console.log('💾 Saving session state...');
    const storageState = await context.storageState();
    writeFileSync(SESSION_PATH, JSON.stringify(storageState, null, 2));
    
    const cookieCount = storageState.cookies.length;
    console.log(`✅ Session saved to ${SESSION_PATH}`);
    console.log(`   Cookies: ${cookieCount}`);
    console.log('');
    
    // Instructions for base64 encoding
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📋 Next Steps:');
    console.log('');
    console.log('1. Base64 encode the session file:');
    console.log('');
    
    if (process.platform === 'darwin') {
      console.log('   base64 -i twitter_session.json | pbcopy');
      console.log('   (copied to clipboard)');
    } else {
      console.log('   base64 twitter_session.json > twitter_session.b64');
      console.log('   cat twitter_session.b64');
    }
    
    console.log('');
    console.log('2. Update Railway environment variable:');
    console.log('');
    console.log('   railway variables --set "TWITTER_SESSION_B64=<paste_base64_here>"');
    console.log('');
    console.log('   ⚠️  IMPORTANT: Keep the quotes around the value!');
    console.log('');
    console.log('3. Verify the update:');
    console.log('');
    console.log('   railway run -- pnpm exec tsx scripts/debug-harvester.ts --minutes 240 --max-seeds 2');
    console.log('');
    console.log('   Look for: [HARVESTER_AUTH] ok=true');
    console.log('');
    
    // Keep browser open for a moment so user can verify
    console.log('⏳ Keeping browser open for 5 seconds (verify login)...');
    await page.waitForTimeout(5000);
    
  } catch (error: any) {
    console.error('');
    console.error('❌ Error:', error.message);
    console.error('');
    console.error('Troubleshooting:');
    console.error('  - Ensure you are logged in to X.com in the browser');
    console.error('  - Check that the browser window is visible');
    console.error('  - Try closing and running the script again');
    process.exit(1);
  } finally {
    if (context) {
      await context.close();
    }
    if (browser) {
      await browser.close();
    }
  }
}

// Run
refreshSession().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

