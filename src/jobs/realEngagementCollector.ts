/**
 * 📊 REAL ENGAGEMENT COLLECTOR
 * Collects actual Twitter engagement metrics from posted tweets
 * Updates database with real likes, retweets, replies, and followers
 */

import { supabaseClient } from '../utils/supabaseClient';
import { BrowserTweetPoster } from '../utils/browserTweetPoster';
import { chromium, Browser, Page } from 'playwright';

export interface RealEngagementMetrics {
  tweet_id: string;
  likes: number;
  retweets: number;
  replies: number;
  impressions?: number;
  collected_at: string;
}

export class RealEngagementCollector {
  private static instance: RealEngagementCollector;
  private browser: Browser | null = null;
  private page: Page | null = null;

  static getInstance(): RealEngagementCollector {
    if (!this.instance) {
      this.instance = new RealEngagementCollector();
    }
    return this.instance;
  }

  /**
   * 🚀 COLLECT ENGAGEMENT FOR RECENT TWEETS
   */
  async collectRecentEngagement(): Promise<{
    success: boolean;
    tweets_processed: number;
    metrics_updated: number;
    error?: string;
  }> {
    try {
      console.log('📊 === COLLECTING REAL ENGAGEMENT METRICS ===');
      
      // Get recent tweets that need metrics collection
      const { data: tweets, error } = await supabaseClient.supabase
        .from('tweets')
        .select('tweet_id, created_at')
        .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()) // Last 48 hours
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        throw new Error(`Failed to fetch tweets: ${error.message}`);
      }

      if (!tweets || tweets.length === 0) {
        console.log('ℹ️ No recent tweets found for metrics collection');
        return { success: true, tweets_processed: 0, metrics_updated: 0 };
      }

      console.log(`🔍 Found ${tweets.length} recent tweets to analyze`);

      // Initialize browser for scraping
      await this.initializeBrowser();

      let metricsUpdated = 0;

      for (const tweet of tweets) {
        try {
          console.log(`📈 Collecting metrics for tweet: ${tweet.tweet_id}`);
          
          const metrics = await this.scrapeTwitterMetrics(tweet.tweet_id);
          
          if (metrics) {
            await this.updateTweetMetrics(tweet.tweet_id, metrics);
            metricsUpdated++;
            console.log(`✅ Updated: ${metrics.likes}L, ${metrics.retweets}RT, ${metrics.replies}R`);
          } else {
            console.log(`⚠️ Could not collect metrics for ${tweet.tweet_id}`);
          }

          // Small delay between requests
          await this.sleep(2000);

        } catch (tweetError) {
          console.error(`❌ Error processing tweet ${tweet.tweet_id}:`, tweetError);
        }
      }

      await this.cleanup();

      console.log(`✅ Metrics collection complete: ${metricsUpdated}/${tweets.length} tweets updated`);

      return {
        success: true,
        tweets_processed: tweets.length,
        metrics_updated: metricsUpdated
      };

    } catch (error) {
      console.error('❌ Real engagement collection failed:', error);
      await this.cleanup();
      return {
        success: false,
        tweets_processed: 0,
        metrics_updated: 0,
        error: error.message
      };
    }
  }

  /**
   * 🌐 SCRAPE TWITTER METRICS FOR SPECIFIC TWEET
   */
  private async scrapeTwitterMetrics(tweetId: string): Promise<RealEngagementMetrics | null> {
    try {
      if (!this.page) return null;

      // Navigate to the tweet
      const tweetUrl = `https://twitter.com/SignalAndSynapse/status/${tweetId}`;
      await this.page.goto(tweetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // Wait for tweet to load
      await this.page.waitForSelector('[data-testid="tweet"]', { timeout: 15000 });

      // Extract engagement metrics
      const metrics = await this.page.evaluate(() => {
        const tweet = document.querySelector('[data-testid="tweet"]');
        if (!tweet) return null;

        // Helper function to parse metric text
        const parseMetric = (text: string): number => {
          if (!text) return 0;
          const cleanText = text.trim().toLowerCase();
          if (cleanText === '' || cleanText === '0') return 0;
          
          // Handle K notation (e.g., "1.2K" = 1200)
          if (cleanText.includes('k')) {
            return Math.round(parseFloat(cleanText.replace('k', '')) * 1000);
          }
          
          // Handle M notation (e.g., "1.2M" = 1200000)
          if (cleanText.includes('m')) {
            return Math.round(parseFloat(cleanText.replace('m', '')) * 1000000);
          }
          
          return parseInt(cleanText) || 0;
        };

        // Extract likes
        const likeElement = tweet.querySelector('[data-testid="like"]');
        const likesText = likeElement?.textContent || '0';
        const likes = parseMetric(likesText);

        // Extract retweets
        const retweetElement = tweet.querySelector('[data-testid="retweet"]');
        const retweetsText = retweetElement?.textContent || '0';
        const retweets = parseMetric(retweetsText);

        // Extract replies
        const replyElement = tweet.querySelector('[data-testid="reply"]');
        const repliesText = replyElement?.textContent || '0';
        const replies = parseMetric(repliesText);

        return { likes, retweets, replies };
      });

      if (!metrics) return null;

      return {
        tweet_id: tweetId,
        likes: metrics.likes,
        retweets: metrics.retweets,
        replies: metrics.replies,
        collected_at: new Date().toISOString()
      };

    } catch (error) {
      console.error(`❌ Failed to scrape metrics for ${tweetId}:`, error);
      return null;
    }
  }

  /**
   * 💾 UPDATE TWEET METRICS IN DATABASE
   */
  private async updateTweetMetrics(tweetId: string, metrics: RealEngagementMetrics): Promise<void> {
    try {
      // Update main tweets table
      const { error: tweetsError } = await supabaseClient.supabase
        .from('tweets')
        .update({
          likes: metrics.likes,
          retweets: metrics.retweets,
          replies: metrics.replies,
          updated_at: new Date().toISOString()
        })
        .eq('tweet_id', tweetId);

      if (tweetsError) {
        console.warn(`⚠️ Error updating tweets table for ${tweetId}:`, tweetsError.message);
      }

      // Store in analytics table for historical tracking
      const { error: analyticsError } = await supabaseClient.supabase
        .from('tweet_analytics')
        .upsert({
          tweet_id: tweetId,
          likes: metrics.likes,
          retweets: metrics.retweets,
          replies: metrics.replies,
          impressions: metrics.impressions || metrics.likes * 20, // Estimate impressions
          collected_at: metrics.collected_at,
          created_at: new Date().toISOString()
        }, {
          onConflict: 'tweet_id'
        });

      if (analyticsError) {
        console.warn(`⚠️ Error updating analytics table for ${tweetId}:`, analyticsError.message);
      }

    } catch (error) {
      console.error(`❌ Failed to update metrics for ${tweetId}:`, error);
    }
  }

  /**
   * 🌐 INITIALIZE BROWSER FOR SCRAPING
   */
  private async initializeBrowser(): Promise<void> {
    try {
      console.log('🌐 Initializing browser for engagement collection...');
      
      this.browser = await chromium.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const context = await this.browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      });
      
      this.page = await context.newPage();
      
      console.log('✅ Browser initialized for engagement scraping');
      
    } catch (error) {
      console.error('❌ Failed to initialize browser:', error);
      throw error;
    }
  }

  /**
   * 🧹 CLEANUP BROWSER RESOURCES
   */
  private async cleanup(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
    } catch (error) {
      console.warn('⚠️ Error during browser cleanup:', error);
    }
  }

  /**
   * ⏱️ SLEEP UTILITY
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const realEngagementCollector = RealEngagementCollector.getInstance();