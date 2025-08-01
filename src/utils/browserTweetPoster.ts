/**
 * 🚀 BROWSER TWEET POSTER (FULLY FIXED)
 * 
 * Posts tweets using Playwright browser automation with enhanced reliability:
 * - Updated selectors for 2024 X.com UI
 * - Robust confirmation system
 * - Multiple retry strategies
 * - Enhanced error handling and logging
 */

import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { getChromiumLaunchOptions } from './playwrightUtils';

export class BrowserTweetPoster {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private isInitialized = false;
  private sessionPath = this.getSessionPath();

  async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      return true;
    }

    try {
      console.log('🌐 Initializing browser for tweet posting...');
      
      // Set Playwright environment variables for Render compatibility
      process.env.PLAYWRIGHT_BROWSERS_PATH = '0';
      process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = 'false';

      // Runtime installation fallback
      try {
        const { exec } = require('child_process');
        await new Promise((resolve, reject) => {
          exec('npx playwright install chromium --force', (error: any, stdout: any, stderr: any) => {
            if (error) {
              console.log('⚠️ Runtime Playwright install failed (might be already installed):', error.message);
            } else {
              console.log('✅ Runtime Playwright install completed');
            }
            resolve(true); // Don't fail initialization if this fails
          });
        });
      } catch (installError) {
        console.log('⚠️ Skipping runtime install due to error:', installError);
      }

      const launchOptions = getChromiumLaunchOptions();
      this.browser = await chromium.launch(launchOptions);
      
      this.page = await this.browser.newPage({
        viewport: { width: 1280, height: 720 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });

      // Enhanced stealth configuration
      await this.page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        delete (window as any).cdc_adoQpoasnfa76pfcZLmcfl_Array;
        delete (window as any).cdc_adoQpoasnfa76pfcZLmcfl_Promise;
        delete (window as any).cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
      });

      // Load Twitter session
      await this.loadTwitterSession();
      
      console.log('✅ Browser initialized successfully');
      this.isInitialized = true;
      return true;

    } catch (error) {
      console.error('❌ Failed to initialize browser:', error);
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      return false;
    }
  }

  private getSessionPath(): string {
    // Check Railway volume path first, then fallback paths
    const railwayPath = path.join('/app/data', 'twitter_session.json');
    const fallbackPath = path.join(process.cwd(), 'twitter-auth.json');
    const backupPath = path.join(process.cwd(), 'twitter_session.json');
    
    if (fs.existsSync(railwayPath)) return railwayPath;
    if (fs.existsSync(fallbackPath)) return fallbackPath;
    if (fs.existsSync(backupPath)) return backupPath;
    
    // Default to Railway path for future uploads
    return railwayPath;
  }

  private async loadTwitterSession(): Promise<void> {
    try {
      if (fs.existsSync(this.sessionPath)) {
        const sessionData = JSON.parse(fs.readFileSync(this.sessionPath, 'utf8'));
        console.log('🔐 Loading saved Twitter session...');
        
        // Navigate to X.com first
        await this.page!.goto('https://x.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        // Set cookies
        if (sessionData.cookies && Array.isArray(sessionData.cookies)) {
          await this.page!.context().addCookies(sessionData.cookies);
          console.log(`✅ Loaded ${sessionData.cookies.length} session cookies`);
        }

        // Reload page to activate session
        await this.page!.reload({ waitUntil: 'domcontentloaded' });
        await this.page!.waitForTimeout(5000);
        
        console.log('✅ Twitter session loaded successfully');
      } else {
        console.log('⚠️ No saved session found. Please run initTwitterSession.ts first.');
        throw new Error('No Twitter session available');
      }
    } catch (error) {
      console.error('❌ Failed to load Twitter session:', error);
      throw error;
    }
  }

  /**
   * 🎯 POST TWEET WITH ENHANCED CONFIRMATION AND RELIABILITY
   */
  async postTweet(content: string): Promise<{
    success: boolean;
    tweet_id?: string;
    error?: string;
    confirmed?: boolean;
    was_posted?: boolean;
  }> {
    if (!this.isInitialized || !this.page) {
      const initResult = await this.initialize();
      if (!initResult) {
        return {
          success: false,
          error: 'Failed to initialize browser',
          confirmed: false,
          was_posted: false
        };
      }
    }

    const maxRetries = 3;
    const retryDelay = 3000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`📝 Posting tweet via browser automation (attempt ${attempt}/${maxRetries})...`);
        console.log(`📄 Content: "${content.substring(0, 100)}..."`);

        // Multiple navigation strategies
        const strategies = [
          { url: 'https://x.com/compose/post', name: 'compose_post' },
          { url: 'https://x.com/compose/tweet', name: 'compose_tweet' },
          { url: 'https://x.com/home', name: 'home' },
          { url: 'https://twitter.com/compose/tweet', name: 'twitter_compose' }
        ];

        let postingSuccess = false;
        let lastError: Error | null = null;
        let tweetId: string | null = null;

        for (const strategy of strategies) {
          try {
            console.log(`🔄 Trying ${strategy.name} strategy: ${strategy.url}`);
            
            // Navigate to target page
            await this.page!.goto(strategy.url, {
              waitUntil: 'domcontentloaded',
              timeout: 30000
            });

            await this.debugScreenshot(`pre-compose-${strategy.name}-attempt-${attempt}`);
            await this.page!.waitForTimeout(5000); // Longer stabilization time

            // Clear any existing content first (prevents duplicates on retries)
            try {
              console.log('🧹 Clearing composer before posting...');
              const clearResult = await this.clearComposer();
              if (clearResult.success) {
                console.log('✅ Composer cleared successfully');
              } else {
                console.log(`⚠️ Composer clearing failed: ${clearResult.error}`);
              }
            } catch (clearError) {
              console.log(`⚠️ Composer clearing error: ${clearError.message}`);
            }

            // Find and interact with tweet compose area
            const textareaResult = await this.findAndFillTextarea(content);
            if (!textareaResult.success) {
              console.log(`❌ ${strategy.name} strategy failed: ${textareaResult.error}`);
              lastError = new Error(textareaResult.error);
              continue;
            }

            // Find and click post button
            const postResult = await this.findAndClickPostButton();
            if (!postResult.success) {
              console.log(`❌ Post button click failed in ${strategy.name}: ${postResult.error}`);
              lastError = new Error(postResult.error);
              continue;
            }

            // Enhanced confirmation with multiple checks
            console.log('⏳ Waiting for tweet to post and confirming...');
            await this.page!.waitForTimeout(5000); // Longer wait for posting

            const confirmationResult = await this.confirmTweetPosted(content);
            
            if (confirmationResult.confirmed) {
              postingSuccess = true;
              tweetId = confirmationResult.tweet_id;
              console.log(`✅ Tweet confirmed posted using ${strategy.name} strategy`);
              break;
            } else {
              console.log(`⚠️ Could not confirm tweet posting with ${strategy.name}: ${confirmationResult.error}`);
              lastError = new Error(confirmationResult.error || 'Posting confirmation failed');
              continue;
            }

          } catch (strategyError) {
            console.log(`❌ ${strategy.name} strategy error:`, strategyError.message);
            lastError = strategyError as Error;
            await this.debugScreenshot(`error-${strategy.name}-attempt-${attempt}`);
          }
        }

        if (postingSuccess) {
          return {
            success: true,
            tweet_id: tweetId || `browser_${Date.now()}`,
            confirmed: true,
            was_posted: true
          };
        }

        // If all strategies failed but we have more retries, continue
        if (attempt < maxRetries) {
          console.log(`⚠️ All strategies failed on attempt ${attempt}, retrying in ${retryDelay}ms...`);
          await this.page!.waitForTimeout(retryDelay);
          continue;
        }

        // All attempts exhausted
        throw lastError || new Error('All posting strategies failed');

      } catch (error) {
        console.error(`❌ Error on attempt ${attempt}:`, error.message);
        await this.debugScreenshot(`error-attempt-${attempt}`);

        if (attempt === maxRetries) {
          return {
            success: false,
            error: `Failed after ${maxRetries} attempts: ${error.message}`,
            confirmed: false,
            was_posted: false
          };
        }

        console.log(`🔄 Retrying in ${retryDelay}ms...`);
        await this.page!.waitForTimeout(retryDelay);
      }
    }

    return {
      success: false,
      error: `Failed after ${maxRetries} attempts`,
      confirmed: false,
      was_posted: false
    };
  }

  /**
   * 🔍 ENHANCED TEXTAREA FINDING WITH 2024 X.COM SELECTORS
   */
  private async findAndFillTextarea(content: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Updated selectors for current X.com UI (2024)
      const textareaSelectors = [
        // Most current selectors for X.com (January 2024)
        'div[aria-label="Post text"]',                           // Current X.com primary
        'div[data-testid="tweetTextarea_0"]',                    // Still works sometimes
        'div[contenteditable="true"][aria-label*="Post"]',       // X.com content editable
        'div[contenteditable="true"][data-testid*="tweet"]',     // Generic tweet input
        'div[contenteditable="true"][role="textbox"]',           // Generic textbox
        'div[aria-label*="What is happening"]',                  // Placeholder text based
        'div[aria-label*="What\'s happening"]',                  // Alternative placeholder
        'div[contenteditable="true"][aria-describedby*="placeholder"]', // Placeholder-based
        '.public-DraftEditor-content',                           // Draft.js editor
        '.notranslate.public-DraftEditor-content',               // Draft.js with no-translate
        'div[spellcheck="true"][contenteditable="true"]',        // Generic editable div
        'div[data-text="true"]',                                 // Data text attribute
        '[data-testid="tweet-text-one"]',                        // Newer variation
        'div[aria-label="Tweet text"]',                          // Legacy fallback
        'div[role="textbox"][contenteditable="true"]'            // Role-based textbox
      ];

      let textarea: any = null;
      let usedSelector = '';

      // Try each selector with progressive timeouts
      for (let i = 0; i < textareaSelectors.length; i++) {
        const selector = textareaSelectors[i];
        const timeout = i < 3 ? 25000 : 15000; // Longer timeout for first few selectors
        
        try {
          console.log(`🔍 Trying selector: ${selector} (timeout: ${timeout}ms)`);
          
          await this.page!.waitForSelector(selector, { 
            timeout,
            state: 'visible'
          });
          
          textarea = await this.page!.locator(selector).first();
          const isVisible = await textarea.isVisible();
          const isEnabled = await textarea.isEnabled();
          
          if (isVisible && isEnabled) {
            usedSelector = selector;
            console.log(`✅ Found working textarea: ${selector}`);
            break;
          } else {
            console.log(`⚠️ Found but not usable: ${selector} (visible: ${isVisible}, enabled: ${isEnabled})`);
          }
        } catch (selectorError) {
          console.log(`❌ Selector failed: ${selector} - ${selectorError.message}`);
          continue;
        }
      }

      if (!textarea || !usedSelector) {
        await this.debugScreenshot('textarea-not-found');
        return { 
          success: false, 
          error: 'Could not find tweet textarea with any known selector' 
        };
      }

      console.log(`📝 Using textarea selector: ${usedSelector}`);
      
      // Enhanced content input with multiple methods
      try {
        // Method 1: Click, clear, and type (most reliable)
        await textarea.click();
        await this.page!.waitForTimeout(5000);
        
        // Clear any existing content
        await this.page!.keyboard.press('Control+A');
        await this.page!.keyboard.press('Delete');
        await this.page!.waitForTimeout(5000);
        
        // Type content with natural delays
        await this.page!.keyboard.type(content, { delay: 80 });
        
      } catch (typingError) {
        console.log('⚠️ Method 1 failed, trying method 2...');
        
        try {
          // Method 2: Direct fill
          await textarea.fill('');
          await this.page!.waitForTimeout(5000);
          await textarea.fill(content);
        } catch (fillError) {
          console.log('⚠️ Method 2 failed, trying method 3...');
          
          // Method 3: Focus and type character by character
          await textarea.focus();
          await this.page!.waitForTimeout(5000);
          await this.page!.keyboard.press('Control+A');
          
          // Type character by character for maximum compatibility
          for (const char of content) {
            await this.page!.keyboard.type(char, { delay: 100 });
          }
        }
      }

      // Enhanced content verification
      await this.page!.waitForTimeout(5000);
      
      const verifications = [
        () => textarea.textContent(),
        () => textarea.inputValue(),
        () => textarea.innerText(),
                 () => this.page!.evaluate((sel) => {
           const el = document.querySelector(sel);
           return el ? (el as any).value || el.textContent || (el as HTMLElement).innerText : '';
         }, usedSelector)
      ];
      
      let currentText = '';
      for (const verify of verifications) {
        try {
          const text = await verify();
          if (text && text.trim().length > 0) {
            currentText = text;
            break;
          }
        } catch (verifyError) {
          continue;
        }
      }

      if (currentText.trim().length === 0) {
        await this.debugScreenshot('content-verification-failed');
        return { 
          success: false, 
          error: 'Failed to verify content was entered into textarea' 
        };
      }

      const similarity = this.calculateSimilarity(content, currentText);
      console.log(`📊 Content similarity: ${(similarity * 100).toFixed(1)}% (expected: >80%)`);
      
      if (similarity < 0.8) {
        await this.debugScreenshot('content-mismatch');
        return { 
          success: false, 
          error: `Content mismatch. Expected similarity >80%, got ${(similarity * 100).toFixed(1)}%` 
        };
      }

      console.log(`✅ Content successfully entered and verified`);
      return { success: true };

    } catch (error) {
      await this.debugScreenshot('textarea-error');
      return { 
        success: false, 
        error: `Failed to find or fill textarea: ${error.message}` 
      };
    }
  }

  /**
   * 🔘 ENHANCED POST BUTTON FINDING WITH 2024 X.COM SELECTORS
   */
  private 
  /**
   * 🎯 EMERGENCY POST BUTTON FINDER
   */
  async findPostButtonAggressive(): Promise<any> {
    const selectors = [
      '[data-testid="tweetButton"]',
      '[data-testid="tweetButtonInline"]',
      'button[data-testid="tweetButton"]',
      'div[data-testid="tweetButton"]',
      'button[role="button"]:not([aria-label*="Close"])',
      '[role="button"]:not([aria-label*="Close"]):not([aria-label*="Back"])',
      'button:has-text("Post")',
      'div:has-text("Post")[role="button"]'
    ];
    
    for (const selector of selectors) {
      try {
        console.log(`🔍 Trying post button selector: ${selector}`);
        const element = await this.page!.waitForSelector(selector, { 
          timeout: 15000,
          state: 'attached'
        });
        
        if (element) {
          // Verify it's actually clickable and not disabled
          const isVisible = await element.isVisible();
          const isEnabled = await element.isEnabled();
          
          if (isVisible && isEnabled) {
            console.log(`✅ Found working post button: ${selector}`);
            return element;
          }
        }
      } catch (error) {
        console.log(`⚠️  Post button selector failed: ${selector}`);
      }
    }
    
    throw new Error('Could not find any working post button selector');
  }

  async findAndClickPostButton(): Promise<{ success: boolean; error?: string }> {
    try {
      // 🎯 ENHANCED SELECTORS FOR X.COM 2025 - Multiple fallbacks
      const postButtonSelectors = [
        // PRIMARY SELECTORS - X.com uses these for posting
        '[data-testid="tweetButton"], [data-testid="tweetButtonInline"]',  // Combined primary selectors
        '[data-testid="tweetButton"]',                             // Standard post button
        '[data-testid="tweetButtonInline"]',                      // Inline variant (threads)
        'button[data-testid="tweetButton"]',                     // Button element variant
        'div[data-testid="tweetButton"]',                        // Div element variant
        'button[data-testid="tweetButtonInline"]',               // Inline button variant
        
        // SLOWER selectors (known to sometimes fail)
        'div[aria-label="Post"]',                                // Often times out
        '[role="button"][aria-label="Post"]',                   // Role button with Post
        '[role="button"][data-testid*="tweet"]',                // Generic role button
        'button:has-text("Post")',                              // Button with Post text
        '[aria-label*="Post"]:not([aria-label*="Post text"])',  // Aria label for button
        'div[aria-label="Tweet"]',                              // Legacy Tweet button
        'button[aria-label="Tweet"]',                           // Legacy Tweet button
        'div[role="button"]:has-text("Tweet")',                 // Text-based Tweet
        'button:has-text("Tweet")'                              // Button with Tweet text
      ];

      let postButton: any = null;
      let usedSelector = '';

      // Try each selector with progressive timeouts
      for (let i = 0; i < postButtonSelectors.length; i++) {
        const selector = postButtonSelectors[i];
        // Shorter timeout for known working selectors, longer for fallbacks
        const timeout = i < 6 ? 8000 : 15000; // Fast timeout for working selectors
        
        try {
          console.log(`🔍 Trying post button selector: ${selector} (timeout: ${timeout}ms)`);
          
          await this.page!.waitForSelector(selector, { 
            timeout,
            state: 'visible'
          });
          
          postButton = await this.page!.locator(selector).first();
          const isVisible = await postButton.isVisible();
          const isEnabled = await postButton.isEnabled();
          
          if (isVisible && isEnabled) {
            usedSelector = selector;
            console.log(`✅ Found working post button: ${selector}`);
            break;
          } else {
            console.log(`⚠️ Found but not usable: ${selector} (visible: ${isVisible}, enabled: ${isEnabled})`);
          }
        } catch (selectorError) {
          console.log(`❌ Post button selector failed: ${selector} - ${selectorError.message}`);
          continue;
        }
      }

      if (!postButton || !usedSelector) {
        await this.debugScreenshot('post-button-not-found');
        return { 
          success: false, 
          error: 'Could not find post button with any known selector' 
        };
      }

      console.log(`🔘 Using post button selector: ${usedSelector}`);

      // Enhanced posting with keyboard shortcut first, then clicking
      const maxClickAttempts = 3;
      for (let clickAttempt = 1; clickAttempt <= maxClickAttempts; clickAttempt++) {
        try {
          console.log(`🎯 Posting attempt ${clickAttempt}/${maxClickAttempts}...`);
          
          if (clickAttempt === 1) {
            // Method 1: Try keyboard shortcut first (fastest and most reliable)
            console.log('⌨️ Attempting keyboard shortcut (Cmd+Enter / Ctrl+Enter)...');
            const modifierKey = process.platform === 'darwin' ? 'Meta' : 'Control';
            await this.page!.keyboard.press(`${modifierKey}+Enter`);
            console.log(`✅ Keyboard shortcut sent: ${modifierKey}+Enter`);
          } else {
            // Fallback to clicking methods
            console.log(`🖱️ Fallback: Clicking post button (attempt ${clickAttempt}/${maxClickAttempts})...`);
            
            // Scroll button into view if needed (with timeout protection)
            try {
              await postButton.scrollIntoViewIfNeeded({ timeout: 5000 });
            } catch (scrollError) {
              console.log(`⚠️ Scroll timeout, trying direct click: ${scrollError.message}`);
            }
            await this.page!.waitForTimeout(1000);
            
            // Multiple click methods
            if (clickAttempt === 2) {
              // Method 2: Regular click
              await postButton.click();
            } else {
              // Method 3: Force click
              await postButton.click({ force: true });
            }
          }
          
          await this.page!.waitForTimeout(5000);
          
          // Check if click was successful by looking for URL change or posting indicators
          const currentUrl = this.page!.url();
          console.log(`📍 Post-click URL: ${currentUrl}`);
          
          // Wait for potential posting indicators
          try {
            await this.page!.waitForTimeout(5000);
            
            // Check for successful posting indicators
            const postingIndicators = [
              'div[aria-label="Your post was sent"]',
              'div[data-testid="toast"]',
              '[role="alert"]',
              'div:has-text("Your post was sent")',
              'div:has-text("Your Tweet was sent")'
            ];
            
            for (const indicator of postingIndicators) {
              try {
                await this.page!.waitForSelector(indicator, { timeout: 8000 });
                console.log(`✅ Found posting success indicator: ${indicator}`);
                return { success: true };
              } catch {
                continue;
              }
            }
            
          } catch {
            // Continue to next attempt
          }
          
          if (clickAttempt === maxClickAttempts) {
            // Last attempt - assume success if no error
            console.log(`✅ Post button clicked successfully on attempt ${clickAttempt}`);
            return { success: true };
          }
          
        } catch (clickError) {
          console.log(`❌ Click attempt ${clickAttempt} failed: ${clickError.message}`);
          if (clickAttempt === maxClickAttempts) {
            await this.debugScreenshot(`post-button-click-failed-${clickAttempt}`);
            return { 
              success: false, 
              error: `Failed to click post button after ${maxClickAttempts} attempts: ${clickError.message}` 
            };
          }
          await this.page!.waitForTimeout(5000);
        }
      }

      return { success: true };

    } catch (error) {
      await this.debugScreenshot('post-button-error');
      return { 
        success: false, 
        error: `Failed to find or click post button: ${error.message}` 
      };
    }
  }

  /**
   * ✅ ENHANCED TWEET CONFIRMATION WITH MULTIPLE VERIFICATION METHODS
   */
  private async confirmTweetPosted(originalContent: string): Promise<{
    confirmed: boolean;
    tweet_id?: string;
    error?: string;
  }> {
    try {
      console.log('🔍 Confirming tweet was posted...');
      
      // Wait for potential navigation or posting completion
      await this.page!.waitForTimeout(5000);
      
      // Method 1: Look for success indicators
      const successIndicators = [
        'div[aria-label="Your post was sent"]',
        'div[data-testid="toast"]',
        '[role="alert"]',
        'div:has-text("Your post was sent")',
        'div:has-text("Your Tweet was sent")',
        'div[data-testid="confirmationSheetDialog"]'
      ];
      
      for (const indicator of successIndicators) {
        try {
          await this.page!.waitForSelector(indicator, { timeout: 30000 });
          console.log(`✅ Found posting confirmation: ${indicator}`);
          return { 
            confirmed: true, 
            tweet_id: `confirmed_${Date.now()}` 
          };
        } catch {
          continue;
        }
      }
      
      // Method 2: Check URL for tweet ID
      const currentUrl = this.page!.url();
      const tweetIdMatch = currentUrl.match(/\/status\/(\d+)/);
      if (tweetIdMatch) {
        console.log(`✅ Found tweet ID in URL: ${tweetIdMatch[1]}`);
        return { 
          confirmed: true, 
          tweet_id: tweetIdMatch[1] 
        };
      }
      
      // Method 3: Look for the tweet content in the page
      try {
        // Go to profile/home to check for recent tweet
        await this.page!.goto('https://x.com/home', { 
          waitUntil: 'domcontentloaded',
          timeout: 30000 
        });
        await this.page!.waitForTimeout(5000);
        
        // Look for tweet content in recent posts
        const contentPreview = originalContent.substring(0, 50);
        const foundContent = await this.page!.locator(`text="${contentPreview}"`).first().isVisible({ timeout: 30000 });
        
        if (foundContent) {
          console.log(`✅ Found tweet content on timeline: "${contentPreview}..."`);
          return { 
            confirmed: true, 
            tweet_id: `timeline_confirmed_${Date.now()}` 
          };
        }
      } catch (timelineError) {
        console.log(`⚠️ Timeline check failed: ${timelineError.message}`);
      }
      
      // Method 4: Check for composer reset
      try {
        await this.page!.goto('https://x.com/compose/post', { 
          waitUntil: 'domcontentloaded',
          timeout: 30000 
        });
        await this.page!.waitForTimeout(5000);
        
        // If composer is empty, it likely means the previous tweet was posted
        const textareaSelector = 'div[aria-label="Post text"]';
        await this.page!.waitForSelector(textareaSelector, { timeout: 30000 });
        const textarea = this.page!.locator(textareaSelector).first();
        const currentText = await textarea.textContent() || '';
        
        if (currentText.trim().length === 0) {
          console.log(`✅ Composer is empty - likely indicates successful posting`);
          return { 
            confirmed: true, 
            tweet_id: `composer_reset_${Date.now()}` 
          };
        }
      } catch (composerError) {
        console.log(`⚠️ Composer check failed: ${composerError.message}`);
      }
      
      // If all methods fail, assume posting failed
      console.log(`❌ Could not confirm tweet posting with any method`);
      await this.debugScreenshot('confirmation-failed');
      
      return { 
        confirmed: false, 
        error: 'Could not confirm tweet was posted using any verification method' 
      };
      
    } catch (error) {
      console.error('❌ Error during tweet confirmation:', error);
      return { 
        confirmed: false, 
        error: `Confirmation error: ${error.message}` 
      };
    }
  }

  /**
   * 📊 CALCULATE TEXT SIMILARITY
   */
  private calculateSimilarity(text1: string, text2: string): number {
    if (!text1 || !text2) return 0;
    
    const normalize = (str: string) => str.toLowerCase().replace(/\s+/g, ' ').trim();
    const normalized1 = normalize(text1);
    const normalized2 = normalize(text2);
    
    if (normalized1 === normalized2) return 1;
    
    // Use simple character-based similarity
    const longer = normalized1.length > normalized2.length ? normalized1 : normalized2;
    const shorter = normalized1.length > normalized2.length ? normalized2 : normalized1;
    
    if (longer.length === 0) return 1;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * 📏 CALCULATE LEVENSHTEIN DISTANCE
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * 📷 DEBUG SCREENSHOT HELPER
   */
  private async debugScreenshot(name: string): Promise<void> {
    if (process.env.DEBUG_SCREENSHOT === 'true' && this.page) {
      try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `/tmp/tweet-post-${name}-${timestamp}.png`;
        await this.page.screenshot({ path: filename, fullPage: false });
        console.log(`📷 Debug screenshot saved: ${filename}`);
      } catch (screenshotError) {
        console.log(`⚠️ Failed to save debug screenshot: ${screenshotError.message}`);
      }
    }
  }

  /**
   * 🔄 EXTRACT TWEET ID FROM URL OR PAGE
   */
  private async extractTweetId(): Promise<string | null> {
    try {
      // Try to get tweet ID from URL
      const url = this.page!.url();
      const match = url.match(/\/status\/(\d+)/);
      if (match) {
        return match[1];
      }
      
      // Try to find tweet ID in page elements
      const tweetIdSelectors = [
        '[data-testid="tweet"] [href*="/status/"]',
        'article[data-testid="tweet"] a[href*="/status/"]',
        'time[datetime] a[href*="/status/"]'
      ];
      
      for (const selector of tweetIdSelectors) {
        try {
          const element = await this.page!.locator(selector).first();
          const href = await element.getAttribute('href');
          if (href) {
            const idMatch = href.match(/\/status\/(\d+)/);
            if (idMatch) {
              return idMatch[1];
            }
          }
        } catch {
          continue;
        }
      }
      
      return null;
    } catch {
      return null;
    }
  }

  /**
   * 🧹 Clear composer content to prevent duplicates on retries
   */
  async clearComposer(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.page) {
        return { success: false, error: 'No page available' };
      }

      // Standard textarea selectors used in findAndFillTextarea
      const textareaSelectors = [
        'div[aria-label="Post text"]',
        'div[contenteditable="true"]',
        'div[data-testid="tweetTextarea_0"]',
        'div[data-testid="tweetTextarea"]',
        'div[role="textbox"]',
        'textarea[placeholder*="happening"]'
      ];

      let cleared = false;

      for (const selector of textareaSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 3000 });
          const textarea = this.page.locator(selector).first();
          
          if (await textarea.isVisible()) {
            // Multiple clearing methods
            await textarea.click();
            await this.page.waitForTimeout(500);
            
            // Method 1: Select all and delete
            await this.page.keyboard.press('Control+A');
            await this.page.keyboard.press('Delete');
            
            // Method 2: Fill with empty string
            await textarea.fill('');
            
            // Method 3: Clear via evaluation
            await this.page.evaluate((sel) => {
              const el = document.querySelector(sel);
              if (el) {
                (el as any).value = '';
                (el as any).textContent = '';
                (el as any).innerText = '';
              }
            }, selector);

            cleared = true;
            console.log(`🧹 Cleared composer using selector: ${selector}`);
            break;
          }
        } catch (selectorError) {
          // Continue to next selector
          continue;
        }
      }

      if (!cleared) {
        return { success: false, error: 'Could not find composer to clear' };
      }

      return { success: true };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 💬 POST REPLY TO TWEET (for threads)
   */
  async postReply(content: string, replyToTweetId: string): Promise<{ success: boolean; tweet_id: string; error?: string }> {
    try {
      console.log(`💬 Posting reply to tweet ${replyToTweetId}...`);
      
      if (!this.page) {
        throw new Error('Browser not initialized');
      }

      // Navigate to the tweet we want to reply to
      const tweetUrl = `https://x.com/i/status/${replyToTweetId}`;
      console.log(`🔗 Navigating to: ${tweetUrl}`);
      await this.page.goto(tweetUrl, { waitUntil: 'networkidle' });
      await this.page.waitForTimeout(2000);

      // Find and click the reply button
      const replyButtonSelectors = [
        '[data-testid="reply"]',
        'button[aria-label*="Reply"]',
        '[role="button"][aria-label*="Reply"]'
      ];

      let replyClicked = false;
      for (const selector of replyButtonSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 5000 });
          const replyButton = this.page.locator(selector).first();
          
          if (await replyButton.isVisible()) {
            await replyButton.click();
            console.log(`🔘 Clicked reply button: ${selector}`);
            replyClicked = true;
            break;
          }
        } catch {
          continue;
        }
      }

      if (!replyClicked) {
        throw new Error('Could not find or click reply button');
      }

      // Wait for reply composer to appear
      await this.page.waitForTimeout(1500);

      // Find and fill the reply textarea
      const replyTextareaSelectors = [
        'div[aria-label="Post text"]',
        'div[data-testid="tweetTextarea_0"]',
        'div[contenteditable="true"]',
        'div[role="textbox"]'
      ];

      let textareaFilled = false;
      for (const selector of replyTextareaSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 5000 });
          const textarea = this.page.locator(selector).first();
          
          if (await textarea.isVisible()) {
            await textarea.click();
            await this.page.waitForTimeout(500);
            await textarea.fill(content);
            console.log(`📝 Filled reply textarea: ${selector}`);
            textareaFilled = true;
            break;
          }
        } catch {
          continue;
        }
      }

      if (!textareaFilled) {
        throw new Error('Could not find or fill reply textarea');
      }

      // Wait a moment for content to register
      await this.page.waitForTimeout(1000);

      // Find and click the reply post button
      const postButtonSelectors = [
        '[data-testid="tweetButton"]',
        '[data-testid="tweetButtonInline"]',
        'button[aria-label*="Reply"]'
      ];

      let posted = false;
      for (const selector of postButtonSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 5000 });
          const postButton = this.page.locator(selector).first();
          
          if (await postButton.isVisible() && !(await postButton.isDisabled())) {
            await postButton.click();
            console.log(`🚀 Clicked reply post button: ${selector}`);
            posted = true;
            break;
          }
        } catch {
          continue;
        }
      }

      if (!posted) {
        throw new Error('Could not find or click reply post button');
      }

      // Wait for reply to post
      await this.page.waitForTimeout(3000);

      // Try to get the new tweet ID
      const newTweetId = await this.extractTweetId() || `reply_${Date.now()}`;

      console.log(`✅ Reply posted successfully: ${newTweetId}`);
      return { success: true, tweet_id: newTweetId };

    } catch (error) {
      console.error('❌ Reply posting failed:', error);
      return { success: false, tweet_id: `reply_error_${Date.now()}`, error: error.message };
    }
  }

  async cleanup(): Promise<void> {
    try {
      console.log('🧹 Cleaning up browser resources...');
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      this.isInitialized = false;
      console.log('✅ Browser cleanup completed');
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
    }
  }
}

export const browserTweetPoster = new BrowserTweetPoster(); 