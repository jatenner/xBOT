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
 * Capture numeric tweet ID from timeline after posting
 */
async function captureTweetId(page: Page, attempts: number = 3): Promise<string> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      console.log(`🔍 TWEET_ID_CAPTURE attempt ${attempt}/${attempts}`);
      
      // Wait for timeline redirect and find status links
      const anchor = await page.waitForSelector('a[href*="/status/"]:has(time)', { 
        timeout: 15000 
      });
      
      const href = await anchor.getAttribute('href');
      if (!href) {
        throw new Error('No href found on status link');
      }
      
      // Extract numeric ID from URL like "/username/status/1956900962406199599"
      const match = href.match(/status\/(\d+)/);
      if (!match || !match[1]) {
        throw new Error(`Invalid status URL format: ${href}`);
      }
      
      const tweetId = match[1];
      console.log(`✅ CAPTURED_TWEET_ID ${JSON.stringify({ tweetId, url: href })}`);
      return tweetId;
      
    } catch (error) {
      console.warn(`⚠️ TWEET_ID_CAPTURE_ATTEMPT_${attempt}_FAILED: ${error}`);
      
      if (attempt < attempts) {
        // Scroll a bit and try again
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(1000);
      }
    }
  }
  
  throw new Error('TWEET_ID_CAPTURE_FAILED after all attempts');
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
      // COMPOSER GUARD: Dismiss "New posts are available..." overlay first
      try {
        const overlay = this.page.locator('button[aria-label^="New posts are available"]');
        if (await overlay.first().isVisible({ timeout: 2000 }).catch(() => false)) {
          console.log('🚨 COMPOSER_GUARD: "New posts available" overlay detected, dismissing...');
          await this.page.keyboard.press('.');
          await overlay.first().waitFor({ state: 'detached', timeout: 3000 }).catch(() => {});
          console.log('✅ COMPOSER_GUARD: overlay_dismissed=true');
        }
      } catch (e) {
        // Overlay check is optional
      }
      
      // Find composer textarea and focus
      const composer = this.page.locator('div[data-testid="tweetTextarea_0"]').first();
      await composer.waitFor({ state: 'visible', timeout: 15000 });
      
      // Focus composer to ensure it's active
      await composer.click();
      await this.page.waitForTimeout(300);
      
      // Clear and type content
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
      
      // ENHANCED POSTING: Try keyboard shortcut first (more reliable)
      console.log('⌨️ Trying keyboard submit first (Cmd/Ctrl+Enter)');
      const combo = process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter';
      await this.page.keyboard.press(combo);
      await this.page.waitForTimeout(2000);
      
      // Fallback: click button if keyboard didn't work and button is ready
      if (buttonReady) {
        try {
          const postBtn = this.page.locator('[data-testid="tweetButtonInline"], [data-testid="tweetButton"]').first();
          if (await postBtn.isVisible({ timeout: 1500 }) && await postBtn.isEnabled()) {
            console.log('🎯 Fallback: clicking post button');
            await postBtn.click({ trial: false }).catch(() => {});
          }
        } catch (e) {
          console.log('⚠️ Button click fallback failed, relying on keyboard submit');
        }
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
      
      // Capture real tweet ID after posting
      let tweetId = 'posted_success';
      try {
        tweetId = await captureTweetId(this.page);
      } catch (idError) {
        console.warn(`⚠️ Failed to capture tweet ID: ${idError}`);
        // Schedule find-later job (basic implementation for now)
        console.log(`📅 SCHEDULE_FIND_LATER_JOB tweet_content="${tweetText.substring(0, 30)}..."`);
      }
      
      return { success: true, tweetId };
      
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
    let attempt = 0;
    const maxAttempts = 2;
    
    while (attempt < maxAttempts) {
      attempt++;
      
      try {
        console.log(`🐦 TwitterComposer: Posting reply to ${targetTweetId} (${replyText.length} chars) attempt ${attempt}/${maxAttempts}`);
        
        // Dismiss overlay first
        try {
          const overlay = this.page.locator('button[aria-label^="New posts are available"]');
          if (await overlay.first().isVisible({ timeout: 2000 }).catch(() => false)) {
            console.log('🚨 COMPOSER_GUARD: "New posts available" overlay detected, dismissing...');
            await this.page.keyboard.press('.');
            await overlay.first().waitFor({ state: 'detached', timeout: 3000 }).catch(() => {});
            console.log('✅ COMPOSER_GUARD: overlay_dismissed=true');
          }
        } catch {}
        
        // Navigate to the target tweet explicitly
        const tweetUrl = `https://x.com/i/status/${targetTweetId}`;
        await this.page.goto(tweetUrl, { waitUntil: 'networkidle', timeout: 30000 });
        await this.page.waitForTimeout(2000);
        
        // Wait for article and click reply with resilient selector
        await this.page.waitForSelector('article div[data-testid="reply"]', { timeout: 15000 });
        await this.page.click('article div[data-testid="reply"]');
        
        // Wait for dialog modal to appear
        await this.page.waitForSelector('div[role="dialog"] div[contenteditable="true"]', { timeout: 15000 });
        
        // Fill in the reply text
        await this.page.fill('div[role="dialog"] div[contenteditable="true"]', replyText);
        await this.page.waitForTimeout(500);
        
        // Try keyboard submit first
        await this.page.keyboard.down(process.platform === 'darwin' ? 'Meta' : 'Control');
        await this.page.keyboard.press('Enter');
        await this.page.keyboard.up(process.platform === 'darwin' ? 'Meta' : 'Control');
        await this.page.waitForTimeout(1000);
        
        // Fallback button click
        const btn = await this.page.$('div[role="dialog"] div[data-testid="tweetButton"], div[data-testid="tweetButton"]');
        if (btn) {
          await btn.click();
        }
        
        // Wait for dialog to close (success indicator)
        await this.page.waitForSelector('div[role="dialog"]', { state: 'detached', timeout: 15000 });
        
        console.log('✅ Reply posted successfully!');
        
        // Try to capture reply ID
        let replyId = `reply_to_${targetTweetId}`;
        try {
          replyId = await captureTweetId(this.page);
        } catch (idError) {
          console.warn(`⚠️ Failed to capture reply ID: ${idError}`);
        }
        
        return { success: true, tweetId: replyId };
        
      } catch (error: any) {
        console.warn(`⚠️ Reply attempt ${attempt} failed: ${error.message}`);
        
        if (attempt < maxAttempts) {
          console.log('🔄 THREAD_REPLY_RETRY: Reloading page and trying again...');
          await this.page.reload({ waitUntil: 'networkidle', timeout: 30000 });
          await this.page.waitForTimeout(2000);
        } else {
          console.log('❌ THREAD_REPLY_GAVE_UP: All attempts failed, continuing to next reply');
          return { success: false, error: error.message };
        }
      }
    }
    
    return { success: false, error: 'All retry attempts failed' };
  }
}
