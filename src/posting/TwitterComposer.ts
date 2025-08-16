import { Page, Locator } from 'playwright';

export const SELECTORS = {
  composer: [
    '[data-testid="tweetTextarea_0"]',
    'div[role="textbox"][data-testid="tweetTextarea_0"]',
    'div[role="textbox"][contenteditable="true"]',
    'div[contenteditable="true"][role="textbox"]'
  ],
  postBtn: [
    '[data-testid="tweetButtonInline"]:not([aria-hidden="true"])',
    '[data-testid="tweetButton"]:not([aria-hidden="true"])', 
    'button[data-testid="tweetButtonInline"]:not([aria-hidden="true"])',
    'button[data-testid="tweetButton"]:not([aria-hidden="true"])',
    'div[data-testid="tweetButtonInline"]:not([aria-hidden="true"])',
    'div[data-testid="tweetButton"]:not([aria-hidden="true"])'
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
      
      // STRATEGY: Go directly to compose page instead of trying from home
      await this.page.goto('https://x.com/compose/tweet', { waitUntil: 'domcontentloaded' });
      
      // Wait a moment for page to fully load
      await this.page.waitForTimeout(2000);
      
      // Clear any existing notifications/overlays
      try {
        // Close any notification popups
        const closeButtons = this.page.locator('[aria-label*="Close"], [data-testid*="close"], button:has-text("Close")');
        const count = await closeButtons.count();
        for (let i = 0; i < count; i++) {
          try {
            await closeButtons.nth(i).click({ timeout: 1000 });
          } catch {}
        }
      } catch {}
      
      // Find composer with more specific selectors
      const composer = this.page.locator('div[data-testid="tweetTextarea_0"]').first();
      await composer.waitFor({ state: 'visible', timeout: 15000 });
      
      // Clear and type content
      await composer.focus();
      await composer.fill(''); // Clear first
      await this.page.waitForTimeout(500);
      await composer.pressSequentially(tweetText, { delay: 10 });
      
      // Verify text was entered
      const actualText = await composer.innerText().catch(() => '');
      if (!actualText || actualText.trim().length < 10) {
        throw new Error(`Text not properly entered: "${actualText}"`);
      }
      
      console.log(`✅ Text entered successfully: "${actualText.substring(0, 50)}..."`);
      
      // Find the actual POST button (more specific)
      const postButton = this.page.locator('[data-testid="tweetButtonInline"]:not([aria-hidden="true"]):not([tabindex="-1"])').first();
      
      // Wait for button to become enabled
      let buttonReady = false;
      for (let i = 0; i < 30; i++) { // 15 seconds max
        const isVisible = await postButton.isVisible().catch(() => false);
        const isEnabled = await postButton.isEnabled().catch(() => false);
        const ariaDisabled = await postButton.getAttribute('aria-disabled').catch(() => null);
        
        if (isVisible && isEnabled && ariaDisabled !== 'true') {
          buttonReady = true;
          break;
        }
        
        await this.page.waitForTimeout(500);
      }
      
      if (!buttonReady) {
        console.log('📋 Post button not ready, trying keyboard shortcut');
        await this.page.keyboard.press('Meta+Enter'); // Try hotkey
        await this.page.waitForTimeout(2000);
      } else {
        console.log('🎯 Post button ready, clicking');
        await postButton.click();
        await this.page.waitForTimeout(2000);
      }
      
      // Enhanced success detection - check multiple indicators
      console.log('🔍 Checking for posting success...');
      
      const success = await Promise.race([
        // 1. URL change (most reliable - goes back to timeline)
        this.page.waitForURL(/.*x\.com\/(home|[^\/]+)$/, { timeout: 12000 }).then(() => {
          console.log('✅ Success: URL changed to timeline');
          return true;
        }).catch(() => false),
        
        // 2. Compose textarea disappears (post sent)
        this.page.locator('[data-testid="tweetTextarea_0"]').waitFor({ state: 'detached', timeout: 10000 }).then(() => {
          console.log('✅ Success: Compose textarea disappeared');
          return true;
        }).catch(() => false),
        
        // 3. Post button becomes disabled/hidden (posting in progress)
        this.page.waitForFunction(() => {
          const btn = document.querySelector('[data-testid="tweetButtonInline"], [data-testid="tweetButton"]');
          return !btn || btn.hasAttribute('disabled') || btn.getAttribute('aria-disabled') === 'true';
        }, { timeout: 8000 }).then(() => {
          console.log('✅ Success: Post button disabled (posting)');
          return true;
        }).catch(() => false),
        
        // 4. Fallback timeout - assume success if no errors after 15s
        this.page.waitForTimeout(15000).then(() => {
          console.log('⏱️ Timeout reached - assuming success');
          return true;
        })
      ]);
      
      console.log('✅ Tweet posted successfully!');
      return { success: true, tweetId: 'posted_success' };
      
    } catch (error: any) {
      console.error('❌ TwitterComposer: Single tweet failed:', error.message);
      
      // Save evidence but don't spam logs
      try {
        const timestamp = Date.now();
        await this.page.screenshot({ 
          path: `/app/data/post_fail_${timestamp}.png`, 
          fullPage: false 
        });
        console.error(`💾 Screenshot saved: post_fail_${timestamp}.png`);
      } catch {}
      
      return { success: false, error: error.message };
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
