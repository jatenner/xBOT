import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface BrowserHealth {
  isInstalled: boolean;
  isRunning: boolean;
  lastSuccessfulLaunch: Date | null;
  failureCount: number;
  executablePath?: string;
}

export class BulletproofBrowser {
  private static instance: BulletproofBrowser;
  private browser: Browser | null = null;
  private browserHealth: BrowserHealth = {
    isInstalled: false,
    isRunning: false,
    lastSuccessfulLaunch: null,
    failureCount: 0
  };
  
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAYS = [2000, 5000, 10000];
  private readonly isRailway = process.env.RAILWAY_ENVIRONMENT === 'production';
  private readonly isRender = process.env.RENDER === 'true';
  private readonly isProduction = process.env.NODE_ENV === 'production';

  private constructor() {}

  public static getInstance(): BulletproofBrowser {
    if (!BulletproofBrowser.instance) {
      BulletproofBrowser.instance = new BulletproofBrowser();
    }
    return BulletproofBrowser.instance;
  }

  /**
   * Initialize browser with platform-specific optimizations
   */
  public async initialize(): Promise<void> {
    console.log('🌐 Initializing Bulletproof Browser...');
    console.log(`📍 Platform: Railway=${this.isRailway}, Render=${this.isRender}, Production=${this.isProduction}`);

    try {
      // Step 1: Ensure Playwright is installed
      await this.ensurePlaywrightInstallation();
      
      // Step 2: Find executable path
      await this.findExecutablePath();
      
      // Step 3: Launch browser with retry
      await this.launchBrowserWithRetry();
      
      console.log('✅ Bulletproof Browser initialized successfully');
      
    } catch (error: any) {
      console.error('❌ Browser initialization failed:', error.message);
      console.log('⚠️ Browser automation will be disabled');
    }
  }

  /**
   * Ensure Playwright is properly installed for the current platform
   */
  private async ensurePlaywrightInstallation(): Promise<void> {
    console.log('🔍 Checking Playwright installation...');

    try {
      if (this.isRailway || this.isRender) {
        // Production environments: Install with system dependencies
        console.log('📦 Installing Playwright for production environment...');
        
        const installCommands = [
          'npx playwright install --with-deps chromium',
          'npx playwright install chromium',  // Fallback without deps
          'npm install playwright chromium'   // Last resort
        ];

        for (const command of installCommands) {
          try {
            console.log(`🔧 Running: ${command}`);
            execSync(command, { 
              stdio: 'inherit', 
              timeout: 120000 // 2 minutes max
            });
            console.log(`✅ Successfully executed: ${command}`);
            break;
          } catch (error: any) {
            console.warn(`⚠️ Command failed: ${command}`, error.message);
          }
        }
      }

      // Verify installation
      this.browserHealth.isInstalled = await this.verifyPlaywrightInstallation();
      
      if (this.browserHealth.isInstalled) {
        console.log('✅ Playwright installation verified');
      } else {
        throw new Error('Playwright installation verification failed');
      }

    } catch (error: any) {
      console.error('❌ Playwright installation failed:', error.message);
      throw error;
    }
  }

  /**
   * Verify Playwright installation
   */
  private async verifyPlaywrightInstallation(): Promise<boolean> {
    try {
      // Check if we can import chromium
      const { chromium } = await import('playwright');
      
      // Try to get executable path
      const executablePath = chromium.executablePath();
      console.log(`📍 Chromium executable: ${executablePath}`);
      
      // Check if executable exists
      if (fs.existsSync(executablePath)) {
        this.browserHealth.executablePath = executablePath;
        return true;
      }
      
      return false;
      
    } catch (error: any) {
      console.warn('⚠️ Playwright verification failed:', error.message);
      return false;
    }
  }

  /**
   * Find Chromium executable path across different platforms
   */
  private async findExecutablePath(): Promise<void> {
    console.log('🔍 Finding Chromium executable path...');

    const possiblePaths = [
      // Standard Playwright paths
      chromium.executablePath(),
      
      // Railway specific paths
      '/opt/railway/.cache/ms-playwright/chromium-*/chrome-linux/chrome',
      '/opt/railway/.cache/ms-playwright/chromium-*/chrome-linux/headless_shell',
      
      // Render specific paths  
      '/opt/render/.cache/ms-playwright/chromium-*/chrome-linux/chrome',
      '/opt/render/.cache/ms-playwright/chromium-*/chrome-linux/headless_shell',
      
      // Alternative system paths
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      
      // Docker/container paths
      '/usr/bin/chromium-browser',
      '/opt/google/chrome/chrome'
    ];

    // Expand wildcard paths
    const expandedPaths = this.expandWildcardPaths(possiblePaths);
    
    for (const execPath of expandedPaths) {
      if (fs.existsSync(execPath)) {
        console.log(`✅ Found Chromium at: ${execPath}`);
        this.browserHealth.executablePath = execPath;
        return;
      }
    }

    console.warn('⚠️ No Chromium executable found, will try default');
  }

  /**
   * Expand wildcard paths to actual filesystem paths
   */
  private expandWildcardPaths(paths: string[]): string[] {
    const expanded: string[] = [];
    
    for (const pathPattern of paths) {
      if (pathPattern.includes('*')) {
        try {
          const dirPath = path.dirname(pathPattern);
          const pattern = path.basename(pathPattern);
          
          if (fs.existsSync(dirPath)) {
            const files = fs.readdirSync(dirPath);
            const matchingFiles = files.filter(file => 
              this.matchesPattern(file, pattern.replace('*', ''))
            );
            
            for (const file of matchingFiles) {
              const fullPath = path.join(dirPath, file, pattern.split('*')[1] || '');
              if (fs.existsSync(fullPath)) {
                expanded.push(fullPath);
              }
            }
          }
        } catch (error) {
          // Ignore errors in wildcard expansion
        }
      } else {
        expanded.push(pathPattern);
      }
    }
    
    return expanded;
  }

  private matchesPattern(filename: string, pattern: string): boolean {
    return filename.includes(pattern);
  }

  /**
   * Launch browser with platform-specific configuration and retry logic
   */
  private async launchBrowserWithRetry(): Promise<void> {
    for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
      try {
        console.log(`🚀 Browser launch attempt ${attempt + 1}/${this.MAX_RETRIES}...`);
        
        const launchOptions = this.getBrowserLaunchOptions();
        console.log('🔧 Launch options:', JSON.stringify(launchOptions, null, 2));
        
        this.browser = await chromium.launch(launchOptions);
        
        // Test browser
        await this.testBrowser();
        
        this.browserHealth.isRunning = true;
        this.browserHealth.lastSuccessfulLaunch = new Date();
        this.browserHealth.failureCount = 0;
        
        console.log('✅ Browser launched successfully');
        return;

      } catch (error: any) {
        this.browserHealth.failureCount++;
        console.warn(`⚠️ Browser launch attempt ${attempt + 1} failed:`, error.message);
        
        if (this.browser) {
          try {
            await this.browser.close();
          } catch (closeError) {
            // Ignore close errors
          }
          this.browser = null;
        }
        
        if (attempt < this.MAX_RETRIES - 1) {
          const delay = this.RETRY_DELAYS[attempt];
          console.log(`⏳ Retrying browser launch in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }

    throw new Error('Browser launch failed after all retries');
  }

  /**
   * Get platform-specific browser launch options
   */
  private getBrowserLaunchOptions(): any {
    const baseOptions = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ]
    };

    // Add executable path if found
    if (this.browserHealth.executablePath) {
      baseOptions.executablePath = this.browserHealth.executablePath;
    }

    // Platform-specific optimizations
    if (this.isRailway) {
      baseOptions.args.push(
        '--single-process',
        '--disable-background-networking'
      );
    }

    if (this.isRender) {
      baseOptions.args.push(
        '--memory-pressure-off',
        '--max_old_space_size=512'
      );
    }

    return baseOptions;
  }

  /**
   * Test browser functionality
   */
  private async testBrowser(): Promise<void> {
    if (!this.browser) {
      throw new Error('No browser instance');
    }

    const page = await this.browser.newPage();
    
    try {
      await page.goto('about:blank', { 
        waitUntil: 'load', 
        timeout: 10000 
      });
      console.log('✅ Browser test successful');
    } finally {
      await page.close();
    }
  }

  /**
   * Get browser instance with health check
   */
  public async getBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.isConnected()) {
      console.log('🔄 Browser not connected, reinitializing...');
      await this.initialize();
    }

    if (!this.browser) {
      throw new Error('Browser not available');
    }

    return this.browser;
  }

  /**
   * Create a new page with error handling
   */
  public async createPage(): Promise<Page> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    
    // Set reasonable timeouts
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(30000);
    
    // Add error handlers
    page.on('pageerror', (error) => {
      console.warn('⚠️ Page error:', error.message);
    });
    
    page.on('requestfailed', (request) => {
      console.warn('⚠️ Request failed:', request.url());
    });

    return page;
  }

  /**
   * Get browser health status
   */
  public getBrowserHealth(): BrowserHealth {
    return { ...this.browserHealth };
  }

  /**
   * Graceful shutdown
   */
  public async shutdown(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
        console.log('✅ Browser closed gracefully');
      } catch (error: any) {
        console.warn('⚠️ Browser close error:', error.message);
      }
      this.browser = null;
    }
    this.browserHealth.isRunning = false;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}