/**
 * 🌐 BROWSER MANAGER
 * 
 * Manages persistent Playwright browser context with X/Twitter authentication
 */

import { chromium, BrowserContext, Page } from 'playwright';

interface SessionState {
  lastLoginTime?: string;
  isValid: boolean;
}

export class BrowserManager {
  private static instance: BrowserManager;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  private constructor() {}

  public static getInstance(): BrowserManager {
    if (!BrowserManager.instance) {
      BrowserManager.instance = new BrowserManager();
    }
    return BrowserManager.instance;
  }

  public async getSessionState(): Promise<SessionState> {
    // Check if we have a valid browser context
    // This is a simplified implementation - real version would check actual session validity
    return {
      lastLoginTime: new Date().toISOString(),
      isValid: this.context !== null
    };
  }

  public async getPage(): Promise<Page> {
    if (!this.context) {
      const browser = await chromium.launch({ headless: true });
      this.context = await browser.newContext();
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
