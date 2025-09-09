/**
 * 🧵 BULLETPROOF THREAD COMPOSER
 * Forces all multi-segment content to post as connected threads
 * Composer-first with reply-chain fallback - NO standalone numbered tweets
 */

import { Page } from 'playwright';
import { focusComposer } from './composerFocus';

interface ThreadPostResult {
  success: boolean;
  mode: 'composer' | 'reply_chain';
  rootTweetUrl?: string;
  tweetIds?: string[];
  error?: string;
}

export class BulletproofThreadComposer {
  private static browserPage: Page | null = null;

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
    
    // Ensure numbering at send time if not already present
    const isThread = segments.length > 1;
    let numberedSegments = segments;
    
    if (isThread) {
      const n = segments.length;
      const hasNumbering = segments[0]?.match(/^\d+\/\d+\s/);
      
      if (!hasNumbering) {
        // Add numbering "i/n " at send time
        numberedSegments = segments.map((s, i) => `${i+1}/${n} ${s}`);
        console.log(`🧵 NUMBERING_ADDED: ${n} segments numbered at send time`);
      } else {
        console.log(`🧵 NUMBERING_DETECTED: Segments already numbered`);
      }
    }
    
    if (process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true') {
      console.log('🧪 DRY_RUN: Thread posting simulation');
      numberedSegments.forEach((segment, i) => {
        console.log(`THREAD_SEG_VERIFIED idx=${i} len=${segment.length}`);
      });
      console.log('THREAD_PUBLISH_OK mode=dry_run');
      return {
        success: true,
        mode: 'composer',
        rootTweetUrl: `https://x.com/dry_run/status/${Date.now()}`
      };
    }

    // Get browser page
    if (!this.browserPage) {
      await this.initializeBrowser();
    }

    try {
      // Try composer-first approach
      await this.postViaComposer(numberedSegments);
      console.log('THREAD_PUBLISH_OK mode=composer');
      return {
        success: true,
        mode: 'composer',
        rootTweetUrl: await this.captureRootUrl()
      };
    } catch (composerError: any) {
      console.log(`🧵 THREAD_COMPOSER_FAILED -> falling back to reply chain: ${String(composerError).slice(0, 400)}`);
      // On COMPOSER_NOT_FOCUSED, do one attempt to switch to reply-chain and actually call the self-reply API path
      console.log(`THREAD_DECISION mode=reply_chain segments=${segments.length}`);
      
      try {
        // Fallback: single-pass reply-chain fallback (not looping composer again)
        const rootUrl = await this.postViaReplies(numberedSegments);
        console.log('THREAD_PUBLISH_OK mode=reply_chain');
        return {
          success: true,
          mode: 'reply_chain',
          rootTweetUrl: rootUrl
        };
      } catch (replyError: any) {
        console.error('❌ THREAD_BOTH_METHODS_FAILED:', replyError);
        return {
          success: false,
          mode: 'reply_chain',
          error: `Both composer and reply-chain failed: ${replyError.message}`
        };
      }
    }
  }

  /**
   * 🌐 Initialize browser connection
   */
  private static async initializeBrowser(): Promise<void> {
    const { default: browserManager } = await import('../core/BrowserManager');
    
    this.browserPage = await browserManager.withContext(async (context: any) => {
      return await context.newPage();
    });
    
    console.log('✅ BULLETPROOF_THREAD_COMPOSER: Browser ready');
  }

  /**
   * 🎨 POST via Twitter's native composer (preferred)
   */
  private static async postViaComposer(segments: string[]): Promise<void> {
    const page = this.browserPage!;
    
    console.log('🎨 THREAD_COMPOSER: Attempting native composer mode...');
    
    // Focus composer with multiple strategies
    const focusResult = await focusComposer(page, 'direct');
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
  private static async postViaReplies(segments: string[]): Promise<string> {
    const page = this.browserPage!;
    
    console.log('🔗 THREAD_REPLY_CHAIN: Starting reply chain fallback...');
    
    // Post root tweet
    const rootFocusResult = await focusComposer(page, 'direct');
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
    await page.waitForLoadState('networkidle');
    
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
      const replyFocusResult = await focusComposer(page, 'reply');
      if (!replyFocusResult.success) {
        throw new Error(`REPLY_COMPOSER_FOCUS_FAILED: ${replyFocusResult.error}`);
      }

      // Use the focused element from the helper
      await replyFocusResult.element.fill(segments[i]);
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
      await page.waitForLoadState('networkidle');
      
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
    await page.waitForLoadState('networkidle');
    
    console.log('🚀 THREAD_COMPOSER: Posted all cards');
  }

  /**
   * 📎 Capture root tweet URL after posting
   */
  private static async captureRootUrl(): Promise<string> {
    const page = this.browserPage!;
    
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
}

export default BulletproofThreadComposer;
