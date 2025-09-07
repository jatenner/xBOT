/**
 * 🛡️ BULLETPROOF BROWSER MANAGER
 * Ultra-stable browser management for Railway deployment
 * Fixes all "Target page, context or browser has been closed" errors
 */

import { Browser, BrowserContext, Page, chromium } from 'playwright';

export interface BrowserConfig {
  name: string;
  args: string[];
  timeout: number;
  headless: boolean;
}

export class BulletproofBrowserManager {
  private static instance: BulletproofBrowserManager;
  private browser: Browser | null = null;
  private isLaunching = false;
  private persistentContext: BrowserContext | null = null;
  private activePage: Page | null = null;
  private lastActivity = Date.now();
  private readonly IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
  
  // Railway-optimized browser configurations
  private readonly configs: BrowserConfig[] = [
    {
      name: 'railway_ultra_stable',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox', 
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--disable-extensions',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--disable-component-extensions-with-background-pages',
        '--single-process',
        '--no-zygote',
        '--memory-pressure-off',
        '--max_old_space_size=400',
        '--disable-gpu',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-sync',
        '--disable-translate',
        '--hide-scrollbars',
        '--metrics-recording-only',
        '--mute-audio',
        '--no-first-run',
        '--disable-software-rasterizer'
      ],
      timeout: 45000,
      headless: true
    },
    {
      name: 'railway_minimal_fallback',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--single-process',
        '--no-zygote',
        '--disable-gpu',
        '--memory-pressure-off'
      ],
      timeout: 30000,
      headless: true
    }
  ];

  private constructor() {
    // Auto-cleanup idle connections
    setInterval(() => {
      this.cleanupIdleConnections();
    }, 60000); // Check every minute
    
    // Graceful shutdown handler
    process.on('SIGTERM', () => this.cleanup());
    process.on('SIGINT', () => this.cleanup());
  }

  public static getInstance(): BulletproofBrowserManager {
    if (!BulletproofBrowserManager.instance) {
      BulletproofBrowserManager.instance = new BulletproofBrowserManager();
    }
    return BulletproofBrowserManager.instance;
  }

  /**
   * 🚀 GET STABLE BROWSER INSTANCE
   */
  private async ensureBrowser(): Promise<Browser> {
    if (this.browser && this.browser.isConnected()) {
      return this.browser;
    }

    if (this.isLaunching) {
      // Wait for existing launch
      let attempts = 0;
      while (this.isLaunching && attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }
      
      if (this.browser && this.browser.isConnected()) {
        return this.browser;
      }
    }

    return await this.launchBrowser();
  }

  /**
   * 🔧 LAUNCH BROWSER WITH FALLBACK CONFIGS
   */
  private async launchBrowser(): Promise<Browser> {
    this.isLaunching = true;
    
    try {
      // Cleanup any existing connections first
      await this.forceCleanup();
      
      for (const config of this.configs) {
        try {
          console.log(`🚀 BULLETPROOF_BROWSER: Trying ${config.name}...`);
          
          const browser = await chromium.launch({
            headless: config.headless,
            args: config.args,
            timeout: config.timeout
          });

          // Verify browser is actually working
          const testContext = await browser.newContext();
          const testPage = await testContext.newPage();
          await testPage.goto('about:blank');
          await testPage.close();
          await testContext.close();

          this.browser = browser;
          console.log(`✅ BULLETPROOF_BROWSER: ${config.name} launched successfully`);
          return browser;

        } catch (error) {
          console.warn(`⚠️ BULLETPROOF_BROWSER: ${config.name} failed:`, error.message);
          continue;
        }
      }

      throw new Error('All browser configurations failed');

    } finally {
      this.isLaunching = false;
    }
  }

  /**
   * 🛡️ GET STABLE PAGE FOR POSTING
   */
  public async getStablePage(): Promise<Page> {
    try {
      this.lastActivity = Date.now();
      
      // Ensure browser is running
      const browser = await this.ensureBrowser();
      
      // Use persistent context for stability
      if (!this.persistentContext || !this.persistentContext) {
        console.log('🔧 BULLETPROOF_BROWSER: Creating persistent context...');
        
        this.persistentContext = await browser.newContext({
          viewport: { width: 1280, height: 720 },
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          locale: 'en-US',
          timezoneId: 'America/New_York',
          permissions: [],
          ignoreHTTPSErrors: true
        });
      }

      // Reuse active page if still valid
      if (this.activePage && !this.activePage.isClosed()) {
        try {
          // Test if page is still responsive
          await this.activePage.evaluate(() => document.readyState);
          return this.activePage;
        } catch {
          // Page is broken, create new one
          this.activePage = null;
        }
      }

      // Create new page
      console.log('📄 BULLETPROOF_BROWSER: Creating new stable page...');
      this.activePage = await this.persistentContext.newPage();
      
      // Configure page for stability
      await this.activePage.setDefaultTimeout(30000);
      await this.activePage.setDefaultNavigationTimeout(45000);
      
      return this.activePage;

    } catch (error) {
      console.error('❌ BULLETPROOF_BROWSER: Failed to get stable page:', error);
      
      // Force complete reset and retry once
      await this.forceCleanup();
      const browser = await this.ensureBrowser();
      this.persistentContext = await browser.newContext();
      this.activePage = await this.persistentContext.newPage();
      
      return this.activePage;
    }
  }

  /**
   * 🧹 FORCE CLEANUP ALL CONNECTIONS
   */
  private async forceCleanup(): Promise<void> {
    try {
      console.log('🧹 BULLETPROOF_BROWSER: Force cleanup...');
      
      if (this.activePage && !this.activePage.isClosed()) {
        await this.activePage.close().catch(() => {});
      }
      this.activePage = null;

      if (this.persistentContext) {
        await this.persistentContext.close().catch(() => {});
      }
      this.persistentContext = null;

      if (this.browser && this.browser.isConnected()) {
        await this.browser.close().catch(() => {});
      }
      this.browser = null;

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

    } catch (error) {
      console.warn('⚠️ BULLETPROOF_BROWSER: Cleanup warning:', error.message);
    }
  }

  /**
   * ⏰ CLEANUP IDLE CONNECTIONS
   */
  private async cleanupIdleConnections(): Promise<void> {
    const now = Date.now();
    
    if (now - this.lastActivity > this.IDLE_TIMEOUT) {
      console.log('💤 BULLETPROOF_BROWSER: Cleaning up idle connections...');
      await this.forceCleanup();
    }
  }

  /**
   * 🛡️ EXECUTE FUNCTION WITH STABLE BROWSER
   */
  public async withStableBrowser<T>(operation: (page: Page) => Promise<T>): Promise<T> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🛡️ BULLETPROOF_BROWSER: Executing operation (attempt ${attempt}/${maxRetries})`);
        
        const page = await this.getStablePage();
        const result = await operation(page);
        
        console.log(`✅ BULLETPROOF_BROWSER: Operation completed successfully`);
        return result;

      } catch (error) {
        lastError = error as Error;
        console.error(`❌ BULLETPROOF_BROWSER: Attempt ${attempt} failed:`, error.message);
        
        if (attempt < maxRetries) {
          console.log(`🔄 BULLETPROOF_BROWSER: Retrying in ${attempt * 2} seconds...`);
          await new Promise(resolve => setTimeout(resolve, attempt * 2000));
          await this.forceCleanup(); // Reset everything before retry
        }
      }
    }

    throw new Error(`Bulletproof browser operation failed after ${maxRetries} attempts. Last error: ${lastError?.message}`);
  }

  /**
   * 🔍 HEALTH CHECK
   */
  public async healthCheck(): Promise<boolean> {
    try {
      const page = await this.getStablePage();
      await page.goto('about:blank', { timeout: 10000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 🛑 CLEANUP ON EXIT
   */
  public async cleanup(): Promise<void> {
    console.log('🛑 BULLETPROOF_BROWSER: Final cleanup...');
    await this.forceCleanup();
  }

  /**
   * 📊 GET STATUS
   */
  public getStatus(): object {
    return {
      browserConnected: this.browser?.isConnected() ?? false,
      contextValid: this.persistentContext ? true : false,
      pageValid: this.activePage && !this.activePage.isClosed(),
      lastActivity: new Date(this.lastActivity).toISOString(),
      isLaunching: this.isLaunching
    };
  }
}

// Export singleton
export const bulletproofBrowser = BulletproofBrowserManager.getInstance();
