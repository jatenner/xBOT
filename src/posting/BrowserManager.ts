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
   * Launch browser with enterprise-grade Railway EAGAIN handling
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
      // Enterprise-grade progressive fallback configurations
      const browserProfile = process.env.BROWSER_PROFILE || 'standard_railway';
      const browserConcurrency = parseInt(process.env.BROWSER_CONCURRENCY || '1', 10);
      
      const launchConfigs = [
        {
          name: 'standard_railway',
          config: {
            headless: true,
            args: [
              '--no-sandbox',
              '--disable-dev-shm-usage',
              '--disable-gpu',
              '--mute-audio'
            ],
            timeout: 30000
          }
        },
        {
          name: 'ultra_lightweight_railway',
          config: {
            headless: true,
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage',
              '--single-process',           // CRITICAL: Prevents EAGAIN fork() errors
              '--no-zygote',               // CRITICAL: No subprocess spawning
              '--disable-gpu',
              '--disable-accelerated-2d-canvas',
              '--disable-background-timer-throttling',
              '--disable-backgrounding-occluded-windows',
              '--disable-renderer-backgrounding',
              '--disable-features=TranslateUI,VizDisplayCompositor',
              '--disable-ipc-flooding-protection',
              '--disable-extensions',
              '--disable-plugins',
              '--disable-images',          // Save memory
              '--disable-javascript',      // We'll re-enable as needed
              '--memory-pressure-off',
              '--max_old_space_size=256',  // Low memory limit
              '--disable-web-security',
              '--disable-default-apps',
              '--no-first-run'
            ],
            timeout: 15000
          }
        },
        {
          name: 'minimal_railway',
          config: {
            headless: true,
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage',
              '--single-process',
              '--no-zygote',
              '--disable-gpu',
              '--memory-pressure-off',
              '--max_old_space_size=512'
            ],
            timeout: 10000
          }
        },
        {
          name: 'emergency_basic',
          config: {
            headless: true,
            args: [
              '--no-sandbox',
              '--single-process',
              '--disable-gpu',
              '--disable-dev-shm-usage'
            ],
            timeout: 8000
          }
        }
      ];

      // Filter configurations based on BROWSER_PROFILE
      const filteredConfigs = browserProfile === 'ultra_lightweight_railway' 
        ? launchConfigs.filter(config => config.name === 'ultra_lightweight_railway')
        : launchConfigs.filter(config => config.name === 'standard_railway');

      let lastError: Error | null = null;

      console.log(`🚀 ENTERPRISE_BROWSER: Using profile ${browserProfile} (concurrency: ${browserConcurrency})`);

      for (const { name, config } of filteredConfigs) {
        try {
          console.log(`🚀 ENTERPRISE_BROWSER: Trying ${name} configuration...`);
          console.log(`🔧 CHROMIUM_ARGS: ${config.args?.join(' ') || 'default'}`);
          
          // Force cleanup before each attempt
          await this.forceCleanupProcesses();
          
          this.browser = await chromium.launch(config);

          // Set up disconnect handler
          this.browser.on('disconnected', () => {
            console.log('🔄 Browser disconnected, will relaunch on next request');
            this.browser = null;
            this.contextCounts = { posting: 0, metrics: 0 };
          });

          console.log(`✅ ENTERPRISE_BROWSER: ${name} launched successfully`);
          return;
        } catch (error) {
          lastError = error as Error;
          console.log(`❌ ENTERPRISE_BROWSER: ${name} failed: ${lastError.message}`);
          
          // Enhanced error handling for common Railway issues
          if (lastError.message.includes('EAGAIN')) {
            console.log('🔧 EAGAIN detected - forcing process cleanup...');
            await this.forceCleanupProcesses();
            await new Promise(resolve => setTimeout(resolve, 2000));
          } else if (lastError.message.includes('InSameStoragePartition')) {
            console.log('🔧 Storage partition error - likely from single-process mode');
          } else if (lastError.message.includes('Target page, context or browser has been closed')) {
            console.log('🔧 Target closed error - will retry with context recovery');
          }
        }
      }

      throw new Error(`All browser configurations failed. Last error: ${lastError?.message}`);
    } finally {
      this.launching = false;
    }
  }

  /**
   * Recover from "Target page/context closed" errors
   */
  async recoverFromTargetClosed(): Promise<boolean> {
    try {
      console.log('🔄 BROWSER_RECOVERY: Attempting context recovery...');
      
      // Close and recreate browser if needed
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      
      // Reset context counts
      this.contextCounts = { posting: 0, metrics: 0 };
      
      // Relaunch browser
      await this.launchWithRetry();
      
      console.log('✅ BROWSER_RECOVERY: Context recovered successfully');
      return true;
    } catch (error) {
      console.error('❌ BROWSER_RECOVERY: Failed to recover context:', (error as Error).message);
      return false;
    }
  }

  /**
   * Page ready gate - ensure DOM + network idle + composer available
   */
  static async waitForPageReady(page: any, composerSelectors: string[] = []): Promise<boolean> {
    try {
      console.log('🚦 PAGE_READY: Waiting for DOM + network idle...');
      
      // Wait for DOM to be ready
      await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
      
      // Wait for network to be idle (no more requests for 500ms)
      await page.waitForLoadState('networkidle', { timeout: 8000 });
      
      // If composer selectors provided, ensure composer is available
      if (composerSelectors.length > 0) {
        console.log('🚦 PAGE_READY: Checking composer availability...');
        
        let composerFound = false;
        for (const selector of composerSelectors) {
          try {
            await page.waitForSelector(selector, { timeout: 5000 });
            composerFound = true;
            break;
          } catch {
            // Try next selector
          }
        }
        
        if (!composerFound) {
          console.warn('⚠️ PAGE_READY: Composer not found but continuing...');
        }
      }
      
      console.log('✅ PAGE_READY: Page is ready for interaction');
      return true;
      
    } catch (error) {
      console.error('❌ PAGE_READY: Failed to achieve ready state:', (error as Error).message);
      return false;
    }
  }

  /**
   * Force cleanup processes to prevent EAGAIN errors
   */
  private async forceCleanupProcesses(): Promise<void> {
    try {
      // Kill any orphaned Chrome processes
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      // Railway-specific cleanup
      await execAsync('pkill -f "chrome|chromium" || true').catch(() => {});
      await execAsync('rm -rf /tmp/playwright_* /tmp/chrome-* || true').catch(() => {});
      
      // Force garbage collection
      if (global.gc) {
        global.gc();
      }
      
      // Small delay for cleanup
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      // Cleanup errors are non-fatal
      console.log('🧹 Process cleanup completed');
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
   * Execute function with auto-managed context and recovery
   */
  async withContext<T>(
    kind: 'posting' | 'metrics',
    fn: (context: BrowserContext) => Promise<T>
  ): Promise<T> {
    const maxContextRetries = 2;
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < maxContextRetries; attempt++) {
      let context: BrowserContext | null = null;
      
      try {
        context = kind === 'posting' 
          ? await this.newPostingContext()
          : await this.newMetricsContext();
        
        return await fn(context);
        
      } catch (error) {
        lastError = error as Error;
        
        // Check for Target closed errors and attempt recovery
        if (lastError.message.includes('Target page, context or browser has been closed')) {
          console.log(`🔄 CONTEXT_RECOVERY: Target closed error on attempt ${attempt + 1}/${maxContextRetries}`);
          
          if (attempt < maxContextRetries - 1) {
            await this.recoverFromTargetClosed();
            continue; // Retry with new context
          }
        }
        
        // For other errors or final attempt, don't retry
        throw lastError;
        
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
    
    throw lastError || new Error(`Context creation failed after ${maxContextRetries} attempts`);
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
    await instance.ensureBrowser();
    
    if (!instance.browser) {
      throw new Error('Failed to ensure browser availability');
    }
    
    const context = await instance.browser.newContext();
    const page = await context.newPage();
    
    try {
      return await callback(page);
    } finally {
      await context.close();
    }
  }
}

// Export both class and singleton instance
export { BrowserManager };
export const browserManager = new BrowserManager();
