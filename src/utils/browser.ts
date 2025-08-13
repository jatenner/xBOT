import { chromium, Browser, Page, BrowserContext } from 'playwright';

class PlaywrightFactory {
  private static instance: PlaywrightFactory;
  private browserPromise: Promise<Browser> | null = null;
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): PlaywrightFactory {
    if (!PlaywrightFactory.instance) {
      PlaywrightFactory.instance = new PlaywrightFactory();
    }
    return PlaywrightFactory.instance;
  }

  private async createBrowser(): Promise<Browser> {
    console.log('🌐 Launching browser with safe options...');
    
    // Safe launch options for Railway/Docker
    const browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox', 
        '--disable-dev-shm-usage',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ]
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
    const browser = await this.getBrowser();
    
    try {
      const contextOptions = storagePath ? { storageState: storagePath } : {};
      const ctx = await browser.newContext(contextOptions);
      const page = await ctx.newPage();
      return { ctx, page };
    } catch (error: any) {
      console.log('⚠️ Page creation failed, restarting browser...');
      
      // Clean up failed browser
      try { 
        await browser.close(); 
      } catch {}
      
      // Force new browser
      this.browserPromise = this.createBrowser();
      const newBrowser = await this.browserPromise;
      
      const contextOptions = storagePath ? { storageState: storagePath } : {};
      const ctx = await newBrowser.newContext(contextOptions);
      const page = await ctx.newPage();
      return { ctx, page };
    }
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