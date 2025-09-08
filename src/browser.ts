/**
 * Browser Management for xBOT
 * Handles Playwright browser instances and Twitter session management
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { readFileSync, existsSync } from 'fs';
import config from './config';

export class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;

  async initialize(): Promise<BrowserContext> {
    console.log('🌐 Initializing browser...');
    
    this.browser = await chromium.launch({
      headless: config.headless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });

    this.context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 }
    });

    // Load Twitter session if available
    await this.loadTwitterSession();

    console.log('✅ Browser initialized');
    return this.context;
  }

  private async loadTwitterSession(): Promise<void> {
    try {
      let sessionData = null;

      // Try loading from base64 first
      if (config.twitterSessionB64) {
        console.log('📦 Loading session from base64...');
        const decoded = Buffer.from(config.twitterSessionB64, 'base64').toString('utf-8');
        sessionData = JSON.parse(decoded);
      }
      // Fall back to file path
      else if (config.playwrightStoragePath && existsSync(config.playwrightStoragePath)) {
        console.log('📁 Loading session from file...');
        const fileContent = readFileSync(config.playwrightStoragePath, 'utf-8');
        sessionData = JSON.parse(fileContent);
      }

      if (sessionData && this.context) {
        await this.context.addCookies(sessionData.cookies || []);
        console.log('🍪 Twitter session loaded');
      } else {
        console.log('⚠️ No Twitter session found - authentication may be required');
      }
    } catch (error) {
      console.warn('⚠️ Failed to load Twitter session:', error.message);
    }
  }

  async createPage(): Promise<Page> {
    if (!this.context) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }
    return await this.context.newPage();
  }

  async navigateToTwitter(page: Page): Promise<void> {
    console.log('🐦 Navigating to Twitter...');
    await page.goto('https://x.com', { waitUntil: 'networkidle' });
    
    // Check if we're logged in
    const isLoggedIn = await this.checkIfLoggedIn(page);
    if (!isLoggedIn) {
      throw new Error('Not logged in to Twitter. Run seed:session to authenticate.');
    }
    
    console.log('✅ Twitter loaded and authenticated');
  }

  private async checkIfLoggedIn(page: Page): Promise<boolean> {
    try {
      // Look for elements that indicate we're logged in
      await page.waitForSelector('[data-testid="AppTabBar_Home_Link"], [aria-label="Home timeline"]', { 
        timeout: 10000 
      });
      return true;
    } catch {
      // Try alternative selectors
      const loginForm = await page.$('[data-testid="loginForm"]');
      return !loginForm;
    }
  }

  async close(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
    console.log('🔒 Browser closed');
  }

  isInitialized(): boolean {
    return this.browser !== null && this.context !== null;
  }
}

// Singleton instance
export const browserManager = new BrowserManager();
export default browserManager;
