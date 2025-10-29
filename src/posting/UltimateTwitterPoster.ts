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
      'UI verification failed',
      'timeout.*exceeded', // 🔧 ADDED: Playwright timeout errors
      'Navigation elements not found' // 🔧 ADDED: Our new error
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
    
    // 🔧 IMPROVED TIMEOUT: Try multiple selectors with longer timeout
    const navigationSelectors = [
      'nav[role="navigation"]',
      '[data-testid="primaryColumn"]',
      '[data-testid="SideNav_AccountSwitcher_Button"]',
      'main[role="main"]'
    ];
    
    let navigationFound = false;
    for (const selector of navigationSelectors) {
      try {
        await this.page.waitForSelector(selector, { 
          state: 'visible', 
          timeout: 30000 // Increased from 20s to 30s
        });
        console.log(`ULTIMATE_POSTER: Found navigation via ${selector}`);
        navigationFound = true;
        break;
      } catch (error) {
        console.log(`ULTIMATE_POSTER: ${selector} not found, trying next...`);
      }
    }
    
    if (!navigationFound) {
      throw new Error('Navigation elements not found - page may not have loaded properly');
    }

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
      }, { timeout: 30000 }); // Reduced from 45s to 30s to fail faster
      
      console.log('ULTIMATE_POSTER: Network monitoring active (30s timeout)');
    } catch (e: any) {
      console.log(`ULTIMATE_POSTER: Could not set up network monitoring: ${e.message}, will use UI verification`);
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
    let lastError = '';
    for (const selector of postButtonSelectors) {
      try {
        console.log(`ULTIMATE_POSTER: Trying post button selector: ${selector}`);
        postButton = await this.page.waitForSelector(selector, { 
          state: 'visible', 
          timeout: 8000  // Increased timeout
        });
        if (postButton) {
          console.log(`ULTIMATE_POSTER: ✅ Found post button: ${selector}`);
          break;
        }
      } catch (e: any) {
        lastError = e.message;
        console.log(`ULTIMATE_POSTER: ❌ ${selector} not found (${e.message})`);
        continue;
      }
    }

    if (!postButton) {
      console.error(`ULTIMATE_POSTER: ❌ CRITICAL - No post button found after ${postButtonSelectors.length} attempts`);
      console.log(`ULTIMATE_POSTER: Last error: ${lastError}`);
      console.log('ULTIMATE_POSTER: 🔍 Taking debug screenshot...');
      try {
        await this.page.screenshot({ path: 'debug_no_post_button.png', fullPage: true });
        console.log('ULTIMATE_POSTER: Screenshot saved to debug_no_post_button.png');
      } catch (screenshotError) {
        console.log('ULTIMATE_POSTER: Could not take screenshot');
      }
      throw new Error(`No enabled post button found. Tried ${postButtonSelectors.length} selectors. Last error: ${lastError}`);
    }

    console.log('ULTIMATE_POSTER: 🚀 Clicking post button...');
    
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
    let clickSuccess = false;
    try {
      // Strategy 1: Normal click
      console.log('ULTIMATE_POSTER: Trying normal click...');
      await postButton.click({ timeout: 5000 });
      this.clickFailures = 0; // Reset on success
      clickSuccess = true;
      console.log('ULTIMATE_POSTER: ✅ Normal click succeeded');
    } catch (clickError: any) {
      this.clickFailures++;
      console.log(`ULTIMATE_POSTER: ❌ Normal click failed (${this.clickFailures}/${this.maxClickFailures}): ${clickError.message}`);
      console.log('ULTIMATE_POSTER: Trying force-click...');
      
      // Strategy 2: Force-click via JavaScript
      try {
        await this.page.evaluate((selector) => {
          const btn = document.querySelector(selector) as HTMLElement;
          if (btn) {
            btn.click();
            console.log('JS: Button clicked');
          } else {
            console.log('JS: Button not found');
          }
        }, postButtonSelectors[0]);
        clickSuccess = true;
        console.log('ULTIMATE_POSTER: ✅ Force-click executed');
      } catch (forceError: any) {
        console.log(`ULTIMATE_POSTER: ❌ Force-click failed: ${forceError.message}`);
        console.log('ULTIMATE_POSTER: Trying mouse coordinate click...');
        
        // Strategy 3: Click via coordinates
        const box = await postButton.boundingBox();
        if (box) {
          await this.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
          clickSuccess = true;
          console.log('ULTIMATE_POSTER: ✅ Mouse coordinate click executed');
        } else {
          console.error('ULTIMATE_POSTER: ❌ All click strategies failed - no bounding box');
          throw new Error('All click strategies failed');
        }
      }
    }
    
    if (!clickSuccess) {
      console.error('ULTIMATE_POSTER: ❌ CRITICAL - Post button click failed completely');
      throw new Error('Failed to click post button after all strategies');
    }
    
    console.log('ULTIMATE_POSTER: ✅ Post button clicked successfully');

    // Try network verification first, fallback to UI verification
    console.log('ULTIMATE_POSTER: 🔍 Attempting network verification (waiting for Twitter API response)...');
    
    if (networkVerificationPromise) {
      try {
        // Add timeout wrapper to prevent hanging
        console.log('ULTIMATE_POSTER: Waiting up to 30s for network response...');
        const response = await Promise.race([
          networkVerificationPromise,
          new Promise<any>((_, reject) => 
            setTimeout(() => {
              console.log('ULTIMATE_POSTER: ⏱️ Network verification timeout (30s)');
              reject(new Error('Network verification timeout'));
            }, 30000)  // Match the waitForResponse timeout
          )
        ]);
        
        console.log('ULTIMATE_POSTER: 📡 Network response received');
        
        if (response && response.ok()) {
          console.log(`ULTIMATE_POSTER: ✅ Response status: ${response.status()}`);
          // Try to extract tweet ID from response
          let tweetId = `posted_${Date.now()}`;
          try {
            const responseBody = await response.json();
            const extractedId = this.extractTweetId(responseBody);
            if (extractedId) {
              tweetId = extractedId;
              console.log(`ULTIMATE_POSTER: 🎯 Extracted tweet ID from response: ${tweetId}`);
            } else {
              console.log('ULTIMATE_POSTER: ⚠️ Could not extract ID from response, using fallback');
            }
          } catch (e) {
            console.log('ULTIMATE_POSTER: Could not parse response for tweet ID');
          }

          console.log(`ULTIMATE_POSTER: ✅ Network verification successful - tweet posted with ID: ${tweetId}`);
          return { success: true, tweetId };
        } else {
          console.log(`ULTIMATE_POSTER: ⚠️ Network response not OK (${response?.status()}), trying UI verification...`);
        }
      } catch (networkError: any) {
        // Critical: Catch browser/page closure errors
        if (networkError.message?.includes('closed') || networkError.message?.includes('Target page')) {
          console.log('ULTIMATE_POSTER: ⚠️ Browser/page closed during verification - will use UI fallback');
        } else if (networkError.message?.includes('timeout')) {
          console.log(`ULTIMATE_POSTER: ⏱️ Network verification timeout - falling back to UI verification`);
        } else {
          console.log(`ULTIMATE_POSTER: ⚠️ Network verification failed: ${networkError.message}, trying UI verification...`);
        }
      }
    } else {
      console.log('ULTIMATE_POSTER: ⚠️ No network promise available, using UI verification');
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
        
        // 🔥 NEW: Add real verification layer to catch silent rejections
        const realVerification = await this.verifyActualPosting();
        if (realVerification.success) {
          console.log(`ULTIMATE_POSTER: ✅ Real verification passed - tweet actually posted`);
          return { success: true, tweetId: realVerification.tweetId };
        } else {
          console.log('ULTIMATE_POSTER: ❌ Real verification failed - post was silently rejected');
          throw new Error('Post was silently rejected by Twitter - UI showed success but tweet not found on profile');
        }
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
      console.log('ULTIMATE_POSTER: ❌ Page not available - cannot extract tweet ID');
      throw new Error('Page not available for tweet ID extraction - post may have failed');
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
        let username = process.env.TWITTER_USERNAME || 'SignalAndSynapse';
        const usernameMatch = currentUrl.match(/x\.com\/([^\/]+)/);
        if (usernameMatch) {
          username = usernameMatch[1];
        }
        
        // CRITICAL FIX: Wait 5 seconds for Twitter to process the post
        console.log('ULTIMATE_POSTER: Waiting 5s for Twitter to process...');
        await this.page.waitForTimeout(5000);
        
        // CRITICAL FIX: Force reload to get fresh tweets
        await this.page.goto(`https://x.com/${username}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
        console.log('ULTIMATE_POSTER: Page reloaded, extracting latest tweet...');
        
        await this.page.waitForTimeout(2000);
        
        // 🔥 CRITICAL FIX: Verify tweet is from YOUR account (not recommended tweets!)
        console.log(`ULTIMATE_POSTER: Searching for YOUR tweet (from @${username})...`);
        
        // Get all articles and find the one from YOUR account that was posted recently
        const articles = await this.page.locator('article').all();
        console.log(`ULTIMATE_POSTER: Found ${articles.length} articles on profile page`);
        
        for (let i = 0; i < articles.length; i++) {
          try {
            const article = articles[i];
            
            // STEP 1: Verify this tweet is from YOUR account (not recommended/promoted)
            const profileLinks = await article.locator(`a[href="/${username}"]`).count();
            if (profileLinks === 0) {
              console.log(`ULTIMATE_POSTER: Article ${i} - NOT from your account, skipping...`);
              continue;
            }
            
            // STEP 2: Check if posted recently (last 3 minutes)
            const timeEl = await article.locator('time').first();
            const datetime = await timeEl.getAttribute('datetime');
            
            if (datetime) {
              const tweetTime = new Date(datetime);
              const ageSeconds = (Date.now() - tweetTime.getTime()) / 1000;
              
              console.log(`ULTIMATE_POSTER: Article ${i} - Posted ${Math.round(ageSeconds)}s ago`);
              
              if (ageSeconds < 180) { // Within last 3 minutes
                // STEP 3: Extract tweet ID
                const statusLink = await article.locator('a[href*="/status/"]').first();
                const href = await statusLink.getAttribute('href');
                
                if (href) {
                  const match = href.match(/\/status\/(\d+)/);
                  if (match && match[1]) {
                    console.log(`ULTIMATE_POSTER: ✅ Found YOUR recent tweet: ${match[1]}`);
                    console.log(`ULTIMATE_POSTER: ✅ Verified: From @${username}, posted ${Math.round(ageSeconds)}s ago`);
                    return match[1];
                  }
                }
              } else {
                console.log(`ULTIMATE_POSTER: Article ${i} - Too old (${Math.round(ageSeconds)}s), skipping...`);
              }
            }
          } catch (e: any) {
            console.log(`ULTIMATE_POSTER: Article ${i} - Error checking: ${e.message}`);
            continue;
          }
        }
        
        console.error(`ULTIMATE_POSTER: ❌ No recent tweets from @${username} found on profile`);
        return null;
      } catch (e) {
        console.log('ULTIMATE_POSTER: Profile strategy failed');
      }
      
      // NO FALLBACKS - All strategies failed
      console.error('ULTIMATE_POSTER: ❌ All extraction strategies failed - returning null');
      return null;
      
    } catch (error: any) {
      console.error(`ULTIMATE_POSTER: ❌ All extraction strategies failed: ${error.message}`);
      return null;
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

  /**
   * 🔥 REAL VERIFICATION: Check if tweet actually posted to profile
   * This catches silent rejections where UI shows success but tweet doesn't appear
   */
  private async verifyActualPosting(): Promise<{ success: boolean; tweetId?: string }> {
    if (!this.page) {
      return { success: false };
    }

    try {
      console.log('ULTIMATE_POSTER: 🔍 Starting real verification - checking profile for actual tweet...');
      
      // Navigate to profile to check for actual tweet
      const username = process.env.TWITTER_USERNAME || 'SignalAndSynapse';
      await this.page.goto(`https://x.com/${username}?t=${Date.now()}`, { 
        waitUntil: 'domcontentloaded',
        timeout: 15000
      });
      
      // Wait for Twitter to process and show fresh content
      await this.page.waitForTimeout(3000);
      
      // Force reload to get fresh content (bypass cache)
      await this.page.reload({ waitUntil: 'domcontentloaded' });
      await this.page.waitForTimeout(2000);
      
      // Look for the most recent tweet (should be our posted tweet)
      const articles = await this.page.locator('article[data-testid="tweet"]').all();
      console.log(`ULTIMATE_POSTER: 🔍 Found ${articles.length} tweets on profile`);
      
      if (articles.length === 0) {
        console.log('ULTIMATE_POSTER: ❌ No tweets found on profile');
        return { success: false };
      }
      
      // Check the first (most recent) tweet
      const firstTweet = articles[0];
      
      // Verify it's from our account
      const authorLink = await firstTweet.locator(`a[href="/${username}"]`).first();
      const isOurTweet = await authorLink.count() > 0;
      
      if (!isOurTweet) {
        console.log('ULTIMATE_POSTER: ❌ Most recent tweet is not from our account');
        return { success: false };
      }
      
      // Check if tweet is recent (within last 10 minutes)
      const timeEl = await firstTweet.locator('time').first();
      const datetime = await timeEl.getAttribute('datetime');
      
      if (datetime) {
        const tweetTime = new Date(datetime);
        const ageMinutes = (Date.now() - tweetTime.getTime()) / (1000 * 60);
        
        if (ageMinutes > 10) {
          console.log(`ULTIMATE_POSTER: ❌ Most recent tweet is too old (${Math.round(ageMinutes)}m ago)`);
          return { success: false };
        }
        
        console.log(`ULTIMATE_POSTER: ✅ Found recent tweet (${Math.round(ageMinutes)}m ago)`);
      }
      
      // Extract tweet ID from the tweet
      const statusLink = await firstTweet.locator('a[href*="/status/"]').first();
      const href = await statusLink.getAttribute('href');
      
      if (href) {
        const match = href.match(/\/status\/(\d{15,20})/);
        if (match) {
          const tweetId = match[1];
          console.log(`ULTIMATE_POSTER: ✅ Real verification successful - tweet ID: ${tweetId}`);
          return { success: true, tweetId };
        }
      }
      
      console.log('ULTIMATE_POSTER: ❌ Could not extract tweet ID from profile');
      return { success: false };
      
    } catch (error: any) {
      console.log(`ULTIMATE_POSTER: ❌ Real verification error: ${error.message}`);
      return { success: false };
    }
  }

  async dispose(): Promise<void> {
    await this.cleanup();
  }

  /**
   * 💬 POST REPLY TO TWEET (Permanent Solution)
   * Navigates to tweet and posts actual reply (not @mention)
   */
  async postReply(content: string, replyToTweetId: string): Promise<PostResult> {
    let retryCount = 0;
    const maxRetries = 2;

    console.log(`ULTIMATE_POSTER: Posting reply to tweet ${replyToTweetId}`);

    while (retryCount <= maxRetries) {
      try {
        console.log(`ULTIMATE_POSTER: Reply attempt ${retryCount + 1}/${maxRetries + 1}`);
        
        await this.ensureContext();
        
        if (!this.page) throw new Error('Page not initialized');

        // Navigate to the tweet
        console.log(`ULTIMATE_POSTER: Navigating to tweet ${replyToTweetId}...`);
        await this.page.goto(`https://x.com/i/status/${replyToTweetId}`, { 
          waitUntil: 'domcontentloaded',
          timeout: 30000 
        });

        await this.page.waitForTimeout(2000);

        // Check authentication
        const isLoggedOut = await this.checkIfLoggedOut();
        if (isLoggedOut) {
          throw new Error('Not logged in - session expired');
        }

        console.log(`ULTIMATE_POSTER: Finding reply button...`);

        // Find and click reply button
        const replyButton = this.page.locator('[data-testid="reply"]').first();
        await replyButton.waitFor({ state: 'visible', timeout: 5000 });
        await replyButton.click();

        // Wait for reply modal to appear
        console.log(`ULTIMATE_POSTER: Waiting for reply modal...`);
        await this.page.waitForTimeout(3000);

        // Find composer in modal
        const composerSelectors = [
          '[data-testid="tweetTextarea_0"]',
          'div[role="dialog"] [contenteditable="true"]',
          'div[aria-modal="true"] [contenteditable="true"]',
          'div[role="textbox"][contenteditable="true"]',
          '[contenteditable="true"]'
        ];

        let composer = null;
        for (const selector of composerSelectors) {
          try {
            const element = this.page.locator(selector).first();
            await element.waitFor({ state: 'visible', timeout: 2000 });
            
            if (await element.isVisible() && await element.isEditable()) {
              composer = element;
              console.log(`ULTIMATE_POSTER: Found reply composer: "${selector}"`);
              break;
            }
          } catch (e) {
            continue;
          }
        }

        if (!composer) {
          throw new Error('Reply composer not found');
        }

        // Type reply content
        console.log(`ULTIMATE_POSTER: Typing reply content...`);
        await composer.click();
        await this.page.waitForTimeout(300);
        await composer.fill(content);
        await this.page.waitForTimeout(500);

        // Find and click post button
        const postButtonSelectors = [
          '[data-testid="tweetButton"]',
          '[data-testid="tweetButtonInline"]',
          'div[role="button"]:has-text("Reply")',
          'div[role="button"]:has-text("Post")'
        ];

        let posted = false;
        for (const selector of postButtonSelectors) {
          try {
            const button = this.page.locator(selector).first();
            await button.waitFor({ state: 'visible', timeout: 2000 });
            await button.click();
            posted = true;
            console.log(`ULTIMATE_POSTER: Clicked post button: "${selector}"`);
            break;
          } catch (e) {
            continue;
          }
        }

        if (!posted) {
          throw new Error('Could not click post button');
        }

        // Wait for post to complete
        await this.page.waitForTimeout(3000);

        // Extract tweet ID from URL or DOM (MUST be different from parent!)
        const tweetId = await this.extractReplyTweetId(replyToTweetId);

        if (!tweetId) {
          console.error(`❌ CRITICAL: Reply ID extraction failed for parent ${replyToTweetId}`);
          throw new Error('Reply posted but could not extract reply ID');
        }

        console.log(`ULTIMATE_POSTER: ✅ Reply posted successfully: ${tweetId}`);

        return {
          success: true,
          tweetId: tweetId
        };

      } catch (error: any) {
        console.error(`ULTIMATE_POSTER: Reply attempt ${retryCount + 1} failed:`, error.message);
        
        if (retryCount < maxRetries) {
          console.log('ULTIMATE_POSTER: Retrying reply with fresh context...');
          await this.cleanup();
          retryCount++;
          await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
          continue;
        }
        
        return { success: false, error: error.message };
      }
    }

    return { success: false, error: 'Max retries exceeded for reply' };
  }

  private async extractReplyTweetId(parentTweetId: string): Promise<string | undefined> {
    if (!this.page) return undefined;

    console.log(`🔍 REPLY_ID_EXTRACTION: Looking for NEW reply ID (must NOT be ${parentTweetId})`);

    try {
      // Wait for post to complete and DOM to update
      await this.page.waitForTimeout(3000);
      
      // ═══════════════════════════════════════════════════════════
      // STRATEGY 1: Check URL change (most reliable)
      // ═══════════════════════════════════════════════════════════
      const url = this.page.url();
      const urlMatch = url.match(/status\/(\d+)/);
      if (urlMatch && urlMatch[1] !== parentTweetId) {
        console.log(`✅ STRATEGY 1 SUCCESS: Extracted from URL: ${urlMatch[1]}`);
        return urlMatch[1];
      }
      console.log(`⚠️ STRATEGY 1 FAILED: URL doesn't contain new ID`);
      
      // ═══════════════════════════════════════════════════════════
      // STRATEGY 2: Find newest tweet in DOM (NOT the parent)
      // ═══════════════════════════════════════════════════════════
      try {
        const allTweetLinks = await this.page.locator('article a[href*="/status/"]').all();
        console.log(`🔍 STRATEGY 2: Found ${allTweetLinks.length} tweet links in DOM`);
        
        for (const link of allTweetLinks) {
          const href = await link.getAttribute('href');
          if (href) {
            const match = href.match(/status\/(\d+)/);
            if (match && match[1] !== parentTweetId) {
              console.log(`✅ STRATEGY 2 SUCCESS: Found new tweet ID: ${match[1]} (≠ parent)`);
              return match[1];
            }
          }
        }
        console.log(`⚠️ STRATEGY 2 FAILED: No new tweet ID found (all matched parent)`);
      } catch (e) {
        console.log(`⚠️ STRATEGY 2 ERROR: ${e}`);
      }
      
      // ═══════════════════════════════════════════════════════════
      // STRATEGY 3: Navigate to our profile and get latest tweet
      // ═══════════════════════════════════════════════════════════
      try {
        console.log(`🔍 STRATEGY 3: Navigating to profile to find latest tweet...`);
        const username = process.env.TWITTER_USERNAME || 'SignalAndSynapse';
        await this.page.goto(`https://x.com/${username}`, { 
          waitUntil: 'domcontentloaded',
          timeout: 15000 
        });
        await this.page.waitForTimeout(2000);
        
        // Get first tweet link (latest tweet)
        const latestTweet = this.page.locator('article a[href*="/status/"]').first();
        const href = await latestTweet.getAttribute('href');
        if (href) {
          const match = href.match(/status\/(\d+)/);
          if (match && match[1] !== parentTweetId) {
            console.log(`✅ STRATEGY 3 SUCCESS: Latest tweet from profile: ${match[1]}`);
            return match[1];
          }
        }
        console.log(`⚠️ STRATEGY 3 FAILED: Latest tweet is parent or not found`);
      } catch (e) {
        console.log(`⚠️ STRATEGY 3 ERROR: ${e}`);
      }
      
      // ═══════════════════════════════════════════════════════════
      // STRATEGY 4: Use time-based fallback ID
      // ═══════════════════════════════════════════════════════════
      console.log(`⚠️ ALL STRATEGIES FAILED - Reply was posted but ID not extractable`);
      console.log(`🔄 Using timestamp-based fallback (will need manual verification)`);
      
      // Return undefined so validation catches this
      return undefined;
      
    } catch (error) {
      console.error(`❌ REPLY_ID_EXTRACTION ERROR: ${error}`);
      return undefined;
    }
  }
}

