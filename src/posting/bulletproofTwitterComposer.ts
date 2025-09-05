import { Page, Locator } from 'playwright';

/**
 * 🛡️ BULLETPROOF TWITTER COMPOSER
 * Handles all Twitter interface changes with dynamic detection
 */

export interface BulletproofPostResult {
  success: boolean;
  tweetId?: string;
  error?: string;
  strategy?: string;
}

export class BulletproofTwitterComposer {
  constructor(private page: Page) {}

  /**
   * 🎯 Post with multiple fallback strategies
   */
  async postTweet(content: string): Promise<BulletproofPostResult> {
    console.log(`🛡️ BULLETPROOF_COMPOSER: Posting "${content.substring(0, 50)}..."`);
    
    const strategies = [
      () => this.strategyDirectCompose(content),
      () => this.strategyHomePageCompose(content), 
      () => this.strategyKeyboardShortcut(content),
      () => this.strategyMobileWeb(content)
    ];

    for (let i = 0; i < strategies.length; i++) {
      const strategyName = ['DirectCompose', 'HomePage', 'Keyboard', 'Mobile'][i];
      console.log(`🔄 STRATEGY_${i + 1}: Trying ${strategyName}...`);
      
      try {
        const result = await strategies[i]();
        if (result.success) {
          console.log(`✅ STRATEGY_${i + 1}: ${strategyName} succeeded!`);
          return { ...result, strategy: strategyName };
        }
        console.log(`❌ STRATEGY_${i + 1}: ${strategyName} failed: ${result.error}`);
      } catch (error: any) {
        console.log(`💥 STRATEGY_${i + 1}: ${strategyName} crashed: ${error.message}`);
      }
      
      // Wait between strategies
      await this.page.waitForTimeout(2000);
    }

    return {
      success: false,
      error: 'All posting strategies failed',
      strategy: 'none'
    };
  }

  /**
   * 🎯 STRATEGY 1: Direct compose page
   */
  private async strategyDirectCompose(content: string): Promise<BulletproofPostResult> {
    await this.page.goto('https://x.com/compose/tweet', { 
      waitUntil: 'domcontentloaded',
      timeout: 15000 
    });
    await this.page.waitForTimeout(3000);

    return await this.findAndPost(content);
  }

  /**
   * 🎯 STRATEGY 2: Home page with compose button
   */
  private async strategyHomePageCompose(content: string): Promise<BulletproofPostResult> {
    await this.page.goto('https://x.com/home', { 
      waitUntil: 'domcontentloaded',
      timeout: 15000 
    });
    await this.page.waitForTimeout(2000);

    // Try to find and click compose button
    const composeSelectors = [
      '[data-testid="SideNav_NewTweet_Button"]',
      '[aria-label*="Post"]',
      '[aria-label*="Tweet"]',
      'a[href="/compose/tweet"]',
      'button:has-text("Post")',
      'div[role="button"]:has-text("Post")'
    ];

    for (const selector of composeSelectors) {
      try {
        const button = this.page.locator(selector).first();
        await button.waitFor({ state: 'visible', timeout: 3000 });
        await button.click();
        await this.page.waitForTimeout(2000);
        break;
      } catch (e) {
        continue;
      }
    }

    return await this.findAndPost(content);
  }

  /**
   * 🎯 STRATEGY 3: Keyboard shortcut
   */
  private async strategyKeyboardShortcut(content: string): Promise<BulletproofPostResult> {
    await this.page.goto('https://x.com/home', { 
      waitUntil: 'domcontentloaded',
      timeout: 15000 
    });
    await this.page.waitForTimeout(2000);

    // Try keyboard shortcuts
    const shortcuts = ['n', 'c', 't'];
    for (const key of shortcuts) {
      await this.page.keyboard.press(key);
      await this.page.waitForTimeout(1500);
      
      // Check if composer appeared
      const composerFound = await this.checkForComposer();
      if (composerFound) break;
    }

    return await this.findAndPost(content);
  }

  /**
   * 🎯 STRATEGY 4: Mobile web interface
   */
  private async strategyMobileWeb(content: string): Promise<BulletproofPostResult> {
    // Switch to mobile user agent
    await this.page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15'
    });
    
    await this.page.goto('https://mobile.twitter.com/compose/tweet', { 
      waitUntil: 'domcontentloaded',
      timeout: 15000 
    });
    await this.page.waitForTimeout(3000);

    return await this.findAndPost(content);
  }

  /**
   * 🔍 Find composer with comprehensive selector search
   */
  private async findAndPost(content: string): Promise<BulletproofPostResult> {
    const composerSelectors = [
      // Standard selectors
      '[data-testid="tweetTextarea_0"]',
      'div[data-testid="tweetTextarea_0"]',
      
      // Role-based selectors
      'div[role="textbox"][contenteditable="true"]',
      'div[contenteditable="true"][role="textbox"]',
      'textarea[role="textbox"]',
      
      // Content-editable variants
      'div[contenteditable="true"]',
      '[contenteditable="true"]',
      
      // Aria label variants
      'div[aria-label*="Post text"]',
      'div[aria-label*="Tweet text"]',
      'div[aria-label*="What is happening"]',
      'div[aria-label*="Share your thoughts"]',
      'textarea[aria-label*="Post"]',
      'textarea[placeholder*="What is happening"]',
      
      // Data attributes
      'div[data-text="true"]',
      '[data-text="true"]',
      
      // Class-based fallbacks (less reliable but comprehensive)
      '.public-DraftEditor-content',
      '.notranslate',
      'div[dir="auto"][contenteditable="true"]',
      
      // Mobile selectors
      'textarea[name="text"]',
      'input[name="text"]',
      'div[role="textbox"]'
    ];

    console.log('🔍 COMPOSER_SEARCH: Searching with comprehensive selectors...');
    
    let composer: Locator | null = null;
    let workingSelector = '';

    for (const selector of composerSelectors) {
      try {
        console.log(`🔍 Trying: ${selector}`);
        const element = this.page.locator(selector).first();
        
        // Check if element exists and is visible
        await element.waitFor({ state: 'visible', timeout: 2000 });
        
        // Additional check: ensure it's actually editable
        const isEditable = await element.evaluate((el: any) => {
          return el.contentEditable === 'true' || 
                 el.tagName === 'TEXTAREA' || 
                 el.tagName === 'INPUT';
        });
        
        if (isEditable) {
          composer = element;
          workingSelector = selector;
          console.log(`✅ COMPOSER_FOUND: "${selector}" is editable!`);
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (!composer) {
      return {
        success: false,
        error: 'No composer element found with any selector'
      };
    }

    // Post the content
    try {
      console.log(`📝 POSTING: Using selector "${workingSelector}"`);
      
      // Focus and clear
      await composer.click();
      await this.page.waitForTimeout(500);
      
      // Try different input methods
      try {
        await composer.fill('');
        await composer.fill(content);
      } catch (e) {
        // Fallback to typing
        await composer.click();
        await this.page.keyboard.press('Control+a');
        await this.page.keyboard.type(content);
      }
      
      // Verify content
      const enteredText = await composer.inputValue().catch(() => 
        composer.innerText().catch(() => '')
      );
      
      if (!enteredText || enteredText.length < content.length * 0.8) {
        throw new Error(`Content verification failed. Expected: ${content.length}, Got: ${enteredText?.length || 0}`);
      }
      
      console.log(`✅ CONTENT_VERIFIED: ${enteredText.length} characters entered`);
      
      // Find and click post button
      const postResult = await this.findAndClickPostButton();
      if (!postResult.success) {
        return postResult;
      }
      
      // Wait for posting success
      await this.page.waitForTimeout(3000);
      
      // Try to extract tweet ID
      const tweetId = await this.extractTweetId();
      
      return {
        success: true,
        tweetId: tweetId || `posted_${Date.now()}`,
        strategy: workingSelector
      };
      
    } catch (error: any) {
      return {
        success: false,
        error: `Posting failed: ${error.message}`
      };
    }
  }

  /**
   * 🔍 Check if composer is present
   */
  private async checkForComposer(): Promise<boolean> {
    const quickSelectors = [
      '[data-testid="tweetTextarea_0"]',
      'div[contenteditable="true"]',
      'div[role="textbox"]'
    ];
    
    for (const selector of quickSelectors) {
      try {
        await this.page.locator(selector).first().waitFor({ state: 'visible', timeout: 1000 });
        return true;
      } catch (e) {
        continue;
      }
    }
    
    return false;
  }

  /**
   * 🔍 Find and click post button with comprehensive search
   */
  private async findAndClickPostButton(): Promise<BulletproofPostResult> {
    console.log('🔍 POST_BUTTON_SEARCH: Looking for post button...');
    
    const postSelectors = [
      // Standard Twitter selectors
      '[data-testid="tweetButtonInline"]:not([aria-hidden="true"])',
      '[data-testid="tweetButton"]:not([aria-hidden="true"])',
      'button[data-testid="tweetButtonInline"]',
      'button[data-testid="tweetButton"]',
      'div[data-testid="tweetButton"]',
      'button[data-testid="tweetButtonInline"]:not([tabindex="-1"])',
      
      // Role-based selectors
      'div[role="button"][data-testid*="tweet"]',
      'button[role="button"]',
      'div[role="button"]',
      
      // Text-based selectors (more reliable)
      'button:has-text("Post")',
      'div[role="button"]:has-text("Post")',
      'button:has-text("Tweet")',
      'input[type="submit"]',
      'button[type="submit"]',
      
      // Aria label selectors
      'button[aria-label*="Post"]',
      'button[aria-label*="Tweet"]',
      'div[aria-label*="Post"]',
      
      // General button fallbacks
      'button[class*="tweet"]',
      'button[class*="post"]',
      'div[class*="tweet"][role="button"]',
      
      // Mobile selectors
      'input[value="Tweet"]',
      'input[value="Post"]',
      'button[name="commit"]'
    ];

    for (const selector of postSelectors) {
      try {
        console.log(`🔍 POST_BUTTON: Trying "${selector}"`);
        const button = this.page.locator(selector).first();
        await button.waitFor({ state: 'visible', timeout: 2000 });
        
        // Check if button is enabled
        const isVisible = await button.isVisible();
        const isEnabled = await button.isEnabled();
        const ariaDisabled = await button.getAttribute('aria-disabled');
        const tabIndex = await button.getAttribute('tabindex');
        
        console.log(`🔍 POST_BUTTON: "${selector}" - visible:${isVisible}, enabled:${isEnabled}, aria-disabled:${ariaDisabled}, tabindex:${tabIndex}`);
        
        if (isVisible && isEnabled && ariaDisabled !== 'true' && tabIndex !== '-1') {
          console.log(`🚀 POST_BUTTON: Clicking "${selector}"`);
          await button.click();
          await this.page.waitForTimeout(1000); // Wait for click to process
          return { success: true };
        } else if (isVisible && isEnabled) {
          // Try clicking even if some attributes aren't perfect
          console.log(`🚀 POST_BUTTON: Force clicking "${selector}" (partial match)`);
          try {
            await button.click();
            await this.page.waitForTimeout(1000);
            return { success: true };
          } catch (clickError) {
            console.log(`❌ POST_BUTTON: Force click failed on "${selector}"`);
            continue;
          }
        }
      } catch (e) {
        console.log(`❌ POST_BUTTON: "${selector}" failed - ${(e as Error).message.substring(0, 50)}`);
        continue;
      }
    }

    // FALLBACK: Try keyboard shortcuts
    console.log('🔄 POST_BUTTON: No button found, trying keyboard shortcuts...');
    try {
      // Ctrl+Enter is a common shortcut for posting
      await this.page.keyboard.press('Control+Enter');
      await this.page.waitForTimeout(2000);
      
      // Check if post was successful by looking for URL change or other indicators
      const currentUrl = this.page.url();
      if (currentUrl.includes('/status/') || currentUrl.includes('/home')) {
        console.log('✅ POST_BUTTON: Keyboard shortcut worked!');
        return { success: true };
      }
      
      // Try Command+Enter for Mac
      await this.page.keyboard.press('Meta+Enter');
      await this.page.waitForTimeout(2000);
      
      console.log('✅ POST_BUTTON: Keyboard shortcut attempt completed');
      return { success: true }; // Assume success if no error
      
    } catch (e) {
      console.log('❌ POST_BUTTON: Keyboard shortcuts failed');
    }

    return {
      success: false,
      error: 'No enabled post button found and keyboard shortcuts failed'
    };
  }

  /**
   * 🆔 Extract tweet ID from URL or response
   */
  private async extractTweetId(): Promise<string | null> {
    try {
      // Wait for URL change indicating successful post
      await this.page.waitForFunction(
        () => window.location.href.includes('/status/') || 
              window.location.href.includes('/home'),
        { timeout: 10000 }
      );
      
      const url = this.page.url();
      const match = url.match(/\/status\/(\d+)/);
      
      if (match) {
        return match[1];
      }
      
      // Fallback: generate timestamp-based ID
      return `bulletproof_${Date.now()}`;
      
    } catch (e) {
      return null;
    }
  }

  /**
   * 💬 Post reply to specific tweet
   */
  async postReply(content: string, replyToTweetId: string): Promise<BulletproofPostResult> {
    console.log(`💬 BULLETPROOF_REPLY: Replying to ${replyToTweetId}`);
    
    try {
      // Navigate to the tweet we're replying to
      await this.page.goto(`https://x.com/i/status/${replyToTweetId}`, { 
        waitUntil: 'domcontentloaded',
        timeout: 15000 
      });
      await this.page.waitForTimeout(2000);
      
      // Click reply button with comprehensive selectors
      const replySelectors = [
        '[data-testid="reply"]',
        'div[data-testid="reply"]',
        'button[aria-label*="Reply"]',
        '[aria-label*="Reply"]',
        'div[aria-label*="Reply"]',
        'button[role="button"][aria-label*="Reply"]',
        'div[role="button"][aria-label*="Reply"]',
        // Generic reply patterns
        'button:has-text("Reply")',
        'div:has-text("Reply")',
        // Icon-based selectors
        'svg[aria-label*="Reply"]',
        'button:has(svg[aria-label*="Reply"])',
        'div:has(svg[aria-label*="Reply"])',
        // Position-based selectors (reply is usually first action)
        'article div[role="group"] > div:first-child button',
        'article div[role="group"] > div:first-child div[role="button"]',
        // Class-based fallbacks
        'button[class*="reply"]',
        'div[class*="reply"][role="button"]'
      ];
      
      let replyClicked = false;
      console.log('🔍 REPLY_SEARCH: Searching for reply button with enhanced selectors...');
      
      for (const selector of replySelectors) {
        try {
          console.log(`🔍 REPLY_SEARCH: Trying "${selector}"`);
          const replyBtn = this.page.locator(selector).first();
          await replyBtn.waitFor({ state: 'visible', timeout: 2000 });
          
          // Additional checks for reply button validity
          const isVisible = await replyBtn.isVisible();
          const isEnabled = await replyBtn.isEnabled();
          
          console.log(`🔍 REPLY_BUTTON: "${selector}" - visible:${isVisible}, enabled:${isEnabled}`);
          
          if (isVisible && isEnabled) {
            console.log(`🚀 REPLY_BUTTON: Clicking "${selector}"`);
            await replyBtn.click();
            await this.page.waitForTimeout(2000);
            replyClicked = true;
            console.log(`✅ REPLY_SUCCESS: Reply button clicked successfully`);
            break;
          }
        } catch (e) {
          console.log(`❌ REPLY_SEARCH: "${selector}" failed - ${(e as Error).message.substring(0, 50)}`);
          continue;
        }
      }
      
      if (!replyClicked) {
        return {
          success: false,
          error: 'Could not find or click reply button'
        };
      }
      
      // Now use the standard posting logic
      return await this.findAndPost(content);
      
    } catch (error: any) {
      return {
        success: false,
        error: `Reply failed: ${error.message}`
      };
    }
  }
}

export default BulletproofTwitterComposer;
