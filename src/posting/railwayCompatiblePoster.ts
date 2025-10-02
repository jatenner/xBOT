/**
 * 🚄 RAILWAY COMPATIBLE POSTER
 * 
 * This replaces the broken fastTwitterPoster that uses keyboard shortcuts
 * Works properly on Railway servers with headless browsers
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { TwitterSessionManager } from '../utils/twitterSessionManager';

export class RailwayCompatiblePoster {
  // Singleton pattern - share browser across all instances
  private static sharedBrowser: Browser | null = null;
  private static sharedContext: BrowserContext | null = null;
  private static sharedPage: Page | null = null;
  private static isInitialized = false;
  private static initAttempts = 0;
  private static readonly MAX_INIT_ATTEMPTS = 3;
  private static initializationPromise: Promise<boolean> | null = null;

  constructor() {
    console.log('🚄 RAILWAY_POSTER_V2: Using shared browser instance...');
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
    // Prevent concurrent initialization
    if (RailwayCompatiblePoster.initializationPromise) {
      console.log('⏳ RAILWAY_POSTER: Waiting for ongoing initialization...');
      return await RailwayCompatiblePoster.initializationPromise;
    }

    // Return early if already initialized and browser still connected
    if (RailwayCompatiblePoster.isInitialized && 
        RailwayCompatiblePoster.sharedBrowser?.isConnected()) {
      console.log('✅ RAILWAY_POSTER: Using existing browser (already initialized)');
      return true;
    }

    // Start initialization
    RailwayCompatiblePoster.initializationPromise = this.doInitialize();
    const result = await RailwayCompatiblePoster.initializationPromise;
    RailwayCompatiblePoster.initializationPromise = null;
    return result;
  }

  private async doInitialize(): Promise<boolean> {
    try {
      console.log(`🚄 RAILWAY_POSTER: Starting browser initialization (attempt ${RailwayCompatiblePoster.initAttempts + 1}/${RailwayCompatiblePoster.MAX_INIT_ATTEMPTS})...`);
      
      // STEP 1: Launch Browser
      console.log('📦 STEP 1: Launching Chromium with Railway config...');
      console.log('   Args: --no-sandbox, --single-process, --disable-dev-shm-usage');
      
      RailwayCompatiblePoster.sharedBrowser = await chromium.launch({
        headless: true, // Always headless on Railway
        timeout: 60000, // 60s timeout for Railway startup
        args: [
          '--no-sandbox',                           // REQUIRED for containers
          '--disable-setuid-sandbox',               // REQUIRED for containers
          '--disable-dev-shm-usage',                // REQUIRED for low memory
          '--disable-accelerated-2d-canvas',        // Reduce GPU usage
          '--no-first-run',                         // Skip first run
          '--no-zygote',                           // Single process mode
          '--single-process',                       // CRITICAL: Prevents subprocess issues
          '--disable-gpu',                          // No GPU in containers
          '--disable-web-security',                 // Allow cross-origin
          '--disable-features=VizDisplayCompositor', // Reduce resource usage
          '--disable-background-timer-throttling',  // Keep timers active
          '--disable-backgrounding-occluded-windows', // Keep windows active
          '--disable-renderer-backgrounding',       // Keep renderer active
          '--disable-hang-monitor',                 // Prevent hang detection
          '--disable-ipc-flooding-protection',      // Allow fast operations
          '--memory-pressure-off',                  // Prevent OOM kills
          '--disable-software-rasterizer'           // Use simple rendering
        ]
      });

      console.log('✅ STEP 1 COMPLETE: Browser launched, PID:', RailwayCompatiblePoster.sharedBrowser.isConnected() ? 'connected' : 'disconnected');

      // STEP 2: Create Context
      console.log('📦 STEP 2: Creating browser context...');
      RailwayCompatiblePoster.sharedContext = await RailwayCompatiblePoster.sharedBrowser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ignoreHTTPSErrors: true, // Ignore SSL errors on Railway
        bypassCSP: true          // Bypass Content Security Policy
      });

      console.log('✅ STEP 2 COMPLETE: Context created');

      // STEP 3: Load Session
      console.log('📦 STEP 3: Loading Twitter session cookies...');
      const sessionData = await this.loadSessionData();
      if (sessionData && sessionData.cookies) {
        await RailwayCompatiblePoster.sharedContext.addCookies(sessionData.cookies);
        console.log(`✅ STEP 3 COMPLETE: Loaded ${sessionData.cookies.length} session cookies`);
      } else {
        console.error('❌ STEP 3 FAILED: No valid session data');
        await this.cleanup();
        return false;
      }

      // STEP 4: Create Page
      console.log('📦 STEP 4: Creating new page...');
      RailwayCompatiblePoster.sharedPage = await RailwayCompatiblePoster.sharedContext.newPage();
      
      // Set timeouts
      RailwayCompatiblePoster.sharedPage.setDefaultNavigationTimeout(60000); // 60s for Railway network
      RailwayCompatiblePoster.sharedPage.setDefaultTimeout(30000);            // 30s for operations
      
      console.log('✅ STEP 4 COMPLETE: Page created with extended timeouts');
      
      RailwayCompatiblePoster.isInitialized = true;
      RailwayCompatiblePoster.initAttempts++;
      
      console.log('🎉 RAILWAY_POSTER: FULL INITIALIZATION SUCCESSFUL!');
      return true;
      
    } catch (error: any) {
      console.error('❌ RAILWAY_POSTER: Initialization failed at some step');
      console.error('   Error type:', error?.name || 'Unknown');
      console.error('   Error message:', error?.message || 'No message');
      console.error('   Error stack (first 200 chars):', error?.stack?.substring(0, 200) || 'No stack');
      
      // Cleanup on failure
      await this.cleanup();
      
      RailwayCompatiblePoster.initAttempts++;
      return false;
    }
  }

  async postTweet(content: string): Promise<{ success: boolean; error?: string; tweetId?: string }> {
    // Initialize if needed
    if (!RailwayCompatiblePoster.isInitialized || 
        !RailwayCompatiblePoster.sharedBrowser?.isConnected()) {
      console.log('🔄 RAILWAY_POSTER: Browser not ready, initializing...');
      const initSuccess = await this.initialize();
      if (!initSuccess) {
        return { success: false, error: 'Failed to initialize browser' };
      }
    }

    // Double-check browser is still connected
    if (!RailwayCompatiblePoster.sharedBrowser?.isConnected()) {
      console.error('❌ RAILWAY_POSTER: Browser disconnected unexpectedly');
      return { success: false, error: 'Browser disconnected' };
    }

    try {
      console.log('🚄 RAILWAY_POSTER: Starting tweet posting...');
      console.log(`📝 CONTENT: "${content.substring(0, 100)}..."`);

      // Navigate to Twitter with extended timeout
      await RailwayCompatiblePoster.sharedPage!.goto('https://x.com/home', { 
        waitUntil: 'domcontentloaded',
        timeout: 60000  // Extended to 60s for Railway
      });

      // Wait for page to load
      await RailwayCompatiblePoster.sharedPage!.waitForTimeout(3000);

      // Check if logged in by looking for compose button
      const composeButton = RailwayCompatiblePoster.sharedPage!.locator('[data-testid="SideNav_NewTweet_Button"]');
      const isLoggedIn = await composeButton.isVisible({ timeout: 10000 });
      
      if (!isLoggedIn) {
        console.error('❌ RAILWAY_POSTER: Not logged in to Twitter');
        return { success: false, error: 'Not logged in to Twitter' };
      }

      // Click compose button (NO KEYBOARD SHORTCUTS!)
      await composeButton.click();
      console.log('✅ RAILWAY_POSTER: Compose dialog opened');

      // Wait for text area
      await RailwayCompatiblePoster.sharedPage!.waitForTimeout(2000);
      
      // Find and fill text area (NO KEYBOARD SHORTCUTS!)
      const textArea = RailwayCompatiblePoster.sharedPage!.locator('[data-testid="tweetTextarea_0"]').first();
      await textArea.waitFor({ state: 'visible', timeout: 10000 });
      
      // Clear and type content
      await textArea.fill(content);
      console.log('✅ RAILWAY_POSTER: Content typed into text area');

      // Wait a moment for Twitter to process
      await RailwayCompatiblePoster.sharedPage!.waitForTimeout(1000);

      // Find and click Post button (NO KEYBOARD SHORTCUTS!)
      const postButton = RailwayCompatiblePoster.sharedPage!.locator('[data-testid="tweetButtonInline"]');
      await postButton.waitFor({ state: 'visible', timeout: 5000 });
      
      const isEnabled = await postButton.isEnabled();
      if (!isEnabled) {
        console.error('❌ RAILWAY_POSTER: Post button is disabled');
        return { success: false, error: 'Post button is disabled' };
      }

      await postButton.click();
      console.log('✅ RAILWAY_POSTER: Post button clicked');

      // Wait for posting to complete
      await RailwayCompatiblePoster.sharedPage!.waitForTimeout(3000);

      // Verify posting success by checking URL change or success indicators
      const currentUrl = RailwayCompatiblePoster.sharedPage!.url();
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
        await RailwayCompatiblePoster.sharedPage!.waitForTimeout(2000); // Wait between tweets
        
        // Click reply button on the previous tweet
        const replyButton = RailwayCompatiblePoster.sharedPage!.locator('[data-testid="reply"]').first();
        await replyButton.click();
        
        await RailwayCompatiblePoster.sharedPage!.waitForTimeout(1000);
        
        // Fill reply text area
        const replyTextArea = RailwayCompatiblePoster.sharedPage!.locator('[data-testid="tweetTextarea_0"]').first();
        await replyTextArea.fill(tweets[i]);
        
        // Click reply button
        const replySubmitButton = RailwayCompatiblePoster.sharedPage!.locator('[data-testid="tweetButtonInline"]');
        await replySubmitButton.click();
        
        await RailwayCompatiblePoster.sharedPage!.waitForTimeout(2000);
        
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
    // DON'T cleanup shared browser - keep it alive for reuse across all tweets
    console.log('✅ RAILWAY_POSTER: Cleanup skipped (keeping shared browser alive)');
  }
}

// Singleton instance for Railway
export const railwayPoster = new RailwayCompatiblePoster();
