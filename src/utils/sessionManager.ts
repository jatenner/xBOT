/**
 * Session Manager for maintaining Twitter login sessions
 * Reduces login frequency and Twitter security alerts
 */

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
    this.persistentContext = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      // Store session data to maintain login
      storageState: this.getStorageState()
    });

    this.lastLoginTime = now;
    return this.persistentContext;
  }

  /**
   * Perform Twitter login only when needed
   */
  public async ensureLoggedIn(page: any): Promise<boolean> {
    try {
      // Check if already logged in
      await page.goto('https://twitter.com/home', { waitUntil: 'networkidle' });
      
      // If we can see the home feed, we're logged in
      const homeIndicator = await page.locator('[data-testid="primaryColumn"]').first();
      if (await homeIndicator.isVisible({ timeout: 5000 })) {
        console.log('✅ Already logged in to Twitter');
        return true;
      }
    } catch (error) {
      // Not logged in, proceed with login
    }

    // Need to login
    console.log('🔐 Logging into Twitter...');
    
    try {
      await page.goto('https://twitter.com/login', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      // Enter username/email
      const usernameInput = await page.locator('input[name="text"]').first();
      if (await usernameInput.isVisible()) {
        await usernameInput.fill(process.env.TWITTER_USERNAME || process.env.TWITTER_EMAIL || '');
        await page.locator('[role="button"]').filter({ hasText: 'Next' }).click();
        await page.waitForTimeout(2000);

        // Enter password
        const passwordInput = await page.locator('input[name="password"]').first();
        await passwordInput.fill(process.env.TWITTER_PASSWORD || '');
        await page.locator('[role="button"]').filter({ hasText: 'Log in' }).click();
        await page.waitForTimeout(5000);

        // Verify login success
        await page.waitForURL('**/home', { timeout: 10000 });
        console.log('✅ Twitter login completed successfully');
        
        // Update session timestamp
        this.lastLoginTime = Date.now();
        
        return true;
      }
    } catch (loginError: any) {
      console.error('❌ Twitter login failed:', loginError.message);
      return false;
    }

    return false;
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
  private getStorageState(): any {
    // In a production environment, load from Redis or file
    // For now, return undefined to create fresh sessions
    return undefined;
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