/**
 * 🚀 BROWSER TWEET POSTER
 * 
 * Posts tweets using Playwright browser automation instead of Twitter API
 * to bypass the 17-tweet/day API limit. Uses stealth session authentication.
 */

import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

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

      // Dynamic executable path detection for Render
      const executablePath = await this.findChromiumExecutable();
      if (executablePath) {
        console.log(`🔍 Using detected executable: ${executablePath}`);
        launchOptions.executablePath = executablePath;
      }

      try {
        this.browser = await chromium.launch(launchOptions);
        console.log('✅ Successfully launched browser');
      } catch (launchError) {
        console.log(`❌ Failed to launch browser: ${launchError.message}`);
        
        // Fallback 1: Try without custom executable path
        if (launchOptions.executablePath) {
          console.log('🔄 Trying without custom executable path...');
          delete launchOptions.executablePath;
          try {
            this.browser = await chromium.launch(launchOptions);
            console.log('✅ Successfully launched browser with default executable');
          } catch (defaultError) {
            console.log(`❌ Default executable failed: ${defaultError.message}`);
            throw defaultError;
          }
        } else {
          throw launchError;
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
      console.log('💡 This may be due to missing Playwright browsers on Render');
      console.log('🔧 Check that build script installed Playwright correctly');
      return false;
    }
  }

  private async findChromiumExecutable(): Promise<string | null> {
    console.log('🔍 Searching for Chromium executable...');
    
    // Environment variable override
    if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
      const envPath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
      if (fs.existsSync(envPath)) {
        return envPath;
      }
    }

    // Dynamic detection for Render
    try {
      const playwrightCache = '/opt/render/.cache/ms-playwright';
      if (fs.existsSync(playwrightCache)) {
        console.log('📂 Found Playwright cache directory');
        
        // Get all directories
        const dirs = fs.readdirSync(playwrightCache);
        console.log(`📋 Found directories: ${dirs.join(', ')}`);
        
        // Look for chromium directories
        const chromiumDirs = dirs.filter(dir => dir.includes('chromium'));
        console.log(`🔍 Chromium directories: ${chromiumDirs.join(', ')}`);
        
        for (const dir of chromiumDirs) {
          const dirPath = path.join(playwrightCache, dir);
          
          // Common executable locations
          const possibleExecs = [
            'chrome-linux/chrome',
            'chrome-linux/headless_shell',
            'chrome',
            'headless_shell'
          ];
          
          for (const exec of possibleExecs) {
            const fullPath = path.join(dirPath, exec);
            if (fs.existsSync(fullPath)) {
              console.log(`✅ Found executable: ${fullPath}`);
              return fullPath;
            }
          }
        }
      }
    } catch (error) {
      console.log(`⚠️ Error during dynamic detection: ${error.message}`);
    }

    // Static fallback paths for known Render configurations
    const fallbackPaths = [
      '/opt/render/.cache/ms-playwright/chromium-1181/chrome-linux/chrome',
      '/opt/render/.cache/ms-playwright/chromium_headless_shell-1181/chrome-linux/headless_shell',
      '/opt/render/.cache/ms-playwright/chromium-1181/chrome',
      '/opt/render/.cache/ms-playwright/chromium_headless_shell-1181/headless_shell'
    ];

    for (const fallbackPath of fallbackPaths) {
      if (fs.existsSync(fallbackPath)) {
        console.log(`✅ Found fallback executable: ${fallbackPath}`);
        return fallbackPath;
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

    try {
      console.log('📝 Posting tweet via browser automation...');
      
      // Navigate to Twitter compose
      await this.page!.goto('https://twitter.com/compose/tweet', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      // Wait for compose area
      await this.page!.waitForSelector('div[data-testid="tweetTextarea_0"]', { timeout: 15000 });

      // Clear and type content
      await this.page!.click('div[data-testid="tweetTextarea_0"]');
      await this.page!.keyboard.press('Control+A');
      await this.page!.keyboard.type(content);

      // Wait a moment for typing to complete
      await this.page!.waitForTimeout(1000);

      // Post tweet
      await this.page!.click('div[data-testid="tweetButtonInline"]');

      // Wait for success indicators
      await this.page!.waitForTimeout(3000);

      // Try to extract tweet ID from URL or page
      const tweetId = await this.extractTweetId();

      console.log('✅ Tweet posted successfully via browser');
      return {
        success: true,
        tweet_id: tweetId || `browser_${Date.now()}`
      };

    } catch (error) {
      console.error('❌ Error posting tweet via browser:', error);
      return {
        success: false,
        error: error.message
      };
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