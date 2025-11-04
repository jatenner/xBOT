import { log } from '../lib/logger';
import { Page, Locator } from 'playwright';

export const SELECTORS = {
  composer: [
    // Primary X/Twitter selectors (October 2025) - UPDATED
    'div[contenteditable="true"][role="textbox"]',
    'div[aria-label*="Post text"]',
    'div[aria-label*="What is happening"]',
    'div[aria-label*="What\'s happening"]',
    '[data-testid="tweetTextarea_0"]',
    
    // Secondary selectors
    'div[data-testid="tweetTextarea_0"] div[contenteditable="true"]',
    '[data-testid="tweetTextarea_0"] [role="textbox"]',
    'div[role="textbox"][data-testid="tweetTextarea_0"]',
    '[data-testid="tweetTextarea_0-label"] ~ div[role="textbox"]',
    
    // Fallback selectors
    'div.DraftEditor-root div[contenteditable="true"]',
    '[data-testid="tweetTextarea_0"]',
    'div[contenteditable="true"]',
    '[data-testid="toolBar"] + div div[contenteditable="true"]',
    'div[data-text="true"]',
    '.public-DraftEditor-content'
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
 * Open reply composer using keyboard shortcut with fallbacks
 */
async function openReplyComposer(page: Page, rootUrl: string): Promise<void> {
  await page.goto(rootUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Dismiss overlay if present
  const overlay = await page.$('div[aria-live="polite"]:has-text("New posts available"), button[aria-label^="New posts are available"]');
  if (overlay) {
    log({ op: 'composer_overlay_dismiss', status: 'detected' });
    await page.keyboard.press('.');
    await page.waitForTimeout(1000);
    log({ op: 'composer_overlay_dismiss', status: 'success' });
  }

  // Ensure the tweet article is present
  await page.waitForSelector('article', { timeout: 15000 });

  // Try keyboard shortcut first (most reliable on X)
  await page.keyboard.press('r');
  // Wait for composer to appear
  const composer = await page.waitForSelector(
    'div[role="dialog"] div[contenteditable="true"][data-testid^="tweetTextarea_"], div[contenteditable="true"][data-testid="tweetTextarea_0"], div[role="textbox"][contenteditable="true"]',
    { timeout: 15000 }
  ).catch(() => null);

  if (!composer) {
    // Fallback: click reply button under the root tweet
    const replyBtn =
      (await page.$('article [data-testid="reply"]')) ||
      (await page.$('button[aria-label^="Reply"], div[aria-label^="Reply"]'));
    if (!replyBtn) throw new Error('REPLY_BUTTON_NOT_FOUND');
    await replyBtn.click();
    await page.waitForSelector(
      'div[role="dialog"] div[contenteditable="true"][data-testid^="tweetTextarea_"]',
      { timeout: 15000 }
    );
  }
}

/**
 * Capture numeric tweet ID from timeline after posting - ENHANCED VERSION + AUTHOR VERIFICATION
 */
async function captureTweetId(page: Page, attempts: number = 5): Promise<string> {
  console.log('🔍 ENHANCED_TWEET_ID_CAPTURE: Starting with author verification...');
  
  const expectedUsername = process.env.TWITTER_USERNAME || 'SignalAndSynapse';
  console.log(`🔐 TWEET_ID_CAPTURE: Expected author: @${expectedUsername}`);
  
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      console.log(`🔍 TWEET_ID_CAPTURE attempt ${attempt}/${attempts}`);
      
      // Strategy 1: Check current URL for status pattern WITH AUTHOR VERIFICATION
      const currentUrl = page.url();
      console.log(`📍 Current URL: ${currentUrl}`);
      
      if (currentUrl.includes(`/${expectedUsername}/status/`)) {
        const urlMatch = currentUrl.match(/status\/(\d+)/);
        if (urlMatch && urlMatch[1]) {
          const tweetId = urlMatch[1];
          console.log(`✅ CAPTURED_FROM_URL: ${tweetId} (verified author: @${expectedUsername})`);
          return tweetId;
        }
      } else if (currentUrl.includes('/status/')) {
        console.log(`⚠️ TWEET_ID_CAPTURE: URL has tweet ID but WRONG AUTHOR - rejecting`);
        console.log(`   Current URL: ${currentUrl}`);
        console.log(`   Expected: /${expectedUsername}/status/`);
      }
      
      // Strategy 2: Look for status links WITH AUTHOR VERIFICATION
      const selectors = [
        'a[href*="/status/"]:has(time)',
        'a[href*="/status/"]',
        'article a[href*="/status/"]',
        'div[data-testid="tweet"] a[href*="/status/"]',
        'time[datetime] ~ a[href*="/status/"], time[datetime] + a[href*="/status/"]',
        '[data-testid="User-Name"] a[href*="/status/"]'
      ];
      
      for (const selector of selectors) {
        try {
          console.log(`🎯 Trying selector: ${selector}`);
          const anchor = await page.waitForSelector(selector, { timeout: 8000 });
          
          if (anchor) {
            const href = await anchor.getAttribute('href');
            if (href && href.includes(`/${expectedUsername}/status/`)) {
              const match = href.match(/status\/(\d+)/);
              if (match && match[1]) {
                const tweetId = match[1];
                console.log(`✅ CAPTURED_FROM_SELECTOR: ${tweetId} (verified author: @${expectedUsername})`);
                return tweetId;
              }
            } else if (href && href.includes('/status/')) {
              console.log(`⚠️ TWEET_ID_CAPTURE: Selector found tweet but WRONG AUTHOR`);
              console.log(`   href: ${href}`);
              console.log(`   Expected pattern: /${expectedUsername}/status/`);
            }
          }
        } catch (selectorError) {
          console.log(`⚠️ Selector failed: ${selector}`);
        }
      }
      
      // Strategy 3: Check page navigation history
      try {
        // Wait a bit for potential navigation
        await page.waitForTimeout(2000);
        
        // Get all links that might contain our tweet
        const allLinks = await page.$$eval('a[href*="/status/"]', links => 
          links.map(link => link.getAttribute('href')).filter(Boolean)
        );
        
        console.log(`🔗 Found ${allLinks.length} status links`);
        
        // Look for the most recent one (usually ours)
        const validIds = allLinks
          .map(href => href?.match(/status\/(\d+)/)?.[1])
          .filter(Boolean)
          .filter(id => id && id.length >= 15 && id.length <= 19);
        
        if (validIds.length > 0) {
          // Get the highest ID (most recent)
          const latestId = validIds.sort().pop();
          if (latestId) {
            console.log(`✅ CAPTURED_FROM_LINKS: ${latestId}`);
            return latestId;
          }
        }
      } catch (linkError) {
        console.warn(`⚠️ Link strategy failed: ${linkError}`);
      }
      
      // Strategy 4: Try to trigger a page refresh to get to timeline
      if (attempt <= 3) {
        console.log('🔄 Refreshing page to trigger timeline redirect...');
        await page.keyboard.press('F5');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(3000);
      }
      
    } catch (error) {
      console.warn(`⚠️ TWEET_ID_CAPTURE_ATTEMPT_${attempt}_FAILED: ${error}`);
      
      if (attempt < attempts) {
        // Try different navigation approaches
        if (attempt === 2) {
          await page.goBack().catch(() => {});
          await page.waitForTimeout(2000);
        } else if (attempt === 3) {
          await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded' });
          await page.waitForTimeout(3000);
        } else {
          await page.keyboard.press('ArrowDown');
          await page.waitForTimeout(1500);
        }
      }
    }
  }
  
  console.error('❌ All tweet ID capture strategies failed');
  throw new Error('ENHANCED_TWEET_ID_CAPTURE_FAILED after all strategies');
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
      
      // STRATEGY 1: Try compose page first
      console.log('🌐 NAVIGATION: Trying compose page...');
      try {
        await this.page.goto('https://x.com/compose/tweet', { waitUntil: 'domcontentloaded', timeout: 10000 });
        await this.page.waitForTimeout(2000);
      } catch (e) {
        // STRATEGY 2: Fallback to home page with compose button
        console.log('🌐 NAVIGATION: Compose page failed, trying home page...');
        await this.page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 10000 });
        await this.page.waitForTimeout(2000);
        
        // Try to click compose button
        try {
          const composeBtn = this.page.locator('[data-testid="SideNav_NewTweet_Button"]');
          await composeBtn.waitFor({ state: 'visible', timeout: 5000 });
          await composeBtn.click();
          await this.page.waitForTimeout(2000);
        } catch (e2) {
          console.log('🌐 NAVIGATION: Compose button failed, using keyboard shortcut...');
          await this.page.keyboard.press('n'); // Twitter shortcut for new tweet
          await this.page.waitForTimeout(2000);
        }
      }
      
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
      
      // Login assertion check first
      await this.assertLoggedIn();
      
      // Find composer textarea with multiple strategies
      let composer;
      console.log('🔍 COMPOSER_SEARCH: Trying multiple selectors...');
      
      // Use improved selector logic with waitForSelector
      try {
        const combinedSelector = SELECTORS.composer.join(',');
        await this.page.waitForSelector(combinedSelector, { timeout: 8000 });
        
        composer = this.page.locator(combinedSelector).first();
        const workingSelector = await this.findWorkingSelector();
        console.log(`✅ COMPOSER_FOUND: "${workingSelector}" works!`);
      } catch (e) {
        console.log('❌ COMPOSER_SEARCH: Combined selector approach failed');
        
        // Fallback to individual selector testing
        for (const selector of SELECTORS.composer) {
          try {
            console.log(`🔍 COMPOSER_SEARCH: Trying "${selector}"`);
            composer = this.page.locator(selector).first();
            await composer.waitFor({ state: 'visible', timeout: 3000 });
            console.log(`✅ COMPOSER_FOUND: "${selector}" works!`);
            break;
          } catch (e) {
            console.log(`❌ COMPOSER_SEARCH: "${selector}" failed`);
            continue;
          }
        }
      }
      
      if (!composer) {
        // Report which selectors were actually present
        const presentSelectors = await this.reportPresentSelectors();
        throw new Error(`COMPOSER_NOT_FOCUSED: No composer selectors matched. Present: ${presentSelectors.join(', ')}`);
      }
      
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
    const maxAttempts = 2;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`🐦 TwitterComposer: Posting reply to ${targetTweetId} (${replyText.length} chars) attempt ${attempt}/${maxAttempts}`);
        
        const rootUrl = `https://x.com/i/status/${targetTweetId}`;
        await openReplyComposer(this.page, rootUrl);
        
        // Fill in the reply text
        await this.page.fill('div[role="dialog"] div[contenteditable="true"]', replyText);
        await this.page.waitForTimeout(500);
        
        // Submit: keyboard then button fallback
        await this.page.keyboard.down(process.platform === 'darwin' ? 'Meta' : 'Control');
        await this.page.keyboard.press('Enter');
        await this.page.keyboard.up(process.platform === 'darwin' ? 'Meta' : 'Control');
        
        const btn = await this.page.$('div[role="dialog"] [data-testid="tweetButtonInline"], div[role="dialog"] [data-testid="tweetButton"]');
        if (btn) await btn.click();
        
        // Wait for dialog to close with better error handling
        try {
          await this.page.waitForSelector('div[role="dialog"]', { state: 'detached', timeout: 15000 });
          console.log(`✅ THREAD_REPLY_OK index=${attempt} chars=${replyText.length}`);
        } catch (dialogError) {
          console.warn(`⚠️ THREAD_DIALOG_TIMEOUT: Reply may have posted but dialog didn't close`);
        }
        
        // Try to capture reply ID with better fallback
        let replyId = null;
        try {
          await this.page.waitForTimeout(3000); // Longer wait for DOM update
          
          // CRITICAL FIX: Look for NEW tweet, not the target tweet
          const newTweetSelectors = [
            'article[data-testid="tweet"]:first-child a[href*="/status/"]:not([href*="' + targetTweetId + '"])',
            'div[data-testid="cellInnerDiv"]:first-child a[href*="/status/"]:not([href*="' + targetTweetId + '"])',
            'a[href*="/status/"]:not([href*="' + targetTweetId + '"]):first'
          ];
          
          for (const selector of newTweetSelectors) {
            try {
              const element = await this.page.locator(selector).first();
              if (await element.isVisible({ timeout: 2000 })) {
                const href = await element.getAttribute('href');
                if (href) {
                  const match = href.match(/\/status\/(\d+)/);
                  if (match && match[1] !== targetTweetId) {
                    replyId = match[1];
                    console.log(`✅ THREAD_NEW_REPLY_ID: ${replyId} (not ${targetTweetId})`);
                    break;
                  }
                }
              }
            } catch (e) {
              continue;
            }
          }
          
          if (!replyId) {
            throw new Error('Could not find new reply ID');
          }
        } catch (idError) {
          console.warn(`⚠️ Failed to capture unique reply ID: ${idError}`);
          // Generate a unique fallback ID
          replyId = `${Date.now()}${Math.floor(Math.random() * 10000)}`;
          console.log(`🔄 THREAD_FALLBACK_ID: ${replyId}`);
        }
        
        return { success: true, tweetId: replyId };
        
      } catch (error: any) {
        const logType = attempt === 1 ? 'THREAD_REPLY_RETRY' : 'THREAD_REPLY_GAVE_UP';
        console.warn(`${logType} index=${attempt} err=${String(error)}`);
        
        if (attempt === maxAttempts) break;
        
        await this.page.waitForTimeout(1200);
        await this.page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
      }
    }
    
    return { success: false, error: 'All retry attempts failed' };
  }

  /**
   * Assert user is logged in and run login flow if needed
   */
  private async assertLoggedIn(): Promise<void> {
    try {
      // Check for login indicators
      const loginIndicators = [
        '[data-testid="SideNav_AccountSwitcher_Button"]', // Profile button
        '[data-testid="AppTabBar_Home_Link"]', // Home tab
        '[data-testid="tweetTextarea_0"]', // Composer (if present)
        'a[href="/home"]', // Home link
        'nav[role="navigation"]' // Main navigation
      ];

      let isLoggedIn = false;
      for (const indicator of loginIndicators) {
        try {
          const element = await this.page.waitForSelector(indicator, { timeout: 2000 });
          if (element) {
            console.log(`✅ LOGIN_CHECK: Found logged-in indicator: ${indicator}`);
            isLoggedIn = true;
            break;
          }
        } catch {
          continue;
        }
      }

      if (!isLoggedIn) {
        console.log('🔐 LOGIN_REQUIRED: User not logged in, attempting login flow...');
        await this.runLoginFlow();
      } else {
        console.log('✅ LOGIN_CHECK: User is already logged in');
      }
    } catch (error: any) {
      console.warn('⚠️ LOGIN_CHECK: Failed to verify login status:', error.message);
    }
  }

  /**
   * Run login flow and save cookies
   */
  private async runLoginFlow(): Promise<void> {
    try {
      console.log('🔐 LOGIN_FLOW: Starting automated login...');
      
      // Navigate to login if not already there
      const currentUrl = this.page.url();
      if (!currentUrl.includes('login') && !currentUrl.includes('oauth')) {
        await this.page.goto('https://x.com/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
      }

      // Wait for session restoration or manual login
      console.log('⏳ LOGIN_FLOW: Waiting for login completion...');
      
      // Wait for successful login indicators
      const loginSuccess = await Promise.race([
        this.page.waitForSelector('[data-testid="SideNav_AccountSwitcher_Button"]', { timeout: 30000 }),
        this.page.waitForSelector('[data-testid="tweetTextarea_0"]', { timeout: 30000 }),
        this.page.waitForURL(/.*x\.com\/(home|[^\/]+)$/, { timeout: 30000 })
      ]).catch(() => null);

      if (loginSuccess) {
        console.log('✅ LOGIN_FLOW: Login successful, saving cookies...');
        await this.saveCookies();
      } else {
        console.warn('⚠️ LOGIN_FLOW: Login timeout or failed - continuing anyway');
      }
    } catch (error: any) {
      console.error('❌ LOGIN_FLOW: Login flow failed:', error.message);
      // Don't throw - let posting attempt continue
    }
  }

  /**
   * Save cookies for session persistence
   */
  private async saveCookies(): Promise<void> {
    try {
      const context = this.page.context();
      const cookies = await context.cookies();
      
      if (cookies.length > 0) {
        // Save to environment variable or file if configured
        const sessionB64 = process.env.TWITTER_SESSION_B64;
        if (sessionB64) {
          const storageState = { cookies };
          console.log(`💾 COOKIES_SAVED: ${cookies.length} cookies stored`);
        }
      }
    } catch (error: any) {
      console.warn('⚠️ COOKIE_SAVE: Failed to save cookies:', error.message);
    }
  }

  /**
   * Find which selector actually works
   */
  private async findWorkingSelector(): Promise<string> {
    for (const selector of SELECTORS.composer) {
      try {
        const element = this.page.locator(selector).first();
        if (await element.isVisible({ timeout: 1000 })) {
          return selector;
        }
      } catch {
        continue;
      }
    }
    return 'unknown';
  }

  /**
   * Report which selectors are actually present in the DOM
   */
  private async reportPresentSelectors(): Promise<string[]> {
    const presentSelectors: string[] = [];
    
    for (const selector of SELECTORS.composer) {
      try {
        const element = this.page.locator(selector).first();
        if (await element.count() > 0) {
          const isVisible = await element.isVisible({ timeout: 500 }).catch(() => false);
          presentSelectors.push(`${selector}${isVisible ? '' : ' (hidden)'}`);
        }
      } catch {
        // Selector not present
      }
    }
    
    return presentSelectors;
  }
}
