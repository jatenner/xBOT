import { Page } from 'playwright';
import BrowserManager from '../core/BrowserManager';

export interface TweetMetrics {
  tweetId: string;
  likes: number;
  retweets: number;
  replies: number;
  bookmarks: number;
  views: number;
  profileClicks: number;
  newFollowers: number;
  timestamp: Date;
}

export interface FollowerGrowthData {
  beforeCount: number;
  afterCount: number;
  growthAmount: number;
  timeframe: number; // minutes
  attributedToTweet: boolean;
}

/**
 * Browser-based tweet performance tracking for learning and optimization
 * Collects real engagement data to improve content strategy
 */
export class TweetPerformanceTracker {
  private static instance: TweetPerformanceTracker;
  private consecutiveFailures = 0;
  private pausedUntil: Date | null = null;

  private constructor() {}

  public static getInstance(): TweetPerformanceTracker {
    if (!TweetPerformanceTracker.instance) {
      TweetPerformanceTracker.instance = new TweetPerformanceTracker();
    }
    return TweetPerformanceTracker.instance;
  }

  /**
   * Track tweet performance via browser automation
   */
  public async trackTweetPerformance(tweetUrl: string): Promise<TweetMetrics> {
    // Check if paused due to consecutive failures
    if (this.pausedUntil && new Date() < this.pausedUntil) {
      const remainingMs = this.pausedUntil.getTime() - Date.now();
      throw new Error(`Tweet tracking paused for ${Math.ceil(remainingMs / 60000)} more minutes due to consecutive failures`);
    }
    
    console.log('📊 Tracking tweet performance via browser automation...');
    
    try {
      return await BrowserManager.withContext(async (context) => {
        const page = await context.newPage();
      
      // Navigate to the tweet
      await page.goto(tweetUrl);
      await page.waitForTimeout(3000);

      // Extract engagement metrics from tweet
      const metrics = await this.extractTweetMetrics(page, tweetUrl);
      
      // Get current follower count for attribution (non-blocking)
      let followerData = 0;
      try {
        followerData = await this.getFollowerCount(page);
      } catch (error) {
        console.warn('Follower count fetch failed, continuing with tracking:', error);
      }
      
      console.log(`✅ Tweet metrics collected: ${metrics.likes} likes, ${metrics.retweets} retweets, ${metrics.replies} replies`);
      
      // Store metrics in database for learning
      await this.storeTweetMetrics(metrics);
      
      return metrics;
      
    } catch (error: any) {
      console.error('⚠️ Tweet performance tracking failed:', error.message);
      
      // Return empty metrics on failure
      return {
        tweetId: this.extractTweetIdFromUrl(tweetUrl),
        likes: 0,
        retweets: 0,
        replies: 0,
        bookmarks: 0,
        views: 0,
        profileClicks: 0,
        newFollowers: 0,
        timestamp: new Date()
      };
    }
  }

  /**
   * Extract engagement metrics from tweet page
   */
  private async extractTweetMetrics(page: Page, tweetUrl: string): Promise<TweetMetrics> {
    const tweetId = this.extractTweetIdFromUrl(tweetUrl);
    
    // Get engagement numbers using multiple selectors for reliability
    const likes = await this.getEngagementCount(page, [
      '[data-testid="like"] [data-testid="app-text-transition-container"]',
      '[data-testid="like"] span[data-testid="app-text-transition-container"]',
      '[aria-label*="likes"] span'
    ]);

    const retweets = await this.getEngagementCount(page, [
      '[data-testid="retweet"] [data-testid="app-text-transition-container"]', 
      '[data-testid="retweet"] span[data-testid="app-text-transition-container"]',
      '[aria-label*="repost"] span'
    ]);

    const replies = await this.getEngagementCount(page, [
      '[data-testid="reply"] [data-testid="app-text-transition-container"]',
      '[data-testid="reply"] span[data-testid="app-text-transition-container"]',
      '[aria-label*="repl"] span'
    ]);

    const bookmarks = await this.getEngagementCount(page, [
      '[data-testid="bookmark"] [data-testid="app-text-transition-container"]',
      '[data-testid="bookmark"] span',
      '[aria-label*="bookmark"] span'
    ]);

    // Get view count from analytics if available
    const views = await this.getTweetViews(page);
    
        return {
          tweetId,
          likes,
          retweets, 
          replies,
          bookmarks,
          views,
          profileClicks: 0, // Would need Twitter Analytics API
          newFollowers: 0,  // Will be calculated separately
          timestamp: new Date()
        };
      });
      
      // Reset failure count on success
      this.consecutiveFailures = 0;
      this.pausedUntil = null;
      
    } catch (error: any) {
      this.consecutiveFailures++;
      
      if (this.consecutiveFailures >= 3) {
        // Pause for 10 minutes after 3 consecutive failures
        this.pausedUntil = new Date(Date.now() + 10 * 60 * 1000);
        console.warn(`📊 Tweet tracking paused for 10 minutes after ${this.consecutiveFailures} consecutive failures`);
      }
      
      console.error('📊 Tweet performance tracking failed:', error.message);
      throw error;
    }
  }

  /**
   * Get engagement count with fallback selectors
   */
  private async getEngagementCount(page: Page, selectors: string[]): Promise<number> {
    for (const selector of selectors) {
      try {
        const element = await page.locator(selector).first();
        if (await element.isVisible()) {
          const text = await element.textContent();
          if (text) {
            return this.parseEngagementNumber(text);
          }
        }
      } catch (error) {
        // Try next selector
      }
    }
    return 0;
  }

  /**
   * Parse engagement numbers (handles 1.2K, 1M, etc.)
   */
  private parseEngagementNumber(text: string): number {
    const cleanText = text.replace(/[^\d.KMB]/gi, '');
    const number = parseFloat(cleanText);
    
    if (cleanText.includes('K')) return Math.floor(number * 1000);
    if (cleanText.includes('M')) return Math.floor(number * 1000000);
    if (cleanText.includes('B')) return Math.floor(number * 1000000000);
    
    return Math.floor(number) || 0;
  }

  /**
   * Get tweet view count from analytics
   */
  private async getTweetViews(page: Page): Promise<number> {
    try {
      // Look for view analytics
      const viewsElement = await page.locator('[aria-label*="views"], [data-testid*="analytics"]').first();
      if (await viewsElement.isVisible()) {
        const text = await viewsElement.textContent();
        if (text) {
          return this.parseEngagementNumber(text);
        }
      }
    } catch (error) {
      // Views might not be available
    }
    return 0;
  }

  /**
   * Get current follower count for growth attribution (non-blocking)
   */
  private async getFollowerCount(page: Page): Promise<number> {
    try {
      // Navigate to profile with robust timeout settings
      await page.goto('https://twitter.com/Signal_Synapse', { 
        waitUntil: "domcontentloaded", 
        timeout: 60000 
      });
      await page.waitForTimeout(2000);
      
      // Get follower count with timeout
      const followerElement = await page.locator('[href$="/followers"] span, [data-testid="UserName"] + div span').first();
      if (await followerElement.isVisible({ timeout: 10000 })) {
        const text = await followerElement.textContent();
        if (text) {
          return this.parseEngagementNumber(text);
        }
      }
    } catch (error) {
      console.warn('Could not get follower count:', error);
    }
    return 0;
  }

  /**
   * Track follower growth over time periods
   */
  public async trackFollowerGrowth(beforeTweetCount: number): Promise<FollowerGrowthData> {
    const afterCount = await this.getCurrentFollowerCount();
    const growthAmount = afterCount - beforeTweetCount;
    
    return {
      beforeCount: beforeTweetCount,
      afterCount,
      growthAmount,
      timeframe: 60, // 1 hour default
      attributedToTweet: growthAmount > 0
    };
  }

  /**
   * Get current follower count via browser
   */
  public async getCurrentFollowerCount(): Promise<number> {
    try {
      return await BrowserManager.withContext(async (context) => {
        const page = await context.newPage();
        return await this.getFollowerCount(page);
      });
    } catch (error) {
      console.warn('Failed to get current follower count');
      return 0;
    }
  }

  /**
   * Store tweet metrics in database for learning
   */
  private async storeTweetMetrics(metrics: TweetMetrics): Promise<void> {
    try {
      const { AdvancedDatabaseManager } = await import('../lib/advancedDatabaseManager');
      const dbManager = AdvancedDatabaseManager.getInstance();
      await dbManager.initialize();

      // Store in learning_posts table for pattern analysis
      await dbManager.executeQuery(
        'store_tweet_metrics',
        async (client) => {
          const { error } = await client.from('learning_posts').upsert({
            tweet_id: metrics.tweetId,
            likes_count: metrics.likes,
            retweets_count: metrics.retweets,
            replies_count: metrics.replies,
            impressions: metrics.views,
            engagement_rate: ((metrics.likes + metrics.retweets + metrics.replies) / Math.max(metrics.views, 1)) * 100,
            converted_followers: metrics.newFollowers,
            created_at: metrics.timestamp.toISOString()
          });
          
          if (error) throw error;
          return true;
        },
        `metrics_${metrics.tweetId}`,
        300000
      );

      console.log('📊 Tweet metrics stored for learning analysis');
      
    } catch (error: any) {
      console.error('⚠️ Failed to store tweet metrics:', error.message);
    }
  }



  /**
   * Extract tweet ID from URL
   */
  private extractTweetIdFromUrl(url: string): string {
    const match = url.match(/status\/(\d+)/);
    return match ? match[1] : 'unknown';
  }

  /**
   * Schedule automatic performance tracking for recent tweets
   */
  public async schedulePerformanceTracking(): Promise<void> {
    console.log('🔄 Starting automated tweet performance tracking...');
    
    setInterval(async () => {
      try {
        await this.trackRecentTweets();
      } catch (error) {
        console.error('⚠️ Scheduled performance tracking failed:', error);
      }
    }, 30 * 60 * 1000); // Every 30 minutes
  }

  /**
   * Track performance of recent tweets
   */
  private async trackRecentTweets(): Promise<void> {
    try {
      // Get recent tweets from database
      const { AdvancedDatabaseManager } = await import('../lib/advancedDatabaseManager');
      const dbManager = AdvancedDatabaseManager.getInstance();
      await dbManager.initialize();

      const recentTweets = await dbManager.executeQuery(
        'get_recent_tweets_for_tracking',
        async (client) => {
          const { data, error } = await client
            .from('tweets')
            .select('tweet_id, posted_at')
            .eq('platform', 'twitter')
            .gte('posted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
            .order('posted_at', { ascending: false })
            .limit(10);
          
          if (error) throw error;
          return data || [];
        },
        'recent_tweets_tracking',
        300000
      );

      // Track each recent tweet
      for (const tweet of recentTweets) {
        if (tweet.tweet_id && tweet.tweet_id.startsWith('browser_')) {
          // For browser posts, we'd need to construct the URL from our profile
          // For now, skip these as we'd need the actual tweet URL
          continue;
        }
        
        const tweetUrl = `https://twitter.com/Signal_Synapse/status/${tweet.tweet_id}`;
        await this.trackTweetPerformance(tweetUrl);
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay between requests
      }

      console.log(`✅ Tracked performance for ${recentTweets.length} recent tweets`);
      
    } catch (error: any) {
      console.error('⚠️ Failed to track recent tweets:', error.message);
    }
  }
}