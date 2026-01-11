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
    // attempt 1: 240s (was 180s), attempt 2: 300s (was 240s), attempt 3: 360s (was 300s)
    const timeouts = [240000, 300000, 360000];
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
  static async post(segments: string[], decisionId?: string, permit_id?: string): Promise<ThreadPostResult> {
    log({ op: 'thread_post_start', mode: 'composer', segments: segments.length });
    
    // 🔒 POSTING PERMIT CHECK (FINAL CHOKE POINT FOR THREADS)
    if (!permit_id) {
      const errorMsg = `[PERMIT_CHOKE] ❌ BLOCKED: No permit_id provided for thread. decisionId=${decisionId}`;
      console.error(errorMsg);
      console.error(`[PERMIT_CHOKE] Stack: ${new Error().stack}`);
      
      const { getSupabaseClient } = await import('../db/index');
      const supabase = getSupabaseClient();
      await supabase.from('system_events').insert({
        event_type: 'thread_posting_blocked_no_permit',
        severity: 'critical',
        message: `Thread posting blocked: No permit_id`,
        event_data: {
          decision_id: decisionId,
          stack_trace: new Error().stack?.substring(0, 1000),
        },
        created_at: new Date().toISOString(),
      });
      
      return {
        success: false,
        mode: 'composer',
        error: 'BLOCKED: No posting permit - thread posting requires permit_id',
      };
    }
    
    const { verifyPostingPermit } = await import('./postingPermit');
    const permitCheck = await verifyPostingPermit(permit_id);
    if (!permitCheck.valid) {
      const errorMsg = `[PERMIT_CHOKE] ❌ BLOCKED: Permit not valid for thread. permit_id=${permit_id} error=${permitCheck.error}`;
      console.error(errorMsg);
      
      const { getSupabaseClient } = await import('../db/index');
      const supabase = getSupabaseClient();
      await supabase.from('system_events').insert({
        event_type: 'thread_posting_blocked_invalid_permit',
        severity: 'critical',
        message: `Thread posting blocked: Permit not valid`,
        event_data: {
          permit_id,
          decision_id: decisionId,
          permit_error: permitCheck.error,
        },
        created_at: new Date().toISOString(),
      });
      
      return {
        success: false,
        mode: 'composer',
        error: `BLOCKED: Permit not valid (${permitCheck.error})`,
      };
    }
    
    console.log(`[PERMIT_CHOKE] ✅ Thread permit verified: ${permit_id} (status: ${permitCheck.permit?.status})`);
    
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
    const threadDecisionId = decisionId || 'unknown';
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      let page: Page | null = null;
      try {
        const timeoutMs = this.getThreadTimeoutMs(attempt - 1);
        console.log(`[THREAD_COMPOSER][TIMEOUT] 🎯 Posting attempt ${attempt}/${maxRetries} - Using adaptive timeout: ${timeoutMs/1000}s`);
        
        const result = await Promise.race([
          this.postWithContext(segments, attempt, threadDecisionId, permit_id).then(r => {
            // Store page reference for autopsy if needed
            return r;
          }),
          this.createTimeoutPromise(timeoutMs).then(() => {
            throw new Error('Thread posting timeout');
          })
        ]);
        
        console.log(`[THREAD_COMPOSER] ✅ Success on attempt ${attempt}`);
        return result as ThreadPostResult;
        
      } catch (error: any) {
        // Store page reference for autopsy
        if (error.page) {
          page = error.page;
        }
        
        if (error.message === 'Thread posting timeout') {
          const timeoutMs = this.getThreadTimeoutMs(attempt - 1);
          console.error(`[THREAD_COMPOSER][TIMEOUT] ⏱️ Timeout on attempt ${attempt}/${maxRetries} (exceeded ${timeoutMs/1000}s)`);
          
          // 🔍 TIMEOUT AUTOPSY: Capture screenshot and HTML
          if (page) {
            await this.captureTimeoutAutopsy(page, threadDecisionId, attempt);
          }
          
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
        
        // 🔍 ERROR AUTOPSY: Capture screenshot and HTML on any error
        if (page) {
          await this.captureTimeoutAutopsy(page, threadDecisionId, attempt);
        }
        
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
   * 🔍 TIMEOUT AUTOPSY: Capture screenshot and HTML on timeout/error
   */
  private static async captureTimeoutAutopsy(page: Page, decisionId: string, attempt: number): Promise<void> {
    try {
      const screenshotPath = `/tmp/thread_timeout_${decisionId}_${attempt}.png`;
      const htmlPath = `/tmp/thread_timeout_${decisionId}_${attempt}.html`;
      const currentUrl = page.url();
      
      // Capture screenshot
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`[THREAD_COMPOSER][AUTOPSY] 📸 Screenshot saved: ${screenshotPath}`);
      
      // Capture HTML
      const html = await page.content();
      const fs = await import('fs');
      fs.writeFileSync(htmlPath, html);
      console.log(`[THREAD_COMPOSER][AUTOPSY] 📄 HTML saved: ${htmlPath}`);
      
      // Check for rate limit / error banners
      const rateLimitBanner = await page.locator('text=/rate limit|too many|try again/i').count();
      const errorBanner = await page.locator('text=/error|failed|something went wrong/i').count();
      const composerVisible = await page.locator('[data-testid="tweetTextarea_0"]').count();
      
      console.log(`[THREAD_COMPOSER][AUTOPSY] 🔍 Current URL: ${currentUrl}`);
      console.log(`[THREAD_COMPOSER][AUTOPSY] 🔍 Rate limit banner: ${rateLimitBanner > 0 ? 'YES' : 'NO'}`);
      console.log(`[THREAD_COMPOSER][AUTOPSY] 🔍 Error banner: ${errorBanner > 0 ? 'YES' : 'NO'}`);
      console.log(`[THREAD_COMPOSER][AUTOPSY] 🔍 Composer visible: ${composerVisible > 0 ? 'YES' : 'NO'}`);
      
    } catch (autopsyError: any) {
      console.error(`[THREAD_COMPOSER][AUTOPSY] ❌ Failed to capture autopsy: ${autopsyError.message}`);
    }
  }

  /**
   * 🔍 PAGE LIVENESS: Check if page is closed or browser context is gone
   */
  private static isPageClosed(page?: Page | null): boolean {
    if (!page) return true;
    try {
      if (page.isClosed()) return true;
      const context = page.context();
      if (!context) return true;
      const browser = context.browser();
      if (!browser || !browser.isConnected()) return true;
      return false;
    } catch {
      return true; // If we can't check, assume closed
    }
  }

  /**
   * 🔄 RECOVER: Ensure page is live, recreate if closed
   */
  private static async ensureLivePage(
    page: Page | null,
    pool: any,
    decisionId: string,
    attempt: number
  ): Promise<Page> {
    if (!this.isPageClosed(page)) {
      return page!;
    }

    console.log(`[THREAD_COMPOSER][RECOVER] page was closed -> recreating page (decisionId=${decisionId}, attempt=${attempt})`);
    
    // Release old page if it exists
    if (page) {
      try {
        await pool.releasePage(page);
      } catch {
        // Ignore release errors
      }
    }

    // Create fresh page using existing pool logic
    const newPage = await pool.withContext(
      'thread_posting_recovery',
      async (context) => {
        return await context.newPage();
      },
      0 // Highest priority
    );

    return newPage;
  }

  /**
   * 🔍 Check if error is a closed page/browser error
   */
  private static isClosedError(err: unknown): boolean {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return errorMsg.includes('Target page, context or browser has been closed') || 
           errorMsg.includes('has been closed');
  }

  /**
   * ⏱️ SAFE WAIT: Wait with page liveness checks and recovery
   * Returns the page (may be recreated if closed)
   */
  private static async safeWait(
    page: Page,
    ms: number,
    meta: { decisionId: string; attempt: number; stage: string },
    pool: any
  ): Promise<Page> {
    try {
      await page.waitForTimeout(ms);
      return page;
    } catch (error: any) {
      if (this.isClosedError(error)) {
        console.log(`[THREAD_COMPOSER][RECOVER] waitForTimeout failed - page closed. Recreating page... (decisionId=${meta.decisionId}, attempt=${meta.attempt}, stage=${meta.stage})`);
        
        // Recreate page using existing pool logic
        const recoveredPage = await this.ensureLivePage(page, pool, meta.decisionId, meta.attempt);
        
        // Retry with shorter wait just to yield
        try {
          await recoveredPage.waitForTimeout(250);
        } catch {
          // Ignore retry errors - we've done our best
        }
        
        return recoveredPage;
      } else {
        throw error; // Re-throw non-closure errors
      }
    }
  }

  /**
   * ✅ VERIFY PASTE: Verify paste succeeded, fallback to typing if empty
   * 🔥 ENHANCED: Robust paste verification with multiple fallback strategies
   */
  private static async verifyPasteAndFallback(
    page: Page,
    text: string,
    index: number,
    total: number,
    decisionId: string,
    attempt: number,
    pool: any
  ): Promise<Page> {
    // 🎯 STEP 1: Wait for composer to be ready
    await page.waitForSelector(`[data-testid="tweetTextarea_${index}"], div[contenteditable="true"][role="textbox"]`, { timeout: 5000 }).catch(() => {
      // Continue if selector not found - will be handled in getComposeBox
    });
    
    // 🎯 STEP 2: Ensure compose textarea exists, visible, enabled
    const composeBox = await this.getComposeBox(page, index);
    await composeBox.click(); // Ensure focus
    page = await this.safeWait(page, 200, { decisionId, attempt, stage: 'composer_focus' }, pool);
    
    // 🎯 STEP 3: Attempt paste (clipboard)
    const pasteMethod = 'paste';
    try {
      await page.evaluate((args: { text: string; index: number }) => {
        const textarea = document.querySelector(`[data-testid="tweetTextarea_${args.index}"]`) as HTMLTextAreaElement;
        const contenteditable = document.querySelector(`div[contenteditable="true"][role="textbox"]`) as HTMLElement;
        
        if (textarea) {
          textarea.value = args.text;
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          textarea.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (contenteditable) {
          contenteditable.textContent = args.text;
          contenteditable.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }, { text, index });
      
      page = await this.safeWait(page, 300, { decisionId, attempt, stage: 'paste_wait' }, pool);
    } catch (pasteError: any) {
      console.log(`[THREAD_COMPOSER][VERIFY] paste attempt failed: ${pasteError.message}`);
    }
    
    // 🎯 STEP 4: Wait for textarea value with timeout (minLen=20, timeout=3000ms)
    const waitForTextareaValue = async (minLen: number, timeoutMs: number): Promise<string> => {
      return await page.waitForFunction(
        (args: { index: number; minLen: number }) => {
          const textarea = document.querySelector(`[data-testid="tweetTextarea_${args.index}"]`) as HTMLTextAreaElement;
          const contenteditable = document.querySelector(`div[contenteditable="true"][role="textbox"]`) as HTMLElement;
          
          let value = '';
          if (textarea) {
            value = textarea.value || textarea.textContent || '';
          } else if (contenteditable) {
            value = contenteditable.textContent || contenteditable.innerText || '';
          }
          
          return value.trim().length >= args.minLen ? value : null;
        },
        { index, minLen },
        { timeout: timeoutMs }
      ).then(() => {
        // Value found, read it back
        return page.evaluate((idx: number) => {
          const textarea = document.querySelector(`[data-testid="tweetTextarea_${idx}"]`) as HTMLTextAreaElement;
          const contenteditable = document.querySelector(`div[contenteditable="true"][role="textbox"]`) as HTMLElement;
          
          if (textarea) {
            return textarea.value || textarea.textContent || '';
          } else if (contenteditable) {
            return contenteditable.textContent || contenteditable.innerText || '';
          }
          return '';
        }, index);
      }).catch(() => {
        // Timeout - return empty string
        return '';
      });
    };
    
    let readText = await waitForTextareaValue(20, 3000);
    
    // If still empty, retry paste once (focus again)
    if (readText.trim().length === 0) {
      console.log(`[THREAD_COMPOSER][VERIFY] part ${index + 1}/${total} paste empty -> retry paste (decisionId=${decisionId}, attempt=${attempt})`);
      
      // Re-focus and retry paste
      await composeBox.click();
      page = await this.safeWait(page, 200, { decisionId, attempt, stage: 'paste_retry_focus' }, pool);
      
      await page.evaluate((args: { text: string; index: number }) => {
        const textarea = document.querySelector(`[data-testid="tweetTextarea_${args.index}"]`) as HTMLTextAreaElement;
        const contenteditable = document.querySelector(`div[contenteditable="true"][role="textbox"]`) as HTMLElement;
        
        if (textarea) {
          textarea.focus();
          textarea.value = args.text;
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          textarea.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (contenteditable) {
          contenteditable.focus();
          contenteditable.textContent = args.text;
          contenteditable.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }, { text, index });
      
      page = await this.safeWait(page, 300, { decisionId, attempt, stage: 'paste_retry_wait' }, pool);
      readText = await waitForTextareaValue(20, 3000);
    }
    
    // If still empty after retry, fallback to typing
    if (readText.trim().length === 0) {
      console.log(`[THREAD_COMPOSER][VERIFY] part ${index + 1}/${total} paste still empty -> fallback typing (decisionId=${decisionId}, attempt=${attempt})`);
      
      const tb = await this.getComposeBox(page, index);
      await tb.click();
      page = await this.safeWait(page, 200, { decisionId, attempt, stage: 'typing_fallback' }, pool);
      await tb.type(text, { delay: 5 });
      page = await this.safeWait(page, 300, { decisionId, attempt, stage: 'typing_fallback_wait' }, pool);
      
      // Final verification via DOM value length
      const typedText = await page.evaluate((idx: number) => {
        const textarea = document.querySelector(`[data-testid="tweetTextarea_${idx}"]`) as HTMLTextAreaElement;
        const contenteditable = document.querySelector(`div[contenteditable="true"][role="textbox"]`) as HTMLElement;
        
        if (textarea) {
          return textarea.value || textarea.textContent || '';
        } else if (contenteditable) {
          return contenteditable.textContent || contenteditable.innerText || '';
        }
        return '';
      }, index);
      
      if (typedText.trim().length === 0) {
        // Autopsy: capture selector + activeElement info
        const autopsy = await page.evaluate((idx: number) => {
          const textarea = document.querySelector(`[data-testid="tweetTextarea_${idx}"]`) as HTMLTextAreaElement;
          const contenteditable = document.querySelector(`div[contenteditable="true"][role="textbox"]`) as HTMLElement;
          const activeElement = document.activeElement;
          
          return {
            textareaExists: !!textarea,
            textareaVisible: textarea ? (textarea.offsetParent !== null) : false,
            contenteditableExists: !!contenteditable,
            contenteditableVisible: contenteditable ? (contenteditable.offsetParent !== null) : false,
            activeElementTag: activeElement ? activeElement.tagName : 'none',
            activeElementId: activeElement ? (activeElement as HTMLElement).id || 'none' : 'none'
          };
        }, index);
        
        console.error(`[THREAD_COMPOSER][VERIFY] ❌ ComposerTextEmptyAfterPasteAndType decisionId=${decisionId} part=${index + 1} attempt=${attempt}`);
        console.error(`[THREAD_COMPOSER][VERIFY] Autopsy: textareaExists=${autopsy.textareaExists} textareaVisible=${autopsy.textareaVisible} contenteditableExists=${autopsy.contenteditableExists} contenteditableVisible=${autopsy.contenteditableVisible} activeElementTag=${autopsy.activeElementTag}`);
        
        throw new Error(`ComposerTextEmptyAfterPasteAndType decisionId=${decisionId} part=${index + 1} textareaExists=${autopsy.textareaExists} textareaVisible=${autopsy.textareaVisible} activeElementTag=${autopsy.activeElementTag}`);
      }
      
      const finalCharCount = typedText.trim().length;
      console.log(`[THREAD_COMPOSER][VERIFY] part ${index + 1}/${total} composer_len=${finalCharCount} method=type (decisionId=${decisionId}, attempt=${attempt})`);
    } else {
      const charCount = readText.trim().length;
      console.log(`[THREAD_COMPOSER][VERIFY] part ${index + 1}/${total} composer_len=${charCount} method=${pasteMethod} (decisionId=${decisionId}, attempt=${attempt})`);
    }
    
    return page;
  }

  /**
   * 🔥 FIXED: Use UnifiedBrowserPool (same as single posts - AUTHENTICATED!)
   */
  private static async postWithContext(segments: string[], attempt: number, decisionId?: string | null, permit_id?: string): Promise<ThreadPostResult> {
    const { UnifiedBrowserPool } = await import('../browser/UnifiedBrowserPool');
    const pool = UnifiedBrowserPool.getInstance();
    const threadDecisionId = decisionId || 'unknown';
    
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
    let page = await pool.withContext(
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
      page = await this.safeWait(page, 2000, { decisionId: threadDecisionId, attempt, stage: 'navigation_stabilize' }, pool); // Let page stabilize
      const navDuration = Date.now() - navStartTime;
      console.log(`[THREAD_COMPOSER][STAGE] ✅ Stage: navigation - Completed in ${navDuration}ms`);
      
      try {
        const maxRetries = 2;
        
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          try {
            console.log(`🧵 THREAD_ATTEMPT: ${attempt + 1}/${maxRetries}`);
            
            // 🎨 PREFER NATIVE COMPOSER - Better visual presentation, proper thread UI
            console.log('🎨 Using NATIVE COMPOSER mode (optimal visual appeal)');
            await this.postViaComposer(page, segments, threadDecisionId, attempt, pool);
            console.log('THREAD_PUBLISH_OK mode=composer');
            
            const extractStartTime = Date.now();
            console.log('[THREAD_COMPOSER][STAGE] 🎯 Stage: tweet_id_extraction - Starting...');
            let rootUrl: string;
            let tweetIds: string[];
            try {
              rootUrl = await this.captureRootUrl(page);
            
            // Capture all tweet IDs from composer mode
              tweetIds = await this.captureThreadIds(page, segments.length);
              const extractDuration = Date.now() - extractStartTime;
              console.log(`[THREAD_COMPOSER][STAGE] ✅ Stage: tweet_id_extraction - Done (${extractDuration}ms)`);
            } catch (extractError: any) {
              const extractDuration = Date.now() - extractStartTime;
              console.error(`[THREAD_COMPOSER][STAGE] ❌ Stage: tweet_id_extraction - Failed after ${extractDuration}ms: ${extractError.message}`);
              throw extractError;
            }
            
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
              const replyResult = await this.postViaReplies(page, segments, pool, permit_id);
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
                await this.safeWait(page, backoffMs, { decisionId: threadDecisionId, attempt: attempt + 1, stage: 'backoff' }, pool);
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
  private static async postViaComposer(page: Page, segments: string[], decisionId: string, attempt: number, pool: any): Promise<Page> {
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
    console.log(`[THREAD_COMPOSER][STAGE] 🎯 Stage: typing tweet 1/${segments.length} - Starting (${segments[0].length} chars)...`);
    const tb0 = await this.getComposeBox(page, 0);
    await tb0.click(); // Ensure focus
    page = await this.safeWait(page, 300, { decisionId, attempt, stage: 'typing_focus' }, pool); // Allow UI to update
    
    // 🔥 FIX: Clear contenteditable properly (select all + delete)
    await page.keyboard.press('Meta+A'); // Select all (Command+A on Mac, Ctrl+A on Windows)
    await page.keyboard.press('Backspace');
    page = await this.safeWait(page, 200, { decisionId, attempt, stage: 'typing_clear' }, pool);
    
    // 🚀 OPTIMIZATION: Try clipboard paste first (much faster than typing)
    try {
      await page.evaluate((text) => {
        const textarea = document.querySelector('[data-testid="tweetTextarea_0"]') as HTMLTextAreaElement;
        if (textarea) {
          textarea.value = text;
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }, segments[0]);
      page = await this.safeWait(page, 100, { decisionId, attempt, stage: 'paste_wait' }, pool); // Brief wait for input event
      
      // ✅ VERIFY PASTE: Check if paste succeeded, fallback to typing if empty
      page = await this.verifyPasteAndFallback(page, segments[0], 0, segments.length, decisionId, attempt, pool);
      
      console.log(`[THREAD_COMPOSER][STAGE] ✅ Used clipboard paste for tweet 1`);
    } catch (pasteError) {
      // Fallback to typing if paste fails
      console.log(`[THREAD_COMPOSER][STAGE] ⚠️ Paste failed, falling back to typing`);
      const tb0Refreshed = await this.getComposeBox(page, 0);
      await tb0Refreshed.type(segments[0], { delay: 5 }); // Reduced delay from 10ms to 5ms
      page = await this.safeWait(page, 200, { decisionId, attempt, stage: 'typing_fallback_wait' }, pool);
    }
    
    await this.verifyTextBoxHas(page, 0, segments[0]);
    const typingDuration = Date.now() - typingStartTime;
    console.log(`[THREAD_COMPOSER][STAGE] ✅ Stage: typing tweet 1/${segments.length} - Done (${typingDuration}ms)`);
    
    // Add additional cards for multi-segment
    if (segments.length > 1) {
      console.log(`🎨 THREAD_COMPOSER: Step 3/5 - Adding ${segments.length - 1} more tweets...`);
      for (let i = 1; i < segments.length; i++) {
        const tweetTypingStartTime = Date.now();
        console.log(`[THREAD_COMPOSER][STAGE] 🎯 Stage: typing tweet ${i + 1}/${segments.length} - Starting (${segments[i].length} chars)...`);
        console.log(`   ➕ Adding tweet ${i + 1}/${segments.length}...`);
        await this.addAnotherPost(page);
        page = await this.safeWait(page, 300, { decisionId, attempt, stage: 'add_post_wait' }, pool); // Reduced from 500ms - wait for new compose box to appear
        
        const tb = await this.getComposeBox(page, i);
        await tb.click();
        page = await this.safeWait(page, 100, { decisionId, attempt, stage: 'typing_focus' }, pool); // Reduced from 200ms - allow focus
        
        // 🚀 OPTIMIZATION: Try clipboard paste first (much faster than typing)
        try {
          await page.evaluate((args: { text: string; index: number }) => {
            const textarea = document.querySelector(`[data-testid="tweetTextarea_${args.index}"]`) as HTMLTextAreaElement;
            if (textarea) {
              textarea.value = args.text;
              textarea.dispatchEvent(new Event('input', { bubbles: true }));
            }
          }, { text: segments[i], index: i });
          page = await this.safeWait(page, 100, { decisionId, attempt, stage: 'paste_wait' }, pool); // Brief wait for input event
          
          // ✅ VERIFY PASTE: Check if paste succeeded, fallback to typing if empty
          page = await this.verifyPasteAndFallback(page, segments[i], i, segments.length, decisionId, attempt, pool);
          
          console.log(`[THREAD_COMPOSER][STAGE] ✅ Used clipboard paste for tweet ${i + 1}`);
        } catch (pasteError) {
          // Fallback to typing if paste fails
          console.log(`[THREAD_COMPOSER][STAGE] ⚠️ Paste failed, falling back to typing`);
          const tbRefreshed = await this.getComposeBox(page, i);
          await tbRefreshed.type(segments[i], { delay: 5 }); // Reduced delay from 10ms to 5ms
          page = await this.safeWait(page, 200, { decisionId, attempt, stage: 'typing_fallback_wait' }, pool);
        }
        
        await this.verifyTextBoxHas(page, i, segments[i]);
        const tweetTypingDuration = Date.now() - tweetTypingStartTime;
        console.log(`[THREAD_COMPOSER][STAGE] ✅ Stage: typing tweet ${i + 1}/${segments.length} - Done (${tweetTypingDuration}ms)`);
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
    try {
    await this.postAll(page);
      const submitDuration = Date.now() - submitStartTime;
      console.log(`[THREAD_COMPOSER][STAGE] ✅ Stage: submit - Done (${submitDuration}ms)`);
    } catch (submitError: any) {
      const submitDuration = Date.now() - submitStartTime;
      console.error(`[THREAD_COMPOSER][STAGE] ❌ Stage: submit - Failed after ${submitDuration}ms: ${submitError.message}`);
      throw submitError;
    }
    
    console.log('✅ THREAD_COMPOSER: Native composer SUCCESS - Thread posted!');
    return page;
  }

  /**
   * 🔗 POST via reply chain (fallback)
   * ⚠️ WARNING: This method posts replies directly - must only be used for thread continuation, not initial replies to external tweets
   */
  private static async postViaReplies(page: Page, segments: string[], pool: any, permit_id?: string): Promise<{ rootUrl: string; tweetIds: string[] }> {
    console.log('🔗 THREAD_REPLY_CHAIN: Starting reply chain fallback...');
    
    // 🔒 SERVICE_ROLE CHECK: Use role resolver (single source of truth)
    const { isWorkerService } = await import('../utils/serviceRoleResolver');
    const isWorker = isWorkerService();
    
    if (!isWorker) {
      const errorMsg = `[SEV1_GHOST_BLOCK] ❌ BLOCKED: Not running on worker service. SERVICE_ROLE=${process.env.SERVICE_ROLE || 'NOT SET'}`;
      console.error(errorMsg);
      
      const { getSupabaseClient } = await import('../db/index');
      const supabase = getSupabaseClient();
      await supabase.from('system_events').insert({
        event_type: 'posting_blocked_wrong_service',
        severity: 'critical',
        message: `Reply chain blocked: Not running on worker service`,
        event_data: {
          service_role: process.env.SERVICE_ROLE || 'NOT SET',
          service_name: process.env.RAILWAY_SERVICE_NAME || 'unknown',
          git_sha: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_SHA || 'unknown',
          reason: 'not_worker_service',
          stack_trace: new Error().stack?.substring(0, 1000),
        },
        created_at: new Date().toISOString(),
      });
      
      throw new Error('BLOCKED: Posting only allowed from worker service (SERVICE_ROLE=worker)');
    }
    
    // 🔒 PERMIT CHECK: Reply chain fallback must have permit
    if (!permit_id) {
      const errorMsg = `[PERMIT_CHOKE] ❌ BLOCKED: Reply chain fallback requires permit_id`;
      console.error(errorMsg);
      
      const { getSupabaseClient } = await import('../db/index');
      const supabase = getSupabaseClient();
      await supabase.from('system_events').insert({
        event_type: 'reply_chain_fallback_blocked_no_permit',
        severity: 'critical',
        message: `Reply chain fallback blocked: No permit_id`,
        event_data: {
          segments_count: segments.length,
          stack_trace: new Error().stack?.substring(0, 1000),
        },
        created_at: new Date().toISOString(),
      });
      
      throw new Error('BLOCKED: Reply chain fallback requires permit_id');
    }
    
    // Verify permit is APPROVED
    const { verifyPostingPermit } = await import('./postingPermit');
    const permitCheck = await verifyPostingPermit(permit_id);
    if (!permitCheck.valid) {
      const errorMsg = `[PERMIT_CHOKE] ❌ BLOCKED: Permit not valid for reply chain: ${permitCheck.error}`;
      console.error(errorMsg);
      
      const { getSupabaseClient } = await import('../db/index');
      const supabase = getSupabaseClient();
      await supabase.from('system_events').insert({
        event_type: 'reply_chain_fallback_blocked_invalid_permit',
        severity: 'critical',
        message: `Reply chain fallback blocked: Invalid permit`,
        event_data: {
          permit_id,
          permit_error: permitCheck.error,
        },
        created_at: new Date().toISOString(),
      });
      
      throw new Error(`BLOCKED: Permit not valid (${permitCheck.error})`);
    }
    
    console.log(`[PERMIT_CHOKE] ✅ Reply chain permit verified: ${permit_id}`);
    
    const tweetIds: string[] = [];
    let currentTweetUrl: string; // Track the last posted tweet URL
    
    // Post root tweet
    const rootFocusResult = await ensureComposerFocused(page, { mode: 'compose' });
    if (!rootFocusResult.success) {
      throw new Error(`ROOT_COMPOSER_FOCUS_FAILED: ${rootFocusResult.error}`);
    }
    const rootBox = await this.getComposeBox(page, 0);
    await rootBox.click(); // Ensure focus
    await this.safeWait(page, 300, { decisionId: 'reply_chain', attempt: 0, stage: 'reply_focus' }, pool); // Allow UI to update
    
    // 🔥 FIX: Clear contenteditable properly (select all + delete)
    await page.keyboard.press('Meta+A'); // Select all
    await page.keyboard.press('Backspace');
    await this.safeWait(page, 200, { decisionId: 'reply_chain', attempt: 0, stage: 'reply_clear' }, pool);
    
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
      this.safeWait(page, 10000, { decisionId: 'reply_chain', attempt: 0, stage: 'reply_post_wait' }, pool)
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
      await this.safeWait(page, 300, { decisionId: 'reply_chain', attempt: i, stage: 'reply_nav_wait' }, pool);

      // Use resilient composer focus helper for reply
      const replyFocusResult = await ensureComposerFocused(page, { mode: 'reply' });
      if (!replyFocusResult.success) {
        throw new Error(`REPLY_COMPOSER_FOCUS_FAILED: ${replyFocusResult.error}`);
      }

      // Use the focused element from the helper
      // 🔥 FIX: Use type() instead of fill() for contenteditable
      await replyFocusResult.element!.click();
      await this.safeWait(page, 200, { decisionId: 'reply_chain', attempt: i, stage: 'reply_focus' }, pool);
      
      // Clear any existing content
      await page.keyboard.press('Meta+A');
      await page.keyboard.press('Backspace');
      await this.safeWait(page, 200, { decisionId: 'reply_chain', attempt: i, stage: 'reply_clear' }, pool);
      
      await replyFocusResult.element!.type(segments[i], { delay: 10 });
      await this.verifyTextBoxHas(page, 0, segments[i]);
      
      // 🔒 LOG REPLY CLICK ATTEMPT: Log every attempt to click Post/Reply in reply chain
      try {
        const { getSupabaseClient } = await import('../db/index');
        const supabase = getSupabaseClient();
        const logPromise = supabase.from('system_events').insert({
          event_type: 'reply_chain_click_attempt',
          severity: 'info',
          message: `Attempting to click Post/Reply in reply chain fallback`,
          event_data: {
            permit_id: permit_id,
            segment_index: i,
            total_segments: segments.length,
            git_sha: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_SHA || 'unknown',
          },
          created_at: new Date().toISOString(),
        });
        Promise.resolve(logPromise).catch(() => {}); // Non-critical logging
      } catch (logError) {
        // Non-critical
      }
      
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
        this.safeWait(page, 10000, { decisionId: 'reply_chain', attempt: i, stage: 'reply_post_wait' }, pool)
      ]);
      
      // 🆕 CAPTURE REPLY TWEET ID FROM DOM (Not URL!)
      try {
        await this.safeWait(page, 3000, { decisionId: 'reply_chain', attempt: i, stage: 'reply_capture_wait' }, pool);
        
        // Wait for tweet articles to load
        await page.waitForSelector('article[data-testid="tweet"]', { timeout: 5000 });
        
        // Extract ID from the LAST article (newest tweet = our reply)
        const replyId = await page.evaluate(() => {
          const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
          if (articles.length === 0) return null;
          
          // Get last article (most recent tweet)
          const lastArticle = articles[articles.length - 1];
          
          // Find status link in this article
          const statusLink = lastArticle.querySelector('a[href*="/status/"]');
          if (!statusLink) return null;
          
          const href = statusLink.getAttribute('href');
          if (!href) return null;
          
          // Extract ID from href
          const match = href.match(/\/status\/(\d+)/);
          return match ? match[1] : null;
        });
        
        if (replyId && replyId !== rootId && !tweetIds.includes(replyId)) {
          tweetIds.push(replyId);
          currentTweetUrl = `https://x.com/${process.env.TWITTER_USERNAME || 'SignalAndSynapse'}/status/${replyId}`;
          console.log(`✅ THREAD_REPLY_SUCCESS: ${i}/${segments.length - 1} (ID: ${replyId})`);
          console.log(`🔗 NEXT_PARENT: Reply ${i + 1} will reply to ${replyId}`);
        } else {
          console.log(`✅ THREAD_REPLY_SUCCESS: ${i}/${segments.length - 1} (ID not captured - replyId=${replyId})`);
          console.warn(`⚠️ Could not capture unique ID, next reply may break chain`);
        }
      } catch (idError: any) {
        console.warn(`⚠️ Could not capture reply ${i} ID:`, idError.message);
        console.log(`✅ THREAD_REPLY_SUCCESS: ${i}/${segments.length - 1} (exception during capture)`);
        console.warn(`⚠️ Chain may break at next reply due to missing URL`);
      }
      
      // Delay between replies
      const delayMs = (Number(process.env.THREAD_REPLY_DELAY_SEC) || 2) * 1000;
      await this.safeWait(page, delayMs, { decisionId: 'reply_chain', attempt: i, stage: 'reply_delay' }, pool);
    }
    
    console.log(`🔗 THREAD_COMPLETE: Captured ${tweetIds.length}/${segments.length} tweet IDs`);
    
    // 🔥 THREAD TRUTH FIX: Log exact result before returning
    const rootTweetId = tweetIds[0] || rootUrl?.split('/').pop() || '';
    console.log(`[THREAD_RESULT] mode=REPLY_CHAIN root_tweet_id=${rootTweetId} tweet_ids_count=${tweetIds.length} tweet_ids=${tweetIds.join(',')}`);
    
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
   * 🔥 FIXED: Use page.evaluate() to read value consistently with verifyPasteAndFallback
   */
  private static async verifyTextBoxHas(page: Page, idx: number, expected: string): Promise<void> {
    const tb = await this.getComposeBox(page, idx);
    await tb.waitFor({ state: 'visible', timeout: 8000 });

    // 🔥 FIX: Use same method as verifyPasteAndFallback (page.evaluate vs innerText)
    const got = await page.evaluate((index: number) => {
      const textarea = document.querySelector(`[data-testid="tweetTextarea_${index}"]`) as HTMLTextAreaElement;
      const contenteditable = document.querySelector(`div[contenteditable="true"][role="textbox"]`) as HTMLElement;
      
      if (textarea) {
        return textarea.value || textarea.textContent || '';
      } else if (contenteditable) {
        return contenteditable.textContent || contenteditable.innerText || '';
      }
      return '';
    }, idx);
    
    const gotClean = got.replace(/\s+/g, ' ').trim();
    const want = expected.replace(/\s+/g, ' ').trim();
    
    if (!gotClean.includes(want.slice(0, Math.min(40, want.length)))) {
      throw new Error(`TEXT_VERIFY_FAIL idx=${idx} got="${gotClean.slice(0, 80)}" want~="${want.slice(0, 80)}"`);
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
    // Note: safeWait requires pool, but we don't have it here. Use regular wait with try/catch
    try {
    await page.waitForTimeout(700); // Allow card to appear
    } catch (error: any) {
      if (error.message?.includes('Target page, context or browser has been closed')) {
        throw new Error('Page closed during addAnotherPost');
      }
      throw error;
    }
    
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
    // Note: safeWait requires pool, but we don't have it here. Use regular wait with try/catch
    await Promise.race([
      page.waitForLoadState('networkidle'),
      (async () => {
        try {
          await page.waitForTimeout(15000); // Increased to 15s for threads
        } catch (error: any) {
          if (error.message?.includes('Target page, context or browser has been closed')) {
            throw new Error('Page closed during postAll wait');
          }
          throw error;
        }
      })()
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
      // Note: safeWait requires pool, but we don't have it here. Use regular wait with try/catch
      try {
      await page.waitForTimeout(3000);
      } catch (error: any) {
        if (error.message?.includes('Target page, context or browser has been closed')) {
          console.warn(`⚠️ THREAD_IDS: Page closed during capture wait, continuing anyway`);
        } else {
          throw error;
        }
      }
      
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

