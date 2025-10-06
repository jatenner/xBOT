const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

/**
 * 🥷 ULTIMATE X.COM SESSION GRABBER
 * Maximum stealth configuration to bypass X's login detection
 */

async function createUltimateStealthSession() {
  console.log('🥷 ULTIMATE X.com Session Grabber Starting...');
  console.log('🛡️ Maximum stealth configuration enabled');
  console.log('🎯 Designed to bypass X.com login detection');
  
  // Use a real user data directory to persist browser state
  const userDataDir = path.join(__dirname, '.browser-profile');
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  console.log('🚀 Launching ultra-stealth browser...');
  
  // Launch persistent context (most realistic)
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false, // Keep visible for manual login
    chromiumSandbox: false,
    
    // Use the most recent realistic user agent
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    
    viewport: { width: 1440, height: 900 }, // Mac-like viewport
    locale: 'en-US',
    timezoneId: 'America/New_York',
    
    // Realistic device settings
    deviceScaleFactor: 2, // Retina display
    isMobile: false,
    hasTouch: false,
    
    // Security settings
    ignoreHTTPSErrors: true,
    acceptDownloads: true,
    
    // Permissions (realistic for a real browser)
    permissions: ['geolocation', 'notifications', 'camera', 'microphone'],
    geolocation: { longitude: -74.006, latitude: 40.7128 }, // New York
    
    colorScheme: 'light',
    reducedMotion: 'no-preference',
    forcedColors: 'none',
    
    // Ultra-stealth browser args
    args: [
      // Basic stealth
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      
      // Remove automation signatures
      '--disable-blink-features=AutomationControlled',
      '--exclude-switches=enable-automation',
      '--disable-extensions-except=',
      '--disable-extensions',
      '--disable-plugins-discovery',
      '--disable-plugins',
      
      // Disable detection features
      '--disable-features=VizDisplayCompositor,TranslateUI,BlinkGenPropertyTrees,IsolateOrigins,site-per-process',
      '--disable-ipc-flooding-protection',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--disable-client-side-phishing-detection',
      '--disable-component-extensions-with-background-pages',
      '--disable-default-apps',
      '--disable-hang-monitor',
      '--disable-prompt-on-repost',
      '--disable-sync',
      '--disable-web-security',
      
      // Performance and detection evasion
      '--metrics-recording-only',
      '--no-first-run',
      '--no-default-browser-check',
      '--safebrowsing-disable-auto-update',
      '--enable-automation=false',
      '--password-store=basic',
      '--use-mock-keychain',
      
      // Memory and process management
      '--memory-pressure-off',
      '--max_old_space_size=4096',
      '--no-zygote',
      '--disable-gpu',
      '--disable-software-rasterizer',
      
      // Network and security
      '--ignore-certificate-errors',
      '--ignore-ssl-errors',
      '--ignore-certificate-errors-spki-list',
      '--ignore-certificate-errors-skip-list',
      '--disable-features=VizDisplayCompositor',
      
      // UI and UX
      '--window-size=1440,900',
      '--hide-scrollbars',
      '--mute-audio',
      '--disable-infobars',
      '--disable-notifications',
      
      // Additional stealth flags
      '--disable-logging',
      '--disable-gpu-logging',
      '--silent-debugger-extension-api',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--disable-features=TranslateUI,BlinkGenPropertyTrees'
    ]
  });

  console.log('🛡️ Applying ultimate stealth techniques...');
  
  // Apply the most comprehensive stealth script
  await context.addInitScript(() => {
    // 1. Remove ALL webdriver traces
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
      configurable: true
    });
    
    // Delete webdriver properties
    delete navigator.__proto__.webdriver;
    delete navigator.webdriver;
    
    // Remove automation traces from window
    const automationProps = [
      '__webdriver_evaluate', '__selenium_evaluate', '__webdriver_script_function',
      '__webdriver_script_func', '__webdriver_script_fn', '__fxdriver_evaluate',
      '__driver_unwrapped', '__webdriver_unwrapped', '__driver_evaluate',
      '__selenium_unwrapped', '__fxdriver_unwrapped', '__webdriver_script_function',
      'webdriver', '__webdriver_evaluate', '__selenium_evaluate', '__webdriver_script_func'
    ];
    
    automationProps.forEach(prop => {
      try {
        delete window[prop];
        delete document[prop];
        delete navigator[prop];
      } catch (e) {}
    });

    // 2. Override chrome object with ultra-realistic properties
    Object.defineProperty(window, 'chrome', {
      writable: true,
      enumerable: true,
      configurable: false,
      value: {
        app: {
          isInstalled: false,
          InstallState: {
            DISABLED: 'disabled',
            INSTALLED: 'installed',
            NOT_INSTALLED: 'not_installed'
          },
          RunningState: {
            CANNOT_RUN: 'cannot_run',
            READY_TO_RUN: 'ready_to_run',
            RUNNING: 'running'
          }
        },
        runtime: {
          onConnect: null,
          onMessage: null,
          onStartup: null,
          onInstalled: null,
          onSuspend: null,
          onSuspendCanceled: null,
          onUpdateAvailable: null,
          onBrowserUpdateAvailable: null,
          onRestartRequired: null,
          onPerformanceWarning: null,
          connect: function() {},
          sendMessage: function() {},
          getURL: function(path) { return 'chrome-extension://invalid/' + path; },
          getManifest: function() { return {}; },
          reload: function() {},
          requestUpdateCheck: function() {},
          restart: function() {},
          restartAfterDelay: function() {},
          connectNative: function() {},
          sendNativeMessage: function() {},
          getPlatformInfo: function() {},
          getPackageDirectoryEntry: function() {}
        },
        loadTimes: function() {
          const now = Date.now() / 1000;
          return {
            requestTime: now - Math.random() * 10,
            startLoadTime: now - Math.random() * 5,
            commitLoadTime: now - Math.random() * 3,
            finishDocumentLoadTime: now - Math.random() * 2,
            finishLoadTime: now - Math.random(),
            firstPaintTime: now - Math.random(),
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
        }
      }
    });

    // 3. Mock realistic plugins
    Object.defineProperty(navigator, 'plugins', {
      get: () => {
        const plugins = [
          {
            0: { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' },
            description: 'Portable Document Format',
            filename: 'internal-pdf-viewer',
            length: 1,
            name: 'Chrome PDF Plugin'
          },
          {
            0: { type: 'application/x-google-chrome-pdf', suffixes: 'pdf', description: 'Portable Document Format' },
            description: 'Portable Document Format',
            filename: 'mhjfbmdgcfjbbpaaeojvcddffxjkjabeb',
            length: 1,
            name: 'Chrome PDF Viewer'
          },
          {
            0: { type: 'application/x-nacl', suffixes: '', description: 'Native Client Executable' },
            description: 'Native Client Executable',
            filename: 'internal-nacl-plugin',
            length: 2,
            name: 'Native Client'
          }
        ];
        
        // Add array methods
        plugins.item = function(index) { return this[index] || null; };
        plugins.namedItem = function(name) { 
          return Array.from(this).find(plugin => plugin.name === name) || null; 
        };
        plugins.refresh = function() {};
        
        return plugins;
      }
    });

    // 4. Mock languages realistically
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en']
    });

    // 5. Mock realistic connection
    Object.defineProperty(navigator, 'connection', {
      get: () => ({
        effectiveType: '4g',
        rtt: 50 + Math.random() * 50,
        downlink: 8 + Math.random() * 2,
        saveData: false,
        type: 'wifi',
        addEventListener: function() {},
        removeEventListener: function() {},
        dispatchEvent: function() { return true; }
      })
    });

    // 6. Mock battery API with realistic values
    if (navigator.getBattery) {
      navigator.getBattery = () => Promise.resolve({
        charging: Math.random() > 0.3,
        chargingTime: Math.random() > 0.5 ? 0 : Math.random() * 7200,
        dischargingTime: Math.random() * 28800 + 3600,
        level: 0.7 + Math.random() * 0.3,
        addEventListener: function() {},
        removeEventListener: function() {},
        dispatchEvent: function() { return true; }
      });
    }

    // 7. Mock media devices
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices = function() {
        return Promise.resolve([
          { deviceId: 'default', groupId: 'group1', kind: 'audioinput', label: 'Default - MacBook Air Microphone' },
          { deviceId: 'default', groupId: 'group2', kind: 'audiooutput', label: 'Default - MacBook Air Speakers' },
          { deviceId: 'default', groupId: 'group3', kind: 'videoinput', label: 'FaceTime HD Camera' }
        ]);
      };
    }

    // 8. Override permissions
    if (navigator.permissions && navigator.permissions.query) {
      const originalQuery = navigator.permissions.query;
      navigator.permissions.query = function(parameters) {
        const permission = parameters.name;
        if (permission === 'notifications') {
          return Promise.resolve({ state: 'denied' });
        } else if (permission === 'geolocation') {
          return Promise.resolve({ state: 'granted' });
        }
        return originalQuery.call(this, parameters);
      };
    }

    // 9. Override toString methods to hide automation
    const originalToString = Function.prototype.toString;
    Function.prototype.toString = function() {
      if (this === navigator.webdriver) {
        return 'function webdriver() { [native code] }';
      }
      if (this.toString === Function.prototype.toString) {
        return 'function toString() { [native code] }';
      }
      return originalToString.call(this);
    };

    // 10. Mock screen properties realistically
    Object.defineProperties(screen, {
      availTop: { get: () => 0 },
      availLeft: { get: () => 0 },
      availWidth: { get: () => 1440 },
      availHeight: { get: () => 875 },
      colorDepth: { get: () => 24 },
      pixelDepth: { get: () => 24 }
    });

    // 11. Add realistic timing
    const originalDateNow = Date.now;
    Date.now = function() {
      return originalDateNow() + Math.floor(Math.random() * 10 - 5);
    };

    // 12. Mock performance API
    if (window.performance && window.performance.now) {
      const originalPerformanceNow = window.performance.now;
      window.performance.now = function() {
        return originalPerformanceNow.call(this) + Math.random() * 0.1;
      };
    }

    console.log('🛡️ Ultimate stealth mode activated');
  });
  
  const page = await context.newPage();
  
  // Set additional realistic headers
  await page.setExtraHTTPHeaders({
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-User': '?1',
    'Sec-Fetch-Dest': 'document',
    'Cache-Control': 'max-age=0'
  });
  
  console.log('🌐 Opening X.com with maximum stealth...');
  
  // Navigate with realistic timing
  await page.goto('https://x.com/login', { 
    waitUntil: 'networkidle',
    timeout: 60000 
  });
  
  // Add some realistic delay
  await page.waitForTimeout(2000 + Math.random() * 3000);
  
  console.log('');
  console.log('🥷 ULTIMATE STEALTH LOGIN INSTRUCTIONS:');
  console.log('   ✅ Browser launched with maximum anti-detection');
  console.log('   ✅ All automation signatures removed');
  console.log('   ✅ Realistic browser fingerprint applied');
  console.log('');
  console.log('   📝 STEPS:');
  console.log('   1. The browser should now allow you to log in normally');
  console.log('   2. Complete the login process (username, password, 2FA if needed)');
  console.log('   3. Navigate to your timeline and verify you can see tweets');
  console.log('   4. Make sure you can see the compose tweet button');
  console.log('   5. Press ENTER in this terminal when ready to capture session');
  console.log('');
  console.log('   🔍 If login still fails, X may be blocking your IP address');
  console.log('');
  
  // Wait for user input
  await new Promise(resolve => {
    process.stdin.once('data', () => resolve());
  });
  
  console.log('📋 Capturing ultimate stealth session...');
  
  // Get storage state
  const storageState = await context.storageState();
  
  // Enhance cookies for both domains
  const enhancedCookies = [];
  const seenCookies = new Set();
  
  for (const cookie of storageState.cookies) {
    if (cookie.domain.includes('x.com') || cookie.domain.includes('twitter.com')) {
      // Add for both domains
      const xCookie = { ...cookie, domain: '.x.com' };
      const twitterCookie = { ...cookie, domain: '.twitter.com' };
      
      const xKey = `${xCookie.name}|${xCookie.domain}|${xCookie.path || '/'}`;
      const twitterKey = `${twitterCookie.name}|${twitterCookie.domain}|${twitterCookie.path || '/'}`;
      
      if (!seenCookies.has(xKey)) {
        enhancedCookies.push(xCookie);
        seenCookies.add(xKey);
      }
      if (!seenCookies.has(twitterKey)) {
        enhancedCookies.push(twitterCookie);
        seenCookies.add(twitterKey);
      }
    } else {
      const key = `${cookie.name}|${cookie.domain}|${cookie.path || '/'}`;
      if (!seenCookies.has(key)) {
        enhancedCookies.push(cookie);
        seenCookies.add(key);
      }
    }
  }
  
  storageState.cookies = enhancedCookies;
  
  // Save to file
  const sessionPath = path.join(__dirname, 'data', 'twitter_session.json');
  fs.writeFileSync(sessionPath, JSON.stringify(storageState, null, 2));
  
  console.log(`✅ Ultimate stealth session saved to: ${sessionPath}`);
  console.log(`📊 Captured ${storageState.cookies.length} cookies`);
  
  // Validate important cookies
  const importantCookies = storageState.cookies.filter(c => 
    ['auth_token', 'ct0', 'twid', 'kdt', 'guest_id'].includes(c.name)
  );
  
  console.log('🔑 Critical auth cookies found:');
  const cookiesByName = {};
  importantCookies.forEach(cookie => {
    if (!cookiesByName[cookie.name]) cookiesByName[cookie.name] = [];
    cookiesByName[cookie.name].push(cookie.domain);
  });
  
  Object.entries(cookiesByName).forEach(([name, domains]) => {
    console.log(`   ✅ ${name}: ${domains.join(', ')}`);
  });
  
  if (importantCookies.length === 0) {
    console.log('❌ No critical auth cookies found - login may have failed');
    console.log('💡 Try logging in again or check if your account is restricted');
  } else {
    console.log('');
    console.log('🎉 SUCCESS! Ultimate stealth session captured!');
    console.log('✅ Your X automation should now work perfectly');
  }
  
  await context.close();
  
  console.log('');
  console.log('🚀 NEXT STEPS:');
  console.log('   1. Test your session: node test-x-automation.js');
  console.log('   2. Test posting: BROWSER_SERVER_SECRET="test123" node local-browser-server.js');
  console.log('   3. Start your bot: npm run start');
  console.log('');
  console.log('🛡️ Ultimate stealth session capture complete!');
}

createUltimateStealthSession().catch(console.error);
