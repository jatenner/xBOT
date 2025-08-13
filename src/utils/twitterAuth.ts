import { BrowserContext, Page } from 'playwright';
import { saveTwitterCookiesToSupabase } from './twitterCookies';

/**
 * Perform Twitter login using environment credentials
 */
export async function performTwitterLogin(context: BrowserContext): Promise<boolean> {
  const username = process.env.X_USERNAME;
  const password = process.env.X_PASSWORD;
  const totpSecret = process.env.X_TOTP_SECRET;

  if (!username || !password) {
    console.warn('[auth] Missing X_USERNAME or X_PASSWORD - cannot perform fallback login');
    return false;
  }

  console.log('[auth] Attempting Twitter login with environment credentials');
  
  let page: Page | null = null;
  try {
    page = await context.newPage();
    
    // Navigate to login page with retries
    let loginSuccess = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`[auth] Login attempt ${attempt}/3`);
        await page.goto('https://x.com/i/flow/login', { 
          waitUntil: 'domcontentloaded', 
          timeout: 30000 
        });
        loginSuccess = true;
        break;
      } catch (error) {
        console.warn(`[auth] Navigation attempt ${attempt} failed:`, (error as Error).message);
        if (attempt === 3) throw error;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    if (!loginSuccess) {
      throw new Error('Failed to navigate to login page after 3 attempts');
    }

    // Wait for page to stabilize
    await page.waitForTimeout(3000);

    // Enter username/email
    console.log('[auth] Entering username');
    const usernameSelectors = [
      'input[name="text"]',
      'input[autocomplete="username"]',
      'input[data-testid="ocfEnterTextTextInput"]',
      'input[placeholder*="username" i]',
      'input[placeholder*="email" i]'
    ];
    
    let usernameField = null;
    for (const selector of usernameSelectors) {
      try {
        usernameField = await page.waitForSelector(selector, { timeout: 5000 });
        break;
      } catch {}
    }
    
    if (!usernameField) {
      throw new Error('Could not find username field');
    }
    
    await usernameField.fill(username);
    await page.waitForTimeout(1000);

    // Click Next button
    const nextButtons = [
      '[data-testid="LoginForm_Login_Button"]',
      'button:has-text("Next")',
      'button:has-text("Log in")',
      '[role="button"]:has-text("Next")'
    ];
    
    let nextClicked = false;
    for (const selector of nextButtons) {
      try {
        await page.click(selector, { timeout: 3000 });
        nextClicked = true;
        break;
      } catch {}
    }
    
    if (!nextClicked) {
      throw new Error('Could not find or click Next button');
    }

    await page.waitForTimeout(2000);

    // Enter password
    console.log('[auth] Entering password');
    const passwordSelectors = [
      'input[name="password"]',
      'input[type="password"]',
      'input[data-testid="ocfEnterTextTextInput"]',
      'input[autocomplete="current-password"]'
    ];
    
    let passwordField = null;
    for (const selector of passwordSelectors) {
      try {
        passwordField = await page.waitForSelector(selector, { timeout: 5000 });
        break;
      } catch {}
    }
    
    if (!passwordField) {
      throw new Error('Could not find password field');
    }
    
    await passwordField.fill(password);
    await page.waitForTimeout(1000);

    // Click login button
    const loginButtons = [
      '[data-testid="LoginForm_Login_Button"]',
      'button:has-text("Log in")',
      'button:has-text("Sign in")',
      '[role="button"]:has-text("Log in")'
    ];
    
    let loginClicked = false;
    for (const selector of loginButtons) {
      try {
        await page.click(selector, { timeout: 3000 });
        loginClicked = true;
        break;
      } catch {}
    }
    
    if (!loginClicked) {
      throw new Error('Could not find or click Login button');
    }

    await page.waitForTimeout(3000);

    // Handle 2FA if enabled
    if (totpSecret) {
      console.log('[auth] Checking for 2FA prompt');
      try {
        const tfaInput = await page.waitForSelector('input[data-testid="ocfEnterTextTextInput"]', { timeout: 5000 });
        if (tfaInput) {
          console.log('[auth] 2FA detected - generating TOTP code');
          const totp = generateTOTP(totpSecret);
          await tfaInput.fill(totp);
          await page.waitForTimeout(1000);
          
          // Click verify button
          const verifyButtons = [
            'button:has-text("Next")',
            'button:has-text("Verify")',
            '[data-testid="LoginForm_Login_Button"]'
          ];
          
          for (const selector of verifyButtons) {
            try {
              await page.click(selector, { timeout: 3000 });
              break;
            } catch {}
          }
          
          await page.waitForTimeout(3000);
        }
      } catch {
        console.log('[auth] No 2FA prompt detected');
      }
    }

    // Wait for successful login (check for home page indicators)
    console.log('[auth] Waiting for login completion');
    try {
      await Promise.race([
        page.waitForSelector('[data-testid="SideNav_NewTweet_Button"]', { timeout: 15000 }),
        page.waitForSelector('[aria-label="Home timeline"]', { timeout: 15000 }),
        page.waitForSelector('[data-testid="primaryColumn"]', { timeout: 15000 }),
        page.waitForURL('**/home', { timeout: 15000 })
      ]);
      console.log('[auth] ✅ Login successful - detected home page');
    } catch {
      // Check if we're on a different success page
      const currentUrl = page.url();
      if (currentUrl.includes('x.com') && !currentUrl.includes('login')) {
        console.log('[auth] ✅ Login successful - redirected from login');
      } else {
        throw new Error('Login failed - still on login page or error page');
      }
    }

    // Save the new cookies
    console.log('[auth] Saving cookies to Supabase');
    const cookies = await context.cookies();
    const saved = await saveTwitterCookiesToSupabase(cookies);
    
    if (saved) {
      console.log('[auth] ✅ Cookies saved successfully');
    } else {
      console.warn('[auth] ⚠️ Failed to save cookies, but login succeeded');
    }

    return true;

  } catch (error) {
    console.error('[auth] ❌ Login failed:', (error as Error).message);
    return false;
  } finally {
    if (page) {
      try {
        await page.close();
      } catch {}
    }
  }
}

/**
 * Simple TOTP generator (basic implementation)
 */
function generateTOTP(secret: string): string {
  // This is a simplified implementation - in production you'd use a proper TOTP library
  // For now, return a placeholder that indicates 2FA is configured
  console.warn('[auth] TOTP generation not fully implemented - manual 2FA may be required');
  return '000000'; // Placeholder - would need crypto.createHmac implementation
}

/**
 * Check if we're currently logged in to Twitter
 */
export async function isLoggedIn(context: BrowserContext): Promise<boolean> {
  let page: Page | null = null;
  try {
    page = await context.newPage();
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 15000 });
    
    // Check for login indicators
    const loginIndicators = [
      '[data-testid="SideNav_NewTweet_Button"]',
      '[aria-label="Home timeline"]',
      '[data-testid="primaryColumn"]'
    ];
    
    for (const selector of loginIndicators) {
      try {
        await page.waitForSelector(selector, { timeout: 3000 });
        console.log('[auth] ✅ Already logged in to Twitter');
        return true;
      } catch {}
    }
    
    // Check if redirected to login
    if (page.url().includes('login')) {
      console.log('[auth] 🔐 Not logged in - redirected to login page');
      return false;
    }
    
    console.log('[auth] ✅ Already logged in to Twitter');
    return true;
    
  } catch (error) {
    console.warn('[auth] Failed to check login status:', (error as Error).message);
    return false;
  } finally {
    if (page) {
      try {
        await page.close();
      } catch {}
    }
  }
}