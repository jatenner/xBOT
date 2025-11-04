/**
 * Simplified Bulletproof Poster for Railway
 * Single browser instance to prevent conflicts
 */

import { ENV } from '../config/env';
import { log } from '../lib/logger';
import { Browser, BrowserContext, Page, chromium } from 'playwright';

class SimplifiedBulletproofPoster {
  private static instance: SimplifiedBulletproofPoster;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private sessionLoaded = false;

  static getInstance(): SimplifiedBulletproofPoster {
    if (!this.instance) {
      this.instance = new SimplifiedBulletproofPoster();
    }
    return this.instance;
  }

  async ensureBrowser(): Promise<void> {
    if (this.browser && this.context && this.page) {
      try {
        await this.page.evaluate(() => document.title);
        return; // Browser is healthy
      } catch {
        log({ op: 'browser_recovery', action: 'restart' });
        await this.cleanup();
      }
    }

    log({ op: 'simplified_browser_start' });
    
    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--single-process',
        '--no-zygote',
        '--disable-gpu'
      ]
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 720 }
    });

    // CRITICAL: Load Twitter session if available
    if (ENV.TWITTER_SESSION_B64) {
      try {
        const sessionData = Buffer.from(ENV.TWITTER_SESSION_B64, 'base64').toString('utf-8');
        const sessionJson = JSON.parse(sessionData);
        
        if (sessionJson.cookies && Array.isArray(sessionJson.cookies)) {
          await this.context.addCookies(sessionJson.cookies);
          log({ op: 'session_load', cookie_count: sessionJson.cookies.length, source: 'TWITTER_SESSION_B64' });
        } else if (Array.isArray(sessionJson)) {
          await this.context.addCookies(sessionJson);
          console.log(`🍪 SESSION_LOADED: ${sessionJson.length} cookies from TWITTER_SESSION_B64`);
        } else {
          console.log('⚠️ SESSION_FORMAT: Unknown session format');
        }
      } catch (sessionError) {
        console.log('❌ SESSION_ERROR:', sessionError.message);
      }
    } else {
      console.log('⚠️ NO_SESSION: TWITTER_SESSION_B64 not found');
    }

    // Mark session as loaded (handled above)
    this.sessionLoaded = true;

    this.page = await this.context.newPage();
    console.log('✅ SIMPLIFIED_BROWSER: Ready for posting');
  }

  async postContent(content: string): Promise<{ success: boolean; tweetId?: string; error?: string }> {
    // 🐦 CANARY LOG: Detect if legacy bulletproof poster is called
    console.log('CANARY:LEGACY_BULLETPROOF_POSTER_CALLED', new Date().toISOString());
    
    // 🚨 THREAD PIPELINE GUARD: Block if thread pipeline only
    if (process.env.THREAD_PIPELINE_ONLY === 'true') {
      console.log('🚨 LEGACY_BULLETPROOF_POSTER: DISABLED by THREAD_PIPELINE_ONLY');
      return { success: false, error: 'Disabled by THREAD_PIPELINE_ONLY flag' };
    }
    
    try {
      await this.ensureBrowser();

      console.log(`📝 POSTING_TWEET: "${content.substring(0, 50)}..."`);
      console.log('🏠 NAVIGATE_HOME: Going to Twitter home...');
      
      // Try multiple URLs and navigation strategies
      const urls = ['https://x.com/home', 'https://x.com/compose/tweet'];
      let navigated = false;
      
      for (const url of urls) {
        try {
          console.log(`🔄 Trying: ${url}`);
          await this.page!.goto(url, { 
            waitUntil: 'domcontentloaded',
            timeout: 20000
          });
          await this.page!.waitForTimeout(2000); // Let page settle
          navigated = true;
          console.log(`✅ Successfully navigated to: ${url}`);
          break;
        } catch (navError) {
          console.log(`❌ Navigation failed for ${url}:`, navError);
          continue;
        }
      }
      
      if (!navigated) {
        throw new Error('Failed to navigate to any Twitter URL');
      }

      // DIAGNOSTIC: Check what page we actually landed on
      const pageTitle = await this.page!.title();
      const pageUrl = this.page!.url();
      console.log(`📄 PAGE_INFO: Title="${pageTitle}" URL="${pageUrl}"`);
      
      // Check if we're on a login page or blocked
      const loginElements = await this.page!.locator('text=Log in, text=Sign up, text=suspended, text=challenge').count();
      if (loginElements > 0) {
        console.log('🚨 BLOCKED: Detected login/challenge page - session may be invalid or account suspended');
      }

      // Robust composer selectors with role-based fallbacks
      const composerSelectors = [
        // Primary selectors
        '[data-testid="tweetTextarea_0"]',
        '[contenteditable="true"][data-testid*="tweet"]',
        
        // Role-based selectors (more robust)
        'role=textbox[name="Post text"]',
        'role=textbox[name*="What\'s happening"]',
        'role=textbox[name*="Tweet text"]',
        
        // Fallback selectors
        '[contenteditable="true"]',
        'div[contenteditable="true"]',
        '.public-DraftEditor-content',
        '[placeholder*="happening"]',
        '[placeholder*="What"]'
      ];
      
      let composerFound = false;
      let workingSelector = '';
      
      for (const selector of composerSelectors) {
        try {
          console.log(`🔍 Testing selector: ${selector}`);
          await this.page!.waitForSelector(selector, { timeout: 2000 });
          
          const element = this.page!.locator(selector).first();
          if (await element.isVisible()) {
            workingSelector = selector;
            composerFound = true;
            console.log(`✅ FOUND composer with: ${selector}`);
            break;
          }
        } catch (error) {
          console.log(`❌ Selector failed: ${selector}`);
          continue;
        }
      }
      
      if (!composerFound) {
        // Take screenshot for debugging
        try {
          await this.page!.screenshot({ path: '/tmp/twitter-debug.png', fullPage: true });
          console.log('📸 Debug screenshot saved to /tmp/twitter-debug.png');
        } catch (screenError) {
          console.log('⚠️ Screenshot failed');
        }
        throw new Error(`No composer found. Tried ${composerSelectors.length} selectors.`);
      }
      
      const composerSelector = workingSelector;
      
      const composer = await this.page!.locator(composerSelector).first();
      
      // Clear and focus composer
      await composer.click();
      await composer.clear();
      
      // Fill content with keyboard fallback
      try {
        await composer.fill(content);
      } catch (fillError) {
        console.log('⚠️ Fill failed, trying keyboard input...');
        await composer.focus();
        await this.page!.keyboard.press('KeyN'); // Clear with Ctrl+A
        await this.page!.keyboard.type(content);
      }
      
      // CRITICAL: Assert composer text matches draft
      await this.page!.waitForTimeout(500); // Let content settle
      const actualText = await composer.textContent() || await composer.inputValue() || '';
      const contentMatch = actualText.includes(content.substring(0, 50)); // Check first 50 chars
      
      if (!contentMatch) {
        console.error(`❌ TEXT_ASSERTION_FAILED: Expected "${content.substring(0, 50)}...", got "${actualText.substring(0, 50)}..."`);
        
        // Try one more time with keyboard
        await composer.clear();
        await composer.focus();
        await this.page!.keyboard.type(content);
        
        const retryText = await composer.textContent() || await composer.inputValue() || '';
        if (!retryText.includes(content.substring(0, 50))) {
          throw new Error(`Text assertion failed twice: content not properly entered`);
        }
      }
      
      console.log(`✅ TEXT_VERIFIED: Composer contains expected content`);

      // Post button with robust selector
      const postButtonSelectors = [
        '[data-testid="tweetButtonInline"]',
        '[data-testid="tweetButton"]',
        'role=button[name="Post"]',
        'role=button[name*="Tweet"]',
        '[data-testid*="post"]'
      ];
      
      let postButton;
      for (const selector of postButtonSelectors) {
        try {
          postButton = this.page!.locator(selector).first();
          if (await postButton.isVisible() && await postButton.isEnabled()) {
            console.log(`✅ POST_BUTTON: Found with ${selector}`);
            break;
          }
        } catch (error) {
          continue;
        }
      }
      
      if (!postButton) {
        throw new Error('No post button found');
      }
      
      await postButton.click();

      // Wait for posting to complete
      await this.page!.waitForTimeout(3000);

      console.log('✅ POST_SUCCESS: Content posted successfully');
      return { success: true, tweetId: `post_${Date.now()}` };

    } catch (error) {
      console.error('❌ POST_FAILED:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async postThread(tweets: string[]): Promise<{ success: boolean; tweetIds?: string[]; error?: string }> {
    try {
      console.log(`🧵 POSTING_THREAD: ${tweets.length} tweets`);
      
      // Verify thread format (1/n numbering)
      const hasProperNumbering = tweets.every((tweet, index) => {
        const expectedPrefix = `${index + 1}/${tweets.length}`;
        const hasNumbering = tweet.startsWith(expectedPrefix);
        if (!hasNumbering) {
          console.warn(`⚠️ THREAD_FORMAT: Tweet ${index + 1} missing 1/n format: "${tweet.substring(0, 30)}..."`);
        }
        return hasNumbering;
      });
      
      if (!hasProperNumbering) {
        console.warn('⚠️ THREAD_WARNING: Some tweets missing 1/n format, continuing anyway...');
      } else {
        console.log(`✅ THREAD_FORMAT: All ${tweets.length} tweets have proper 1/n numbering`);
      }
      
      const tweetIds: string[] = [];

      for (let i = 0; i < tweets.length; i++) {
        console.log(`📝 THREAD_POST_${i + 1}/${tweets.length}: "${tweets[i].substring(0, 50)}..."`);
        
        // Verify content before posting
        const tweetContent = tweets[i];
        if (tweetContent.length > 280) {
          console.warn(`⚠️ THREAD_LENGTH: Tweet ${i + 1} is ${tweetContent.length} chars (max 280)`);
        }
        
        const result = await this.postContent(tweetContent);
        if (!result.success) {
          throw new Error(`Thread post ${i + 1}/${tweets.length} failed: ${result.error}`);
        }
        
        if (result.tweetId) {
          tweetIds.push(result.tweetId);
        }

        // Progress logging
        console.log(`✅ THREAD_PROGRESS: ${i + 1}/${tweets.length} tweets posted`);

        // Wait between posts (longer for threads)
        if (i < tweets.length - 1) {
          console.log(`⏳ THREAD_WAIT: Waiting 3s before next tweet...`);
          await this.page!.waitForTimeout(3000);
        }
      }

      // Final verification
      if (tweetIds.length !== tweets.length) {
        console.warn(`⚠️ THREAD_INCOMPLETE: Posted ${tweetIds.length}/${tweets.length} tweets`);
      }

      console.log(`✅ THREAD_SUCCESS: Posted complete ${tweets.length}-tweet thread`);
      return { success: true, tweetIds };

    } catch (error) {
      console.error('❌ THREAD_FAILED:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async cleanup(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      if (this.context) {
        await this.context.close();
        this.context = null;
      }
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      this.sessionLoaded = false;
    } catch (error) {
      console.warn('⚠️ CLEANUP: Browser cleanup warning:', error);
    }
  }

  // Compatibility methods for legacy systems
  async getStatus(): Promise<{ available: boolean; error?: string }> {
    try {
      if (this.browser && this.context && this.page) {
        await this.page.evaluate(() => document.title);
        return { available: true };
      } else {
        return { available: false, error: 'Browser not initialized' };
      }
    } catch (error) {
      return { available: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; issues: string[] }> {
    const issues: string[] = [];
    
    try {
      if (!this.browser) {
        issues.push('Browser not initialized');
      }
      
      if (!this.context) {
        issues.push('Browser context not available');
      }
      
      if (!this.page) {
        issues.push('Page not available');
      }
      
      if (this.sessionLoaded === false) {
        issues.push('Twitter session not loaded');
      }
      
      return {
        healthy: issues.length === 0,
        issues
      };
    } catch (error) {
      issues.push(`Health check error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { healthy: false, issues };
    }
  }

  // Legacy compatibility method
  async postSingle(content: string): Promise<{ success: boolean; tweetId?: string; error?: string }> {
    return this.postContent(content);
  }
}

export const simplifiedPoster = SimplifiedBulletproofPoster.getInstance();
export default simplifiedPoster;

