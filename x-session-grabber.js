const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

/**
 * 🎯 X.COM SESSION GRABBER
 * Optimized specifically for X.com (Twitter) with enhanced stealth
 */

async function createXSession() {
  console.log('🚀 X.com Session Grabber Starting...');
  console.log('🎯 Optimized for X.com anti-bot systems');
  console.log('📝 This will open a browser where you can log in manually');
  console.log('⚡ After logging in, press ENTER in this terminal to capture the session');
  
  const browser = await chromium.launch({ 
    headless: false,
    args: [
      // Enhanced stealth args for X.com
      '--disable-blink-features=AutomationControlled',
      '--disable-features=VizDisplayCompositor,TranslateUI,IsolateOrigins,site-per-process',
      '--disable-web-security',
      '--disable-ipc-flooding-protection',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--disable-client-side-phishing-detection',
      '--disable-component-extensions-with-background-pages',
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-hang-monitor',
      '--disable-prompt-on-repost',
      '--disable-sync',
      '--metrics-recording-only',
      '--no-first-run',
      '--safebrowsing-disable-auto-update',
      '--enable-automation=false',
      '--password-store=basic',
      '--use-mock-keychain',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ]
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
    ignoreHTTPSErrors: true,
    permissions: ['geolocation', 'notifications'],
    geolocation: { longitude: -74.006, latitude: 40.7128 }, // New York
    colorScheme: 'light'
  });

  // Apply enhanced stealth techniques
  await context.addInitScript(() => {
    // Remove webdriver traces completely
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
    
    // Remove automation traces from window
    delete window.__webdriver_evaluate;
    delete window.__selenium_evaluate;
    delete window.__webdriver_script_function;
    delete window.__webdriver_script_func;
    delete window.__webdriver_script_fn;
    delete window.__fxdriver_evaluate;
    delete window.__driver_unwrapped;
    delete window.__webdriver_unwrapped;
    delete window.__driver_evaluate;
    delete window.__selenium_unwrapped;
    delete window.__fxdriver_unwrapped;

    // Mock chrome object with realistic properties
    window.chrome = {
      runtime: {
        onConnect: null,
        onMessage: null,
        connect: function() {},
        sendMessage: function() {},
        getURL: function() {},
        getManifest: function() { return {}; }
      },
      loadTimes: function() {
        return {
          requestTime: Date.now() / 1000 - Math.random() * 10,
          startLoadTime: Date.now() / 1000 - Math.random() * 5,
          commitLoadTime: Date.now() / 1000 - Math.random() * 3,
          finishDocumentLoadTime: Date.now() / 1000 - Math.random() * 2,
          finishLoadTime: Date.now() / 1000 - Math.random(),
          firstPaintTime: Date.now() / 1000 - Math.random(),
          firstPaintAfterLoadTime: 0,
          navigationType: 'Other'
        };
      },
      csi: function() {
        return {
          startE: Date.now() - Math.random() * 1000,
          onloadT: Date.now() - Math.random() * 500,
          pageT: Math.random() * 100,
          tran: 15
        };
      },
      app: {
        isInstalled: false
      }
    };

    // Mock realistic plugins
    Object.defineProperty(navigator, 'plugins', {
      get: () => [
        {
          0: { type: 'application/pdf' },
          description: 'Portable Document Format',
          filename: 'internal-pdf-viewer',
          length: 1,
          name: 'PDF Viewer',
        },
        {
          0: { type: 'application/x-google-chrome-pdf' },
          description: 'Portable Document Format',
          filename: 'internal-pdf-viewer',
          length: 1,
          name: 'Chrome PDF Viewer',
        },
      ],
    });

    // Mock languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });

    // Mock connection
    navigator.connection = {
      effectiveType: '4g',
      rtt: 50 + Math.random() * 50,
      downlink: 8 + Math.random() * 2,
      saveData: false
    };

    // Override permissions
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) =>
      parameters.name === 'notifications'
        ? Promise.resolve({ state: 'denied' })
        : originalQuery(parameters);

    // Mock battery API
    navigator.getBattery = () =>
      Promise.resolve({
        charging: Math.random() > 0.5,
        chargingTime: Math.random() > 0.5 ? 0 : Math.random() * 7200,
        dischargingTime: Math.random() * 28800 + 3600,
        level: 0.8 + Math.random() * 0.2
      });
  });
  
  const page = await context.newPage();
  
  console.log('🌐 Opening X.com...');
  await page.goto('https://x.com/home');
  
  console.log('');
  console.log('⚡ MANUAL LOGIN INSTRUCTIONS:');
  console.log('   1. Log into X in the browser window that just opened');
  console.log('   2. Make sure you can see your timeline (not login page)');
  console.log('   3. Verify you can see the compose tweet button');
  console.log('   4. Press ENTER in this terminal when ready');
  console.log('');
  
  // Wait for user input
  await new Promise(resolve => {
    process.stdin.once('data', () => resolve());
  });
  
  console.log('📋 Capturing X session state...');
  
  // Get storage state (includes all cookies, localStorage, etc.)
  const storageState = await context.storageState();
  
  // Ensure we have cookies for both domains
  const enhancedCookies = [];
  for (const cookie of storageState.cookies) {
    if (cookie.domain.includes('x.com') || cookie.domain.includes('twitter.com')) {
      // Add for both domains
      enhancedCookies.push({ ...cookie, domain: '.x.com' });
      enhancedCookies.push({ ...cookie, domain: '.twitter.com' });
    } else {
      enhancedCookies.push(cookie);
    }
  }
  
  // Deduplicate cookies
  const seen = new Set();
  storageState.cookies = enhancedCookies.filter(cookie => {
    const key = `${cookie.name}|${cookie.domain}|${cookie.path || '/'}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  
  // Save to file
  const sessionPath = path.join(__dirname, 'data', 'twitter_session.json');
  fs.writeFileSync(sessionPath, JSON.stringify(storageState, null, 2));
  
  console.log(`✅ Session saved to: ${sessionPath}`);
  console.log(`📊 Captured ${storageState.cookies.length} cookies`);
  
  // Show important cookies
  const importantCookies = storageState.cookies.filter(c => 
    ['auth_token', 'ct0', 'twid', 'kdt'].includes(c.name)
  );
  
  console.log('🔑 Important auth cookies found:');
  importantCookies.forEach(cookie => {
    console.log(`   - ${cookie.name} (${cookie.domain}): ${cookie.value.substring(0, 20)}...`);
  });
  
  if (importantCookies.length === 0) {
    console.log('⚠️  No critical auth cookies found - you may not be logged in');
  } else {
    console.log('✅ Session appears valid and ready for automation!');
  }
  
  await browser.close();
  console.log('✅ X session capture complete!');
  console.log('');
  console.log('🚀 Next steps:');
  console.log('   1. Test your session: npm run test:session');
  console.log('   2. Start posting: npm run post:now');
}

createXSession().catch(console.error);
