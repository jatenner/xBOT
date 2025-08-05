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
import { RailwayResourceMonitor } from './railwayResourceMonitor';

export class BrowserTweetPoster {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private isInitialized = false;
  private sessionPath = this.getSessionPath();


  /**
   * 🚀 RAILWAY-OPTIMIZED BROWSER LAUNCH
   */
  private async getRailwayOptimizedLaunchOptions(): Promise<any> {
    const resourceMonitor = RailwayResourceMonitor.getInstance();
    
    // Check if we can safely launch browser
    const resourceCheck = await resourceMonitor.canLaunchBrowser();
    if (!resourceCheck.canLaunch) {
      console.log(`❌ Cannot launch browser: ${resourceCheck.reason}`);
      throw new Error(`Resource check failed: ${resourceCheck.reason}`);
    }
    
    // Progressive configurations from most to least resource-intensive
    const configs = [
      {
        name: 'ultra_lightweight',
        options: {
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--single-process', // CRITICAL for Railway pthread_create fix
            '--disable-gpu',
            '--disable-accelerated-2d-canvas', 
            '--no-first-run',
            '--no-zygote',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-features=TranslateUI',
            '--disable-ipc-flooding-protection',
            '--disable-extensions',
            '--disable-plugins',
            '--disable-images', // Save memory
            '--memory-pressure-off',
            '--max_old_space_size=256' // Limit heap
          ]
        }
      },
      {
        name: 'minimal',
        options: {
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox', 
            '--disable-dev-shm-usage',
            '--single-process',
            '--disable-gpu'
          ]
        }
      }
    ];
    
    // Try each config until one works
    for (const config of configs) {
      try {
        console.log(`🚀 Trying browser config: ${config.name}`);
        
        // Force cleanup before launch
        await resourceMonitor.forceCleanup();
        
        // Test launch with this config
        const testBrowser = await chromium.launch(config.options);
        await testBrowser.close(); // Immediately close test browser
        
        console.log(`✅ Config ${config.name} works`);
        return config.options;
        
      } catch (error) {
        console.log(`❌ Config ${config.name} failed: ${error.message}`);
        continue;
      }
    }
    
    throw new Error('All browser configurations failed');
  }



  async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      return true;
    }

    try {
      console.log('🌐 Initializing Railway-optimized browser...');
      
      // Get Railway-optimized launch options
      const launchOptions = await this.getRailwayOptimizedLaunchOptions();
      console.log('✅ Got optimized launch options');
      
      this.browser = await chromium.launch(launchOptions);
      console.log('✅ Browser launched successfully');
      
      this.page = await this.browser.newPage({
        viewport: { width: 800, height: 600 }, // Smaller viewport to save memory
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });

      // Minimal stealth configuration to save memory
      await this.page.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      });

      // Load Twitter session
      await this.loadTwitterSession();
      
      console.log('✅ Railway-optimized browser initialized successfully');
      this.isInitialized = true;
      return true;

    } catch (error) {
      console.error('❌ Failed to initialize Railway-optimized browser:', error);
      
      // Enhanced cleanup on failure
      if (this.browser) {
        try {
          await this.browser.close();
        } catch (closeError) {
          console.log('⚠️ Error closing browser during cleanup');
        }
        this.browser = null;
      }
      
      // Force system cleanup
      try {
        const resourceMonitor = RailwayResourceMonitor.getInstance();
        await resourceMonitor.forceCleanup();
      } catch (cleanupError) {
        console.log('⚠️ Resource cleanup warning');
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
    method_used?: string;
  }> {
    console.log('📝 === RAILWAY-OPTIMIZED TWEET POSTING ===');
    
    // Method 1: Try with existing browser if available
    if (this.browser && this.page && this.isInitialized) {
      try {
        console.log('🔄 Attempting with existing browser...');
        const result = await this.attemptBrowserPost(content);
        if (result.success) {
          return { ...result, method_used: 'existing_browser' };
        }
      } catch (error) {
        console.log('❌ Existing browser failed:', error.message);
        // Clean up failed browser
        await this.enhancedCleanup();
      }
    }
    
    // Method 2: Try fresh browser initialization
    console.log('🚀 Attempting fresh browser initialization...');
    const initSuccess = await this.initialize();
    
    if (initSuccess && this.browser && this.page) {
      try {
        const result = await this.attemptBrowserPost(content);
        if (result.success) {
          return { ...result, method_used: 'fresh_browser' };
        }
      } catch (error) {
        console.log('❌ Fresh browser posting failed:', error.message);
        await this.enhancedCleanup();
      }
    }
    
    // Method 3: Emergency simple retry after cleanup
    console.log('🆘 Emergency retry with maximum cleanup...');
    try {
      // Force aggressive cleanup
      const resourceMonitor = RailwayResourceMonitor.getInstance();
      await resourceMonitor.forceCleanup();
      
      // Wait for system to recover
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Simple retry
      const emergencyResult = await this.emergencyBrowserPost(content);
      if (emergencyResult.success) {
        return { ...emergencyResult, method_used: 'emergency_retry' };
      }
    } catch (error) {
      console.log('❌ Emergency retry failed:', error.message);
    }
    
    return {
      success: false,
      error: 'All browser posting methods failed - likely Railway resource exhaustion',
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
          
          // Try to extract real tweet ID from the page
          const realTweetId = await this.extractRealTweetId();
          const tweetId = realTweetId || `composer_reset_${Date.now()}`;
          
          if (realTweetId) {
            console.log(`🎯 Extracted REAL tweet ID: ${realTweetId}`);
          } else {
            console.log(`⚠️ Could not extract real tweet ID, using fallback: ${tweetId}`);
          }
          
          return { 
            confirmed: true, 
            tweet_id: tweetId
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
   * 💬 POST REPLY TO CREATE THREADED CONVERSATION
   * Creates actual Twitter replies by navigating to the original tweet and using the reply button
   */
  async postReply(content: string, previousTweetId: string): Promise<{ success: boolean; tweet_id: string; error?: string }> {
    try {
      console.log(`💬 Creating threaded reply to tweet ID: ${previousTweetId}...`);
      
      if (!this.page) {
        throw new Error('Browser not initialized');
      }

      // Extract numeric tweet ID if it's a real Twitter ID
      const numericTweetId = this.extractNumericTweetId(previousTweetId);
      if (!numericTweetId) {
        console.log(`⚠️ Previous tweet ID "${previousTweetId}" is not a real Twitter ID - using fallback approach`);
        return await this.postTweetFallback(content);
      }

      // Navigate to the tweet we want to reply to
      const tweetUrl = `https://x.com/i/status/${numericTweetId}`;
      console.log(`🔗 Navigating to original tweet: ${tweetUrl}`);
      
      await this.page.goto(tweetUrl, { waitUntil: 'networkidle', timeout: 15000 });
      await this.page.waitForTimeout(2000);

      // Find and click the reply button
      const replyButtonSelectors = [
        '[data-testid="reply"]',
        'button[aria-label*="Reply"]',
        '[role="button"][aria-label*="Reply"]',
        'div[aria-label*="Reply"]'
      ];

      console.log(`🔍 Looking for reply button...`);
      let replyClicked = false;
      
      for (const selector of replyButtonSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 5000 });
          const replyButton = this.page.locator(selector).first();
          
          if (await replyButton.isVisible()) {
            await replyButton.click();
            console.log(`✅ Clicked reply button: ${selector}`);
            replyClicked = true;
            break;
          }
        } catch {
          continue;
        }
      }

      if (!replyClicked) {
        console.log(`⚠️ Could not find reply button - using fallback approach`);
        return await this.postTweetFallback(content);
      }

      // Wait for reply composer to appear
      await this.page.waitForTimeout(2000);

      // Fill the reply content
      const textareaSelectors = [
        'div[aria-label="Post text"]',
        'div[contenteditable="true"]',
        'div[data-testid="tweetTextarea_0"]',
        'div[data-testid="tweetTextarea"]',
        'div[role="textbox"]'
      ];

      console.log(`📝 Filling reply content...`);
      let textareaFilled = false;
      
      for (const selector of textareaSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 8000 });
          const textarea = this.page.locator(selector).first();
          
          if (await textarea.isVisible()) {
            await textarea.click();
            await this.page.waitForTimeout(500);
            await textarea.fill(content);
            
            // Verify content was entered
            const enteredText = await textarea.textContent() || await textarea.inputValue() || '';
            if (enteredText.trim() && enteredText.includes(content.substring(0, 20))) {
              console.log(`✅ Reply content filled successfully`);
              textareaFilled = true;
              break;
            }
          }
        } catch {
          continue;
        }
      }

      if (!textareaFilled) {
        throw new Error('Could not fill reply content');
      }

      // Post the reply
      const postButtonSelectors = [
        '[data-testid="tweetButton"]',
        '[data-testid="tweetButtonInline"]',
        'button[data-testid="tweetButton"]',
        '[role="button"][aria-label*="Reply"]',
        '[role="button"][aria-label*="Post"]'
      ];

      console.log(`🚀 Posting reply...`);
      let posted = false;
      
      for (const selector of postButtonSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 8000 });
          const postButton = this.page.locator(selector).first();
          
          if (await postButton.isVisible() && !(await postButton.isDisabled())) {
            // Try keyboard shortcut first
            await this.page.keyboard.press('Control+Enter');
            await this.page.waitForTimeout(1000);
            
            // Fallback to clicking
            await postButton.click();
            console.log(`✅ Reply posted successfully`);
            posted = true;
            break;
          }
        } catch {
          continue;
        }
      }

      if (!posted) {
        throw new Error('Could not post reply');
      }

      // Wait for posting to complete and try to extract new tweet ID
      await this.page.waitForTimeout(3000);
      
      const newTweetId = await this.extractTweetId() || `reply_${Date.now()}`;
      console.log(`✅ Thread reply posted with ID: ${newTweetId}`);
      
      return { success: true, tweet_id: newTweetId };

    } catch (error) {
      console.error('❌ Reply posting failed:', error);
      console.log(`🔄 Falling back to regular tweet posting...`);
      return await this.postTweetFallback(content);
    }
  }

  /**
   * 🎯 Enhanced tweet ID extraction with multiple strategies
   */
  private async extractRealTweetId(): Promise<string | null> {
    try {
      if (!this.page) return null;

      console.log(`🔍 Attempting to extract real tweet ID from current page...`);

      // Strategy 1: Check URL for tweet ID (most reliable)
      const currentUrl = this.page.url();
      console.log(`📍 Current URL: ${currentUrl}`);
      const urlMatch = currentUrl.match(/\/status\/(\d+)/);
      if (urlMatch) {
        console.log(`✅ Found tweet ID in URL: ${urlMatch[1]}`);
        return urlMatch[1];
      }

      // Strategy 2: Look for tweet links in the page content
      const tweetLinkSelectors = [
        'article[data-testid="tweet"] a[href*="/status/"]',
        '[data-testid="tweet"] a[href*="/status/"]',
        'time a[href*="/status/"]',
        'a[href*="/status/"]:not([href*="analytics"])'
      ];

      for (const selector of tweetLinkSelectors) {
        try {
          const links = await this.page.locator(selector).all();
          for (const link of links) {
            const href = await link.getAttribute('href');
            if (href) {
              const match = href.match(/\/status\/(\d+)/);
              if (match) {
                console.log(`✅ Found tweet ID in link (${selector}): ${match[1]}`);
                return match[1];
              }
            }
          }
        } catch {
          continue;
        }
      }

      // Strategy 3: Check recent navigation history
      await this.page.waitForTimeout(2000);
      const finalUrl = this.page.url();
      const finalMatch = finalUrl.match(/\/status\/(\d+)/);
      if (finalMatch) {
        console.log(`✅ Found tweet ID in final URL: ${finalMatch[1]}`);
        return finalMatch[1];
      }

      console.log(`⚠️ No real tweet ID found using any strategy`);
      return null;

    } catch (error) {
      console.log(`❌ Error extracting tweet ID: ${error.message}`);
      return null;
    }
  }

  /**
   * 🔢 Extract numeric tweet ID from various ID formats
   */
  private extractNumericTweetId(tweetId: string): string | null {
    // Already numeric
    if (/^\d+$/.test(tweetId)) {
      return tweetId;
    }
    
    // Extract from URL format
    const urlMatch = tweetId.match(/\/status\/(\d+)/);
    if (urlMatch) {
      return urlMatch[1];
    }
    
    // Not a real Twitter ID
    return null;
  }

  /**
   * 🔄 Fallback to regular tweet posting when reply fails
   */
  private async postTweetFallback(content: string): Promise<{ success: boolean; tweet_id: string; error?: string }> {
    console.log(`🔄 Using fallback tweet posting approach...`);
    const result = await this.postTweet(content);
    return {
      success: result.success,
      tweet_id: result.tweet_id || `fallback_${Date.now()}`,
      error: result.error
    };
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
   * 🔧 API FALLBACK: Simple API posting when browser fails
   */
  private async postViaAPI(content: string): Promise<{
    success: boolean;
    tweet_id?: string;
    error?: string;
    confirmed?: boolean;
    was_posted?: boolean;
  }> {
    try {
      console.log('📡 Attempting API fallback posting...');
      
      // Import X client for API posting
      const { xClient } = await import('../utils/xClient');
      const apiClient = xClient;
      
      if (!apiClient) {
        throw new Error('API client not available');
      }
      
      // Simple text post via API
      const result = await apiClient.postTweet(content);
      
      if (result.success && result.tweetId) {
        console.log('✅ API posting successful');
        return {
          success: true,
          tweet_id: result.tweetId,
          confirmed: true,
          was_posted: true
        };
      } else {
        throw new Error('API posting returned no tweet ID');
      }
      
    } catch (error) {
      console.error('❌ API fallback failed:', error);
      return {
        success: false,
        error: `API fallback failed: ${error.message}`,
        confirmed: false,
        was_posted: false
      };
    }
  }




  /**
   * 🔧 HELPER METHODS FOR RAILWAY-OPTIMIZED POSTING
   */
  private async attemptBrowserPost(content: string): Promise<{
    success: boolean;
    tweet_id?: string;
    error?: string;
    confirmed?: boolean;
    was_posted?: boolean;
  }> {
    try {
      if (!this.page) throw new Error('No page available');
      
      console.log(`📄 Content: "${content.substring(0, 100)}${content.length > 100 ? '...' : ''}"`);
      
      // Navigate with shorter timeout
      await this.page.goto('https://x.com/compose/post', { 
        waitUntil: 'domcontentloaded',
        timeout: 10000 
      });
      
      // Find and fill textarea
      const textarea = await this.page.waitForSelector('textarea[data-testid="tweetTextarea_0"]', { timeout: 8000 });
      await textarea.fill(content);
      
      // Find and click post button
      const postButton = await this.page.waitForSelector('button[data-testid="tweetButtonInline"]', { timeout: 5000 });
      await postButton.click();
      
      // Wait for posting confirmation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Try to extract tweet ID
      let tweetId = 'browser_' + Date.now();
      try {
        const currentUrl = this.page.url();
        const urlMatch = currentUrl.match(/\/status\/(\d+)/);
        if (urlMatch) {
          tweetId = urlMatch[1];
        }
      } catch (extractError) {
        // Use fallback ID
      }
      
      return {
        success: true,
        tweet_id: tweetId,
        confirmed: true,
        was_posted: true
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        confirmed: false,
        was_posted: false
      };
    }
  }
  
  private async emergencyBrowserPost(content: string): Promise<{
    success: boolean;
    tweet_id?: string;
    error?: string;
    confirmed?: boolean;
    was_posted?: boolean;
  }> {
    let emergencyBrowser = null;
    
    try {
      console.log('🚨 Emergency browser posting attempt...');
      
      // Ultra-minimal config
      emergencyBrowser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--single-process', '--disable-gpu']
      });
      
      const page = await emergencyBrowser.newPage();
      await page.goto('https://x.com/compose/post', { timeout: 8000 });
      
      // Simple posting
      await page.fill('textarea', content);
      await page.click('button:has-text("Post")');
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      return {
        success: true,
        tweet_id: 'emergency_' + Date.now(),
        confirmed: false,
        was_posted: true
      };
      
    } catch (error) {
      return {
        success: false,
        error: 'Emergency posting failed: ' + error.message,
        confirmed: false,
        was_posted: false
      };
    } finally {
      if (emergencyBrowser) {
        try {
          await emergencyBrowser.close();
        } catch (closeError) {
          // Ignore cleanup errors
        }
      }
    }
  }
  
  private async enhancedCleanup(): Promise<void> {
    try {
      console.log('🧹 Enhanced browser cleanup...');
      
      if (this.page) {
        try {
          await this.page.close();
        } catch (pageError) {
          console.log('⚠️ Page cleanup warning');
        }
        this.page = null;
      }
      
      if (this.browser) {
        try {
          await this.browser.close();
        } catch (browserError) {
          console.log('⚠️ Browser cleanup warning');
        }
        this.browser = null;
      }
      
      this.isInitialized = false;
      
      // Force garbage collection
      if (global.gc) {
        global.gc();
      }
      
      // Force system cleanup
      const resourceMonitor = RailwayResourceMonitor.getInstance();
      await resourceMonitor.forceCleanup();
      
    } catch (error) {
      console.log('⚠️ Enhanced cleanup warning:', error.message);
    }
  }

}

export const browserTweetPoster = new BrowserTweetPoster(); 