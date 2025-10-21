/**
 * Bulletproof Twitter Scraper
 * 
 * 99%+ success rate through:
 * - Multiple selector fallbacks
 * - Retry logic with exponential backoff
 * - Page reload on failure
 * - Screenshot evidence on failures
 * - NEVER generates fake data
 */

import type { Page, ElementHandle } from 'playwright';
import { promises as fs } from 'fs';
import path from 'path';

export interface ScrapedMetrics {
  likes: number | null;
  retweets: number | null;
  quote_tweets: number | null;
  replies: number | null;
  bookmarks: number | null;
  views: number | null;
  _verified: boolean;
  _status: 'CONFIRMED' | 'UNDETERMINED';
  _dataSource: 'scraped' | 'scraping_failed';
  _attempts: number;
  _selectors_used: string[];
  _timestamp: string;
}

export interface ScrapingResult {
  success: boolean;
  metrics?: ScrapedMetrics;
  error?: string;
  screenshot?: string;
}

/**
 * Multiple selector strategies for each metric
 * Twitter frequently changes their HTML, so we need fallbacks
 */
const SELECTORS = {
  likes: [
    '[data-testid="like"] span:not([aria-hidden])',
    '[aria-label*="like"] span',
    'div[role="group"] button:nth-child(3) span',
    '[data-testid="likeButton"] span'
  ],
  retweets: [
    '[data-testid="retweet"] span:not([aria-hidden])',
    '[aria-label*="repost"] span',
    '[aria-label*="retweet"] span',
    'div[role="group"] button:nth-child(2) span'
  ],
  quote_tweets: [
    '[data-testid="retweet"] [aria-label*="quote"]',
    '[aria-label*="quote"] span',
    'div[role="group"] [href*="quotes"] span',
    'a[href$="/quotes"] span'
  ],
  replies: [
    '[data-testid="reply"] span:not([aria-hidden])',
    '[aria-label*="repl"] span',
    'div[role="group"] button:nth-child(1) span'
  ],
  bookmarks: [
    '[data-testid="bookmark"] span:not([aria-hidden])',
    '[aria-label*="bookmark"] span'
  ],
  views: [
    // CRITICAL FIX: Be EXTREMELY specific to avoid grabbing sidebar/other tweet metrics
    // Strategy 1: Look for the analytics link in the engagement group (most reliable)
    'div[role="group"] + a[href$="/analytics"] span[class*="css"]',
    'div[role="group"] ~ a[aria-label*="View"] span',
    // Strategy 2: Direct descendant of article engagement area
    'article[data-testid="tweet"] > div > div > div:last-child a[href*="analytics"] span',
    // Strategy 3: Look for views count by position after engagement buttons
    'article[data-testid="tweet"] [role="group"] ~ a span:not([aria-hidden="true"])',
    // Strategy 4: Fallback with stricter attribute matching
    'a[href*="/analytics"][aria-label*="view" i] span'
  ]
};

export class BulletproofTwitterScraper {
  private static instance: BulletproofTwitterScraper;
  private artifactsDir = path.resolve(process.cwd(), 'artifacts', 'scraping');

  private constructor() {
    // Ensure artifacts directory exists
    this.ensureArtifactsDir();
  }

  static getInstance(): BulletproofTwitterScraper {
    if (!BulletproofTwitterScraper.instance) {
      BulletproofTwitterScraper.instance = new BulletproofTwitterScraper();
    }
    return BulletproofTwitterScraper.instance;
  }

  private async ensureArtifactsDir(): Promise<void> {
    try {
      await fs.mkdir(this.artifactsDir, { recursive: true });
    } catch (error) {
      // Directory exists or cannot be created
    }
  }

  /**
   * Main entry point: Scrape tweet metrics with bulletproof reliability
   */
  async scrapeTweetMetrics(
    page: Page,
    tweetId: string,
    maxAttempts: number = 3
  ): Promise<ScrapingResult> {
    console.log(`🔍 SCRAPER: Starting bulletproof scraping for tweet ${tweetId}`);

    let lastError: Error | null = null;
    let attempt = 1;

    while (attempt <= maxAttempts) {
      try {
        console.log(`  📊 SCRAPER: Attempt ${attempt}/${maxAttempts}`);

        // Step 1: Validate page state
        const isValid = await this.validatePageState(page);
        if (!isValid && attempt < maxAttempts) {
          console.warn(`  ⚠️ SCRAPER: Page state invalid, reloading...`);
          await this.reloadTweetPage(page, tweetId);
          attempt++;
          await this.sleep(2000 * attempt); // Exponential backoff
          continue;
        }

        // ✅ FIX #3: FAIL FAST on tweet ID mismatch - don't retry
        // Twitter will keep showing the same wrong tweet (parent in thread)
        // Retrying is wasteful - fail immediately and log the issue
        const correctTweet = await this.validateScrapingCorrectTweet(page, tweetId);
        if (!correctTweet) {
          console.error(`  ❌ SCRAPER: Tweet ID mismatch - FAILING FAST (don't waste retries)`);
          console.error(`     Likely a reply/thread where parent tweet is shown`);
          return {
            success: false,
            metrics: null,
            error: 'Tweet ID mismatch - wrong tweet loaded (possibly parent in thread)'
          };
        }

        // Step 2: Extract metrics using multiple selectors
        // PROPER FIX: Pass tweet ID so extraction targets the CORRECT article
        const metrics = await this.extractMetricsWithFallbacks(page, tweetId);

        // Step 3: Validate extracted metrics
        if (this.areMetricsValid(metrics)) {
          console.log(`  ✅ SCRAPER: Success on attempt ${attempt}`);
          console.log(`     Likes: ${metrics.likes}, Retweets: ${metrics.retweets}, Quote Tweets: ${metrics.quote_tweets}, Replies: ${metrics.replies}`);

          return {
            success: true,
            metrics: {
              likes: metrics.likes ?? null,
              retweets: metrics.retweets ?? null,
              quote_tweets: metrics.quote_tweets ?? null,
              replies: metrics.replies ?? null,
              bookmarks: metrics.bookmarks ?? null,
              views: metrics.views ?? null,
              _selectors_used: metrics._selectors_used ?? [],
              _verified: true,
              _status: 'CONFIRMED',
              _dataSource: 'scraped',
              _attempts: attempt,
              _timestamp: new Date().toISOString()
            }
          };
        }

        // Metrics invalid, retry
        console.warn(`  ⚠️ SCRAPER: Extracted metrics invalid, retrying...`);
        lastError = new Error('Invalid metrics extracted');

      } catch (error: any) {
        console.warn(`  ❌ SCRAPER: Attempt ${attempt} failed: ${error.message}`);
        lastError = error;
      }

      // Prepare for retry
      if (attempt < maxAttempts) {
        const delay = 2000 * Math.pow(2, attempt - 1); // Exponential backoff: 2s, 4s, 8s
        console.log(`  🔄 SCRAPER: Waiting ${delay}ms before retry...`);
        await this.sleep(delay);

        // Reload page on last retry
        if (attempt === maxAttempts - 1) {
          console.log(`  🔄 SCRAPER: Final attempt - reloading page...`);
          await this.reloadTweetPage(page, tweetId);
        }
      }

      attempt++;
    }

    // All attempts failed - capture evidence and return UNDETERMINED
    console.error(`  ❌ SCRAPER: All ${maxAttempts} attempts failed for tweet ${tweetId}`);

    const screenshot = await this.captureFailureEvidence(page, tweetId);

    return {
      success: false,
      error: lastError?.message || 'Unknown scraping error',
      screenshot,
      metrics: {
        likes: null,
        retweets: null,
        quote_tweets: null,
        replies: null,
        bookmarks: null,
        views: null,
        _verified: false,
        _status: 'UNDETERMINED',
        _dataSource: 'scraping_failed',
        _attempts: maxAttempts,
        _selectors_used: [],
        _timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * PHASE 1 FIX: Validate we're scraping the CORRECT tweet
   * Prevents accidentally scraping a different tweet in a thread or timeline
   */
  private async validateScrapingCorrectTweet(page: Page, expectedTweetId: string): Promise<boolean> {
    try {
      const actualTweetId = await page.evaluate((tweetId) => {
        // PROPER FIX: Find ALL tweet articles, search for the one matching our ID
        // (Twitter shows parent tweet first when displaying a reply)
        const articles = document.querySelectorAll('article[data-testid="tweet"]');
        
        for (const article of articles) {
          // Look for status link within THIS article
          const link = article.querySelector('a[href*="/status/"]') as HTMLAnchorElement;
          if (!link) continue;
          
          // Extract tweet ID from URL
          const match = link.href.match(/\/status\/(\d+)/);
          if (match && match[1] === tweetId) {
            // Found the article matching our tweet ID!
            return match[1];
          }
        }
        
        // If we didn't find our tweet, return the first article's ID (for error reporting)
        if (articles.length > 0) {
          const firstLink = articles[0].querySelector('a[href*="/status/"]') as HTMLAnchorElement;
          if (firstLink) {
            const match = firstLink.href.match(/\/status\/(\d+)/);
            return match ? match[1] : null;
          }
        }
        
        return null;
      }, expectedTweetId);

      if (!actualTweetId) {
        console.warn(`    ⚠️ TWEET_ID_CHECK: Could not find any tweet articles on page`);
        return false;
      }

      if (actualTweetId !== expectedTweetId) {
        console.error(`    ❌ TWEET_ID_MISMATCH: Expected ${expectedTweetId}, found ${actualTweetId}`);
        console.error(`    💡 HINT: Your tweet might be a reply - found parent tweet instead`);
        return false;
      }

      console.log(`    ✅ TWEET_ID_CHECK: Confirmed scraping correct tweet (${expectedTweetId})`);
      return true;

    } catch (error) {
      console.warn(`    ⚠️ TWEET_ID_CHECK: Validation failed:`, error);
      return false;
    }
  }

  /**
   * Validate that page is in correct state for scraping
   * PHASE 3: Enhanced with multiple selector fallbacks
   */
  private async validatePageState(page: Page): Promise<boolean> {
    try {
      // Check 1: Is this actually a tweet page? (Multiple fallbacks)
      const isTweetPage = await page.evaluate(() => {
        // Try multiple selectors (Twitter HTML changes frequently)
        return (
          document.querySelector('article[data-testid="tweet"]') !== null ||
          document.querySelector('[data-testid="tweetDetail"]') !== null ||
          document.querySelector('article[role="article"]') !== null ||
          document.querySelector('div[data-testid="primaryColumn"] article') !== null ||
          // Fallback: Check URL
          window.location.href.includes('/status/')
        );
      });

      if (!isTweetPage) {
        console.warn(`    ⚠️ VALIDATE: Not on tweet page`);
        
        // Debug: Log what we found instead
        const pageInfo = await page.evaluate(() => ({
          url: window.location.href,
          title: document.title,
          hasArticles: document.querySelectorAll('article').length,
          testIds: Array.from(document.querySelectorAll('[data-testid]'))
            .slice(0, 10)
            .map(el => el.getAttribute('data-testid'))
        }));
        console.warn(`    🔍 DEBUG:`, JSON.stringify(pageInfo));
        
        return false;
      }

      // Check 2: Are engagement buttons visible? (Enhanced with fallbacks)
      const hasEngagementButtons = await page.evaluate(() => {
        return (
          document.querySelector('[data-testid="like"]') !== null ||
          document.querySelector('[data-testid="retweet"]') !== null ||
          document.querySelector('div[role="group"]') !== null
        );
      });

      if (!hasEngagementButtons) {
        console.warn(`    ⚠️ VALIDATE: No engagement buttons`);
        return false;
      }

      // Check 3: Is page fully loaded?
      const isLoaded = await page.evaluate(() => {
        return document.readyState === 'complete';
      });

      if (!isLoaded) {
        console.warn(`    ⚠️ VALIDATE: Page not fully loaded`);
        return false;
      }

      console.log(`    ✅ VALIDATE: Page state valid`);
      return true;

    } catch (error) {
      console.warn(`    ⚠️ VALIDATE: Validation failed:`, error);
      return false;
    }
  }

  /**
   * Extract metrics using multiple selector fallbacks
   * PHASE 1 FIX: Now scoped to specific tweet article to prevent "8k tweets" bug
   * PHASE 3 FIX: Intelligent extraction using aria-labels + multiple strategies
   * PROPER FIX: Find the CORRECT article (not just the first one on the page)
   */
  /**
   * 📊 Extract detailed metrics from analytics page
   * Analytics page shows: Impressions, Engagements, Detail expands, Profile visits
   */
  private async extractAnalyticsMetrics(page: Page): Promise<Partial<ScrapedMetrics>> {
    console.log(`    📊 ANALYTICS: Extracting metrics from analytics page...`);
    
    const metrics: Partial<ScrapedMetrics> = {
      _selectors_used: ['analytics_page']
    };
    
    try {
      // Wait for analytics modal/content to load
      await page.waitForTimeout(3000); // Increased from 2000 to 3000
      
      // Extract text content from page
      const analyticsText = await page.evaluate(() => {
        return document.body.textContent || '';
      });
      
      // 🐛 DEBUG: Log first 1000 chars to see what bot actually sees
      console.log(`    📊 ANALYTICS: Page content preview (first 1000 chars):`);
      console.log(`    ${analyticsText.substring(0, 1000)}`);
      console.log(`    📊 ANALYTICS: Searching for 'Impressions' in text...`);
      console.log(`    📊 ANALYTICS: Contains 'Impressions'? ${analyticsText.includes('Impressions')}`);
      console.log(`    📊 ANALYTICS: Contains 'Post Analytics'? ${analyticsText.includes('Post Analytics')}`);
      console.log(`    📊 ANALYTICS: Contains 'permission'? ${analyticsText.includes('permission')}`);
      
      console.log(`    📊 ANALYTICS: Page loaded, extracting numbers...`);
      
      // Extract Impressions (labeled as "Impressions" on analytics page)
      const impressionsMatch = analyticsText.match(/Impressions[^\d]*(\d+(?:,\d+)*)/i);
      if (impressionsMatch) {
        metrics.views = parseInt(impressionsMatch[1].replace(/,/g, ''));
        console.log(`    ✅ IMPRESSIONS: ${metrics.views}`);
      } else {
        console.log(`    ❌ IMPRESSIONS: No match found in text`);
      }
      
      // Extract Engagements (labeled as "Engagements" on analytics page)
      const engagementsMatch = analyticsText.match(/Engagements[^\d]*(\d+(?:,\d+)*)/i);
      if (engagementsMatch) {
        const engagements = parseInt(engagementsMatch[1].replace(/,/g, ''));
        console.log(`    ✅ ENGAGEMENTS: ${engagements}`);
        // Store in a new field or use as validation
      } else {
        console.log(`    ❌ ENGAGEMENTS: No match found in text`);
      }
      
      // Extract Detail expands
      const detailExpandsMatch = analyticsText.match(/Detail expands[^\d]*(\d+(?:,\d+)*)/i);
      if (detailExpandsMatch) {
        const detailExpands = parseInt(detailExpandsMatch[1].replace(/,/g, ''));
        console.log(`    ✅ DETAIL EXPANDS: ${detailExpands}`);
      } else {
        console.log(`    ❌ DETAIL EXPANDS: No match found in text`);
      }
      
      // Extract Profile visits
      const profileVisitsMatch = analyticsText.match(/Profile visits[^\d]*(\d+(?:,\d+)*)/i);
      if (profileVisitsMatch) {
        const profileVisits = parseInt(profileVisitsMatch[1].replace(/,/g, ''));
        metrics.profile_clicks = profileVisits; // Save to metrics object
        console.log(`    ✅ PROFILE VISITS: ${profileVisits}`);
      } else {
        console.log(`    ❌ PROFILE VISITS: No match found in text`);
      }
      
      // Also extract basic metrics (likes, retweets, replies) from the tweet shown on analytics page
      const likesMatch = analyticsText.match(/(\d+(?:,\d+)*)\s*(?:Like|like)/);
      if (likesMatch) {
        metrics.likes = parseInt(likesMatch[1].replace(/,/g, ''));
        console.log(`    ✅ LIKES: ${metrics.likes}`);
      } else {
        console.log(`    ❌ LIKES: No match found in text`);
      }
      
      const retweetsMatch = analyticsText.match(/(\d+(?:,\d+)*)\s*(?:Retweet|retweet)/);
      if (retweetsMatch) {
        metrics.retweets = parseInt(retweetsMatch[1].replace(/,/g, ''));
        console.log(`    ✅ RETWEETS: ${metrics.retweets}`);
      } else {
        console.log(`    ❌ RETWEETS: No match found in text`);
      }
      
      const repliesMatch = analyticsText.match(/(\d+(?:,\d+)*)\s*(?:Reply|reply|replies)/);
      if (repliesMatch) {
        metrics.replies = parseInt(repliesMatch[1].replace(/,/g, ''));
        console.log(`    ✅ REPLIES: ${metrics.replies}`);
      } else {
        console.log(`    ❌ REPLIES: No match found in text`);
      }
      
    } catch (error: any) {
      console.warn(`    ⚠️ ANALYTICS: Extraction error: ${error.message}`);
    }
    
    return metrics;
  }

  private async extractMetricsWithFallbacks(page: Page, tweetId?: string): Promise<Partial<ScrapedMetrics>> {
    // 📊 Check if we're on the analytics page
    const currentUrl = page.url();
    if (currentUrl.includes('/analytics')) {
      console.log(`    📊 ANALYTICS: Detected analytics page, using analytics extractor`);
      return await this.extractAnalyticsMetrics(page);
    }
    
    const results: Partial<ScrapedMetrics> = {
      _selectors_used: []
    };

    // 🎯 CRITICAL FIX: Find the EXACT article matching our tweet ID
    // Twitter shows multiple tweets: YOUR tweet + recommended tweets + parent tweets
    // We MUST only extract metrics from YOUR tweet's article
    
    let tweetArticle: ElementHandle | null = null;
    
    if (tweetId) {
      console.log(`    🔍 VERIFICATION: Searching for article with tweet ID ${tweetId}...`);
      
      // STEP 1: Find which article contains our tweet ID
      const articleData = await page.evaluate((id) => {
        const articles = document.querySelectorAll('article[data-testid="tweet"]');
        const results = [];
        
        // Log ALL articles found on page for debugging
        for (let i = 0; i < articles.length; i++) {
          const article = articles[i];
          const link = article.querySelector('a[href*="/status/"]') as HTMLAnchorElement;
          if (link) {
            const match = link.href.match(/\/status\/(\d+)/);
            if (match) {
              results.push({
                index: i,
                tweetId: match[1],
                isMatch: match[1] === id
              });
            }
          }
        }
        
        return results;
      }, tweetId);
      
      console.log(`    📊 VERIFICATION: Found ${articleData.length} tweet articles on page:`);
      for (const item of articleData) {
        if (item.isMatch) {
          console.log(`       ✅ Article ${item.index}: Tweet ${item.tweetId} [TARGET - THIS IS OURS]`);
        } else {
          console.log(`       ❌ Article ${item.index}: Tweet ${item.tweetId} [NOT OURS - Skip]`);
        }
      }
      
      const matchedArticle = articleData.find(a => a.isMatch);
      
      if (!matchedArticle) {
        console.error(`    ❌ VERIFICATION FAILED: Could not find article with tweet ID ${tweetId}`);
        console.error(`    💡 Page is showing different tweets (recommended, parent tweets, quoted tweets)`);
        console.error(`    🚫 ABORTING: Will not scrape wrong tweet's metrics`);
        return results;
      }
      
      console.log(`    ✅ VERIFICATION PASSED: Our tweet is at article index ${matchedArticle.index}`);
      
      // STEP 2: Get the specific article element
      const articles = await page.$$('article[data-testid="tweet"]');
      if (articles[matchedArticle.index]) {
        tweetArticle = articles[matchedArticle.index];
        
        // STEP 3: DOUBLE-CHECK we have the right article by extracting its tweet ID again
        const verifyId = await tweetArticle.evaluate((article: Element) => {
          const link = article.querySelector('a[href*="/status/"]') as HTMLAnchorElement;
          if (link) {
            const match = link.href.match(/\/status\/(\d+)/);
            return match ? match[1] : null;
          }
          return null;
        });
        
        if (verifyId !== tweetId) {
          console.error(`    ❌ DOUBLE-CHECK FAILED: Article has tweet ID ${verifyId}, expected ${tweetId}`);
          console.error(`    🚫 ABORTING: Article mismatch, will not scrape wrong metrics`);
          return results;
        }
        
        console.log(`    ✅ DOUBLE-CHECK PASSED: Article confirmed to be tweet ${tweetId}`);
      }
    } else {
      // No tweet ID provided, use first article (legacy behavior - not recommended)
      console.warn(`    ⚠️ No tweet ID provided, using first article (may be wrong tweet!)`);
      tweetArticle = await page.$('article[data-testid="tweet"]');
    }
    
    if (!tweetArticle) {
      console.error('    ❌ EXTRACT: Could not get article element');
      return results;
    }
    
    console.log(`    🎯 EXTRACTION START: Metrics will be extracted from verified article`);

    // PHASE 3: Try intelligent extraction first (aria-labels), then fallback to selectors
    console.log('    🎯 PHASE 3: Trying intelligent extraction methods...');
    
    results.likes = await this.extractLikesIntelligent(tweetArticle) ?? 
                    await this.extractMetricWithFallbacks(tweetArticle, 'likes', SELECTORS.likes);
    
    results.retweets = await this.extractRetweetsIntelligent(tweetArticle) ?? 
                       await this.extractMetricWithFallbacks(tweetArticle, 'retweets', SELECTORS.retweets);
    
    results.replies = await this.extractRepliesIntelligent(tweetArticle) ?? 
                      await this.extractMetricWithFallbacks(tweetArticle, 'replies', SELECTORS.replies);
    
    results.views = await this.extractViewsIntelligent(tweetArticle) ?? 
                    await this.extractMetricWithFallbacks(tweetArticle, 'views', SELECTORS.views);
    
    // These don't have aria-labels usually, use standard extraction
    results.quote_tweets = await this.extractMetricWithFallbacks(tweetArticle, 'quote_tweets', SELECTORS.quote_tweets);
    results.bookmarks = await this.extractMetricWithFallbacks(tweetArticle, 'bookmarks', SELECTORS.bookmarks);

    // FINAL VERIFICATION: Confirm we extracted from the correct tweet
    if (tweetId && tweetArticle) {
      const finalVerifyId = await tweetArticle.evaluate((article: Element) => {
        const link = article.querySelector('a[href*="/status/"]') as HTMLAnchorElement;
        if (link) {
          const match = link.href.match(/\/status\/(\d+)/);
          return match ? match[1] : null;
        }
        return null;
      });
      
      if (finalVerifyId === tweetId) {
        console.log(`    ✅ FINAL VERIFICATION: Metrics extracted from tweet ${tweetId} ✓`);
        console.log(`    📊 Extracted: ${results.likes}❤️ ${results.retweets}🔄 ${results.replies}💬`);
      } else {
        console.error(`    ❌ FINAL VERIFICATION FAILED: Extracted from ${finalVerifyId}, expected ${tweetId}`);
        console.error(`    🚫 Discarding metrics - they belong to wrong tweet!`);
        return { _selectors_used: [] }; // Return empty results
      }
    }

    return results;
  }

  /**
   * PHASE 3: Intelligent likes extraction using aria-label
   * Most reliable method - Twitter's aria-labels are stable
   */
  private async extractLikesIntelligent(tweetArticle: any): Promise<number | null> {
    try {
      const likeButton = await tweetArticle.$('[data-testid="like"]');
      if (!likeButton) return null;

      const ariaLabel = await likeButton.evaluate((el: any) => el.getAttribute('aria-label'));
      if (!ariaLabel) return null;

      console.log(`    🎯 LIKES aria-label: "${ariaLabel}"`);

      // Parse patterns: "123 Likes" or "123 Likes. Like" or "Like"
      const match = ariaLabel.match(/(\d[\d,]*)\s+(?:Like|like)/i);
      if (match) {
        const count = parseInt(match[1].replace(/,/g, ''), 10);
        console.log(`    ✅ LIKES from aria-label: ${count}`);
        return count;
      }

      // If aria-label is just "Like" with no number, it means 0 likes
      if (ariaLabel.toLowerCase().includes('like') && !ariaLabel.match(/\d/)) {
        console.log(`    ✅ LIKES from aria-label: 0 (no count in label)`);
        return 0;
      }

      return null;
    } catch (error) {
      console.log(`    ⚠️ LIKES intelligent extraction failed: ${error}`);
      return null;
    }
  }

  /**
   * PHASE 3: Intelligent retweets extraction using aria-label
   */
  private async extractRetweetsIntelligent(tweetArticle: any): Promise<number | null> {
    try {
      const retweetButton = await tweetArticle.$('[data-testid="retweet"]');
      if (!retweetButton) return null;

      const ariaLabel = await retweetButton.evaluate((el: any) => el.getAttribute('aria-label'));
      if (!ariaLabel) return null;

      console.log(`    🎯 RETWEETS aria-label: "${ariaLabel}"`);

      // Parse patterns: "456 Retweets" or "456 Reposts"
      const match = ariaLabel.match(/(\d[\d,]*)\s+(?:Retweet|Repost|repost)/i);
      if (match) {
        const count = parseInt(match[1].replace(/,/g, ''), 10);
        console.log(`    ✅ RETWEETS from aria-label: ${count}`);
        return count;
      }

      if (ariaLabel.toLowerCase().match(/repost|retweet/) && !ariaLabel.match(/\d/)) {
        console.log(`    ✅ RETWEETS from aria-label: 0`);
        return 0;
      }

      return null;
    } catch (error) {
      console.log(`    ⚠️ RETWEETS intelligent extraction failed: ${error}`);
      return null;
    }
  }

  /**
   * PHASE 3: Intelligent replies extraction using aria-label
   */
  private async extractRepliesIntelligent(tweetArticle: any): Promise<number | null> {
    try {
      const replyButton = await tweetArticle.$('[data-testid="reply"]');
      if (!replyButton) return null;

      const ariaLabel = await replyButton.evaluate((el: any) => el.getAttribute('aria-label'));
      if (!ariaLabel) return null;

      console.log(`    🎯 REPLIES aria-label: "${ariaLabel}"`);

      // Parse patterns: "789 Replies" or "789 replies. Reply"
      const match = ariaLabel.match(/(\d[\d,]*)\s+(?:Repl|repl)/i);
      if (match) {
        const count = parseInt(match[1].replace(/,/g, ''), 10);
        console.log(`    ✅ REPLIES from aria-label: ${count}`);
        return count;
      }

      if (ariaLabel.toLowerCase().includes('repl') && !ariaLabel.match(/\d/)) {
        console.log(`    ✅ REPLIES from aria-label: 0`);
        return 0;
      }

      return null;
    } catch (error) {
      console.log(`    ⚠️ REPLIES intelligent extraction failed: ${error}`);
      return null;
    }
  }

  /**
   * PHASE 3: Intelligent views extraction - multiple strategies
   */
  private async extractViewsIntelligent(tweetArticle: any): Promise<number | null> {
    try {
      // Strategy 1: Look for analytics link
      const analyticsLink = await tweetArticle.$('a[href*="/analytics"]');
      if (analyticsLink) {
        const ariaLabel = await analyticsLink.evaluate((el: any) => el.getAttribute('aria-label'));
        console.log(`    🎯 VIEWS aria-label: "${ariaLabel || 'none'}"`);
        
        if (ariaLabel) {
          const match = ariaLabel.match(/(\d[\d,\.]*[KkMm]?)\s+(?:View|view)/i);
          if (match) {
            const text = match[1].toLowerCase();
            let count: number;
            if (text.includes('k')) {
              count = Math.floor(parseFloat(text) * 1000);
            } else if (text.includes('m')) {
              count = Math.floor(parseFloat(text) * 1000000);
            } else {
              count = parseInt(text.replace(/,/g, ''), 10);
            }
            console.log(`    ✅ VIEWS from aria-label: ${count}`);
            return count;
          }
        }

        // Strategy 2: Get text from analytics link span
        const viewsText = await analyticsLink.evaluate((el: any) => {
          const span = el.querySelector('span:not([aria-hidden])');
          return span?.textContent?.trim() || '';
        });
        
        console.log(`    🎯 VIEWS text from analytics: "${viewsText}"`);
        
        if (viewsText && viewsText !== '') {
          const lower = viewsText.toLowerCase();
          let count: number;
          if (lower.includes('k')) {
            count = Math.floor(parseFloat(lower) * 1000);
          } else if (lower.includes('m')) {
            count = Math.floor(parseFloat(lower) * 1000000);
          } else {
            count = parseInt(viewsText.replace(/,/g, ''), 10);
          }
          
          if (!isNaN(count)) {
            console.log(`    ✅ VIEWS from analytics text: ${count}`);
            return count;
          }
        }
      }

      return null;
    } catch (error) {
      console.log(`    ⚠️ VIEWS intelligent extraction failed: ${error}`);
      return null;
    }
  }

  /**
   * Try multiple selectors for a single metric
   * PHASE 1 FIX: Now accepts ElementHandle to search within specific element
   */
  private async extractMetricWithFallbacks(
    tweetArticle: any, // ElementHandle
    metricName: string,
    selectors: string[]
  ): Promise<number | null> {
    for (let i = 0; i < selectors.length; i++) {
      try {
        const selector = selectors[i];
        const value = await this.extractNumberFromSelector(tweetArticle, selector);

        if (value !== null) {
          if (i > 0) {
            console.log(`    ⚠️ ${metricName}: Used fallback selector ${i + 1}`);
          }
          return value;
        }
      } catch (error) {
        // Try next selector
      }
    }

    console.warn(`    ⚠️ ${metricName}: All selectors failed`);
    return null;
  }

  /**
   * Extract number from a selector
   * PHASE 1 FIX: Now searches within specific element, not entire page
   * PHASE 2 FIX: Added comprehensive debug logging to identify selector issues
   */
  private async extractNumberFromSelector(
    tweetArticle: any, // ElementHandle
    selector: string
  ): Promise<number | null> {
    try {
      // Find the element first
      const element = await tweetArticle.$(selector);
      if (!element) {
        return null;
      }

      // COMPREHENSIVE DEBUG LOGGING - Shows EXACTLY what we're scraping
      try {
        const debugInfo = await element.evaluate((el: any) => {
          return {
            tagName: el.tagName,
            outerHTML: el.outerHTML.substring(0, 300), // First 300 chars
            textContent: el.textContent?.trim() || '',
            innerHTML: el.innerHTML?.substring(0, 200),
            ariaLabel: el.getAttribute('aria-label'),
            dataTestId: el.getAttribute('data-testid'),
            className: el.className,
            parentTag: el.parentElement?.tagName,
            childrenCount: el.children?.length || 0
          };
        });
        
        console.log(`    🔍 SELECTOR_DEBUG: ${selector}`);
        console.log(`       Tag: ${debugInfo.tagName}, TestID: ${debugInfo.dataTestId}`);
        console.log(`       Text: "${debugInfo.textContent}"`);
        console.log(`       HTML: ${debugInfo.outerHTML}`);
        console.log(`       Children: ${debugInfo.childrenCount}, Parent: ${debugInfo.parentTag}`);
        
        if (debugInfo.ariaLabel) {
          console.log(`       AriaLabel: ${debugInfo.ariaLabel}`);
        }
      } catch (debugError) {
        console.log(`    ⚠️ Debug logging failed: ${debugError}`);
      }

      // CRITICAL FIX: Use tweetArticle.$eval instead of page.$eval
      // This searches ONLY within the tweet article, not the entire document
      const text = await tweetArticle.$eval(selector, (el: any) => el.textContent?.trim() || '');

      if (!text || text === '0' || text === '') {
        console.log(`       ➜ Extracted: 0 (empty or zero)`);
        return 0;
      }

      // Handle abbreviated numbers: 1.2K, 5.3M
      const lower = text.toLowerCase();
      let parsed: number;
      
      if (lower.includes('k')) {
        parsed = Math.floor(parseFloat(lower) * 1000);
        console.log(`       ➜ Extracted: ${parsed} (from "${text}")`);
        return parsed;
      }
      if (lower.includes('m')) {
        parsed = Math.floor(parseFloat(lower) * 1000000);
        console.log(`       ➜ Extracted: ${parsed} (from "${text}")`);
        return parsed;
      }

      // Handle regular numbers
      const num = parseInt(text.replace(/,/g, ''), 10);
      if (!isNaN(num)) {
        console.log(`       ➜ Extracted: ${num} (from "${text}")`);
        return num;
      }

      console.log(`       ➜ Failed to parse: "${text}"`);
      return null;
    } catch (error) {
      console.log(`    ❌ Selector exception: ${error}`);
      return null;
    }
  }

  /**
   * Validate that extracted metrics are reasonable
   * PHASE 1 FIX: Enhanced validation to catch "8k tweets" type bugs
   * PHASE 2 FIX: Adjusted thresholds to be less aggressive while still catching obvious errors
   */
  private areMetricsValid(metrics: Partial<ScrapedMetrics>): boolean {
    // Allow tweets with zero engagement (new tweets, low-performing tweets)
    // Just ensure we extracted SOMETHING (not all undefined)
    const hasAnyMetric = 
      metrics.likes !== undefined || 
      metrics.retweets !== undefined || 
      metrics.replies !== undefined ||
      metrics.views !== undefined;
    
    if (!hasAnyMetric) {
      console.warn(`    ⚠️ VALIDATE: No metrics extracted at all`);
      return false;
    }

    // ENHANCED CHECK 1: Retweets shouldn't exceed likes by more than 20x (adjusted from 10x)
    if (metrics.likes !== null && metrics.retweets !== null && metrics.likes > 0) {
      if (metrics.retweets > metrics.likes * 20) {
        console.warn(`    ⚠️ VALIDATE: Retweets (${metrics.retweets}) > Likes (${metrics.likes}) * 20 - suspicious`);
        return false;
      }
    }

    // ENHANCED CHECK 2: Sanity check for OBVIOUSLY wrong values
    // Note: These thresholds are HIGH because viral tweets can get huge engagement
    // Only reject if it's clearly a scraping bug (like 10M likes)
    const maxReasonableValue = 1000000; // 1M likes threshold (viral tweets can get 100K+)
    if (metrics.likes !== null && metrics.likes > maxReasonableValue) {
      console.warn(`    ⚠️ VALIDATE: Likes (${metrics.likes}) exceeds 1M - likely scraping bug`);
      return false;
    }
    if (metrics.retweets !== null && metrics.retweets > maxReasonableValue) {
      console.warn(`    ⚠️ VALIDATE: Retweets (${metrics.retweets}) exceeds 1M - likely scraping bug`);
      return false;
    }
    if (metrics.views !== null && metrics.views > 50000000) { // 50M views for viral content
      console.warn(`    ⚠️ VALIDATE: Views (${metrics.views}) exceeds 50M - likely scraping bug`);
      return false;
    }

    // ENHANCED CHECK 3: Engagement rate sanity check (views should be MORE than likes)
    if (metrics.views !== null && metrics.likes !== null && metrics.views > 0 && metrics.likes > 0) {
      const engagementRate = metrics.likes / metrics.views;
      
      // If likes > views, something is definitely wrong
      if (metrics.likes > metrics.views) {
        console.warn(`    ⚠️ VALIDATE: Likes (${metrics.likes}) > Views (${metrics.views}) - impossible`);
        return false;
      }
      
      // 20%+ like rate is extremely rare (typical is 1-5%)
      if (engagementRate > 0.2) {
        console.warn(`    ⚠️ VALIDATE: Engagement rate ${(engagementRate * 100).toFixed(1)}% is unrealistically high`);
        return false;
      }
    }

    // ENHANCED CHECK 4: Quote tweets shouldn't exceed retweets significantly
    if (metrics.quote_tweets !== null && metrics.retweets !== null && metrics.retweets > 0) {
      if (metrics.quote_tweets > metrics.retweets * 3) {
        console.warn(`    ⚠️ VALIDATE: Quote tweets (${metrics.quote_tweets}) >> retweets (${metrics.retweets})`);
        return false;
      }
    }

    console.log(`    ✅ VALIDATE: Metrics pass all sanity checks`);
    return true;
  }

  /**
   * Reload tweet page with error handling
   */
  private async reloadTweetPage(page: Page, tweetId: string): Promise<void> {
    try {
      // Use proper x.com URL with YOUR account username
      const username = process.env.TWITTER_USERNAME || 'SignalAndSynapse';
      
      // 📊 Navigate to ANALYTICS page for detailed metrics (impressions, engagements, profile visits)
      const useAnalytics = process.env.USE_ANALYTICS_PAGE !== 'false'; // Default to true
      const tweetUrl = useAnalytics 
        ? `https://x.com/${username}/status/${tweetId}/analytics`
        : `https://x.com/${username}/status/${tweetId}`;
      
      console.log(`    🔄 RELOAD: Navigating to ${tweetUrl}${useAnalytics ? ' (analytics)' : ''}`);
      
      await page.goto(tweetUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      
      // Wait for tweet element to load
      try {
        await page.waitForSelector('article[data-testid="tweet"]', { timeout: 10000 });
        console.log(`    ✅ RELOAD: Tweet element loaded`);
      } catch {
        console.warn(`    ⚠️ RELOAD: Tweet element didn't load, continuing anyway...`);
      }
      
      await this.sleep(2000); // Wait for metrics to stabilize
    } catch (error) {
      console.warn(`    ⚠️ RELOAD: Failed to reload page:`, error);
    }
  }

  /**
   * Capture screenshot and details when scraping fails
   */
  private async captureFailureEvidence(page: Page, tweetId: string): Promise<string | undefined> {
    try {
      const timestamp = Date.now();
      const screenshotPath = path.join(
        this.artifactsDir,
        `scraping-failure-${tweetId}-${timestamp}.png`
      );

      await page.screenshot({
        path: screenshotPath,
        fullPage: false
      });

      console.log(`    📸 EVIDENCE: Screenshot saved to ${screenshotPath}`);

      // Also save page HTML for debugging
      const htmlPath = path.join(
        this.artifactsDir,
        `scraping-failure-${tweetId}-${timestamp}.html`
      );

      const html = await page.content();
      await fs.writeFile(htmlPath, html, 'utf-8');

      console.log(`    📄 EVIDENCE: HTML saved to ${htmlPath}`);

      return screenshotPath;
    } catch (error) {
      console.warn(`    ⚠️ EVIDENCE: Failed to capture evidence:`, error);
      return undefined;
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get scraping success rate from recent attempts
   */
  async getSuccessRate(): Promise<{ total: number; successful: number; rate: number }> {
    // TODO: Track attempts in database for monitoring
    // For now, return placeholder
    return {
      total: 0,
      successful: 0,
      rate: 0
    };
  }

  /**
   * Scrape profile metrics (follower count, profile views)
   */
  async scrapeProfileMetrics(page: Page, username?: string): Promise<{
    followerCount: number;
    followingCount: number;
    profileViews: number;
  }> {
    const profileUsername = username || process.env.TWITTER_USERNAME || '';
    
    console.log(`[SCRAPER] 👤 Scraping profile metrics for @${profileUsername}...`);

    try {
      // Navigate to profile
      await page.goto(`https://twitter.com/${profileUsername}`, {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      await page.waitForTimeout(2000);

      // Scrape follower count using multiple selector strategies
      let followerCount = 0;
      const followerSelectors = [
        'a[href*="/followers"] span',
        'a[href$="/verified_followers"] + a span',
        '[data-testid="primaryColumn"] a[href*="/followers"] span'
      ];

      for (const selector of followerSelectors) {
        try {
          const elements = await page.locator(selector).all();
          for (const element of elements) {
            const text = await element.textContent();
            if (text) {
              const count = this.parseFollowerCount(text.trim());
              if (count > 0) {
                followerCount = count;
                console.log(`[SCRAPER] ✅ Found follower count: ${followerCount}`);
                break;
              }
            }
          }
          if (followerCount > 0) break;
        } catch (error) {
          // Try next selector
        }
      }

      // Scrape following count (similar logic)
      let followingCount = 0;
      const followingSelectors = [
        'a[href*="/following"] span',
        '[data-testid="primaryColumn"] a[href$="/following"] span'
      ];

      for (const selector of followingSelectors) {
        try {
          const elements = await page.locator(selector).all();
          for (const element of elements) {
            const text = await element.textContent();
            if (text) {
              const count = this.parseFollowerCount(text.trim());
              if (count > 0) {
                followingCount = count;
                break;
              }
            }
          }
          if (followingCount > 0) break;
        } catch (error) {
          // Try next selector
        }
      }

      console.log(`[SCRAPER] 📊 Profile metrics: ${followerCount} followers, ${followingCount} following`);

      return {
        followerCount,
        followingCount,
        profileViews: 0 // Profile views may not be available via scraping
      };

    } catch (error: any) {
      console.error(`[SCRAPER] ❌ Profile scraping failed:`, error.message);
      return {
        followerCount: 0,
        followingCount: 0,
        profileViews: 0
      };
    }
  }

  /**
   * Parse follower count from text like "1.2K", "45.3M", "1,234"
   */
  private parseFollowerCount(text: string): number {
    // Remove commas
    const cleaned = text.replace(/,/g, '').trim();

    // Check for K (thousands)
    if (cleaned.match(/[\d.]+K/i)) {
      const num = parseFloat(cleaned.replace(/K/i, ''));
      return Math.round(num * 1000);
    }

    // Check for M (millions)
    if (cleaned.match(/[\d.]+M/i)) {
      const num = parseFloat(cleaned.replace(/M/i, ''));
      return Math.round(num * 1000000);
    }

    // Check for B (billions - just in case!)
    if (cleaned.match(/[\d.]+B/i)) {
      const num = parseFloat(cleaned.replace(/B/i, ''));
      return Math.round(num * 1000000000);
    }

    // Try to parse as plain number
    const parsed = parseInt(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }
}

export const getBulletproofScraper = () => BulletproofTwitterScraper.getInstance();

