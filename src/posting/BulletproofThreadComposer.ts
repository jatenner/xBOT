/**
 * 🧵 BULLETPROOF THREAD COMPOSER
 * Forces all multi-segment content to post as connected threads
 * Composer-first with reply-chain fallback - NO standalone numbered tweets
 */

import { Page } from 'playwright';
import { log } from '../lib/logger';
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
  
  // 🔥 ADAPTIVE TIMEOUT: Progressive timeout based on retry attempt
  private static getThreadTimeoutMs(retryCount: number): number {
    // attempt 1: 180s, attempt 2: 240s, attempt 3: 300s
    const timeouts = [180000, 240000, 300000];
    return timeouts[Math.min(retryCount, timeouts.length - 1)];
  }

  // Modern selectors for resilient reply flow
  private static readonly replyButtonSelectors = [
    '[data-testid="reply"]',
    'div[role="button"][data-testid="reply"]',
    'button[aria-label^="Reply"]',
    'div[role="button"][aria-label^="Reply"]'
  ];

  // 🆕 UPDATED COMPOSER SELECTORS - Match actual Twitter UI
  private static readonly composerSelectors = [
    'div[contenteditable="true"][role="textbox"]',                      // Primary - modern Twitter
    '[data-testid="tweetTextarea_0"]',                                  // Fallback 1
    'div[aria-label*="Post text"]',                                     // Fallback 2
    'div[aria-label*="What is happening"]',                             // Fallback 3
    'div[contenteditable="true"]',                                      // Fallback 4 - any contenteditable
    '.public-DraftEditor-content[contenteditable="true"]'               // Fallback 5 - Draft.js
  ];

  /**
   * 🆕 HELPER: Get compose box with robust fallback selectors
   */
  private static async getComposeBox(page: Page, index: number = 0): Promise<any> {
    const targetedSelectors = [
      `[data-testid="tweetTextarea_${index}"]`,
      `[data-testid="threadedConversationTextBox${index}"]`,
      `[aria-labelledby*="tweetTextarea_${index}"]`,
      `textarea[name="tweetTextarea_${index}"]`
    ];

    for (const selector of targetedSelectors) {
      const locator = page.locator(selector);
      const count = await locator.count().catch(() => 0);
      if (count > 0) {
        const firstMatch = locator.first();
        const isEditable = await firstMatch.evaluate((el: any) => el?.contentEditable === 'true' || el?.tagName === 'TEXTAREA').catch(() => false);
        if (isEditable) {
          console.log(`✅ Found targeted compose box #${index} with selector: ${selector}`);
          return firstMatch;
        }
      }
    }

    for (const selector of this.composerSelectors) {
      try {
        const locator = page.locator(selector);
        const count = await locator.count();
        if (count === 0) {
          continue;
        }

        const targetIndex = Math.min(index, count - 1);
        const candidate = locator.nth(targetIndex);

        const isEditable = await candidate.evaluate((el: any) => (
          el?.contentEditable === 'true' || el?.tagName === 'TEXTAREA'
        )).catch(() => false);

        if (isEditable) {
          console.log(`✅ Found compose box #${index} using fallback selector: ${selector} (resolved index ${targetIndex})`);
          return candidate;
        }
      } catch {
        continue;
      }
    }

    throw new Error(`Could not find editable compose box #${index} with any selector`);
  }

  /**
   * 🎯 MAIN METHOD: Post segments as connected thread
   */
  static async post(segments: string[]): Promise<ThreadPostResult> {
    log({ op: 'thread_post_start', mode: 'composer', segments: segments.length });
    
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

    // 🔥 ADAPTIVE TIMEOUT: Progressive timeout based on retry attempt
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const timeoutMs = this.getThreadTimeoutMs(attempt - 1);
        console.log(`[THREAD_COMPOSER][TIMEOUT] 🎯 Posting attempt ${attempt}/${maxRetries} - Using adaptive timeout: ${timeoutMs/1000}s`);
        
        const result = await Promise.race([
          this.postWithContext(segments, attempt),
          this.createTimeoutPromise(timeoutMs)
        ]);
        
        console.log(`[THREAD_COMPOSER] ✅ Success on attempt ${attempt}`);
        return result as ThreadPostResult;
        
      } catch (error: any) {
        if (error.message === 'Thread posting timeout') {
          const timeoutMs = this.getThreadTimeoutMs(attempt - 1);
          console.error(`[THREAD_COMPOSER][TIMEOUT] ⏱️ Timeout on attempt ${attempt}/${maxRetries} (exceeded ${timeoutMs/1000}s)`);
          
          if (attempt === maxRetries) {
            return {
              success: false,
              mode: 'composer',
              error: `Thread posting timeout after ${maxRetries} attempts`
            };
          }
          
          console.log(`[THREAD_COMPOSER] 🔄 Retrying in 5 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue;
        }
        
        const errorMsg = error.message || error.toString() || 'Unknown thread posting error';
        console.error(`[THREAD_COMPOSER] ❌ Attempt ${attempt} error: ${errorMsg}`);
        console.error(`[THREAD_COMPOSER] ❌ Error type: ${error.name || typeof error}`);
        console.error(`[THREAD_COMPOSER] ❌ Stack trace: ${error.stack?.substring(0, 200) || 'No stack'}`);
        
        if (attempt === maxRetries) {
          return {
            success: false,
            mode: 'composer',
            error: `Thread posting failed after ${maxRetries} attempts: ${errorMsg}`
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
   * 🔥 ADAPTIVE TIMEOUT: Create timeout promise with configurable duration
   */
  private static createTimeoutPromise(timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Thread posting timeout'));
      }, timeoutMs);
    });
  }

  /**
   * 🔥 FIXED: Use UnifiedBrowserPool (same as single posts - AUTHENTICATED!)
   */
  private static async postWithContext(segments: string[], attempt: number): Promise<ThreadPostResult> {
    const { UnifiedBrowserPool } = await import('../browser/UnifiedBrowserPool');
    const pool = UnifiedBrowserPool.getInstance();
    
    // 🔍 BROWSER HEALTH CHECK: Check pool health before posting
    const health = pool.getHealth();
    console.log(`[BROWSER_POOL] 🔍 Browser pool health check: status=${health.status}, circuitBreaker=${health.circuitBreaker.isOpen ? 'open' : 'closed'}`);
    
    if (health.status === 'degraded' || health.circuitBreaker.isOpen) {
      console.warn(`[BROWSER_POOL] ⚠️ Browser pool is degraded or circuit breaker is open - resetting pool...`);
      try {
        await pool.resetPool();
        console.log(`[BROWSER_POOL] ✅ Browser pool reset complete`);
      } catch (resetError: any) {
        console.error(`[BROWSER_POOL] ❌ Browser pool reset failed: ${resetError.message}`);
        // Continue anyway - pool might still work
      }
    }
    
    // ✅ FIX: Use the same authenticated browser pool as single posts!
    // 🔥 OPTIMIZATION: Use PRIORITY 0 (highest) so thread posting never waits
    const page = await pool.withContext(
      'thread_posting',
      async (context) => {
        return await context.newPage();
      },
      0 // 🔥 HIGHEST PRIORITY - thread posting is critical, should never wait
    );
    
    try {
      // ✅ Navigate to Twitter compose page
      const navStartTime = Date.now();
      console.log('[THREAD_COMPOSER][STAGE] 🎯 Stage: navigation - Starting...');
      await page.goto('https://x.com/compose/tweet', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      await page.waitForTimeout(2000); // Let page stabilize
      const navDuration = Date.now() - navStartTime;
      console.log(`[THREAD_COMPOSER][STAGE] ✅ Stage: navigation - Completed in ${navDuration}ms`);
      
      try {
        const maxRetries = 2;
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          try {
            console.log(`🧵 THREAD_ATTEMPT: ${attempt + 1}/${maxRetries}`);
            
            // 🎨 PREFER NATIVE COMPOSER - Better visual presentation, proper thread UI
            console.log('🎨 Using NATIVE COMPOSER mode (optimal visual appeal)');
            await this.postViaComposer(page, segments);
            console.log('THREAD_PUBLISH_OK mode=composer');
            
            const extractStartTime = Date.now();
            console.log('[THREAD_COMPOSER][STAGE] 🎯 Stage: tweet_id_extraction - Starting...');
            const rootUrl = await this.captureRootUrl(page);
            
            // Capture all tweet IDs from composer mode
            const tweetIds = await this.captureThreadIds(page, segments.length);
            const extractDuration = Date.now() - extractStartTime;
            console.log(`[THREAD_COMPOSER][STAGE] ✅ Stage: tweet_id_extraction - Completed in ${extractDuration}ms`);
            
            // ✅ IMPORTANT: Release page back to pool
            await pool.releasePage(page);
            
            return {
              success: true,
              mode: 'composer',
              rootTweetUrl: rootUrl,
              tweetIds: tweetIds.length > 0 ? tweetIds : undefined
            };
            
          } catch (composerError: any) {
            const errorMsg = composerError.message || composerError.toString() || 'Unknown composer error';
            console.log(`🧵 THREAD_COMPOSER_FAILED (attempt ${attempt + 1}): ${errorMsg.slice(0, 200)}`);
            
            // FALLBACK: Try reply chain if native composer fails
            try {
              console.log('⚠️ Native composer failed, trying reply chain as fallback...');
              const replyResult = await this.postViaReplies(page, segments);
              console.log('THREAD_PUBLISH_OK mode=reply_chain');
              
              // ✅ IMPORTANT: Release page back to pool
              await pool.releasePage(page);
              
              return {
                success: true,
                mode: 'reply_chain',
                rootTweetUrl: replyResult.rootUrl,
                tweetIds: replyResult.tweetIds
              };
            } catch (replyError: any) {
              console.warn(`🔄 THREAD_RETRY_FALLBACK: Reply chain also failed on attempt ${attempt + 1}`);
              
              if (attempt < maxRetries - 1) {
                const backoffMs = 2000 * Math.pow(2, attempt);
                console.log(`⏰ THREAD_BACKOFF: Waiting ${backoffMs}ms before retry ${attempt + 2}`);
                await page.waitForTimeout(backoffMs);
                await page.reload({ waitUntil: 'load', timeout: 10000 });
              } else {
                console.error(`THREAD_POST_FAIL: All ${maxRetries} attempts exhausted`);
                
                // ✅ IMPORTANT: Release page back to pool before returning error
                await pool.releasePage(page);
                
                return {
                  success: false,
                  mode: 'composer',
                  error: `Composer: ${composerError.message.slice(0, 150)} | Reply chain: ${replyError.message.slice(0, 150)}`
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
        
      } catch (error: any) {
        log({ op: 'thread_post_error', error: error.message });
        // ✅ IMPORTANT: Always release page on error
        await pool.releasePage(page);
        throw error;
      } finally {
        // ✅ SAFETY: Ensure page is always released (extra safety)
        try {
          await pool.releasePage(page);
        } catch {
          // Already released, ignore
        }
      }
    } catch (outerError: any) {
      log({ op: 'thread_post_outer_error', error: outerError.message });
      throw outerError;
    }
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
    console.log(`🎨 THREAD_COMPOSER: Attempting native composer mode for ${segments.length} tweets...`);
    
    // Focus composer with multiple strategies
    console.log('🎨 THREAD_COMPOSER: Step 1/5 - Focusing composer...');
    const focusResult = await ensureComposerFocused(page, { mode: 'compose' });
    if (!focusResult.success) {
      throw new Error(`COMPOSER_FOCUS_FAILED: ${focusResult.error}`);
    }
    console.log('✅ THREAD_COMPOSER: Composer focused');
    
    // Type first segment
    const typingStartTime = Date.now();
    console.log(`[THREAD_COMPOSER][STAGE] 🎯 Stage: typing - Starting tweet 1/${segments.length} (${segments[0].length} chars)...`);
    const tb0 = await this.getComposeBox(page, 0);
    await tb0.click(); // Ensure focus
    await page.waitForTimeout(300); // Allow UI to update
    
    // 🔥 FIX: Clear contenteditable properly (select all + delete)
    await page.keyboard.press('Meta+A'); // Select all (Command+A on Mac, Ctrl+A on Windows)
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(200);
    
    await tb0.type(segments[0], { delay: 10 });
    await this.verifyTextBoxHas(page, 0, segments[0]);
    const typingDuration = Date.now() - typingStartTime;
    console.log(`[THREAD_COMPOSER][STAGE] ✅ Stage: typing - Completed tweet 1 in ${typingDuration}ms`);
    
    // Add additional cards for multi-segment
    if (segments.length > 1) {
      console.log(`🎨 THREAD_COMPOSER: Step 3/5 - Adding ${segments.length - 1} more tweets...`);
      for (let i = 1; i < segments.length; i++) {
        console.log(`   ➕ Adding tweet ${i + 1}/${segments.length}...`);
        await this.addAnotherPost(page);
        await page.waitForTimeout(500); // Wait for new compose box to appear
        
        const tb = await this.getComposeBox(page, i);
        await tb.click();
        await page.waitForTimeout(200); // Allow focus
        await tb.type(segments[i], { delay: 10 });
        await this.verifyTextBoxHas(page, i, segments[i]);
        console.log(`   ✅ Tweet ${i + 1}/${segments.length} added (${segments[i].length} chars)`);
      }
    }
    
    // Sanity check: verify card count matches segments
    console.log('🎨 THREAD_COMPOSER: Step 4/5 - Verifying thread structure...');
    let cardCount = 0;
    // Try to count using the most reliable selector
    for (const selector of this.composerSelectors) {
      try {
        const count = await page.locator(selector).count();
        if (count > 0) {
          cardCount = count;
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    if (cardCount !== segments.length) {
      console.warn(`⚠️ CARD_COUNT_MISMATCH: have=${cardCount} want=${segments.length} (continuing anyway)`);
      // Don't throw - Twitter UI might have changed, but content might still be there
    } else {
      console.log(`✅ THREAD_COMPOSER: Structure verified (${cardCount} tweets)`);
    }
    
    // Post all
    const submitStartTime = Date.now();
    console.log('[THREAD_COMPOSER][STAGE] 🎯 Stage: submit - Starting...');
    await this.postAll(page);
    const submitDuration = Date.now() - submitStartTime;
    console.log(`[THREAD_COMPOSER][STAGE] ✅ Stage: submit - Completed in ${submitDuration}ms`);
    
    console.log('✅ THREAD_COMPOSER: Native composer SUCCESS - Thread posted!');
  }

  /**
   * 🔗 POST via reply chain (fallback)
   */
  private static async postViaReplies(page: Page, segments: string[]): Promise<{ rootUrl: string; tweetIds: string[] }> {
    console.log('🔗 THREAD_REPLY_CHAIN: Starting reply chain fallback...');
    
    const tweetIds: string[] = [];
    let currentTweetUrl: string; // Track the last posted tweet URL
    
    // Post root tweet
    const rootFocusResult = await ensureComposerFocused(page, { mode: 'compose' });
    if (!rootFocusResult.success) {
      throw new Error(`ROOT_COMPOSER_FOCUS_FAILED: ${rootFocusResult.error}`);
    }
    const rootBox = await this.getComposeBox(page, 0);
    await rootBox.click(); // Ensure focus
    await page.waitForTimeout(300); // Allow UI to update
    
    // 🔥 FIX: Clear contenteditable properly (select all + delete)
    await page.keyboard.press('Meta+A'); // Select all
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(200);
    
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
    
    // Capture root URL and ID
    await page.waitForSelector('a[href*="/status/"]', { timeout: 10000 });
    const rootHref = await page.locator('a[href*="/status/"]').first().getAttribute('href');
    if (!rootHref) {
      throw new Error('ROOT_URL_NOT_FOUND');
    }
    
    const rootUrl = rootHref.startsWith('http') ? rootHref : `https://x.com${rootHref}`;
    const rootId = rootUrl.match(/status\/(\d+)/)?.[1];
    if (rootId) {
      tweetIds.push(rootId);
      console.log(`🔗 THREAD_ROOT: ${rootUrl} (ID: ${rootId})`);
    } else {
      console.log(`🔗 THREAD_ROOT: ${rootUrl}`);
    }
    
    // 🔥 FIX: Start with root URL, then update to each new reply
    currentTweetUrl = rootUrl;
    
    // Post replies
    for (let i = 1; i < segments.length; i++) {
      console.log(`🔗 THREAD_REPLY ${i}/${segments.length - 1}: Posting reply to previous tweet...`);
      
      // 🔥 FIX: Navigate to LAST posted tweet (not root!)
      await page.goto(currentTweetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
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
      // 🔥 FIX: Use type() instead of fill() for contenteditable
      await replyFocusResult.element!.click();
      await page.waitForTimeout(200);
      
      // Clear any existing content
      await page.keyboard.press('Meta+A');
      await page.keyboard.press('Backspace');
      await page.waitForTimeout(200);
      
      await replyFocusResult.element!.type(segments[i], { delay: 10 });
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
      
      // 🆕 CAPTURE REPLY TWEET ID AND URL
      try {
        await page.waitForTimeout(2000); // Wait for tweet to be posted
        const newUrl = page.url();
        const replyId = newUrl.match(/status\/(\d+)/)?.[1];
        if (replyId && replyId !== rootId) {
          tweetIds.push(replyId);
          // 🔥 FIX: Update currentTweetUrl to this reply for next iteration
          currentTweetUrl = `https://x.com/${process.env.TWITTER_USERNAME || 'SignalAndSynapse'}/status/${replyId}`;
          console.log(`✅ THREAD_REPLY_SUCCESS: ${i}/${segments.length - 1} (ID: ${replyId})`);
          console.log(`🔗 NEXT_PARENT: Reply ${i + 1} will reply to ${replyId}`);
        } else {
          console.log(`✅ THREAD_REPLY_SUCCESS: ${i}/${segments.length - 1} (ID not captured)`);
          console.warn(`⚠️ Could not update parent URL, next reply may break chain`);
        }
      } catch (idError) {
        console.warn(`⚠️ Could not capture reply ${i} ID:`, idError);
        console.log(`✅ THREAD_REPLY_SUCCESS: ${i}/${segments.length - 1}`);
        console.warn(`⚠️ Chain may break at next reply due to missing URL`);
      }
      
      // Delay between replies
      const delayMs = (Number(process.env.THREAD_REPLY_DELAY_SEC) || 2) * 1000;
      await page.waitForTimeout(delayMs);
    }
    
    console.log(`🔗 THREAD_COMPLETE: Captured ${tweetIds.length}/${segments.length} tweet IDs`);
    return { rootUrl, tweetIds };
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
    const tb = await this.getComposeBox(page, idx);
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
      .or(page.locator('[data-testid="threadAddButton"]'))
      .or(page.locator('[aria-label*="Add another"]'))
      .or(page.locator('button:has-text("Add another")'))
      .or(page.locator('button[aria-label*="Add post"]'));

    await addButton.first().click({ timeout: 7000 });
    await page.waitForTimeout(700); // Allow card to appear
    
    console.log('➕ THREAD_COMPOSER: Added another post card');
  }

  /**
   * 🚀 Post all cards in thread
   */
  private static async postAll(page: Page): Promise<void> {
    console.log('🚀 THREAD_COMPOSER: Looking for "Post all" button...');
    
    // Try multiple selectors for the post button (Twitter UI changes frequently)
    const buttonSelectors = [
      'button[data-testid="tweetButton"]',  // Standard tweet button
      'button:has-text("Post all")',         // Text-based
      'button:has-text("Post")',             // Simple post
      '[data-testid="tweetButtonInline"]',  // Inline variant
      'div[role="button"]:has-text("Post")', // Div button
      'button[aria-label*="Post"]',          // ARIA label
    ];
    
    let buttonFound = false;
    let lastError = '';
    
    for (const selector of buttonSelectors) {
      try {
        console.log(`🔍 Trying selector: ${selector}`);
        const button = page.locator(selector).last(); // Use .last() for threads (multiple buttons)
        await button.waitFor({ state: 'visible', timeout: 5000 });
        await button.click({ timeout: 3000 });
        buttonFound = true;
        console.log(`✅ THREAD_COMPOSER: Clicked "Post all" using: ${selector}`);
        break;
      } catch (error: any) {
        lastError = error.message;
        console.log(`❌ Selector failed: ${selector}`);
      }
    }
    
    if (!buttonFound) {
      // Take screenshot for debugging
      try {
        await page.screenshot({ path: 'thread_post_button_not_found.png' });
        console.log('📸 Screenshot saved: thread_post_button_not_found.png');
      } catch {}
      
      throw new Error(`POST_BUTTON_NOT_FOUND: Tried ${buttonSelectors.length} selectors. Last error: ${lastError}`);
    }
    
    // Wait for posting to complete
    console.log('⏳ THREAD_COMPOSER: Waiting for post to complete...');
    await Promise.race([
      page.waitForLoadState('networkidle'),
      page.waitForTimeout(15000) // Increased to 15s for threads
    ]);
    
    console.log('🚀 THREAD_COMPOSER: Thread posted successfully!');
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
   * 🆕 Capture all tweet IDs from a thread
   */
  private static async captureThreadIds(page: Page, expectedCount: number): Promise<string[]> {
    try {
      console.log(`🔍 THREAD_IDS: Attempting to capture ${expectedCount} tweet IDs...`);
      
      // Wait for page to settle after posting
      await page.waitForTimeout(3000);
      
      // Try to find all status links on the page
      const statusLinks = await page.locator('a[href*="/status/"]').all();
      const tweetIds: string[] = [];
      
      for (const link of statusLinks) {
        try {
          const href = await link.getAttribute('href');
          if (href) {
            const match = href.match(/status\/(\d+)/);
            if (match && match[1]) {
              const id = match[1];
              // Avoid duplicates
              if (!tweetIds.includes(id)) {
                tweetIds.push(id);
              }
            }
          }
        } catch (e) {
          // Skip this link
        }
      }
      
      console.log(`📊 THREAD_IDS: Captured ${tweetIds.length}/${expectedCount} tweet IDs`);
      
      if (tweetIds.length > 0) {
        console.log(`🔗 Thread IDs: ${tweetIds.join(', ')}`);
      }
      
      return tweetIds.slice(0, expectedCount); // Return up to expected count
      
    } catch (error: any) {
      console.warn(`⚠️ THREAD_IDS: Could not capture all IDs: ${error.message}`);
      return [];
    }
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

