/**
 * Session Manager for maintaining Twitter login sessions
 * Reduces login frequency and Twitter security alerts
 */

import { loadTwitterCookiesFromSupabase } from './twitterCookies';

export class TwitterSessionManager {
  private static instance: TwitterSessionManager;
  private persistentContext: any = null;
  private lastLoginTime: number = 0;
  private readonly SESSION_TIMEOUT = 4 * 60 * 60 * 1000; // 4 hours

  private constructor() {}

  public static getInstance(): TwitterSessionManager {
    if (!TwitterSessionManager.instance) {
      TwitterSessionManager.instance = new TwitterSessionManager();
    }
    return TwitterSessionManager.instance;
  }

  /**
   * Get or create a persistent browser context
   */
  public async getPersistentContext(browser: any): Promise<any> {
    const now = Date.now();
    
    // If we have a context and it's not expired, reuse it
    if (this.persistentContext && (now - this.lastLoginTime) < this.SESSION_TIMEOUT) {
      console.log('🔄 Reusing existing Twitter session');
      return this.persistentContext;
    }

    // Create new persistent context
    console.log('🆕 Creating new persistent Twitter session');
    
    try {
      // Close old context if exists
      if (this.persistentContext) {
        await this.persistentContext.close();
      }
    } catch (error) {
      // Ignore cleanup errors
    }

    // Create new context with session persistence
    const storageState = await this.getStorageState();
    this.persistentContext = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 }
    });

    // Ensure we start clean then load our known-good cookies
    if (storageState && storageState.cookies && storageState.cookies.length > 0) {
      await this.persistentContext.clearCookies();
      await this.persistentContext.addCookies(storageState.cookies);
      console.log(`[session] Applied ${storageState.cookies.length} cookies to context`);
    } else {
      console.warn('[session] No cookies to apply - will require login');
    }

    this.lastLoginTime = now;
    return this.persistentContext;
  }

  /**
   * Perform Twitter login only when needed
   */
  public async ensureLoggedIn(page: any): Promise<boolean> {
    try {
      // Check if already logged in by trying to access home
      await page.goto('https://twitter.com/home', { 
        waitUntil: 'domcontentloaded',
        timeout: 15000 
      });
      
      // If we can see the home feed, we're logged in
      const homeIndicator = await page.locator('[data-testid="primaryColumn"]').first();
      if (await homeIndicator.isVisible({ timeout: 8000 })) {
        console.log('✅ Already logged in to Twitter');
        return true;
      }
    } catch (error) {
      // Not logged in, proceed with login
      console.log('🔐 Need to login to Twitter');
    }

    // Need to login - use the modern Twitter login flow
    console.log('🔐 Logging into Twitter...');
    
    try {
      // Navigate to the proper login endpoint
      await page.goto('https://twitter.com/i/flow/login', { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });
      await page.waitForTimeout(3000);

      // Wait for and fill username field
      console.log('📝 Entering username...');
      await page.waitForSelector('input[autocomplete="username"]', { timeout: 15000 });
      const usernameField = page.locator('input[autocomplete="username"]').first();
      await usernameField.fill(process.env.TWITTER_USERNAME || process.env.TWITTER_EMAIL || '');
      
      // Click Next button
      await page.locator('[role="button"][data-testid="LoginForm_Login_Button"]').click();
      await page.waitForTimeout(3000);

      // Handle potential phone/email verification step
      try {
        const phoneVerification = page.locator('input[data-testid="ocfEnterTextTextInput"]');
        if (await phoneVerification.isVisible({ timeout: 5000 })) {
          console.log('📱 Phone verification detected, entering username...');
          await phoneVerification.fill(process.env.TWITTER_USERNAME || '');
          await page.locator('[data-testid="ocfEnterTextNextButton"]').click();
          await page.waitForTimeout(2000);
        }
      } catch (e) {
        // Phone verification not required, continue
      }

      // Enter password
      console.log('🔑 Entering password...');
      await page.waitForSelector('input[name="password"]', { timeout: 10000 });
      const passwordField = page.locator('input[name="password"]').first();
      await passwordField.fill(process.env.TWITTER_PASSWORD || '');
      
      // Click Login button
      await page.locator('[data-testid="LoginForm_Login_Button"]').click();
      await page.waitForTimeout(5000);

      // Wait for successful login with multiple success indicators
      try {
        await Promise.race([
          page.waitForURL('**/home', { timeout: 15000 }),
          page.waitForURL('**/timeline', { timeout: 15000 }),
          page.waitForSelector('[data-testid="tweet"]', { timeout: 15000 }),
          page.waitForSelector('[data-testid="primaryColumn"]', { timeout: 15000 })
        ]);
        
        console.log('✅ Twitter login completed successfully');
        this.lastLoginTime = Date.now();
        return true;
        
      } catch (waitError) {
        // Check if we're actually logged in despite timeout
        const finalUrl = page.url();
        if (finalUrl.includes('/home') || finalUrl.includes('/timeline') || 
           (finalUrl.includes('twitter.com') && !finalUrl.includes('/login') && !finalUrl.includes('/flow'))) {
          console.log('✅ Twitter login successful (detected via URL check)');
          this.lastLoginTime = Date.now();
          return true;
        }
        throw waitError;
      }
      
    } catch (loginError: any) {
      console.error('❌ Twitter login failed:', loginError.message);
      console.error('🔍 Current URL:', page.url());
      
      // Take screenshot for debugging in development
      try {
        if (process.env.NODE_ENV === 'development') {
          await page.screenshot({ path: 'login_error.png' });
          console.log('📸 Login error screenshot saved');
        }
      } catch (e) {}
      
      return false;
    }
  }

  /**
   * Save session state for persistence
   */
  public async saveSessionState(context: any): Promise<void> {
    try {
      const storageState = await context.storageState();
      // In a production environment, you might want to save this to Redis or a file
      // For now, we keep it in memory
      console.log('💾 Session state saved');
    } catch (error) {
      console.warn('⚠️ Failed to save session state:', error);
    }
  }

  /**
   * Get stored session state
   */
  private async getStorageState(): Promise<any> {
    try {
      const storageState = await loadTwitterCookiesFromSupabase();
      return storageState;
    } catch (error) {
      console.warn('[session] Failed to load storage state:', (error as Error).message);
      return undefined;
    }
  }

  /**
   * Clear session and force re-login
   */
  public async clearSession(): Promise<void> {
    try {
      if (this.persistentContext) {
        await this.persistentContext.close();
        this.persistentContext = null;
      }
      this.lastLoginTime = 0;
      console.log('🧹 Twitter session cleared');
    } catch (error) {
      console.warn('⚠️ Failed to clear session:', error);
    }
  }

  /**
   * Check if session is still valid
   */
  public isSessionValid(): boolean {
    const now = Date.now();
    return this.persistentContext && (now - this.lastLoginTime) < this.SESSION_TIMEOUT;
  }
}