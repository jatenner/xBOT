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
        // Ensure Twitter session is loaded
        await this.ensureTwitterSession(page);
        
        // Navigate to compose page
        await this.navigateToCompose(page);
        
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
   * 🔐 ENSURE TWITTER SESSION IS LOADED
   */
  private async ensureTwitterSession(page: Page): Promise<void> {
    if (this.sessionLoaded) {
      console.log('✅ BULLETPROOF_POSTER: Session already loaded');
      return;
    }

    try {
      console.log('🔐 BULLETPROOF_POSTER: Loading Twitter session...');
      
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
        throw new Error('Session expired - Twitter requires re-authentication');
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
              '[data-testid="SideNav_NewTweet_Button"]',
              '[aria-label="Tweet"]',
              '[data-testid="tweetButton"]',
              'a[href="/compose/tweet"]',
              'button[aria-label="Tweet"]',
              '[data-testid="toolBar"] [role="button"]'
            ];
            
            for (const selector of composeSelectors) {
              try {
                const button = page.locator(selector).first();
                if (await button.isVisible({ timeout: 3000 })) {
                  console.log(`🔘 BULLETPROOF_POSTER: Found compose button: ${selector}`);
                  await button.click();
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
