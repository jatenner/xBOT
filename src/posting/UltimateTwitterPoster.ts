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

  async postTweet(content: string): Promise<PostResult> {
    let retryCount = 0;
    const maxRetries = 1;

    while (retryCount <= maxRetries) {
      try {
        console.log(`ULTIMATE_POSTER: Starting attempt ${retryCount + 1}/${maxRetries + 1}`);
        
        await this.ensureContext();
        const result = await this.attemptPost(content);
        
        if (result.success) {
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
        
        if (retryCount < maxRetries) {
          console.log('ULTIMATE_POSTER: Retrying with fresh context...');
          await this.cleanup();
          retryCount++;
          continue;
        }
        
        // Final failure - capture artifacts
        await this.captureFailureArtifacts(error.message);
        return { success: false, error: error.message };
      }
    }

    return { success: false, error: 'Max retries exceeded' };
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
    
    console.log('ULTIMATE_POSTER: Typing content...');
    await composer.click({ delay: 60 });
    await composer.fill(''); // Clear any existing content
    
    // Type content with reasonable delay (no excessive randomness)
    await composer.type(content, { delay: 25 });

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

  private async closeAnyModal(): Promise<void> {
    const modalCloseSelectors = [
      '[data-testid="app-bar-close"]',
      'div[role="dialog"] [aria-label="Close"]',
      'div[role="dialog"] [data-testid="SheetClose"]',
      '[data-testid="confirmationSheetCancel"]',
      'button[aria-label="Close"]'
    ];

    for (const selector of modalCloseSelectors) {
      try {
        const element = await this.page!.$(selector);
        if (element && await element.isVisible()) {
          console.log(`ULTIMATE_POSTER: Closing modal with selector: ${selector}`);
          await element.click();
          await this.page!.waitForTimeout(200);
        }
      } catch (e) {
        // Continue to next selector
      }
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

    console.log('ULTIMATE_POSTER: Setting up network monitoring...');
    
    // Set up network response monitoring for CreateTweet
    const tweetResponsePromise = this.page.waitForResponse(response => 
      response.url().includes('/i/api/graphql') &&
      (response.request().postData() || '').includes('CreateTweet'),
      { timeout: 30000 }
    );

    // Find and click post button
    const postButtonSelectors = [
      '[data-testid="tweetButtonInline"]:not([aria-disabled="true"])',
      '[data-testid="tweetButton"]:not([aria-disabled="true"])',
      'button[data-testid="tweetButtonInline"]:not([disabled])'
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
    await postButton.click();

    // Wait for the CreateTweet network response
    console.log('ULTIMATE_POSTER: Waiting for network confirmation...');
    try {
      const response = await tweetResponsePromise;
      
      if (!response.ok()) {
        const responseText = await response.text().catch(() => '');
        throw new Error(`CreateTweet failed: ${response.status()} ${responseText.substring(0, 200)}`);
      }

      // Try to extract tweet ID from response
      let tweetId = `posted_${Date.now()}`;
      try {
        const responseBody = await response.json();
        // Look for tweet ID in various possible locations
        const extractedId = this.extractTweetId(responseBody);
        if (extractedId) {
          tweetId = extractedId;
        }
      } catch (e) {
        console.log('ULTIMATE_POSTER: Could not parse response for tweet ID');
      }

      console.log(`ULTIMATE_POSTER: Network confirmation received - tweet posted with ID: ${tweetId}`);
      
      // Optional: Wait for UI confirmation (toast or composer reset)
      try {
        await this.page.waitForSelector(
          '[data-testid="toast"], [data-testid="tweetTextarea_0"]', 
          { timeout: 5000 }
        );
      } catch (e) {
        // UI confirmation not critical if network confirmation succeeded
      }

      return { success: true, tweetId };

    } catch (networkError) {
      console.error('ULTIMATE_POSTER: Network verification failed:', networkError.message);
      throw new Error(`Post verification failed: ${networkError.message}`);
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
