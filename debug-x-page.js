#!/usr/bin/env node

/**
 * 🔍 DEBUG X.COM PAGE
 * Detailed analysis of what's happening on the X.com page
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function debugXPage() {
  console.log('🔍 Starting X.com Page Debug...');
  
  const sessionPath = './data/twitter_session.json';
  
  // Load session
  let sessionData = null;
  try {
    sessionData = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
    console.log(`✅ Loaded ${sessionData.cookies?.length || 0} cookies`);
  } catch (error) {
    console.error('❌ Failed to load session:', error.message);
    return;
  }
  
  // Launch browser
  const browser = await chromium.launch({
    headless: false, // Keep visible for debugging
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=VizDisplayCompositor,TranslateUI',
      '--disable-web-security'
    ]
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 }
  });

  // Apply cookies
  await context.addCookies(sessionData.cookies);
  console.log('✅ Applied cookies to browser');

  const page = await context.newPage();
  
  console.log('🌐 Navigating to X.com...');
  await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
  
  // Wait for page to fully load
  await page.waitForTimeout(5000);
  
  // Get basic page info
  const title = await page.title();
  const url = page.url();
  
  console.log('📄 Page Info:');
  console.log(`   Title: "${title}"`);
  console.log(`   URL: ${url}`);
  
  // Check if redirected to login
  if (url.includes('/login') || url.includes('/i/flow/login') || title.includes('Log in to X')) {
    console.log('❌ Redirected to login page - cookies are invalid or expired');
    
    // Take screenshot
    await page.screenshot({ path: './debug-login-redirect.png', fullPage: true });
    console.log('📸 Screenshot saved: debug-login-redirect.png');
    
    await browser.close();
    return;
  }
  
  console.log('✅ Not redirected to login page');
  
  // Check for various login indicators
  const selectors = [
    '[data-testid="SideNav_NewTweet_Button"]',
    '[data-testid="tweetTextarea_0"]', 
    '[data-testid="SideNav_AccountSwitcher_Button"]',
    '[aria-label*="Profile"]',
    '[data-testid="AppTabBar_Profile_Link"]',
    '[role="button"][aria-label*="Post"]',
    '[data-testid="primaryColumn"]',
    '[data-testid="toolBar"]'
  ];
  
  console.log('🔍 Checking for login indicators...');
  const foundElements = {};
  
  for (const selector of selectors) {
    try {
      const element = await page.$(selector);
      foundElements[selector] = !!element;
      if (element) {
        const text = await element.textContent().catch(() => '');
        const isVisible = await element.isVisible().catch(() => false);
        console.log(`   ✅ ${selector}: visible=${isVisible}, text="${text.substring(0, 50)}"`);
      } else {
        console.log(`   ❌ ${selector}: not found`);
      }
    } catch (error) {
      console.log(`   ❌ ${selector}: error - ${error.message}`);
    }
  }
  
  // Check for login/logout indicators
  const loginSelectors = [
    'text=Sign in to X',
    'text=Log in',
    '[data-testid="loginButton"]',
    'a[href*="login"]',
    'text=Sign up'
  ];
  
  console.log('🔍 Checking for login page indicators...');
  for (const selector of loginSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        const isVisible = await element.isVisible().catch(() => false);
        console.log(`   ⚠️ ${selector}: visible=${isVisible} (indicates NOT logged in)`);
      }
    } catch (error) {
      // Ignore
    }
  }
  
  // Get page HTML for analysis
  console.log('📝 Analyzing page content...');
  const bodyText = await page.$eval('body', el => el.textContent).catch(() => '');
  
  if (bodyText.includes('Sign in to X') || bodyText.includes('Log in')) {
    console.log('❌ Page contains login text - not logged in');
  } else if (bodyText.includes('Home') || bodyText.includes('Timeline')) {
    console.log('✅ Page contains home/timeline text - likely logged in');
  } else {
    console.log('⚠️ Unclear login status from page text');
  }
  
  // Check for specific X.com elements
  console.log('🔍 Checking for X.com specific elements...');
  const xSelectors = [
    '[aria-label="X"]',
    '[data-testid="AppTabBar_Home_Link"]',
    '[data-testid="AppTabBar_Explore_Link"]',
    '[data-testid="AppTabBar_Notifications_Link"]'
  ];
  
  for (const selector of xSelectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        console.log(`   ✅ ${selector}: found`);
      }
    } catch (error) {
      // Ignore
    }
  }
  
  // Take screenshot for manual inspection
  await page.screenshot({ path: './debug-x-page.png', fullPage: true });
  console.log('📸 Screenshot saved: debug-x-page.png');
  
  // Get all elements with data-testid for analysis
  console.log('🔍 Finding all data-testid elements...');
  const testIds = await page.$$eval('[data-testid]', elements => 
    elements.map(el => el.getAttribute('data-testid')).filter(Boolean)
  );
  
  const uniqueTestIds = [...new Set(testIds)].sort();
  console.log('📋 Found data-testid elements:');
  uniqueTestIds.slice(0, 20).forEach(id => console.log(`   - ${id}`));
  if (uniqueTestIds.length > 20) {
    console.log(`   ... and ${uniqueTestIds.length - 20} more`);
  }
  
  // Wait for user to inspect
  console.log('');
  console.log('🔍 Browser window is open for manual inspection');
  console.log('📸 Screenshots saved: debug-x-page.png');
  console.log('⏳ Press ENTER when done inspecting...');
  
  await new Promise(resolve => {
    process.stdin.once('data', () => resolve());
  });
  
  await browser.close();
  console.log('✅ Debug session complete');
}

debugXPage().catch(console.error);
