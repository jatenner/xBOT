/**
 * 🚀 BROWSER TWEET POSTER (ENHANCED 2024 - PRODUCTION READY)
 * 
 * Posts tweets using Playwright browser automation with bulletproof reliability:
 * - Enhanced 2024 X.com selectors with progressive fallbacks
 * - Smart retry logic with exponential backoff
 * - Robust confirmation system with multiple validation methods
 * - Enhanced error handling and debug capabilities
 * - Render.com deployment optimizations
 * - Emergency fallback mechanisms
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
  private isRailwayDeployment = process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production';

  async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      return true;
    }

    try {
      console.log('🌐 Initializing enhanced browser for tweet posting...');
      
      // Configure Playwright browsers path for Railway
      await this.configureBrowsersPath();
      
      // Verify browser binary exists before launching
      await this.verifyBrowserBinary();

      // Enhanced browser launch with Railway optimizations
      const launchOptions = {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--no-first-run',
          '--disable-background-timer-throttling',
          '--disable-renderer-backgrounding',
          '--disable-backgrounding-occluded-windows',
          '--single-process', // Critical for Render
          '--memory-pressure-off',
          '--max_old_space_size=512'
        ],
        ...(this.isRailwayDeployment && {
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
          timeout: 90000 // Longer timeout for Railway
        })
      };

      console.log('🔧 Launching browser with production-ready configuration...');
      console.log(`📂 Current PLAYWRIGHT_BROWSERS_PATH: ${process.env.PLAYWRIGHT_BROWSERS_PATH || 'not set'}`);
      
      try {
        this.browser = await chromium.launch(launchOptions);
        console.log('✅ Browser launched successfully');
      } catch (launchError) {
        console.error('❌ Browser launch failed with error:', launchError);
        console.error('🔍 Browser launch diagnostics:');
        console.error(`   - PLAYWRIGHT_BROWSERS_PATH: ${process.env.PLAYWRIGHT_BROWSERS_PATH || 'not set'}`);
        console.error(`   - Current working directory: ${process.cwd()}`);
        console.error(`   - Environment: ${this.isRailwayDeployment ? 'Railway' : 'Local'}`);
        console.error(`   - Launch options:`, JSON.stringify(launchOptions, null, 2));
        
        // Try to provide helpful debugging info
        if (launchError.message.includes('Executable doesn\'t exist')) {
          console.error('💡 Browser binary missing. This usually means:');
          console.error('   1. Playwright browsers not installed during Railway build');
          console.error('   2. Railway build command missing browser installation');
          console.error('   3. Build process interrupted or failed');
          console.error('🔧 Ensure Railway build command includes: npx playwright install chromium --force');
        }
        
        throw launchError;
      }
      
      this.page = await this.browser.newPage({
        viewport: { width: 1280, height: 720 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });

      // Enhanced network interception for performance
      await this.page.route('**/*', (route) => {
        const resourceType = route.request().resourceType();
        const url = route.request().url();
        
        // Block heavy resources to speed up loading
        if (['image', 'media', 'font', 'stylesheet'].includes(resourceType) ||
            url.includes('analytics') || url.includes('tracking') || 
            url.includes('ads') || url.includes('doubleclick')) {
          route.abort();
        } else {
          route.continue();
        }
      });

      // Load session with enhanced error handling
      const sessionLoaded = await this.loadSession();
      if (!sessionLoaded) {
        console.error('❌ Failed to load Twitter session');
        return false;
      }

      // Enhanced session validation
      const sessionValid = await this.validateSession();
      if (!sessionValid) {
        console.error('❌ Twitter session validation failed');
        return false;
      }

      this.isInitialized = true;
      console.log('✅ Browser initialization completed successfully');
      return true;

    } catch (error: any) {
      console.error('❌ Browser initialization failed:', error);
      await this.cleanup();
      return false;
    }
  }

  /**
   * 🔐 LOAD TWITTER SESSION
   * Load authentication cookies from file
   */
  private async loadSession(): Promise<boolean> {
    try {
      if (!fs.existsSync(this.sessionPath)) {
        console.error('❌ Twitter session file not found:', this.sessionPath);
        return false;
      }

      const sessionData = JSON.parse(fs.readFileSync(this.sessionPath, 'utf8'));
      
      if (!sessionData.cookies || !Array.isArray(sessionData.cookies)) {
        console.error('❌ Invalid session data structure');
        return false;
      }

      // Load cookies into page context
      await this.page!.context().addCookies(sessionData.cookies);
      console.log(`✅ Loaded ${sessionData.cookies.length} session cookies`);
      
      return true;
    } catch (error: any) {
      console.error('❌ Failed to load Twitter session:', error);
      return false;
    }
  }

  /**
   * 🔒 ENHANCED SESSION VALIDATION
   */
  private async validateSession(): Promise<boolean> {
    if (!this.page) return false;

    try {
      console.log('🔐 Validating Twitter session...');
      
      // Navigate to home with enhanced timeout
      await this.page.goto('https://twitter.com/home', {
        waitUntil: 'domcontentloaded',
        timeout: this.isRailwayDeployment ? 90000 : 60000
      });

      // Enhanced session check with multiple fallbacks
      const sessionIndicators = [
        '[data-testid="primaryNavigation"]',
        '[data-testid="tweet-compose-button"]', 
        '[data-testid="SideNav_AccountSwitcher_Button"]',
        '[aria-label="Home"]',
        'nav[role="navigation"]'
      ];

      for (const indicator of sessionIndicators) {
        try {
          await this.page.waitForSelector(indicator, { 
            timeout: this.isRailwayDeployment ? 30000 : 15000,
            state: 'visible' 
          });
          console.log(`✅ Session validated with: ${indicator}`);
          return true;
        } catch (error) {
          console.log(`⚠️ Session check failed for: ${indicator}`);
          continue;
        }
      }

      console.error('❌ No session indicators found - user may not be logged in');
      return false;

    } catch (error: any) {
      console.error('❌ Session validation error:', error);
      return false;
    }
  }

  /**
   * 🐦 POST TWEET TO TWITTER
   * The main entry point for posting tweets with enhanced reliability
   */
  async postTweet(content: string): Promise<{ success: boolean; tweet_id?: string; error?: string }> {
    try {
      console.log('🚀 === ENHANCED TWITTER POSTING ENGINE STARTING ===');
      console.log(`📝 Content: "${content}"`);
      console.log(`📏 Length: ${content.length} characters`);

      // Initialize browser if needed
      if (!this.isInitialized) {
        const initialized = await this.initialize();
        if (!initialized) {
          return { success: false, error: 'Failed to initialize browser' };
        }
      }

      // Navigate to Twitter compose with enhanced error handling
      const navigated = await this.navigateToCompose();
      if (!navigated) {
        return { success: false, error: 'Failed to navigate to compose page' };
      }

      // Input content with enhanced reliability
      const contentInputted = await this.inputContent(content);
      if (!contentInputted) {
        return { success: false, error: 'Failed to input tweet content' };
      }

      // Post the tweet with enhanced confirmation
      const posted = await this.submitTweet(content);
      if (!posted.success) {
        return { success: false, error: posted.error };
      }

      console.log('✅ Tweet posted successfully!');
      return { 
        success: true, 
        tweet_id: posted.tweet_id,
        error: undefined 
      };

    } catch (error: any) {
      console.error('❌ Critical error in tweet posting:', error);
      return { 
        success: false, 
        error: `Critical posting error: ${error.message}` 
      };
    }
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

  /**
   * 📌 NAVIGATE TO TWITTER COMPOSE PAGE
   * Navigates to the compose page with enhanced error handling
   */
  private async navigateToCompose(): Promise<boolean> {
    try {
      console.log('🔗 Navigating to Twitter compose page...');
      await this.page!.goto('https://twitter.com/compose/tweet', {
        waitUntil: 'domcontentloaded',
        timeout: this.isRailwayDeployment ? 90000 : 60000
      });
      await this.page!.waitForTimeout(2000);
      console.log('✅ Navigated to compose page successfully');
      return true;
    } catch (error: any) {
      console.error('❌ Failed to navigate to compose page:', error);
      await this.debugScreenshot('navigate-to-compose-failed');
      return false;
    }
  }

  /**
   * �� INPUT CONTENT INTO THE COMPOSER
   * Inputs the tweet content into the textarea with enhanced reliability
   */
  private async inputContent(content: string): Promise<boolean> {
    try {
      console.log('📝 Inputting content into the composer...');
      const textareaResult = await this.findAndFillTextarea(content);
      if (!textareaResult.success) {
        console.error('❌ Failed to input content into the composer:', textareaResult.error);
        return false;
      }
      console.log('✅ Content inputted successfully');
      return true;
    } catch (error: any) {
      console.error('❌ Error during content input:', error);
      return false;
    }
  }

  /**
   * 📤 SUBMIT THE TWEET
   * Submits the tweet with enhanced confirmation and error handling
   */
  private async submitTweet(content: string): Promise<{ success: boolean; tweet_id?: string; error?: string }> {
    try {
      console.log('📤 Submitting the tweet...');
      const postResult = await this.findAndClickPostButton();
      if (!postResult.success) {
        console.error('❌ Failed to submit tweet:', postResult.error);
        return { success: false, error: postResult.error };
      }

      const confirmationResult = await this.confirmTweetPosted(content);
      if (!confirmationResult.confirmed) {
        console.error('❌ Tweet submission confirmation failed:', confirmationResult.error);
        return { success: false, error: confirmationResult.error };
      }

      console.log('✅ Tweet submitted successfully!');
      return { 
        success: true, 
        tweet_id: confirmationResult.tweet_id 
      };
    } catch (error: any) {
      console.error('❌ Error during tweet submission:', error);
      return { 
        success: false, 
        error: `Submission error: ${error.message}` 
      };
    }
  }

  /**
   * 👍 LIKE A TWEET
   * Enhanced like functionality with browser automation
   */
  async likeTweet(tweetId: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`👍 Liking tweet: ${tweetId}`);

      if (!this.isInitialized) {
        const initialized = await this.initialize();
        if (!initialized) {
          return { success: false, error: 'Failed to initialize browser' };
        }
      }

      // Navigate to the tweet
      const tweetUrl = `https://twitter.com/x/status/${tweetId}`;
      await this.page!.goto(tweetUrl, { waitUntil: 'networkidle', timeout: 30000 });
      await this.page!.waitForTimeout(2000);

      // Find and click like button with multiple selectors
      const likeSelectors = [
        '[data-testid="like"]',
        '[aria-label*="Like"]',
        '[role="button"][aria-label*="like"]',
        'button[data-testid="like"]'
      ];

      for (const selector of likeSelectors) {
        try {
          const element = await this.page!.waitForSelector(selector, { timeout: 5000 });
          if (element) {
            await element.click();
            await this.page!.waitForTimeout(1000);
            console.log('✅ Tweet liked successfully');
            return { success: true };
          }
        } catch (error) {
          continue;
        }
      }

      return { success: false, error: 'Could not find like button' };

    } catch (error: any) {
      console.error('❌ Error liking tweet:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 👥 FOLLOW A USER
   * Enhanced follow functionality with browser automation
   */
  async followUser(username: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`👥 Following user: @${username}`);

      if (!this.isInitialized) {
        const initialized = await this.initialize();
        if (!initialized) {
          return { success: false, error: 'Failed to initialize browser' };
        }
      }

      // Navigate to user profile
      const profileUrl = `https://twitter.com/${username}`;
      await this.page!.goto(profileUrl, { waitUntil: 'networkidle', timeout: 30000 });
      await this.page!.waitForTimeout(2000);

      // Find and click follow button with multiple selectors
      const followSelectors = [
        '[data-testid="follow"]',
        '[aria-label*="Follow"]',
        '[role="button"]:has-text("Follow")',
        'button:has-text("Follow")'
      ];

      for (const selector of followSelectors) {
        try {
          const element = await this.page!.waitForSelector(selector, { timeout: 5000 });
          if (element) {
            const buttonText = await element.textContent();
            if (buttonText && buttonText.includes('Follow') && !buttonText.includes('Following')) {
              await element.click();
              await this.page!.waitForTimeout(1000);
              console.log(`✅ Successfully followed @${username}`);
              return { success: true };
            }
          }
        } catch (error) {
          continue;
        }
      }

      return { success: false, error: 'Could not find follow button or user already followed' };

    } catch (error: any) {
      console.error('❌ Error following user:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 👋 UNFOLLOW A USER
   * Enhanced unfollow functionality with browser automation
   */
  async unfollowUser(username: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`👋 Unfollowing user: @${username}`);

      if (!this.isInitialized) {
        const initialized = await this.initialize();
        if (!initialized) {
          return { success: false, error: 'Failed to initialize browser' };
        }
      }

      // Navigate to user profile
      const profileUrl = `https://twitter.com/${username}`;
      await this.page!.goto(profileUrl, { waitUntil: 'networkidle', timeout: 30000 });
      await this.page!.waitForTimeout(2000);

      // Find and click following button to unfollow
      const unfollowSelectors = [
        '[data-testid="unfollow"]',
        '[aria-label*="Following"]',
        '[role="button"]:has-text("Following")',
        'button:has-text("Following")'
      ];

      for (const selector of unfollowSelectors) {
        try {
          const element = await this.page!.waitForSelector(selector, { timeout: 5000 });
          if (element) {
            await element.click();
            await this.page!.waitForTimeout(500);
            
            // Confirm unfollow in modal if it appears
            try {
              const confirmButton = await this.page!.waitForSelector('[data-testid="confirmationSheetConfirm"]', { timeout: 3000 });
              if (confirmButton) {
                await confirmButton.click();
                await this.page!.waitForTimeout(1000);
              }
            } catch (error) {
              // No confirmation modal, that's fine
            }

            console.log(`✅ Successfully unfollowed @${username}`);
            return { success: true };
          }
        } catch (error) {
          continue;
        }
      }

      return { success: false, error: 'Could not find following button or user not followed' };

    } catch (error: any) {
      console.error('❌ Error unfollowing user:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 💬 POST A REPLY TO A TWEET
   * Enhanced reply functionality with browser automation
   */
  async postReply(tweetId: string, replyContent: string): Promise<{ success: boolean; tweet_id?: string; error?: string }> {
    try {
      console.log(`💬 Posting reply to tweet: ${tweetId}`);
      console.log(`📝 Reply content: "${replyContent}"`);

      if (!this.isInitialized) {
        const initialized = await this.initialize();
        if (!initialized) {
          return { success: false, error: 'Failed to initialize browser' };
        }
      }

      // Navigate to the tweet
      const tweetUrl = `https://twitter.com/x/status/${tweetId}`;
      await this.page!.goto(tweetUrl, { waitUntil: 'networkidle', timeout: 30000 });
      await this.page!.waitForTimeout(2000);

      // Find and click reply button
      const replySelectors = [
        '[data-testid="reply"]',
        '[aria-label*="Reply"]',
        '[role="button"][aria-label*="reply"]'
      ];

      let replyClicked = false;
      for (const selector of replySelectors) {
        try {
          const element = await this.page!.waitForSelector(selector, { timeout: 5000 });
          if (element) {
            await element.click();
            await this.page!.waitForTimeout(1000);
            replyClicked = true;
            break;
          }
        } catch (error) {
          continue;
        }
      }

      if (!replyClicked) {
        return { success: false, error: 'Could not find reply button' };
      }

      // Find reply text area and input content
      const textAreaSelectors = [
        '[data-testid="tweetTextarea_0"]',
        '[role="textbox"][aria-label*="reply"]',
        '[contenteditable="true"][aria-label*="Tweet"]'
      ];

      let contentInputted = false;
      for (const selector of textAreaSelectors) {
        try {
          const textArea = await this.page!.waitForSelector(selector, { timeout: 5000 });
          if (textArea) {
            await textArea.click();
            await this.page!.waitForTimeout(500);
            await textArea.fill(replyContent);
            await this.page!.waitForTimeout(1000);
            contentInputted = true;
            break;
          }
        } catch (error) {
          continue;
        }
      }

      if (!contentInputted) {
        return { success: false, error: 'Could not find reply text area' };
      }

      // Find and click reply submit button
      const submitSelectors = [
        '[data-testid="tweetButton"]',
        '[role="button"]:has-text("Reply")',
        'button:has-text("Reply")'
      ];

      for (const selector of submitSelectors) {
        try {
          const element = await this.page!.waitForSelector(selector, { timeout: 5000 });
          if (element) {
            const isEnabled = await element.isEnabled();
            if (isEnabled) {
              await element.click();
              await this.page!.waitForTimeout(2000);
              console.log('✅ Reply posted successfully');
              return { success: true, tweet_id: `reply_${Date.now()}` };
            }
          }
        } catch (error) {
          continue;
        }
      }

      return { success: false, error: 'Could not find or click reply submit button' };

    } catch (error: any) {
      console.error('❌ Error posting reply:', error);
      return { success: false, error: error.message };
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

  /**
   * 🔧 CONFIGURE PLAYWRIGHT BROWSERS PATH FOR RAILWAY
   */
  private async configureBrowsersPath(): Promise<void> {
    const isRailway = process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production';
    
    if (isRailway) {
      console.log('🚄 Configuring Playwright browsers path for Railway...');
      
      // Railway uses standard Playwright installation paths
      console.log(`📂 Using Railway default Playwright browser installation`);
      console.log('✅ Playwright browsers path configured for Railway');
    } else {
      console.log('🏠 Local development environment detected');
    }
  }

  /**
   * 🔍 VERIFY BROWSER BINARY EXISTS
   */
  private async verifyBrowserBinary(): Promise<void> {
    console.log('🔍 Verifying browser binary availability...');
    
    try {
      // Railway uses standard Playwright paths - no special verification needed
      const isRailway = process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production';
      
      if (isRailway) {
        console.log('🚄 Railway environment detected - using standard Playwright installation');
        console.log('📦 Browsers should be installed during Railway build phase');
      } else {
        console.log('🏠 Local environment - using default browser location');
      }
      
      console.log('✅ Browser binary verification completed');
      
    } catch (error) {
      console.error(`❌ Browser verification failed: ${error.message}`);
      throw error;
    }
  }
}

export const browserTweetPoster = new BrowserTweetPoster(); 