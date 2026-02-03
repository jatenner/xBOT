#!/usr/bin/env tsx
/**
 * Export TWITTER_SESSION_B64 from executor Chrome profile
 * 
 * Reads storageState from persistent Chrome profile and exports as base64.
 * Assumes profile is already logged in (manual login required).
 * 
 * Usage:
 *   pnpm exec tsx scripts/ops/export-twitter-session-b64-from-profile.ts
 */

import { chromium, BrowserContext } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { normalizeStorageState } from '../../src/utils/twitterSessionState';

const PROFILE_DIR = '/Users/jonahtenner/Desktop/xBOT/.runner-profile/executor-chrome-profile';
const OUTPUT_FILE = path.join(process.cwd(), 'twitter_session.json');

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('        📤 EXPORT TWITTER_SESSION_B64 FROM PROFILE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Check if profile directory exists
  if (!fs.existsSync(PROFILE_DIR)) {
    console.error(`❌ Profile directory not found: ${PROFILE_DIR}`);
    console.error('   Please ensure the executor Chrome profile exists.');
    process.exit(1);
  }

  console.log(`📁 Profile directory: ${PROFILE_DIR}`);
  console.log(`📄 Output file: ${OUTPUT_FILE}\n`);

  let browser: any = null;
  let context: BrowserContext | null = null;

  try {
    // Launch browser with persistent context (headless)
    console.log('🚀 Launching browser with persistent context...');
    browser = await chromium.launch({
      headless: true,
      channel: 'chrome',
    });

    context = await browser.newContext({
      userDataDir: PROFILE_DIR,
      // Don't use storageState here - we're reading FROM the profile
    });

    const page = await context.newPage();

    // Navigate to home to activate session
    console.log('🌐 Navigating to https://x.com/home...');
    await page.goto('https://x.com/home', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // Wait a bit for any redirects
    await page.waitForTimeout(3000);

    const finalUrl = page.url();
    const title = await page.title();

    console.log(`   Final URL: ${finalUrl}`);
    console.log(`   Page title: ${title}\n`);

    // Assert it's not login page
    if (finalUrl.includes('/i/flow/login') || finalUrl.includes('/login')) {
      console.error('❌ Still on login page!');
      console.error('   Please ensure you are logged in to the Chrome profile.');
      console.error('   Run: open -na "Google Chrome" --args --user-data-dir="' + PROFILE_DIR + '"');
      process.exit(1);
    }

    // Get storageState from context
    console.log('📦 Extracting storageState from context...');
    const storageState = await context.storageState();

    // Normalize storageState to ensure .x.com + x.com duplicates exist
    console.log('🔄 Normalizing storageState (expanding domains)...');
    
    // Write raw storageState to temp file, then use loadTwitterStorageState to normalize
    const tempFile = path.join(process.cwd(), 'twitter_session_temp.json');
    fs.writeFileSync(tempFile, JSON.stringify(storageState), 'utf8');
    
    // Use loadTwitterStorageState which internally normalizes
    // But we need to bypass the env/file loading and use our temp file
    // Instead, let's use the SessionLoader with our temp file path
    const { SessionLoader } = await import('../../src/utils/sessionLoader');
    
    // Manually normalize using the same logic as normalizeStorageState
    // We'll replicate the expandDomains logic for critical cookies
    const normalizedCookies: any[] = [];
    const seen = new Set<string>();
    
    function expandDomainsForCookie(cookie: any): any[] {
      const domains = new Set<string>();
      const base = cookie.domain || '.x.com';
      const cookieName = cookie.name.toLowerCase();
      const isCriticalCookie = cookieName === 'auth_token' || cookieName === 'ct0';
      
      domains.add(base);
      
      if (base.endsWith('.twitter.com')) {
        domains.add('.twitter.com');
        domains.add('.x.com');
        if (isCriticalCookie) {
          domains.add('x.com');
        }
      } else if (base.endsWith('.x.com')) {
        domains.add('.x.com');
        domains.add('.twitter.com');
        if (isCriticalCookie) {
          domains.add('x.com');
        }
      } else if (base === 'x.com') {
        domains.add('.x.com');
        domains.add('.twitter.com');
      } else if (base.includes('twitter.com')) {
        domains.add('.twitter.com');
        domains.add('.x.com');
        if (isCriticalCookie) {
          domains.add('x.com');
        }
      } else if (base.includes('x.com')) {
        domains.add('.twitter.com');
        domains.add('.x.com');
        if (isCriticalCookie) {
          domains.add('x.com');
        }
      } else {
        if (isCriticalCookie) {
          domains.add('.x.com');
          domains.add('x.com');
          domains.add('.twitter.com');
        }
      }
      
      const variants: any[] = [];
      for (const domain of domains) {
        let formatted: string;
        if (isCriticalCookie && domain === 'x.com') {
          formatted = 'x.com';
        } else if (isCriticalCookie && domain === '.x.com') {
          formatted = '.x.com';
        } else {
          formatted = domain.startsWith('.') ? domain : `.${domain}`;
        }
        variants.push({ ...cookie, domain: formatted });
      }
      return variants;
    }
    
    for (const cookie of storageState.cookies) {
      if (!cookie?.name || cookie.value === undefined || cookie.value === null) {
        continue;
      }
      
      const variants = expandDomainsForCookie(cookie);
      for (const variant of variants) {
        const key = `${variant.name}|${variant.domain}|${variant.path || '/'}|${variant.secure}`;
        if (seen.has(key)) continue;
        seen.add(key);
        normalizedCookies.push(variant);
      }
    }
    
    // Clean up temp file
    fs.unlinkSync(tempFile);
    
    const normalizedState = {
      ...storageState,
      cookies: normalizedCookies,
    };

    // Write to twitter_session.json
    console.log(`💾 Writing normalized storageState to ${OUTPUT_FILE}...`);
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(normalizedState, null, 2), 'utf8');
    console.log(`   ✅ Written ${normalizedCookies.length} cookies\n`);

    // Base64 encode
    const jsonString = JSON.stringify(normalizedState);
    const b64 = Buffer.from(jsonString).toString('base64');
    const b64Len = b64.length;
    
    // Calculate SHA12 (first 12 chars of SHA256)
    const hash = crypto.createHash('sha256').update(b64).digest('hex');
    const sha12 = hash.substring(0, 12);

    // Count auth_token and ct0 by domain
    const authTokenCounts: Record<string, number> = {};
    const ct0Counts: Record<string, number> = {};
    
    normalizedCookies.forEach(cookie => {
      if (cookie.name.toLowerCase() === 'auth_token') {
        authTokenCounts[cookie.domain] = (authTokenCounts[cookie.domain] || 0) + 1;
      }
      if (cookie.name.toLowerCase() === 'ct0') {
        ct0Counts[cookie.domain] = (ct0Counts[cookie.domain] || 0) + 1;
      }
    });

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('                    EXPORT RESULTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log(`B64_LEN: ${b64Len}`);
    console.log(`SHA12: ${sha12}`);
    console.log(`Total cookies: ${normalizedCookies.length}`);
    console.log(`\nCookie counts by domain:`);
    console.log(`  auth_token: ${JSON.stringify(authTokenCounts)}`);
    console.log(`  ct0: ${JSON.stringify(ct0Counts)}`);
    
    // Check if auth_token and ct0 exist on .x.com
    const hasAuthTokenXCom = !!normalizedCookies.find(
      c => c.name.toLowerCase() === 'auth_token' && c.domain === '.x.com'
    );
    const hasCt0XCom = !!normalizedCookies.find(
      c => c.name.toLowerCase() === 'ct0' && c.domain === '.x.com'
    );
    
    console.log(`\nCritical cookies on .x.com:`);
    console.log(`  auth_token: ${hasAuthTokenXCom ? 'YES' : 'NO'}`);
    console.log(`  ct0: ${hasCt0XCom ? 'YES' : 'NO'}`);
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`EXPORT_OK TWITTER_SESSION_B64=${b64}`);
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error: any) {
    console.error('❌ Export failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
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

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
