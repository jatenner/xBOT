import 'dotenv/config';
import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'fs';
import { checkWhoami } from '../src/utils/whoamiAuth';

const SESSION_FILE = './twitter_session.json';

async function verifyExportedSession() {
  console.log('🔍 Verify Exported Session');
  console.log('═══════════════════════════════════════════════════════════\n');

  if (!existsSync(SESSION_FILE)) {
    console.error(`❌ Error: Session file not found at ${SESSION_FILE}`);
    console.error('   Please run `pnpm session:export` first.');
    process.exit(1);
  }

  console.log(`📂 Loading session from ${SESSION_FILE}...`);
  const sessionData = JSON.parse(readFileSync(SESSION_FILE, 'utf8'));
  const cookieCount = sessionData.cookies?.length || 0;
  console.log(`✅ Loaded session (${cookieCount} cookies)\n`);

  console.log('🚀 Launching browser with exported session...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: sessionData,
  });
  const page = await context.newPage();

  try {
    console.log('📍 Navigating to https://x.com/home...');
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000);

    console.log('🔍 Checking authentication status...\n');
    const whoami = await checkWhoami(page);
    
    console.log(`[WHOAMI] logged_in=${whoami.logged_in}`);
    console.log(`[WHOAMI] handle=${whoami.handle || 'unknown'}`);
    console.log(`[WHOAMI] url=${whoami.url}`);
    console.log(`[WHOAMI] title=${whoami.title}`);
    console.log(`[WHOAMI] reason=${whoami.reason}\n`);

    if (whoami.logged_in) {
      console.log('✅ SUCCESS: Session is valid and authenticated!');
      console.log(`   Logged in as: ${whoami.handle || 'unknown'}`);
      console.log(`   Cookies: ${cookieCount}`);
      process.exit(0);
    } else {
      console.error('❌ FAILED: Session is not authenticated');
      console.error(`   Reason: ${whoami.reason}`);
      console.error('   Please re-export your session from Chrome.');
      process.exit(1);
    }
  } catch (error: any) {
    console.error(`❌ Error during verification: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await browser.close();
  }
}

verifyExportedSession().catch(console.error);

