/**
 * 🎯 BULLETPROOF TWEET EXTRACTOR
 * 
 * Universal system for extracting tweet IDs safely
 * Used by: Posting, Scraping, Metrics, Replies - EVERYWHERE
 * 
 * Guarantees:
 * - Only extracts from correct account
 * - Verifies content matches
 * - Navigates to actual tweet page
 * - Never returns wrong IDs
 */

import { Page } from 'playwright';

export interface TweetExtractionOptions {
  /**
   * Expected tweet content (first 50 chars for verification)
   */
  expectedContent?: string;
  
  /**
   * Expected username (defaults to env var)
   */
  expectedUsername?: string;
  
  /**
   * Maximum age in seconds (for "latest tweet" scenarios)
   */
  maxAgeSeconds?: number;
  
  /**
   * Whether to navigate to tweet page for verification
   */
  navigateToVerify?: boolean;
}

export interface TweetExtractionResult {
  success: boolean;
  tweetId?: string;
  url?: string;
  author?: string;
  content?: string;
  timestamp?: string;
  error?: string;
  verificationSteps: string[];
}

export class BulletproofTweetExtractor {
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY = 2000;

  /**
   * 🎯 MAIN METHOD: Extract tweet ID with full verification
   */
  static async extractTweetId(
    page: Page,
    options: TweetExtractionOptions = {}
  ): Promise<TweetExtractionResult> {
    const {
      expectedContent,
      expectedUsername = process.env.TWITTER_USERNAME || 'SignalAndSynapse',
      maxAgeSeconds = 180,
      navigateToVerify = true
    } = options;

    const verificationSteps: string[] = [];
    verificationSteps.push(`Starting extraction for @${expectedUsername}`);

    try {
      // Step 1: Get current URL and check if we're on a tweet page
      const currentUrl = page.url();
      verificationSteps.push(`Current URL: ${currentUrl}`);

      let tweetId: string | null = null;

      // Strategy 1: Extract from current URL if on tweet page
      if (currentUrl.includes('/status/')) {
        const urlMatch = currentUrl.match(/\/status\/(\d{15,20})/);
        if (urlMatch) {
          tweetId = urlMatch[1];
          verificationSteps.push(`Extracted ID from URL: ${tweetId}`);
          
          // Verify username in URL
          if (!currentUrl.includes(`/${expectedUsername}/status/`)) {
            verificationSteps.push(`⚠️ URL username mismatch - rejecting`);
            tweetId = null;
          }
        }
      }

      // Strategy 2: Navigate to FRESH profile page (bypass cache)
      if (!tweetId) {
        verificationSteps.push('Navigating to profile for fresh content...');
        
        // Navigate to profile (force fresh content)
        const profileUrl = `https://x.com/${expectedUsername}`;
        await page.goto(profileUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 15000
        });
        verificationSteps.push(`Navigated to profile: ${profileUrl}`);
        
        // Wait for tweets to load
        await page.waitForSelector('article[data-testid="tweet"]', {
          state: 'visible',
          timeout: 10000
        }).catch(() => {
          verificationSteps.push(`⚠️ Tweets not visible after navigation`);
        });
        
        // Give Twitter a moment to render
        await page.waitForTimeout(2000);
        
        // FORCE RELOAD to get fresh content (bypass cache)
        verificationSteps.push(`Reloading page to get fresh content...`);
        await page.reload({ waitUntil: 'domcontentloaded' });
        
        // Wait again for tweets after reload
        await page.waitForSelector('article[data-testid="tweet"]', {
          state: 'visible',
          timeout: 10000
        });
        await page.waitForTimeout(1500);
        verificationSteps.push(`Page reloaded - should have fresh tweets now`);
        
        // Fetch articles from profile
        const articles = await page.locator('article[data-testid="tweet"]').all();
        verificationSteps.push(`Found ${articles.length} tweet articles on profile`)

        for (let i = 0; i < Math.min(articles.length, 5); i++) {
          try {
            const article = articles[i];

            // Verify author
            const authorLink = await article.locator(`a[href="/${expectedUsername}"]`).first();
            const authorExists = await authorLink.count() > 0;
            
            if (!authorExists) {
              verificationSteps.push(`Article ${i}: Not from @${expectedUsername}, skipping`);
              continue;
            }

            // Get timestamp
            const timeEl = await article.locator('time').first();
            const datetime = await timeEl.getAttribute('datetime');
            
            if (datetime && maxAgeSeconds) {
              const tweetTime = new Date(datetime);
              const ageSeconds = (Date.now() - tweetTime.getTime()) / 1000;
              
              if (ageSeconds > maxAgeSeconds) {
                verificationSteps.push(`Article ${i}: Too old (${Math.round(ageSeconds)}s), skipping`);
                continue;
              }
              
              verificationSteps.push(`Article ${i}: Age ${Math.round(ageSeconds)}s (within ${maxAgeSeconds}s limit)`);
            }

            // Get content
            const contentEl = await article.locator('[data-testid="tweetText"]').first();
            const content = await contentEl.textContent() || '';

            // Verify content if provided
            if (expectedContent) {
              const normalizedExpected = this.normalizeContent(expectedContent);
              const normalizedActual = this.normalizeContent(content);
              
              if (!normalizedActual.includes(normalizedExpected.substring(0, 30))) {
                verificationSteps.push(`Article ${i}: Content mismatch, skipping`);
                continue;
              }
              
              verificationSteps.push(`Article ${i}: Content matches! ✅`);
            }

            // Extract tweet ID
            const statusLink = await article.locator('a[href*="/status/"]').first();
            const href = await statusLink.getAttribute('href');
            
            if (href) {
              const match = href.match(/\/status\/(\d{15,20})/);
              if (match) {
                tweetId = match[1];
                verificationSteps.push(`Article ${i}: Extracted ID ${tweetId} ✅`);
                break;
              }
            }
          } catch (e: any) {
            verificationSteps.push(`Article ${i}: Error - ${e.message}`);
          }
        }
      }

      if (!tweetId) {
        return {
          success: false,
          error: 'Could not extract tweet ID',
          verificationSteps
        };
      }

      // Step 3: Navigate to tweet page for final verification
      if (navigateToVerify) {
        verificationSteps.push(`Navigating to tweet page for verification...`);
        
        const tweetUrl = `https://x.com/${expectedUsername}/status/${tweetId}`;
        await page.goto(tweetUrl, {
          waitUntil: 'domcontentloaded', // ✅ More reliable than networkidle
          timeout: 15000
        });
        
        // Wait for tweet content to be visible
        await page.waitForSelector('[data-testid="tweetText"]', {
          state: 'visible',
          timeout: 10000
        }).catch(() => {
          verificationSteps.push(`⚠️ Tweet content not visible after navigation`);
        });
        
        await page.waitForTimeout(1000); // Reduced wait time

        // Verify we're on the right page
        const finalUrl = page.url();
        if (!finalUrl.includes(`/${expectedUsername}/status/${tweetId}`)) {
          verificationSteps.push(`⚠️ Navigation verification failed`);
          return {
            success: false,
            error: 'Tweet page navigation failed verification',
            verificationSteps
          };
        }

        verificationSteps.push(`✅ Verified tweet page: ${finalUrl}`);

        // Extract and verify content from tweet page
        const pageContent = await page.locator('[data-testid="tweetText"]').first().textContent() || '';
        
        if (expectedContent) {
          const normalizedExpected = this.normalizeContent(expectedContent);
          const normalizedPage = this.normalizeContent(pageContent);
          
          if (!normalizedPage.includes(normalizedExpected.substring(0, 30))) {
            verificationSteps.push(`⚠️ Content verification failed on tweet page`);
            return {
              success: false,
              error: 'Content mismatch on tweet page',
              verificationSteps
            };
          }
          
          verificationSteps.push(`✅ Content verified on tweet page`);
        }

        // Verify author on page
        const pageAuthor = await page.locator('div[data-testid="User-Name"] a').first().getAttribute('href');
        if (pageAuthor && !pageAuthor.includes(`/${expectedUsername}`)) {
          verificationSteps.push(`⚠️ Author mismatch on tweet page`);
          return {
            success: false,
            error: 'Author verification failed on tweet page',
            verificationSteps
          };
        }

        verificationSteps.push(`✅ Author verified: @${expectedUsername}`);

        // Extract timestamp
        const timeEl = await page.locator('time').first();
        const timestamp = await timeEl.getAttribute('datetime') || undefined;

        verificationSteps.push(`✅ ALL VERIFICATIONS PASSED`);

        return {
          success: true,
          tweetId,
          url: tweetUrl,
          author: expectedUsername,
          content: pageContent.substring(0, 100),
          timestamp,
          verificationSteps
        };
      }

      // Return without page verification
      verificationSteps.push(`✅ Extraction complete (no page verification)`);
      
      return {
        success: true,
        tweetId,
        url: `https://x.com/${expectedUsername}/status/${tweetId}`,
        author: expectedUsername,
        verificationSteps
      };

    } catch (error: any) {
      verificationSteps.push(`❌ Error: ${error.message}`);
      
      return {
        success: false,
        error: error.message,
        verificationSteps
      };
    }
  }

  /**
   * 🔄 Extract with retries
   */
  static async extractWithRetries(
    page: Page,
    options: TweetExtractionOptions = {}
  ): Promise<TweetExtractionResult> {
    let lastResult: TweetExtractionResult | null = null;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      console.log(`[BULLETPROOF_EXTRACTOR] Attempt ${attempt}/${this.MAX_RETRIES}`);
      
      lastResult = await this.extractTweetId(page, options);
      
      if (lastResult.success) {
        console.log(`[BULLETPROOF_EXTRACTOR] ✅ Success on attempt ${attempt}`);
        return lastResult;
      }

      if (attempt < this.MAX_RETRIES) {
        console.log(`[BULLETPROOF_EXTRACTOR] ⚠️ Attempt ${attempt} failed, retrying in ${this.RETRY_DELAY}ms...`);
        await page.waitForTimeout(this.RETRY_DELAY);
      }
    }

    console.error(`[BULLETPROOF_EXTRACTOR] ❌ All ${this.MAX_RETRIES} attempts failed`);
    return lastResult || {
      success: false,
      error: 'All extraction attempts failed',
      verificationSteps: []
    };
  }

  /**
   * 🔍 Verify an existing tweet ID
   */
  static async verifyTweetId(
    page: Page,
    tweetId: string,
    expectedUsername: string = process.env.TWITTER_USERNAME || 'SignalAndSynapse',
    expectedContent?: string
  ): Promise<boolean> {
    try {
      const tweetUrl = `https://x.com/${expectedUsername}/status/${tweetId}`;
      
      await page.goto(tweetUrl, {
        waitUntil: 'domcontentloaded', // ✅ More reliable than networkidle
        timeout: 15000
      });
      
      // Wait for tweet content to be visible
      await page.waitForSelector('[data-testid="tweetText"]', {
        state: 'visible',
        timeout: 10000
      }).catch(() => {
        console.error(`[BULLETPROOF_EXTRACTOR] Tweet content not visible`);
        return false;
      });
      
      await page.waitForTimeout(1000); // Reduced wait time

      // Check if page loaded correctly
      const finalUrl = page.url();
      if (!finalUrl.includes(`/status/${tweetId}`)) {
        console.error(`[BULLETPROOF_EXTRACTOR] Verification failed: URL mismatch`);
        return false;
      }

      // Verify author
      const authorLink = await page.locator(`a[href="/${expectedUsername}"]`).first();
      const authorExists = await authorLink.count() > 0;
      
      if (!authorExists) {
        console.error(`[BULLETPROOF_EXTRACTOR] Verification failed: Author not @${expectedUsername}`);
        return false;
      }

      // Verify content if provided
      if (expectedContent) {
        const pageContent = await page.locator('[data-testid="tweetText"]').first().textContent() || '';
        const normalizedExpected = this.normalizeContent(expectedContent);
        const normalizedPage = this.normalizeContent(pageContent);
        
        if (!normalizedPage.includes(normalizedExpected.substring(0, 30))) {
          console.error(`[BULLETPROOF_EXTRACTOR] Verification failed: Content mismatch`);
          return false;
        }
      }

      console.log(`[BULLETPROOF_EXTRACTOR] ✅ Tweet ID ${tweetId} verified`);
      return true;
    } catch (error: any) {
      console.error(`[BULLETPROOF_EXTRACTOR] Verification error: ${error.message}`);
      return false;
    }
  }

  /**
   * 🧹 Normalize content for comparison
   */
  private static normalizeContent(content: string): string {
    return content
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ')    // Normalize whitespace
      .trim()
      .substring(0, 50);
  }

  /**
   * 📊 Log verification steps for debugging
   */
  static logVerificationSteps(result: TweetExtractionResult): void {
    console.log('\n[BULLETPROOF_EXTRACTOR] Verification Log:');
    console.log('='.repeat(80));
    result.verificationSteps.forEach((step, i) => {
      console.log(`  ${i + 1}. ${step}`);
    });
    console.log('='.repeat(80));
    
    if (result.success) {
      console.log(`✅ RESULT: Success`);
      console.log(`   Tweet ID: ${result.tweetId}`);
      console.log(`   URL: ${result.url}`);
      console.log(`   Author: @${result.author}`);
      if (result.content) {
        console.log(`   Content: "${result.content}..."`);
      }
    } else {
      console.log(`❌ RESULT: Failed`);
      console.log(`   Error: ${result.error}`);
    }
    console.log('');
  }
}

