import 'dotenv/config';
import { chromium } from 'playwright';
import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { createHash } from 'crypto';

const SESSION_FILE = './twitter_session.json';
const BASE64_FILE = './twitter_session.b64';

/**
 * Expand ~ to home directory
 */
function expandHomeDir(path: string): string {
  if (path.startsWith('~')) {
    return path.replace('~', homedir());
  }
  return path;
}

async function exportSessionFromChrome() {
  console.log('🔐 Export Session from Chrome Profile');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Get Chrome user data directory (NOT the profile subdirectory)
  const chromeUserDataDir = process.env.CHROME_PROFILE_DIR 
    ? expandHomeDir(process.env.CHROME_PROFILE_DIR)
    : join(homedir(), 'Library', 'Application Support', 'Google', 'Chrome');
  
  const chromeProfile = process.env.CHROME_PROFILE || 'Default';

  console.log(`[CHROME_EXPORT] Chrome user data directory: ${chromeUserDataDir}`);
  console.log(`[CHROME_EXPORT] Profile name: ${chromeProfile}\n`);

  // Verify Chrome directory exists
  if (!existsSync(chromeUserDataDir)) {
    console.error(`❌ Error: Chrome user data directory not found at ${chromeUserDataDir}`);
    console.error(`   Please check CHROME_PROFILE_DIR environment variable.`);
    console.error(`   Default location: ~/Library/Application Support/Google/Chrome`);
    process.exit(1);
  }

  console.log('🚀 Launching Chromium with persistent context...');
  console.log('   (This will open a browser window - DO NOT close it manually)\n');

  // Launch Chromium with persistent context using Chrome's userDataDir
  // Use --profile-directory arg to select the specific profile
  const context = await chromium.launchPersistentContext(chromeUserDataDir, {
    headless: false, // Show browser so user can see what's happening
    channel: 'chrome', // Use system Chrome if available
    args: [
      `--profile-directory=${chromeProfile}`,
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
    ],
  });

  try {
    const page = context.pages()[0] || await context.newPage();

    console.log('📍 Navigating to https://x.com/home...');
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Wait a moment for page to settle
    await page.waitForTimeout(3000);

    // Check authentication status
    console.log('🔍 Checking authentication status...\n');
    const finalUrl = page.url();
    const pageTitle = await page.title().catch(() => 'unknown');

    // Determine logged_in status
    const isLoginRedirect = finalUrl.includes('/i/flow/login') || finalUrl.includes('/login');
    const isLoginTitle = pageTitle.toLowerCase().includes('log in') || pageTitle === 'X' || pageTitle === 'X / X';
    
    // Check for timeline/home indicators
    const hasTimeline = await page.evaluate(() => {
      return !!(
        document.querySelector('[data-testid="primaryColumn"]') ||
        document.querySelector('main') ||
        document.querySelector('section') ||
        document.querySelector('[data-testid="SideNav_AccountSwitcher_Button"]')
      );
    }).catch(() => false);

    const loggedIn = !isLoginRedirect && !isLoginTitle && hasTimeline;

    console.log(`[AUTH_CHECK] final_url=${finalUrl}`);
    console.log(`[AUTH_CHECK] page_title=${pageTitle}`);
    console.log(`[AUTH_CHECK] is_login_redirect=${isLoginRedirect}`);
    console.log(`[AUTH_CHECK] is_login_title=${isLoginTitle}`);
    console.log(`[AUTH_CHECK] has_timeline=${hasTimeline}`);
    console.log(`[AUTH_CHECK] logged_in=${loggedIn}\n`);

    if (!loggedIn) {
      console.error('❌ Error: Not logged in to X.com');
      console.error('');
      console.error('You are not logged into X in your Chrome Default profile.');
      console.error('Open Chrome (Default profile), log into X normally, then rerun.');
      console.error('');
      console.error(`   Current URL: ${finalUrl}`);
      console.error(`   Page title: ${pageTitle}`);
      process.exit(1);
    }

    console.log('✅ Authentication confirmed!\n');

    // Save storage state
    console.log('💾 Saving storage state...');
    const storageState = await context.storageState();
    const storageStateJson = JSON.stringify(storageState, null, 2);
    writeFileSync(SESSION_FILE, storageStateJson);
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
    console.log('1. Copy the base64 string:');
    console.log(`   cat ${BASE64_FILE} | pbcopy`);
    console.log(`   (or manually copy from ${BASE64_FILE})\n`);
    console.log('2. Update Railway environment variable:');
    console.log('   railway variables --set "TWITTER_SESSION_B64=<paste_base64_here>"');
    console.log('   (Replace <paste_base64_here> with your copied base64 string)\n');
    console.log('3. Verify in Railway:');
    console.log('   railway variables | grep TWITTER_SESSION_B64\n');
    console.log('4. Test harvester:');
    console.log('   pnpm harvest:once');
    console.log('   (or: railway run -- pnpm exec tsx scripts/debug-harvester.ts --minutes 240 --max-seeds 2)\n');

  } catch (error: any) {
    console.error(`❌ Error during export: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await context.close();
    console.log('🔒 Browser closed.');
  }
}

exportSessionFromChrome().catch(console.error);
