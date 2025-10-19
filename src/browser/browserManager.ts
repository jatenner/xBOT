/**
 * 🌐 BROWSER MANAGER
 * 
 * Manages persistent Playwright browser context with X/Twitter authentication
 */

import { chromium, BrowserContext, Page } from 'playwright';
import { SessionLoader } from '../utils/sessionLoader';
import fs from 'fs';

interface SessionState {
  lastLoginTime?: string;
  isValid: boolean;
}

export class BrowserManager {
  private static instance: BrowserManager;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private sessionLoaded: boolean = false;

  private constructor() {}

  public static getInstance(): BrowserManager {
    if (!BrowserManager.instance) {
      BrowserManager.instance = new BrowserManager();
    }
    return BrowserManager.instance;
  }

  public async getSessionState(): Promise<SessionState> {
    // Check if we have a valid browser context and session
    const sessionResult = SessionLoader.getLastResult();
    return {
      lastLoginTime: sessionResult?.updatedAt,
      isValid: this.context !== null && this.sessionLoaded
    };
  }

  public async getPage(): Promise<Page> {
    if (!this.context) {
      console.log('🌐 BROWSER_MANAGER: Initializing browser with session...');
      
      // Load session first
      const sessionResult = SessionLoader.load();
      
      const browser = await chromium.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      // If we have a valid session file, load it into the context
      if (sessionResult.ok && fs.existsSync(sessionResult.path)) {
        console.log(`🔐 BROWSER_MANAGER: Loading session from ${sessionResult.path} (${sessionResult.cookieCount} cookies)`);
        try {
          const sessionData = JSON.parse(fs.readFileSync(sessionResult.path, 'utf8'));
          this.context = await browser.newContext({
            storageState: sessionData
          });
          this.sessionLoaded = true;
          console.log('✅ BROWSER_MANAGER: Session loaded successfully');
        } catch (error) {
          console.error('❌ BROWSER_MANAGER: Failed to load session, using fresh context:', error);
          this.context = await browser.newContext();
          this.sessionLoaded = false;
        }
      } else {
        console.log('⚠️ BROWSER_MANAGER: No valid session found, using fresh context');
        this.context = await browser.newContext();
        this.sessionLoaded = false;
      }
    }

    if (!this.page) {
      this.page = await this.context.newPage();
    }

    return this.page;
  }

  public async releasePage(page: Page): Promise<void> {
    // Keep context alive but can close page if needed
    await page.close();
    this.page = null;
  }

  public async closeBrowser(): Promise<void> {
    if (this.page) {
      await this.page.close();
      this.page = null;
    }
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
  }
}
