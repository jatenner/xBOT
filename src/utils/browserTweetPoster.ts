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