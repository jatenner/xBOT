/**
 * 🔐 WHOAMI CHECK SCRIPT
 * 
 * Standalone script to check authentication status using the same
 * Playwright config and session loading as the harvester
 */

import 'dotenv/config';
import { chromium } from 'playwright';
import { loadTwitterStorageState } from '../src/utils/twitterSessionState';
import { checkWhoami } from '../src/utils/whoamiAuth';

async function main() {
  console.log('🔐 WHOAMI Check Script');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Check environment variable (without printing secrets)
  const hasB64 = !!process.env.TWITTER_SESSION_B64;
  const b64Len = process.env.TWITTER_SESSION_B64?.length || 0;
  console.log(`[ENV] TWITTER_SESSION_B64 present: ${hasB64}`);
  console.log(`[ENV] TWITTER_SESSION_B64 length: ${b64Len} characters`);

  // Load session state (same as harvester)
  const sessionResult = await loadTwitterStorageState();
  console.log(`[SESSION] Source: ${sessionResult.source}`);
  console.log(`[SESSION] Cookie count: ${sessionResult.cookieCount}`);
  if (sessionResult.warnings && sessionResult.warnings.length > 0) {
    sessionResult.warnings.forEach(w => console.warn(`[SESSION] ⚠️  ${w}`));
  }

  // Launch browser with session
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--headless=new'
    ]
  });

  try {
    const contextOptions: any = {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 },
      locale: 'en-US',
      timezoneId: 'America/New_York'
    };

    if (sessionResult.storageState && sessionResult.cookieCount > 0) {
      contextOptions.storageState = sessionResult.storageState;
      console.log(`[SESSION] ✅ Loaded session state (${sessionResult.cookieCount} cookies)`);
    } else {
      console.warn(`[SESSION] ⚠️  No valid session state loaded`);
    }

    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();

    // Check WHOAMI
    console.log('\n[WHOAMI] Checking authentication status...');
    const whoami = await checkWhoami(page);

    console.log(`\n[WHOAMI] logged_in=${whoami.logged_in}`);
    console.log(`[WHOAMI] handle=${whoami.handle || 'unknown'}`);
    console.log(`[WHOAMI] url=${whoami.url}`);
    console.log(`[WHOAMI] title=${whoami.title}`);
    console.log(`[WHOAMI] reason=${whoami.reason}`);

    if (whoami.logged_in && whoami.handle) {
      console.log(`\n✅ Authentication successful! Logged in as ${whoami.handle}`);
    } else {
      console.log(`\n❌ Authentication failed: ${whoami.reason}`);
    }

    await browser.close();
    process.exit(whoami.logged_in ? 0 : 1);
  } catch (error: any) {
    console.error(`\n❌ Error during WHOAMI check: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    await browser.close();
    process.exit(1);
  }
}

main().catch(console.error);

