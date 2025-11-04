/**
 * 🔍 IMPROVED REPLY TWEET ID EXTRACTOR
 * 
 * Fixes reliability issues with tweet ID extraction after posting replies.
 * Uses 3 fallback strategies to ensure we always get the real tweet ID.
 * 
 * Strategies:
 * 1. Network capture - Listen to Twitter API responses (most reliable)
 * 2. URL parsing - Extract from page URL after posting
 * 3. Profile scraping - Find the tweet from timeline (last resort)
 */

import { Page } from 'playwright';

export interface ExtractionResult {
  success: boolean;
  tweetId?: string;
  strategy?: 'network' | 'url' | 'profile' | 'fallback';
  error?: string;
}

export class ImprovedReplyIdExtractor {
  private static networkListenerActive = false;
  private static capturedTweetId: string | null = null;

  /**
   * Extract reply tweet ID with multiple fallback strategies
   * 
   * @param page - Playwright page instance
   * @param parentTweetId - The tweet we replied to
   * @param maxWaitMs - Maximum time to wait for extraction
   * @returns Extraction result with tweet ID or error
   */
  static async extractReplyId(
    page: Page,
    parentTweetId: string,
    maxWaitMs: number = 10000
  ): Promise<ExtractionResult> {
    console.log(`[ID_EXTRACTOR] 🔍 Starting extraction for reply to ${parentTweetId}`);
    
    const startTime = Date.now();

    // Strategy 1: Network capture (most reliable - setup before posting!)
    const idFromNetwork = await this.tryNetworkCapture(page, maxWaitMs);
    if (idFromNetwork) {
      const elapsed = Date.now() - startTime;
      console.log(`[ID_EXTRACTOR] ✅ Network strategy succeeded in ${elapsed}ms: ${idFromNetwork}`);
      return {
        success: true,
        tweetId: idFromNetwork,
        strategy: 'network'
      };
    }

    // Strategy 2: URL parsing
    const idFromUrl = await this.tryUrlParse(page, parentTweetId);
    if (idFromUrl) {
      const elapsed = Date.now() - startTime;
      console.log(`[ID_EXTRACTOR] ✅ URL strategy succeeded in ${elapsed}ms: ${idFromUrl}`);
      return {
        success: true,
        tweetId: idFromUrl,
        strategy: 'url'
      };
    }

    // Strategy 3: Profile scraping (fallback - most reliable but slowest)
    const idFromProfile = await this.tryProfileScrape(page, parentTweetId, maxWaitMs);
    if (idFromProfile) {
      const elapsed = Date.now() - startTime;
      console.log(`[ID_EXTRACTOR] ✅ Profile strategy succeeded in ${elapsed}ms: ${idFromProfile}`);
      return {
        success: true,
        tweetId: idFromProfile,
        strategy: 'profile'
      };
    }

    const elapsed = Date.now() - startTime;
    console.error(`[ID_EXTRACTOR] ❌ All strategies failed after ${elapsed}ms`);
    
    return {
      success: false,
      error: 'All extraction strategies failed'
    };
  }

  /**
   * Setup network listener BEFORE posting
   * Must be called before clicking the post button
   */
  static setupNetworkListener(page: Page): void {
    if (this.networkListenerActive) {
      return; // Already listening
    }

    console.log('[ID_EXTRACTOR] 🎧 Setting up network listener');
    this.capturedTweetId = null;
    this.networkListenerActive = true;

    page.on('response', async (response) => {
      try {
        const url = response.url();

        // Twitter's CreateTweet endpoint
        if (url.includes('CreateTweet') || url.includes('graphql') && url.includes('/CreateTweet')) {
          console.log('[ID_EXTRACTOR] 📡 Intercepted CreateTweet response');
          
          try {
            const json = await response.json();
            const tweetId = this.parseTweetIdFromResponse(json);
            
            if (tweetId) {
              console.log('[ID_EXTRACTOR] 🎯 Captured tweet ID from network:', tweetId);
              this.capturedTweetId = tweetId;
            }
          } catch (e) {
            // Response might not be JSON
            console.log('[ID_EXTRACTOR] ⚠️ Failed to parse CreateTweet response');
          }
        }
      } catch (error: any) {
        // Ignore errors in listener
      }
    });
  }

  /**
   * Strategy 1: Capture tweet ID from Twitter's API response
   * 
   * This is the most reliable method when it works. Must setup listener
   * before posting the reply.
   */
  private static async tryNetworkCapture(
    page: Page,
    maxWaitMs: number
  ): Promise<string | null> {
    console.log('[ID_EXTRACTOR] 📡 Strategy 1: Network capture...');

    // Wait for captured ID (with timeout)
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
      if (this.capturedTweetId) {
        const id = this.capturedTweetId;
        this.capturedTweetId = null; // Reset for next reply
        this.networkListenerActive = false;
        return id;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('[ID_EXTRACTOR] ⏱️ Network capture timeout');
    this.networkListenerActive = false;
    return null;
  }

  /**
   * Strategy 2: Extract from URL after posting
   * 
   * Sometimes Twitter redirects to the reply tweet after posting.
   */
  private static async tryUrlParse(
    page: Page,
    parentTweetId: string
  ): Promise<string | null> {
    console.log('[ID_EXTRACTOR] 🔗 Strategy 2: URL parsing...');

    try {
      // Wait a bit for potential redirect
      await page.waitForTimeout(2000);

      const currentUrl = page.url();
      console.log('[ID_EXTRACTOR] Current URL:', currentUrl);

      // Extract tweet ID from URL
      const match = currentUrl.match(/\/status\/(\d{15,20})/);
      if (match && match[1] !== parentTweetId) {
        // Make sure it's not the parent tweet
        return match[1];
      }

      console.log('[ID_EXTRACTOR] URL parse failed - no new tweet ID in URL');
      return null;
    } catch (error: any) {
      console.log('[ID_EXTRACTOR] URL parse error:', error.message);
      return null;
    }
  }

  /**
   * Strategy 3: Scrape profile to find most recent reply
   * 
   * This is the most reliable fallback but takes longest.
   * Navigates to our profile and finds the most recent reply.
   */
  private static async tryProfileScrape(
    page: Page,
    parentTweetId: string,
    maxWaitMs: number
  ): Promise<string | null> {
    console.log('[ID_EXTRACTOR] 👤 Strategy 3: Profile scraping (fallback)...');

    try {
      // Get our username
      const username = await this.getOurUsername(page);
      if (!username) {
        console.log('[ID_EXTRACTOR] ⚠️ Could not determine our username');
        return null;
      }

      console.log('[ID_EXTRACTOR] Our username:', username);

      // Navigate to our profile
      await page.goto(`https://x.com/${username}`, {
        waitUntil: 'domcontentloaded',
        timeout: 10000
      });

      await page.waitForTimeout(3000); // Wait for tweets to load

      // Find tweet articles
      const tweets = await page.$$('article[data-testid="tweet"]');
      console.log(`[ID_EXTRACTOR] Found ${tweets.length} tweets on profile`);

      // Check the top 10 tweets (our reply should be in the most recent)
      for (let i = 0; i < Math.min(10, tweets.length); i++) {
        const tweet = tweets[i];

        try {
          // Get tweet ID from link
          const link = await tweet.$('a[href*="/status/"]');
          if (!link) continue;

          const href = await link.getAttribute('href');
          if (!href) continue;

          const match = href.match(/\/status\/(\d{15,20})/);
          if (!match) continue;

          const tweetId = match[1];

          // Verify this is actually a reply to the parent tweet
          const isReply = await this.verifyReplyRelationship(
            page,
            tweetId,
            parentTweetId
          );

          if (isReply) {
            console.log(`[ID_EXTRACTOR] ✅ Found reply tweet #${i + 1}:`, tweetId);
            return tweetId;
          }
        } catch (e) {
          // Continue to next tweet
          continue;
        }
      }

      console.log('[ID_EXTRACTOR] ⚠️ No matching reply found in recent tweets');
      return null;
    } catch (error: any) {
      console.error('[ID_EXTRACTOR] Profile scrape error:', error.message);
      return null;
    }
  }

  /**
   * Parse tweet ID from Twitter's CreateTweet API response
   */
  private static parseTweetIdFromResponse(json: any): string | null {
    try {
      // Twitter's response structure can vary, try multiple paths
      const paths = [
        // GraphQL responses
        json?.data?.create_tweet?.tweet_results?.result?.rest_id,
        json?.data?.CreateTweet?.tweet_results?.result?.rest_id,
        
        // REST API responses
        json?.data?.tweet?.rest_id,
        json?.data?.tweetResult?.result?.rest_id,
        
        // Direct ID fields
        json?.rest_id,
        json?.id_str,
        json?.id
      ];

      for (const path of paths) {
        if (path && typeof path === 'string' && /^\d{15,20}$/.test(path)) {
          return path;
        }
        // Also handle numeric IDs
        if (path && typeof path === 'number') {
          return String(path);
        }
      }

      console.log('[ID_EXTRACTOR] ⚠️ Could not find tweet ID in response structure');
      return null;
    } catch (error: any) {
      console.error('[ID_EXTRACTOR] Error parsing response:', error.message);
      return null;
    }
  }

  /**
   * Get our Twitter username from the current page
   */
  private static async getOurUsername(page: Page): Promise<string | null> {
    try {
      // Try multiple methods to get username
      
      // Method 1: From profile link in navigation
      const profileLink = await page.$('a[data-testid="AppTabBar_Profile_Link"]');
      if (profileLink) {
        const href = await profileLink.getAttribute('href');
        if (href) {
          const match = href.match(/\/([^\/]+)$/);
          if (match && match[1]) {
            return match[1];
          }
        }
      }

      // Method 2: From account switcher
      const accountSwitcher = await page.$('[data-testid="SideNav_AccountSwitcher_Button"]');
      if (accountSwitcher) {
        const text = await accountSwitcher.textContent();
        if (text) {
          const match = text.match(/@([a-zA-Z0-9_]+)/);
          if (match && match[1]) {
            return match[1];
          }
        }
      }

      // Method 3: Parse from current URL if we're on our profile
      const url = page.url();
      if (url.includes('x.com/') || url.includes('twitter.com/')) {
        const match = url.match(/(?:x|twitter)\.com\/([a-zA-Z0-9_]+)/);
        if (match && match[1] && match[1] !== 'i' && match[1] !== 'home') {
          return match[1];
        }
      }

      return null;
    } catch (error: any) {
      console.error('[ID_EXTRACTOR] Error getting username:', error.message);
      return null;
    }
  }

  /**
   * Verify that a tweet is actually a reply to another tweet
   */
  private static async verifyReplyRelationship(
    page: Page,
    tweetId: string,
    parentTweetId: string
  ): Promise<boolean> {
    try {
      // Navigate to the potential reply
      await page.goto(`https://x.com/i/status/${tweetId}`, {
        waitUntil: 'domcontentloaded',
        timeout: 10000
      });

      await page.waitForTimeout(2000);

      // Look for "Replying to" text and link to parent
      const replyingTo = await page.$(`a[href*="/status/${parentTweetId}"]`);
      
      if (replyingTo) {
        console.log('[ID_EXTRACTOR] ✅ Verified: Tweet is reply to parent');
        return true;
      }

      // Alternative: Check if parent tweet is visible in thread
      const parentInThread = await page.$(`article[data-testid="tweet"] a[href*="/status/${parentTweetId}"]`);
      if (parentInThread) {
        console.log('[ID_EXTRACTOR] ✅ Verified: Parent visible in thread');
        return true;
      }

      console.log('[ID_EXTRACTOR] ❌ Tweet is not a reply to parent');
      return false;
    } catch (error: any) {
      console.error('[ID_EXTRACTOR] Error verifying relationship:', error.message);
      return false;
    }
  }

  /**
   * Cleanup - remove network listener
   */
  static cleanup(): void {
    this.networkListenerActive = false;
    this.capturedTweetId = null;
  }
}

