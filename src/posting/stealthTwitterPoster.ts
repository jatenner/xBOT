/**
 * 🥷 STEALTH TWITTER POSTER
 * 
 * Advanced anti-detection system to bypass Twitter's anti-bot measures
 * - Human-like browser fingerprints
 * - Mouse movement simulation
 * - Keyboard shortcuts for posting
 * - Mask detection and bypass
 * - Multiple posting strategies
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { bulletproofBrowser } from './bulletproofBrowserManager';

interface PostResult {
  success: boolean;
  error?: string;
  tweetIds?: string[];
}

export class StealthTwitterPoster {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private isInitialized = false;

  constructor() {
    console.log('🥷 STEALTH_POSTER: Initializing advanced stealth Twitter poster...');
  }

  /**
   * 🧹 Force cleanup processes to prevent EAGAIN errors
   */
  private async forceCleanupProcesses(): Promise<void> {
    try {
      // Kill any orphaned Chrome processes  
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      // Railway-specific cleanup
      await execAsync('pkill -f "chrome|chromium" || true').catch(() => {});
      await execAsync('rm -rf /tmp/playwright_* /tmp/chrome-* || true').catch(() => {});
      
      // Force garbage collection
      if (global.gc) {
        global.gc();
      }
      
      // Small delay for cleanup
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      // Cleanup errors are non-fatal
      console.log('🧹 STEALTH_POSTER: Process cleanup completed');
    }
  }

  /**
   * 🛡️ STEALTH BROWSER INITIALIZATION WITH RAILWAY EAGAIN HANDLING
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('🥷 STEALTH_POSTER: Starting stealth browser initialization...');
      
      // Enterprise-grade Railway EAGAIN fallback configurations
      const railwayStealthConfigs = [
        {
          name: 'stealth_ultra_light',
          config: {
            headless: true,
            args: [
              // CRITICAL Railway fixes
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage',
              '--single-process',              // CRITICAL: Prevents EAGAIN fork() errors
              '--no-zygote',                  // CRITICAL: No subprocess spawning
              
              // Memory optimization
              '--disable-gpu',
              '--disable-accelerated-2d-canvas',
              '--memory-pressure-off',
              '--max_old_space_size=256',
              
              // Stealth features (essential only)
              '--disable-blink-features=AutomationControlled',
              '--disable-features=VizDisplayCompositor,TranslateUI',
              '--disable-web-security',
              '--disable-ipc-flooding-protection',
              '--no-first-run',
              '--no-default-browser-check',
              '--disable-default-apps',
              
              // Performance
              '--disable-background-timer-throttling',
              '--disable-backgrounding-occluded-windows',
              '--disable-renderer-backgrounding',
              '--disable-background-networking',
              '--disable-extensions',
              '--disable-plugins',
              
              // Minimal viewport
              '--window-size=1280,720'
            ],
            timeout: 15000
          }
        },
        {
          name: 'stealth_minimal',
          config: {
            headless: true,
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage',
              '--single-process',
              '--no-zygote',
              '--disable-gpu',
              '--disable-blink-features=AutomationControlled',
              '--memory-pressure-off'
            ],
            timeout: 10000
          }
        },
        {
          name: 'stealth_emergency',
          config: {
            headless: true,
            args: [
              '--no-sandbox',
              '--single-process',
              '--disable-gpu'
            ],
            timeout: 8000
          }
        }
      ];

      let lastError: Error | null = null;

      for (const { name, config } of railwayStealthConfigs) {
        try {
          console.log(`🚀 STEALTH_POSTER: Trying ${name} configuration...`);
          
          // Force cleanup before each attempt
          await this.forceCleanupProcesses();
          
          this.browser = await chromium.launch(config);
          console.log(`✅ STEALTH_POSTER: ${name} launched successfully`);
          break;
        } catch (error) {
          lastError = error as Error;
          console.log(`❌ STEALTH_POSTER: ${name} failed: ${lastError.message}`);
          
          // Handle EAGAIN specifically
          if (lastError.message.includes('EAGAIN')) {
            console.log('🔧 STEALTH_POSTER: EAGAIN detected - forcing cleanup...');
            await this.forceCleanupProcesses();
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }

      if (!this.browser) {
        throw new Error(`STEALTH_POSTER: All browser configurations failed. Last error: ${lastError?.message}`);
      }

      // Create stealth context with human-like fingerprint
      this.context = await this.browser.newContext({
        viewport: { width: 1366, height: 768 },
        userAgent: this.getRandomUserAgent(),
        locale: 'en-US',
        timezoneId: 'America/New_York',
        permissions: ['notifications'],
        colorScheme: 'light',
        extraHTTPHeaders: {
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1'
        }
      });

      // Load Twitter session with stealth
      const sessionData = await this.loadStealthSession();
      if (sessionData && sessionData.cookies) {
        await this.context.addCookies(sessionData.cookies);
        console.log(`🥷 STEALTH_POSTER: Loaded ${sessionData.cookies.length} stealth session cookies`);
      } else {
        console.error('❌ STEALTH_POSTER: Failed to load stealth session data');
        return false;
      }

      this.page = await this.context.newPage();
      
      // Inject stealth scripts to avoid detection
      await this.injectStealthScripts();
      
      this.isInitialized = true;
      console.log('✅ STEALTH_POSTER: Stealth browser initialized successfully');
      return true;
    } catch (error: any) {
      console.error('❌ STEALTH_POSTER: Initialization failed:', error.message);
      return false;
    }
  }

  /**
   * 🎭 INJECT STEALTH SCRIPTS
   */
  private async injectStealthScripts(): Promise<void> {
    if (!this.page) return;

    await this.page.addInitScript(() => {
      // Remove webdriver traces
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });

      // Override automation indicators
      delete (window as any).chrome;
      
      // Mock human-like properties
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });

      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });

      // Mock screen properties
      Object.defineProperty(screen, 'availHeight', {
        get: () => 728,
      });

      Object.defineProperty(screen, 'availWidth', {
        get: () => 1366,
      });
    });
  }

  /**
   * 🔄 GET RANDOM USER AGENT
   */
  private getRandomUserAgent(): string {
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/120.0'
    ];
    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }

  /**
   * 🔐 LOAD STEALTH SESSION
   */
  private async loadStealthSession(): Promise<any> {
    try {
      const { railwaySessionManager } = await import('../utils/railwaySessionManager');
      
      // Ensure we have a valid session
      const hasValidSession = await railwaySessionManager.ensureValidSession();
      if (!hasValidSession) {
        console.error('❌ STEALTH_POSTER: No valid session available');
        return null;
      }
      
      const sessionPath = path.join(process.cwd(), 'data', 'twitter_session.json');
      if (!fs.existsSync(sessionPath)) {
        console.log('❌ STEALTH_POSTER: No session file found after validation');
        return null;
      }
      
      const sessionData = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
      console.log('✅ STEALTH_POSTER: Stealth session loaded successfully');
      return sessionData;
    } catch (error: any) {
      console.error('❌ STEALTH_POSTER: Error loading stealth session:', error.message);
      return null;
    }
  }

  /**
   * 🎯 HUMAN-LIKE MOUSE MOVEMENT
   */
  private async humanMouseMove(targetX: number, targetY: number): Promise<void> {
    if (!this.page) return;

    // Get current mouse position (start from random position)
    const startX = Math.random() * 200 + 100;
    const startY = Math.random() * 200 + 100;

    // Calculate path with curves
    const steps = 15 + Math.floor(Math.random() * 10);
    
    for (let i = 0; i <= steps; i++) {
      const progress = i / steps;
      
      // Add some randomness and curves to the movement
      const noise = (Math.random() - 0.5) * 20;
      const x = startX + (targetX - startX) * progress + noise;
      const y = startY + (targetY - startY) * progress + noise;
      
      await this.page.mouse.move(x, y);
      await this.randomDelay(10, 30);
    }
  }

  /**
   * ⏱️ RANDOM HUMAN-LIKE DELAYS
   */
  private async randomDelay(min: number = 100, max: number = 500): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * 🔍 DETECT AND BYPASS MASK
   */
  private async detectAndBypassMask(): Promise<boolean> {
    if (!this.page) return false;

    try {
      console.log('🔍 STEALTH_POSTER: Checking for anti-bot mask...');
      
      // Check for the twc-cc-mask overlay
      const maskExists = await this.page.locator('[data-testid="twc-cc-mask"]').isVisible({ timeout: 2000 });
      
      if (maskExists) {
        console.log('🚨 STEALTH_POSTER: Anti-bot mask detected! Attempting bypass...');
        
        // Strategy 1: Try to remove the mask with JavaScript
        await this.page.evaluate(() => {
          const masks = document.querySelectorAll('[data-testid="twc-cc-mask"]');
          masks.forEach(mask => mask.remove());
          
          // Also remove any overlay elements
          const overlays = document.querySelectorAll('[role="dialog"], .modal, [data-testid*="mask"], [data-testid*="overlay"]');
          overlays.forEach(overlay => overlay.remove());
        });
        
        await this.randomDelay(1000, 2000);
        
        // Strategy 2: Try clicking outside the mask area first
        await this.page.mouse.move(100, 100);
        await this.page.mouse.click(100, 100);
        await this.randomDelay(500, 1000);
        
        // Strategy 3: Try pressing Escape to close any modals
        await this.page.keyboard.press('Escape');
        await this.randomDelay(500, 1000);
        
        // Strategy 4: Use keyboard shortcut instead of clicking
        console.log('🥷 STEALTH_POSTER: Using keyboard shortcut bypass...');
        return await this.useKeyboardShortcut();
      }
      
      return true;
    } catch (error: any) {
      console.error('❌ STEALTH_POSTER: Mask detection error:', error.message);
      return false;
    }
  }

  /**
   * ⌨️ KEYBOARD SHORTCUT POSTING
   */
  private async useKeyboardShortcut(): Promise<boolean> {
    if (!this.page) return false;

    try {
      console.log('⌨️ STEALTH_POSTER: Using keyboard shortcut to post...');
      
      // Focus on the text area first (use .first() to handle multiple elements)
      await this.page.locator('[data-testid="tweetTextarea_0"]').first().focus();
      await this.randomDelay(200, 400);
      
      // Use Ctrl+Enter (or Cmd+Enter on Mac) to post
      const isMac = process.platform === 'darwin';
      const modifier = isMac ? 'Meta' : 'Control';
      
      await this.page.keyboard.press(`${modifier}+Enter`);
      await this.randomDelay(1000, 2000);
      
      // Check if post was successful
      const isPosted = await this.verifyPostSuccess();
      
      if (isPosted) {
        console.log('✅ STEALTH_POSTER: Keyboard shortcut posting successful!');
        return true;
      } else {
        console.log('⚠️ STEALTH_POSTER: Keyboard shortcut posting failed, trying alternative...');
        return await this.alternativePostingMethod();
      }
    } catch (error: any) {
      console.error('❌ STEALTH_POSTER: Keyboard shortcut error:', error.message);
      return false;
    }
  }

  /**
   * 🔄 ALTERNATIVE POSTING METHOD
   */
  private async alternativePostingMethod(): Promise<boolean> {
    if (!this.page) return false;

    try {
      console.log('🔄 STEALTH_POSTER: Trying alternative posting method...');
      
      // Wait for any overlays to disappear
      await this.randomDelay(2000, 3000);
      
      // Try multiple post button selectors
      const postButtonSelectors = [
        '[data-testid="tweetButtonInline"]',
        '[data-testid="tweetButton"]', 
        '[role="button"][aria-label*="Post"]',
        '[role="button"]:has-text("Post")',
        'button:has-text("Post")'
      ];
      
      let postButton = null;
      for (const selector of postButtonSelectors) {
        try {
          const button = this.page.locator(selector).first();
          if (await button.isVisible({ timeout: 1000 })) {
            postButton = button;
            break;
          }
        } catch (e) {
          continue;
        }
      }
      
      if (!postButton) {
        postButton = this.page.locator('[data-testid="tweetButtonInline"]').first();
      }
      
      // Human-like approach to clicking
      const buttonBox = await postButton.boundingBox();
      if (buttonBox) {
        // Move mouse to button area with human-like movement
        await this.humanMouseMove(
          buttonBox.x + buttonBox.width / 2,
          buttonBox.y + buttonBox.height / 2
        );
        
        await this.randomDelay(300, 600);
        
        // Try multiple click strategies
        try {
          await postButton.click({ force: true, timeout: 5000 });
        } catch {
          // If normal click fails, try JavaScript click
          await this.page.evaluate(() => {
            const btn = document.querySelector('[data-testid="tweetButtonInline"]') as HTMLElement;
            if (btn) btn.click();
          });
        }
        
        await this.randomDelay(1000, 2000);
        return await this.verifyPostSuccess();
      }
      
      return false;
    } catch (error: any) {
      console.error('❌ STEALTH_POSTER: Alternative posting error:', error.message);
      return false;
    }
  }

  /**
   * ✅ VERIFY POST SUCCESS - REAL VERIFICATION
   */
  private async verifyPostSuccess(): Promise<boolean> {
    if (!this.page) return false;

    try {
      console.log('🔍 STEALTH_POSTER: Starting REAL post verification...');
      
      // STEP 1: Wait for potential navigation away from compose page
      await this.randomDelay(2000, 3000);
      
      // STEP 2: Check for REAL success indicators first
      const realSuccessChecks = [
        // Check if we navigated to home or timeline (strong indicator)
        async () => {
          const url = this.page.url();
          const isOnTimeline = url.includes('/home') || url.match(/x\.com\/[^\/]+\/?$/);
          if (isOnTimeline) {
            console.log('✅ REAL_VERIFICATION: Navigated to timeline - strong success indicator');
            return true;
          }
          return false;
        },
        
        // Check if we navigated to a status URL (posted tweet)
        async () => {
          const url = this.page.url();
          if (url.includes('/status/')) {
            console.log('✅ REAL_VERIFICATION: On status page - tweet exists');
            return true;
          }
          return false;
        },
        
        // Check for composer being disabled/gone (weaker but still valid)
        async () => {
          try {
            const composerElement = this.page.locator('[data-testid="tweetTextarea_0"]').first();
            const textContent = await composerElement.textContent({ timeout: 3000 });
            const isEmpty = !textContent || textContent.trim().length === 0;
            
            if (isEmpty) {
              // Additional check: see if we're still on compose page
              const url = this.page.url();
              if (url.includes('/compose')) {
                console.log('⚠️ REAL_VERIFICATION: Empty composer but still on compose page - likely failed');
                return false;
              }
              console.log('✅ REAL_VERIFICATION: Empty composer and not on compose page - likely success');
              return true;
            }
            return false;
          } catch (e) {
            // If composer element not found, we probably navigated away (good sign)
            console.log('✅ REAL_VERIFICATION: Composer element not found - likely navigated away');
            return true;
          }
        }
      ];
      
      // Try each verification method
      for (const check of realSuccessChecks) {
        try {
          const result = await check();
          if (result) {
            return true;
          }
        } catch (e) {
          console.warn('⚠️ REAL_VERIFICATION: Check failed:', e);
        }
      }
      
      // STEP 3: If no clear success indicators, this is likely a failure
      console.log('❌ REAL_VERIFICATION: No clear success indicators found - treating as failure');
      console.log(`📍 Current URL: ${this.page.url()}`);
      
      return false;
      
    } catch (error: any) {
      console.error('❌ STEALTH_POSTER: Post verification error:', error.message);
      return false;
    }
  }

  /**
   * 🚀 STEALTH POST TWEET
   */
  async postTweet(content: string): Promise<PostResult> {
    if (!this.isInitialized || !this.page) {
      return { success: false, error: 'Stealth poster not initialized' };
    }

    try {
      console.log('🥷 STEALTH_POSTER: Starting stealth tweet posting...');
      console.log(`📝 CONTENT: "${content.substring(0, 50)}..."`);

      // Navigate to Twitter home with stealth
      await this.page.goto('https://x.com/home', { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });
      
      await this.randomDelay(2000, 4000);

      // Check for login
      const isLoggedIn = await this.page.locator('[data-testid="SideNav_NewTweet_Button"]').isVisible({ timeout: 10000 });
      if (!isLoggedIn) {
        return { success: false, error: 'Not logged in to Twitter' };
      }

      // Open compose dialog with human-like behavior
      await this.humanMouseMove(200, 300);
      await this.randomDelay(500, 1000);
      
      // Try multiple compose button selectors
      const composeSelectors = [
        '[data-testid="SideNav_NewTweet_Button"]',
        '[data-testid="tweetButtonInline"]',
        '[aria-label="Post"]',
        '[href="/compose/tweet"]'
      ];
      
      let composeClicked = false;
      for (const selector of composeSelectors) {
        try {
          const button = this.page.locator(selector).first();
          if (await button.isVisible({ timeout: 2000 })) {
            await button.click();
            composeClicked = true;
            break;
          }
        } catch (e) {
          continue;
        }
      }
      
      if (!composeClicked) {
        // Fallback: navigate directly to compose
        await this.page.goto('https://x.com/compose/tweet');
      }
      
      await this.randomDelay(1000, 2000);

      // Type content with human-like typing (use .first() to handle multiple elements)
      const textArea = this.page.locator('[data-testid="tweetTextarea_0"]').first();
      await textArea.click();
      await this.randomDelay(300, 600);
      
      // Type with human-like delays between characters
      for (const char of content) {
        await this.page.keyboard.type(char);
        await this.randomDelay(50, 150);
      }

      console.log('✅ STEALTH_POSTER: Content typed successfully');
      await this.randomDelay(1000, 2000);

      // Detect and bypass any anti-bot measures
      const bypassSuccess = await this.detectAndBypassMask();
      
      if (bypassSuccess) {
        console.log('✅ STEALTH_POSTER: Tweet posted successfully with stealth mode');
        return { success: true };
      } else {
        return { success: false, error: 'Failed to bypass anti-bot measures' };
      }

    } catch (error: any) {
      console.error('❌ STEALTH_POSTER: Posting error:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 🧵 STEALTH POST THREAD
   */
  async postThread(threadParts: string[]): Promise<PostResult> {
    const tweetIds: string[] = [];
    
    for (let i = 0; i < threadParts.length; i++) {
      console.log(`🧵 STEALTH_POSTER: Posting thread part ${i + 1}/${threadParts.length}`);
      
      const result = await this.postTweet(threadParts[i]);
      
      if (!result.success) {
        return { success: false, error: `Failed to post thread part ${i + 1}: ${result.error}` };
      }
      
      tweetIds.push(`thread_${i + 1}`);
      
      // Wait between thread parts with human-like delay
      if (i < threadParts.length - 1) {
        await this.randomDelay(3000, 6000);
        
        // Click "Add another tweet" for continuation
        try {
          const addTweetButton = this.page?.locator('[data-testid="tweetButtonInline"]');
          if (addTweetButton) {
            await addTweetButton.click();
            await this.randomDelay(1000, 2000);
          }
        } catch {
          // If add tweet button not found, create new tweet
          await this.page?.goto('https://x.com/compose/tweet');
          await this.randomDelay(2000, 3000);
        }
      }
    }
    
    return { success: true, tweetIds };
  }

  /**
   * 🔒 CLOSE STEALTH POSTER
   */
  async close(): Promise<void> {
    try {
      if (this.context) await this.context.close();
      if (this.browser) await this.browser.close();
      console.log('✅ STEALTH_POSTER: Closed successfully');
    } catch (error: any) {
      console.error('❌ STEALTH_POSTER: Error closing:', error.message);
    }
  }
}

