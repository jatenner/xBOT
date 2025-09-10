/**
 * 🎭 RAILWAY BROWSER MANAGER
 * Centralized browser management with auto-recovery and persistent context support
 * Handles TargetClosedError and browser disconnection gracefully
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';

interface BrowserRelaunchSchedule {
  scheduled: boolean;
  backoffMs: number;
  attempts: number;
  lastRelaunch: number;
}

export class RailwayBrowserManager {
  private static instance: RailwayBrowserManager;
  private browser: Browser | null = null;
  private persistentContext: BrowserContext | null = null;
  private relaunchSchedule: BrowserRelaunchSchedule = {
    scheduled: false,
    backoffMs: 5000,
    attempts: 0,
    lastRelaunch: 0
  };
  private isLaunching = false;
  private readonly maxRelaunchAttempts = 5;
  private readonly backoffMultiplier = 1.5;
  private readonly maxBackoffMs = 60000;

  public static getInstance(): RailwayBrowserManager {
    if (!RailwayBrowserManager.instance) {
      RailwayBrowserManager.instance = new RailwayBrowserManager();
    }
    return RailwayBrowserManager.instance;
  }

  /**
   * Get browser instance with auto-launch
   */
  async getBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.isConnected()) {
      await this.launchBrowser();
    }
    return this.browser!;
  }

  /**
   * Get persistent context (launchPersistentContext when possible)
   */
  async getPersistentContext(): Promise<BrowserContext> {
    if (!this.persistentContext || this.persistentContext.browser()?.isConnected() === false) {
      await this.createPersistentContext();
    }
    return this.persistentContext!;
  }

  /**
   * Create a new page with auto-recovery
   */
  async createPage(): Promise<Page> {
    try {
      const context = await this.getPersistentContext();
      return await context.newPage();
    } catch (error) {
      console.warn('🔄 BROWSER_MANAGER: Page creation failed, scheduling relaunch');
      this.scheduleBrowserRelaunch({ backoffMs: 2000 });
      throw error;
    }
  }

  /**
   * Execute function with browser recovery
   */
  async withBrowser<T>(fn: (browser: Browser) => Promise<T>): Promise<T> {
    try {
      const browser = await this.getBrowser();
      return await fn(browser);
    } catch (error: any) {
      if (this.isBrowserError(error.message)) {
        console.warn('🔄 BROWSER_MANAGER: Browser error detected, scheduling relaunch:', error.message);
        this.scheduleBrowserRelaunch({ backoffMs: 3000 });
      }
      throw error;
    }
  }

  /**
   * Execute function with page recovery
   */
  async withPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
    try {
      const page = await this.createPage();
      try {
        return await fn(page);
      } finally {
        await page.close().catch(() => {}); // Safe cleanup
      }
    } catch (error: any) {
      if (this.isBrowserError(error.message)) {
        console.warn('🔄 BROWSER_MANAGER: Page error detected, scheduling relaunch:', error.message);
        this.scheduleBrowserRelaunch({ backoffMs: 2000 });
      }
      throw error;
    }
  }

  /**
   * Schedule browser relaunch with backoff
   */
  scheduleBrowserRelaunch(options: { backoffMs?: number } = {}): void {
    const { backoffMs = this.relaunchSchedule.backoffMs } = options;
    
    if (this.relaunchSchedule.scheduled) {
      console.log('🔄 BROWSER_RELAUNCH: Already scheduled, skipping');
      return;
    }

    if (this.relaunchSchedule.attempts >= this.maxRelaunchAttempts) {
      console.error('🚨 BROWSER_RELAUNCH: Max attempts reached, giving up');
      return;
    }

    this.relaunchSchedule.scheduled = true;
    this.relaunchSchedule.attempts++;
    this.relaunchSchedule.backoffMs = Math.min(
      backoffMs * this.backoffMultiplier,
      this.maxBackoffMs
    );

    console.log(`🔄 BROWSER_RELAUNCH: Scheduled in ${backoffMs}ms (attempt ${this.relaunchSchedule.attempts})`);

    setTimeout(async () => {
      try {
        await this.executeRelaunch();
      } catch (error: any) {
        console.error('🚨 BROWSER_RELAUNCH: Failed to relaunch browser:', error.message);
      } finally {
        this.relaunchSchedule.scheduled = false;
      }
    }, backoffMs);
  }

  /**
   * Execute browser relaunch
   */
  private async executeRelaunch(): Promise<void> {
    console.log('🔄 BROWSER_RELAUNCH: Executing browser relaunch...');
    this.relaunchSchedule.lastRelaunch = Date.now();

    try {
      // Close existing browser safely
      await this.cleanup();
      
      // Launch new browser
      await this.launchBrowser();
      
      // Reset relaunch attempts on success
      this.relaunchSchedule.attempts = 0;
      this.relaunchSchedule.backoffMs = 5000;
      
      console.log('✅ BROWSER_RELAUNCH: Browser successfully relaunched');
    } catch (error: any) {
      console.error('❌ BROWSER_RELAUNCH: Relaunch failed:', error.message);
      throw error;
    }
  }

  /**
   * Launch browser with Railway-compatible configuration
   */
  private async launchBrowser(): Promise<void> {
    if (this.isLaunching) {
      while (this.isLaunching) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return;
    }

    this.isLaunching = true;
    try {
      console.log('🚀 BROWSER_LAUNCH: Starting Railway-compatible browser...');

      // Railway-optimized minimal configuration
      const railwayArgs = [
        '--no-sandbox',           // Required for containers
        '--disable-dev-shm-usage', // Required for low memory
        '--disable-gpu',          // Safe for headless
        '--mute-audio',          // Reduce resource usage
        '--disable-extensions',   // Clean environment
        '--no-first-run',        // Skip first run
        '--disable-default-apps', // Reduce memory
        '--memory-pressure-off'   // Prevent OOM kills
      ];

      this.browser = await chromium.launch({
        headless: true,
        args: railwayArgs,
        timeout: 30000
      });

      console.log('✅ BROWSER_LAUNCH: Railway browser launched successfully');
      console.log(`🔧 CHROMIUM_ARGS: ${railwayArgs.join(' ')}`);
    } finally {
      this.isLaunching = false;
    }
  }

  /**
   * Create persistent context with session support
   */
  private async createPersistentContext(): Promise<void> {
    try {
      const browser = await this.getBrowser();
      
      // Try to load session if available
      const sessionB64 = process.env.TWITTER_SESSION_B64;
      let storageState: any = undefined;
      
      if (sessionB64) {
        try {
          const sessionData = Buffer.from(sessionB64, 'base64').toString('utf-8');
          storageState = JSON.parse(sessionData);
          console.log('📱 BROWSER_SESSION: Loaded session state from environment');
        } catch (error) {
          console.warn('⚠️ BROWSER_SESSION: Failed to load session state');
        }
      }

      this.persistentContext = await browser.newContext({
        storageState,
        viewport: { width: 1280, height: 720 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });

      // Set reasonable timeouts
      this.persistentContext.setDefaultTimeout(30000);
      this.persistentContext.setDefaultNavigationTimeout(30000);

      console.log('✅ BROWSER_CONTEXT: Persistent context created');
    } catch (error: any) {
      console.error('❌ BROWSER_CONTEXT: Failed to create context:', error.message);
      throw error;
    }
  }

  /**
   * Check if error is browser-related
   */
  private isBrowserError(message: string): boolean {
    const browserErrorPatterns = [
      'Target closed',
      'Browser closed',
      'Context closed',
      'Page closed',
      '_didDisconnect',
      'Protocol error',
      'Connection closed',
      'Target page, context or browser has been closed',
      'Execution context was destroyed'
    ];

    return browserErrorPatterns.some(pattern => 
      message.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * Test browser health
   */
  async testBrowserHealth(): Promise<{ healthy: boolean; error?: string }> {
    try {
      console.log('🧪 BROWSER_HEALTH: Testing browser functionality...');
      
      const page = await this.createPage();
      await page.goto('about:blank', { timeout: 5000 });
      await page.close();
      
      console.log('✅ BROWSER_HEALTH: Browser is healthy');
      return { healthy: true };
    } catch (error: any) {
      console.error('❌ BROWSER_HEALTH: Browser test failed:', error.message);
      return { healthy: false, error: error.message };
    }
  }

  /**
   * Get browser statistics
   */
  getStats(): {
    connected: boolean;
    relaunchAttempts: number;
    lastRelaunch: number;
    relaunchScheduled: boolean;
  } {
    return {
      connected: this.browser?.isConnected() || false,
      relaunchAttempts: this.relaunchSchedule.attempts,
      lastRelaunch: this.relaunchSchedule.lastRelaunch,
      relaunchScheduled: this.relaunchSchedule.scheduled
    };
  }

  /**
   * Cleanup browser resources
   */
  async cleanup(): Promise<void> {
    try {
      if (this.persistentContext) {
        await this.persistentContext.close().catch(() => {});
        this.persistentContext = null;
      }
      
      if (this.browser) {
        await this.browser.close().catch(() => {});
        this.browser = null;
      }
      
      console.log('🧹 BROWSER_CLEANUP: Resources cleaned up');
    } catch (error: any) {
      console.warn('⚠️ BROWSER_CLEANUP: Cleanup warning:', error.message);
    }
  }
}

// Export singleton instance
export const railwayBrowserManager = RailwayBrowserManager.getInstance();
