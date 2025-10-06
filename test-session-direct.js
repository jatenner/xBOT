// Test session directly with Playwright
const { chromium } = require('playwright');
const fs = require('fs');

async function testSession() {
  console.log('🧪 Testing session directly...');
  
  const session = JSON.parse(fs.readFileSync('./data/twitter_session.json', 'utf8'));
  console.log(`📋 Loaded ${session.cookies.length} cookies`);
  
  const authTokens = session.cookies.filter(c => c.name === 'auth_token');
  console.log(`🔐 Auth tokens: ${authTokens.length}`);
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.118 Safari/537.36'
  });
  
  // Add cookies
  await context.addCookies(session.cookies);
  console.log('🍪 Cookies applied');
  
  const page = await context.newPage();
  
  // Test twitter.com
  console.log('🌐 Testing twitter.com...');
  await page.goto('https://twitter.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  const title1 = await page.title();
  const url1 = page.url();
  console.log(`📄 Twitter.com - Title: "${title1}", URL: ${url1}`);
  
  // Check for login indicators
  const compose1 = await page.$('[data-testid="SideNav_NewTweet_Button"]');
  const login1 = await page.$('a[href*="login"]');
  console.log(`🔍 Twitter.com - Compose: ${!!compose1}, Login: ${!!login1}`);
  
  // Test x.com
  console.log('🌐 Testing x.com...');
  await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  const title2 = await page.title();
  const url2 = page.url();
  console.log(`📄 X.com - Title: "${title2}", URL: ${url2}`);
  
  // Check for login indicators
  const compose2 = await page.$('[data-testid="SideNav_NewTweet_Button"]');
  const login2 = await page.$('a[href*="login"]');
  console.log(`🔍 X.com - Compose: ${!!compose2}, Login: ${!!login2}`);
  
  // Take screenshots
  await page.screenshot({ path: '/tmp/session-test.png', fullPage: true });
  console.log('📸 Screenshot saved to /tmp/session-test.png');
  
  await browser.close();
  
  const loggedIn = (compose1 || compose2) && !(login1 && login2);
  console.log(`\n${loggedIn ? '✅' : '❌'} Overall result: ${loggedIn ? 'LOGGED IN' : 'NOT LOGGED IN'}`);
}

testSession().catch(console.error);
