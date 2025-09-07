import { BrowserContext, Page } from 'playwright';
import { saveTwitterCookiesToSupabase } from './twitterCookies';

/**
 * Check if the current context is logged into Twitter
 */
export async function isLoggedIn(context: BrowserContext): Promise<boolean> {
  let page: Page | null = null;
  
  try {
    page = await context.newPage();
    
    // Navigate to Twitter home and check for login indicators
    await page.goto('https://twitter.com/home', { 
      waitUntil: 'domcontentloaded',
      timeout: 15000 
    });

    // Check for logged-in indicators
    const loggedInIndicators = [
      '[data-testid="primaryColumn"]',
      '[data-testid="tweet"]',
      '[aria-label="Timeline: Your Home Timeline"]',
      '[data-testid="SideNav_AccountSwitcher_Button"]'
    ];

    for (const selector of loggedInIndicators) {
      try {
        const element = await page.locator(selector).first();
        if (await element.isVisible({ timeout: 3000 })) {
          console.log(`[auth] ✅ Login confirmed via selector: ${selector}`);
          return true;
        }
      } catch (e) {
        // Continue checking other selectors
      }
    }

    // Check URL patterns that indicate login
    const currentUrl = page.url();
    if (currentUrl.includes('/home') && !currentUrl.includes('/login')) {
      console.log('[auth] ✅ Login confirmed via URL pattern');
      return true;
    }

    console.log('[auth] ❌ Not logged in - no indicators found');
    return false;

  } catch (error) {
    console.error('[auth] Error checking login status:', error);
    return false;
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
  }
}

/**
 * Perform Twitter login using username/password
 */
export async function performTwitterLogin(context: BrowserContext): Promise<boolean> {
  let page: Page | null = null;
  
  try {
    page = await context.newPage();
    
    console.log('[auth] 🔐 Starting Twitter login process...');
    
    // Navigate to Twitter login page
    await page.goto('https://twitter.com/i/flow/login', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    await page.waitForTimeout(3000);

    // Step 1: Enter username/email
    console.log('[auth] 📝 Entering username...');
    await page.waitForSelector('input[autocomplete="username"]', { timeout: 15000 });
    
    const usernameField = page.locator('input[autocomplete="username"]').first();
    await usernameField.fill(process.env.TWITTER_USERNAME || process.env.TWITTER_EMAIL || '');
    
    // Click Next button
    await page.locator('[role="button"][data-testid="LoginForm_Login_Button"]').click();
    await page.waitForTimeout(3000);

    // Step 2: Handle potential phone/email verification
    try {
      const phoneVerification = page.locator('input[data-testid="ocfEnterTextTextInput"]');
      if (await phoneVerification.isVisible({ timeout: 5000 })) {
        console.log('[auth] 📱 Phone verification detected, entering username...');
        await phoneVerification.fill(process.env.TWITTER_USERNAME || '');
        await page.locator('[data-testid="ocfEnterTextNextButton"]').click();
        await page.waitForTimeout(2000);
      }
    } catch (e) {
      // Phone verification not required, continue
    }

    // Step 3: Enter password
    console.log('[auth] 🔑 Entering password...');
    await page.waitForSelector('input[name="password"]', { timeout: 10000 });
    
    const passwordField = page.locator('input[name="password"]').first();
    await passwordField.fill(process.env.TWITTER_PASSWORD || '');
    
    // Click Login button
    await page.locator('[data-testid="LoginForm_Login_Button"]').click();
    await page.waitForTimeout(5000);

    // Step 4: Wait for successful login
    try {
      await Promise.race([
        page.waitForURL('**/home', { timeout: 15000 }),
        page.waitForURL('**/timeline', { timeout: 15000 }),
        page.waitForSelector('[data-testid="tweet"]', { timeout: 15000 }),
        page.waitForSelector('[data-testid="primaryColumn"]', { timeout: 15000 })
      ]);
      
      console.log('[auth] ✅ Twitter login completed successfully');
      
      // Save cookies for future sessions
      try {
        const cookies = await context.cookies();
        await saveTwitterCookiesToSupabase(cookies);
        console.log('[auth] 💾 Session cookies saved');
      } catch (cookieError) {
        console.warn('[auth] ⚠️ Failed to save cookies:', cookieError);
      }
      
      return true;
      
    } catch (waitError) {
      // Check if we're actually logged in despite timeout
      const finalUrl = page.url();
      if (finalUrl.includes('/home') || finalUrl.includes('/timeline') || 
         (finalUrl.includes('twitter.com') && !finalUrl.includes('/login') && !finalUrl.includes('/flow'))) {
        
        console.log('[auth] ✅ Twitter login successful (detected via URL check)');
        
        // Save cookies for future sessions
        try {
          const cookies = await context.cookies();
          await saveTwitterCookiesToSupabase(cookies);
          console.log('[auth] 💾 Session cookies saved');
        } catch (cookieError) {
          console.warn('[auth] ⚠️ Failed to save cookies:', cookieError);
        }
        
        return true;
      }
      
      throw waitError;
    }
    
  } catch (error) {
    console.error('[auth] ❌ Twitter login failed:', error);
    console.error('[auth] 🔍 Current URL:', page?.url() || 'unknown');
    
    // Take screenshot for debugging in development
    try {
      if (process.env.NODE_ENV === 'development' && page) {
        await page.screenshot({ path: 'login_error.png' });
        console.log('[auth] 📸 Login error screenshot saved');
      }
    } catch (e) {}
    
    return false;
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
  }
}

/**
 * Verify Twitter authentication and refresh if needed
 */
export async function ensureTwitterAuthentication(context: BrowserContext): Promise<boolean> {
  try {
    // First check if already logged in
    if (await isLoggedIn(context)) {
      console.log('[auth] ✅ Already authenticated');
      return true;
    }

    // Attempt login
    console.log('[auth] 🔄 Authentication required, attempting login...');
    const loginSuccess = await performTwitterLogin(context);
    
    if (loginSuccess) {
      console.log('[auth] ✅ Authentication successful');
      return true;
    } else {
      console.error('[auth] ❌ Authentication failed');
      return false;
    }
    
  } catch (error) {
    console.error('[auth] ❌ Authentication error:', error);
    return false;
  }
}