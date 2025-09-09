/**
 * 🧵 THREAD COMPOSER - Robust thread posting with composer + fallback modes
 */

import { Page } from 'playwright';
import ThreadBuilder from '../utils/threadBuilder';

interface ThreadPostResult {
  success: boolean;
  mode: 'composer' | 'reply_chain' | 'single';
  rootTweetUrl?: string;
  tweetIds?: string[];
  segments?: string[];
  error?: string;
  retryCount?: number;
}

interface ThreadComposerOptions {
  retryAttempts?: number;
  replyDelay?: number;
  verificationTimeout?: number;
  dryRun?: boolean;
}

export class ThreadComposer {
  private page: Page;
  private options: Required<ThreadComposerOptions>;
  
  // Environment configuration
  private readonly THREAD_MAX_TWEETS = parseInt(process.env.THREAD_MAX_TWEETS || '9');
  private readonly THREAD_REPLY_DELAY_SEC = parseInt(process.env.THREAD_REPLY_DELAY_SEC || '2');
  private readonly THREAD_RETRY_ATTEMPTS = parseInt(process.env.THREAD_RETRY_ATTEMPTS || '3');
  private readonly PLAYWRIGHT_NAV_TIMEOUT_MS = parseInt(process.env.PLAYWRIGHT_NAV_TIMEOUT_MS || '30000');
  private readonly PLAYWRIGHT_SAFE_SELECTORS = process.env.PLAYWRIGHT_SAFE_SELECTORS === 'true';

  constructor(page: Page, options: ThreadComposerOptions = {}) {
    this.page = page;
    this.options = {
      retryAttempts: options.retryAttempts || this.THREAD_RETRY_ATTEMPTS,
      replyDelay: options.replyDelay || this.THREAD_REPLY_DELAY_SEC * 1000,
      verificationTimeout: options.verificationTimeout || 10000,
      dryRun: options.dryRun || process.env.DRY_RUN === 'true'
    };

    // Set page timeouts
    this.page.setDefaultTimeout(this.PLAYWRIGHT_NAV_TIMEOUT_MS);
    this.page.setDefaultNavigationTimeout(this.PLAYWRIGHT_NAV_TIMEOUT_MS);
  }

  /**
   * 🎯 MAIN FUNCTION: Post content as thread or single tweet
   */
  async postContent(content: string): Promise<ThreadPostResult> {
    console.log('🧵 THREAD_COMPOSER: Starting content posting...');
    
    // Check for emergency single post mode
    if (process.env.FORCE_SINGLE_POST === 'true') {
      console.log('🚨 FORCE_SINGLE_POST: Threading disabled, posting as single tweet');
      return await this.postSingleTweet(content);
    }

    // Build thread segments
    const threadResult = ThreadBuilder.buildThreadSegments(content);
    console.log(`🧵 THREAD_DECISION: mode=${threadResult.isThread ? 'thread' : 'single'}, segments=${threadResult.totalSegments}`);
    console.log(`📝 THREAD_REASON: ${threadResult.reason}`);

    // Validate segments
    const validation = ThreadBuilder.validateThreadSegments(threadResult.segments);
    if (!validation.valid) {
      console.error('❌ THREAD_VALIDATION_FAILED:', validation.errors);
      return {
        success: false,
        mode: 'single',
        error: `Thread validation failed: ${validation.errors.join(', ')}`
      };
    }

    // Log each segment for debugging
    threadResult.segments.forEach((segment, index) => {
      console.log(`🧵 THREAD_SEG_VERIFIED i=${index} bytes=${segment.length} content="${segment.substring(0, 50)}..."`);
    });

    if (!threadResult.isThread) {
      return await this.postSingleTweet(threadResult.segments[0]);
    }

    // Try composer-first thread posting
    try {
      const composerResult = await this.postThreadViaComposer(threadResult.segments);
      if (composerResult.success) {
        return composerResult;
      }
      console.warn('⚠️ THREAD_COMPOSER_FAILED: Falling back to reply chain mode');
    } catch (error) {
      console.error('❌ THREAD_COMPOSER_ERROR:', error);
    }

    // Fallback to reply chain mode
    return await this.postThreadViaReplies(threadResult.segments);
  }

  /**
   * 🎨 POST thread via Twitter's native composer (preferred method)
   */
  private async postThreadViaComposer(segments: string[]): Promise<ThreadPostResult> {
    console.log(`🎨 THREAD_COMPOSER: Starting composer mode for ${segments.length} segments`);
    
    if (this.options.dryRun) {
      console.log('🧪 DRY_RUN: Would post thread via composer');
      segments.forEach((seg, i) => console.log(`  ${i + 1}/${segments.length}: ${seg.substring(0, 100)}...`));
      return {
        success: true,
        mode: 'composer',
        segments,
        rootTweetUrl: 'https://x.com/example/status/dry_run_' + Date.now()
      };
    }

    let retryCount = 0;
    
    while (retryCount < this.options.retryAttempts) {
      try {
        console.log(`🔄 THREAD_COMPOSER_ATTEMPT: ${retryCount + 1}/${this.options.retryAttempts}`);
        
        // Navigate to compose page
        await this.navigateToComposer();
        
        // Open new post dialog
        await this.openNewPostDialog();
        
        // Close any overlays
        await this.closeOverlays();
        
        // Type first tweet and verify
        const firstTextbox = await this.getTextboxForSegment(0);
        await this.typeAndVerifySegment(firstTextbox, segments[0], 0);
        
        // Add remaining tweets if multi-segment
        if (segments.length > 1) {
          for (let i = 1; i < segments.length; i++) {
            await this.addAnotherPost();
            const textbox = await this.getTextboxForSegment(i);
            await this.typeAndVerifySegment(textbox, segments[i], i);
          }
        }
        
        // Verify thread card count matches segments
        await this.verifyThreadCardCount(segments.length);
        
        // Publish the thread
        const rootTweetUrl = await this.publishThread(segments.length);
        
        console.log(`✅ THREAD_PUBLISH_OK root=${rootTweetUrl}`);
        
        return {
          success: true,
          mode: 'composer',
          rootTweetUrl,
          segments,
          retryCount
        };
        
      } catch (error) {
        retryCount++;
        console.error(`❌ THREAD_COMPOSER_ATTEMPT_${retryCount}:`, error);
        
        if (retryCount < this.options.retryAttempts) {
          console.log(`🔄 Retrying composer in 2 seconds...`);
          await this.page.waitForTimeout(2000);
          
          // Try to reset page state
          try {
            await this.page.keyboard.press('Escape');
            await this.page.waitForTimeout(500);
          } catch {
            // Ignore escape errors
          }
        }
      }
    }

    return {
      success: false,
      mode: 'composer',
      error: `Composer failed after ${this.options.retryAttempts} attempts`,
      retryCount
    };
  }

  /**
   * 🔗 POST thread via reply chain (fallback method)
   */
  private async postThreadViaReplies(segments: string[]): Promise<ThreadPostResult> {
    console.log(`🔗 THREAD_REPLY_CHAIN: Starting reply chain mode for ${segments.length} segments`);
    
    if (this.options.dryRun) {
      console.log('🧪 DRY_RUN: Would post thread via reply chain');
      segments.forEach((seg, i) => console.log(`  Reply ${i}: ${seg.substring(0, 100)}...`));
      return {
        success: true,
        mode: 'reply_chain',
        segments,
        rootTweetUrl: 'https://x.com/example/status/dry_run_reply_' + Date.now()
      };
    }

    try {
      // Post first tweet
      const rootResult = await this.postSingleTweet(segments[0]);
      if (!rootResult.success || !rootResult.rootTweetUrl) {
        throw new Error('Failed to post root tweet for reply chain');
      }

      console.log(`🔗 THREAD_ROOT_POSTED: ${rootResult.rootTweetUrl}`);
      
      const tweetIds = [this.extractTweetIdFromUrl(rootResult.rootTweetUrl)];
      
      // Post replies
      for (let i = 1; i < segments.length; i++) {
        console.log(`🔗 THREAD_REPLY_${i}: Posting reply ${i + 1}/${segments.length}...`);
        
        // Wait delay between replies
        if (i > 1) {
          await this.page.waitForTimeout(this.options.replyDelay);
        }
        
        const replyResult = await this.postReply(rootResult.rootTweetUrl, segments[i]);
        if (replyResult.success && replyResult.tweetId) {
          tweetIds.push(replyResult.tweetId);
          console.log(`✅ THREAD_REPLY_SUCCESS: ${replyResult.tweetId} (${i + 1}/${segments.length})`);
        } else {
          console.warn(`⚠️ THREAD_REPLY_FAILED: Reply ${i + 1} failed: ${replyResult.error}`);
        }
      }
      
      console.log(`✅ THREAD_PUBLISH_OK root=${rootResult.rootTweetUrl} mode=reply_chain`);
      
      return {
        success: true,
        mode: 'reply_chain',
        rootTweetUrl: rootResult.rootTweetUrl,
        tweetIds,
        segments
      };
      
    } catch (error) {
      console.error('❌ THREAD_REPLY_CHAIN_FAILED:', error);
      return {
        success: false,
        mode: 'reply_chain',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 📝 POST single tweet (non-thread)
   */
  private async postSingleTweet(content: string): Promise<ThreadPostResult> {
    console.log(`📝 SINGLE_TWEET: Posting single tweet (${content.length} chars)`);
    
    if (this.options.dryRun) {
      console.log(`🧪 DRY_RUN: Would post single tweet: ${content.substring(0, 100)}...`);
      return {
        success: true,
        mode: 'single',
        rootTweetUrl: 'https://x.com/example/status/dry_run_single_' + Date.now()
      };
    }

    try {
      await this.navigateToComposer();
      await this.openNewPostDialog();
      await this.closeOverlays();
      
      const textbox = await this.getTextboxForSegment(0);
      await this.typeAndVerifySegment(textbox, content, 0);
      
      const rootTweetUrl = await this.publishThread(1);
      
      console.log(`✅ SINGLE_TWEET_OK: ${rootTweetUrl}`);
      
      return {
        success: true,
        mode: 'single',
        rootTweetUrl
      };
      
    } catch (error) {
      console.error('❌ SINGLE_TWEET_FAILED:', error);
      return {
        success: false,
        mode: 'single',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 🌐 NAVIGATE to composer
   */
  private async navigateToComposer(): Promise<void> {
    console.log('🌐 THREAD_COMPOSER: Navigating to compose...');
    
    const currentUrl = this.page.url();
    if (!currentUrl.includes('x.com') && !currentUrl.includes('twitter.com')) {
      await this.page.goto('https://x.com/home', { 
        waitUntil: 'domcontentloaded',
        timeout: this.PLAYWRIGHT_NAV_TIMEOUT_MS 
      });
    }

    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(1500); // Stability wait
  }

  /**
   * ➕ OPEN new post dialog
   */
  private async openNewPostDialog(): Promise<void> {
    console.log('➕ THREAD_COMPOSER: Opening new post dialog...');
    
    try {
      // Try keyboard shortcut first (fastest)
      await this.page.keyboard.press('KeyN');
      await this.page.waitForTimeout(800);
      
      // Check if composer opened
      const textbox = this.page.locator('[data-testid="tweetTextarea_0"]').first();
      const isVisible = await textbox.isVisible().catch(() => false);
      
      if (isVisible) {
        console.log('✅ THREAD_COMPOSER: Keyboard shortcut worked');
        return;
      }
    } catch {
      // Keyboard shortcut failed, try click method
    }
    
    // Fallback: Click compose button
    const composeSelectors = [
      'a[href="/compose/tweet"]',
      '[data-testid="SideNav_NewTweet_Button"]',
      'a[aria-label="Post"]',
      'button[aria-label="Post"]'
    ];

    for (const selector of composeSelectors) {
      try {
        const element = this.page.locator(selector).first();
        if (await element.isVisible({ timeout: 2000 })) {
          await element.scrollIntoViewIfNeeded();
          await this.page.waitForTimeout(200);
          await element.click();
          await this.page.waitForTimeout(1000);
          console.log(`✅ THREAD_COMPOSER: Clicked ${selector}`);
          return;
        }
      } catch {
        continue;
      }
    }

    throw new Error('Could not open new post dialog');
  }

  /**
   * 🚫 CLOSE overlays that might intercept clicks
   */
  private async closeOverlays(): Promise<void> {
    console.log('🚫 THREAD_COMPOSER: Closing overlays...');
    
    let attempts = 0;
    const maxAttempts = 5;
    
    while (attempts < maxAttempts) {
      const closeButtons = await this.page.locator('[aria-label="Close"]').all();
      const visibleCloseButtons = [];
      
      for (const button of closeButtons) {
        if (await button.isVisible().catch(() => false)) {
          visibleCloseButtons.push(button);
        }
      }
      
      if (visibleCloseButtons.length === 0) {
        console.log('✅ THREAD_COMPOSER: No overlays to close');
        break;
      }
      
      for (const button of visibleCloseButtons) {
        try {
          // 🛡️ BULLETPROOF: scrollIntoView + delay before click
          await button.scrollIntoViewIfNeeded();
          await this.page.waitForTimeout(150);
          await button.click({ timeout: 1000 });
          await this.page.waitForTimeout(300);
          console.log(`🚫 THREAD_COMPOSER: Closed overlay (attempt ${attempts + 1})`);
        } catch {
          // Ignore individual close failures
        }
      }
      
      attempts++;
    }
  }

  /**
   * 📝 GET textbox for specific segment with bulletproof verification
   */
  private async getTextboxForSegment(index: number) {
    const selectors = [
      `[data-testid="tweetTextarea_${index}"]`,
      `[role="textbox"][name*="Post text"]`,
      `[role="textbox"][placeholder*="What's happening"]`
    ];

    if (index === 0) {
      // First textbox - try multiple selectors
      for (const selector of selectors) {
        try {
          const element = this.page.locator(selector).first();
          
          // 🛡️ BULLETPROOF: Ensure visibility before returning
          await element.waitFor({ state: 'visible', timeout: this.options.verificationTimeout });
          await element.scrollIntoViewIfNeeded();
          
          console.log(`✅ THREAD_COMPOSER: Found textbox ${index} with selector: ${selector}`);
          return element;
        } catch {
          continue;
        }
      }
    } else {
      // Nth textbox for thread - prefer data-testid
      try {
        const element = this.page.locator('[data-testid^="tweetTextarea_"]').nth(index);
        
        // 🛡️ BULLETPROOF: Wait and verify
        await element.waitFor({ state: 'visible', timeout: this.options.verificationTimeout });
        await element.scrollIntoViewIfNeeded();
        
        console.log(`✅ THREAD_COMPOSER: Found thread textbox ${index}`);
        return element;
      } catch {
        // Fallback to role-based selection
        const element = this.page.locator('[role="textbox"]').nth(index);
        await element.waitFor({ state: 'visible', timeout: this.options.verificationTimeout });
        await element.scrollIntoViewIfNeeded();
        
        console.log(`✅ THREAD_COMPOSER: Found textbox ${index} via role fallback`);
        return element;
      }
    }

    throw new Error(`Could not find textbox for segment ${index} after trying all selectors`);
  }

  /**
   * ⌨️ TYPE and verify segment content
   */
  private async typeAndVerifySegment(textbox: any, content: string, index: number): Promise<void> {
    console.log(`⌨️ THREAD_COMPOSER: Typing segment ${index} (${content.length} chars)`);
    
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        // Focus and clear
        await textbox.scrollIntoViewIfNeeded();
        await this.page.waitForTimeout(200);
        await textbox.click();
        await this.page.waitForTimeout(300);
        
        // Select all and delete
        await this.page.keyboard.press('Meta+A');
        await this.page.keyboard.press('Delete');
        await this.page.waitForTimeout(200);
        
        // Type content
        await textbox.fill(content);
        await this.page.waitForTimeout(500);
        
        // Verify content
        const actualText = await textbox.inputValue().catch(() => '');
        const normalizedActual = actualText.trim().replace(/\s+/g, ' ');
        const normalizedExpected = content.trim().replace(/\s+/g, ' ');
        
        if (normalizedActual === normalizedExpected || 
            normalizedActual.includes(normalizedExpected.substring(0, 50))) {
          console.log(`✅ THREAD_SEG_VERIFIED: i=${index} bytes=${content.length} match=true`);
          return;
        }
        
        console.warn(`⚠️ THREAD_COMPOSER: Text mismatch attempt ${attempts + 1}:`);
        console.warn(`  Expected: ${normalizedExpected.substring(0, 100)}...`);
        console.warn(`  Actual: ${normalizedActual.substring(0, 100)}...`);
        
        attempts++;
        
        if (attempts < maxAttempts) {
          await this.page.waitForTimeout(1000);
        }
        
      } catch (error) {
        attempts++;
        console.error(`❌ THREAD_COMPOSER: Type attempt ${attempts} failed:`, error);
        
        if (attempts < maxAttempts) {
          await this.page.waitForTimeout(1000);
        }
      }
    }

    throw new Error(`Failed to type and verify segment ${index} after ${maxAttempts} attempts`);
  }

  /**
   * ➕ ADD another post to thread
   */
  private async addAnotherPost(): Promise<void> {
    console.log('➕ THREAD_COMPOSER: Adding another post...');
    
    const addButtonSelectors = [
      'button:has-text("Add another post")',
      '[data-testid="addButton"]',
      'button[aria-label="Add another post"]',
      'button:has-text("Add")',
      'button[aria-label*="Add"]'
    ];

    for (const selector of addButtonSelectors) {
      try {
        const element = this.page.locator(selector).first();
        if (await element.isVisible({ timeout: 2000 })) {
          await element.scrollIntoViewIfNeeded();
          await this.page.waitForTimeout(200);
          await element.click();
          await this.page.waitForTimeout(800);
          console.log(`✅ THREAD_COMPOSER: Clicked ${selector}`);
          return;
        }
      } catch {
        continue;
      }
    }

    throw new Error('Could not find "Add another post" button');
  }

  /**
   * 🔍 VERIFY thread card count
   */
  private async verifyThreadCardCount(expectedCount: number): Promise<void> {
    console.log(`🔍 THREAD_COMPOSER: Verifying ${expectedCount} thread cards...`);
    
    try {
      const cards = await this.page.locator('[data-testid^="tweetTextarea_"]').all();
      const actualCount = cards.length;
      
      if (actualCount === expectedCount) {
        console.log(`✅ THREAD_COMPOSER: Thread card count verified (${actualCount})`);
        return;
      }
      
      console.warn(`⚠️ THREAD_COMPOSER: Card count mismatch - expected ${expectedCount}, got ${actualCount}`);
      
      // Anti-orphan guard
      if (expectedCount > 1 && actualCount === 1) {
        throw new Error('Anti-orphan guard: Expected thread but only found single card');
      }
      
    } catch (error) {
      console.error('❌ THREAD_COMPOSER: Card count verification failed:', error);
      throw error;
    }
  }

  /**
   * 🚀 PUBLISH thread
   */
  private async publishThread(segmentCount: number): Promise<string> {
    console.log(`🚀 THREAD_COMPOSER: Publishing ${segmentCount} segment thread...`);
    
    const publishSelectors = segmentCount > 1 ? [
      'button:has-text("Post all")',
      '[data-testid="tweetButton"]:has-text("Post all")',
      'button[aria-label*="Post all"]'
    ] : [
      '[data-testid="tweetButton"]',
      'button:has-text("Post")',
      'button[aria-label*="Post"]'
    ];

    for (const selector of publishSelectors) {
      try {
        const element = this.page.locator(selector).first();
        if (await element.isVisible({ timeout: 3000 })) {
          await element.scrollIntoViewIfNeeded();
          await this.page.waitForTimeout(300);
          await element.click();
          
          console.log(`🚀 THREAD_COMPOSER: Clicked publish button`);
          
          // Wait for posting to complete
          await this.page.waitForTimeout(3000);
          
          // Try to capture tweet URL
          return await this.captureTweetUrl();
        }
      } catch {
        continue;
      }
    }

    throw new Error('Could not find publish button');
  }

  /**
   * 📎 CAPTURE tweet URL after posting
   */
  private async captureTweetUrl(): Promise<string> {
    console.log('📎 THREAD_COMPOSER: Capturing tweet URL...');
    
    try {
      // Look for "View" button or similar
      const viewSelectors = [
        'a:has-text("View")',
        '[data-testid="viewTweet"]',
        'a[href*="/status/"]'
      ];

      for (const selector of viewSelectors) {
        try {
          const element = this.page.locator(selector).first();
          if (await element.isVisible({ timeout: 2000 })) {
            const href = await element.getAttribute('href');
            if (href && href.includes('/status/')) {
              const fullUrl = href.startsWith('http') ? href : `https://x.com${href}`;
              console.log(`📎 THREAD_COMPOSER: Captured URL from ${selector}: ${fullUrl}`);
              return fullUrl;
            }
          }
        } catch {
          continue;
        }
      }
      
      // Fallback: Check current URL
      const currentUrl = this.page.url();
      if (currentUrl.includes('/status/')) {
        console.log(`📎 THREAD_COMPOSER: Using current URL: ${currentUrl}`);
        return currentUrl;
      }
      
      // Last resort: Generate placeholder
      const placeholderUrl = `https://x.com/placeholder/status/${Date.now()}`;
      console.warn(`⚠️ THREAD_COMPOSER: Could not capture URL, using placeholder: ${placeholderUrl}`);
      return placeholderUrl;
      
    } catch (error) {
      console.error('❌ THREAD_COMPOSER: URL capture failed:', error);
      return `https://x.com/error/status/${Date.now()}`;
    }
  }

  /**
   * 💬 POST reply to tweet
   */
  private async postReply(rootTweetUrl: string, replyContent: string): Promise<{ success: boolean; tweetId?: string; error?: string }> {
    try {
      console.log(`💬 THREAD_COMPOSER: Posting reply to ${rootTweetUrl}`);
      
      // Navigate to root tweet
      await this.page.goto(rootTweetUrl, { waitUntil: 'domcontentloaded' });
      await this.page.waitForTimeout(2000);
      
      // Click reply button
      const replyButton = this.page.locator('[data-testid="reply"]').first();
      await replyButton.waitFor({ state: 'visible', timeout: 5000 });
      await replyButton.click();
      await this.page.waitForTimeout(1000);
      
      // Type reply
      const replyTextbox = this.page.locator('[data-testid="tweetTextarea_0"]').first();
      await replyTextbox.waitFor({ state: 'visible', timeout: 5000 });
      await replyTextbox.fill(replyContent);
      await this.page.waitForTimeout(500);
      
      // Post reply
      const postButton = this.page.locator('[data-testid="tweetButton"]').first();
      await postButton.click();
      await this.page.waitForTimeout(2000);
      
      // Try to get reply URL/ID
      const replyUrl = await this.captureTweetUrl();
      const tweetId = this.extractTweetIdFromUrl(replyUrl);
      
      return { success: true, tweetId };
      
    } catch (error) {
      console.error('❌ THREAD_COMPOSER: Reply failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }

  /**
   * 🔢 EXTRACT tweet ID from URL
   */
  private extractTweetIdFromUrl(url: string): string {
    const match = url.match(/\/status\/(\d+)/);
    return match ? match[1] : url.split('/').pop() || 'unknown';
  }
}

export default ThreadComposer;
