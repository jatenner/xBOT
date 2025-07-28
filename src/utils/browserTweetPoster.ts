/**
 * 🚀 BROWSER TWEET POSTER
 * 
 * Posts tweets using Playwright browser automation instead of Twitter API
 * to bypass the 17-tweet/day API limit. Uses stealth session authentication.
 */

import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

interface TweetResult {
  success: boolean;
  tweetId?: string;
  error?: string;
  retries?: number;
}

export class BrowserTweetPoster {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private sessionPath = path.join(process.cwd(), 'twitter-auth.json');
  private maxRetries = 3;
  private isInitialized = false;

  constructor() {
    // Initialize on first use
  }

  /**
   * 🚀 Initialize the browser tweet poster
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      return true;
    }

    try {
      console.log('🚀 Initializing Browser Tweet Poster...');

      // Launch browser with stealth settings (Render-compatible)
      let launchOptions: any = {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-blink-features=AutomationControlled',
          '--disable-extensions',
          '--disable-plugins',
          '--disable-default-apps',
          '--disable-sync',
          '--disable-translate',
          '--hide-scrollbars',
          '--mute-audio',
          '--no-default-browser-check',
          '--no-pings'
        ]
      };

      // Try different executable paths for Render (updated for latest Playwright)
      const possiblePaths = [
        '/opt/render/.cache/ms-playwright/chromium_headless_shell-1181/chrome-linux/headless_shell',
        '/opt/render/.cache/ms-playwright/chromium-1181/chrome-linux/chrome',
        '/opt/render/.cache/ms-playwright/chromium_headless_shell-1181/headless_shell',
        '/opt/render/.cache/ms-playwright/chromium-1181/chrome',
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ].filter(Boolean);

      for (const path of possiblePaths) {
        try {
          console.log(`🔍 Trying Chromium path: ${path}`);
          launchOptions.executablePath = path;
          this.browser = await chromium.launch(launchOptions);
          console.log(`✅ Successfully launched browser with: ${path}`);
          break;
        } catch (pathError) {
          console.log(`❌ Failed with path ${path}: ${pathError.message}`);
          continue;
        }
      }

      // If all paths failed, try without specifying executable path
      if (!this.browser) {
        console.log('🔄 Trying default Playwright executable...');
        delete launchOptions.executablePath;
        try {
          this.browser = await chromium.launch(launchOptions);
          console.log('✅ Successfully launched browser with default executable');
        } catch (defaultError) {
          console.log(`❌ Default executable also failed: ${defaultError.message}`);
          
          // Final fallback: try with minimal args
          console.log('🔄 Trying minimal browser configuration...');
          this.browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
          });
          console.log('✅ Successfully launched browser with minimal configuration');
        }
      }

      // Create page with realistic settings
      this.page = await this.browser.newPage({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1366, height: 768 },
        locale: 'en-US',
        timezoneId: 'America/New_York'
      });

      // Load session if available
      await this.loadSession();

      this.isInitialized = true;
      console.log('✅ Browser Tweet Poster initialized successfully');
      return true;

    } catch (error) {
      console.error('❌ Error initializing Browser Tweet Poster:', error);
      console.log('💡 This may be due to Playwright installation issues on Render');
      console.log('🔧 Check that render-build.sh installed Playwright correctly');
      console.log('📋 Expected path: /opt/render/.cache/ms-playwright/chromium_headless_shell-1181/');
      return false;
    }
  }

  /**
   * 📤 Post a tweet using browser automation
   */
  async postTweet(content: string): Promise<TweetResult> {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) {
        return {
          success: false,
          error: 'Failed to initialize browser'
        };
      }
    }

    let retries = 0;
    while (retries < this.maxRetries) {
      try {
        console.log(`🐦 Attempting to post tweet (attempt ${retries + 1}/${this.maxRetries})...`);
        
        const result = await this.attemptTweetPost(content);
        if (result.success) {
          console.log('✅ Tweet posted successfully via browser!');
          return result;
        }

        console.log(`⚠️ Tweet attempt ${retries + 1} failed: ${result.error}`);
        retries++;
        
        if (retries < this.maxRetries) {
          console.log('🔄 Waiting before retry...');
          await new Promise(resolve => setTimeout(resolve, 5000 + (retries * 2000)));
        }

      } catch (error) {
        console.error(`❌ Tweet attempt ${retries + 1} error:`, error);
        retries++;
        
        if (retries < this.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 5000 + (retries * 2000)));
        }
      }
    }

    return {
      success: false,
      error: `Failed to post tweet after ${this.maxRetries} attempts`,
      retries
    };
  }

  /**
   * 🎯 Attempt to post a single tweet
   */
  private async attemptTweetPost(content: string): Promise<TweetResult> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    try {
      // Navigate to Twitter home/compose
      console.log('🌐 Navigating to Twitter...');
      
      try {
        await this.page.goto('https://twitter.com/home', {
          waitUntil: 'domcontentloaded',
          timeout: 60000
        });
      } catch (gotoError) {
        console.log('🔧 Home navigation failed, trying compose...');
        await this.page.goto('https://twitter.com/compose/tweet', {
          waitUntil: 'domcontentloaded',
          timeout: 60000
        });
      }

      // Wait for page to load and check if we're logged in
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check if we need to log in
      const needsLogin = await this.page.evaluate(() => {
        return document.URL.includes('/login') || 
               document.URL.includes('/i/flow/login') ||
               !document.querySelector('[data-testid="tweetTextarea_0"]') &&
               !document.querySelector('[data-testid="tweetButton"]');
      });

      if (needsLogin) {
        throw new Error('Session expired - not logged in to Twitter');
      }

      // Find and click the tweet compose area
      console.log('✍️ Finding tweet compose area...');
      
      const tweetTextarea = await this.page.waitForSelector('[data-testid="tweetTextarea_0"]', { 
        timeout: 15000 
      }).catch(async () => {
        // Fallback: try to find compose button first
        const composeButton = await this.page.$('[data-testid="SideNav_NewTweet_Button"], [aria-label*="Tweet"], [aria-label*="Post"]');
        if (composeButton) {
          await composeButton.click();
          await new Promise(resolve => setTimeout(resolve, 2000));
          return await this.page.waitForSelector('[data-testid="tweetTextarea_0"]', { timeout: 10000 });
        }
        return null;
      });

      if (!tweetTextarea) {
        throw new Error('Could not find tweet compose area');
      }

      // Clear any existing content and type the tweet
      console.log('📝 Typing tweet content...');
      await tweetTextarea.click();
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Clear existing content
      await this.page.keyboard.press('Meta+A'); // Select all
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Type the content with realistic timing
      await this.page.keyboard.type(content, { delay: 50 + Math.random() * 100 });
      
      // Wait a moment for UI to update
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Find and click the tweet button
      console.log('🚀 Finding tweet button...');
      
      const tweetButton = await this.page.waitForSelector(
        '[data-testid="tweetButton"], [data-testid="tweetButtonInline"]', 
        { timeout: 10000 }
      );

      if (!tweetButton) {
        throw new Error('Could not find tweet button');
      }

      // Check if button is enabled
      const isDisabled = await tweetButton.evaluate(el => 
        el.getAttribute('aria-disabled') === 'true' || 
        el.hasAttribute('disabled')
      );

      if (isDisabled) {
        throw new Error('Tweet button is disabled - content may be invalid');
      }

      // Click the tweet button
      console.log('📤 Posting tweet...');
      await tweetButton.click();

      // Wait for the tweet to be posted (look for success indicators)
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check for success by looking for timeline update or success message
      const posted = await this.page.evaluate(() => {
        // Look for success indicators
        const successIndicators = [
          'Your Tweet was sent', // English
          'Tweet sent', // Shorter version
          '[data-testid="toast"]', // Toast notification
        ];

        for (const indicator of successIndicators) {
          if (document.querySelector(indicator) || document.body.textContent?.includes(indicator)) {
            return true;
          }
        }

        // Alternative: check if we're back to timeline and compose area is cleared
        const composeArea = document.querySelector('[data-testid="tweetTextarea_0"]') as HTMLElement;
        return composeArea && (!composeArea.textContent || composeArea.textContent.trim() === '');
      });

      if (posted) {
        // Try to extract tweet ID from URL or elements (best effort)
        const tweetId = await this.extractTweetId();
        
        return {
          success: true,
          tweetId: tweetId || `browser_${Date.now()}`
        };
      } else {
        throw new Error('Tweet posting may have failed - no success confirmation detected');
      }

    } catch (error) {
      console.error('❌ Browser tweet posting error:', error);
      
      // Take screenshot for debugging
      if (this.page) {
        try {
          await this.page.screenshot({ 
            path: `tweet-error-${Date.now()}.png`,
            fullPage: false 
          });
        } catch (screenshotError) {
          console.log('Could not take debug screenshot:', screenshotError.message);
        }
      }

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 🔍 Try to extract tweet ID from page (best effort)
   */
  private async extractTweetId(): Promise<string | null> {
    if (!this.page) return null;

    try {
      // Wait a moment for page to update
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Look for tweet ID in various places
      const tweetId = await this.page.evaluate(() => {
        // Method 1: Look for recent tweet links in timeline
        const tweetLinks = document.querySelectorAll('a[href*="/status/"]');
        for (let i = 0; i < tweetLinks.length; i++) {
          const link = tweetLinks[i] as HTMLAnchorElement;
          const href = link.href;
          const match = href.match(/\/status\/(\d+)/);
          if (match) {
            return match[1];
          }
        }

        // Method 2: Look in URL if we navigated to the tweet
        if (window.location.href.includes('/status/')) {
          const match = window.location.href.match(/\/status\/(\d+)/);
          if (match) {
            return match[1];
          }
        }

        return null;
      });

      return tweetId;
    } catch (error) {
      console.log('Could not extract tweet ID:', error.message);
      return null;
    }
  }

  /**
   * 💾 Load Twitter session from file
   */
  private async loadSession(): Promise<void> {
    try {
      if (fs.existsSync(this.sessionPath)) {
        const sessionData = JSON.parse(fs.readFileSync(this.sessionPath, 'utf8'));
        
        if (this.page && sessionData.cookies) {
          await this.page.context().addCookies(sessionData.cookies);
          console.log(`✅ Twitter session loaded (${sessionData.cookies.length} cookies)`);
        }
      } else {
        console.log('⚠️ No Twitter session found - browser posting may not work');
      }
    } catch (error) {
      console.error('❌ Failed to load session:', error);
    }
  }

  /**
   * 📊 Get posting status
   */
  getStatus(): {
    isInitialized: boolean;
    hasSession: boolean;
  } {
    return {
      isInitialized: this.isInitialized,
      hasSession: fs.existsSync(this.sessionPath)
    };
  }

  /**
   * 🔒 Close browser resources
   */
  async close(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close();
      }
      
      if (this.browser) {
        await this.browser.close();
      }
      
      this.isInitialized = false;
      console.log('✅ Browser tweet poster closed');
    } catch (error) {
      console.error('❌ Error closing browser tweet poster:', error);
    }
  }
}

// Create singleton instance
export const browserTweetPoster = new BrowserTweetPoster();

// Export for testing
export default BrowserTweetPoster; 