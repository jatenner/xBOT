#!/usr/bin/env tsx
/**
 * Quick Harvester Auth Verification
 * 
 * Checks if TWITTER_SESSION_B64 is valid by attempting a quick auth check.
 */

import 'dotenv/config';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { checkWhoami } from '../../src/utils/whoamiAuth';

async function main() {
  console.log('🔍 Harvester Auth Verification');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const sessionB64 = process.env.TWITTER_SESSION_B64?.trim();
  
  if (!sessionB64) {
    console.log('❌ TWITTER_SESSION_B64 is not set');
    console.log('\nTo fix:');
    console.log('  1. Run: pnpm tsx scripts/refresh-x-session.ts');
    console.log('  2. Export: base64 -i twitter_session.json | pbcopy');
    console.log('  3. Set: export TWITTER_SESSION_B64=<paste>');
    process.exit(1);
  }
  
  console.log(`✅ TWITTER_SESSION_B64 is set (length: ${sessionB64.length})`);
  
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  
  try {
    // Parse session from base64
    const sessionJson = JSON.parse(Buffer.from(sessionB64, 'base64').toString('utf-8'));
    const cookieCount = sessionJson.cookies?.length || 0;
    console.log(`   Cookies in session: ${cookieCount}\n`);
    
    // Launch browser
    console.log('🚀 Launching browser (headless)...');
    browser = await chromium.launch({ headless: true });
    
    context = await browser.newContext({
      storageState: sessionJson,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    
    page = await context.newPage();
    
    // Quick auth check
    console.log('🔍 Checking authentication...');
    const whoami = await checkWhoami(page);
    
    console.log('\n📊 Auth Status:');
    console.log(`   logged_in: ${whoami.logged_in ? '✅ true' : '❌ false'}`);
    console.log(`   handle: ${whoami.handle || 'unknown'}`);
    console.log(`   url: ${whoami.url}`);
    console.log(`   reason: ${whoami.reason}\n`);
    
    if (whoami.logged_in) {
      console.log('✅ Session is valid! Harvester should work.');
      process.exit(0);
    } else {
      console.log('❌ Session is invalid or expired.');
      console.log('\nTo fix:');
      console.log('  1. Run: pnpm tsx scripts/refresh-x-session.ts');
      console.log('  2. Export: base64 -i twitter_session.json | pbcopy');
      console.log('  3. Set: export TWITTER_SESSION_B64=<paste>');
      process.exit(1);
    }
    
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.message.includes('base64')) {
      console.log('\nTWITTER_SESSION_B64 appears to be invalid base64.');
    }
    process.exit(1);
  } finally {
    if (page) await page.close();
    if (context) await context.close();
    if (browser) await browser.close();
  }
}

main().catch(console.error);
