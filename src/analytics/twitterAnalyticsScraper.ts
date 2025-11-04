import { log } from '../lib/logger';
import { Page } from 'playwright';
import { UnifiedBrowserPool } from '../browser/UnifiedBrowserPool';
import { admin as supabase } from '../lib/supabaseClients';

interface TweetAnalytics {
  tweetId: string;
  tweetUrl: string;
  content: string;
  timestamp: Date;
  views?: number;
  likes: number;
  reposts: number;
  quotes: number;
  replies: number;
  bookmarks?: number;
  profileClicks?: number;
  linkClicks?: number;
  detailExpands?: number;
  engagementRate: number;
  impressions?: number;
  followersGained?: number;
}

interface ProfileAnalytics {
  followers: number;
  following: number;
  totalTweets: number;
  profileViews?: number;
  mentionsReceived?: number;
  scrapedAt: Date;
}

export class TwitterAnalyticsScraper {
  private pool: UnifiedBrowserPool;
  private isRunning: boolean = false;

  constructor() {
    this.pool = UnifiedBrowserPool.getInstance();
  }

  /**
   * MAIN METHOD: Scrape all analytics data for our account
   */
  async scrapeAllAnalytics(): Promise<{
    tweets: TweetAnalytics[];
    profile: ProfileAnalytics;
    totalEngagement: number;
  }> {
    if (this.isRunning) {
      log({ op: 'analytics_scraper', status: 'already_running' });
      return { tweets: [], profile: { followers: 0, following: 0, totalTweets: 0, scrapedAt: new Date() }, totalEngagement: 0 };
    }

    this.isRunning = true;
    log({ op: 'analytics_scraper_start' });

    try {
      return await this.pool.withContext('scrape_analytics', async (context) => {
        const page = await context.newPage();
        
        // 1. Navigate to our profile
        await this.navigateToProfile(page);

        // 2. Scrape profile metrics
        const profileData = await this.scrapeProfileMetrics(page);

        // 3. Scrape recent tweets analytics
        const tweetsData = await this.scrapeRecentTweets(page);

        // 4. Try to get detailed analytics if available
        const detailedTweets = await this.enrichWithDetailedAnalytics(page, tweetsData);

        // 5. Store in database
        await this.storeAnalyticsData(detailedTweets, profileData);

        const totalEngagement = detailedTweets.reduce((sum, tweet) => 
          sum + tweet.likes + tweet.reposts + tweet.replies + tweet.quotes, 0
        );

        console.log(`📊 ANALYTICS_COMPLETE: ${detailedTweets.length} tweets analyzed, ${totalEngagement} total engagement`);

        return {
          tweets: detailedTweets,
          profile: profileData,
          totalEngagement
        };
      });
    } catch (error: any) {
      console.error('❌ ANALYTICS_SCRAPER_ERROR:', error.message);
      return { tweets: [], profile: { followers: 0, following: 0, totalTweets: 0, scrapedAt: new Date() }, totalEngagement: 0 };
    } finally {
      this.isRunning = false;
    }
  }

  private async navigateToProfile(page: Page): Promise<void> {
    console.log('🔍 ANALYTICS: Navigating to profile page...');
    
    // Go to our profile (should be logged in already)
    const username = process.env.TWITTER_USERNAME || 'SignalAndSynapse';
    await page.goto(`https://twitter.com/${username}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // Check if we're logged in and on the right page
    const isProfilePage = await page.locator('[data-testid="UserName"]').isVisible();
    if (!isProfilePage) {
      throw new Error('Not on profile page or not logged in');
    }
  }

  private async scrapeProfileMetrics(page: Page): Promise<ProfileAnalytics> {
    console.log('📈 ANALYTICS: Scraping profile metrics...');

    try {
      // Extract follower count
      const followersText = await page.locator('a[href*="/followers"] span').first().textContent() || '0';
      const followers = this.parseNumberFromText(followersText);

      // Extract following count  
      const followingText = await page.locator('a[href*="/following"] span').first().textContent() || '0';
      const following = this.parseNumberFromText(followingText);

      // Try to get tweet count from bio area
      const tweetCountElements = await page.locator('[data-testid="UserProfileHeader_Items"] span').allTextContents();
      let totalTweets = 0;
      
      for (const text of tweetCountElements) {
        if (text.includes('posts') || text.includes('Tweets')) {
          totalTweets = this.parseNumberFromText(text);
          break;
        }
      }

      console.log(`📊 PROFILE_METRICS: ${followers} followers, ${following} following, ${totalTweets} tweets`);

      return {
        followers,
        following,
        totalTweets,
        scrapedAt: new Date()
      };
    } catch (error: any) {
      console.error('❌ PROFILE_SCRAPING_ERROR:', error.message);
      return {
        followers: 0,
        following: 0,
        totalTweets: 0,
        scrapedAt: new Date()
      };
    }
  }

  private async scrapeRecentTweets(page: Page, maxTweets: number = 20): Promise<TweetAnalytics[]> {
    console.log(`🐦 ANALYTICS: Scraping last ${maxTweets} tweets...`);

    const tweets: TweetAnalytics[] = [];

    try {
      // Wait for tweets to load
      await page.waitForSelector('[data-testid="tweet"]', { timeout: 10000 });

      // Get all tweet containers
      const tweetElements = await page.locator('[data-testid="tweet"]').all();
      
      for (let i = 0; i < Math.min(tweetElements.length, maxTweets); i++) {
        const tweet = tweetElements[i];
        
        try {
          // Extract tweet ID from URL if possible
          const tweetLink = await tweet.locator('a[href*="/status/"]').first().getAttribute('href');
          const tweetId = tweetLink ? tweetLink.split('/status/')[1]?.split('?')[0] || `temp_${Date.now()}_${i}` : `temp_${Date.now()}_${i}`;

          // Extract content
          const contentElement = tweet.locator('[data-testid="tweetText"]');
          const content = await contentElement.textContent() || '';

          // Extract engagement metrics
          const likesText = await this.getEngagementCount(tweet, 'like');
          const retweetsText = await this.getEngagementCount(tweet, 'retweet');
          const repliesText = await this.getEngagementCount(tweet, 'reply');

          const likes = this.parseNumberFromText(likesText);
          const reposts = this.parseNumberFromText(retweetsText);
          const replies = this.parseNumberFromText(repliesText);

          // Calculate basic engagement rate
          const totalEngagement = likes + reposts + replies;
          const engagementRate = totalEngagement > 0 ? (totalEngagement / Math.max(1, likes * 10)) * 100 : 0;

          const tweetData: TweetAnalytics = {
            tweetId,
            tweetUrl: tweetLink ? `https://twitter.com${tweetLink}` : '',
            content: content.substring(0, 500), // Limit content length
            timestamp: new Date(), // We'll try to get real timestamp later
            likes,
            reposts,
            quotes: 0, // Will try to extract separately
            replies,
            engagementRate
          };

          tweets.push(tweetData);
          console.log(`📝 TWEET_SCRAPED: ${likes}❤️ ${reposts}🔄 ${replies}💬 | "${content.substring(0, 50)}..."`);

        } catch (error: any) {
          console.warn(`⚠️ TWEET_SCRAPE_ERROR: Skipping tweet ${i}:`, error.message);
          continue;
        }
      }

      console.log(`✅ TWEETS_SCRAPED: ${tweets.length} tweets extracted`);
      return tweets;

    } catch (error: any) {
      console.error('❌ TWEETS_SCRAPING_ERROR:', error.message);
      return [];
    }
  }

  private async getEngagementCount(tweetElement: any, type: 'like' | 'retweet' | 'reply'): Promise<string> {
    try {
      let selector = '';
      
      switch (type) {
        case 'like':
          selector = '[data-testid="like"] span span';
          break;
        case 'retweet':
          selector = '[data-testid="retweet"] span span';
          break;
        case 'reply':
          selector = '[data-testid="reply"] span span';
          break;
      }

      const element = tweetElement.locator(selector).first();
      return await element.textContent() || '0';
    } catch {
      return '0';
    }
  }

  private async enrichWithDetailedAnalytics(page: Page, tweets: TweetAnalytics[]): Promise<TweetAnalytics[]> {
    console.log('🔍 ANALYTICS: Attempting to get detailed analytics...');

    // Try to access Twitter Analytics if available
    try {
      await page.goto('https://analytics.twitter.com/', { waitUntil: 'networkidle' });
      await page.waitForTimeout(3000);

      const hasAnalytics = await page.locator('text=Analytics').isVisible();
      
      if (hasAnalytics) {
        console.log('📊 DETAILED_ANALYTICS: Analytics page accessible, enriching data...');
        // TODO: Implement detailed analytics scraping if user has access
        // For now, we'll return the basic data
      } else {
        console.log('📊 DETAILED_ANALYTICS: Analytics not accessible, using basic metrics');
      }

    } catch (error: any) {
      console.log('📊 DETAILED_ANALYTICS: Analytics page not available, using basic metrics');
    }

    return tweets;
  }

  private parseNumberFromText(text: string): number {
    if (!text) return 0;
    
    // Handle K, M, B suffixes
    const cleanText = text.replace(/[^\d.KMB]/gi, '');
    const number = parseFloat(cleanText);
    
    if (cleanText.includes('K')) return Math.floor(number * 1000);
    if (cleanText.includes('M')) return Math.floor(number * 1000000);
    if (cleanText.includes('B')) return Math.floor(number * 1000000000);
    
    return Math.floor(number) || 0;
  }

  private async storeAnalyticsData(tweets: TweetAnalytics[], profile: ProfileAnalytics): Promise<void> {
    console.log('💾 ANALYTICS: Storing data in database...');

    try {
      // Store profile analytics
      const { error: profileError } = await supabase
        .from('profile_analytics')
        .upsert([{
          followers: profile.followers,
          following: profile.following,
          total_tweets: profile.totalTweets,
          profile_views: profile.profileViews || 0,
          scraped_at: profile.scrapedAt.toISOString()
        }]);

      if (profileError) {
        console.error('❌ PROFILE_STORAGE_ERROR:', profileError.message);
      }

      // Store tweet analytics
      for (const tweet of tweets) {
        const { error: tweetError } = await supabase
          .from('tweet_analytics')
          .upsert([{
            tweet_id: tweet.tweetId,
            tweet_url: tweet.tweetUrl,
            content: tweet.content,
            views: tweet.views || 0,
            likes: tweet.likes,
            reposts: tweet.reposts,
            quotes: tweet.quotes,
            replies: tweet.replies,
            bookmarks: tweet.bookmarks || 0,
            profile_clicks: tweet.profileClicks || 0,
            link_clicks: tweet.linkClicks || 0,
            detail_expands: tweet.detailExpands || 0,
            engagement_rate: tweet.engagementRate,
            impressions: tweet.impressions || 0,
            followers_gained: tweet.followersGained || 0,
            scraped_at: new Date().toISOString()
          }], {
            onConflict: 'tweet_id'
          });

        if (tweetError) {
          console.warn(`⚠️ TWEET_STORAGE_ERROR for ${tweet.tweetId}:`, tweetError.message);
        }
      }

      console.log(`✅ ANALYTICS_STORED: ${tweets.length} tweets + profile data saved`);

    } catch (error: any) {
      console.error('❌ STORAGE_ERROR:', error.message);
    }
  }

  /**
   * Start automated analytics collection every 30 minutes
   */
  startAutomatedCollection(): void {
    console.log('🤖 AUTOMATED_ANALYTICS: Starting 30-minute collection cycle...');

    // Run immediately
    this.scrapeAllAnalytics();

    // Then run every 30 minutes
    setInterval(async () => {
      console.log('⏰ SCHEDULED_ANALYTICS: Running 30-minute data collection...');
      await this.scrapeAllAnalytics();
    }, 30 * 60 * 1000); // 30 minutes
  }

  /**
   * Get analytics insights for AI learning
   */
  async getAnalyticsInsights(): Promise<{
    topPerformingContent: TweetAnalytics[];
    averageEngagement: number;
    followerGrowthRate: number;
    bestPostingTimes: string[];
    contentPatterns: { [key: string]: number };
  }> {
    console.log('🧠 ANALYTICS_INSIGHTS: Analyzing performance data for AI learning...');

    try {
      // Get recent tweet analytics
      const { data: tweets } = await supabase
        .from('tweet_analytics')
        .select('*')
        .order('scraped_at', { ascending: false })
        .limit(50);

      if (!tweets || tweets.length === 0) {
        return {
          topPerformingContent: [],
          averageEngagement: 0,
          followerGrowthRate: 0,
          bestPostingTimes: [],
          contentPatterns: {}
        };
      }

      // Calculate insights
      const topPerforming = tweets
        .sort((a, b) => b.engagement_rate - a.engagement_rate)
        .slice(0, 10);

      const averageEngagement = tweets.reduce((sum, tweet) => sum + tweet.engagement_rate, 0) / tweets.length;

      // Analyze content patterns
      const contentPatterns: { [key: string]: number } = {};
      tweets.forEach(tweet => {
        const words = tweet.content.toLowerCase().split(' ');
        words.forEach(word => {
          if (word.length > 3) {
            contentPatterns[word] = (contentPatterns[word] || 0) + 1;
          }
        });
      });

      console.log(`🎯 INSIGHTS_GENERATED: Top engagement: ${Math.max(...tweets.map(t => t.engagement_rate)).toFixed(2)}%`);

      return {
        topPerformingContent: topPerforming,
        averageEngagement,
        followerGrowthRate: 0, // TODO: Calculate from profile analytics history
        bestPostingTimes: [], // TODO: Analyze posting time patterns
        contentPatterns
      };

    } catch (error: any) {
      console.error('❌ INSIGHTS_ERROR:', error.message);
      return {
        topPerformingContent: [],
        averageEngagement: 0,
        followerGrowthRate: 0,
        bestPostingTimes: [],
        contentPatterns: {}
      };
    }
  }
}
