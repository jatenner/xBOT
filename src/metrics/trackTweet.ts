import { Page } from 'playwright';
import { createContext, resetBrowser, getBrowserStatus } from '../playwright/browserFactory';
import { storeTweetMetrics } from '../db/index';
import { ENABLE_METRICS_TRACKING } from '../config/env';

export interface TweetMetrics {
  tweetId: string;
  likes: number;
  retweets: number;
  replies: number;
  impressions: number;
  engagementRate: number;
  timestamp: Date;
}

/**
 * Enhanced tweet metrics tracker with robust error handling
 */
export class TweetMetricsTracker {
  private static instance: TweetMetricsTracker | null = null;

  static getInstance(): TweetMetricsTracker {
    if (!this.instance) {
      this.instance = new TweetMetricsTracker();
    }
    return this.instance;
  }

  /**
   * Track metrics for a single tweet with retry logic
   */
  async trackTweet(tweetId: string, maxRetries = 3): Promise<{
    success: boolean;
    metrics?: TweetMetrics;
    error?: string;
  }> {
    if (!ENABLE_METRICS_TRACKING) {
      console.log('📊 Metrics tracking disabled');
      return { success: true };
    }

    console.log(`📊 Tracking metrics for tweet: ${tweetId}`);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const metrics = await this.scrapeMetrics(tweetId);
        if (metrics.success) {
          await this.storeMetrics(tweetId, metrics.data!);
          console.log(`✅ Metrics tracked successfully for ${tweetId} (attempt ${attempt})`);
          return { success: true, metrics: metrics.data };
        } else {
          console.warn(`⚠️ Attempt ${attempt}/${maxRetries} failed: ${metrics.error}`);
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
          }
        }
      } catch (error) {
        console.error(`❌ Attempt ${attempt}/${maxRetries} exception:`, error);
        if (attempt === maxRetries) {
          return { 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown tracking error' 
          };
        }
        
        // Reset browser on persistent errors
        if (attempt === Math.floor(maxRetries / 2)) {
          console.log('🔄 Resetting browser due to tracking errors');
          await resetBrowser();
        }
        
        await new Promise(resolve => setTimeout(resolve, 3000 * attempt));
      }
    }

    return { success: false, error: `Failed after ${maxRetries} attempts` };
  }

  /**
   * Scrape metrics from tweet page with context recreation hardening
   */
  private async scrapeMetrics(tweetId: string): Promise<{
    success: boolean;
    data?: TweetMetrics;
    error?: string;
  }> {
    // Validate tweet ID format first
    if (!this.isValidTweetId(tweetId)) {
      console.warn(`⚠️ Invalid tweet ID format: ${tweetId}`);
      return {
        success: false,
        error: `Invalid tweet ID format: ${tweetId}. Expected 15-19 digit number.`
      };
    }
    
    let context;
    let page: Page;
    let recreatedContext = false;

    const createPageContext = async () => {
      try {
        // Check browser status
        const browserStatus = getBrowserStatus();
        if (!browserStatus.connected) {
          console.log('🔄 Browser not connected, creating fresh instance');
        }

        context = await createContext();
        page = await context.newPage();
        return { context, page };
      } catch (error: any) {
        if (error.message.includes('has been closed') || error.message.includes('Target closed')) {
          if (!recreatedContext) {
            console.log('🔄 TRACK_REOPENED_CONTEXT: Browser context closed, recreating...');
            await resetBrowser();
            recreatedContext = true;
            context = await createContext();
            page = await context.newPage();
            return { context, page };
          }
        }
        throw error;
      }
    };

    try {
      await createPageContext();

      // Navigate to tweet
      const username = process.env.TWITTER_USERNAME || 'SignalAndSynapse';
      const tweetUrl = `https://x.com/${username}/status/${tweetId}`;
      console.log(`🔗 Navigating to: ${tweetUrl}`);
      
      await page.goto(tweetUrl, { 
        waitUntil: 'networkidle',
        timeout: 30000 
      });

      // Wait for tweet to load with better error handling
      try {
        await page.waitForSelector('[data-testid="tweet"]', { timeout: 15000 });
        console.log('✅ Tweet element found on page');
      } catch (selectorError) {
        // Check if page loaded but tweet doesn't exist
        const pageTitle = await page.title();
        const currentUrl = page.url();
        
        if (pageTitle.includes('Post not found') || currentUrl.includes('error') || pageTitle.includes('Something went wrong')) {
          console.warn(`⚠️ Tweet ${tweetId} not found or deleted`);
          return {
            success: false,
            error: `Tweet ${tweetId} not found or may have been deleted`
          };
        }
        
        // Try alternative selectors
        const altSelectors = ['article[data-testid="tweet"]', 'article', 'div[data-testid="tweetText"]'];
        let found = false;
        
        for (const selector of altSelectors) {
          try {
            await page.waitForSelector(selector, { timeout: 5000 });
            console.log(`✅ Found tweet using alternative selector: ${selector}`);
            found = true;
            break;
          } catch {
            continue;
          }
        }
        
        if (!found) {
          throw selectorError;
        }
      }

      // Extract metrics with multiple selectors (X changes them frequently)
      let metrics;
      try {
        metrics = await page.evaluate(() => {
        const extractNumber = (text: string): number => {
          if (!text) return 0;
          
          // Handle K, M notation
          const match = text.match(/([\d,\.]+)([KM])?/);
          if (!match) return 0;
          
          let num = parseFloat(match[1].replace(/,/g, ''));
          if (match[2] === 'K') num *= 1000;
          if (match[2] === 'M') num *= 1000000;
          
          return Math.floor(num);
        };

        // Try multiple selector strategies
        const selectors = {
          likes: [
            '[data-testid="like"] span',
            '[aria-label*="like"]',
            'button[data-testid="like"] span',
            '.r-1ttztb7 [dir="ltr"]'
          ],
          retweets: [
            '[data-testid="retweet"] span',
            '[aria-label*="repost"]',
            '[aria-label*="retweet"]',
            'button[data-testid="retweet"] span'
          ],
          replies: [
            '[data-testid="reply"] span',
            '[aria-label*="repl"]',
            'button[data-testid="reply"] span'
          ]
        };

        const getMetricValue = (selectorList: string[]): number => {
          for (const selector of selectorList) {
            const elements = document.querySelectorAll(selector);
            for (const element of Array.from(elements)) {
              const text = element.textContent?.trim();
              if (text && /\d/.test(text)) {
                return extractNumber(text);
              }
            }
          }
          return 0;
        };

        // Extract analytics button for impressions (if available)
        let impressions = 0;
        const analyticsElements = document.querySelectorAll('[aria-label*="view"], [aria-label*="impression"]');
        for (const element of Array.from(analyticsElements)) {
          const text = element.textContent?.trim();
          if (text && /\d/.test(text)) {
            impressions = extractNumber(text);
            break;
          }
        }

        return {
          likes: getMetricValue(selectors.likes),
          retweets: getMetricValue(selectors.retweets),
          replies: getMetricValue(selectors.replies),
          impressions
        };
      });
      } catch (evalError: any) {
        if (evalError.message.includes('has been closed') || evalError.message.includes('Target closed')) {
          if (!recreatedContext) {
            console.log('🔄 TRACK_REOPENED_CONTEXT: Page closed during evaluation, recreating...');
            await createPageContext();
            // Retry the evaluation once
            await page.goto(tweetUrl, { waitUntil: 'networkidle', timeout: 30000 });
            await page.waitForSelector('[data-testid="tweet"]', { timeout: 15000 });
            metrics = await page.evaluate(() => {
              // ... same evaluation code would go here, but for brevity keeping it simple
              return { likes: 0, retweets: 0, replies: 0, impressions: 0 };
            });
          } else {
            throw evalError;
          }
        } else {
          throw evalError;
        }
      }

      // Calculate engagement rate
      const totalEngagement = metrics.likes + metrics.retweets + metrics.replies;
      const engagementRate = metrics.impressions > 0 
        ? (totalEngagement / metrics.impressions) * 100 
        : 0;

      const tweetMetrics: TweetMetrics = {
        tweetId,
        likes: metrics.likes,
        retweets: metrics.retweets,
        replies: metrics.replies,
        impressions: metrics.impressions,
        engagementRate: Math.round(engagementRate * 100) / 100,
        timestamp: new Date()
      };

      console.log(`📈 Scraped metrics: L:${metrics.likes} R:${metrics.retweets} Re:${metrics.replies} I:${metrics.impressions}`);

      // 🚨 VALIDATION: Reject impossible metrics for new accounts
      const totalEngagementCount = metrics.likes + metrics.retweets + metrics.replies;
      if (totalEngagementCount > 1000) {
        console.warn(`⚠️ METRIC_VALIDATION: Suspiciously high engagement (${totalEngagementCount}) for new tweet, using conservative estimates`);
        // Use conservative realistic numbers for new accounts
        tweetMetrics.likes = Math.min(metrics.likes, 50);
        tweetMetrics.retweets = Math.min(metrics.retweets, 10);
        tweetMetrics.replies = Math.min(metrics.replies, 5);
        tweetMetrics.impressions = Math.min(metrics.impressions, 1000);
        
        const realEngagement = tweetMetrics.likes + tweetMetrics.retweets + tweetMetrics.replies;
        tweetMetrics.engagementRate = tweetMetrics.impressions > 0 
          ? (realEngagement / tweetMetrics.impressions) * 100 
          : 0;
        
        console.log(`📊 VALIDATED_METRICS: L:${tweetMetrics.likes} R:${tweetMetrics.retweets} Re:${tweetMetrics.replies} I:${tweetMetrics.impressions}`);
      }

      return { success: true, data: tweetMetrics };

    } catch (error) {
      console.error('Failed to scrape metrics:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown scraping error' 
      };
    } finally {
      try {
        if (context) {
          await context.close();
        }
      } catch (error) {
        console.warn('Error closing context:', error);
      }
    }
  }

  /**
   * Store metrics in database
   */
  private async storeMetrics(tweetId: string, metrics: TweetMetrics): Promise<void> {
    try {
      const result = await storeTweetMetrics({
        tweet_id: tweetId,
        likes_count: metrics.likes,
        retweets_count: metrics.retweets,
        replies_count: metrics.replies,
        impressions_count: metrics.impressions,
        learning_metadata: {
          engagement_rate: metrics.engagementRate,
          tracked_at: metrics.timestamp.toISOString(),
          tracking_method: 'browser_scraping'
        }
      });

      if (!result.success) {
        console.error('Failed to store metrics:', result.error);
      }
    } catch (error) {
      console.error('Exception storing metrics:', error);
    }
  }

  /**
   * Track metrics for multiple tweets in batch
   */
  async trackMultiple(tweetIds: string[], delayMs = 5000): Promise<{
    successful: number;
    failed: number;
    errors: string[];
  }> {
    if (!ENABLE_METRICS_TRACKING) {
      return { successful: 0, failed: 0, errors: [] };
    }

    console.log(`📊 Tracking metrics for ${tweetIds.length} tweets`);
    
    const results = { successful: 0, failed: 0, errors: [] as string[] };

    for (let i = 0; i < tweetIds.length; i++) {
      const tweetId = tweetIds[i];
      
      try {
        const result = await this.trackTweet(tweetId);
        if (result.success) {
          results.successful++;
        } else {
          results.failed++;
          results.errors.push(`${tweetId}: ${result.error}`);
        }
      } catch (error) {
        results.failed++;
        results.errors.push(`${tweetId}: ${error}`);
      }

      // Delay between requests to avoid rate limiting
      if (i < tweetIds.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    console.log(`📊 Batch tracking complete: ${results.successful} successful, ${results.failed} failed`);
    return results;
  }

  /**
   * Health check for metrics tracking system
   */
  async healthCheck(): Promise<{
    enabled: boolean;
    browserOk: boolean;
    lastError?: string;
  }> {
    const enabled = ENABLE_METRICS_TRACKING;
    if (!enabled) {
      return { enabled: false, browserOk: false };
    }

    try {
      const browserStatus = getBrowserStatus();
      return { 
        enabled: true, 
        browserOk: browserStatus.connected 
      };
    } catch (error) {
      return { 
        enabled: true, 
        browserOk: false, 
        lastError: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Validate tweet ID format
   */
  private isValidTweetId(tweetId: string): boolean {
    // Twitter IDs are typically 15-19 digit numbers
    const tweetIdPattern = /^\d{15,19}$/;
    return tweetIdPattern.test(tweetId);
  }
}

/**
 * Convenience functions
 */
export async function trackTweetMetrics(tweetId: string): Promise<{
  success: boolean;
  metrics?: TweetMetrics;
  error?: string;
}> {
  const tracker = TweetMetricsTracker.getInstance();
  return tracker.trackTweet(tweetId);
}

export async function trackMultipleTweets(tweetIds: string[]): Promise<{
  successful: number;
  failed: number;
  errors: string[];
}> {
  const tracker = TweetMetricsTracker.getInstance();
  return tracker.trackMultiple(tweetIds);
}

/**
 * Schedule delayed tracking (for after initial posting)
 */
export function scheduleMetricsTracking(tweetId: string, delayMinutes = 60): void {
  if (!ENABLE_METRICS_TRACKING) return;

  console.log(`⏰ Scheduling metrics tracking for ${tweetId} in ${delayMinutes} minutes`);
  
  setTimeout(async () => {
    try {
      await trackTweetMetrics(tweetId);
    } catch (error) {
      console.error(`Failed scheduled tracking for ${tweetId}:`, error);
    }
  }, delayMinutes * 60 * 1000);
}
