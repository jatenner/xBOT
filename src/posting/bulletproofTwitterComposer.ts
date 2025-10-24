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
   * 🔍 Find composer with comprehensive selector search - BOUNDED RETRIES ONLY
   */
  private async findAndPost(content: string): Promise<BulletproofPostResult> {
    console.log('🔍 COMPOSER_SEARCH: Using bounded retries with current X/Twitter selectors...');

    // BOUNDED RETRIES: Maximum 2 attempts, no reply-chain fallback
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`🎯 COMPOSER_ATTEMPT: ${attempt}/2`);
        
        // 🔧 FIX: Check if composer is already open (e.g., from reply dialog)
        const composerAlreadyOpen = await this.checkForComposer();
        
        // Navigate to compose page ONLY if composer is not already open
        if (attempt === 1 && !composerAlreadyOpen) {
          console.log('🌐 NAVIGATION: Composer not found, navigating to compose page...');
          await this.page.goto('https://x.com/compose/tweet', { 
            waitUntil: 'domcontentloaded',
            timeout: 8000 
          });
          await this.page.waitForTimeout(1000);
        } else if (composerAlreadyOpen) {
          console.log('✅ COMPOSER_READY: Composer already open (likely from reply), using it...');
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
        await this.page.waitForTimeout(3000); // Wait for navigation
        
        console.log('✅ BULLETPROOF_SUCCESS: Post submitted, extracting tweet ID...');
        
        // Extract real tweet ID from Twitter
        const tweetId = await this.extractTweetId();
        
        if (tweetId) {
          console.log(`✅ TWEET_ID_EXTRACTED: ${tweetId}`);
          return { success: true, tweetId };
        } else {
          console.error('❌ TWEET_ID_MISSING: Post may have succeeded but could not extract real ID');
          return { 
            success: false, 
            error: 'Failed to extract tweet ID after posting - cannot verify post success'
          };
        }
        
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
   * 🔬 DIAGNOSTIC: Log DOM state for debugging
   */
  private async logDOMState(phase: string): Promise<void> {
    try {
      const state = await this.page.evaluate(() => {
        const articles = document.querySelectorAll('article');
        const buttons = document.querySelectorAll('button, [role="button"]');
        const composer = document.querySelector('[contenteditable="true"]');
        const modals = document.querySelectorAll('[role="dialog"]');
        
        return {
          articleCount: articles.length,
          buttonCount: buttons.length,
          composerVisible: !!composer,
          modalCount: modals.length,
          url: window.location.href
        };
      });
      
      console.log(`🔬 DOM_STATE[${phase}]:`, JSON.stringify(state));
    } catch (e) {
      console.log(`⚠️ DOM_STATE[${phase}]: Failed to capture - ${(e as Error).message}`);
    }
  }

  /**
   * 🎯 ENHANCED: Try to click reply button with advanced event dispatch
   */
  private async enhancedClick(element: any): Promise<boolean> {
    try {
      console.log('🎯 ENHANCED_CLICK: Trying advanced event-based click...');
      
      // Strategy 1: Hover first (some UIs require hover state)
      try {
        await element.hover({ timeout: 2000 });
        await this.page.waitForTimeout(500);
        console.log('  ✓ Hover successful');
      } catch (e) {
        console.log('  ✗ Hover failed, continuing...');
      }
      
      // Strategy 2: Focus the element
      try {
        await element.focus({ timeout: 2000 });
        await this.page.waitForTimeout(300);
        console.log('  ✓ Focus successful');
      } catch (e) {
        console.log('  ✗ Focus failed, continuing...');
      }
      
      // Strategy 3: Dispatch proper events via JavaScript
      const eventDispatched = await element.evaluate((el: any) => {
        try {
          // Dispatch full event sequence (realistic user interaction)
          const events = [
            new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }),
            new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }),
            new MouseEvent('click', { bubbles: true, cancelable: true, view: window }),
            new PointerEvent('pointerdown', { bubbles: true, cancelable: true }),
            new PointerEvent('pointerup', { bubbles: true, cancelable: true }),
            new PointerEvent('click', { bubbles: true, cancelable: true })
          ];
          
          events.forEach(event => el.dispatchEvent(event));
          return true;
        } catch (err) {
          return false;
        }
      });
      
      console.log(`  ${eventDispatched ? '✓' : '✗'} Event dispatch ${eventDispatched ? 'successful' : 'failed'}`);
      
      // Strategy 4: Regular Playwright click
      try {
        await element.click({ timeout: 3000, force: true });
        console.log('  ✓ Playwright click successful');
      } catch (e) {
        console.log('  ✗ Playwright click failed');
      }
      
      return true;
    } catch (error) {
      console.log(`❌ ENHANCED_CLICK: Failed - ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * 👁️ ENHANCED: Wait for composer with MutationObserver
   */
  private async waitForComposerWithObserver(timeoutMs: number = 10000): Promise<boolean> {
    try {
      console.log('👁️ MUTATION_OBSERVER: Watching for composer appearance...');
      
      const composerAppeared = await this.page.evaluate((timeout) => {
        return new Promise<boolean>((resolve) => {
          const startTime = Date.now();
          
          // Check if composer is already visible
          const checkComposer = () => {
            const composer = document.querySelector('[contenteditable="true"]') ||
                           document.querySelector('[data-testid="tweetTextarea_0"]') ||
                           document.querySelector('[role="textbox"]');
            return composer && (composer as HTMLElement).offsetParent !== null;
          };
          
          if (checkComposer()) {
            resolve(true);
            return;
          }
          
          // Set up mutation observer
          const observer = new MutationObserver(() => {
            if (checkComposer()) {
              observer.disconnect();
              resolve(true);
            } else if (Date.now() - startTime > timeout) {
              observer.disconnect();
              resolve(false);
            }
          });
          
          observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'class']
          });
          
          // Timeout fallback
          setTimeout(() => {
            observer.disconnect();
            resolve(checkComposer());
          }, timeout);
        });
      }, timeoutMs);
      
      if (composerAppeared) {
        console.log('✅ MUTATION_OBSERVER: Composer detected!');
      } else {
        console.log('❌ MUTATION_OBSERVER: Composer did not appear within timeout');
      }
      
      return composerAppeared;
    } catch (error) {
      console.log(`❌ MUTATION_OBSERVER: Error - ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * 🔄 FALLBACK: Try direct compose URL
   */
  private async tryDirectComposeURL(replyToTweetId: string, content: string): Promise<BulletproofPostResult> {
    try {
      console.log('🔄 DIRECT_COMPOSE: Trying direct compose URL method...');
      
      // Method 1: Try compose URL with reply parameter
      const composeUrl = `https://x.com/intent/post?in_reply_to=${replyToTweetId}`;
      console.log(`🌐 DIRECT_COMPOSE: Navigating to ${composeUrl}`);
      
      await this.page.goto(composeUrl, { 
        waitUntil: 'domcontentloaded',
        timeout: 15000 
      });
      await this.page.waitForTimeout(3000);
      
      // Check if composer opened
      const composerOpened = await this.checkForComposer();
      if (composerOpened) {
        console.log('✅ DIRECT_COMPOSE: Composer opened via direct URL!');
        return await this.findAndPost(content);
      }
      
      console.log('❌ DIRECT_COMPOSE: Direct URL did not open composer');
      return { success: false, error: 'Direct compose URL failed' };
      
    } catch (error) {
      console.log(`❌ DIRECT_COMPOSE: Failed - ${(error as Error).message}`);
      return { success: false, error: `Direct compose failed: ${(error as Error).message}` };
    }
  }

  /**
   * 📱 FALLBACK: Try mobile interface
   */
  private async tryMobileInterface(replyToTweetId: string, content: string): Promise<BulletproofPostResult> {
    try {
      console.log('📱 MOBILE_FALLBACK: Switching to mobile interface...');
      
      // Set mobile user agent
      await this.page.setViewportSize({ width: 375, height: 812 });
      await this.page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
      });
      
      // Navigate to tweet in mobile view
      const mobileUrl = `https://mobile.twitter.com/i/status/${replyToTweetId}`;
      console.log(`🌐 MOBILE_FALLBACK: Navigating to ${mobileUrl}`);
      
      await this.page.goto(mobileUrl, { 
        waitUntil: 'domcontentloaded',
        timeout: 15000 
      });
      await this.page.waitForTimeout(3000);
      
      // Mobile Twitter might have different reply button selectors
      const mobileReplySelectors = [
        '[data-testid="reply"]',
        'button[aria-label*="Reply"]',
        'div[role="button"]:has-text("Reply")',
        '.reply-button',
        'button:has-text("Reply")'
      ];
      
      for (const selector of mobileReplySelectors) {
        try {
          const btn = this.page.locator(selector).first();
          await btn.waitFor({ state: 'visible', timeout: 2000 });
          await btn.click();
          await this.page.waitForTimeout(2000);
          
          const composerOpened = await this.checkForComposer();
          if (composerOpened) {
            console.log(`✅ MOBILE_FALLBACK: Composer opened with "${selector}"!`);
            return await this.findAndPost(content);
          }
        } catch (e) {
          continue;
        }
      }
      
      console.log('❌ MOBILE_FALLBACK: Mobile interface did not work');
      return { success: false, error: 'Mobile interface failed' };
      
    } catch (error) {
      console.log(`❌ MOBILE_FALLBACK: Failed - ${(error as Error).message}`);
      return { success: false, error: `Mobile interface failed: ${(error as Error).message}` };
    }
  }

  /**
   * 🔬 DIAGNOSTIC: Capture failure diagnostics for debugging
   */
  private async captureFailureDiagnostics(failureType: string, context: string): Promise<void> {
    try {
      console.log(`🔬 DIAGNOSTICS: Capturing ${failureType} diagnostics...`);
      
      // 1. Take screenshot
      const timestamp = Date.now();
      const screenshotPath = `./diagnostics/screenshot_${failureType}_${timestamp}.png`;
      
      try {
        await this.page.screenshot({ 
          path: screenshotPath,
          fullPage: true 
        });
        console.log(`📸 SCREENSHOT: Saved to ${screenshotPath}`);
      } catch (screenshotError) {
        console.log(`⚠️ SCREENSHOT: Failed - ${(screenshotError as Error).message}`);
      }
      
      // 2. Capture DOM structure of clickable elements
      const clickableElements = await this.page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('button, [role="button"], [tabindex="0"]'));
        return elements.slice(0, 50).map((el, idx) => ({
          index: idx,
          tagName: el.tagName,
          className: el.className,
          id: el.id,
          ariaLabel: el.getAttribute('aria-label'),
          dataTestId: el.getAttribute('data-testid'),
          text: el.textContent?.substring(0, 50),
          visible: (el as HTMLElement).offsetParent !== null
        }));
      });
      
      console.log(`🔍 CLICKABLE_ELEMENTS: Found ${clickableElements.length} elements`);
      console.log(JSON.stringify(clickableElements, null, 2));
      
      // 3. Log to database for tracking
      try {
        const { getSupabaseClient } = await import('../db/index');
        const supabase = getSupabaseClient();
        
        await supabase.from('reply_diagnostics').insert([{
          failure_type: failureType,
          context: context,
          timestamp: new Date().toISOString(),
          screenshot_path: screenshotPath,
          dom_structure: clickableElements,
          page_url: this.page.url()
        }]);
        
        console.log('✅ DIAGNOSTICS: Saved to database');
      } catch (dbError) {
        console.log(`⚠️ DIAGNOSTICS: DB save failed - ${(dbError as Error).message}`);
      }
      
    } catch (error) {
      console.log(`❌ DIAGNOSTICS: Failed to capture - ${(error as Error).message}`);
    }
  }

  /**
   * 👤 Extract author username from a tweet element
   */
  private async extractAuthorFromTweet(tweetElement: any): Promise<string | null> {
    try {
      // Strategy 1: Look for username in author link
      const authorLinkSelectors = [
        '[data-testid="User-Name"] a[href^="/"]',
        'a[role="link"][href^="/"]',
        '[data-testid="User-Name"] span'
      ];
      
      for (const selector of authorLinkSelectors) {
        try {
          const element = await tweetElement.locator(selector).first();
          const href = await element.getAttribute('href').catch(() => null);
          
          if (href) {
            // Extract username from href like "/@username" or "/username"
            const match = href.match(/^\/(@)?([^/]+)$/);
            if (match && match[2]) {
              const username = match[2];
              console.log(`   🔍 AUTHOR: Extracted from href: @${username}`);
              return username;
            }
          }
          
          // Try text content
          const text = await element.innerText().catch(() => null);
          if (text && text.startsWith('@')) {
            const username = text.substring(1).trim();
            console.log(`   🔍 AUTHOR: Extracted from text: @${username}`);
            return username;
          }
        } catch (e) {
          continue;
        }
      }
      
      // Strategy 2: Look for aria-label containing username
      try {
        const userNameElement = await tweetElement.locator('[data-testid="User-Name"]').first();
        const ariaLabel = await userNameElement.getAttribute('aria-label').catch(() => null);
        if (ariaLabel) {
          // aria-label might be like "John Doe @username"
          const match = ariaLabel.match(/@(\w+)/);
          if (match) {
            console.log(`   🔍 AUTHOR: Extracted from aria-label: @${match[1]}`);
            return match[1];
          }
        }
      } catch (e) {
        // Continue to next strategy
      }
      
      console.log('   ⚠️ AUTHOR: Could not extract author username');
      return null;
    } catch (e) {
      console.log(`   ❌ AUTHOR: Extraction failed: ${(e as Error).message}`);
      return null;
    }
  }

  /**
   * 🆔 Extract tweet ID from URL or response with enhanced detection + AUTHOR VERIFICATION
   */
  private async extractTweetId(): Promise<string | null> {
    try {
      console.log('🆔 ID_EXTRACTION: Starting enhanced tweet ID capture with author verification...');
      
      const expectedUsername = process.env.TWITTER_USERNAME || 'SignalAndSynapse';
      console.log(`🔐 ID_EXTRACTION: Expected author: @${expectedUsername}`);
      
      // Strategy 1: Wait for URL change indicating successful post
      try {
        await this.page.waitForFunction(
          () => window.location.href.includes('/status/') || 
                window.location.href.includes('/home'),
          { timeout: 8000 }
        );
        
        const url = this.page.url();
        console.log(`🔍 ID_EXTRACTION: Current URL: ${url}`);
        
        // CRITICAL FIX: Verify URL contains OUR username
        if (url.includes(`/${expectedUsername}/status/`)) {
          const match = url.match(/\/status\/(\d+)/);
          if (match) {
            const tweetId = match[1];
            console.log(`✅ ID_EXTRACTION: Found verified tweet ID in URL: ${tweetId} (author: @${expectedUsername})`);
            return tweetId;
          }
        } else if (url.includes('/status/')) {
          console.log(`⚠️ ID_EXTRACTION: URL contains tweet ID but WRONG AUTHOR - rejecting`);
          console.log(`   URL: ${url}`);
          console.log(`   Expected: /${expectedUsername}/status/`);
        }
      } catch (e) {
        console.log('⚠️ ID_EXTRACTION: URL-based extraction failed, trying alternatives...');
      }
      
      // Strategy 2: Look for tweet ID in DOM elements WITH AUTHOR VERIFICATION
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
            // CRITICAL FIX: Extract and verify author FIRST
            const authorUsername = await this.extractAuthorFromTweet(element);
            if (!authorUsername || authorUsername.toLowerCase() !== expectedUsername.toLowerCase()) {
              console.log(`⚠️ ID_EXTRACTION: Skipping tweet from wrong author: @${authorUsername || 'unknown'}`);
              continue;
            }
            
            console.log(`✅ ID_EXTRACTION: Found tweet from correct author: @${authorUsername}`);
            
            // Check for data attributes that might contain tweet ID
            const tweetId = await element.getAttribute('data-tweet-id').catch(() => null);
            if (tweetId && /^\d+$/.test(tweetId)) {
              console.log(`✅ ID_EXTRACTION: Found verified tweet ID in DOM: ${tweetId}`);
              return tweetId;
            }
            
            // Check for ID patterns in href attributes
            const links = await element.locator('a[href*="/status/"]').all();
            for (const link of links) {
              const href = await link.getAttribute('href').catch(() => null);
              if (href && href.includes(`/${expectedUsername}/status/`)) {
                const match = href.match(/\/status\/(\d+)/);
                if (match) {
                  console.log(`✅ ID_EXTRACTION: Found verified tweet ID in link: ${match[1]}`);
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
      
      // Strategy 4: USER PROFILE check (NOT home timeline!) - CRITICAL FIX
      try {
        console.log('🔍 ID_EXTRACTION: Checking USER PROFILE for new tweet...');
        
        // CRITICAL FIX: Navigate to OUR profile, not /home timeline
        const profileUrl = `https://x.com/${expectedUsername}`;
        console.log(`🔍 ID_EXTRACTION: Navigating to ${profileUrl}`);
        await this.page.goto(profileUrl, { timeout: 10000 });
        await this.page.waitForTimeout(2000);
        
        // Look for the most recent tweet on OUR profile
        const recentTweet = this.page.locator('article[data-testid="tweet"]').first();
        await recentTweet.waitFor({ state: 'visible', timeout: 5000 });
        
        // ADDITIONAL VERIFICATION: Extract author from this tweet
        const authorUsername = await this.extractAuthorFromTweet(recentTweet);
        if (authorUsername && authorUsername.toLowerCase() !== expectedUsername.toLowerCase()) {
          console.log(`⚠️ ID_EXTRACTION: Tweet on profile has WRONG AUTHOR: @${authorUsername} (expected @${expectedUsername})`);
          throw new Error('Author mismatch on profile page');
        }
        
        console.log(`✅ ID_EXTRACTION: Verified tweet is from @${authorUsername}`);
        
        const timeElement = recentTweet.locator('time').first();
        const timeText = await timeElement.innerText().catch(() => '');
        
        console.log(`🕒 ID_EXTRACTION: Tweet timestamp: "${timeText}"`);
        
        // If posted within last 2 minutes, it's our tweet
        if (timeText.includes('now') || timeText.includes('s') || timeText.includes('1m') || timeText.includes('2m')) {
          const tweetLink = recentTweet.locator('a[href*="/status/"]').first();
          const href = await tweetLink.getAttribute('href').catch(() => null);
          
          if (href && href.includes(`/${expectedUsername}/status/`)) {
            const match = href.match(/\/status\/(\d+)/);
            if (match) {
              console.log(`✅ ID_EXTRACTION: Found VERIFIED recent tweet ID from profile: ${match[1]}`);
              return match[1];
            }
          } else {
            console.log(`⚠️ ID_EXTRACTION: Tweet link doesn't match expected username pattern`);
            console.log(`   href: ${href}`);
            console.log(`   Expected pattern: /${expectedUsername}/status/`);
          }
        } else {
          console.log(`⚠️ ID_EXTRACTION: Most recent tweet is too old (timestamp: "${timeText}"), not our just-posted tweet`);
        }
      } catch (e) {
        console.log(`⚠️ ID_EXTRACTION: Profile-based extraction failed: ${(e as Error).message}`);
      }
      
      // NO FALLBACKS - if we can't extract real ID, return null
      console.error('❌ ID_EXTRACTION: All strategies failed, returning null');
      return null;
      
    } catch (e) {
      console.error(`❌ ID_EXTRACTION: Extraction failed: ${(e as Error).message}`);
      return null;
    }
  }

  /**
   * 💬 Post reply to specific tweet - ENHANCED VERSION
   */
  async postReply(content: string, replyToTweetId: string): Promise<BulletproofPostResult> {
    console.log(`💬 BULLETPROOF_REPLY: Replying to ${replyToTweetId}`);
    console.log(`🔬 ENHANCED_REPLY: Using multi-layered detection and click strategies`);
    
    try {
      // Navigate to the tweet we're replying to
      const targetTweetUrl = `https://x.com/i/status/${replyToTweetId}`;
      console.log(`🌐 REPLY_NAV: Navigating to ${targetTweetUrl}`);
      await this.page.goto(targetTweetUrl, { 
        waitUntil: 'domcontentloaded',
        timeout: 15000 
      });
      await this.page.waitForTimeout(3000); // Increased wait time
      
      // 🔬 DIAGNOSTIC: Wait for network idle (Twitter loads composer async)
      try {
        await this.page.waitForLoadState('networkidle', { timeout: 5000 });
        console.log('✅ NETWORK_IDLE: All network requests completed');
      } catch (e) {
        console.log('⚠️ NETWORK_IDLE: Timeout reached, proceeding anyway');
      }
      
      // Wait for the main article (tweet) to load
      await this.page.waitForSelector('article', { timeout: 10000 });
      console.log('✅ TWEET_PAGE: Article loaded successfully');
      
      // 🔬 DIAGNOSTIC: Capture DOM state before attempting reply
      await this.logDOMState('before_reply_attempt');
      
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
      console.log('🔍 REPLY_SEARCH: Searching for reply button with ENHANCED multi-strategy approach...');
      
      // STRATEGY 0: Try keyboard shortcut FIRST (most reliable for Twitter)
      try {
        console.log('⌨️ REPLY_SHORTCUT: Trying keyboard shortcut "r"...');
        
        // Focus the tweet article first to ensure keyboard event is captured
        await this.page.locator('article').first().click();
        await this.page.waitForTimeout(1000);
        
        // Press 'r' to open reply composer
        await this.page.keyboard.press('r');
        
        // Use MutationObserver to wait for composer
        const composerVisible = await this.waitForComposerWithObserver(8000);
        if (composerVisible) {
          console.log('✅ REPLY_SHORTCUT: Keyboard shortcut worked!');
          replyClicked = true;
        } else {
          console.log('⚠️ REPLY_SHORTCUT: Composer not detected via MutationObserver');
        }
      } catch (e) {
        console.log(`⚠️ REPLY_SHORTCUT: Keyboard shortcut failed - ${(e as Error).message}`);
      }
      
      // STRATEGY 1: If shortcut didn't work, try ENHANCED aggressive approach
      if (!replyClicked) {
        try {
          console.log('🔍 REPLY_AGGRESSIVE: Using enhanced click on clickable elements...');
          
          // Get all clickable elements in the article
          const clickableElements = await this.page.locator('article').first().locator('button, [role="button"], [tabindex="0"]').all();
          
          console.log(`🔍 REPLY_AGGRESSIVE: Found ${clickableElements.length} clickable elements`);
          
          // Focus on first 10 elements (likely action buttons)
          const elementsToTry = clickableElements.slice(0, 10);
          
          for (let i = 0; i < elementsToTry.length; i++) {
            try {
              const element = elementsToTry[i];
              const isVisible = await element.isVisible({ timeout: 1000 });
              
              if (isVisible) {
                console.log(`🔍 REPLY_AGGRESSIVE: Trying element ${i + 1}/${elementsToTry.length} with enhanced click...`);
                
                // Use enhanced click method
                await this.enhancedClick(element);
                
                // Wait and check with MutationObserver
                const composerOpened = await this.waitForComposerWithObserver(4000);
                if (composerOpened) {
                  console.log(`✅ REPLY_AGGRESSIVE: Element ${i + 1} worked!`);
                  replyClicked = true;
                  break;
                }
              }
            } catch (e) {
              // Continue to next element
            }
          }
        } catch (e) {
          console.log(`❌ REPLY_AGGRESSIVE: Failed - ${(e as Error).message}`);
        }
      }
      
      // 🔬 DIAGNOSTIC: Log DOM state after aggressive attempt
      if (!replyClicked) {
        await this.logDOMState('after_aggressive_attempt');
      }
      
      // STRATEGY 2: If aggressive approach didn't work, try enhanced selector-based clicking
      if (!replyClicked) {
        console.log('🔍 REPLY_SELECTORS: Trying selector-based approach with enhanced clicks...');
        
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
              console.log(`🚀 REPLY_BUTTON: Using enhanced click on "${selector}"`);
              
              // Use enhanced click method
              await this.enhancedClick(replyBtn);
              
              // Use MutationObserver to wait for composer
              const composerOpened = await this.waitForComposerWithObserver(5000);
              if (composerOpened) {
                replyClicked = true;
                console.log(`✅ REPLY_SUCCESS: Selector "${selector}" worked and composer opened!`);
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
      
      // 🔬 DIAGNOSTIC: Log DOM state after selector attempt
      if (!replyClicked) {
        await this.logDOMState('after_selector_attempt');
      }
      
      // STRATEGY 3: Enhanced keyboard fallback with multiple attempts
      if (!replyClicked) {
        console.log('🔄 REPLY_FALLBACK: Trying enhanced keyboard fallback...');
        try {
          // Click tweet to focus it
          await this.page.locator('article').first().click();
          await this.page.waitForTimeout(1500);
          
          // Try 'r' key multiple times (Twitter sometimes needs it)
          for (let i = 0; i < 3; i++) {
            await this.page.keyboard.press('r');
            
            // Use MutationObserver for better detection
            const composerOpened = await this.waitForComposerWithObserver(3000);
            if (composerOpened) {
              replyClicked = true;
              console.log(`✅ REPLY_FALLBACK: Keyboard retry ${i + 1} worked!`);
              break;
            }
          }
        } catch (e) {
          console.log('❌ REPLY_FALLBACK: Keyboard fallback failed');
        }
      }
      
      // STRATEGY 4: Try direct compose URL
      if (!replyClicked) {
        console.log('🔄 ULTIMATE_FALLBACK: Trying direct compose URL...');
        const directResult = await this.tryDirectComposeURL(replyToTweetId, content);
        if (directResult.success) {
          console.log('✅ ULTIMATE_FALLBACK: Direct compose URL succeeded!');
          return directResult;
        }
      }
      
      // STRATEGY 5: Try mobile interface (last resort)
      if (!replyClicked) {
        console.log('📱 ULTIMATE_FALLBACK: Trying mobile interface...');
        const mobileResult = await this.tryMobileInterface(replyToTweetId, content);
        if (mobileResult.success) {
          console.log('✅ ULTIMATE_FALLBACK: Mobile interface succeeded!');
          return mobileResult;
        }
      }
      
      if (!replyClicked) {
        // 🔬 FINAL DIAGNOSTIC: Comprehensive failure analysis
        console.log('❌ REPLY_FAILURE: ALL STRATEGIES FAILED');
        await this.logDOMState('final_failure');
        
        // 🔬 NEW: Capture full diagnostics for self-healing
        await this.captureFailureDiagnostics('reply_all_strategies_failed', replyToTweetId);
        
        // Take screenshot for debugging
        try {
          const screenshotPath = `/app/data/reply_fail_${Date.now()}.png`;
          await this.page.screenshot({ 
            path: screenshotPath,
            fullPage: true 
          });
          console.log(`📸 DEBUG: Reply failure screenshot saved to ${screenshotPath}`);
        } catch (e) {
          console.log('⚠️ DEBUG: Could not save screenshot');
        }
        
        // Log page HTML for debugging
        try {
          const html = await this.page.content();
          console.log(`📄 DEBUG: Page HTML length: ${html.length} characters`);
          // Log first 500 chars of body for debugging
          const bodyMatch = html.match(/<body[^>]*>([\s\S]{0,500})/);
          if (bodyMatch) {
            console.log(`📄 DEBUG: Body preview: ${bodyMatch[1].substring(0, 200)}...`);
          }
        } catch (e) {
          console.log('⚠️ DEBUG: Could not capture HTML');
        }
        
        return {
          success: false,
          error: 'Could not find or click reply button after trying 5 different strategies (keyboard shortcut, aggressive click, enhanced selectors, direct URL, mobile interface)'
        };
      }
      
      // Now use the standard posting logic
      console.log('📝 REPLY_POSTING: Reply composer opened, posting content...');
      
      // 🔧 FIX: Use special reply ID extraction that checks the thread
      const result = await this.findAndPost(content);
      
      // If posting succeeded but ID extraction failed, try reply-specific extraction
      if (result.success && !result.tweetId) {
        console.log('🔍 REPLY_ID_EXTRACTION: Standard extraction failed, trying reply-specific method...');
        const replyId = await this.extractReplyIdFromThread(replyToTweetId);
        if (replyId) {
          return { success: true, tweetId: replyId };
        }
      }
      
      return result;
      
    } catch (error: any) {
      console.log(`❌ REPLY_ERROR: ${error.message}`);
      return {
        success: false,
        error: `Reply failed: ${error.message}`
      };
    }
  }

  /**
   * 🔍 Extract reply tweet ID by checking the parent tweet's thread
   */
  private async extractReplyIdFromThread(parentTweetId: string): Promise<string | null> {
    try {
      console.log(`🔍 REPLY_THREAD_CHECK: Navigating to parent tweet ${parentTweetId} to find our reply...`);
      
      // Navigate to the parent tweet
      await this.page.goto(`https://x.com/i/status/${parentTweetId}`, { 
        waitUntil: 'domcontentloaded',
        timeout: 10000 
      });
      await this.page.waitForTimeout(3000);
      
      // Get expected username from env
      const expectedUsername = process.env.TWITTER_USERNAME?.replace('@', '') || 'Signal_Synapse';
      
      // Find all tweet articles on the page
      const articles = await this.page.$$('article[data-testid="tweet"]');
      console.log(`🔍 REPLY_THREAD_CHECK: Found ${articles.length} articles on page`);
      
      // Look for a recent tweet from our username (not the parent)
      for (const article of articles) {
        try {
          // Get the tweet ID from this article
          const link = await article.$('a[href*="/status/"]');
          if (!link) continue;
          
          const href = await link.getAttribute('href');
          if (!href) continue;
          
          const match = href.match(/\/status\/(\d+)/);
          if (!match) continue;
          
          const tweetId = match[1];
          
          // Skip if this is the parent tweet
          if (tweetId === parentTweetId) {
            console.log(`⏭️ REPLY_THREAD_CHECK: Skipping parent tweet ${tweetId}`);
            continue;
          }
          
          // Check if this tweet is from our username
          const usernameLink = await article.$(`a[href*="/${expectedUsername}"]`);
          if (usernameLink) {
            // Check if it's recent (posted within last minute)
            const timeElement = await article.$('time');
            if (timeElement) {
              const timeText = await timeElement.innerText().catch(() => '');
              if (timeText.includes('now') || timeText.includes('s') || timeText.includes('1m')) {
                console.log(`✅ REPLY_FOUND: Found our reply with ID ${tweetId} (timestamp: ${timeText})`);
                return tweetId;
              }
            }
          }
        } catch (e) {
          continue;
        }
      }
      
      console.log('❌ REPLY_THREAD_CHECK: Could not find our reply in the thread');
      return null;
      
    } catch (error) {
      console.error(`❌ REPLY_THREAD_CHECK failed: ${(error as Error).message}`);
      return null;
    }
  }
}

export default BulletproofTwitterComposer;
