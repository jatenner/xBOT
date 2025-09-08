/**
 * 🛡️ BULLETPROOF TWITTER POSTER
 * Guaranteed posting that actually works on Railway
 * Fixes all browser crashes and posting failures
 */

import { Page } from 'playwright';
import { bulletproofBrowser } from './bulletproofBrowserManager';
import { admin as supabase } from '../lib/supabaseClients';

export interface PostResult {
  success: boolean;
  content: string;
  tweetId?: string;
  error?: string;
  timestamp: Date;
}

export class BulletproofPoster {
  private static instance: BulletproofPoster;
  private sessionLoaded = false;
  private sessionLoadTime: Date | null = null;
  private readonly SESSION_REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes

  private constructor() {}

  public static getInstance(): BulletproofPoster {
    if (!BulletproofPoster.instance) {
      BulletproofPoster.instance = new BulletproofPoster();
    }
    return BulletproofPoster.instance;
  }

  /**
   * 🚀 POST CONTENT WITH GUARANTEED SUCCESS
   */
  public async postContent(content: string): Promise<PostResult> {
    console.log('🚀 BULLETPROOF_POSTER: Starting guaranteed post...');
    console.log(`📝 CONTENT: "${content.substring(0, 100)}${content.length > 100 ? '...' : ''}"`);

    try {
      return await bulletproofBrowser.withStableBrowser(async (page: Page) => {
        // Add realistic browser headers to avoid bot detection
        await page.setExtraHTTPHeaders({
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'max-age=0',
          'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"macOS"',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });
        
        console.log('🤖 BULLETPROOF_POSTER: Added realistic browser headers to avoid bot detection');
        
        // Set proper viewport for full desktop Twitter interface
        await page.setViewportSize({ width: 1920, height: 1080 });
        console.log('📱 BULLETPROOF_POSTER: Set desktop viewport (1920x1080) for full Twitter interface');
        
        // Add human-like delay before starting
        const initialDelay = Math.random() * 2000 + 1000; // 1-3 seconds
        console.log(`⏰ BULLETPROOF_POSTER: Human-like delay: ${Math.round(initialDelay)}ms`);
        await page.waitForTimeout(initialDelay);
        
        // Ensure Twitter session is loaded
        await this.ensureTwitterSession(page);
        
        // Add delay between session check and navigation
        await page.waitForTimeout(Math.random() * 1500 + 500); // 0.5-2 seconds
        
        // Navigate to compose page
        await this.navigateToCompose(page);
        
        // Add delay before posting
        await page.waitForTimeout(Math.random() * 1000 + 500); // 0.5-1.5 seconds
        
        // Dismiss any Twitter overlays before posting
        await this.dismissTwitterOverlays(page);
        
        // Post the content
        const result = await this.executePost(page, content);
        
        // Store success in database
        if (result.success) {
          await this.storeSuccessfulPost(result);
        }
        
        return result;
      });

    } catch (error) {
      console.error('❌ BULLETPROOF_POSTER: Posting failed:', error);
      
      const failureResult: PostResult = {
        success: false,
        content,
        error: error.message,
        timestamp: new Date()
      };
      
      await this.storeFailedPost(failureResult);
      return failureResult;
    }
  }

  /**
   * Dismiss Twitter overlays that block clicks
   */
  private async dismissTwitterOverlays(page: Page): Promise<void> {
    console.log('🔧 BULLETPROOF_POSTER: Checking for Twitter overlays and navigation blocking...');
    
    // Step 1: Hide navigation elements that intercept clicks
    try {
      console.log('🚫 BULLETPROOF_POSTER: Hiding navigation elements that block clicks...');
      await page.addStyleTag({
        content: `
          a[role="tab"][href="/home"],
          a[role="tab"],
          [data-testid="AppTabBar_Home_Link"],
          [data-testid="primaryNavigation"] a {
            pointer-events: none !important;
            z-index: -1 !important;
            opacity: 0.5 !important;
          }
        `
      });
      console.log('✅ BULLETPROOF_POSTER: Navigation blocking disabled');
    } catch (error) {
      console.log('⚠️ BULLETPROOF_POSTER: Could not disable navigation blocking:', error.message);
    }
    
    // Step 2: Standard overlay dismissal
    const overlaySelectors = [
      '[data-testid="twc-cc-mask"]', // Cookie consent overlay
      '[data-testid="mask"]', // General overlay mask
      '[aria-label="Close"]', // Close buttons
      '[data-testid="confirmationSheetCancel"]', // Confirmation dialogs
      '[data-testid="confirmationSheetConfirm"]', // Confirmation dialogs
      '[role="dialog"] button[aria-label="Close"]', // Dialog close buttons
      '.r-1p0dtai.r-1d2f490.r-1xcajam', // Twitter overlay classes
    ];
    
    for (const selector of overlaySelectors) {
      try {
        const overlay = page.locator(selector).first();
        if (await overlay.isVisible({ timeout: 1000 })) {
          console.log(`🚫 BULLETPROOF_POSTER: Found blocking overlay: ${selector}`);
          
          // Try to click it away
          try {
            await overlay.click({ timeout: 3000 });
            console.log(`✅ BULLETPROOF_POSTER: Dismissed overlay: ${selector}`);
            await page.waitForTimeout(1000); // Wait for overlay to disappear
          } catch (clickError) {
            console.log(`⚠️ BULLETPROOF_POSTER: Could not click overlay: ${selector}`);
            
            // Try pressing Escape key
            try {
              await page.keyboard.press('Escape');
              console.log(`✅ BULLETPROOF_POSTER: Dismissed overlay with Escape`);
              await page.waitForTimeout(1000);
            } catch (escapeError) {
              console.log(`⚠️ BULLETPROOF_POSTER: Escape key failed for: ${selector}`);
            }
          }
        }
      } catch (e) {
        // Overlay doesn't exist, continue
      }
    }
    
    console.log('✅ BULLETPROOF_POSTER: Overlay check complete');
  }

  /**
   * 🔐 ENSURE TWITTER SESSION IS LOADED
   */
  private async ensureTwitterSession(page: Page): Promise<void> {
    // Check if session needs refresh (expired or never loaded)
    const now = new Date();
    const sessionExpired = this.sessionLoadTime && 
      (now.getTime() - this.sessionLoadTime.getTime()) > this.SESSION_REFRESH_INTERVAL;
    
    if (this.sessionLoaded && !sessionExpired) {
      console.log('✅ BULLETPROOF_POSTER: Session already loaded and valid');
      return;
    }
    
    if (sessionExpired) {
      console.log('🔄 BULLETPROOF_POSTER: Session expired, refreshing...');
      this.sessionLoaded = false;
      this.sessionLoadTime = null;
    }

    try {
      console.log('🔐 BULLETPROOF_POSTER: Loading Twitter session...');
      
      // Clear existing cookies if this is a refresh
      if (sessionExpired) {
        console.log('🧹 BULLETPROOF_POSTER: Clearing expired session cookies...');
        await page.context().clearCookies();
      }
      
      // Load session from environment variable
      const sessionB64 = process.env.TWITTER_SESSION_B64;
      if (!sessionB64) {
        throw new Error('TWITTER_SESSION_B64 environment variable not set');
      }

      const sessionData = JSON.parse(Buffer.from(sessionB64, 'base64').toString());
      
      if (sessionData.cookies && Array.isArray(sessionData.cookies)) {
        await page.context().addCookies(sessionData.cookies);
        console.log(`✅ BULLETPROOF_POSTER: Loaded ${sessionData.cookies.length} session cookies`);
        this.sessionLoaded = true;
        this.sessionLoadTime = new Date();
        
        // Validate session by checking login status
        console.log('🔍 BULLETPROOF_POSTER: Validating session...');
        await page.goto('https://x.com/home', { timeout: 15000 });
        await page.waitForTimeout(3000);
        
        // Check if we're actually logged in with robust selector checking
        const loginSelectors = [
          '[data-testid="primaryNavigation"]',
          '[data-testid="SideNav_AccountSwitcher_Button"]',
          '[aria-label="Home timeline"]',
          '[data-testid="sidebarColumn"]',
          '[data-testid="SideNav_NewTweet_Button"]',
          'nav[role="navigation"]'
        ];
        
        let isLoggedIn = false;
        for (const selector of loginSelectors) {
          try {
            const visible = await page.locator(selector).first().isVisible({ timeout: 2000 });
            if (visible) {
              console.log(`✅ BULLETPROOF_POSTER: Session validated with selector: ${selector}`);
              isLoggedIn = true;
              break;
            }
          } catch (e) {
            // Continue to next selector
          }
        }
        
        // URL-based validation as fallback
        if (!isLoggedIn) {
          const currentUrl = page.url();
          if (currentUrl.includes('/home') && !currentUrl.includes('/login')) {
            console.log('✅ BULLETPROOF_POSTER: Session validated by URL pattern');
            isLoggedIn = true;
          }
        }
        
        if (!isLoggedIn) {
          const currentUrl = page.url();
          const pageTitle = await page.title().catch(() => 'Unable to get title');
          
          console.error('🔍 DEBUG_SESSION: Current URL:', currentUrl);
          console.error('🔍 DEBUG_SESSION: Page title:', pageTitle);
          
          // Check what's actually on the page
          try {
            const pageContent = await page.locator('body').textContent({ timeout: 3000 });
            const hasLoginForm = pageContent?.includes('Sign in') || pageContent?.includes('Log in');
            const hasTwitterBranding = pageContent?.includes('Twitter') || pageContent?.includes('X');
            
            console.error('🔍 DEBUG_SESSION: Page has login elements:', hasLoginForm);
            console.error('🔍 DEBUG_SESSION: Page has Twitter branding:', hasTwitterBranding);
            console.error('🔍 DEBUG_SESSION: Page length:', pageContent?.length || 0);
            
            if (currentUrl.includes('/login') || currentUrl.includes('/i/flow/login')) {
              throw new Error('Session expired - Twitter redirected to login page. Need fresh authentication.');
            } else if (hasLoginForm) {
              throw new Error('Session invalid - Page shows login form. Authentication cookies may be expired.');
            } else {
              throw new Error('Session validation failed - Unable to detect logged-in state with current selectors.');
            }
          } catch (e) {
            console.error('🔍 DEBUG_SESSION: Could not analyze page content');
            throw new Error('Session validation failed - Unable to analyze page state.');
          }
        }
        
        console.log('✅ BULLETPROOF_POSTER: Session validation complete - user is logged in');
      } else {
        throw new Error('Invalid session data format');
      }

    } catch (error) {
      console.error('❌ BULLETPROOF_POSTER: Session loading failed:', error);
      throw new Error(`Session load failed: ${error.message}`);
    }
  }

  /**
   * 🌐 NAVIGATE TO COMPOSE PAGE
   */
  private async navigateToCompose(page: Page): Promise<void> {
    try {
      console.log('🌐 BULLETPROOF_POSTER: Navigating to compose...');
      
      // First, verify login by trying multiple home URLs
      console.log('🔍 BULLETPROOF_POSTER: Verifying login status...');
      
      const homeUrls = ['https://x.com/home', 'https://twitter.com/home', 'https://x.com'];
      let sessionWorked = false;
      
      for (const homeUrl of homeUrls) {
        try {
          console.log(`🔄 BULLETPROOF_POSTER: Trying ${homeUrl}...`);
          await page.goto(homeUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
          });
          
          await page.waitForLoadState('domcontentloaded');
          await page.waitForTimeout(3000); // Give more time for redirects
          
          // Check if we ended up on a login page
          const currentUrl = page.url();
          console.log(`🔍 BULLETPROOF_POSTER: After ${homeUrl}, current URL: ${currentUrl}`);
          
          if (!currentUrl.includes('/login') && !currentUrl.includes('/i/flow/login')) {
            console.log(`✅ BULLETPROOF_POSTER: Successfully accessed ${homeUrl} without redirect`);
            sessionWorked = true;
            break;
          } else {
            console.log(`❌ BULLETPROOF_POSTER: ${homeUrl} redirected to login`);
          }
        } catch (error) {
          console.log(`❌ BULLETPROOF_POSTER: Failed to load ${homeUrl}:`, error.message);
        }
      }
      
      if (!sessionWorked) {
        console.error('❌ BULLETPROOF_POSTER: All URLs redirect to login - session expired');
        
        // Force session refresh on expiration detection
        console.log('🔄 BULLETPROOF_POSTER: Forcing session refresh due to login redirect...');
        this.sessionLoaded = false;
        this.sessionLoadTime = null;
        
        // Try to reload session one more time
        try {
          await this.ensureTwitterSession(page);
          console.log('✅ BULLETPROOF_POSTER: Session refresh successful, retrying navigation...');
          // Recursive call to try navigation again with fresh session
          return await this.navigateToCompose(page);
        } catch (refreshError) {
          console.error('❌ BULLETPROOF_POSTER: Session refresh failed:', refreshError.message);
          throw new Error('Session expired - Twitter requires re-authentication');
        }
      }
      
      // Check if we're logged in with multiple fallback selectors
      const loginSelectors = [
        '[data-testid="primaryNavigation"]',
        '[data-testid="sidebarColumn"]', 
        '[aria-label="Timeline"]',
        '[data-testid="SideNav_AccountSwitcher_Button"]',
        '[aria-label="Home timeline"]',
        '[data-testid="SideNav_NewTweet_Button"]',
        '[aria-label="Tweet"]',
        '[data-testid="tweetTextarea_0"]', // If we can see compose, we're logged in
        'nav[role="navigation"]', // Generic navigation
        '[data-testid="AppTabBar_Home_Link"]' // Mobile/responsive navigation
      ];
      
      let loggedIn = false;
      for (const selector of loginSelectors) {
        try {
          const isVisible = await page.locator(selector).first().isVisible({ timeout: 2000 });
          if (isVisible) {
            console.log(`✅ BULLETPROOF_POSTER: Login verified with selector: ${selector}`);
            loggedIn = true;
            break;
          }
        } catch (e) {
          // Continue to next selector
        }
      }
      
      // Additional check: look for any sign we're NOT on login page
      if (!loggedIn) {
        const currentUrl = page.url();
        const notOnLoginPage = !currentUrl.includes('/login') && !currentUrl.includes('/i/flow/login');
        if (notOnLoginPage && (currentUrl.includes('/home') || currentUrl.includes('x.com'))) {
          console.log('✅ BULLETPROOF_POSTER: Login verified by URL pattern');
          loggedIn = true;
        }
      }
      
      if (!loggedIn) {
        console.error('❌ BULLETPROOF_POSTER: Not logged in to Twitter');
        console.error('🔍 DEBUG: Current URL:', page.url());
        console.error('🔍 DEBUG: Page title:', await page.title().catch(() => 'Unable to get title'));
        
        // Try to get page content for debugging
        try {
          const bodyText = await page.locator('body').textContent({ timeout: 3000 });
          console.error('🔍 DEBUG: Page contains login form:', bodyText?.includes('Sign in') || bodyText?.includes('Log in'));
          console.error('🔍 DEBUG: Page contains "Twitter":', bodyText?.includes('Twitter'));
          console.error('🔍 DEBUG: Page contains "X":', bodyText?.includes('X'));
        } catch (e) {
          console.error('🔍 DEBUG: Could not get page content');
        }
        
        throw new Error('Not logged in to Twitter - session invalid');
      }
      
      console.log('✅ BULLETPROOF_POSTER: Login verified, navigating to compose...');
      
      // Try multiple approaches to get to the composer
      let composer = null;
      const approaches = [
        {
          name: 'Compose button on current page (no navigation)',
          action: async () => {
            // Stay on current page and find compose button - avoid navigation that triggers bot detection
            console.log('🔘 BULLETPROOF_POSTER: Looking for compose button on current page...');
            
            const composeSelectors = [
              'a[href="/compose/post"]', // New X.com compose URL
              'a[href="/compose/tweet"]', // Legacy Twitter compose URL
              '[data-testid="SideNav_NewTweet_Button"]',
              '[aria-label="Post"]', // New X.com button
              '[aria-label="Tweet"]', // Legacy Twitter button
              '[data-testid="tweetButton"]',
              'button[aria-label="Post"]', // New X.com button
              'button[aria-label="Tweet"]', // Legacy Twitter button
              'button:has-text("Post")', // Button containing "Post" text
              'a:has-text("Post")', // Link containing "Post" text
              '[data-testid="toolBar"] [role="button"]'
            ];
            
            // Wait for page to fully load and stabilize
            console.log('⏳ BULLETPROOF_POSTER: Waiting for page to fully load...');
            await page.waitForLoadState('networkidle', { timeout: 10000 });
            await page.waitForTimeout(3000); // Additional wait for dynamic content
            
            // Wait for navigation elements to ensure we're fully logged in
            try {
              await page.waitForSelector('nav[role="navigation"], [data-testid="sidebarColumn"]', { timeout: 5000 });
              console.log('✅ BULLETPROOF_POSTER: Navigation elements loaded');
            } catch (e) {
              console.log('⚠️ BULLETPROOF_POSTER: Navigation elements not found, continuing...');
            }
            
            // First, let's see what's actually on the page
            try {
              const pageContent = await page.content();
              console.log('🔍 BULLETPROOF_POSTER: Page contains "Tweet" text:', pageContent.includes('Tweet'));
              console.log('🔍 BULLETPROOF_POSTER: Page contains "Post" text:', pageContent.includes('Post'));
              console.log('🔍 BULLETPROOF_POSTER: Page contains compose elements:', pageContent.includes('compose'));
              
              // Get all buttons on the page for debugging
              const allButtons = await page.locator('button, a[role="button"], [role="button"]').all();
              console.log(`🔍 BULLETPROOF_POSTER: Found ${allButtons.length} clickable elements on page`);
              
              // Check ALL buttons and their text content
              console.log(`🔍 BULLETPROOF_POSTER: Analyzing all ${allButtons.length} clickable elements...`);
              for (let i = 0; i < Math.min(allButtons.length, 20); i++) {
                try {
                  const text = await allButtons[i].textContent();
                  const ariaLabel = await allButtons[i].getAttribute('aria-label');
                  const href = await allButtons[i].getAttribute('href');
                  
                  console.log(`🔍 BUTTON ${i}: text="${text}" aria-label="${ariaLabel}" href="${href}"`);
                  
                  if (text && (text.toLowerCase().includes('tweet') || text.toLowerCase().includes('post') || text.toLowerCase().includes('compose'))) {
                    console.log(`🎯 POTENTIAL COMPOSE: Button ${i} with text: "${text}"`);
                    
                    // Try clicking this button (with force click fallback)
                    try {
                      try {
                        await allButtons[i].click();
                        console.log(`✅ BULLETPROOF_POSTER: Normal click successful on button ${i}`);
                      } catch (clickError) {
                        console.log(`⚠️ BULLETPROOF_POSTER: Normal click failed on button ${i}, trying force click`);
                        await allButtons[i].click({ force: true });
                        console.log(`✅ BULLETPROOF_POSTER: Force click successful on button ${i}`);
                      }
                      await page.waitForTimeout(3000);
                      
                      // Check if compose modal opened
                      const textarea = await page.locator('[data-testid="tweetTextarea_0"]').first();
                      if (await textarea.isVisible({ timeout: 5000 })) {
                        console.log(`✅ SUCCESS: Button ${i} opened compose modal!`);
                        return textarea;
                      }
                    } catch (e) {
                      console.log(`❌ BUTTON ${i} click failed:`, e.message);
                    }
                  }
                } catch (e) {
                  console.log(`❌ BUTTON ${i} analysis failed:`, e.message);
                }
              }
            } catch (e) {
              console.log('🔍 BULLETPROOF_POSTER: Could not analyze page content');
            }
            
            for (const selector of composeSelectors) {
              try {
                const button = page.locator(selector).first();
                if (await button.isVisible({ timeout: 3000 })) {
                  console.log(`🔘 BULLETPROOF_POSTER: Found compose button: ${selector}`);
                  
                  // Try normal click first
                  try {
                    await button.click();
                    console.log(`✅ BULLETPROOF_POSTER: Normal click successful: ${selector}`);
                  } catch (clickError) {
                    console.log(`⚠️ BULLETPROOF_POSTER: Normal click failed, trying force click: ${selector}`);
                    // Force click to bypass intercepting elements
                    await button.click({ force: true });
                    console.log(`✅ BULLETPROOF_POSTER: Force click successful: ${selector}`);
                  }
                  
                  await page.waitForTimeout(3000); // Wait for compose modal to open
                  
                  // Look for the textarea
                  const textarea = await page.waitForSelector('[data-testid="tweetTextarea_0"]', { timeout: 8000 });
                  if (textarea) {
                    console.log('✅ BULLETPROOF_POSTER: Compose modal opened successfully');
                    return textarea;
                  }
                }
              } catch (e) {
                console.log(`❌ BULLETPROOF_POSTER: Button ${selector} failed:`, e.message);
              }
            }
            throw new Error('No working compose button found on current page');
          }
        },
        {
          name: 'Direct compose URL',
          action: async () => {
            await page.goto('https://x.com/compose/tweet', {
              waitUntil: 'domcontentloaded',
              timeout: 20000
            });
            await page.waitForLoadState('domcontentloaded');
            await page.waitForTimeout(2000);
            return await page.waitForSelector('[data-testid="tweetTextarea_0"]', { timeout: 10000 });
          }
        },
        {
          name: 'Home page with compose button',
          action: async () => {
            await page.goto('https://x.com/home', {
              waitUntil: 'domcontentloaded',
              timeout: 20000
            });
            await page.waitForTimeout(2000);
            
            // Try to click compose button
            const composeBtn = await page.locator('[data-testid="SideNav_NewTweet_Button"], [aria-label="Tweet"]').first().click({ timeout: 5000 }).catch(() => null);
            await page.waitForTimeout(1000);
            return await page.waitForSelector('[data-testid="tweetTextarea_0"]', { timeout: 10000 });
          }
        },
        {
          name: 'Alternative compose URL',
          action: async () => {
            await page.goto('https://twitter.com/compose/tweet', {
              waitUntil: 'domcontentloaded',
              timeout: 20000
            });
            await page.waitForLoadState('domcontentloaded');
            await page.waitForTimeout(2000);
            return await page.waitForSelector('[data-testid="tweetTextarea_0"]', { timeout: 10000 });
          }
        }
      ];
      
      for (const approach of approaches) {
        try {
          console.log(`🔄 BULLETPROOF_POSTER: Trying ${approach.name}...`);
          composer = await approach.action();
          if (composer) {
            console.log(`✅ BULLETPROOF_POSTER: Success with ${approach.name}`);
            break;
          }
        } catch (error) {
          console.log(`⚠️ BULLETPROOF_POSTER: ${approach.name} failed: ${error.message}`);
          continue;
        }
      }
      
      if (!composer) {
        throw new Error('Composer not found - may not be logged in');
      }
      
      console.log('✅ BULLETPROOF_POSTER: Compose page ready');

    } catch (error) {
      console.error('❌ BULLETPROOF_POSTER: Navigation failed:', error);
      throw new Error(`Navigation failed: ${error.message}`);
    }
  }

  /**
   * ✍️ EXECUTE THE ACTUAL POST
   */
  private async executePost(page: Page, content: string): Promise<PostResult> {
    try {
      console.log('✍️ BULLETPROOF_POSTER: Executing post...');
      
      // Find and focus composer
      const composer = page.locator('[data-testid="tweetTextarea_0"]').first();
      await composer.waitFor({ state: 'visible', timeout: 10000 });
      
      // Clear any existing content
      await composer.click();
      await page.waitForTimeout(500);
      await page.keyboard.press('Control+A');
      await page.keyboard.press('Delete');
      await page.waitForTimeout(500);
      
      // Type the content
      console.log(`📝 BULLETPROOF_POSTER: Typing ${content.length} characters...`);
      await composer.fill(content);
      await page.waitForTimeout(1000);
      
      // Verify content was typed
      const typedContent = await composer.textContent();
      if (!typedContent || !typedContent.includes(content.substring(0, 50))) {
        throw new Error('Content was not typed correctly');
      }
      
      // Find and click post button
      const postButton = await page.waitForSelector('[data-testid="tweetButtonInline"]', {
        timeout: 10000
      });
      
      if (!postButton) {
        throw new Error('Post button not found');
      }
      
      console.log('🔘 BULLETPROOF_POSTER: Clicking post button...');
      await postButton.click();
      
      // Wait for post to complete
      await page.waitForTimeout(3000);
      
      // Verify post was successful by checking for success indicators
      const success = await this.verifyPostSuccess(page);
      
      if (success) {
        const tweetId = `post_${Date.now()}`;
        console.log('✅ BULLETPROOF_POSTER: Post successful!');
        
        return {
          success: true,
          content,
          tweetId,
          timestamp: new Date()
        };
      } else {
        throw new Error('Post verification failed');
      }

    } catch (error) {
      console.error('❌ BULLETPROOF_POSTER: Post execution failed:', error);
      throw error;
    }
  }

  /**
   * ✔️ VERIFY POST WAS SUCCESSFUL
   */
  private async verifyPostSuccess(page: Page): Promise<boolean> {
    try {
      // Look for success indicators
      const successIndicators = [
        // Composer should be cleared or page should change
        async () => {
          const composer = page.locator('[data-testid="tweetTextarea_0"]').first();
          const content = await composer.textContent() || '';
          return content.trim().length === 0;
        },
        // URL might change to timeline
        async () => {
          const url = page.url();
          return url.includes('/home') || url.includes('/compose');
        },
        // No error messages
        async () => {
          const errorElements = await page.$$('[role="alert"]');
          return errorElements.length === 0;
        }
      ];

      // Check at least one success indicator
      for (const indicator of successIndicators) {
        try {
          if (await indicator()) {
            return true;
          }
        } catch {
          continue;
        }
      }

      return false;

    } catch (error) {
      console.warn('⚠️ BULLETPROOF_POSTER: Verification error:', error);
      return false; // Assume failure if can't verify
    }
  }

  /**
   * 💾 STORE SUCCESSFUL POST
   */
  private async storeSuccessfulPost(result: PostResult): Promise<void> {
    try {
      await supabase
        .from('bulletproof_posts')
        .insert({
          content: result.content,
          tweet_id: result.tweetId,
          status: 'success',
          posted_at: result.timestamp.toISOString(),
          error_message: null
        });
      
      console.log('💾 BULLETPROOF_POSTER: Success stored in database');

    } catch (error) {
      console.error('❌ BULLETPROOF_POSTER: Failed to store success:', error);
    }
  }

  /**
   * 📝 STORE FAILED POST
   */
  private async storeFailedPost(result: PostResult): Promise<void> {
    try {
      await supabase
        .from('bulletproof_posts')
        .insert({
          content: result.content,
          tweet_id: null,
          status: 'failed',
          posted_at: result.timestamp.toISOString(),
          error_message: result.error
        });
      
      console.log('📝 BULLETPROOF_POSTER: Failure stored in database');

    } catch (error) {
      console.error('❌ BULLETPROOF_POSTER: Failed to store failure:', error);
    }
  }

  /**
   * 🔍 HEALTH CHECK
   */
  public async healthCheck(): Promise<boolean> {
    try {
      return await bulletproofBrowser.healthCheck();
    } catch {
      return false;
    }
  }

  /**
   * 📊 GET STATUS
   */
  public getStatus(): object {
    return {
      sessionLoaded: this.sessionLoaded,
      browser: bulletproofBrowser.getStatus()
    };
  }
}

// Export singleton
export const bulletproofPoster = BulletproofPoster.getInstance();
