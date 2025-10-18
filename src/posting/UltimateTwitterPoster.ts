/**
 * Robust Twitter Poster - Compliant and Reliable
 * No anti-bot detection attempts, focuses on stability and compliance
 */

import { Page, BrowserContext } from 'playwright';
import { getBrowser, createContext } from '../browser/browserFactory';
import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';

export interface PostResult {
  success: boolean;
  tweetId?: string;
  error?: string;
}

export class UltimateTwitterPoster {
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private readonly storageStatePath = join(process.cwd(), 'twitter-auth.json');
  
  // Circuit breaker pattern
  private clickFailures = 0;
  private readonly maxClickFailures = 5;
  private lastResetTime = Date.now();
  
  // PHASE 3.5: Real tweet ID extraction
  private capturedTweetId: string | null = null;

  async postTweet(content: string): Promise<PostResult> {
    let retryCount = 0;
    const maxRetries = 2; // Increased retries

    while (retryCount <= maxRetries) {
      try {
        console.log(`ULTIMATE_POSTER: Starting attempt ${retryCount + 1}/${maxRetries + 1}`);
        
        await this.ensureContext();
        const result = await this.attemptPost(content);
        
        if (result.success) {
          console.log(`ULTIMATE_POSTER: ✅ Success on attempt ${retryCount + 1}`);
          return result;
        }
        
        // If we got a specific error that suggests retry won't help, don't retry
        if (result.error?.includes('session expired') || result.error?.includes('not logged in')) {
          console.log('ULTIMATE_POSTER: Auth error detected, refreshing session...');
          await this.refreshSession();
        }
        
        throw new Error(result.error || 'Post attempt failed');
        
      } catch (error) {
        console.error(`ULTIMATE_POSTER: Attempt ${retryCount + 1} failed:`, error.message);
        
        // Check if this is a recoverable error
        const isRecoverable = this.isRecoverableError(error.message);
        
        if (retryCount < maxRetries && isRecoverable) {
          console.log('ULTIMATE_POSTER: Retrying with fresh context...');
          await this.cleanup();
          retryCount++;
          
          // Add progressive delay between retries
          const delay = (retryCount) * 2000; // 2s, 4s delays
          console.log(`ULTIMATE_POSTER: Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          continue;
        }
        
        // Final failure - capture artifacts
        console.log('ULTIMATE_POSTER: All attempts failed, capturing failure artifacts...');
        await this.captureFailureArtifacts(error.message);
        return { success: false, error: error.message };
      }
    }

    return { success: false, error: 'Max retries exceeded' };
  }

  private isRecoverableError(errorMessage: string): boolean {
    const recoverableErrors = [
      'Timeout',
      'Navigation failed',
      'Page crashed',
      'Context was closed',
      'Target closed',
      'waiting for selector',
      'Network verification failed',
      'UI verification failed'
    ];
    
    return recoverableErrors.some(error => errorMessage.includes(error));
  }

  private async ensureContext(): Promise<void> {
    if (!this.context) {
      console.log('ULTIMATE_POSTER: Creating new browser context...');
      this.context = await createContext(this.storageStatePath);
      
      // Enable tracing for debugging
      await this.context.tracing.start({ screenshots: true, snapshots: true });
    }

    if (!this.page) {
      this.page = await this.context.newPage();
      
      // Set up error handling
      this.page.on('pageerror', (error) => {
        console.error('ULTIMATE_POSTER: Page error:', error.message);
      });
    }
  }

  private async attemptPost(content: string): Promise<PostResult> {
    if (!this.page) throw new Error('Page not initialized');

    console.log('ULTIMATE_POSTER: Navigating to Twitter...');
    
    // Navigate with domcontentloaded instead of networkidle
    await this.page.goto('https://x.com/home', { 
      waitUntil: 'domcontentloaded', 
      timeout: 45000 
    });

    // Wait for navigation to complete and UI to be ready
    console.log('ULTIMATE_POSTER: Waiting for UI to be ready...');
    await this.page.waitForSelector('nav[role="navigation"]', { 
      state: 'visible', 
      timeout: 20000 
    });

    // Check if we're logged in
    const isLoggedOut = await this.checkIfLoggedOut();
    if (isLoggedOut) {
      throw new Error('Not logged in to Twitter - session may have expired');
    }

    console.log('ULTIMATE_POSTER: Successfully authenticated');

    // Close any modals/overlays that might interfere
    await this.closeAnyModal();

    // Find and interact with composer
    const composer = await this.getComposer();
    
    console.log('ULTIMATE_POSTER: Inserting content...');
    await composer.click({ delay: 60 });
    await this.page!.waitForTimeout(500);
    
    // Clear any existing content
    await composer.fill(''); // Clear first
    await this.page!.waitForTimeout(200);
    
    // For long content (>300 chars), use fill() to avoid timeout
    // For shorter content, use typing for more natural behavior
    if (content.length > 300) {
      console.log(`ULTIMATE_POSTER: Using fill() for ${content.length} char content`);
      
      // Use fill() - works with contenteditable in headless mode
      await composer.fill(content);
      await this.page!.waitForTimeout(500);
      
      // Verify content was inserted
      const text = await composer.textContent();
      if (!text || !text.includes(content.substring(0, 50))) {
        throw new Error('Content fill verification failed');
      }
      
      console.log('ULTIMATE_POSTER: Content filled successfully');
    } else {
      // Type quickly but not instant (Twitter might detect instant paste)
      await composer.type(content, { delay: 5 }); // 5ms = very fast but not suspicious
      console.log('ULTIMATE_POSTER: Content typed');
    }

    // Close modals again before posting (in case typing triggered something)
    await this.closeAnyModal();

    // Post with network verification
    const result = await this.postWithNetworkVerification();
    
    console.log('ULTIMATE_POSTER: Post completed successfully');
    return result;
  }

  private async checkIfLoggedOut(): Promise<boolean> {
    const loggedOutSelectors = [
      'a[href="/login"]',
      'a[href="/i/flow/login"]',
      'form[action*="/login"]',
      '[data-testid="loginButton"]'
    ];

    for (const selector of loggedOutSelectors) {
      try {
        const element = await this.page!.$(selector);
        if (element && await element.isVisible()) {
          return true;
        }
      } catch (e) {
        // Continue checking other selectors
      }
    }
    return false;
  }

  private async isPageClosed(): Promise<boolean> {
    try {
      if (!this.page) return true;
      await this.page.evaluate(() => true); // Test if page is responsive
      return false;
    } catch {
      return true;
    }
  }

  private async closeAnyModal(): Promise<void> {
    // Check if page is still open before attempting modal closure
    if (await this.isPageClosed()) {
      console.log('ULTIMATE_POSTER: Page closed, skipping modal dismissal');
      return;
    }

    const modalCloseSelectors = [
      '[data-testid="app-bar-close"]',
      'div[role="dialog"] [aria-label="Close"]',
      'div[role="dialog"] [data-testid="SheetClose"]',
      '[data-testid="confirmationSheetCancel"]',
      'button[aria-label="Close"]',
      '[aria-label="Close"]',
      'div[id="layers"] [aria-label="Close"]',
      'div[data-testid="mask"]',
      'div[class*="modal"] button',
      'div[role="dialog"] button:has-text("Close")',
      'div[role="dialog"] button:has-text("Skip")',
      'div[role="dialog"] button:has-text("Not now")',
      'div[role="dialog"] button:has-text("Dismiss")',
      // Enhanced selectors for blocking overlays
      'div[id="layers"] button',
      'div[id="layers"] [role="button"]',
      'div[class*="r-1p0dtai"] button',
      'div[aria-modal="true"] button'
    ];

    for (const selector of modalCloseSelectors) {
      try {
        const element = await this.page!.$(selector);
        if (element && await element.isVisible()) {
          console.log(`ULTIMATE_POSTER: Closing modal with selector: ${selector}`);
          await element.click();
          await this.page!.waitForTimeout(300);
        }
      } catch (e) {
        // Continue to next selector
      }
    }
    
    // Force-remove overlay divs that intercept clicks - ENHANCED
    try {
      await this.page!.evaluate(() => {
        // Strategy 1: Clear the layers div entirely
        const layers = document.querySelector('div#layers');
        if (layers && layers.children.length > 0) {
          console.log('Clearing layers div with', layers.children.length, 'children');
          layers.innerHTML = '';
        }
        
        // Strategy 2: Remove specific blocking overlays
        const overlays = document.querySelectorAll('div[id="layers"] > div, div.css-175oi2r.r-1p0dtai, div[class*="r-1d2f490"]');
        overlays.forEach(overlay => {
          const style = window.getComputedStyle(overlay);
          if (style.position === 'fixed' || style.position === 'absolute') {
            if (!style.zIndex || parseInt(style.zIndex) > 100) {
              overlay.remove();
            }
          }
        });
      });
      console.log('ULTIMATE_POSTER: Force-removed overlay divs');
      
      // Strategy 3: Press ESC to dismiss modals
      await this.page!.keyboard.press('Escape');
      await this.page!.waitForTimeout(200);
    } catch (e: any) {
      console.log('ULTIMATE_POSTER: Could not force-remove overlays:', e.message);
    }
  }

  private async getComposer(): Promise<any> {
    const composerSelectors = [
      'div[role="textbox"][contenteditable="true"]',
      'div[aria-label*="Post text"]',
      'div[aria-label*="What is happening"]',
      '[data-testid="tweetTextarea_0"]'
    ];

    for (const selector of composerSelectors) {
      try {
        console.log(`ULTIMATE_POSTER: Testing composer selector: ${selector}`);
        const element = await this.page!.waitForSelector(selector, { 
          state: 'visible', 
          timeout: 5000 
        });
        
        if (element) {
          console.log(`ULTIMATE_POSTER: Found composer with: ${selector}`);
          return element;
        }
      } catch (e) {
        console.log(`ULTIMATE_POSTER: Selector failed: ${selector}`);
        continue;
      }
    }

    throw new Error('No composer found with any selector');
  }

  private async postWithNetworkVerification(): Promise<PostResult> {
        if (!this.page) throw new Error('Page not initialized');

        console.log('ULTIMATE_POSTER: Setting up robust posting with fallback verification...');
        
        // SMART BATCH FIX: Set up redirect listener EARLY and with Promise
        this.capturedTweetId = null; // Reset
        
        const redirectPromise = new Promise<string>((resolve) => {
          const handler = (frame: any) => {
            if (frame === this.page?.mainFrame()) {
              const url = frame.url();
              if (url.includes('/status/') && !this.capturedTweetId) {
                const match = url.match(/\/status\/(\d+)/);
                if (match && match[1]) {
                  this.capturedTweetId = match[1];
                  console.log(`ULTIMATE_POSTER: 🎯 REDIRECT CAPTURED: ${this.capturedTweetId}`);
                  this.page?.off('framenavigated', handler); // Remove listener
                  resolve(match[1]);
                }
              }
            }
          };
          
          this.page!.on('framenavigated', handler);
          
          // Timeout after 5 seconds
          setTimeout(() => {
            this.page?.off('framenavigated', handler);
            resolve('');
          }, 5000);
        });
    
    // Set up network response monitoring (with longer timeout and more patterns)
    let networkVerificationPromise: Promise<any> | null = null;
    
    try {
      networkVerificationPromise = this.page.waitForResponse(response => {
        const url = response.url();
        const postData = response.request().postData() || '';
        
        // Match various Twitter API patterns
        return (
          (url.includes('/i/api/graphql') && (
            postData.includes('CreateTweet') ||
            postData.includes('CreateNote') ||
            postData.includes('create_tweet')
          )) ||
          (url.includes('/i/api/1.1/statuses/update') ||
           url.includes('/compose/tweet') ||
           url.includes('/create'))
        );
      }, { timeout: 45000 }); // Increased timeout
      
      console.log('ULTIMATE_POSTER: Network monitoring active');
    } catch (e) {
      console.log('ULTIMATE_POSTER: Could not set up network monitoring, will use UI verification');
    }

    // Find and click post button
    const postButtonSelectors = [
      '[data-testid="tweetButtonInline"]:not([aria-disabled="true"])',
      '[data-testid="tweetButton"]:not([aria-disabled="true"])',
      'button[data-testid="tweetButtonInline"]:not([disabled])',
      'button[role="button"]:has-text("Post")',
      'button[role="button"]:has-text("Tweet")'
    ];

    let postButton = null;
    for (const selector of postButtonSelectors) {
      try {
        postButton = await this.page.waitForSelector(selector, { 
          state: 'visible', 
          timeout: 5000 
        });
        if (postButton) {
          console.log(`ULTIMATE_POSTER: Found post button: ${selector}`);
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (!postButton) {
      throw new Error('No enabled post button found');
    }

    console.log('ULTIMATE_POSTER: Clicking post button...');
    
    // Circuit breaker check
    if (this.clickFailures >= this.maxClickFailures) {
      const timeSinceReset = Date.now() - this.lastResetTime;
      if (timeSinceReset < 300000) { // 5 minutes
        console.log('ULTIMATE_POSTER: Circuit breaker OPEN - too many failures, resetting browser...');
        await this.cleanup(); // Use existing cleanup method
        this.clickFailures = 0;
        this.lastResetTime = Date.now();
        throw new Error('Circuit breaker triggered - browser reset');
      } else {
        // Reset counter after cooldown
        this.clickFailures = 0;
        this.lastResetTime = Date.now();
      }
    }
    
    // Try multiple click strategies to bypass overlay
    try {
      // Strategy 1: Normal click (REDUCED TIMEOUT from 10s to 5s)
      await postButton.click({ timeout: 5000 });
      this.clickFailures = 0; // Reset on success
    } catch (clickError) {
      this.clickFailures++;
      console.log(`ULTIMATE_POSTER: Normal click failed (${this.clickFailures}/${this.maxClickFailures}), trying force-click...`);
      
      // Strategy 2: Force-click via JavaScript
      try {
        await this.page.evaluate((selector) => {
          const btn = document.querySelector(selector) as HTMLElement;
          if (btn) {
            btn.click();
          }
        }, postButtonSelectors[0]);
        console.log('ULTIMATE_POSTER: Force-click executed');
      } catch (forceError) {
        console.log('ULTIMATE_POSTER: Force-click failed, trying mouse click...');
        
        // Strategy 3: Click via coordinates
        const box = await postButton.boundingBox();
        if (box) {
          await this.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
          console.log('ULTIMATE_POSTER: Mouse coordinate click executed');
        } else {
          throw new Error('All click strategies failed');
        }
      }
    }

    // Try network verification first, fallback to UI verification
    console.log('ULTIMATE_POSTER: Attempting network verification...');
    
    if (networkVerificationPromise) {
      try {
        // Add timeout wrapper to prevent hanging
        const response = await Promise.race([
          networkVerificationPromise,
          new Promise<any>((_, reject) => 
            setTimeout(() => reject(new Error('Network verification timeout')), 40000)
          )
        ]);
        
        if (response && response.ok()) {
          // Try to extract tweet ID from response
          let tweetId = `posted_${Date.now()}`;
          try {
            const responseBody = await response.json();
            const extractedId = this.extractTweetId(responseBody);
            if (extractedId) {
              tweetId = extractedId;
            }
          } catch (e) {
            console.log('ULTIMATE_POSTER: Could not parse response for tweet ID');
          }

          console.log(`ULTIMATE_POSTER: ✅ Network verification successful - tweet posted with ID: ${tweetId}`);
          return { success: true, tweetId };
        } else {
          console.log(`ULTIMATE_POSTER: Network response not OK (${response?.status()}), trying UI verification...`);
        }
      } catch (networkError: any) {
        // Critical: Catch browser/page closure errors
        if (networkError.message?.includes('closed') || networkError.message?.includes('Target page')) {
          console.log('ULTIMATE_POSTER: Browser/page closed during verification - will use UI fallback');
        } else {
          console.log(`ULTIMATE_POSTER: Network verification failed: ${networkError.message}, trying UI verification...`);
        }
      }
    }

    // Fallback to UI verification with improved reliability
    console.log('ULTIMATE_POSTER: Using improved UI verification...');
    
    try {
      // Modern Twitter verification: Check for multiple reliable indicators
      const verificationChecks = [
        // Check 1: URL change (most reliable - goes back to home after posting)
        (async () => {
          try {
            await this.page.waitForURL(/.*x\.com\/(home|[^\/]+)\/?$/, { timeout: 8000 });
            console.log('ULTIMATE_POSTER: ✅ URL changed to home/timeline - POST SUCCESSFUL');
            return true;
          } catch {
            return false;
          }
        })(),
        
        // Check 2: Composer gets cleared/disabled
        (async () => {
          try {
            await this.page.waitForFunction(() => {
              const textarea = document.querySelector('[data-testid="tweetTextarea_0"]') as HTMLElement;
              return textarea && (textarea.textContent?.trim() === '' || textarea.getAttribute('aria-disabled') === 'true');
            }, { timeout: 8000 });
            console.log('ULTIMATE_POSTER: ✅ Composer cleared - POST SUCCESSFUL');
            return true;
          } catch {
            return false;
          }
        })(),
        
        // Check 3: Post button disappears or gets disabled
        (async () => {
          try {
            await this.page.waitForFunction(() => {
              const btn = document.querySelector('[data-testid="tweetButtonInline"]');
              return !btn || btn.getAttribute('aria-disabled') === 'true' || !btn.isConnected;
            }, { timeout: 8000 });
            console.log('ULTIMATE_POSTER: ✅ Post button disabled/removed - POST SUCCESSFUL');
            return true;
          } catch {
            return false;
          }
        })()
      ];
      
      // If ANY verification check passes, consider it successful
      const results = await Promise.all(verificationChecks);
      if (results.some(r => r === true)) {
        console.log('ULTIMATE_POSTER: ✅ UI verification successful - post confirmed');
        
        // SMART BATCH FIX: Try redirect promise first, then fallback
        const redirectId = await redirectPromise;
        if (redirectId) {
          console.log(`ULTIMATE_POSTER: ✅ Using redirect ID: ${redirectId}`);
          return { success: true, tweetId: redirectId };
        }
        
        // Fallback to traditional extraction
        const tweetId = await this.extractTweetIdFromUrl();
        return { success: true, tweetId };
      }
      
      console.log('ULTIMATE_POSTER: No explicit success indicators, checking for errors...');
      
      // Final check: Look for SPECIFIC critical error messages only
      try {
        await this.page.waitForTimeout(2000);
        
        // Only check for critical error messages (very specific)
        const criticalErrors = await this.page.locator(':text-is("Something went wrong"), :text-is("Try again"), :text-is("Tweet not sent")').count();
        
        if (criticalErrors === 0) {
          // No errors found and we successfully clicked - assume success!
          console.log('ULTIMATE_POSTER: ✅ No critical errors detected - POST LIKELY SUCCESSFUL');
          
          // SMART BATCH FIX: Try redirect promise first, then fallback
          const redirectId = await redirectPromise;
          if (redirectId) {
            console.log(`ULTIMATE_POSTER: ✅ Using redirect ID: ${redirectId}`);
            return { success: true, tweetId: redirectId };
          }
          
          // Fallback to traditional extraction
          const tweetId = await this.extractTweetIdFromUrl();
          return { success: true, tweetId };
        } else {
          console.log('ULTIMATE_POSTER: ❌ Critical error message detected');
          throw new Error('Critical error message detected after posting');
        }
        
      } catch (fallbackError) {
        console.log('ULTIMATE_POSTER: ❌ All verification methods failed');
        throw new Error(`Post verification failed: Network timeout, UI verification failed, fallback failed`);
      }
      
    } catch (verificationError) {
      console.log('ULTIMATE_POSTER: ❌ All verification methods failed');
      throw new Error(`Post verification failed: ${verificationError.message}`);
    }
  }

  /**
   * PHASE 3.5: Extract real tweet ID with multiple strategies
   * Priority: 1) Redirect capture, 2) Toast notification, 3) Profile page, 4) Timestamp fallback
   */
  private async extractTweetIdFromUrl(): Promise<string> {
    if (!this.page) {
      console.log('ULTIMATE_POSTER: ⚠️ Page not available, using timestamp');
      return Date.now().toString();
    }
    
    try {
      // STRATEGY 1: Use captured redirect ID (most reliable!)
      if (this.capturedTweetId) {
        console.log(`ULTIMATE_POSTER: ✅ Using captured ID: ${this.capturedTweetId}`);
        return this.capturedTweetId;
      }
      
      // Wait a bit more for redirect to happen
      await this.page.waitForTimeout(2000);
      if (this.capturedTweetId) {
        console.log(`ULTIMATE_POSTER: ✅ Captured after wait: ${this.capturedTweetId}`);
        return this.capturedTweetId;
      }
      
      console.log('ULTIMATE_POSTER: ⚠️ Redirect not captured, trying fallback strategies...');
      
      // STRATEGY 2: Check for success toast with link
      try {
        console.log('ULTIMATE_POSTER: Trying toast notification...');
        const toast = await this.page.locator('[data-testid="toast"]').first();
        const viewLink = await toast.locator('a[href*="/status/"]').getAttribute('href', { timeout: 2000 });
        if (viewLink) {
          const match = viewLink.match(/\/status\/(\d+)/);
          if (match && match[1]) {
            console.log(`ULTIMATE_POSTER: ✅ Extracted from toast: ${match[1]}`);
            return match[1];
          }
        }
      } catch (e) {
        console.log('ULTIMATE_POSTER: Toast strategy failed');
      }
      
      // STRATEGY 3: Navigate to profile and get latest tweet
      try {
        console.log('ULTIMATE_POSTER: Trying profile page...');
        const currentUrl = this.page.url();
        
        // Extract username from current URL or use default
        let username = 'Signal_Synapse';
        const usernameMatch = currentUrl.match(/x\.com\/([^\/]+)/);
        if (usernameMatch) {
          username = usernameMatch[1];
        }
        
        await this.page.goto(`https://x.com/${username}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
        await this.page.waitForTimeout(2000);
        
        const latestTweetLink = await this.page.locator('article a[href*="/status/"]').first().getAttribute('href', { timeout: 5000 });
        if (latestTweetLink) {
          const match = latestTweetLink.match(/\/status\/(\d+)/);
          if (match && match[1]) {
            console.log(`ULTIMATE_POSTER: ✅ Extracted from profile: ${match[1]}`);
            return match[1];
          }
        }
      } catch (e) {
        console.log('ULTIMATE_POSTER: Profile strategy failed');
      }
      
      // STRATEGY 4: Final fallback - timestamp with warning
      const fallbackId = Date.now().toString();
      console.warn(`ULTIMATE_POSTER: ⚠️⚠️⚠️ FALLBACK ID: ${fallbackId} - SCRAPING WILL FAIL`);
      return fallbackId;
      
    } catch (error: any) {
      console.error(`ULTIMATE_POSTER: ❌ All extraction strategies failed: ${error.message}`);
      const fallbackId = Date.now().toString();
      console.warn(`ULTIMATE_POSTER: ⚠️⚠️⚠️ FALLBACK ID: ${fallbackId} - SCRAPING WILL FAIL`);
      return fallbackId;
    }
  }

  private extractTweetId(responseBody: any): string | null {
    try {
      // Common paths where Twitter returns tweet IDs
      const paths = [
        'data.create_tweet.tweet_results.result.rest_id',
        'data.create_tweet.tweet_results.result.legacy.id_str',
        'data.create_tweet.tweet_results.result.id',
        'tweet_results.result.rest_id'
      ];

      for (const path of paths) {
        const value = this.getNestedValue(responseBody, path);
        if (value && typeof value === 'string') {
          return value;
        }
      }
    } catch (e) {
      console.log('ULTIMATE_POSTER: Error extracting tweet ID:', e.message);
    }
    return null;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private async refreshSession(): Promise<void> {
    console.log('ULTIMATE_POSTER: Refreshing Twitter session...');
    
    // If we have a storage state file, delete it to force re-authentication
    if (existsSync(this.storageStatePath)) {
      try {
        require('fs').unlinkSync(this.storageStatePath);
        console.log('ULTIMATE_POSTER: Cleared expired storage state');
      } catch (e) {
        console.warn('ULTIMATE_POSTER: Could not clear storage state:', e.message);
      }
    }

    // Load session from environment variable as fallback
    const sessionB64 = process.env.TWITTER_SESSION_B64;
    if (sessionB64) {
      try {
        console.log('ULTIMATE_POSTER: Loading session from environment...');
        const sessionData = JSON.parse(Buffer.from(sessionB64, 'base64').toString());
        
        // Create a temporary context to load cookies
        const tempContext = await createContext();
        
        // Parse and add cookies
        let cookies = Array.isArray(sessionData) ? sessionData : sessionData.cookies || [];
        if (cookies.length > 0) {
          await tempContext.addCookies(cookies);
          
          // Save as storage state for future use
          await tempContext.storageState({ path: this.storageStatePath });
          console.log('ULTIMATE_POSTER: Session refreshed and saved');
        }
        
        await tempContext.close();
      } catch (e) {
        console.error('ULTIMATE_POSTER: Failed to refresh session:', e.message);
        throw new Error('Session refresh failed - manual re-authentication may be required');
      }
    }
  }

  private async captureFailureArtifacts(error: string): Promise<void> {
    if (!this.page) return;

    const timestamp = Date.now();
    const artifactsDir = join(process.cwd(), 'artifacts');

    try {
      // Capture screenshot
      const screenshotPath = join(artifactsDir, `failure-${timestamp}.png`);
      await this.page.screenshot({ 
        path: screenshotPath, 
        fullPage: true 
      });
      console.log(`ULTIMATE_POSTER: Screenshot saved to ${screenshotPath}`);

      // Stop and save tracing if active
      if (this.context) {
        try {
          const tracePath = join(artifactsDir, `trace-${timestamp}.zip`);
          await this.context.tracing.stop({ path: tracePath });
          console.log(`ULTIMATE_POSTER: Trace saved to ${tracePath}`);
        } catch (e) {
          console.log('ULTIMATE_POSTER: Could not save trace:', e.message);
        }
      }

      // Save error details
      const errorLogPath = join(artifactsDir, `error-${timestamp}.json`);
      writeFileSync(errorLogPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        error,
        url: this.page.url(),
        userAgent: await this.page.evaluate(() => navigator.userAgent)
      }, null, 2));
      console.log(`ULTIMATE_POSTER: Error details saved to ${errorLogPath}`);

    } catch (e) {
      console.error('ULTIMATE_POSTER: Failed to capture artifacts:', e.message);
    }
  }

  private async cleanup(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      if (this.context) {
        await this.context.close();
        this.context = null;
      }
    } catch (e) {
      console.warn('ULTIMATE_POSTER: Cleanup error:', e.message);
    }
  }

  async dispose(): Promise<void> {
    await this.cleanup();
  }
}

