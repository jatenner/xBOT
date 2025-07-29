/**
 * 🚄 RAILWAY PLAYWRIGHT MANAGER
 * Handles Playwright browser setup for Railway with fallbacks and async initialization
 * NEVER blocks the main app startup or health checks
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { updatePlaywrightStatus } from '../healthServer';

export interface PlaywrightStatus {
  ready: boolean;
  browser?: Browser;
  context?: BrowserContext;
  page?: Page;
  error?: string;
  fallbackMode: boolean;
  lastAttempt?: Date;
  retryCount: number;
}

class RailwayPlaywrightManager {
  private status: PlaywrightStatus = {
    ready: false,
    fallbackMode: false,
    retryCount: 0
  };

  private initPromise: Promise<void> | null = null;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 30000; // 30 seconds

  /**
   * 🚀 START ASYNC BROWSER INITIALIZATION (NON-BLOCKING)
   * This runs in background while health server is already online
   */
  async initializeAsync(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    console.log('🎭 Starting Playwright initialization (background)...');
    updatePlaywrightStatus('initializing');

    this.initPromise = this.attemptBrowserSetup();
    return this.initPromise;
  }

  /**
   * 🔄 ATTEMPT BROWSER SETUP WITH RETRIES
   */
  private async attemptBrowserSetup(): Promise<void> {
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        console.log(`🎭 Playwright setup attempt ${attempt}/${this.MAX_RETRIES}...`);
        this.status.lastAttempt = new Date();
        this.status.retryCount = attempt;

        // Configure Railway-compatible browser options
        const browserOptions = this.getRailwayBrowserOptions();
        
        console.log('🌐 Launching browser with Railway configuration...');
        this.status.browser = await chromium.launch(browserOptions);
        
        console.log('📄 Creating browser context...');
        this.status.context = await this.status.browser.newContext({
          userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          viewport: { width: 1280, height: 720 },
          locale: 'en-US'
        });

        console.log('🔗 Creating initial page...');
        this.status.page = await this.status.context.newPage();

        // Test browser functionality
        console.log('🧪 Testing browser functionality...');
        await this.status.page.goto('data:text/html,<h1>Test</h1>', { waitUntil: 'domcontentloaded' });
        
        this.status.ready = true;
        this.status.error = undefined;
        updatePlaywrightStatus('ready');
        
        console.log('✅ Playwright browser ready for automation!');
        return;

      } catch (error) {
        console.error(`❌ Playwright setup attempt ${attempt} failed:`, error);
        this.status.error = error instanceof Error ? error.message : String(error);
        
        // Cleanup failed attempt
        await this.cleanup();
        
        if (attempt < this.MAX_RETRIES) {
          console.log(`⏳ Retrying in ${this.RETRY_DELAY/1000} seconds...`);
          await this.sleep(this.RETRY_DELAY);
        }
      }
    }

    // All attempts failed - enter fallback mode
    console.warn('⚠️ All Playwright setup attempts failed - entering fallback mode');
    this.status.fallbackMode = true;
    this.status.ready = false;
    updatePlaywrightStatus('failed');
  }

  /**
   * 🔧 GET RAILWAY-COMPATIBLE BROWSER OPTIONS
   */
  private getRailwayBrowserOptions() {
    const isRailway = process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID;
    
    if (isRailway) {
      console.log('🚄 Railway environment detected - using headless configuration');
      return {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-extensions',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-default-apps',
          '--disable-features=TranslateUI',
          '--single-process'
        ]
      };
    } else {
      console.log('💻 Local environment detected - using standard configuration');
      return {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      };
    }
  }

  /**
   * 🤖 SAFE BROWSER OPERATION WITH FALLBACK
   */
  async performBrowserAction<T>(
    action: (page: Page) => Promise<T>,
    fallbackValue: T,
    actionName: string = 'browser action'
  ): Promise<T> {
    try {
      if (!this.status.ready || !this.status.page) {
        console.warn(`⚠️ Playwright not ready for ${actionName} - using fallback`);
        return fallbackValue;
      }

      console.log(`🎭 Executing ${actionName}...`);
      const result = await action(this.status.page);
      console.log(`✅ ${actionName} completed successfully`);
      return result;

    } catch (error) {
      console.error(`❌ ${actionName} failed:`, error);
      
      // Try to recover
      if (this.status.retryCount < this.MAX_RETRIES) {
        console.log('🔄 Attempting browser recovery...');
        this.initializeAsync().catch(console.error);
      }
      
      return fallbackValue;
    }
  }

  /**
   * 📝 SAFE TWITTER POSTING WITH FALLBACK
   */
  async postTweet(content: string): Promise<{ success: boolean; error?: string; fallback?: boolean }> {
    return this.performBrowserAction<{ success: boolean; error?: string; fallback?: boolean }>(
      async (page) => {
        // Twitter posting logic would go here
        console.log(`📝 Posting tweet: "${content.substring(0, 50)}..."`);
        
        // Simulate posting for now
        await page.goto('https://twitter.com', { waitUntil: 'networkidle' });
        
        return { success: true, fallback: false };
      },
      { success: false, error: 'Playwright not available', fallback: true },
      'Twitter posting'
    );
  }

  /**
   * 📊 GET CURRENT STATUS
   */
  getStatus(): PlaywrightStatus & { statusText: string } {
    let statusText = 'Unknown';
    
    if (this.status.fallbackMode) {
      statusText = 'Fallback mode - browser automation disabled';
    } else if (this.status.ready) {
      statusText = 'Ready for browser automation';
    } else if (this.initPromise) {
      statusText = `Initializing... (attempt ${this.status.retryCount}/${this.MAX_RETRIES})`;
    } else {
      statusText = 'Not initialized';
    }

    return {
      ...this.status,
      statusText
    };
  }

  /**
   * 🧹 CLEANUP RESOURCES
   */
  async cleanup(): Promise<void> {
    try {
      if (this.status.page) {
        await this.status.page.close();
        this.status.page = undefined;
      }
      
      if (this.status.context) {
        await this.status.context.close();
        this.status.context = undefined;
      }
      
      if (this.status.browser) {
        await this.status.browser.close();
        this.status.browser = undefined;
      }
      
      this.status.ready = false;
    } catch (error) {
      console.error('❌ Error during Playwright cleanup:', error);
    }
  }

  /**
   * 💤 HELPER: SLEEP FUNCTION
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 🔄 FORCE RETRY BROWSER SETUP
   */
  async forceRetry(): Promise<void> {
    console.log('🔄 Force retrying Playwright setup...');
    await this.cleanup();
    this.initPromise = null;
    this.status.retryCount = 0;
    return this.initializeAsync();
  }
}

// Singleton instance
export const railwayPlaywright = new RailwayPlaywrightManager();

// Auto-start initialization (non-blocking)
setTimeout(() => {
  railwayPlaywright.initializeAsync().catch((error) => {
    console.error('❌ Background Playwright initialization failed:', error);
  });
}, 5000); // Wait 5 seconds after health server starts