// src/lib/browser.ts - Robust Playwright launcher with retries and health logs
import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { safeLog } from '../utils/redact';

class BrowserManager {
  private static instance: BrowserManager;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private isLaunching = false;
  private maxRetries = 2;

  private constructor() {}

  static getInstance(): BrowserManager {
    if (!BrowserManager.instance) {
      BrowserManager.instance = new BrowserManager();
    }
    return BrowserManager.instance;
  }

  async getBrowser(): Promise<Browser> {
    if (process.env.ENABLE_METRICS === 'false') {
      console.log('📊 METRICS: disabled - browser operations skipped');
      throw new Error('METRICS_DISABLED: Browser operations are disabled');
    }
    
    if (!process.env.REAL_METRICS_ENABLED || process.env.REAL_METRICS_ENABLED === 'false') {
      throw new Error('REAL_METRICS_DISABLED: Browser operations are disabled by feature flag');
    }

    if (this.browser && this.browser.isConnected()) {
      return this.browser;
    }

    if (this.isLaunching) {
      // Wait for ongoing launch attempt
      while (this.isLaunching) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      if (this.browser && this.browser.isConnected()) {
        return this.browser;
      }
    }

    return this.launchBrowser();
  }

  private async launchBrowser(): Promise<Browser> {
    this.isLaunching = true;

    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.maxRetries + 1; attempt++) {
      try {
        safeLog.info(`🚀 CHROMIUM_LAUNCH: Attempt ${attempt}/${this.maxRetries + 1}`);

        const launchOptions = {
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--mute-audio',
            '--disable-extensions',
            '--no-first-run',
            '--disable-default-apps',
            '--disable-background-timer-throttling',
            '--disable-renderer-backgrounding',
            '--disable-backgrounding-occluded-windows',
            '--disable-features=TranslateUI',
            '--disable-ipc-flooding-protection'
          ],
          timeout: 30000
        };

        this.browser = await chromium.launch(launchOptions);
        
        // Create persistent context for better performance
        this.context = await this.browser.newContext({
          viewport: { width: 1280, height: 720 },
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });

        // Test the browser with a simple page
        const testPage = await this.context.newPage();
        await testPage.goto('data:text/html,<html><body>Browser Test</body></html>');
        await testPage.close();

        safeLog.info('✅ CHROMIUM: Browser launched successfully');
        this.isLaunching = false;
        return this.browser;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Check for missing executable error
        if (lastError.message.includes("Executable doesn't exist")) {
          safeLog.error('❌ CHROMIUM: Browser executable not found');
          safeLog.info('💡 HINT: Run "npx playwright install --with-deps chromium" during build');
          this.isLaunching = false;
          throw new Error('BROWSER_NOT_INSTALLED: Playwright browser not found');
        }
        
        safeLog.error(`❌ CHROMIUM_LAUNCH_FAILED: Attempt ${attempt} - ${lastError.message}`);
        
        // Clean up failed attempt
        await this.cleanup();

        if (attempt <= this.maxRetries) {
          const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          safeLog.info(`⏳ CHROMIUM_RETRY: Waiting ${backoffMs}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
      }
    }

    this.isLaunching = false;
    safeLog.error(`❌ CHROMIUM: browserType.launch failed: ${lastError?.message || 'Unknown error'}`);
    throw lastError || new Error('Browser launch failed after all retries');
  }

  async getContext(): Promise<BrowserContext> {
    const browser = await this.getBrowser();
    if (!this.context) {
      this.context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });
    }
    return this.context;
  }

  async newPage(): Promise<Page> {
    const context = await this.getContext();
    return context.newPage();
  }

  async cleanup(): Promise<void> {
    try {
      if (this.context) {
        await this.context.close();
        this.context = null;
      }
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
    } catch (error) {
      console.error('⚠️ CHROMIUM_CLEANUP_ERROR:', error instanceof Error ? error.message : error);
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (process.env.ENABLE_METRICS === 'false') {
        console.log('📊 METRICS: disabled - health check skipped');
        return false;
      }
      
      if (!process.env.REAL_METRICS_ENABLED || process.env.REAL_METRICS_ENABLED === 'false') {
        console.log('ℹ️ CHROMIUM_HEALTH: Skipped (REAL_METRICS_ENABLED=false)');
        return false;
      }

      const browser = await this.getBrowser();
      const page = await this.newPage();
      
      await page.goto('data:text/html,<html><body><h1>Health Check</h1></body></html>');
      const title = await page.textContent('h1');
      await page.close();
      
      const isHealthy = title === 'Health Check';
      console.log(`✅ CHROMIUM_HEALTH: ${isHealthy ? 'Passed' : 'Failed'}`);
      return isHealthy;
      
    } catch (error) {
      console.error('❌ CHROMIUM_HEALTH_FAILED:', error instanceof Error ? error.message : error);
      return false;
    }
  }
}

// Export singleton instance
const browserManager = BrowserManager.getInstance();

export default browserManager;
export { BrowserManager };

// Legacy exports for compatibility
export const tryLaunchChromium = () => browserManager.getBrowser();
export const isBrowserEnabled = () => process.env.ENABLE_METRICS !== 'false' && process.env.REAL_METRICS_ENABLED !== 'false';