import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

class PlaywrightFactory {
  private static instance: PlaywrightFactory;
  private browserPromise: Promise<Browser> | null = null;
  private isInitialized = false;
  private isRailway = process.env.RAILWAY_ENVIRONMENT === 'production';

  private constructor() {}

  public static getInstance(): PlaywrightFactory {
    if (!PlaywrightFactory.instance) {
      PlaywrightFactory.instance = new PlaywrightFactory();
    }
    return PlaywrightFactory.instance;
  }



  private async createBrowser(): Promise<Browser> {
    console.log('🌐 Launching browser with safe options...');
    
    // Stock Playwright launch with minimal args
    const browser = await chromium.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      headless: true
    });
    
    if (!this.isInitialized) {
      console.log('✅ PLAYWRIGHT_FACTORY_READY');
      this.isInitialized = true;
    }
    
    return browser;
  }

  public async getBrowser(): Promise<Browser> {
    if (!this.browserPromise) {
      this.browserPromise = this.createBrowser();
    }
    
    try {
      const browser = await this.browserPromise;
      // Test if browser is still connected
      if (!browser.isConnected()) {
        throw new Error('Browser disconnected');
      }
      return browser;
    } catch (error) {
      console.log('🔄 Browser failed, creating new one...');
      this.browserPromise = this.createBrowser();
      return this.browserPromise;
    }
  }

  public async getPageWithStorage(storagePath?: string): Promise<{ctx: BrowserContext, page: Page}> {
    let attempt = 1;
    const maxAttempts = 3;
    
    while (attempt <= maxAttempts) {
      try {
        const browser = await this.getBrowser();
        
        // Always try to load data/twitter_session.json first, then fallback to provided path
        const defaultSessionPath = path.resolve('data', 'twitter_session.json');
        const sessionPath = storagePath || defaultSessionPath;
        
        // Prepare context options with fallback for invalid storage state
        let contextOptions: any = {};
        
        try {
          // Check if storage file exists and is valid
          if (fs.existsSync(sessionPath)) {
            const stats = fs.statSync(sessionPath);
            if (stats.size > 0) {
              // Load and log session info
              const sessionData = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
              const cookieNames = (sessionData.cookies || []).map((c: any) => c.name);
              
              contextOptions.storageState = sessionPath;
              console.log(`📱 SESSION: loaded storageState with cookies: ${cookieNames.length}`);
              console.log(`📱 SESSION: cookie names: ${cookieNames.slice(0, 10).join(', ')}${cookieNames.length > 10 ? '...' : ''}`);
            }
          } else {
            console.log('🆕 SESSION: no storageState found – starting without cookies');
          }
        } catch (storageError) {
          console.warn('⚠️ SESSION: Invalid storage state file, creating fresh session:', storageError.message);
        }
        
        const ctx = await browser.newContext(contextOptions);
        const page = await ctx.newPage();
        
        // Verify the context and page are functional
        await page.waitForTimeout(100); // Small delay to ensure context is ready
        
        console.log(`✅ Browser context created successfully (attempt ${attempt})`);
        return { ctx, page };
        
      } catch (error: any) {
        console.log(`⚠️ Page creation failed (attempt ${attempt}/${maxAttempts}):`, error.message);
        
        if (attempt === maxAttempts) {
          throw new Error(`Failed to create browser context after ${maxAttempts} attempts: ${error.message}`);
        }
        
        // Clean up failed browser and force new one
        try {
          const browser = await this.getBrowser();
          await browser.close();
        } catch (cleanupError) {
          console.warn('⚠️ Browser cleanup error:', cleanupError.message);
        }
        
        // Reset browser promise to force new browser creation
        this.browserPromise = null;
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        attempt++;
      }
    }
    
    throw new Error('Failed to create browser context after all retry attempts');
  }
}

// Export convenience functions
const factory = PlaywrightFactory.getInstance();

export async function getBrowser(): Promise<Browser> {
  return factory.getBrowser();
}

export async function getPageWithStorage(storagePath?: string): Promise<{ctx: BrowserContext, page: Page}> {
  return factory.getPageWithStorage(storagePath);
}