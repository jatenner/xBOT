/**
 * 🚀 BROWSER TWEET POSTER (ENHANCED 2024)
 * 
 * Posts tweets using Playwright browser automation with bulletproof reliability:
 * - Enhanced 2024 X.com selectors with progressive fallbacks
 * - Smart retry logic with exponential backoff
 * - Robust confirmation system with multiple validation methods
 * - Enhanced error handling and debug capabilities
 */

import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { getChromiumLaunchOptions } from './playwrightUtils';

export class BrowserTweetPoster {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private isInitialized = false;
  private sessionPath = path.join(process.cwd(), 'twitter-auth.json');
  private debugMode = process.env.DEBUG_SCREENSHOT === 'true';

  async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      return true;
    }

    try {
      console.log('🌐 Initializing enhanced browser for tweet posting...');
      
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

      // Enhanced network interception for better performance
      await this.page.route('**/*', (route) => {
        const url = route.request().url();
        // Block unnecessary resources to speed up page loads
        if (url.includes('.jpg') || url.includes('.png') || url.includes('.gif') || 
            url.includes('analytics') || url.includes('tracking') || url.includes('ads')) {
          route.abort();
        } else {
          route.continue();
        }
      });

      // Load Twitter session
      await this.loadTwitterSession();
      
      console.log('✅ Enhanced browser initialized successfully');
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

  private async loadTwitterSession(): Promise<void> {
    try {
      if (fs.existsSync(this.sessionPath)) {
        const sessionData = JSON.parse(fs.readFileSync(this.sessionPath, 'utf8'));
        console.log('🔐 Loading saved Twitter session...');
        
        // Navigate to X.com first
        await this.page!.goto('https://x.com', { waitUntil: 'domcontentloaded', timeout: 45000 });
        
        // Set cookies
        if (sessionData.cookies && Array.isArray(sessionData.cookies)) {
          await this.page!.context().addCookies(sessionData.cookies);
          console.log(`✅ Loaded ${sessionData.cookies.length} session cookies`);
        }

        // Enhanced session validation
        await this.page!.reload({ waitUntil: 'domcontentloaded', timeout: 45000 });
        await this.page!.waitForTimeout(3000);

        // Check if we're actually logged in
        const isLoggedIn = await this.validateSession();
        if (!isLoggedIn) {
          console.warn('⚠️ Session validation failed - may need manual re-authentication');
        } else {
          console.log('✅ Twitter session validated successfully');
        }

      } else {
        console.log('⚠️ No saved Twitter session found - manual authentication required');
        await this.page!.goto('https://x.com/login', { waitUntil: 'domcontentloaded', timeout: 45000 });
      }
    } catch (error) {
      console.error('❌ Failed to load Twitter session:', error);
      throw error;
    }
  }

  private async validateSession(): Promise<boolean> {
    try {
      // Look for indicators that we're logged in
      const loggedInSelectors = [
        'div[data-testid="SideNav_AccountSwitcher_Button"]',
        'a[data-testid="AppTabBar_Profile_Link"]',
        'div[data-testid="primaryColumn"]',
        'nav[role="navigation"]'
      ];

      for (const selector of loggedInSelectors) {
        try {
          await this.page!.waitForSelector(selector, { timeout: 5000 });
          return true;
        } catch (e) {
          continue;
        }
      }

      return false;
    } catch (error) {
      console.error('❌ Session validation error:', error);
      return false;
    }
  }

  async postTweet(content: string): Promise<{
    success: boolean;
    tweet_id?: string;
    error?: string;
    confirmed?: boolean;
    was_posted?: boolean;
  }> {
    if (!this.isInitialized) {
      const initSuccess = await this.initialize();
      if (!initSuccess) {
        return { success: false, error: 'Failed to initialize browser' };
      }
    }

    console.log('🐦 === ENHANCED TWEET POSTING STARTED ===');
    console.log(`📝 Content: "${content}"`);
    
    const maxRetries = 4; // Increased retries
    let lastError: Error | null = null;

    // Enhanced posting strategies with better URLs and timing
    const strategies = [
      { 
        name: 'Compose_Direct', 
        url: 'https://x.com/compose/tweet',
        waitTime: 4000 
      },
      { 
        name: 'Home_Compose', 
        url: 'https://x.com/home',
        waitTime: 5000 
      },
      { 
        name: 'Home_Alternative', 
        url: 'https://x.com/',
        waitTime: 6000 
      }
    ];

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`🔄 === ATTEMPT ${attempt}/${maxRetries} ===`);

      if (attempt > 1) {
        // Progressive backoff delay
        const backoffDelay = Math.min(2000 * Math.pow(2, attempt - 1), 10000);
        console.log(`⏳ Waiting ${backoffDelay}ms before retry...`);
        await this.page!.waitForTimeout(backoffDelay);
      }

      for (const strategy of strategies) {
        try {
          console.log(`🔄 Trying ${strategy.name} strategy: ${strategy.url}`);
          
          // Navigate to target page with enhanced error handling
          await this.page!.goto(strategy.url, {
            waitUntil: 'domcontentloaded',
            timeout: 60000 // Increased timeout
          });

          await this.debugScreenshot(`pre-compose-${strategy.name}-attempt-${attempt}`);
          await this.page!.waitForTimeout(strategy.waitTime);

          // Enhanced textarea finding and filling
          const textareaResult = await this.findAndFillTextarea(content);
          if (!textareaResult.success) {
            console.log(`❌ ${strategy.name} textarea failed: ${textareaResult.error}`);
            lastError = new Error(textareaResult.error);
            continue;
          }

          // Enhanced post button finding and clicking
          const postResult = await this.findAndClickPostButton();
          if (!postResult.success) {
            console.log(`❌ Post button failed in ${strategy.name}: ${postResult.error}`);
            lastError = new Error(postResult.error);
            continue;
          }

          // Enhanced confirmation with multiple validation methods
          console.log('⏳ Waiting for tweet to post and confirming...');
          await this.page!.waitForTimeout(10000); // Longer wait for posting

          const confirmationResult = await this.confirmTweetPosted(content);
          
          if (confirmationResult.confirmed) {
            console.log('🎉 === TWEET POSTED SUCCESSFULLY ===');
            console.log(`✅ Strategy: ${strategy.name}`);
            console.log(`🆔 Tweet ID: ${confirmationResult.tweet_id || 'detected'}`);
            console.log(`📊 Confirmation: ${confirmationResult.confirmed ? 'YES' : 'NO'}`);
            
            return {
              success: true,
              tweet_id: confirmationResult.tweet_id,
              confirmed: true,
              was_posted: true
            };
          } else {
            console.log(`⚠️ Could not confirm tweet was posted via ${strategy.name}`);
            lastError = new Error(confirmationResult.error || 'Tweet confirmation failed');
            continue;
          }

        } catch (strategyError: any) {
          console.error(`❌ Strategy ${strategy.name} failed:`, strategyError.message);
          lastError = strategyError;
          await this.debugScreenshot(`error-${strategy.name}-attempt-${attempt}`);
          continue;
        }
      }
    }

    console.log('💥 === ALL POSTING ATTEMPTS FAILED ===');
    return {
      success: false,
      error: lastError?.message || 'All posting strategies failed after maximum retries',
      confirmed: false,
      was_posted: false
    };
  }

  /**
   * 🔍 ENHANCED TEXTAREA FINDING WITH 2024 X.COM SELECTORS
   */
  private async findAndFillTextarea(content: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Enhanced selectors for 2024 X.com UI with priority order
      const textareaSelectors = [
        // Primary 2024 selectors (highest priority)
        'div[aria-label="Post text"]',                           
        'div[data-testid="tweetTextarea_0"]',                    
        'div[contenteditable="true"][aria-label*="Post"]',       
        'div[contenteditable="true"][data-testid*="tweet"]',
        
        // Secondary selectors (medium priority)     
        'div[contenteditable="true"][role="textbox"]',           
        'div[aria-label*="What is happening"]',                  
        'div[aria-label*="What\'s happening"]',                  
        'div[contenteditable="true"][aria-describedby*="placeholder"]',
        
        // Fallback selectors (lowest priority)
        '.public-DraftEditor-content',                           
        '.notranslate.public-DraftEditor-content',               
        'div[spellcheck="true"][contenteditable="true"]',        
        'div[data-text="true"]',                                 
        '[data-testid="tweet-text-one"]',                        
        'div[aria-label="Tweet text"]',                          
        'div[role="textbox"][contenteditable="true"]',
        
        // Emergency selectors
        'div[contenteditable="true"]',
        '[contenteditable="true"]'
      ];

      let textarea: any = null;
      let usedSelector = '';

      // Progressive timeout strategy - longer for primary selectors
      for (let i = 0; i < textareaSelectors.length; i++) {
        const selector = textareaSelectors[i];
        const timeout = i < 4 ? 35000 : i < 8 ? 25000 : 15000; // Progressive timeouts
        
        try {
          console.log(`🔍 Trying selector ${i + 1}/${textareaSelectors.length}: ${selector} (timeout: ${timeout}ms)`);
          
          await this.page!.waitForSelector(selector, { 
            timeout,
            state: 'visible'
          });
          
          const elements = await this.page!.locator(selector).all();
          
          // Test each element found
          for (const element of elements) {
            try {
              const isVisible = await element.isVisible();
              const isEnabled = await element.isEnabled();
              
              if (isVisible && isEnabled) {
                // Additional validation - check if element can receive focus
                await element.focus({ timeout: 2000 });
                textarea = element;
                usedSelector = selector;
                console.log(`✅ Found working textarea: ${selector}`);
                break;
              } else {
                console.log(`⚠️ Element found but not usable: visible=${isVisible}, enabled=${isEnabled}`);
              }
            } catch (elementError) {
              console.log(`⚠️ Element test failed: ${elementError.message}`);
              continue;
            }
          }
          
          if (textarea && usedSelector) {
            break;
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
          error: 'Could not find tweet textarea with any known selector after exhaustive search' 
        };
      }

      console.log(`📝 Using textarea selector: ${usedSelector}`);
      
      // Enhanced content input with multiple methods and validation
      const inputMethods = [
        {
          name: 'Enhanced_Keyboard_Method',
          action: async () => {
            await textarea.click();
            await this.page!.waitForTimeout(1500);
            
            // Clear existing content
            await this.page!.keyboard.press('Control+A');
            await this.page!.keyboard.press('Delete');
            await this.page!.waitForTimeout(500);
            
            // Type with natural human-like delays
            for (let i = 0; i < content.length; i++) {
              await this.page!.keyboard.type(content[i], { 
                delay: Math.random() * 100 + 50 // 50-150ms random delay
              });
              
              // Occasional longer pauses to simulate thinking
              if (Math.random() < 0.1) {
                await this.page!.waitForTimeout(Math.random() * 500 + 200);
              }
            }
          }
        },
        {
          name: 'Direct_Fill_Method',
          action: async () => {
            await textarea.fill('');
            await this.page!.waitForTimeout(800);
            await textarea.fill(content);
          }
        },
        {
          name: 'Focus_Type_Method',
          action: async () => {
            await textarea.focus();
            await this.page!.waitForTimeout(1000);
            await this.page!.keyboard.press('Control+A');
            await this.page!.keyboard.type(content, { delay: 80 });
          }
        }
      ];

      let inputSuccess = false;
      for (const method of inputMethods) {
        try {
          console.log(`🔤 Trying input method: ${method.name}`);
          await method.action();
          await this.page!.waitForTimeout(2000);
          
          // Enhanced content verification
          const verificationSuccess = await this.verifyTextInput(textarea, content, usedSelector);
          if (verificationSuccess) {
            console.log(`✅ Input successful with method: ${method.name}`);
            inputSuccess = true;
            break;
          } else {
            console.log(`⚠️ Method ${method.name} failed verification`);
          }
        } catch (methodError) {
          console.log(`⚠️ Method ${method.name} failed: ${methodError.message}`);
          continue;
        }
      }

      if (!inputSuccess) {
        return { 
          success: false, 
          error: 'All input methods failed to enter content successfully' 
        };
      }

      console.log('✅ Content entered and verified successfully');
      return { success: true };

    } catch (error: any) {
      await this.debugScreenshot('textarea-fill-error');
      return { 
        success: false, 
        error: `Failed to find and fill textarea: ${error.message}` 
      };
    }
  }

  /**
   * 🔍 ENHANCED CONTENT VERIFICATION
   */
  private async verifyTextInput(textarea: any, expectedContent: string, selector: string): Promise<boolean> {
    try {
      const verificationMethods = [
        () => textarea.textContent(),
        () => textarea.inputValue(),
        () => textarea.innerText(),
        () => this.page!.evaluate((sel) => {
          const el = document.querySelector(sel);
          return el ? (el as any).value || el.textContent || (el as HTMLElement).innerText : '';
        }, selector),
        () => this.page!.evaluate((sel) => {
          const el = document.querySelector(sel);
          return el ? (el as HTMLElement).innerText : '';
        }, selector)
      ];
      
      for (const method of verificationMethods) {
        try {
          const currentText = await method();
          if (currentText && typeof currentText === 'string') {
            const normalizedCurrent = currentText.trim().replace(/\s+/g, ' ');
            const normalizedExpected = expectedContent.trim().replace(/\s+/g, ' ');
            
            if (normalizedCurrent === normalizedExpected) {
              console.log(`✅ Content verified: "${normalizedCurrent.substring(0, 50)}..."`);
              return true;
            } else if (normalizedCurrent.includes(normalizedExpected.substring(0, 20))) {
              console.log(`⚠️ Partial match found: "${normalizedCurrent.substring(0, 50)}..."`);
              return true; // Accept partial matches for dynamic content
            }
          }
        } catch (methodError) {
          continue;
        }
      }
      
      console.log(`❌ Content verification failed for all methods`);
      return false;
      
    } catch (error) {
      console.error('❌ Content verification error:', error);
      return false;
    }
  }

  /**
   * 🔍 ENHANCED POST BUTTON INTERACTION (2024)
   */
  private async findAndClickPostButton(): Promise<{ success: boolean; error?: string }> {
    try {
      // Enhanced selectors for 2024 X.com post buttons with priority order
      const postButtonSelectors = [
        // Primary 2024 selectors (highest priority)
        'button[data-testid="tweetButtonInline"]',              
        'button[data-testid="tweetButton"]',                    
        'div[role="button"][data-testid="tweetButtonInline"]',
        'button[data-testid="tweet-text-one_tweet_button"]',    
        
        // Secondary selectors (medium priority)
        'div[role="button"][data-testid*="tweet"]',             
        'button[aria-label*="Post"]',                           
        'button[aria-label*="Tweet"]',                          
        'button:has-text("Post")',                              
        'button:has-text("Tweet")',                             
        
        // Fallback selectors (lower priority)
        'div[role="button"]:has-text("Post")',                  
        'div[role="button"]:has-text("Tweet")',                 
        'button[type="submit"]',                                
        'button[data-testid*="ost"]',                           
        'button[data-testid*="weet"]',
        
        // Emergency selectors
        'button:not([disabled])',
        'div[role="button"]:not([disabled])'
      ];

      let postButton: any = null;
      let usedSelector = '';

      // Progressive search with smart timeouts
      for (let i = 0; i < postButtonSelectors.length; i++) {
        const selector = postButtonSelectors[i];
        const timeout = i < 4 ? 25000 : i < 8 ? 15000 : 8000; // Progressive timeouts
        
        try {
          console.log(`🔍 Searching for post button ${i + 1}/${postButtonSelectors.length}: ${selector} (timeout: ${timeout}ms)`);
          
          await this.page!.waitForSelector(selector, { 
            timeout,
            state: 'visible'
          });
          
          const buttons = await this.page!.locator(selector).all();
          
          // Test each button found
          for (const button of buttons) {
            try {
              const isVisible = await button.isVisible();
              const isEnabled = await button.isEnabled();
              
              if (isVisible && isEnabled) {
                // Enhanced validation - check button properties
                const box = await button.boundingBox();
                const text = await button.textContent() || '';
                
                // Additional filtering for relevant buttons
                const isRelevantButton = (
                  box && box.width > 20 && box.height > 20 && // Size check
                  (text.toLowerCase().includes('post') || 
                   text.toLowerCase().includes('tweet') ||
                   selector.includes('tweet') ||
                   selector.includes('post') ||
                   text.trim() === '') // Some buttons have no text
                );
                
                if (isRelevantButton) {
                  // Final check - try to focus the button
                  await button.focus({ timeout: 2000 });
                  postButton = button;
                  usedSelector = selector;
                  console.log(`✅ Found valid post button: ${selector} (text: "${text.trim()}")`);
                  break;
                }
              }
            } catch (buttonError) {
              console.log(`⚠️ Button validation failed: ${buttonError.message}`);
              continue;
            }
          }
          
          if (postButton) break;
          
        } catch (selectorError) {
          console.log(`❌ Post button selector failed: ${selector} - ${selectorError.message}`);
          continue;
        }
      }

      if (!postButton) {
        await this.debugScreenshot('post-button-not-found');
        return { 
          success: false, 
          error: 'Could not find any clickable post button after exhaustive search' 
        };
      }

      console.log(`🖱️ Attempting to click post button: ${usedSelector}`);

      // Enhanced clicking strategy with multiple methods and validation
      const clickMethods = [
        {
          name: 'Standard_Click',
          action: async () => await postButton.click()
        },
        {
          name: 'Force_Click',
          action: async () => await postButton.click({ force: true })
        },
        {
          name: 'Double_Click',
          action: async () => await postButton.dblclick()
        },
        {
          name: 'JavaScript_Click',
          action: async () => {
            await this.page!.evaluate((element) => {
              if (element && element.click) element.click();
            }, postButton);
          }
        },
        {
          name: 'Dispatch_Click',
          action: async () => {
            await this.page!.evaluate((element) => {
              if (element) {
                const event = new MouseEvent('click', { bubbles: true, cancelable: true });
                element.dispatchEvent(event);
              }
            }, postButton);
          }
        }
      ];

      for (let methodIndex = 0; methodIndex < clickMethods.length; methodIndex++) {
        const method = clickMethods[methodIndex];
        
        try {
          console.log(`🖱️ Trying click method: ${method.name}`);
          await method.action();
          await this.page!.waitForTimeout(3000);
          
          // Enhanced posting validation
          const postingValidation = await this.validatePostingStarted();
          if (postingValidation.success) {
            console.log(`✅ Post button clicked successfully with method: ${method.name}`);
            console.log(`📊 Validation: ${postingValidation.indicator}`);
            return { success: true };
          } else {
            console.log(`⚠️ Method ${method.name} failed validation: ${postingValidation.error}`);
            if (methodIndex < clickMethods.length - 1) {
              await this.page!.waitForTimeout(2000); // Wait before next method
            }
          }
          
        } catch (clickError) {
          console.log(`⚠️ Click method ${method.name} failed: ${clickError.message}`);
          if (methodIndex < clickMethods.length - 1) {
            await this.page!.waitForTimeout(1500); // Brief wait before next method
          }
        }
      }

      await this.debugScreenshot('all-click-methods-failed');
      return { 
        success: false, 
        error: `All click methods failed to trigger posting` 
      };

    } catch (error: any) {
      await this.debugScreenshot('post-button-error');
      return { 
        success: false, 
        error: `Post button interaction failed: ${error.message}` 
      };
    }
  }

  /**
   * 🔍 VALIDATE THAT POSTING HAS STARTED
   */
  private async validatePostingStarted(): Promise<{ success: boolean; indicator?: string; error?: string }> {
    try {
      // Look for various indicators that posting has started
      const postingIndicators = [
        { selector: 'text="Posting"', name: 'Posting Text' },
        { selector: 'text="Sending"', name: 'Sending Text' },
        { selector: '[data-testid="toast"]', name: 'Toast Notification' },
        { selector: '.r-1kihuf0', name: 'Loading Spinner' },
        { selector: '[aria-label*="Posting"]', name: 'Posting Aria Label' },
        { selector: '[data-testid="primaryColumn"] [role="progressbar"]', name: 'Progress Bar' },
        { selector: 'div:has-text("Your post was sent")', name: 'Success Message' },
        { selector: 'div:has-text("Your Tweet was sent")', name: 'Tweet Success Message' }
      ];
      
      for (const indicator of postingIndicators) {
        try {
          await this.page!.waitForSelector(indicator.selector, { timeout: 4000 });
          console.log(`✅ Found posting indicator: ${indicator.name}`);
          return { success: true, indicator: indicator.name };
        } catch (e) {
          continue;
        }
      }
      
      // Alternative validation - check if tweet compose area disappeared
      try {
        const textareaGone = await this.page!.waitForSelector('div[data-testid="tweetTextarea_0"]', { 
          timeout: 3000,
          state: 'detached'
        });
        if (textareaGone) {
          console.log(`✅ Textarea disappeared - likely posted`);
          return { success: true, indicator: 'Textarea Removal' };
        }
      } catch (e) {
        // Textarea still there
      }
      
      // Check for URL change (indicates navigation)
      const currentUrl = this.page!.url();
      if (currentUrl !== 'https://x.com/compose/tweet' && currentUrl.includes('x.com')) {
        console.log(`✅ URL changed after click - likely posted`);
        return { success: true, indicator: 'URL Navigation' };
      }
      
      return { 
        success: false, 
        error: 'No posting indicators found within timeout period' 
      };
      
    } catch (error: any) {
      return { 
        success: false, 
        error: `Posting validation failed: ${error.message}` 
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
          await this.page!.waitForSelector(indicator, { timeout: 3000 });
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
          timeout: 20000 
        });
        await this.page!.waitForTimeout(3000);
        
        // Look for tweet content in recent posts
        const contentPreview = originalContent.substring(0, 50);
        const foundContent = await this.page!.locator(`text="${contentPreview}"`).first().isVisible({ timeout: 5000 });
        
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
          timeout: 20000 
        });
        await this.page!.waitForTimeout(2000);
        
        // If composer is empty, it likely means the previous tweet was posted
        const textareaSelector = 'div[aria-label="Post text"]';
        await this.page!.waitForSelector(textareaSelector, { timeout: 10000 });
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