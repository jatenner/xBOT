import { Page } from 'playwright';

/**
 * Robust login detection for X (Twitter)
 * Checks multiple indicators to determine if user is logged in
 */
export async function isLoggedIn(page: Page): Promise<boolean> {
  try {
    console.log('🔍 LOGIN_CHECK: Navigating to x.com/home to check login status...');
    
    // Navigate to home page and wait for content to load
    await page.goto('https://x.com/home', { 
      waitUntil: 'domcontentloaded',
      timeout: 10000 
    });
    
    // Wait a moment for dynamic content to load
    await page.waitForTimeout(2000);
    
    // Check if we're redirected to login page
    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('/i/flow/login')) {
      console.log('❌ LOGIN_CHECK: Redirected to login page:', currentUrl);
      return false;
    }
    
    // Look for authenticated user indicators with multiple selectors
    const authenticatedSelectors = [
      '[data-testid="SideNav_AccountSwitcher_Button"]', // User avatar in sidebar
      '[data-testid="tweetTextarea_0"]',                // Compose tweet box
      '[aria-label*="Profile"]',                        // Profile button
      '[data-testid="SideNav_NewTweet_Button"]',        // Tweet button
      '[data-testid="primaryColumn"]'                   // Main timeline column
    ];
    
    // Check each selector with shorter timeout
    for (const selector of authenticatedSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 3000 });
        console.log(`✅ LOGIN_CHECK: Found authenticated indicator: ${selector}`);
        return true;
      } catch {
        // Continue checking other selectors
      }
    }
    
    // Final check: look for login-specific elements that indicate we're NOT logged in
    const loginIndicators = [
      'text=Sign in to X',
      'text=Log in',
      '[data-testid="loginButton"]',
      '[name="session[username_or_email]"]'
    ];
    
    for (const selector of loginIndicators) {
      try {
        await page.waitForSelector(selector, { timeout: 2000 });
        console.log(`❌ LOGIN_CHECK: Found login indicator: ${selector}`);
        return false;
      } catch {
        // Continue checking
      }
    }
    
    // If we get here and the URL is still x.com/home, assume we're logged in
    if (currentUrl.includes('x.com/home') || currentUrl.includes('twitter.com/home')) {
      console.log('✅ LOGIN_CHECK: On home page without login redirect - assuming logged in');
      return true;
    }
    
    console.log('❓ LOGIN_CHECK: Unable to determine login status, assuming not logged in');
    return false;
    
  } catch (error) {
    console.error('❌ LOGIN_CHECK: Error during login check:', error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Quick login check without navigation (for pages already on X)
 */
export async function isLoggedInQuick(page: Page): Promise<boolean> {
  try {
    // Quick check for authenticated indicators
    const quickSelectors = [
      '[data-testid="SideNav_AccountSwitcher_Button"]',
      '[data-testid="tweetTextarea_0"]',
      '[data-testid="SideNav_NewTweet_Button"]'
    ];
    
    for (const selector of quickSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 1000 });
        return true;
      } catch {
        // Continue
      }
    }
    
    return false;
  } catch {
    return false;
  }
}