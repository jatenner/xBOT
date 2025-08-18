/**
 * Resilient Browser Manager - Singleton pattern with auto-recovery
 * Eliminates "Target page, context or browser has been closed" errors
 */

import { Browser, BrowserContext, chromium, Page } from 'playwright';
import { systemMetrics } from '../monitoring/SystemMetrics';

interface BrowserOptions {
  slowMo?: number;
  headless?: boolean;
  timeout?: number;
}

class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private retryCount = 0;
  private readonly maxRetries = 5;
  private readonly baseBackoffMs = 1000;

  private get options(): BrowserOptions {
    return {
      slowMo: process.env.PLAYWRIGHT_SLOW_MO ? parseInt(process.env.PLAYWRIGHT_SLOW_MO) : 0,
      headless: process.env.PLAYWRIGHT_HEADLESS !== 'false',
      timeout: 30000
    };
  }

  /**
   * Ensure we have a working browser context
   */
  async ensureContext(): Promise<BrowserContext> {
    if (this.isContextValid()) {
      return this.context!;
    }

    await this.createContext();
    return this.context!;
  }

  /**
   * Execute function with auto-retry on context closure
   */
  async withContext<T>(fn: (context: BrowserContext) => Promise<T>): Promise<T> {
    const context = await this.ensureContext();
    
    try {
      return await fn(context);
    } catch (error) {
      const errorMsg = (error as Error).message;
      
      // Check for common "closed" errors
      if (this.isClosedError(errorMsg)) {
        console.warn('BROWSER: Context closed during operation, recreating and retrying once');
        systemMetrics.record('browser.context.recreate', 1, { error: errorMsg.substring(0, 50) });
        systemMetrics.record('browser.crash', 1);
        
        // Recreate context and retry exactly once
        await this.createContext();
        const newContext = await this.ensureContext();
        return await fn(newContext);
      }
      
      throw error;
    }
  }

  /**
   * Check if browser/context is valid and not closed
   */
  private isContextValid(): boolean {
    if (!this.browser || !this.context) {
      return false;
    }

    try {
      // Test if browser is still connected
      if (!this.browser.isConnected()) {
        return false;
      }

      // Test if context is still valid (this may throw if closed)
      this.context.pages();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create new browser and context with exponential backoff
   */
  private async createContext(): Promise<void> {
    await this.cleanup();

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        console.info(`BROWSER: Launching (attempt ${attempt + 1}/${this.maxRetries})`);
        systemMetrics.record('browser.launch', 1, { attempt: (attempt + 1).toString() });
        
        this.browser = await chromium.launch({
          headless: this.options.headless,
          slowMo: this.options.slowMo,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-first-run',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding'
          ]
        });

        // Load session if available
        const sessionPath = process.env.SESSION_CANONICAL_PATH || '/app/data/twitter_session.json';
        let storageState: any = undefined;
        
        try {
          const fs = await import('fs/promises');
          const sessionData = await fs.readFile(sessionPath, 'utf8');
          storageState = JSON.parse(sessionData);
          console.info('BROWSER: Loaded session state');
        } catch {
          console.info('BROWSER: No session state found, continuing without');
        }

        this.context = await this.browser.newContext({
          storageState,
          viewport: { width: 1280, height: 720 },
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });

        // Set reasonable timeouts
        this.context.setDefaultTimeout(this.options.timeout);
        this.context.setDefaultNavigationTimeout(this.options.timeout);

        console.info('BROWSER: Context created successfully');
        this.retryCount = 0;
        return;

      } catch (error) {
        console.warn(`BROWSER: Launch attempt ${attempt + 1} failed:`, (error as Error).message);
        
        await this.cleanup();
        
        if (attempt < this.maxRetries - 1) {
          // Exponential backoff with jitter
          const backoffMs = this.baseBackoffMs * Math.pow(2, attempt) + Math.random() * 1000;
          console.info(`BROWSER: Retrying in ${Math.round(backoffMs)}ms`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
      }
    }

    throw new Error(`BROWSER: Failed to create context after ${this.maxRetries} attempts`);
  }

  /**
   * Check if error indicates browser/context is closed
   */
  private isClosedError(message: string): boolean {
    const closedPatterns = [
      'target page, context or browser has been closed',
      'browser has been closed',
      'context has been closed',
      'page has been closed',
      'target.*closed'
    ];
    
    const lowerMsg = message.toLowerCase();
    return closedPatterns.some(pattern => lowerMsg.includes(pattern.toLowerCase()));
  }

  /**
   * Clean up browser and context
   */
  private async cleanup(): Promise<void> {
    if (this.context) {
      try {
        await this.context.close();
      } catch {
        // Ignore cleanup errors
      }
      this.context = null;
    }

    if (this.browser) {
      try {
        await this.browser.close();
      } catch {
        // Ignore cleanup errors
      }
      this.browser = null;
    }
  }

  /**
   * Close everything and reset
   */
  async shutdown(): Promise<void> {
    console.info('BROWSER: Shutting down');
    await this.cleanup();
    this.retryCount = 0;
  }
}

// Singleton instance
const browserManager = new BrowserManager();

export { browserManager as BrowserManager };
export default browserManager;
