/**
 * 🚄 RAILWAY COMPATIBLE POSTER
 * 
 * This replaces the broken fastTwitterPoster that uses keyboard shortcuts
 * Works properly on Railway servers with headless browsers
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { TwitterSessionManager } from '../utils/twitterSessionManager';

export class RailwayCompatiblePoster {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private isInitialized = false;

  constructor() {
    console.log('🚄 RAILWAY_POSTER: Initializing Railway-compatible Twitter poster...');
  }

  private async loadSessionData(): Promise<any> {
    try {
      const { railwaySessionManager } = await import('../utils/railwaySessionManager');
      
      // Ensure we have a valid session
      const hasValidSession = await railwaySessionManager.ensureValidSession();
      if (!hasValidSession) {
        console.error('❌ RAILWAY_POSTER: No valid session available');
        return null;
      }
      
      const fs = require('fs');
      const path = require('path');
      const sessionPath = path.join(process.cwd(), 'data', 'twitter_session.json');
      
      if (!fs.existsSync(sessionPath)) {
        console.log('❌ RAILWAY_POSTER: No session file found after validation');
        return null;
      }
      
      const sessionData = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
      console.log('✅ RAILWAY_POSTER: Valid session loaded successfully');
      return sessionData;
    } catch (error: any) {
      console.error('❌ RAILWAY_POSTER: Error loading session:', error.message);
      return null;
    }
  }

  async initialize(): Promise<boolean> {
    try {
      console.log('🚄 RAILWAY_POSTER: Starting browser initialization...');
      
      // Railway-specific browser configuration
      this.browser = await chromium.launch({
        headless: true, // Always headless on Railway
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ]
      });

      this.context = await this.browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });

      // Load Twitter session
      const sessionData = await this.loadSessionData();
      if (sessionData && sessionData.cookies) {
        await this.context.addCookies(sessionData.cookies);
        console.log(`🚄 RAILWAY_POSTER: Loaded ${sessionData.cookies.length} session cookies`);
      } else {
        console.error('❌ RAILWAY_POSTER: Failed to load valid session data');
        return false;
      }

      this.page = await this.context.newPage();
      this.isInitialized = true;
      
      console.log('✅ RAILWAY_POSTER: Browser initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ RAILWAY_POSTER: Browser initialization failed:', error);
      return false;
    }
  }

  async postTweet(content: string): Promise<{ success: boolean; error?: string; tweetId?: string }> {
    if (!this.isInitialized || !this.page) {
      const initSuccess = await this.initialize();
      if (!initSuccess) {
        return { success: false, error: 'Failed to initialize browser' };
      }
    }

    try {
      console.log('🚄 RAILWAY_POSTER: Starting tweet posting...');
      console.log(`📝 CONTENT: "${content.substring(0, 100)}..."`);

      // Navigate to Twitter
      await this.page!.goto('https://x.com/home', { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });

      // Wait for page to load
      await this.page!.waitForTimeout(3000);

      // Check if logged in by looking for compose button
      const composeButton = this.page!.locator('[data-testid="SideNav_NewTweet_Button"]');
      const isLoggedIn = await composeButton.isVisible({ timeout: 10000 });
      
      if (!isLoggedIn) {
        console.error('❌ RAILWAY_POSTER: Not logged in to Twitter');
        return { success: false, error: 'Not logged in to Twitter' };
      }

      // Click compose button (NO KEYBOARD SHORTCUTS!)
      await composeButton.click();
      console.log('✅ RAILWAY_POSTER: Compose dialog opened');

      // Wait for text area
      await this.page!.waitForTimeout(2000);
      
      // Find and fill text area (NO KEYBOARD SHORTCUTS!)
      const textArea = this.page!.locator('[data-testid="tweetTextarea_0"]').first();
      await textArea.waitFor({ state: 'visible', timeout: 10000 });
      
      // Clear and type content
      await textArea.fill(content);
      console.log('✅ RAILWAY_POSTER: Content typed into text area');

      // Wait a moment for Twitter to process
      await this.page!.waitForTimeout(1000);

      // Find and click Post button (NO KEYBOARD SHORTCUTS!)
      const postButton = this.page!.locator('[data-testid="tweetButtonInline"]');
      await postButton.waitFor({ state: 'visible', timeout: 5000 });
      
      const isEnabled = await postButton.isEnabled();
      if (!isEnabled) {
        console.error('❌ RAILWAY_POSTER: Post button is disabled');
        return { success: false, error: 'Post button is disabled' };
      }

      await postButton.click();
      console.log('✅ RAILWAY_POSTER: Post button clicked');

      // Wait for posting to complete
      await this.page!.waitForTimeout(3000);

      // Verify posting success by checking URL change or success indicators
      const currentUrl = this.page!.url();
      const isSuccess = currentUrl.includes('/home') || currentUrl.includes('/status/');

      if (isSuccess) {
        console.log('✅ RAILWAY_POSTER: Tweet posted successfully');
        return { success: true, tweetId: `railway_${Date.now()}` };
      } else {
        console.error('❌ RAILWAY_POSTER: Post verification failed');
        return { success: false, error: 'Post verification failed' };
      }

    } catch (error) {
      console.error('❌ RAILWAY_POSTER: Posting failed:', error);
      return { success: false, error: error.message };
    }
  }

  async postThread(tweets: string[]): Promise<{ success: boolean; error?: string; tweetIds?: string[] }> {
    if (tweets.length === 0) {
      return { success: false, error: 'No tweets provided' };
    }

    const tweetIds: string[] = [];
    
    try {
      // Post first tweet
      const firstResult = await this.postTweet(tweets[0]);
      if (!firstResult.success) {
        return { success: false, error: `Failed to post first tweet: ${firstResult.error}` };
      }
      
      if (firstResult.tweetId) {
        tweetIds.push(firstResult.tweetId);
      }

      // Post remaining tweets as replies
      for (let i = 1; i < tweets.length; i++) {
        await this.page!.waitForTimeout(2000); // Wait between tweets
        
        // Click reply button on the previous tweet
        const replyButton = this.page!.locator('[data-testid="reply"]').first();
        await replyButton.click();
        
        await this.page!.waitForTimeout(1000);
        
        // Fill reply text area
        const replyTextArea = this.page!.locator('[data-testid="tweetTextarea_0"]').first();
        await replyTextArea.fill(tweets[i]);
        
        // Click reply button
        const replySubmitButton = this.page!.locator('[data-testid="tweetButtonInline"]');
        await replySubmitButton.click();
        
        await this.page!.waitForTimeout(2000);
        
        tweetIds.push(`railway_${Date.now()}_${i}`);
        console.log(`✅ RAILWAY_POSTER: Posted thread tweet ${i + 1}/${tweets.length}`);
      }

      return { success: true, tweetIds };
    } catch (error) {
      console.error('❌ RAILWAY_POSTER: Thread posting failed:', error);
      return { success: false, error: error.message };
    }
  }

  async cleanup(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close();
      }
      if (this.context) {
        await this.context.close();
      }
      if (this.browser) {
        await this.browser.close();
      }
      this.isInitialized = false;
      console.log('✅ RAILWAY_POSTER: Cleanup completed');
    } catch (error) {
      console.error('❌ RAILWAY_POSTER: Cleanup failed:', error);
    }
  }
}

// Singleton instance for Railway
export const railwayPoster = new RailwayCompatiblePoster();
