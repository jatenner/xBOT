#!/usr/bin/env node

/**
 * 🧪 X.COM AUTOMATION TESTER
 * Comprehensive test suite for X (Twitter) browser automation
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SESSION_PATH = './data/twitter_session.json';
const TEST_RESULTS = [];

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : type === 'warning' ? '⚠️' : 'ℹ️';
  console.log(`${prefix} [${timestamp}] ${message}`);
}

function addResult(test, passed, message) {
  TEST_RESULTS.push({ test, passed, message, timestamp: new Date().toISOString() });
  log(`${test}: ${message}`, passed ? 'success' : 'error');
}

async function loadSession() {
  try {
    if (!fs.existsSync(SESSION_PATH)) {
      addResult('Session File Check', false, 'Session file not found');
      return null;
    }
    
    const data = JSON.parse(fs.readFileSync(SESSION_PATH, 'utf8'));
    const cookieCount = data.cookies?.length || 0;
    const authTokens = data.cookies?.filter(c => c.name === 'auth_token') || [];
    
    addResult('Session File Check', true, `Found ${cookieCount} cookies, ${authTokens.length} auth tokens`);
    return data;
  } catch (error) {
    addResult('Session File Check', false, `Error loading session: ${error.message}`);
    return null;
  }
}

async function createStealthBrowser() {
  try {
    const browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--no-zygote',
        '--disable-gpu',
        '--disable-features=TranslateUI,VizDisplayCompositor,IsolateOrigins,site-per-process',
        '--disable-blink-features=AutomationControlled',
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
        '--use-mock-keychain'
      ]
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'en-US',
      timezoneId: 'America/New_York',
      ignoreHTTPSErrors: true,
      permissions: ['geolocation', 'notifications'],
      geolocation: { longitude: -74.006, latitude: 40.7128 },
      colorScheme: 'light'
    });

    // Apply stealth techniques
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      
      // Remove automation traces
      delete window.__webdriver_evaluate;
      delete window.__selenium_evaluate;
      delete window.__webdriver_script_function;
      
      // Mock chrome
      window.chrome = {
        runtime: { onConnect: null, onMessage: null },
        loadTimes: function() { return {}; },
        csi: function() { return {}; },
        app: { isInstalled: false }
      };
      
      // Mock plugins
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          { description: 'Portable Document Format', filename: 'internal-pdf-viewer', length: 1, name: 'PDF Viewer' }
        ]
      });
      
      // Mock languages
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    });

    addResult('Browser Launch', true, 'Stealth browser created successfully');
    return { browser, context };
  } catch (error) {
    addResult('Browser Launch', false, `Failed to create browser: ${error.message}`);
    throw error;
  }
}

async function testSessionLoad(context, sessionData) {
  try {
    if (!sessionData?.cookies) {
      addResult('Session Load', false, 'No cookies in session data');
      return false;
    }

    await context.addCookies(sessionData.cookies);
    addResult('Session Load', true, `Applied ${sessionData.cookies.length} cookies to browser`);
    return true;
  } catch (error) {
    addResult('Session Load', false, `Failed to load session: ${error.message}`);
    return false;
  }
}

async function testXNavigation(context) {
  let page = null;
  try {
    page = await context.newPage();
    
    log('Navigating to X.com...');
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    const title = await page.title();
    const url = page.url();
    
    if (title.includes('Log in to X') || url.includes('/login')) {
      addResult('X Navigation', false, `Redirected to login page. Title: "${title}"`);
      return { success: false, page };
    }
    
    addResult('X Navigation', true, `Successfully loaded X.com. Title: "${title}"`);
    return { success: true, page };
  } catch (error) {
    addResult('X Navigation', false, `Navigation failed: ${error.message}`);
    return { success: false, page };
  }
}

async function testLoginStatus(page) {
  try {
    // Wait a bit for page to fully load
    await page.waitForTimeout(3000);
    
    // Test multiple login indicators
    const selectors = [
      '[data-testid="SideNav_NewTweet_Button"]',
      '[data-testid="tweetTextarea_0"]',
      '[data-testid="SideNav_AccountSwitcher_Button"]',
      '[aria-label*="Profile"]'
    ];
    
    let foundIndicator = null;
    for (const selector of selectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          const isVisible = await element.isVisible().catch(() => false);
          if (isVisible) {
            foundIndicator = selector;
            break;
          }
        }
      } catch (e) {
        // Continue checking
      }
    }
    
    if (foundIndicator) {
      addResult('Login Status', true, `Logged in - found indicator: ${foundIndicator}`);
      return true;
    } else {
      // Check for login indicators
      const loginSelectors = [
        'text=Sign in to X',
        'text=Log in',
        '[data-testid="loginButton"]'
      ];
      
      for (const selector of loginSelectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            addResult('Login Status', false, `Not logged in - found login element: ${selector}`);
            return false;
          }
        } catch (e) {
          // Continue checking
        }
      }
      
      addResult('Login Status', false, 'Could not determine login status - no indicators found');
      return false;
    }
  } catch (error) {
    addResult('Login Status', false, `Login check failed: ${error.message}`);
    return false;
  }
}

async function testComposeAccess(page) {
  try {
    const composeSelectors = [
      '[data-testid="SideNav_NewTweet_Button"]',
      '[aria-label="Post"]',
      'button:has-text("Post")'
    ];
    
    let composeButton = null;
    for (const selector of composeSelectors) {
      try {
        composeButton = await page.$(selector);
        if (composeButton) {
          await composeButton.click();
          await page.waitForTimeout(2000);
          
          // Check if compose dialog opened
          const textAreaSelectors = [
            '[data-testid="tweetTextarea_0"]',
            '[role="textbox"][aria-label*="Post"]',
            '[role="textbox"][placeholder*="What is happening"]'
          ];
          
          for (const textSelector of textAreaSelectors) {
            const textArea = await page.$(textSelector);
            if (textArea) {
              addResult('Compose Access', true, `Compose dialog opened successfully with selector: ${textSelector}`);
              return true;
            }
          }
          break;
        }
      } catch (e) {
        // Continue checking
      }
    }
    
    addResult('Compose Access', false, 'Could not open compose dialog');
    return false;
  } catch (error) {
    addResult('Compose Access', false, `Compose test failed: ${error.message}`);
    return false;
  }
}

async function testPostButtonAccess(page) {
  try {
    const postButtonSelectors = [
      '[data-testid="tweetButtonInline"]',
      '[data-testid="tweetButton"]',
      '[role="button"][aria-label*="Post"]',
      'button:has-text("Post")'
    ];
    
    for (const selector of postButtonSelectors) {
      try {
        const button = await page.$(selector);
        if (button) {
          const isEnabled = await button.isEnabled();
          addResult('Post Button Access', true, `Found post button: ${selector}, enabled: ${isEnabled}`);
          return true;
        }
      } catch (e) {
        // Continue checking
      }
    }
    
    addResult('Post Button Access', false, 'Could not find post button');
    return false;
  } catch (error) {
    addResult('Post Button Access', false, `Post button test failed: ${error.message}`);
    return false;
  }
}

async function runFullTest() {
  log('🧪 Starting X.com Automation Test Suite');
  log('=====================================');
  
  const sessionData = await loadSession();
  if (!sessionData) {
    log('❌ Cannot proceed without valid session data');
    return;
  }
  
  let browser = null;
  let context = null;
  let page = null;
  
  try {
    // Create browser
    ({ browser, context } = await createStealthBrowser());
    
    // Load session
    const sessionLoaded = await testSessionLoad(context, sessionData);
    if (!sessionLoaded) {
      log('❌ Cannot proceed without valid session');
      return;
    }
    
    // Test navigation
    const navResult = await testXNavigation(context);
    if (!navResult.success) {
      log('❌ Cannot proceed without successful navigation');
      return;
    }
    page = navResult.page;
    
    // Test login status
    const isLoggedIn = await testLoginStatus(page);
    if (!isLoggedIn) {
      log('❌ Not logged in - automation will not work');
      return;
    }
    
    // Test compose access
    await testComposeAccess(page);
    
    // Test post button access
    await testPostButtonAccess(page);
    
  } catch (error) {
    log(`❌ Test suite failed: ${error.message}`, 'error');
  } finally {
    if (page) await page.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
  
  // Print results
  log('');
  log('📊 TEST RESULTS SUMMARY');
  log('======================');
  
  const passed = TEST_RESULTS.filter(r => r.passed).length;
  const total = TEST_RESULTS.length;
  
  TEST_RESULTS.forEach(result => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    log(`${status} ${result.test}: ${result.message}`);
  });
  
  log('');
  log(`📈 Overall: ${passed}/${total} tests passed (${Math.round(passed/total*100)}%)`);
  
  if (passed === total) {
    log('🎉 All tests passed! Your X automation should work correctly.', 'success');
  } else {
    log('⚠️ Some tests failed. Check the issues above before running automation.', 'warning');
  }
  
  // Save detailed results
  const reportPath = './x-automation-test-report.json';
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: { passed, total, percentage: Math.round(passed/total*100) },
    results: TEST_RESULTS
  }, null, 2));
  
  log(`📄 Detailed report saved to: ${reportPath}`);
}

// Run the test
runFullTest().catch(console.error);
