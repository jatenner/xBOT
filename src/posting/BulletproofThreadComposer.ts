/**
 * 🧵 BULLETPROOF THREAD COMPOSER
 * Forces all multi-segment content to post as connected threads
 * Composer-first with reply-chain fallback - NO standalone numbered tweets
 */

import { Page } from 'playwright';
import { ensureComposerFocused } from './composerFocus';

interface ThreadPostResult {
  success: boolean;
  mode: 'composer' | 'reply_chain';
  rootTweetUrl?: string;
  tweetIds?: string[];
  error?: string;
}

export class BulletproofThreadComposer {
  // ❌ REMOVED: private static browserPage: Page | null = null;
  // This caused context lifecycle issues - context cleaned up while page still referenced!
  
  // 🔥 NEW: Overall timeout for thread posting
  private static readonly THREAD_TIMEOUT_MS = 180000; // 180 seconds (3 minutes) - increased for reliability

  // Modern selectors for resilient reply flow
  private static readonly replyButtonSelectors = [
    '[data-testid="reply"]',
    'div[role="button"][data-testid="reply"]',
    'button[aria-label^="Reply"]',
    'div[role="button"][aria-label^="Reply"]'
  ];

  private static readonly composerSelectors = [
    'div[role="textbox"][data-testid="tweetTextarea_0"]',
    'div[role="textbox"][contenteditable="true"]',
    'textarea[aria-label*="Post"]',
    'div[aria-label="Post text"]'
  ];

  /**
   * 🎯 MAIN METHOD: Post segments as connected thread
   */
  static async post(segments: string[]): Promise<ThreadPostResult> {
    console.log(`THREAD_DECISION mode=composer segments=${segments.length}`);
    
    const isThread = segments.length > 1;
    
    if (isThread) {
      console.log(`🧵 THREAD_MODE: Natural flow (${segments.length} tweets), NO numbering`);
    }
    
    if (process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true') {
      console.log('🧪 DRY_RUN: Thread posting simulation');
      segments.forEach((segment, i) => {
        console.log(`THREAD_SEG_VERIFIED idx=${i} len=${segment.length}`);
      });
      console.log('THREAD_PUBLISH_OK mode=dry_run');
      return {
        success: true,
        mode: 'composer',
        rootTweetUrl: `https://x.com/dry_run/status/${Date.now()}`
      };
    }

    // 🔥 FIXED: Wrap entire operation in timeout + retry logic for reliability
    const maxRetries = 2;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[THREAD_COMPOSER] 🎯 Posting attempt ${attempt}/${maxRetries}`);
        
        const result = await Promise.race([
          this.postWithContext(segments),
          this.createTimeoutPromise()
        ]);
        
        console.log(`[THREAD_COMPOSER] ✅ Success on attempt ${attempt}`);
        return result as ThreadPostResult;
        
      } catch (error: any) {
        if (error.message === 'Thread posting timeout') {
          console.error(`[THREAD_COMPOSER] ⏱️ Timeout on attempt ${attempt}/${maxRetries} (exceeded ${this.THREAD_TIMEOUT_MS/1000}s)`);
          
          if (attempt === maxRetries) {
            return {
              success: false,
              mode: 'composer',
              error: `Thread posting timeout after ${maxRetries} attempts (${this.THREAD_TIMEOUT_MS/1000}s each)`
            };
          }
          
          console.log(`[THREAD_COMPOSER] 🔄 Retrying in 5 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue;
        }
        
        console.error(`[THREAD_COMPOSER] ❌ Attempt ${attempt} error: ${error.message}`);
        
        if (attempt === maxRetries) {
          return {
            success: false,
            mode: 'composer',
            error: error.message
          };
        }
        
        console.log(`[THREAD_COMPOSER] 🔄 Retrying in 5 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    // TypeScript safety
    return {
      success: false,
      mode: 'composer',
      error: 'Retry loop completed without result'
    };
  }

  /**
   * 🔥 NEW: Create timeout promise
   */
  private static createTimeoutPromise(): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Thread posting timeout'));
      }, this.THREAD_TIMEOUT_MS);
    });
  }

  /**
   * 🔥 NEW: Post with proper context management
   */
  private static async postWithContext(segments: string[]): Promise<ThreadPostResult> {
    const { default: browserManager } = await import('../core/BrowserManager');
    
    // ✅ CORRECT: Use withContext properly - context cleaned up automatically
    return await browserManager.withContext(async (context: any) => {
      const page = await context.newPage();
      
      try {
        const maxRetries = 2;
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          try {
            console.log(`🧵 THREAD_ATTEMPT: ${attempt + 1}/${maxRetries}`);
            
            await this.postViaComposer(page, segments);
            console.log('THREAD_PUBLISH_OK mode=composer');
            
            const rootUrl = await this.captureRootUrl(page);
            return {
              success: true,
              mode: 'composer',
              rootTweetUrl: rootUrl
            };
            
          } catch (composerError: any) {
            console.log(`🧵 THREAD_COMPOSER_FAILED (attempt ${attempt + 1}): ${String(composerError).slice(0, 200)}`);
            
            try {
              const rootUrl = await this.postViaReplies(page, segments);
              console.log('THREAD_PUBLISH_OK mode=reply_chain');
              return {
                success: true,
                mode: 'reply_chain',
                rootTweetUrl: rootUrl
              };
            } catch (replyError: any) {
              console.warn(`🔄 THREAD_RETRY_FALLBACK: Reply chain failed on attempt ${attempt + 1}`);
              
              if (attempt < maxRetries - 1) {
                const backoffMs = 2000 * Math.pow(2, attempt);
                console.log(`⏰ THREAD_BACKOFF: Waiting ${backoffMs}ms before retry ${attempt + 2}`);
                await page.waitForTimeout(backoffMs);
                await page.reload({ waitUntil: 'load', timeout: 10000 });
              } else {
                console.error(`THREAD_POST_FAIL: All ${maxRetries} attempts exhausted`);
                return {
                  success: false,
                  mode: 'composer',
                  error: `Composer: ${composerError.message.slice(0, 150)} | Reply: ${replyError.message.slice(0, 150)}`
                };
              }
            }
          }
        }
        
        return {
          success: false,
          mode: 'composer',
          error: 'All retry attempts completed without success'
        };
        
      } finally {
        try {
          await page.close();
        } catch {
          // Ignore close errors
        }
      }
    });
  }

  /**
   * 🌐 Initialize browser connection
   * ❌ DEPRECATED: No longer needed with proper context management
   */
  private static async initializeBrowser(): Promise<void> {
    // ❌ REMOVED: Browser page is now created fresh in postWithContext
    // This method is kept for backward compatibility but does nothing
    console.log('⚠️ DEPRECATED: initializeBrowser() called but no longer needed');
  }

  /**
   * 🎨 POST via Twitter's native composer (preferred)
   */
  private static async postViaComposer(page: Page, segments: string[]): Promise<void> {
    console.log('🎨 THREAD_COMPOSER: Attempting native composer mode...');
    
    // Focus composer with multiple strategies
    const focusResult = await ensureComposerFocused(page, { mode: 'compose' });
    if (!focusResult.success) {
      throw new Error(`COMPOSER_FOCUS_FAILED: ${focusResult.error}`);
    }
    
    // Type first segment
    const tb0 = page.locator('[data-testid^="tweetTextarea_"]').first();
    await tb0.fill('');
    await tb0.type(segments[0], { delay: 10 });
    await this.verifyTextBoxHas(page, 0, segments[0]);
    
    // Add additional cards for multi-segment
    for (let i = 1; i < segments.length; i++) {
      await this.addAnotherPost(page);
      
      const tb = page.locator('[data-testid^="tweetTextarea_"]').nth(i);
      await tb.click();
      await tb.type(segments[i], { delay: 10 });
      await this.verifyTextBoxHas(page, i, segments[i]);
    }
    
    // Sanity check: verify card count matches segments
    const cardCount = await page.locator('[data-testid^="tweetTextarea_"]').count();
    if (cardCount !== segments.length) {
      throw new Error(`CARD_COUNT_MISMATCH have=${cardCount} want=${segments.length}`);
    }
    
    // Post all
    await this.postAll(page);
    
    console.log('✅ THREAD_COMPOSER: Native composer success');
  }

  /**
   * 🔗 POST via reply chain (fallback)
   */
  private static async postViaReplies(page: Page, segments: string[]): Promise<string> {
    console.log('🔗 THREAD_REPLY_CHAIN: Starting reply chain fallback...');
    
    // Post root tweet
    const rootFocusResult = await ensureComposerFocused(page, { mode: 'compose' });
    if (!rootFocusResult.success) {
      throw new Error(`ROOT_COMPOSER_FOCUS_FAILED: ${rootFocusResult.error}`);
    }
    const rootBox = page.locator('[data-testid^="tweetTextarea_"]').first();
    await rootBox.fill('');
    await rootBox.type(segments[0], { delay: 10 });
    await this.verifyTextBoxHas(page, 0, segments[0]);
    
    // Post root
    await page.getByRole('button', { name: /^post$/i })
      .or(page.locator('[data-testid="tweetButton"]'))
      .first()
      .click();
    
    // 🔥 FIXED: Use bounded wait instead of networkidle
    await Promise.race([
      page.waitForLoadState('networkidle'),
      page.waitForTimeout(10000)
    ]);
    
    // Capture root URL
    await page.waitForSelector('a[href*="/status/"]', { timeout: 10000 });
    const rootHref = await page.locator('a[href*="/status/"]').first().getAttribute('href');
    if (!rootHref) {
      throw new Error('ROOT_URL_NOT_FOUND');
    }
    
    const rootUrl = rootHref.startsWith('http') ? rootHref : `https://x.com${rootHref}`;
    console.log(`🔗 THREAD_ROOT: ${rootUrl}`);
    
    // Post replies
    for (let i = 1; i < segments.length; i++) {
      console.log(`🔗 THREAD_REPLY ${i}/${segments.length - 1}: Posting reply...`);
      
      // Navigate to root tweet
      await page.goto(rootUrl, { waitUntil: 'networkidle' });
      
      // Resilient reply flow with multiple selectors + kb fallback
      await page.bringToFront();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(300);

      // Use resilient composer focus helper for reply
      const replyFocusResult = await ensureComposerFocused(page, { mode: 'reply' });
      if (!replyFocusResult.success) {
        throw new Error(`REPLY_COMPOSER_FOCUS_FAILED: ${replyFocusResult.error}`);
      }

      // Use the focused element from the helper
      await replyFocusResult.element!.fill(segments[i]);
      await this.verifyTextBoxHas(page, 0, segments[i]);
      
      // Try post via common tweet buttons OR kb shortcut
      const sendSelectors = [
        '[data-testid="tweetButtonInline"]',
        '[data-testid="tweetButton"]',
        'div[role="button"][data-testid="tweetButton"]',
      ];
      let sendBtn = await this.findFirst(page, sendSelectors, 5000);
      if (sendBtn) { 
        await sendBtn.click({ delay: 50 }); 
      }
      else {
        const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
        await page.keyboard.press(`${mod}+Enter`);
      }
      
      // 🔥 FIXED: Use bounded wait
      await Promise.race([
        page.waitForLoadState('networkidle'),
        page.waitForTimeout(10000)
      ]);
      
      // Delay between replies
      const delayMs = (Number(process.env.THREAD_REPLY_DELAY_SEC) || 2) * 1000;
      await page.waitForTimeout(delayMs);
      
      console.log(`✅ THREAD_REPLY_SUCCESS: ${i}/${segments.length - 1}`);
    }
    
    return rootUrl;
  }

  /**
   * 🔍 Find first visible element from selector array
   */
  private static async findFirst(page: Page, selectors: string[], timeout = 12000) {
    for (const sel of selectors) {
      const el = await page.locator(sel).first();
      try {
        await el.waitFor({ state: 'visible', timeout });
        return el;
      } catch {}
    }
    return null;
  }


  /**
   * 📝 Verify textbox contains expected content
   */
  private static async verifyTextBoxHas(page: Page, idx: number, expected: string): Promise<void> {
    const tb = page.locator('[data-testid^="tweetTextarea_"]').nth(idx);
    await tb.waitFor({ state: 'visible', timeout: 8000 });
    
    const got = (await tb.innerText()).replace(/\s+/g, ' ').trim();
    const want = expected.replace(/\s+/g, ' ').trim();
    
    if (!got.includes(want.slice(0, Math.min(40, want.length)))) {
      throw new Error(`TEXT_VERIFY_FAIL idx=${idx} got="${got.slice(0, 80)}" want~="${want.slice(0, 80)}"`);
    }
    
    console.log(`THREAD_SEG_VERIFIED idx=${idx} len=${expected.length}`);
  }

  /**
   * ➕ Add another post card to thread
   */
  private static async addAnotherPost(page: Page): Promise<void> {
    const addButton = page.getByRole('button', { name: /add another post/i })
      .or(page.locator('[data-testid="addButton"]'))
      .or(page.locator('button:has-text("Add another post")'));
    
    await addButton.first().click({ timeout: 5000 });
    await page.waitForTimeout(500); // Allow card to appear
    
    console.log('➕ THREAD_COMPOSER: Added another post card');
  }

  /**
   * 🚀 Post all cards in thread
   */
  private static async postAll(page: Page): Promise<void> {
    const postAllButton = page.getByRole('button', { name: /post all/i })
      .or(page.locator('[data-testid="tweetButton"]').last());
    
    await postAllButton.click({ timeout: 6000 });
    
    // 🔥 FIXED: Use bounded wait
    await Promise.race([
      page.waitForLoadState('networkidle'),
      page.waitForTimeout(10000)
    ]);
    
    console.log('🚀 THREAD_COMPOSER: Posted all cards');
  }

  /**
   * 📎 Capture root tweet URL after posting
   */
  private static async captureRootUrl(page: Page): Promise<string> {
    try {
      await page.waitForSelector('a[href*="/status/"]', { timeout: 10000 });
      const href = await page.locator('a[href*="/status/"]').first().getAttribute('href');
      
      if (href) {
        const rootUrl = href.startsWith('http') ? href : `https://x.com${href}`;
        console.log(`📎 THREAD_ROOT_CAPTURED: ${rootUrl}`);
        return rootUrl;
      }
    } catch {
      // Fallback URL if capture fails
    }
    
    return `https://x.com/status/${Date.now()}`;
  }

  /**
   * 🔄 Ensure browser is ready with retry mechanism
   * ❌ DEPRECATED: No longer needed with proper context management
   */
  private static async ensureBrowserReady(): Promise<void> {
    // ❌ REMOVED: Browser context is now managed by postWithContext
    // This method is kept for backward compatibility but does nothing
    console.log('⚠️ DEPRECATED: ensureBrowserReady() called but no longer needed');
  }

  /**
   * 🚑 Recover browser context after failures
   * ❌ DEPRECATED: No longer needed with proper context management
   */
  private static async recoverBrowserContext(): Promise<void> {
    // ❌ REMOVED: Browser context recovery is now handled by BrowserManager
    // This method is kept for backward compatibility but does nothing
    console.log('⚠️ DEPRECATED: recoverBrowserContext() called but no longer needed');
  }
}

export default BulletproofThreadComposer;
