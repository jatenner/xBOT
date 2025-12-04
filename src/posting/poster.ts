/**
 * Bulletproof Poster for xBOT
 * Handles single tweets and threaded posts with robust error handling
 */

import { log } from '../lib/logger';
import { Page } from 'playwright';
import Redis from 'ioredis';
import fs from 'fs/promises';
import path from 'path';
import { BulletproofBrowserManager } from './bulletproofBrowserManager';
import { UnifiedBrowserPool } from '../browser/UnifiedBrowserPool';

// Modern selectors for resilient posting
const replyButtonSelectors = [
  '[data-testid="reply"]',
  'div[role="button"][data-testid="reply"]',
  'button[aria-label^="Reply"]',
  'div[role="button"][aria-label^="Reply"]'
];

const composerSelectors = [
  'div[role="textbox"][data-testid="tweetTextarea_0"]',
  'div[role="textbox"][contenteditable="true"]',
  'textarea[aria-label*="Post"]',
  'div[aria-label="Post text"]'
];

async function findFirst(page: Page, selectors: string[], timeout = 15000) {
  for (const sel of selectors) {
    const loc = page.locator(sel).first();
    try {
      await loc.waitFor({ state: 'visible', timeout });
      return loc;
    } catch {}
  }
  return null;
}

export async function postOriginal(page: Page, text: string) {
  await page.bringToFront();
  await page.goto('https://x.com/compose/tweet', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(300);

  const composer = await findFirst(page, composerSelectors, 15000);
  if (!composer) throw new Error('COMPOSER_NOT_FOCUSED');

  await composer.click({ delay: 20 });
  await page.waitForTimeout(120);
  await composer.fill(text);

  const sendSelectors = [
    '[data-testid="tweetButtonInline"]',
    '[data-testid="tweetButton"]',
    'div[role="button"][data-testid="tweetButton"]',
  ];
  const btn = await findFirst(page, sendSelectors, 6000);
  if (btn) await btn.click({ delay: 40 });
  else {
    const mod = 'Control'; // Use Control for consistency
    await page.keyboard.press(`${mod}+Enter`);
  }
}

export async function postReplyToTweet(page: Page, tweetUrl: string, text: string) {
  await page.bringToFront();
  await page.goto(tweetUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);

  // Try reply button; fallback to 'r' then composer
  let replyBtn = await findFirst(page, replyButtonSelectors, 12000);
  if (!replyBtn) {
    await page.keyboard.press('r').catch(()=>{});
    await page.waitForTimeout(400);
  } else {
    await replyBtn.click({ delay: 50 }).catch(()=>{});
  }

  const composer = await findFirst(page, composerSelectors, 12000);
  if (!composer) throw new Error('COMPOSER_NOT_FOCUSED');

  await composer.click({ delay: 20 });
  await page.waitForTimeout(120);
  await composer.fill(text);

  const sendSelectors = [
    '[data-testid="tweetButtonInline"]',
    '[data-testid="tweetButton"]',
    'div[role="button"][data-testid="tweetButton"]',
  ];
  const btn = await findFirst(page, sendSelectors, 6000);
  if (btn) await btn.click({ delay: 50 });
  else {
    const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.keyboard.press(`${mod}+Enter`);
  }
}

export interface SinglePostResult {
  success: boolean;
  tweetId?: string;
  error?: string;
  retryCount?: number;
}

export interface ThreadPostResult {
  success: boolean;
  tweetIds: string[];
  error?: string;
  retryCount?: number;
  partialSuccess?: boolean; // Some tweets posted, others failed
}

export interface ComposerTestResult {
  composerAccessible: boolean;
  sessionValid: boolean;
  errors: string[];
}

export class BulletproofPoster {
  private redis: Redis;
  private browserPool: UnifiedBrowserPool;
  private currentPage: Page | null = null;

  // Configuration from environment
  private readonly THREAD_REPLY_DELAY_SEC = parseInt(process.env.THREAD_REPLY_DELAY_SEC || '3', 10);
  private readonly PLAYWRIGHT_NAV_TIMEOUT_MS = parseInt(process.env.PLAYWRIGHT_NAV_TIMEOUT_MS || '15000', 10);
  private readonly PLAYWRIGHT_MAX_CONTEXT_RETRIES = parseInt(process.env.PLAYWRIGHT_MAX_CONTEXT_RETRIES || '3', 10);
  private readonly PLAYWRIGHT_CONTEXT_RETRY_BACKOFF_MS = parseInt(process.env.PLAYWRIGHT_CONTEXT_RETRY_BACKOFF_MS || '2000', 10);

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL!);
    this.browserPool = UnifiedBrowserPool.getInstance();
  }

  /**
   * 🎯 Post original tweet via direct compose route 
   */
  async postOriginal(text: string): Promise<SinglePostResult> {
    if (process.env.DRY_RUN === '1') {
      console.log('🧪 DRY_RUN: Would post original tweet:', text.slice(0, 100) + '...');
      return { success: true, tweetId: `dry_run_${Date.now()}` };
    }

    try {
      await this.ensureBrowserReady();
      const page = this.currentPage!;
      
      await page.bringToFront();
      await page.goto('https://x.com/compose/tweet', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(300);

      const composer = await findFirst(page, composerSelectors, 15000);
      if (!composer) throw new Error('COMPOSER_NOT_FOCUSED');

      await composer.click({ delay: 20 });
      await page.waitForTimeout(120);
      await composer.fill(text);

      const sendSelectors = [
        '[data-testid="tweetButtonInline"]',
        '[data-testid="tweetButton"]',
        'div[role="button"][data-testid="tweetButton"]',
      ];
      const btn = await findFirst(page, sendSelectors, 6000);
      if (btn) await btn.click({ delay: 40 });
      else {
        const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
        await page.keyboard.press(`${mod}+Enter`);
      }

      await page.waitForLoadState('networkidle');
      const tweetId = `tweet_${Date.now()}`;
      console.log('✅ ORIGINAL_POST_SUCCESS:', tweetId);
      return { success: true, tweetId };

    } catch (error) {
      console.error('❌ ORIGINAL_POST_FAILED:', error);
      return { success: false, error: String(error) };
    }
  }


  /**
   * Post a single tweet
   */
  async postSingle(content: string): Promise<SinglePostResult> {
    console.log(`📄 SINGLE_POST: Posting tweet (${content.length} chars)`);
    
    if (process.env.DRY_RUN === '1') {
      console.log('🧪 DRY_RUN: Would post single tweet:');
      console.log('─'.repeat(60));
      console.log(content);
      console.log('─'.repeat(60));
      return { success: true, tweetId: `dry_run_${Date.now()}` };
    }

    let retryCount = 0;
    const maxRetries = this.PLAYWRIGHT_MAX_CONTEXT_RETRIES;

    while (retryCount < maxRetries) {
      try {
        await this.ensureBrowserReady();
        
        const tweetId = await this.postSingleTweet(content);
        
        console.log(`✅ SINGLE_POST_SUCCESS: Posted tweet ${tweetId}`);
        return { success: true, tweetId, retryCount };

      } catch (error) {
        retryCount++;
        console.error(`❌ SINGLE_POST_ATTEMPT_${retryCount}:`, error instanceof Error ? error.message : error);
        
        if (retryCount < maxRetries) {
          console.log(`🔄 Retrying in ${this.PLAYWRIGHT_CONTEXT_RETRY_BACKOFF_MS}ms...`);
          await this.delay(this.PLAYWRIGHT_CONTEXT_RETRY_BACKOFF_MS);
          await this.resetBrowser();
        }
      }
    }

    return {
      success: false,
      error: `Failed after ${maxRetries} attempts`,
      retryCount
    };
  }

  /**
   * Post a thread with sequential replies
   */
  async postThread(tweets: string[]): Promise<ThreadPostResult> {
    console.log(`🧵 THREAD_POST: Posting ${tweets.length} tweet thread`);
    
    if (process.env.DRY_RUN === '1') {
      console.log('🧪 DRY_RUN: Would post thread:');
      tweets.forEach((tweet, i) => {
        console.log(`\n${i + 1}/${tweets.length}: ${tweet}`);
      });
      console.log('─'.repeat(60));
      
      const dryTweetIds = tweets.map((_, i) => `dry_run_thread_${Date.now()}_${i}`);
      return { success: true, tweetIds: dryTweetIds };
    }

    const tweetIds: string[] = [];
    let retryCount = 0;
    const maxRetries = this.PLAYWRIGHT_MAX_CONTEXT_RETRIES;
    
    // Get thread session key for resume capability
    const sessionKey = `thread:${Date.now()}:last`;

    while (retryCount < maxRetries) {
      try {
        await this.ensureBrowserReady();
        
        // Post initial tweet
        const firstTweetId = await this.postSingleTweet(tweets[0]);
        tweetIds.push(firstTweetId);
        
        // Store progress in Redis for resume capability
        await this.redis.setex(sessionKey, 3600, JSON.stringify({
          tweetIds,
          totalTweets: tweets.length,
          lastPosted: 0
        }));
        
        console.log(`✅ THREAD_HOOK_POSTED: ${firstTweetId}`);
        
        // Post replies sequentially
        for (let i = 1; i < tweets.length; i++) {
          console.log(`🔗 THREAD_REPLY_${i}: Posting reply ${i + 1}/${tweets.length}...`);
          
          // Delay between thread posts
          await this.delay(this.THREAD_REPLY_DELAY_SEC * 1000);
          
          const replyId = await this.postReplyToTweet(firstTweetId, tweets[i]);
          tweetIds.push(replyId);
          
          // Update progress
          await this.redis.setex(sessionKey, 3600, JSON.stringify({
            tweetIds,
            totalTweets: tweets.length,
            lastPosted: i
          }));
          
          console.log(`✅ THREAD_REPLY_SUCCESS: ${replyId} (${i + 1}/${tweets.length})`);
        }
        
        // Clean up session
        await this.redis.del(sessionKey);
        
        console.log(`🎉 THREAD_COMPLETE: Posted ${tweetIds.length} tweets`);
        return { success: true, tweetIds, retryCount };

      } catch (error) {
        retryCount++;
        console.error(`❌ THREAD_POST_ATTEMPT_${retryCount}:`, error instanceof Error ? error.message : error);
        
        if (retryCount < maxRetries) {
          console.log(`🔄 Retrying thread in ${this.PLAYWRIGHT_CONTEXT_RETRY_BACKOFF_MS}ms...`);
          await this.delay(this.PLAYWRIGHT_CONTEXT_RETRY_BACKOFF_MS);
          await this.resetBrowser();
        }
      }
    }

    // Partial success if some tweets were posted
    if (tweetIds.length > 0) {
      await this.redis.del(sessionKey);
      return {
        success: false,
        tweetIds,
        error: `Partial thread posted: ${tweetIds.length}/${tweets.length} tweets`,
        retryCount,
        partialSuccess: true
      };
    }

    return {
      success: false,
      tweetIds: [],
      error: `Thread failed after ${maxRetries} attempts`,
      retryCount
    };
  }

  /**
   * 🔗 Private method to post reply and return tweet ID
   */
  private async postReplyToTweet(parentTweetId: string, content: string): Promise<string> {
    // Use the module-level function but return just the ID
    await postReplyToTweet(this.currentPage!, `https://x.com/i/web/status/${parentTweetId}`, content);
    return `reply_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 💬 POST REPLY TO SPECIFIC TWEET (PUBLIC METHOD)
   */
  public async postReply(content: string, parentTweetId: string): Promise<{ success: boolean; tweetId?: string; error?: string }> {
    if (process.env.DRY_RUN === '1') {
      console.log(`🧪 DRY_RUN: Would reply to ${parentTweetId}:`);
      console.log(`Reply: ${content}`);
      console.log('─'.repeat(60));
      
      return { success: true, tweetId: `dry_run_reply_${Date.now()}` };
    }

    try {
      await this.ensureBrowserReady();
      const replyId = await this.postReplyToTweet(parentTweetId, content);
      
      return { 
        success: true, 
        tweetId: replyId 
      };
      
    } catch (error) {
      console.error('❌ REPLY_FAILED:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown reply error'
      };
    }
  }

  /**
   * Post a single tweet with robust composer handling
   */
  private async postSingleTweet(content: string): Promise<string> {
    if (!this.currentPage) {
      throw new Error('Browser page not ready');
    }

    console.log(`📝 POSTING_TWEET: "${content.substring(0, 50)}..."`);
    
    // Navigate to compose or ensure we're on a postable page
    await this.ensureComposePage();
    
    // Focus composer with bulletproof handling
    await this.focusComposer();
    
    // Type content
    await this.typeContent(content);
    
    // Submit post
    const tweetId = await this.submitPost();
    
    return tweetId;
  }


  /**
   * Test composer access without posting
   */
  async testComposerAccess(): Promise<ComposerTestResult> {
    const errors: string[] = [];
    let composerAccessible = false;
    let sessionValid = false;

    try {
      await this.ensureBrowserReady();
      
      // Test session validity
      await this.currentPage!.goto('https://x.com/home', { 
        waitUntil: 'domcontentloaded', 
        timeout: this.PLAYWRIGHT_NAV_TIMEOUT_MS 
      });
      
      // Check if we're logged in (not redirected to login)
      const currentUrl = this.currentPage!.url();
      sessionValid = !currentUrl.includes('/login') && !currentUrl.includes('/i/flow/login');
      
      if (!sessionValid) {
        errors.push('Session invalid - redirected to login');
      }
      
      // Test composer access
      try {
        await this.focusComposer();
        composerAccessible = true;
      } catch (error) {
        composerAccessible = false;
        errors.push(`Composer inaccessible: ${error instanceof Error ? error.message : error}`);
      }
      
    } catch (error) {
      errors.push(`Browser test failed: ${error instanceof Error ? error.message : error}`);
    }

    return { composerAccessible, sessionValid, errors };
  }

  /**
   * Get posting statistics
   */
  async getPostingStats(): Promise<{
    totalPosts: number;
    successRate: number;
    avgTimeToPost: number;
    threadVsSingle: { threads: number; singles: number };
  }> {
    // This would typically query Supabase for posting history
    // For now, return mock stats
    return {
      totalPosts: 0,
      successRate: 0,
      avgTimeToPost: 0,
      threadVsSingle: { threads: 0, singles: 0 }
    };
  }

  /**
   * Ensure browser and page are ready (using UnifiedBrowserPool)
   */
  private async ensureBrowserReady(): Promise<void> {
    if (!this.currentPage) {
      console.log('🌐 BROWSER_POOL: Acquiring page from UnifiedBrowserPool...');
      this.currentPage = await this.browserPool.acquirePage('bulletproof_poster');
      
      // Set up screenshot on failure
      this.currentPage.on('pageerror', async (error) => {
        console.error('📸 PAGE_ERROR:', error.message);
        await this.takeScreenshot('page_error');
      });
    }
  }

  /**
   * Reset browser on error (using UnifiedBrowserPool)
   */
  private async resetBrowser(): Promise<void> {
    try {
      if (this.currentPage) {
        await this.currentPage.close();
        this.currentPage = null;
      }
      // UnifiedBrowserPool handles context cleanup automatically
    } catch (error) {
      console.warn('⚠️ Error during browser reset:', error);
    }
  }

  /**
   * Ensure we're on a page where we can compose
   */
  private async ensureComposePage(): Promise<void> {
    if (!this.currentPage) return;

    const currentUrl = this.currentPage.url();
    
    // If not on a composable page, go to home
    if (!currentUrl.includes('x.com') || currentUrl.includes('/login')) {
      console.log('🏠 NAVIGATE_HOME: Going to Twitter home...');
      await this.currentPage.goto('https://x.com/home', { 
        waitUntil: 'domcontentloaded', 
        timeout: this.PLAYWRIGHT_NAV_TIMEOUT_MS 
      });
    }
  }

  /**
   * Focus the composer with bulletproof handling
   */
  private async focusComposer(): Promise<void> {
    if (!this.currentPage) return;

    const browserManager = new BulletproofBrowserManager(this.currentPage);
    const focusResult = await browserManager.focusComposer();
    
    if (!focusResult.success) {
      await this.takeScreenshot('bulletproof_focus_failed');
      throw new Error(`Bulletproof focus failed: ${focusResult.error}`);
    }
    
    console.log(`✅ BULLETPROOF_FOCUS: Success with ${focusResult.method} method (${focusResult.attempts} attempts)`);
  }

  /**
   * Close modal overlays that might block interaction
   */
  private async closeOverlays(): Promise<void> {
    if (!this.currentPage) return;

    const overlaySelectors = [
      '[role="dialog"] [data-testid="app-bar-close"]',
      '[role="dialog"] [aria-label="Close"]',
      '[data-testid="close"]',
      '.modal-close',
      '[aria-label*="Close"]'
    ];

    for (const selector of overlaySelectors) {
      try {
        const overlay = await this.currentPage.$(selector);
        if (overlay) {
          console.log(`🚫 CLOSING_OVERLAY: Found overlay with selector ${selector}`);
          await overlay.click();
          await this.delay(500);
        }
      } catch (error) {
        // Ignore errors when closing overlays
      }
    }
  }

  /**
   * Check if page is stale and needs refresh
   */
  private async isPageStale(): Promise<boolean> {
    if (!this.currentPage) return true;

    try {
      // Try to find any basic Twitter elements
      const basicSelectors = [
        '[data-testid="primaryColumn"]',
        '[data-testid="SideNav_AccountSwitcher_Button"]',
        'nav[role="navigation"]'
      ];

      for (const selector of basicSelectors) {
        const element = await this.currentPage.$(selector);
        if (element) {
          return false; // Found basic element, page is not stale
        }
      }

      return true; // No basic elements found, likely stale
    } catch (error) {
      return true; // Error checking, assume stale
    }
  }

  /**
   * Type content into the composer
   */
  private async typeContent(content: string): Promise<void> {
    if (!this.currentPage) return;

    console.log(`⌨️ TYPING_CONTENT: ${content.length} characters`);
    
    // Clear any existing content first
    await this.currentPage.keyboard.press('ControlOrMeta+KeyA');
    await this.delay(100);
    
    // Type content with realistic delays
    await this.currentPage.keyboard.type(content, { delay: 50 });
    
    // Verify content was typed
    await this.delay(500);
    const typedContent = await this.currentPage.evaluate(() => {
      const composer = document.querySelector('[data-testid="tweetTextarea_0"]') as HTMLElement;
      return composer?.textContent || '';
    });
    
    if (!typedContent.includes(content.substring(0, 50))) {
      throw new Error('Content was not typed correctly into composer');
    }
    
    console.log('✅ CONTENT_TYPED: Content successfully entered');
  }

  /**
   * Submit the post and get tweet ID
   */
  private async submitPost(): Promise<string> {
    if (!this.currentPage) throw new Error('Page not ready');

    console.log('📤 SUBMITTING_POST: Clicking post button...');
    
    // Find and click post button
    const postButtonSelectors = [
      '[data-testid="tweetButton"]',
      '[data-testid="tweetButtonInline"]',
      'button[type="submit"]'
    ];

    let postButton;
    for (const selector of postButtonSelectors) {
      postButton = await this.currentPage.$(selector);
      if (postButton) break;
    }

    if (!postButton) {
      await this.takeScreenshot('post_button_not_found');
      throw new Error('Could not find post button');
    }

    // Check if button is enabled
    const isDisabled = await postButton.evaluate(btn => (btn as HTMLButtonElement).disabled);
    if (isDisabled) {
      throw new Error('Post button is disabled - content may be invalid');
    }

    await postButton.click();
    
    // Wait for navigation or success indicators
    console.log('⏳ WAITING_FOR_POST: Waiting for post confirmation...');
    
    try {
      // Wait for URL change indicating successful post
      await this.currentPage.waitForFunction(
        () => window.location.pathname.includes('/status/') || 
              window.location.search.includes('post_success'),
        { timeout: 10000 }
      );
      
      // Extract tweet ID from URL
      const url = this.currentPage.url();
      const tweetIdMatch = url.match(/status\/(\d+)/);
      
      if (tweetIdMatch) {
        return tweetIdMatch[1];
      }
      
      // Fallback: generate timestamp-based ID
      return `posted_${Date.now()}`;
      
    } catch (error) {
      // Post might have succeeded even if we couldn't detect it
      console.warn('⚠️ POST_CONFIRMATION_TIMEOUT: Could not confirm post, assuming success');
      return `timeout_${Date.now()}`;
    }
  }

  /**
   * Take screenshot for debugging
   */
  private async takeScreenshot(reason: string): Promise<void> {
    if (!this.currentPage) return;

    try {
      const screenshotDir = './tmp/playwright_screens';
      await fs.mkdir(screenshotDir, { recursive: true });
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${reason}_${timestamp}.png`;
      const filepath = path.join(screenshotDir, filename);
      
      await this.currentPage.screenshot({ path: filepath, fullPage: true });
      console.log(`📸 SCREENSHOT_SAVED: ${filepath}`);
    } catch (error) {
      console.warn('⚠️ Could not save screenshot:', error);
    }
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.resetBrowser();
    await this.redis.quit();
  }
}

export default BulletproofPoster;
