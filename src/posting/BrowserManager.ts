import { chromium, Browser, BrowserContext } from 'playwright';
import { loadSessionState } from '../utils/session';

interface BrowserStatus {
  connected: boolean;
  contexts: {
    posting: number;
    metrics: number;
  };
}

class BrowserManager {
  private browser: Browser | null = null;
  private launching = false;
  private contextCounts = { posting: 0, metrics: 0 };
  
  // Shared contexts for resilient scraping
  private sharedContext: BrowserContext | null = null;
  private sharedPage: any = null;
  private metricsCircuitBreakerUntil: number = 0;

  constructor() {
    // Track context cleanup
    this.trackContextCleanup();
  }

  private trackContextCleanup() {
    // Reset context counts periodically to handle any leaked counts
    setInterval(() => {
      if (!this.browser || !this.browser.isConnected()) {
        this.contextCounts = { posting: 0, metrics: 0 };
      }
    }, 60_000); // Every minute
  }

  /**
   * Launch browser with exponential backoff retry
   */
  private async launchWithRetry(): Promise<void> {
    if (this.launching) {
      // Wait for existing launch attempt
      while (this.launching) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return;
    }

    this.launching = true;
    try {
      let delay = 250;
      let lastError: Error | null = null;

      for (let attempt = 1; attempt <= 5; attempt++) {
        try {
          console.log(`🌐 Launching browser (attempt ${attempt}/5)...`);
          
          this.browser = await chromium.launch({
            headless: true,
            args: [
              '--no-sandbox',
              '--disable-dev-shm-usage',
              '--disable-gpu',
              '--disable-web-security',
              '--disable-features=VizDisplayCompositor',
              '--memory-pressure-off',
              '--max_old_space_size=4096'
            ]
          });

          // Set up disconnect handler
          this.browser.on('disconnected', () => {
            console.log('🔄 Browser disconnected, will relaunch on next request');
            this.browser = null;
            this.contextCounts = { posting: 0, metrics: 0 };
          });

          console.log('✅ Browser launched successfully');
          return;
        } catch (error) {
          lastError = error as Error;
          console.log(`⚠️ Browser launch attempt ${attempt} failed: ${lastError.message}`);
          
          if (attempt < 5) {
            console.log(`⏳ Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay = Math.min(delay * 2, 4000);
          }
        }
      }

      throw new Error(`Browser launch failed after 5 attempts. Last error: ${lastError?.message}`);
    } finally {
      this.launching = false;
    }
  }

  /**
   * Ensure browser is available and connected
   */
  async ensureBrowser(): Promise<Browser> {
    if (this.browser?.isConnected()) {
      return this.browser;
    }

    await this.launchWithRetry();
    
    if (!this.browser?.isConnected()) {
      throw new Error('Browser unavailable after launch attempts');
    }

    return this.browser;
  }

  /**
   * Create a new posting context with Twitter session
   */
  async newPostingContext(): Promise<BrowserContext> {
    const browser = await this.ensureBrowser();
    
    let delay = 250;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        // Load Twitter session state
        const storageState = loadSessionState();
        
        const context = await browser.newContext({
          viewport: { width: 1280, height: 720 },
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          locale: 'en-US',
          timezoneId: 'America/New_York',
          storageState: storageState ?? undefined
        });

        this.contextCounts.posting++;
        
        // Set up cleanup handler
        context.on('close', () => {
          this.contextCounts.posting = Math.max(0, this.contextCounts.posting - 1);
        });

        return context;
      } catch (error) {
        lastError = error as Error;
        console.log(`⚠️ Posting context creation attempt ${attempt} failed: ${lastError.message}`);
        
        if (attempt < 5) {
          await new Promise(resolve => setTimeout(resolve, delay));
          delay = Math.min(delay * 2, 4000);
        }
      }
    }

    throw new Error(`Failed to create posting context after 5 attempts. Last error: ${lastError?.message}`);
  }

  /**
   * Create a new metrics context (no session needed)
   */
  async newMetricsContext(): Promise<BrowserContext> {
    const browser = await this.ensureBrowser();
    
    let delay = 250;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        const context = await browser.newContext({
          viewport: { width: 1280, height: 720 },
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          locale: 'en-US',
          timezoneId: 'America/New_York'
        });

        this.contextCounts.metrics++;
        
        // Set up cleanup handler
        context.on('close', () => {
          this.contextCounts.metrics = Math.max(0, this.contextCounts.metrics - 1);
        });

        return context;
      } catch (error) {
        lastError = error as Error;
        console.log(`⚠️ Metrics context creation attempt ${attempt} failed: ${lastError.message}`);
        
        if (attempt < 5) {
          await new Promise(resolve => setTimeout(resolve, delay));
          delay = Math.min(delay * 2, 4000);
        }
      }
    }

    throw new Error(`Failed to create metrics context after 5 attempts. Last error: ${lastError?.message}`);
  }

  /**
   * Execute function with auto-managed context
   */
  async withContext<T>(
    kind: 'posting' | 'metrics',
    fn: (context: BrowserContext) => Promise<T>
  ): Promise<T> {
    let context: BrowserContext | null = null;
    
    try {
      context = kind === 'posting' 
        ? await this.newPostingContext()
        : await this.newMetricsContext();
      
      return await fn(context);
    } finally {
      if (context) {
        try {
          await context.close();
        } catch (error) {
          console.warn(`⚠️ Failed to close ${kind} context:`, (error as Error).message);
        }
      }
    }
  }

  /**
   * Get browser status for diagnostics
   */
  getStatus(): BrowserStatus {
    return {
      connected: this.browser?.isConnected() ?? false,
      contexts: { ...this.contextCounts }
    };
  }

  /**
   * Force close browser (for cleanup)
   */
  async close(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (error) {
        console.warn('⚠️ Error closing browser:', (error as Error).message);
      } finally {
        this.browser = null;
        this.contextCounts = { posting: 0, metrics: 0 };
      }
    }
  }

  /**
   * Shared context helper with resilient retry logic for metrics scraping
   */
  async withSharedContext<T>(fn: (ctx: { page: any; recreate: () => Promise<void> }) => Promise<T>): Promise<T> {
    if (Date.now() < this.metricsCircuitBreakerUntil) {
      throw new Error('Metrics circuit breaker active - scraping temporarily disabled');
    }

    const ensureSharedContext = async () => {
      const browser = await this.ensureBrowser();
      if (!this.sharedContext || !this.sharedPage) {
        try {
          const sessionState = await loadSessionState();
          this.sharedContext = await browser.newContext({ storageState: sessionState });
          this.sharedPage = await this.sharedContext.newPage();
        } catch (error: any) {
          console.error(`❌ Failed to create shared context: ${error.message}`);
          throw error;
        }
      }
    };

    const recreateSharedContext = async () => {
      try {
        await this.sharedPage?.close().catch(() => {});
        await this.sharedContext?.close().catch(() => {});
      } catch {}
      
      const browser = await this.ensureBrowser();
      const sessionState = await loadSessionState();
      this.sharedContext = await browser.newContext({ storageState: sessionState });
      this.sharedPage = await this.sharedContext.newPage();
      
      console.log('🔄 SCRAPER_RETRY: recreated=true');
    };

    await ensureSharedContext();

    try {
      return await fn({ 
        page: this.sharedPage, 
        recreate: recreateSharedContext 
      });
    } catch (error: any) {
      const errorStr = String(error);
      
      if (errorStr.includes('has been closed') || errorStr.includes('Target closed')) {
        console.warn('⚠️ Shared context closed, attempting recreation...');
        try {
          await recreateSharedContext();
          return await fn({ 
            page: this.sharedPage, 
            recreate: recreateSharedContext 
          });
        } catch (retryError: any) {
          console.error('❌ Shared context retry failed, activating circuit breaker');
          this.metricsCircuitBreakerUntil = Date.now() + 10 * 60 * 1000; // 10 minute breaker
          throw retryError;
        }
      }
      
      throw error;
    }
  }

  /**
   * Get metrics circuit breaker status
   */
  getMetricsStatus(): { available: boolean; resumesIn?: number } {
    if (Date.now() < this.metricsCircuitBreakerUntil) {
      return {
        available: false,
        resumesIn: Math.round((this.metricsCircuitBreakerUntil - Date.now()) / 1000 / 60)
      };
    }
    return { available: true };
  }

  /**
   * Static method to execute a function with a managed page
   */
  static async withPage<T>(callback: (page: any) => Promise<T>): Promise<T> {
    const instance = browserManager;
    const page = await instance.getSharedPage();
    return await callback(page);
  }
}

// Export both class and singleton instance
export { BrowserManager };
export const browserManager = new BrowserManager();
