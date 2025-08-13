import { chromium, Browser, Page, BrowserContext } from 'playwright-core';
import { execSync } from 'child_process';
import * as fs from 'fs';

class PlaywrightFactory {
  private static instance: PlaywrightFactory;
  private browserPromise: Promise<Browser> | null = null;
  private isInitialized = false;
  private isRailway = process.env.RAILWAY_ENVIRONMENT === 'production';

  private constructor() {}

  public static getInstance(): PlaywrightFactory {
    if (!PlaywrightFactory.instance) {
      PlaywrightFactory.instance = new PlaywrightFactory();
    }
    return PlaywrightFactory.instance;
  }

  private async ensureBrowserInstallation(): Promise<void> {
    if (this.isRailway) {
      console.log('🚀 Railway deployment detected - ensuring browser setup...');
      
      try {
        // Try installing browsers with multiple fallback strategies
        console.log('🔧 Installing Playwright browsers...');
        
        // Strategy 1: Force reinstall with deps
        try {
          execSync('npx playwright install chromium --with-deps --force', { 
            stdio: 'inherit',
            timeout: 120000
          });
          console.log('✅ Playwright browsers installed with deps');
        } catch (error) {
          console.warn('⚠️ Installation with deps failed, trying without deps...');
          
          // Strategy 2: Install without deps
          try {
            execSync('npx playwright install chromium --force', { 
              stdio: 'inherit',
              timeout: 120000
            });
            console.log('✅ Playwright browsers installed (no deps)');
          } catch (error2) {
            console.warn('⚠️ Standard installation failed, using fallback...');
            
            // Strategy 3: Use system browser if available
            const possibleBrowserPaths = [
              '/usr/bin/chromium-browser',
              '/usr/bin/chromium',
              '/opt/google/chrome/chrome',
              '/usr/bin/google-chrome'
            ];
            
            const availableBrowser = possibleBrowserPaths.find(path => {
              try {
                return fs.existsSync(path);
              } catch {
                return false;
              }
            });
            
            if (availableBrowser) {
              console.log(`✅ Using system browser: ${availableBrowser}`);
              process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH = availableBrowser;
            } else {
              console.warn('⚠️ No browsers found - browser posting may fail');
            }
          }
        }
        
        // Fix executable permissions if needed
        try {
          const playwrightCache = process.env.PLAYWRIGHT_BROWSERS_PATH || 
                                process.env.HOME + '/.cache/ms-playwright';
          
          if (fs.existsSync(playwrightCache)) {
            console.log('🔧 Setting executable permissions...');
            execSync(`find ${playwrightCache} -name "chrome*" -type f -exec chmod +x {} \\; 2>/dev/null || true`, {
              stdio: 'pipe',
              timeout: 30000
            });
            console.log('✅ Executable permissions set');
          }
        } catch (permError) {
          console.warn('⚠️ Permission setting failed (non-critical):', permError.message);
        }
        
      } catch (setupError) {
        console.warn('⚠️ Browser setup failed but continuing:', setupError.message);
      }
    }
  }

  private async createBrowser(): Promise<Browser> {
    console.log('🌐 Launching browser with safe options...');
    
    // Ensure browser installation first
    await this.ensureBrowserInstallation();
    
    // Enhanced launch options for Railway/Docker deployment
    const launchOptions: any = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox', 
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-plugins',
        '--disable-default-apps',
        '--no-first-run',
        '--disable-web-security',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--memory-pressure-off',
        '--max_old_space_size=400',
        '--single-process'
      ],
      // Increase timeout for slow environments
      timeout: 120000
    };
    
    // Use custom executable path if set
    if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
      console.log(`🎭 Using custom browser: ${launchOptions.executablePath}`);
    }
    
    const browser = await chromium.launch(launchOptions);
    
    if (!this.isInitialized) {
      console.log('✅ PLAYWRIGHT_FACTORY_READY');
      this.isInitialized = true;
    }
    
    return browser;
  }

  public async getBrowser(): Promise<Browser> {
    if (!this.browserPromise) {
      this.browserPromise = this.createBrowser();
    }
    
    try {
      const browser = await this.browserPromise;
      // Test if browser is still connected
      if (!browser.isConnected()) {
        throw new Error('Browser disconnected');
      }
      return browser;
    } catch (error) {
      console.log('🔄 Browser failed, creating new one...');
      this.browserPromise = this.createBrowser();
      return this.browserPromise;
    }
  }

  public async getPageWithStorage(storagePath?: string): Promise<{ctx: BrowserContext, page: Page}> {
    let attempt = 1;
    const maxAttempts = 3;
    
    while (attempt <= maxAttempts) {
      try {
        const browser = await this.getBrowser();
        
        // Prepare context options with fallback for invalid storage state
        let contextOptions: any = {};
        
        if (storagePath) {
          try {
            // Check if storage file exists and is valid
            if (fs.existsSync(storagePath)) {
              const stats = fs.statSync(storagePath);
              if (stats.size > 0) {
                contextOptions.storageState = storagePath;
                console.log(`📱 Loading existing session from ${storagePath}`);
              }
            } else {
              console.log('🆕 Creating new Twitter session');
            }
          } catch (storageError) {
            console.warn('⚠️ Invalid storage state file, creating fresh session:', storageError.message);
          }
        }
        
        const ctx = await browser.newContext(contextOptions);
        const page = await ctx.newPage();
        
        // Verify the context and page are functional
        await page.waitForTimeout(100); // Small delay to ensure context is ready
        
        console.log(`✅ Browser context created successfully (attempt ${attempt})`);
        return { ctx, page };
        
      } catch (error: any) {
        console.log(`⚠️ Page creation failed (attempt ${attempt}/${maxAttempts}):`, error.message);
        
        if (attempt === maxAttempts) {
          throw new Error(`Failed to create browser context after ${maxAttempts} attempts: ${error.message}`);
        }
        
        // Clean up failed browser and force new one
        try {
          const browser = await this.getBrowser();
          await browser.close();
        } catch (cleanupError) {
          console.warn('⚠️ Browser cleanup error:', cleanupError.message);
        }
        
        // Reset browser promise to force new browser creation
        this.browserPromise = null;
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        attempt++;
      }
    }
    
    throw new Error('Failed to create browser context after all retry attempts');
  }
}

// Export convenience functions
const factory = PlaywrightFactory.getInstance();

export async function getBrowser(): Promise<Browser> {
  return factory.getBrowser();
}

export async function getPageWithStorage(storagePath?: string): Promise<{ctx: BrowserContext, page: Page}> {
  return factory.getPageWithStorage(storagePath);
}