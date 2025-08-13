// Node.js version for npm script compatibility
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SESSION_PATH = path.join(process.cwd(), 'data', 'twitter_session.json');

async function testSession() {
  if (!fs.existsSync(SESSION_PATH)) {
    console.log('❌ SESSION_NOT_FOUND: No session file at', SESSION_PATH);
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: SESSION_PATH
  });
  
  const page = await context.newPage();
  
  try {
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Check for account switcher button to confirm login
    const accountSwitcher = await page.locator('[data-testid="SideNav_AccountSwitcher_Button"]').first();
    const exists = await accountSwitcher.isVisible({ timeout: 5000 }).catch(() => false);
    
    if (exists) {
      console.log('✅ LOGIN_OK: Successfully logged in to X.com');
    } else {
      console.log('❌ LOGIN_FAILED: Account switcher not found - session may be expired');
      process.exit(1);
    }
    
  } catch (error) {
    console.log('❌ SESSION_TEST_ERROR:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

testSession();