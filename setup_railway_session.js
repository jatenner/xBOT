/**
 * 🚄 RAILWAY SESSION SETUP
 * 
 * One-time setup script to create Twitter session for Railway deployment
 * This creates a base64 encoded session that can be set as an environment variable
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function setupRailwaySession() {
  console.log('🚄 RAILWAY_SETUP: Setting up Twitter session for Railway deployment...');
  
  let browser = null;
  let context = null;
  
  try {
    // Launch browser with visible interface for manual login
    browser = await chromium.launch({ 
      headless: false,
      args: ['--no-sandbox', '--disable-web-security']
    });
    
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    
    const page = await context.newPage();
    
    console.log('🌐 RAILWAY_SETUP: Opening Twitter login page...');
    await page.goto('https://x.com/login', { waitUntil: 'domcontentloaded' });
    
    console.log('🔑 RAILWAY_SETUP: Please complete the following steps:');
    console.log('   1. Log into your Twitter account in the browser');
    console.log('   2. Navigate to your Twitter home timeline');
    console.log('   3. Ensure you can see the "Post" button');
    console.log('   4. Press ENTER in this terminal when ready...');
    
    // Wait for user to complete login
    await new Promise(resolve => {
      process.stdin.once('data', () => {
        console.log('✅ RAILWAY_SETUP: Proceeding with session capture...');
        resolve();
      });
    });
    
    // Verify login by checking for the new tweet button
    console.log('🔍 RAILWAY_SETUP: Verifying login status...');
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    
    const isLoggedIn = await page.locator('[data-testid="SideNav_NewTweet_Button"]').isVisible({ timeout: 10000 });
    
    if (!isLoggedIn) {
      console.error('❌ RAILWAY_SETUP: Login verification failed. Please ensure you are logged in and try again.');
      return;
    }
    
    console.log('✅ RAILWAY_SETUP: Login verified successfully!');
    
    // Capture session cookies
    const cookies = await context.cookies();
    const sessionData = {
      cookies: cookies,
      timestamp: Date.now(),
      isValid: true
    };
    
    // Save session locally
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    const sessionPath = path.join(dataDir, 'twitter_session.json');
    fs.writeFileSync(sessionPath, JSON.stringify(sessionData, null, 2));
    console.log('✅ RAILWAY_SETUP: Session saved locally to data/twitter_session.json');
    
    // Create base64 encoded version for Railway environment variable
    const sessionB64 = Buffer.from(JSON.stringify(sessionData)).toString('base64');
    
    console.log('\\n🚄 RAILWAY_SETUP: Session setup complete!');
    console.log('\\n📋 NEXT STEPS:');
    console.log('   1. Copy the base64 session below');
    console.log('   2. Set it as TWITTER_SESSION_B64 environment variable in Railway');
    console.log('   3. Deploy your bot to Railway');
    console.log('\\n🔑 TWITTER_SESSION_B64 (copy this entire value):');
    console.log('----------------------------------------');
    console.log(sessionB64);
    console.log('----------------------------------------');
    
    // Save to file for easy copying
    const envPath = path.join(process.cwd(), 'railway_session.env');
    fs.writeFileSync(envPath, `TWITTER_SESSION_B64=${sessionB64}\\n`);
    console.log('\\n💾 RAILWAY_SETUP: Session also saved to railway_session.env file');
    
    console.log('\\n✅ RAILWAY_SETUP: Your bot is now ready for 24/7 Railway deployment!');
    
  } catch (error) {
    console.error('❌ RAILWAY_SETUP: Setup failed:', error.message);
  } finally {
    if (context) await context.close();
    if (browser) await browser.close();
  }
}

// Run the setup
setupRailwaySession().catch(console.error);

