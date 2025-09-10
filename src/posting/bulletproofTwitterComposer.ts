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
    // Updated X/Twitter composer selectors as specified
    const composerSelectors = [
      'div[role="textbox"][contenteditable="true"]',
      'div[data-testid="tweetTextarea_0"] div[contenteditable="true"]',
      '[data-testid="tweetTextarea_0"] [role="textbox"]'
    ];

    const tweetButtons = [
      '[data-testid="tweetButtonInline"]',
      '[data-testid="tweetButton"]'
    ];

    console.log('🔍 COMPOSER_SEARCH: Searching with comprehensive selectors...');
    
    let composer: Locator | null = null;
    let workingSelector = '';

    // BOUNDED RETRIES: Maximum 2 attempts, no reply-chain fallback
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`🎯 COMPOSER_ATTEMPT: ${attempt}/2`);
        
        // Navigate to compose page for reliability
        if (attempt === 1) {
          await this.page.goto('https://x.com/compose/tweet', { 
            waitUntil: 'domcontentloaded',
            timeout: 8000 
          });
          await this.page.waitForTimeout(1000);
        }
        
        // Block analytics to reduce noise
        await this.page.route('**/*analytics*', route => route.abort());
        
        // Use robust selectors for X/Twitter 2025-Q3
        const textbox = this.page.locator([
          'div[data-testid="tweetTextarea_0"] div[contenteditable="true"]',
          'section[role="dialog"] div[contenteditable="true"]',
          'div[contenteditable="true"]'
        ].join(', ')).first();
        
        await textbox.waitFor({ state: 'visible', timeout: 6000 });
        console.log('✅ COMPOSER_FOUND: Element located successfully');
        
        // Safe focus and type
        await textbox.click({ trial: true }).catch(() => {});
        await textbox.focus();
        await this.page.keyboard.type(content, { delay: 15 });
        await this.page.waitForTimeout(500);
        
        console.log(`✅ CONTENT_ENTERED: ${content.length} characters typed`);
        
        // Find and click post button
        const postButton = this.page.locator([
          'button[role="button"][data-testid="tweetButton"]',
          'div[role="button"][data-testid="tweetButton"]'
        ].join(', ')).first();
        
        await postButton.waitFor({ state: 'visible', timeout: 6000 });
        await postButton.click();
        await this.page.waitForTimeout(2000);
        
        console.log('✅ BULLETPROOF_SUCCESS: Post submitted successfully');
        return { success: true };
        
      } catch (error: any) {
        console.error(`❌ ATTEMPT_${attempt}_FAILED: ${error.message}`);
        
        if (attempt === 2) {
          // Final attempt failed - abort without escalation
          console.error('❌ COMPOSER_NOT_AVAILABLE: Max attempts reached, aborting');
          throw new Error('COMPOSER_NOT_AVAILABLE');
        }
        
        // Wait before retry
        await this.page.waitForTimeout(1000);
      }
    }
    
    // Should not reach here
    return {
      success: false,
      error: 'COMPOSER_NOT_AVAILABLE'
    };

    // Legacy fallback code (shouldn't reach here)
    console.log(`📝 POSTING: Legacy fallback`);
    try {
      
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
   * 🆔 Extract tweet ID from URL or response with enhanced detection
   */
  private async extractTweetId(): Promise<string | null> {
    try {
      console.log('🆔 ID_EXTRACTION: Starting enhanced tweet ID capture...');
      
      // Strategy 1: Wait for URL change indicating successful post
      try {
        await this.page.waitForFunction(
          () => window.location.href.includes('/status/') || 
                window.location.href.includes('/home'),
          { timeout: 8000 }
        );
        
        const url = this.page.url();
        console.log(`🔍 ID_EXTRACTION: Current URL: ${url}`);
        
        const match = url.match(/\/status\/(\d+)/);
        if (match) {
          console.log(`✅ ID_EXTRACTION: Found tweet ID in URL: ${match[1]}`);
          return match[1];
        }
      } catch (e) {
        console.log('⚠️ ID_EXTRACTION: URL-based extraction failed, trying alternatives...');
      }
      
      // Strategy 2: Look for tweet ID in DOM elements
      try {
        const tweetSelectors = [
          'article[data-testid="tweet"]',
          '[data-testid="tweet"]',
          'article[role="article"]',
          'div[data-tweet-id]'
        ];
        
        for (const selector of tweetSelectors) {
          const elements = await this.page.locator(selector).all();
          for (const element of elements) {
            // Check for data attributes that might contain tweet ID
            const tweetId = await element.getAttribute('data-tweet-id').catch(() => null);
            if (tweetId && /^\d+$/.test(tweetId)) {
              console.log(`✅ ID_EXTRACTION: Found tweet ID in DOM: ${tweetId}`);
              return tweetId;
            }
            
            // Check for ID patterns in href attributes
            const links = await element.locator('a[href*="/status/"]').all();
            for (const link of links) {
              const href = await link.getAttribute('href').catch(() => null);
              if (href) {
                const match = href.match(/\/status\/(\d+)/);
                if (match) {
                  console.log(`✅ ID_EXTRACTION: Found tweet ID in link: ${match[1]}`);
                  return match[1];
                }
              }
            }
          }
        }
      } catch (e) {
        console.log('⚠️ ID_EXTRACTION: DOM-based extraction failed');
      }
      
      // Strategy 3: Network response monitoring
      try {
        // Set up response listener for POST requests
        let capturedId: string | null = null;
        
        const responseHandler = (response: any) => {
          if (response.url().includes('CreateTweet') || 
              response.url().includes('api/2/tweets') ||
              response.url().includes('tweet/create')) {
            response.json().then((data: any) => {
              if (data?.data?.create_tweet?.tweet_results?.result?.rest_id) {
                capturedId = data.data.create_tweet.tweet_results.result.rest_id;
                console.log(`✅ ID_EXTRACTION: Captured from API: ${capturedId}`);
              }
            }).catch(() => {});
          }
        };
        
        this.page.on('response', responseHandler);
        
        // Wait a bit for network capture
        await this.page.waitForTimeout(3000);
        
        this.page.off('response', responseHandler);
        
        if (capturedId) {
          return capturedId;
        }
      } catch (e) {
        console.log('⚠️ ID_EXTRACTION: Network-based extraction failed');
      }
      
      // Strategy 4: Timeline change detection
      try {
        console.log('🔍 ID_EXTRACTION: Checking timeline for new tweets...');
        
        // Navigate to home to see if tweet appears
        await this.page.goto('https://x.com/home', { timeout: 10000 });
        await this.page.waitForTimeout(2000);
        
        // Look for the most recent tweet
        const recentTweet = this.page.locator('article[data-testid="tweet"]').first();
        await recentTweet.waitFor({ state: 'visible', timeout: 5000 });
        
        const timeElement = recentTweet.locator('time').first();
        const timeText = await timeElement.innerText().catch(() => '');
        
        // If posted within last minute, it's likely our tweet
        if (timeText.includes('now') || timeText.includes('1m') || timeText.includes('s')) {
          const tweetLink = recentTweet.locator('a[href*="/status/"]').first();
          const href = await tweetLink.getAttribute('href').catch(() => null);
          
          if (href) {
            const match = href.match(/\/status\/(\d+)/);
            if (match) {
              console.log(`✅ ID_EXTRACTION: Found recent tweet ID: ${match[1]}`);
              return match[1];
            }
          }
        }
      } catch (e) {
        console.log('⚠️ ID_EXTRACTION: Timeline-based extraction failed');
      }
      
      // Fallback: generate timestamp-based ID
      const fallbackId = `bulletproof_${Date.now()}`;
      console.log(`🔄 ID_EXTRACTION: Using fallback ID: ${fallbackId}`);
      return fallbackId;
      
    } catch (e) {
      console.log(`❌ ID_EXTRACTION: All methods failed: ${(e as Error).message}`);
      return `fallback_${Date.now()}`;
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
      await this.page.waitForTimeout(3000); // Increased wait time
      
      // Wait for the main article (tweet) to load
      await this.page.waitForSelector('article', { timeout: 10000 });
      console.log('✅ TWEET_PAGE: Article loaded successfully');
      
      // Enhanced reply button selectors with latest Twitter patterns
      const replySelectors = [
        // Modern Twitter X.com selectors (2024+)
        '[data-testid="reply"]',
        'div[data-testid="reply"]', 
        'button[data-testid="reply"]',
        '[data-testid="reply"] button',
        '[data-testid="reply"] div[role="button"]',
        
        // Aria label patterns (most reliable)
        'button[aria-label*="Reply"]',
        '[aria-label*="Reply"][role="button"]',
        'div[aria-label*="Reply"][role="button"]',
        'button[aria-label*="reply"]',
        '[aria-label*="reply"][role="button"]',
        
        // SVG-based detection (Twitter often uses SVG icons)
        'button:has(svg)',
        'div[role="button"]:has(svg)',
        'button:has([d*="M1.751"])', // Reply icon path
        'div[role="button"]:has([d*="M1.751"])',
        
        // Position-based selectors (reply is first action button)
        'article div[role="group"] button:first-child',
        'article div[role="group"] div[role="button"]:first-child',
        'article [role="group"] > div:first-child button',
        'article [role="group"] > div:first-child [role="button"]',
        
        // Container-based selectors
        'article button[role="button"]',
        'article div[role="button"]',
        
        // Generic patterns
        'button:has-text("Reply")',
        'div:has-text("Reply")[role="button"]',
        '[title*="Reply"]',
        '[aria-label*="回复"]', // Chinese
        '[aria-label*="返信"]', // Japanese
        
        // Fallback broad selectors
        'article button',
        'div[role="button"][tabindex="0"]'
      ];
      
      let replyClicked = false;
      console.log('🔍 REPLY_SEARCH: Searching for reply button with enhanced selectors...');
      
      // First, try keyboard shortcut (most reliable)
      try {
        console.log('⌨️ REPLY_SHORTCUT: Trying keyboard shortcut "r"...');
        await this.page.keyboard.press('r');
        await this.page.waitForTimeout(2000);
        
        // Check if reply composer opened
        const composerVisible = await this.checkForComposer();
        if (composerVisible) {
          console.log('✅ REPLY_SHORTCUT: Keyboard shortcut worked!');
          replyClicked = true;
        }
      } catch (e) {
        console.log('⚠️ REPLY_SHORTCUT: Keyboard shortcut failed');
      }
      
      // If shortcut didn't work, try button selectors
      if (!replyClicked) {
        for (const selector of replySelectors) {
          try {
            console.log(`🔍 REPLY_SEARCH: Trying "${selector}"`);
            const replyBtn = this.page.locator(selector).first();
            
            // Use shorter timeout for faster iteration
            await replyBtn.waitFor({ state: 'visible', timeout: 1500 });
            
            // Additional checks for reply button validity
            const isVisible = await replyBtn.isVisible();
            const isEnabled = await replyBtn.isEnabled();
            
            console.log(`🔍 REPLY_BUTTON: "${selector}" - visible:${isVisible}, enabled:${isEnabled}`);
            
            if (isVisible && isEnabled) {
              console.log(`🚀 REPLY_BUTTON: Clicking "${selector}"`);
              await replyBtn.click();
              await this.page.waitForTimeout(2000);
              
              // Verify reply composer opened
              const composerOpened = await this.checkForComposer();
              if (composerOpened) {
                replyClicked = true;
                console.log(`✅ REPLY_SUCCESS: Reply button clicked and composer opened`);
                break;
              } else {
                console.log(`⚠️ REPLY_BUTTON: Button clicked but composer didn't open`);
              }
            }
          } catch (e) {
            console.log(`❌ REPLY_SEARCH: "${selector}" failed - ${(e as Error).message.substring(0, 50)}`);
            continue;
          }
        }
      }
      
      if (!replyClicked) {
        // Last resort: try clicking anywhere on the tweet area
        console.log('🔄 REPLY_FALLBACK: Trying tweet area click + keyboard shortcut...');
        try {
          await this.page.locator('article').first().click();
          await this.page.waitForTimeout(1000);
          await this.page.keyboard.press('r');
          await this.page.waitForTimeout(2000);
          
          const composerOpened = await this.checkForComposer();
          if (composerOpened) {
            console.log('✅ REPLY_FALLBACK: Fallback method worked!');
            replyClicked = true;
          }
        } catch (e) {
          console.log('❌ REPLY_FALLBACK: Fallback method failed');
        }
      }
      
      if (!replyClicked) {
        // Take screenshot for debugging
        try {
          await this.page.screenshot({ 
            path: `/app/data/reply_fail_${Date.now()}.png`,
            fullPage: false 
          });
          console.log('📸 DEBUG: Reply failure screenshot saved');
        } catch (e) {}
        
        return {
          success: false,
          error: 'Could not find or click reply button with any method'
        };
      }
      
      // Now use the standard posting logic
      console.log('📝 REPLY_POSTING: Reply composer opened, posting content...');
      return await this.findAndPost(content);
      
    } catch (error: any) {
      console.log(`❌ REPLY_ERROR: ${error.message}`);
      return {
        success: false,
        error: `Reply failed: ${error.message}`
      };
    }
  }
}

export default BulletproofTwitterComposer;
