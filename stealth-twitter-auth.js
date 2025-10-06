const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SESSION_PATH = '/Users/jonahtenner/Desktop/xBOT/data/twitter_session.json';

// Advanced human-like behavior patterns
const HUMAN_BEHAVIORS = {
  typing: {
    minDelay: 50,
    maxDelay: 150,
    mistakes: 0.02, // 2% chance of typos
    corrections: 0.8 // 80% chance to correct typos
  },
  mouse: {
    humanLike: true,
    randomOffset: 5,
    steps: 10
  },
  timing: {
    minActionDelay: 800,
    maxActionDelay: 2500,
    readingTime: 1500
  }
};

// Real browser fingerprints from actual users
const REAL_FINGERPRINTS = [
  {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
    locale: 'en-US',
    timezone: 'America/New_York'
  },
  {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    viewport: { width: 1680, height: 1050 },
    locale: 'en-US',
    timezone: 'America/Los_Angeles'
  },
  {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US',
    timezone: 'America/Chicago'
  }
];

// Advanced stealth techniques
async function applyUltimateStealthMode(page, context) {
  console.log('🥷 Applying ULTIMATE stealth mode...');
  
  // 1. Override WebDriver detection
  await page.addInitScript(() => {
    // Remove webdriver property
    delete Object.getPrototypeOf(navigator).webdriver;
    
    // Override chrome detection
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
    
    // Mock chrome object
    window.chrome = {
      runtime: {},
      loadTimes: function() {},
      csi: function() {},
      app: {}
    };
    
    // Override permissions
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) => (
      parameters.name === 'notifications' ?
        Promise.resolve({ state: Notification.permission }) :
        originalQuery(parameters)
    );
    
    // Override plugins
    Object.defineProperty(navigator, 'plugins', {
      get: () => [
        {
          0: {type: "application/x-google-chrome-pdf", suffixes: "pdf", description: "Portable Document Format"},
          description: "Portable Document Format",
          filename: "internal-pdf-viewer",
          length: 1,
          name: "Chrome PDF Plugin"
        },
        {
          0: {type: "application/pdf", suffixes: "pdf", description: ""},
          description: "",
          filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai",
          length: 1,
          name: "Chrome PDF Viewer"
        }
      ]
    });
    
    // Override languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en']
    });
    
    // Mock battery API
    Object.defineProperty(navigator, 'getBattery', {
      get: () => () => Promise.resolve({
        charging: true,
        chargingTime: 0,
        dischargingTime: Infinity,
        level: 0.99
      })
    });
  });
  
  // 2. Inject realistic mouse movements
  await page.addInitScript(() => {
    let mouseX = 0, mouseY = 0;
    
    // Track mouse position
    document.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    }, true);
    
    // Add subtle mouse jitter
    setInterval(() => {
      if (Math.random() < 0.1) { // 10% chance every interval
        const event = new MouseEvent('mousemove', {
          clientX: mouseX + (Math.random() - 0.5) * 2,
          clientY: mouseY + (Math.random() - 0.5) * 2,
          bubbles: true
        });
        document.dispatchEvent(event);
      }
    }, 1000);
  });
  
  // 3. Add realistic timing variations
  const originalClick = page.click;
  page.click = async (selector, options = {}) => {
    // Human-like delay before clicking
    await humanDelay(HUMAN_BEHAVIORS.timing.minActionDelay, HUMAN_BEHAVIORS.timing.maxActionDelay);
    
    // Move mouse to element first
    await page.hover(selector);
    await humanDelay(100, 300);
    
    return originalClick.call(page, selector, options);
  };
  
  // 4. Override typing to be human-like
  const originalType = page.type;
  page.type = async (selector, text, options = {}) => {
    await page.focus(selector);
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      
      // Simulate typos
      if (Math.random() < HUMAN_BEHAVIORS.typing.mistakes) {
        const wrongChar = String.fromCharCode(char.charCodeAt(0) + (Math.random() > 0.5 ? 1 : -1));
        await page.keyboard.type(wrongChar);
        await humanDelay(50, 150);
        
        // Correct the typo
        if (Math.random() < HUMAN_BEHAVIORS.typing.corrections) {
          await page.keyboard.press('Backspace');
          await humanDelay(100, 200);
        }
      }
      
      await page.keyboard.type(char);
      await humanDelay(HUMAN_BEHAVIORS.typing.minDelay, HUMAN_BEHAVIORS.typing.maxDelay);
    }
  };
  
  console.log('✅ Ultimate stealth mode applied');
}

// Human-like delay function
function humanDelay(min, max) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
}

// Advanced browser setup with maximum stealth
async function createStealthBrowser() {
  console.log('🚀 Creating ULTIMATE stealth browser...');
  
  // Select random fingerprint
  const fingerprint = REAL_FINGERPRINTS[Math.floor(Math.random() * REAL_FINGERPRINTS.length)];
  console.log(`🎭 Using fingerprint: ${fingerprint.userAgent.slice(0, 50)}...`);
  
  const browser = await chromium.launch({
    headless: false, // Keep visible for debugging
    args: [
      // Basic stealth args
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      
      // Advanced anti-detection
      '--disable-blink-features=AutomationControlled',
      '--disable-features=VizDisplayCompositor,TranslateUI',
      '--disable-extensions-http-throttling',
      '--disable-ipc-flooding-protection',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--disable-client-side-phishing-detection',
      '--disable-component-extensions-with-background-pages',
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-features=Translate',
      '--disable-hang-monitor',
      '--disable-popup-blocking',
      '--disable-prompt-on-repost',
      '--disable-sync',
      '--disable-web-security',
      '--metrics-recording-only',
      '--no-default-browser-check',
      '--safebrowsing-disable-auto-update',
      '--enable-automation=false',
      '--password-store=basic',
      '--use-mock-keychain',
      
      // Realistic window size
      `--window-size=${fingerprint.viewport.width},${fingerprint.viewport.height}`,
      
      // Memory and performance
      '--max_old_space_size=4096',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      
      // Network
      '--aggressive-cache-discard',
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-sync',
      '--dns-prefetch-disable',
    ]
  });
  
  const context = await browser.newContext({
    userAgent: fingerprint.userAgent,
    viewport: fingerprint.viewport,
    locale: fingerprint.locale,
    timezoneId: fingerprint.timezone,
    
    // Advanced fingerprinting resistance
    permissions: ['geolocation', 'notifications'],
    geolocation: { longitude: -74.006, latitude: 40.7128 }, // NYC
    colorScheme: 'light',
    reducedMotion: 'no-preference',
    forcedColors: 'none',
    
    // Realistic device specs
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
    
    // Headers that match real browsers
    extraHTTPHeaders: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0'
    }
  });
  
  const page = await context.newPage();
  
  // Apply ultimate stealth mode
  await applyUltimateStealthMode(page, context);
  
  console.log('✅ ULTIMATE stealth browser created');
  return { browser, context, page };
}

// Advanced human-like login sequence
async function performHumanLogin(page, username, password) {
  console.log('🧑‍💻 Starting HUMAN-LIKE login sequence...');
  
  try {
    // Navigate like a real user
    console.log('🌐 Navigating to Twitter...');
    await page.goto('https://twitter.com', { waitUntil: 'networkidle' });
    await humanDelay(2000, 4000); // Look around like a human
    
    // Check if already logged in
    try {
      await page.waitForSelector('[data-testid="SideNav_NewTweet_Button"]', { timeout: 3000 });
      console.log('✅ Already logged in!');
      return true;
    } catch {
      console.log('📝 Need to log in...');
    }
    
    // Look for sign in button
    const signInButton = await page.locator('a[href="/login"], [data-testid="loginButton"], text="Sign in"').first();
    if (await signInButton.isVisible()) {
      console.log('🔍 Found sign in button, clicking...');
      await signInButton.click();
      await humanDelay(1500, 3000);
    }
    
    // Wait for login form
    await page.waitForSelector('input[name="text"], input[autocomplete="username"]', { timeout: 10000 });
    console.log('📝 Login form loaded');
    
    // Human-like form filling
    console.log('⌨️ Typing username...');
    const usernameField = page.locator('input[name="text"], input[autocomplete="username"]').first();
    await usernameField.click();
    await humanDelay(500, 1000);
    await page.type('input[name="text"], input[autocomplete="username"]', username);
    
    // Click Next button
    await humanDelay(1000, 2000);
    const nextButton = page.locator('button:has-text("Next"), [role="button"]:has-text("Next")').first();
    await nextButton.click();
    
    // Wait for password field
    await page.waitForSelector('input[name="password"], input[type="password"]', { timeout: 10000 });
    console.log('🔐 Password field loaded');
    
    await humanDelay(1000, 2000);
    console.log('⌨️ Typing password...');
    const passwordField = page.locator('input[name="password"], input[type="password"]').first();
    await passwordField.click();
    await humanDelay(500, 1000);
    await page.type('input[name="password"], input[type="password"]', password);
    
    // Submit login
    await humanDelay(1500, 2500);
    const loginButton = page.locator('button[data-testid="LoginForm_Login_Button"], button:has-text("Log in")').first();
    await loginButton.click();
    
    // Wait for login to complete
    console.log('⏳ Waiting for login to complete...');
    try {
      await page.waitForSelector('[data-testid="SideNav_NewTweet_Button"], [data-testid="primaryColumn"]', { timeout: 15000 });
      console.log('✅ Login successful!');
      
      // Human-like post-login behavior
      await humanDelay(2000, 4000);
      await page.mouse.move(Math.random() * 500 + 200, Math.random() * 300 + 200);
      
      return true;
    } catch (error) {
      console.error('❌ Login failed:', error.message);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Login sequence failed:', error.message);
    return false;
  }
}

// Save complete session with all cookies
async function saveCompleteSession(context) {
  console.log('💾 Saving complete session...');
  
  try {
    const cookies = await context.cookies();
    console.log(`🍪 Captured ${cookies.length} cookies`);
    
    // Normalize cookies for both domains
    const normalizedCookies = [];
    cookies.forEach(cookie => {
      // Add for .twitter.com
      normalizedCookies.push({
        ...cookie,
        domain: '.twitter.com'
      });
      // Add for .x.com
      normalizedCookies.push({
        ...cookie,
        domain: '.x.com'
      });
    });
    
    const sessionData = {
      cookies: normalizedCookies,
      origins: []
    };
    
    // Save to file
    fs.writeFileSync(SESSION_PATH, JSON.stringify(sessionData, null, 2));
    console.log(`✅ Session saved to ${SESSION_PATH}`);
    console.log(`📊 Total cookies saved: ${normalizedCookies.length}`);
    
    return true;
  } catch (error) {
    console.error('❌ Failed to save session:', error.message);
    return false;
  }
}

// Main execution
async function main() {
  console.log('🎯 ULTIMATE STEALTH TWITTER AUTHENTICATION');
  console.log('==========================================');
  
  const { browser, context, page } = await createStealthBrowser();
  
  try {
    // Get credentials
    const username = process.env.X_USERNAME || process.argv[2];
    const password = process.env.X_PASSWORD || process.argv[3];
    
    if (!username || !password) {
      console.log('📝 Please provide credentials:');
      console.log('Usage: node stealth-twitter-auth.js <username> <password>');
      console.log('Or set X_USERNAME and X_PASSWORD environment variables');
      process.exit(1);
    }
    
    console.log(`🔐 Attempting login for: ${username}`);
    
    const loginSuccess = await performHumanLogin(page, username, password);
    
    if (loginSuccess) {
      console.log('🎉 Login successful! Saving session...');
      await saveCompleteSession(context);
      console.log('✅ Complete! Session saved and ready for use.');
    } else {
      console.log('❌ Login failed. Please check credentials and try again.');
    }
    
    // Keep browser open for a moment to see results
    console.log('🔍 Keeping browser open for 10 seconds...');
    await humanDelay(10000, 10000);
    
  } catch (error) {
    console.error('💥 Fatal error:', error.message);
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { createStealthBrowser, performHumanLogin, saveCompleteSession };
