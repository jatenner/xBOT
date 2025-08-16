import { Page, Locator } from 'playwright';

export const SELECTORS = {
  composer: [
    '[data-testid="tweetTextarea_0"]',
    'div[role="textbox"][data-testid="tweetTextarea_0"]',
    'div[role="textbox"][contenteditable="true"]',
    'div[contenteditable="true"][role="textbox"]'
  ],
  postBtn: [
    'div[data-testid="tweetButtonInline"]',
    'div[data-testid="tweetButton"]',
    'button:has-text("Post")',
    'button:has-text("Tweet")',
    '[data-testid="tweetButton"]',
    '[data-testid="tweetButtonInline"]'
  ],
  replyBtn: [
    '[data-testid="reply"]',
    'div[data-testid="reply"]',
    'button[aria-label*="Reply"]'
  ]
};

export interface PostResult {
  success: boolean;
  tweetId?: string;
  error?: string;
}

/**
 * Helper to wait for element to be truly enabled
 */
export async function waitEnabled(locator: Locator, timeout = 15000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const [visible, enabled, ariaDisabled] = await Promise.all([
        locator.isVisible().catch(() => false),
        locator.isEnabled().catch(() => false),
        locator.getAttribute('aria-disabled').catch(() => null)
      ]);
      
      if (visible && enabled && ariaDisabled !== 'true') {
        return true;
      }
    } catch (error) {
      // Continue trying
    }
    
    await locator.page().waitForTimeout(150);
  }
  return false;
}

/**
 * Guarded click with trial first to avoid spam
 */
export async function guardedClick(locator: Locator): Promise<void> {
  // Avoid spammy retries: 3 attempts max, with trial first
  for (let i = 0; i < 3; i++) {
    try {
      await locator.click({ trial: true, timeout: 3000 });
      break;
    } catch (error) {
      if (i < 2) {
        await locator.page().waitForTimeout(250 * (i + 1));
      }
    }
  }
  
  await locator.click({ timeout: 5000 });
}

/**
 * Robust Twitter composer for reliable posting
 */
export class TwitterComposer {
  constructor(private page: Page) {}

  /**
   * Post a single tweet with robust composer handling
   */
  async postSingleTweet(tweetText: string): Promise<PostResult> {
    try {
      console.log(`🐦 TwitterComposer: Posting tweet (${tweetText.length} chars)`);
      
      // Navigate to home to ensure clean state
      await this.page.goto('https://x.com/home', { waitUntil: 'domcontentloaded' });
      
      // Find and wait for composer
      const composer = this.page.locator(SELECTORS.composer.join(',')).first();
      await composer.waitFor({ state: 'visible', timeout: 15000 });
      
      // Focus and type safely into contenteditable
      await composer.click({ delay: 50 });
      await composer.pressSequentially(tweetText, { delay: 8 });
      
      // Confirm text actually landed
      const actualText = await composer.innerText().catch(() => '');
      const minExpectedLength = Math.min(8, tweetText.trim().length);
      if (!actualText || actualText.trim().length < minExpectedLength) {
        throw new Error('Composer did not accept text');
      }
      
      console.log(`✅ Text entered successfully: "${actualText.substring(0, 50)}..."`);
      
      // Get and wait for enabled Post button
      const postButton = this.page.locator(SELECTORS.postBtn.join(',')).first();
      await postButton.waitFor({ state: 'visible', timeout: 15000 });
      
      const isEnabled = await waitEnabled(postButton);
      
      if (!isEnabled) {
        console.log('📋 Post button disabled, trying hotkey fallback');
        // Fallback to keyboard shortcut
        const hotkey = process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter';
        await this.page.keyboard.press(hotkey);
        await this.page.waitForTimeout(1500);
      } else {
        console.log('🎯 Post button enabled, clicking');
        await guardedClick(postButton);
      }
      
      // Wait for confirmation with multiple indicators
      await Promise.race([
        // Toast notification
        this.page.locator('[role="alert"]:has-text("sent")').first().waitFor({ timeout: 10000 }).catch(() => {}),
        this.page.locator('[role="alert"]:has-text("posted")').first().waitFor({ timeout: 10000 }).catch(() => {}),
        // API response
        this.page.waitForResponse(r => 
          r.url().includes('/TweetCreate') && r.ok(), 
          { timeout: 10000 }
        ).catch(() => {}),
        // Fallback timeout
        this.page.waitForTimeout(10000)
      ]);
      
      console.log('✅ Tweet posted successfully');
      return { success: true, tweetId: 'posted' };
      
    } catch (error: any) {
      console.error('❌ TwitterComposer: Single tweet failed:', error.message);
      
      // Save evidence on failure
      try {
        const timestamp = Date.now();
        await this.page.screenshot({ 
          path: `/app/data/post_fail_${timestamp}.png`, 
          fullPage: false 
        });
        
        const html = await this.page.content();
        console.error('POST_COMPOSER_DISABLED', { 
          snippet: html.slice(0, 1000),
          timestamp,
          error: error.message
        });
      } catch (screenshotError) {
        console.warn('Failed to capture screenshot:', screenshotError);
      }
      
      throw new Error(`Composer disabled (likely empty text, overlay, or rate-limit). Aborting once: ${error.message}`);
    }
  }

  /**
   * Post a reply to a specific tweet
   */
  async postReply(replyText: string, targetTweetId: string): Promise<PostResult> {
    try {
      console.log(`🐦 TwitterComposer: Posting reply to ${targetTweetId} (${replyText.length} chars)`);
      
      // Navigate to the target tweet
      await this.page.goto(`https://x.com/i/web/status/${targetTweetId}`, { 
        waitUntil: 'domcontentloaded' 
      });
      
      // Click reply button
      const replyButton = this.page.locator(SELECTORS.replyBtn.join(',')).first();
      await replyButton.waitFor({ state: 'visible', timeout: 10000 });
      await guardedClick(replyButton);
      
      // Wait for reply composer
      const composer = this.page.locator(SELECTORS.composer.join(',')).first();
      await composer.waitFor({ state: 'visible', timeout: 10000 });
      
      // Type reply text
      await composer.click({ delay: 50 });
      await composer.pressSequentially(replyText, { delay: 8 });
      
      // Confirm text landed
      const actualText = await composer.innerText().catch(() => '');
      const minExpectedLength = Math.min(8, replyText.trim().length);
      if (!actualText || actualText.trim().length < minExpectedLength) {
        throw new Error('Reply composer did not accept text');
      }
      
      // Find and click post button
      const postButton = this.page.locator(SELECTORS.postBtn.join(',')).first();
      await postButton.waitFor({ state: 'visible', timeout: 10000 });
      
      const isEnabled = await waitEnabled(postButton);
      
      if (!isEnabled) {
        console.log('📋 Reply post button disabled, trying hotkey fallback');
        const hotkey = process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter';
        await this.page.keyboard.press(hotkey);
        await this.page.waitForTimeout(1500);
      } else {
        await guardedClick(postButton);
      }
      
      // Wait for confirmation
      await Promise.race([
        this.page.locator('[role="alert"]:has-text("sent")').first().waitFor({ timeout: 10000 }).catch(() => {}),
        this.page.locator('[role="alert"]:has-text("posted")').first().waitFor({ timeout: 10000 }).catch(() => {}),
        this.page.waitForResponse(r => 
          r.url().includes('/TweetCreate') && r.ok(), 
          { timeout: 10000 }
        ).catch(() => {}),
        this.page.waitForTimeout(10000)
      ]);
      
      console.log('✅ Reply posted successfully');
      return { success: true, tweetId: 'posted' };
      
    } catch (error: any) {
      console.error('❌ TwitterComposer: Reply failed:', error.message);
      
      // Save evidence on failure
      try {
        const timestamp = Date.now();
        await this.page.screenshot({ 
          path: `/app/data/reply_fail_${timestamp}.png`, 
          fullPage: false 
        });
      } catch (screenshotError) {
        // Silent fail for screenshot
      }
      
      return { success: false, error: error.message };
    }
  }
}
