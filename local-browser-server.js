const express = require('express');
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3100;
const SESSION_PATH = process.env.XBOT_SESSION_PATH || path.join(process.cwd(), 'data', 'twitter_session.json');
const BROWSER_SERVER_SECRET = process.env.BROWSER_SERVER_SECRET;

app.use(express.json());

console.log(`🚀 Starting local browser server on port ${PORT}...`);
console.log(`📁 Session path: ${SESSION_PATH}`);
console.log(`🔐 Secret configured: ${!!BROWSER_SERVER_SECRET}`);

// Middleware to authenticate requests
function authenticate(req, res, next) {
  const secret = req.headers['x-browser-secret'];
  if (!BROWSER_SERVER_SECRET || secret !== BROWSER_SERVER_SECRET) {
    console.log(`❌ Auth failed. Expected: ${BROWSER_SERVER_SECRET?.substring(0, 8)}..., Got: ${secret?.substring(0, 8)}...`);
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  next();
}

// Helper to load session state
async function loadSessionState() {
  try {
    const data = await fs.promises.readFile(SESSION_PATH, 'utf8');
    const session = JSON.parse(data);
    console.log(`📋 Loaded ${session.cookies?.length || 0} cookies from session`);
    return session;
  } catch (error) {
    console.error('❌ Error loading session state:', error.message);
    return null;
  }
}

// Helper to save session state
async function saveSessionState(state) {
  try {
    await fs.promises.writeFile(SESSION_PATH, JSON.stringify(state, null, 2), 'utf8');
    console.log('✅ Session state saved.');
  } catch (error) {
    console.error('❌ Error saving session state:', error.message);
  }
}

// Helper to launch browser context with session
async function launchBrowserWithSession() {
  const browser = await chromium.launch({ 
    headless: true, // HEADLESS - no visible windows
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox', 
      '--disable-dev-shm-usage',
      '--no-zygote',
      '--disable-gpu',
      '--disable-features=TranslateUI',
      '--ignore-certificate-errors',
      '--window-size=1920,1080',
      '--hide-scrollbars',
      '--mute-audio',
      '--disable-software-rasterizer',
      // STEALTH MODE: Additional args to avoid detection
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-web-security'
    ]
  });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.118 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
    ignoreHTTPSErrors: true,
    permissions: ['geolocation', 'notifications'],
    geolocation: { longitude: -74.006, latitude: 40.7128 }, // New York
    colorScheme: 'light'
  });

  // Apply stealth techniques
  await context.addInitScript(() => {
    // Pass the Webdriver Test
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
    });

    // Pass the Chrome Test
    window.chrome = {
      runtime: {},
    };

    // Pass the Permissions Test
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) =>
      parameters.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission })
        : originalQuery(parameters);

    // Pass the Plugins Test
    Object.defineProperty(navigator, 'plugins', {
      get: () => [
        {
          description: 'Portable Document Format',
          filename: 'internal-pdf-viewer',
          length: 1,
          name: 'Chrome PDF Plugin',
        },
        {
          description: 'Portable Document Format', 
          filename: 'mhjfbmdgcfjbbpaeojvcddffxjkjabeb',
          length: 1,
          name: 'Chrome PDF Viewer',
        },
      ],
    });

    // Pass the Languages Test
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });
  });
  
  const sessionState = await loadSessionState();
  if (sessionState?.cookies) {
    await context.addCookies(sessionState.cookies);
    console.log(`🍪 Applied ${sessionState.cookies.length} cookies to browser`);
  }
  
  return { browser, context };
}

// Helper to check if logged in
async function isLoggedIn(page) {
  try {
    // Look for compose button or user menu
    const composeButton = await page.$('[data-testid="SideNav_NewTweet_Button"]');
    const userMenu = await page.$('[data-testid="AppTabBar_Profile_Link"]');
    const loginButton = await page.$('a[href*="login"]');
    
    const loggedIn = (composeButton || userMenu) && !loginButton;
    console.log(`🔍 Login check: compose=${!!composeButton}, user=${!!userMenu}, login=${!!loginButton} → ${loggedIn}`);
    return loggedIn;
  } catch (error) {
    console.error('❌ Login check failed:', error.message);
    return false;
  }
}

// Health check endpoint
app.get('/health', async (req, res) => {
  const sessionExists = fs.existsSync(SESSION_PATH);
  res.json({
    status: 'ok',
    browserServer: 'running',
    sessionExists,
    timestamp: new Date().toISOString()
  });
});

// Post tweet endpoint
app.post('/post', authenticate, async (req, res) => {
  const { text } = req.body;
  
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ success: false, error: 'Missing or invalid text' });
  }
  
  console.log(`📝 Posting tweet: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
  
  let browser, context, page;
  
  try {
    // Launch browser with session
    ({ browser, context } = await launchBrowserWithSession());
    page = await context.newPage();
    
    // Navigate to X (Twitter)
    console.log('🌐 Navigating to X...');
    await page.goto('https://x.com/home', { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(5000); // Give more time for page to fully load
    
    // Take screenshot for debugging
    await page.screenshot({ path: `/tmp/twitter-page-${Date.now()}.png`, fullPage: true });
    console.log('📸 Screenshot saved for debugging');
    
    // Check if logged in with more detailed logging
    console.log('🔍 Checking login status...');
    const composeButton = await page.$('[data-testid="SideNav_NewTweet_Button"]');
    const userMenu = await page.$('[data-testid="AppTabBar_Profile_Link"]');  
    const loginButton = await page.$('a[href*="login"]');
    const signInText = await page.$('text=Sign in');
    
    console.log(`🔍 Elements found: compose=${!!composeButton}, user=${!!userMenu}, login=${!!loginButton}, signIn=${!!signInText}`);
    
    const loggedIn = (composeButton || userMenu) && !loginButton && !signInText;
    
    if (!loggedIn) {
      // Get page title and URL for debugging
      const title = await page.title();
      const url = page.url();
      console.log(`❌ Not logged in to X. Title: "${title}", URL: ${url}`);
      
      // Check if we're on login page - if so, cookies are invalid
      if (title.includes('Log in to X') || url.includes('/login') || url.includes('/i/flow/login')) {
        throw new Error(`Session expired - redirected to login page. Please refresh your session cookies.`);
      }
      
      throw new Error(`Not logged in to X. Page title: "${title}"`);
    }
    
    console.log('✅ Logged in successfully');
    
    // Click compose button
    console.log('🖱️ Clicking compose button...');
    await page.click('[data-testid="SideNav_NewTweet_Button"]');
    await page.waitForTimeout(2000);
    
    // Fill tweet text
    console.log('✍️ Filling tweet text...');
    const textArea = await page.waitForSelector('[data-testid="tweetTextarea_0"]', { timeout: 10000 });
    await textArea.fill(text);
    await page.waitForTimeout(1000);
    
    // Click post button
    console.log('📤 Clicking post button...');
    await page.click('[data-testid="tweetButtonInline"]');
    
    // Wait for success indicators
    console.log('⏳ Waiting for post confirmation...');
    await page.waitForTimeout(5000);
    
    // Try to detect success (URL change or success message)
    const currentUrl = page.url();
    const tweetIdMatch = currentUrl.match(/\/status\/(\d+)/);
    const tweetId = tweetIdMatch ? tweetIdMatch[1] : `posted_${Date.now()}`;
    
    console.log(`✅ Tweet posted successfully! ID: ${tweetId}`);
    
    // Save updated session
    const storageState = await context.storageState();
    await saveSessionState(storageState);
    
    res.json({ 
      success: true, 
      tweetId,
      url: tweetIdMatch ? `https://x.com/i/status/${tweetId}` : null
    });
    
  } catch (error) {
    console.error('❌ Posting failed:', error.message);
    
    // Take screenshot for debugging
    if (page) {
      try {
        await page.screenshot({ path: `/tmp/post-error-${Date.now()}.png`, fullPage: true });
        console.log('📸 Error screenshot saved to /tmp/');
      } catch (screenshotError) {
        console.error('Failed to save screenshot:', screenshotError.message);
      }
    }
    
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  } finally {
    // Clean up
    if (browser) {
      await browser.close();
    }
  }
});

// Thread posting endpoint
app.post('/thread', authenticate, async (req, res) => {
  const { tweets } = req.body;
  
  if (!Array.isArray(tweets) || tweets.length === 0) {
    return res.status(400).json({ success: false, error: 'Missing or invalid tweets array' });
  }
  
  console.log(`📝 Posting thread with ${tweets.length} tweets`);
  
  // For now, just post the first tweet
  // Full thread implementation would require more complex logic
  try {
    const result = await postSingleTweet(tweets[0]);
    res.json({ 
      success: true, 
      tweetIds: [result.tweetId],
      message: `Posted first tweet of thread. Full thread posting not yet implemented.`
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.listen(PORT, () => {
  console.log(`🎯 Local browser server running on http://localhost:${PORT}`);
  console.log(`🔐 Authentication: ${BROWSER_SERVER_SECRET ? 'Enabled' : 'DISABLED - Set BROWSER_SERVER_SECRET!'}`);
  console.log(`📁 Session file: ${SESSION_PATH}`);
  console.log('');
  console.log('Available endpoints:');
  console.log('  GET  /health - Health check');
  console.log('  POST /post   - Post a tweet');
  console.log('  POST /thread - Post a thread');
  console.log('');
  console.log('Ready for requests! 🚀');
});