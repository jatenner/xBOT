/**
 * 🚀 BROWSER TWEET POSTER
 * 
 * Posts tweets using Playwright browser automation instead of Twitter API
 * to bypass the 17-tweet/day API limit. Uses stealth session authentication.
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

  async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      return true;
    }

    try {
      console.log('🚀 Initializing Browser Tweet Poster...');
      
      // Set environment variables for Playwright global installation
      process.env.PLAYWRIGHT_BROWSERS_PATH = '0';  // Use global system directory
      process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = 'false';
      
      console.log('🔧 Playwright environment:');
      console.log(`   PLAYWRIGHT_BROWSERS_PATH: ${process.env.PLAYWRIGHT_BROWSERS_PATH}`);
      console.log(`   PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: ${process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD}`);

      // Get launch options with correct executable path
      const launchOptions = getChromiumLaunchOptions();

      // Try to launch browser with correct executable path
      console.log('🌐 Attempting to launch browser with detected executable...');
      
      try {
        this.browser = await chromium.launch(launchOptions);
        console.log('✅ Successfully launched browser with detected executable');
      } catch (launchError) {
        console.log(`❌ Failed to launch browser: ${launchError.message}`);
        
        // Fallback: Force runtime installation and retry
        console.log('🔄 Attempting runtime Playwright installation...');
        try {
          const { execSync } = require('child_process');
          console.log('🎭 Running: PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install chromium --force');
          execSync('PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install chromium --force', { 
            stdio: 'inherit',
            env: { 
              ...process.env, 
              PLAYWRIGHT_BROWSERS_PATH: '0',
              PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: 'false'
            }
          });
          console.log('✅ Runtime Playwright install completed');
          
          // Get updated launch options after installation
          const updatedLaunchOptions = getChromiumLaunchOptions();
          
          // Retry browser launch after installation
          this.browser = await chromium.launch(updatedLaunchOptions);
          console.log('✅ Successfully launched browser after runtime installation');
          
        } catch (installError) {
          console.log(`❌ Runtime installation failed: ${installError.message}`);
          
          // Final fallback: Try minimal configuration without explicit path
          console.log('🔄 Trying minimal browser configuration as last resort...');
          try {
            this.browser = await chromium.launch({
              headless: true,
              args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            console.log('✅ Successfully launched browser with minimal config');
          } catch (minimalError) {
            console.log(`❌ All fallbacks failed: ${minimalError.message}`);
            throw minimalError;
          }
        }
      }

      // Create new page with stealth settings
      this.page = await this.browser.newPage({
        viewport: { width: 1280, height: 720 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });

      // Add stealth scripts
      await this.page.addInitScript(() => {
        // Remove webdriver property
        delete (window as any).navigator.webdriver;
        
        // Override plugins length
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5]
        });
      });

      // Load saved session
      await this.loadSession();

      this.isInitialized = true;
      console.log('✅ Browser Tweet Poster initialized successfully');
      return true;

    } catch (error) {
      console.error('❌ Error initializing Browser Tweet Poster:', error);
      console.log('💡 This may be due to missing Playwright browsers');
      console.log('🔧 Check that runtime installation completed successfully');
      console.log('🔍 Environment variables:');
      console.log(`   PLAYWRIGHT_BROWSERS_PATH: ${process.env.PLAYWRIGHT_BROWSERS_PATH}`);
      console.log(`   PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: ${process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD}`);
      return false;
    }
  }

  private async findChromiumExecutable(): Promise<string | null> {
    console.log('🔍 Searching for Chromium executable...');
    
    // Environment variable override
    if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
      const envPath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
      if (fs.existsSync(envPath)) {
        console.log(`✅ Using environment variable: ${envPath}`);
        return envPath;
      }
    }

    // Check multiple possible cache locations
    const cacheLocations = [
      '/opt/render/.cache/ms-playwright',
      process.env.HOME + '/.cache/ms-playwright',
      '/home/render/.cache/ms-playwright'
    ];

    for (const cacheDir of cacheLocations) {
      try {
        if (fs.existsSync(cacheDir)) {
          console.log(`📂 Found Playwright cache: ${cacheDir}`);
          
          // Get all directories
          const dirs = fs.readdirSync(cacheDir);
          console.log(`📋 Available directories: ${dirs.join(', ')}`);
          
          // Look for chromium directories (any version)
          const chromiumDirs = dirs.filter(dir => 
            dir.includes('chromium') && !dir.includes('headless_shell')
          );
          console.log(`🔍 Chromium directories: ${chromiumDirs.join(', ')}`);
          
          for (const dir of chromiumDirs) {
            const dirPath = path.join(cacheDir, dir);
            
            // Prioritized executable locations (prefer regular chrome over headless_shell)
            const possibleExecs = [
              'chrome-linux/chrome',        // Full Chrome (preferred)
              'chrome',                     // Direct chrome executable
              'chrome-linux/headless_shell', // Headless shell fallback
              'headless_shell'              // Direct headless shell
            ];
            
            for (const exec of possibleExecs) {
              const fullPath = path.join(dirPath, exec);
              if (fs.existsSync(fullPath)) {
                console.log(`✅ Found executable: ${fullPath}`);
                
                // Verify it's actually executable
                try {
                  fs.accessSync(fullPath, fs.constants.F_OK | fs.constants.X_OK);
                  return fullPath;
                } catch (permError) {
                  console.log(`⚠️ Found but not executable: ${fullPath}`);
                  continue;
                }
              }
            }
          }
        }
      } catch (error) {
        console.log(`⚠️ Error checking ${cacheDir}: ${error.message}`);
      }
    }

    // Extended static fallback paths for various Render configurations  
    // Prioritize regular chromium over headless shell
    const fallbackPaths = [
      // Latest known chromium versions (preferred)
      '/opt/render/.cache/ms-playwright/chromium-1054/chrome-linux/chrome',
      '/opt/render/.cache/ms-playwright/chromium-1048/chrome-linux/chrome', 
      '/opt/render/.cache/ms-playwright/chromium-1181/chrome-linux/chrome',
      '/opt/render/.cache/ms-playwright/chromium-1195/chrome-linux/chrome',
      '/opt/render/.cache/ms-playwright/chromium-1200/chrome-linux/chrome',
      '/opt/render/.cache/ms-playwright/chromium-1210/chrome-linux/chrome',
      
      // Older chromium versions
      '/opt/render/.cache/ms-playwright/chromium-1000/chrome-linux/chrome',
      '/opt/render/.cache/ms-playwright/chromium-1020/chrome-linux/chrome',
      '/opt/render/.cache/ms-playwright/chromium-1030/chrome-linux/chrome',
      '/opt/render/.cache/ms-playwright/chromium-1040/chrome-linux/chrome',
      
      // Alternative locations on Render
      '/home/render/.cache/ms-playwright/chromium-1054/chrome-linux/chrome',
      process.env.HOME + '/.cache/ms-playwright/chromium-1054/chrome-linux/chrome',
      
      // Headless shell as absolute last resort (deprecated)
      '/opt/render/.cache/ms-playwright/chromium_headless_shell-1181/chrome-linux/headless_shell',
      '/opt/render/.cache/ms-playwright/chromium_headless_shell-1054/chrome-linux/headless_shell'
    ];

    for (const fallbackPath of fallbackPaths) {
      if (fs.existsSync(fallbackPath)) {
        try {
          fs.accessSync(fallbackPath, fs.constants.F_OK | fs.constants.X_OK);
          console.log(`✅ Found fallback executable: ${fallbackPath}`);
          return fallbackPath;
        } catch (permError) {
          console.log(`⚠️ Found but not executable: ${fallbackPath}`);
        }
      }
    }

    console.log('⚠️ No custom executable found, will use Playwright default');
    return null;
  }

  async postTweet(content: string): Promise<{
    success: boolean;
    tweet_id?: string;
    error?: string;
  }> {
    if (!this.isInitialized) {
      const initSuccess = await this.initialize();
      if (!initSuccess) {
        return {
          success: false,
          error: 'Failed to initialize browser'
        };
      }
    }

    const maxRetries = 3;
    const retryDelay = 3000; // 3 seconds

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`📝 Posting tweet via browser automation (attempt ${attempt}/${maxRetries})...`);
        
        // Try multiple strategies: /compose/tweet first, then /home
        const strategies = [
          { url: 'https://twitter.com/compose/tweet', name: 'compose' },
          { url: 'https://twitter.com/home', name: 'home' }
        ];

        let postingSuccess = false;
        let lastError: Error | null = null;

        for (const strategy of strategies) {
          try {
            console.log(`🔄 Trying ${strategy.name} strategy: ${strategy.url}`);
            
            // Navigate to target page
            await this.page!.goto(strategy.url, {
              waitUntil: 'domcontentloaded',
              timeout: 30000
            });

            // Take debug screenshot if enabled
            await this.debugScreenshot(`pre-compose-${strategy.name}-attempt-${attempt}`);

            // Wait for page to stabilize
            await this.page!.waitForTimeout(2000);

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

            // Success with this strategy
            postingSuccess = true;
            console.log(`✅ Tweet posted successfully using ${strategy.name} strategy`);
            break;

          } catch (strategyError) {
            console.log(`❌ ${strategy.name} strategy error:`, strategyError.message);
            lastError = strategyError as Error;
            await this.debugScreenshot(`error-${strategy.name}-attempt-${attempt}`);
          }
        }

        if (postingSuccess) {
          // Wait for success indicators
          await this.page!.waitForTimeout(3000);

          // Try to extract tweet ID from URL or page
          const tweetId = await this.extractTweetId();

          console.log('✅ Tweet posted successfully via browser');
          return {
            success: true,
            tweet_id: tweetId || `browser_${Date.now()}`
          };
        }

        // If all strategies failed but we have more retries, continue to retry
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
            error: `Failed after ${maxRetries} attempts: ${error.message}`
          };
        }

        // Wait before retrying
        console.log(`🔄 Retrying in ${retryDelay}ms...`);
        await this.page!.waitForTimeout(retryDelay);
      }
    }

    return {
      success: false,
      error: `Failed after ${maxRetries} attempts`
    };
  }

  /**
   * 🎯 FIND AND FILL TWEET TEXTAREA
   */
  private async findAndFillTextarea(content: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Multiple possible selectors for tweet textarea (Twitter keeps changing these)
      const textareaSelectors = [
        'div[data-testid="tweetTextarea_0"]',                    // Current primary
        'div[contenteditable="true"][data-testid*="tweet"]',     // Generic tweet input
        'div[contenteditable="true"][role="textbox"]',           // Generic textbox
        'div[data-testid="tweetText"]',                          // Alternative
        'div[aria-label*="Tweet text"]',                         // Aria label based
        'div[aria-label*="What is happening"]',                  // Old placeholder text
        'div[aria-label*="What\'s happening"]',                  // Alternative placeholder
        '.public-DraftEditor-content',                           // Draft.js editor
        '.notranslate.public-DraftEditor-content',               // Draft.js with no-translate
        '[data-testid="tweet-text-one"]',                        // Newer variation
        '[data-testid="tweetTextarea_0_label"]',                 // Label-based
        'div[spellcheck="true"][contenteditable="true"]',        // Generic editable div
      ];

      let textarea: any = null;
      let usedSelector = '';

      // Try each selector with increased timeout
      for (const selector of textareaSelectors) {
        try {
          console.log(`🔍 Trying selector: ${selector}`);
          
          await this.page!.waitForSelector(selector, { 
            timeout: 25000,  // Increased timeout
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
        return { 
          success: false, 
          error: 'Could not find tweet textarea with any known selector' 
        };
      }

      // Clear and type content with multiple methods
      console.log(`📝 Filling textarea using selector: ${usedSelector}`);
      
      try {
        // Method 1: Click and select all
        await textarea.click();
        await this.page!.waitForTimeout(500);
        await this.page!.keyboard.press('Control+A');
        await this.page!.keyboard.press('Delete');
        await this.page!.waitForTimeout(500);
        await this.page!.keyboard.type(content, { delay: 50 });
      } catch (typingError) {
        console.log('⚠️ Method 1 failed, trying method 2...');
        
        // Method 2: Direct fill
        await textarea.fill('');
        await this.page!.waitForTimeout(500);
        await textarea.fill(content);
      }

      // Verify content was entered
      await this.page!.waitForTimeout(1000);
      const currentText = await textarea.textContent() || await textarea.inputValue() || '';
      
      if (currentText.includes(content.substring(0, 20))) {
        console.log('✅ Content successfully entered in textarea');
        return { success: true };
      } else {
        return { 
          success: false, 
          error: `Content verification failed. Expected: "${content.substring(0, 20)}...", Got: "${currentText.substring(0, 20)}..."` 
        };
      }

    } catch (error) {
      return { 
        success: false, 
        error: `Textarea interaction failed: ${error.message}` 
      };
    }
  }

  /**
   * 🚀 FIND AND CLICK POST BUTTON
   */
  private async findAndClickPostButton(): Promise<{ success: boolean; error?: string }> {
    try {
      // Multiple possible selectors for post button
      const postButtonSelectors = [
        'div[data-testid="tweetButtonInline"]',                  // Current primary
        'div[data-testid="tweetButton"]',                        // Alternative
        'button[data-testid="tweetButtonInline"]',               // Button variant
        'button[data-testid="tweetButton"]',                     // Button alternative
        '[role="button"][data-testid*="tweet"]',                // Generic role button
        'div[role="button"]:has-text("Tweet")',                 // Text-based
        'div[role="button"]:has-text("Post")',                  // New "Post" text
        'button:has-text("Tweet")',                             // Button with Tweet text
        'button:has-text("Post")',                              // Button with Post text
        '.css-18t94o4.css-1dbjc4n.r-l5o3uw.r-42olwf',          // CSS class based
        '[aria-label*="Tweet"]:not([aria-label*="Tweet text"])', // Aria label for button
        '[aria-label*="Post"]:not([aria-label*="Post text"])',  // Aria label for post
      ];

      let postButton: any = null;
      let usedSelector = '';

      // Try each post button selector
      for (const selector of postButtonSelectors) {
        try {
          console.log(`🔍 Trying post button selector: ${selector}`);
          
          await this.page!.waitForSelector(selector, { 
            timeout: 10000,
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
            console.log(`⚠️ Found but not usable post button: ${selector} (visible: ${isVisible}, enabled: ${isEnabled})`);
          }
        } catch (selectorError) {
          console.log(`❌ Post button selector failed: ${selector} - ${selectorError.message}`);
          continue;
        }
      }

      if (!postButton || !usedSelector) {
        return { 
          success: false, 
          error: 'Could not find post button with any known selector' 
        };
      }

      // Click the post button
      console.log(`🚀 Clicking post button using selector: ${usedSelector}`);
      await postButton.click();
      
      // Wait for posting to complete
      await this.page!.waitForTimeout(2000);
      
      console.log('✅ Post button clicked successfully');
      return { success: true };

    } catch (error) {
      return { 
        success: false, 
        error: `Post button interaction failed: ${error.message}` 
      };
    }
  }

  /**
   * 📸 DEBUG SCREENSHOT
   */
  private async debugScreenshot(name: string): Promise<void> {
    if (process.env.DEBUG_SCREENSHOT === 'true' && this.page) {
      try {
        const timestamp = Date.now();
        const filename = `/tmp/tweet-post-${name}-${timestamp}.png`;
        await this.page.screenshot({ 
          path: filename, 
          fullPage: true 
        });
        console.log(`📸 Debug screenshot saved: ${filename}`);
      } catch (error) {
        console.log(`⚠️ Failed to save debug screenshot: ${error.message}`);
      }
    }
  }

  private async extractTweetId(): Promise<string | null> {
    try {
      // Wait for URL change or success message
      await this.page!.waitForTimeout(2000);
      
      const currentUrl = this.page!.url();
      const tweetMatch = currentUrl.match(/status\/(\d+)/);
      
      if (tweetMatch) {
        return tweetMatch[1];
      }

      // Alternative: look for tweet in timeline
      const timelineUrl = 'https://twitter.com/home';
      await this.page!.goto(timelineUrl, { waitUntil: 'domcontentloaded' });
      
      // Return a browser-based ID
      return `browser_${Date.now()}`;
    } catch (error) {
      console.log('⚠️ Could not extract tweet ID, using fallback');
      return `browser_${Date.now()}`;
    }
  }

  private async loadSession(): Promise<void> {
    try {
      if (fs.existsSync(this.sessionPath)) {
        const sessionData = JSON.parse(fs.readFileSync(this.sessionPath, 'utf8'));
        await this.page!.context().addCookies(sessionData.cookies);
        console.log('✅ Loaded Twitter session from file');
      } else {
        console.log('⚠️ No session file found - will need manual login');
      }
    } catch (error) {
      console.log('⚠️ Error loading session:', error.message);
    }
  }

  getStatus(): { initialized: boolean; hasSession: boolean } {
    return {
      initialized: this.isInitialized,
      hasSession: fs.existsSync(this.sessionPath)
    };
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      this.isInitialized = false;
      console.log('🔒 Browser Tweet Poster closed');
    }
  }
}

// Create singleton instance
export const browserTweetPoster = new BrowserTweetPoster();

// Export for testing
export default BrowserTweetPoster; 