import 'dotenv/config';
import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { createHash } from 'crypto';
import { checkWhoami } from '../src/utils/whoamiAuth';

const SESSION_FILE = './twitter_session.json';
const BASE64_FILE = './twitter_session.b64';
const CDP_URL = process.env.CDP_URL || 'http://127.0.0.1:9222';

async function exportSessionFromCDP() {
  console.log('🔐 Export Session from Chrome via CDP');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`[CDP_EXPORT] Connecting to Chrome DevTools Protocol: ${CDP_URL}\n`);

  let browser;
  try {
    // Connect to existing Chrome instance via CDP
    browser = await chromium.connectOverCDP(CDP_URL);
    console.log('✅ Connected to Chrome via CDP\n');

    // Get existing contexts
    const contexts = browser.contexts();
    console.log(`[CDP_EXPORT] Found ${contexts.length} existing browser context(s)\n`);

    let context = contexts[0];
    let page;

    if (context && contexts[0].pages().length > 0) {
      // Use first page from first context
      page = contexts[0].pages()[0];
      console.log(`[CDP_EXPORT] Using existing page: ${page.url()}\n`);
    } else {
      // Create new context and page if none exist
      if (!context) {
        context = await browser.newContext();
        console.log('[CDP_EXPORT] Created new browser context\n');
      }
      page = await context.newPage();
      console.log('[CDP_EXPORT] Created new page\n');
    }

    console.log('📍 Navigating to https://x.com/home...');
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Wait a moment for page to settle
    await page.waitForTimeout(3000);

    // Check authentication status using multiple methods
    console.log('🔍 Checking authentication status...\n');
    const finalUrl = page.url();
    const pageTitle = await page.title().catch(() => 'unknown');

    // Method 1: Check URL and title
    const isLoginRedirect = finalUrl.includes('/i/flow/login') || finalUrl.includes('/login');
    const isLoginTitle = pageTitle.toLowerCase().includes('log in') || pageTitle === 'X' || pageTitle === 'X / X';

    // Method 2: Check for timeline/home indicators
    const hasTimeline = await page.evaluate(() => {
      return !!(
        document.querySelector('[data-testid="primaryColumn"]') ||
        document.querySelector('main') ||
        document.querySelector('section') ||
        document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]')
      );
    }).catch(() => false);

    // Method 3: Check for compose button (strong indicator of logged-in state)
    const hasComposeButton = await page.evaluate(() => {
      return !!(
        document.querySelector('[data-testid="SideNav_NewTweet_Button"]') ||
        document.querySelector('a[href="/compose/tweet"]') ||
        document.querySelector('[aria-label*="Post"]') ||
        document.querySelector('[aria-label*="Tweet"]')
      );
    }).catch(() => false);

    // Method 4: Use WHOAMI helper
    const whoami = await checkWhoami(page).catch(() => ({
      logged_in: false,
      handle: null,
      url: finalUrl,
      title: pageTitle,
      reason: 'whoami_check_failed',
    }));

    // Determine logged_in status (any positive indicator is enough)
    const loggedIn = !isLoginRedirect && !isLoginTitle && (hasTimeline || hasComposeButton || whoami.logged_in);

    console.log(`[AUTH_CHECK] final_url=${finalUrl}`);
    console.log(`[AUTH_CHECK] page_title=${pageTitle}`);
    console.log(`[AUTH_CHECK] is_login_redirect=${isLoginRedirect}`);
    console.log(`[AUTH_CHECK] is_login_title=${isLoginTitle}`);
    console.log(`[AUTH_CHECK] has_timeline=${hasTimeline}`);
    console.log(`[AUTH_CHECK] has_compose_button=${hasComposeButton}`);
    console.log(`[AUTH_CHECK] whoami_logged_in=${whoami.logged_in}`);
    console.log(`[AUTH_CHECK] logged_in=${loggedIn}\n`);

    if (!loggedIn) {
      console.error('❌ Error: Not logged in to X.com');
      console.error('');
      console.error('You are not logged into X in your Chrome instance.');
      console.error('Open Chrome with remote debugging enabled, log into X normally, then rerun.');
      console.error('');
      console.error(`   Current URL: ${finalUrl}`);
      console.error(`   Page title: ${pageTitle}`);
      console.error(`   WHOAMI reason: ${whoami.reason}`);
      console.error('');
      console.error('To enable remote debugging, launch Chrome with:');
      console.error('   /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222');
      process.exit(1);
    }

    console.log('✅ Authentication confirmed!\n');

    // Save storage state
    console.log('💾 Saving storage state...');
    const storageState = await context.storageState({ path: SESSION_FILE });
    const storageStateJson = JSON.stringify(storageState, null, 2);
    console.log(`✅ Storage state saved to ${SESSION_FILE}\n`);

    // Generate base64
    const base64String = Buffer.from(storageStateJson).toString('base64');
    writeFileSync(BASE64_FILE, base64String);

    const cookieCount = storageState.cookies?.length || 0;
    const bytes = Buffer.byteLength(storageStateJson, 'utf8');
    const base64Len = base64String.length;
    const sha12 = createHash('sha256').update(base64String).digest('hex').substring(0, 12);

    console.log('═══════════════════════════════════════════════════════════');
    console.log('📋 Session Export Complete');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`✅ Storage state saved: ${SESSION_FILE}`);
    console.log(`✅ Base64 saved: ${BASE64_FILE}`);
    console.log(`✅ Cookies count: ${cookieCount}`);
    console.log(`✅ Bytes: ${bytes}`);
    console.log(`✅ Base64 length: ${base64Len}`);
    console.log(`✅ Base64 SHA12: ${sha12}\n`);

    if (cookieCount <= 2) {
      console.warn('⚠️  WARNING: Cookie count is very low (<= 2).');
      console.warn('   This may indicate the session is not fully authenticated.');
      console.warn('   Please ensure you are logged into X.com in Chrome before exporting.\n');
    }

    console.log('📝 Next Steps:\n');
    console.log('1. Verify exported session:');
    console.log('   pnpm session:verify\n');
    console.log('2. Copy the base64 string:');
    console.log(`   cat ${BASE64_FILE} | pbcopy`);
    console.log(`   (or manually copy from ${BASE64_FILE})\n`);
    console.log('3. Update Railway environment variable:');
    console.log('   railway variables --set "TWITTER_SESSION_B64=<paste_base64_here>"');
    console.log('   (Replace <paste_base64_here> with your copied base64 string)\n');

  } catch (error: any) {
    console.error(`❌ Error during export: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    
    // Provide helpful error messages
    if (error.message.includes('ECONNREFUSED') || error.message.includes('connect')) {
      console.error('');
      console.error('💡 Tip: Make sure Chrome is running with remote debugging enabled:');
      console.error('   /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222');
      console.error('');
      console.error('   Or set a custom CDP URL:');
      console.error('   CDP_URL=http://127.0.0.1:9222 pnpm session:export:cdp');
    }
    
    process.exit(1);
  } finally {
    // Note: We don't close the browser since it's an existing Chrome instance
    // Just disconnect from CDP
    if (browser) {
      await browser.close();
      console.log('🔒 Disconnected from Chrome CDP.');
    }
  }
}

exportSessionFromCDP().catch(console.error);

