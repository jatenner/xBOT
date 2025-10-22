import { Page } from 'playwright';
import { UnifiedBrowserPool } from '../browser/UnifiedBrowserPool';

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
  timestamp: Date;
}

export class TweetPerformanceTracker {
  private static instance: TweetPerformanceTracker | null = null;
  private consecutiveFailures = 0;
  private pausedUntil: Date | null = null;

  public static getInstance(): TweetPerformanceTracker {
    if (!this.instance) {
      this.instance = new TweetPerformanceTracker();
    }
    return this.instance;
  }

  /**
   * Track tweet performance using BrowserManager
   */
  public async trackTweetPerformance(tweetUrl: string): Promise<TweetMetrics> {
    // Check if paused due to consecutive failures
    if (this.pausedUntil && new Date() < this.pausedUntil) {
      const remainingMs = this.pausedUntil.getTime() - Date.now();
      throw new Error(`Tweet tracking paused for ${Math.ceil(remainingMs / 60000)} more minutes due to consecutive failures`);
    }
    
    console.log('📊 Tracking tweet performance via browser automation...');
    
    const pool = UnifiedBrowserPool.getInstance();
    
    try {
      const result = await pool.withContext('track_performance', async (context) => {
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
      });
      
      // Reset failure count on success
      this.consecutiveFailures = 0;
      this.pausedUntil = null;
      
      return result;
      
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
   * Extract engagement metrics from tweet page
   */
  private async extractTweetMetrics(page: Page, tweetUrl: string): Promise<TweetMetrics> {
    const tweetId = this.extractTweetIdFromUrl(tweetUrl);
    
    // Get engagement numbers using multiple selectors for reliability
    const likes = await this.getEngagementCount(page, [
      '[data-testid="like"] span',
      '[aria-label*="like"] span',
      'div[role="group"] span'
    ]);
    
    const retweets = await this.getEngagementCount(page, [
      '[data-testid="retweet"] span',
      '[aria-label*="repost"] span',
      '[aria-label*="retweet"] span'
    ]);
    
    const replies = await this.getEngagementCount(page, [
      '[data-testid="reply"] span',
      '[aria-label*="repl"] span'
    ]);
    
    const bookmarks = await this.getEngagementCount(page, [
      '[data-testid="bookmark"] span',
      '[aria-label*="bookmark"] span'
    ]);
    
    const views = await this.getTweetViews(page);
    
    return {
      tweetId,
      likes,
      retweets,
      replies,
      bookmarks,
      views,
      profileClicks: 0, // Not easily extractable
      newFollowers: 0, // Would need to track separately
      timestamp: new Date()
    };
  }

  private async getEngagementCount(page: Page, selectors: string[]): Promise<number> {
    for (let i = 0; i < selectors.length; i++) {
      const selector = selectors[i];
      try {
        const element = await page.locator(selector).first();
        if (await element.isVisible({ timeout: 5000 })) {
          const text = await element.textContent();
          if (text) {
            return this.parseEngagementNumber(text);
          }
        }
      } catch (error) {
        // Try next selector
        continue;
      }
    }
    return 0;
  }

  /**
   * Parse engagement numbers from text (handles K, M suffixes)
   */
  private parseEngagementNumber(text: string): number {
    const cleanText = text.replace(/,/g, '').trim();
    const match = cleanText.match(/(\d+(?:\.\d+)?)\s*([KMB])?/i);
    
    if (!match) return 0;
    
    const num = parseFloat(match[1]);
    const suffix = match[2]?.toUpperCase();
    
    switch (suffix) {
      case 'K': return Math.round(num * 1000);
      case 'M': return Math.round(num * 1000000);
      case 'B': return Math.round(num * 1000000000);
      default: return Math.round(num);
    }
  }

  /**
   * Get tweet view count
   */
  private async getTweetViews(page: Page): Promise<number> {
    try {
      // Look for analytics/views element
      const viewsElement = await page.locator('[aria-label*="views"], [data-testid*="analytics"]').first();
      if (await viewsElement.isVisible()) {
        const text = await viewsElement.textContent();
        if (text) {
          return this.parseEngagementNumber(text);
        }
      }
    } catch (error) {
      // Views not visible or accessible
    }
    return 0;
  }

  /**
   * Get current follower count from profile
   */
  private async getFollowerCount(page: Page): Promise<number> {
    try {
      // Navigate to profile
      const username = process.env.TWITTER_USERNAME || 'SignalAndSynapse';
      await page.goto(`https://twitter.com/${username}`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      await page.waitForTimeout(2000);
      
      // Look for follower count
      const followerElement = await page.locator('[href$="/followers"] span, [data-testid="UserName"] + div span').first();
      if (await followerElement.isVisible({ timeout: 10000 })) {
        const text = await followerElement.textContent();
        if (text && text.includes('Follower')) {
          return this.parseEngagementNumber(text);
        }
      }
    } catch (error) {
      // Follower count not accessible
    }
    return 0;
  }

  /**
   * Track follower growth before/after posting
   */
  public async trackFollowerGrowth(beforeTweetCount: number): Promise<FollowerGrowthData> {
    const afterCount = await this.getCurrentFollowerCount();
    const growthAmount = afterCount - beforeTweetCount;
    
    return {
      beforeCount: beforeTweetCount,
      afterCount,
      growthAmount,
      timestamp: new Date()
    };
  }

  /**
   * Get current follower count using BrowserManager
   */
  public async getCurrentFollowerCount(): Promise<number> {
    const pool = UnifiedBrowserPool.getInstance();
    
    try {
      return await pool.withContext('get_follower_count', async (context) => {
        const page = await context.newPage();
        return await this.getFollowerCount(page);
      });
    } catch (error) {
      console.error('Failed to get follower count:', error);
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

      // Store metrics for learning analysis
      await dbManager.executeQuery(
        'store_tweet_metrics',
        async (client) => {
          const { error } = await client.from('tweet_metrics').upsert({
            tweet_id: metrics.tweetId,
            collected_at: new Date(),
            likes_count: metrics.likes,
            retweets_count: metrics.retweets,
            replies_count: metrics.replies,
            bookmarks_count: metrics.bookmarks,
            impressions_count: metrics.views,
            content: null // Could be added if we track original content
          }, {
            onConflict: 'tweet_id,collected_at'
          });
          
          if (error) throw error;
          return { success: true };
        },
        'tweet_metrics_storage',
        60000
      );

      console.log('📊 Tweet metrics stored for learning analysis');
      
    } catch (error: any) {
      console.error('⚠️ Failed to store tweet metrics:', error.message);
      // Don't throw - metrics storage failure shouldn't break the tracking
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
   * Schedule automated performance tracking
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
      for (let i = 0; i < recentTweets.length; i++) {
        const tweet = recentTweets[i];
        if (tweet.tweet_id && tweet.tweet_id.startsWith('browser_')) {
          // For browser posts, we'd need to construct the URL from our profile
          // For now, skip these as we'd need the actual tweet URL
          continue;
        }
        
        const username = process.env.TWITTER_USERNAME || 'SignalAndSynapse';
        const tweetUrl = `https://twitter.com/${username}/status/${tweet.tweet_id}`;
        await this.trackTweetPerformance(tweetUrl);
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay between requests
      }

      console.log(`✅ Tracked performance for ${recentTweets.length} recent tweets`);
      
    } catch (error: any) {
      console.error('⚠️ Failed to track recent tweets:', error.message);
    }
  }
}