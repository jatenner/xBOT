/**
 * 🎯 INFLUENCER TWEET FETCHER
 * 
 * Scrapes tweets from target influencers and identifies high-value reply opportunities
 */

import { StealthTweetScraper, ScrapedTweet } from '../scraper/scrapeTweets';
import { secureSupabaseClient } from '../utils/secureSupabaseClient';
import { INFLUENCER_TARGETS, REPLY_TIMING_CONFIG, getHighPriorityInfluencers } from '../config/influencers';
import { emergencyBudgetLockdown } from '../utils/emergencyBudgetLockdown';
import { AwarenessLogger } from '../utils/awarenessLogger';

interface InfluencerTweetData {
  id: string;
  author_username: string;
  author_display_name: string;
  content: string;
  url: string;
  like_count: number;
  retweet_count: number;
  reply_count: number;
  view_count: number;
  created_at: string;
  is_reply_target: boolean;
  topic_category: string;
  engagement_velocity: number;
  metadata: any;
}

export class InfluencerTweetFetcher {
  private static instance: InfluencerTweetFetcher;
  private scraper: StealthTweetScraper;
  private isRunning = false;
  private lastFetchTime: Date | null = null;
  private fetchCount = 0;

  private constructor() {
    this.scraper = new StealthTweetScraper();
  }

  static getInstance(): InfluencerTweetFetcher {
    if (!InfluencerTweetFetcher.instance) {
      InfluencerTweetFetcher.instance = new InfluencerTweetFetcher();
    }
    return InfluencerTweetFetcher.instance;
  }

  /**
   * 🔄 Main fetch cycle - called by scheduler
   */
  async fetchInfluencerTweets(): Promise<{
    success: boolean;
    tweetsFound: number;
    replyTargets: number;
    error?: string;
  }> {
    if (this.isRunning) {
      console.log('🎯 Influencer fetch already running, skipping...');
      return { success: false, tweetsFound: 0, replyTargets: 0, error: 'Already running' };
    }

    this.isRunning = true;
    const startTime = Date.now();
    let totalTweets = 0;
    let totalTargets = 0;

    try {
      console.log('🎯 === INFLUENCER TWEET FETCH CYCLE ===');

      // Check budget constraints
      const lockdownStatus = await emergencyBudgetLockdown.isLockedDown();
      if (lockdownStatus.lockdownActive) {
        console.log('⚠️ Budget lockdown active, skipping influencer fetch');
        return { success: false, tweetsFound: 0, replyTargets: 0, error: 'Budget lockdown' };
      }

      // Initialize scraper session
      await this.scraper.initialize();

      // Fetch from high-priority influencers first
      const highPriorityInfluencers = getHighPriorityInfluencers();
      
      for (const influencer of highPriorityInfluencers) {
        try {
          console.log(`🔍 Fetching tweets from @${influencer.username}...`);
          
          const result = await this.scraper.searchTweets(`from:${influencer.username}`, 10);

          if (result.success && result.tweets.length > 0) {
            const processedTweets = await this.processTweets(result.tweets, influencer);
            totalTweets += processedTweets.total;
            totalTargets += processedTweets.targets;
            
            console.log(`✅ ${influencer.username}: ${processedTweets.total} tweets, ${processedTweets.targets} targets`);
          } else {
            console.warn(`⚠️ No tweets found for @${influencer.username}`);
          }

          // Rate limiting
          await this.wait(3000);

        } catch (error) {
          console.error(`❌ Error fetching @${influencer.username}:`, error.message);
          continue;
        }
      }

      // Update fetch statistics
      this.lastFetchTime = new Date();
      this.fetchCount++;

      const duration = Date.now() - startTime;
      console.log(`🎯 Fetch cycle complete: ${totalTweets} tweets, ${totalTargets} targets (${duration}ms)`);

      // Log to awareness system
      AwarenessLogger.logSystemState({
        currentTime: new Date(),
        timingState: { lastPostTime: 0, postCount24h: 0, maxDailyPosts: 96, minutesSinceLastPost: 15 },
        engagementContext: { multiplier: 1.0, description: 'influencer monitoring', windowType: 'background' },
        decision: { action: 'influencer_fetch_complete', priority: 5, reasoning: 'continuous monitoring', expectedEngagement: 0 }
      });
      console.log('📊 Influencer fetch complete:', {
        tweetsFound: totalTweets,
        replyTargets: totalTargets,
        duration,
        influencersScanned: highPriorityInfluencers.length
      });

      return {
        success: true,
        tweetsFound: totalTweets,
        replyTargets: totalTargets
      };

    } catch (error) {
      console.error('❌ Influencer fetch cycle failed:', error);
      return {
        success: false,
        tweetsFound: totalTweets,
        replyTargets: totalTargets,
        error: error.message
      };
    } finally {
      this.isRunning = false;
      await this.scraper.close();
    }
  }

  /**
   * 📊 Process and filter scraped tweets
   */
  private async processTweets(tweets: ScrapedTweet[], influencer: any): Promise<{
    total: number;
    targets: number;
  }> {
    let totalProcessed = 0;
    let replyTargets = 0;

    for (const tweet of tweets) {
      try {
        // Apply quality filters
        if (!this.passesQualityFilter(tweet)) {
          continue;
        }

        // Calculate engagement velocity (likes per hour)
        const ageHours = this.calculateTweetAge(tweet.timestamp);
        const engagementVelocity = ageHours > 0 ? tweet.engagement.likes / ageHours : 0;

        // Determine if this is a good reply target
        const isReplyTarget = this.isGoodReplyTarget(tweet, influencer);

        // Extract topic category
        const topicCategory = this.extractTopicCategory(tweet.content, influencer.topicCategories);

        // Prepare data for storage
        const tweetData: InfluencerTweetData = {
          id: tweet.tweetId,
          author_username: tweet.author.username,
          author_display_name: tweet.author.displayName,
          content: tweet.content,
          url: tweet.url,
          like_count: tweet.engagement.likes,
          retweet_count: tweet.engagement.retweets,
          reply_count: tweet.engagement.replies,
          view_count: 0, // Not available in scraping
          created_at: tweet.timestamp,
          is_reply_target: isReplyTarget,
          topic_category: topicCategory,
          engagement_velocity: engagementVelocity,
          metadata: {
            influencer_priority: influencer.priority,
            influencer_niche: influencer.niche,
            preferred_reply_style: influencer.replyStyle,
            verified: tweet.author.verified,
            is_reply: tweet.isReply,
            parent_tweet_id: tweet.parentTweetId
          }
        };

        // Store in database
        await this.storeTweet(tweetData);

        totalProcessed++;
        if (isReplyTarget) replyTargets++;

      } catch (error) {
        console.error(`❌ Error processing tweet ${tweet.tweetId}:`, error.message);
        continue;
      }
    }

    return { total: totalProcessed, targets: replyTargets };
  }

  /**
   * 🔍 Quality filter for tweets
   */
  private passesQualityFilter(tweet: ScrapedTweet): boolean {
    // Skip retweets and very short content
    if (tweet.content.startsWith('RT @') || tweet.content.length < REPLY_TIMING_CONFIG.minContentLength) {
      return false;
    }

    // Skip content with avoid keywords
    const hasAvoidKeywords = REPLY_TIMING_CONFIG.avoidKeywords.some(keyword =>
      tweet.content.toLowerCase().includes(keyword.toLowerCase())
    );
    if (hasAvoidKeywords) return false;

    // Check age (must be recent)
    const ageHours = this.calculateTweetAge(tweet.timestamp);
    if (ageHours > REPLY_TIMING_CONFIG.maxContentAge) return false;

    // Minimum engagement threshold
    if (tweet.engagement.likes < REPLY_TIMING_CONFIG.minLikeCount) return false;

    return true;
  }

  /**
   * 🎯 Determine if tweet is good for replies
   */
  private isGoodReplyTarget(tweet: ScrapedTweet, influencer: any): boolean {
    // Must pass quality filter first
    if (!this.passesQualityFilter(tweet)) return false;

    // Check reply saturation
    if (tweet.engagement.replies > REPLY_TIMING_CONFIG.maxReplyCount) return false;

    // Prefer content with research/science keywords
    const hasPreferKeywords = REPLY_TIMING_CONFIG.preferKeywords.some(keyword =>
      tweet.content.toLowerCase().includes(keyword.toLowerCase())
    );

    // Higher engagement threshold for reply targets
    const meetsEngagement = tweet.engagement.likes >= influencer.avgEngagement * 0.5;

    return hasPreferKeywords && meetsEngagement;
  }

  /**
   * 📂 Extract topic category from content
   */
  private extractTopicCategory(content: string, categories: string[]): string {
    const contentLower = content.toLowerCase();
    
    for (const category of categories) {
      if (contentLower.includes(category.toLowerCase())) {
        return category;
      }
    }

    // Fallback to keyword matching
    if (contentLower.includes('longevity') || contentLower.includes('aging')) return 'longevity';
    if (contentLower.includes('nutrition') || contentLower.includes('diet')) return 'nutrition';
    if (contentLower.includes('exercise') || contentLower.includes('fitness')) return 'exercise';
    if (contentLower.includes('sleep') || contentLower.includes('circadian')) return 'sleep';
    if (contentLower.includes('supplement') || contentLower.includes('vitamin')) return 'supplements';
    if (contentLower.includes('stress') || contentLower.includes('mental')) return 'stress';

    return 'general_health';
  }

  /**
   * 💾 Store tweet in database
   */
  private async storeTweet(tweetData: InfluencerTweetData): Promise<void> {
    try {
      const { error } = await secureSupabaseClient.supabase
        .from('influencer_tweets')
        .upsert(tweetData, { onConflict: 'id' });

      if (error) {
        console.error('❌ Database storage error:', error);
      }
    } catch (error) {
      console.error('❌ Failed to store tweet:', error);
    }
  }

  /**
   * ⏰ Calculate tweet age in hours
   */
  private calculateTweetAge(timestamp: string): number {
    const tweetTime = new Date(timestamp);
    const now = new Date();
    return (now.getTime() - tweetTime.getTime()) / (1000 * 60 * 60);
  }

  /**
   * ⏳ Wait helper for rate limiting
   */
  private async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 📊 Get fetch statistics
   */
  getFetchStats(): {
    lastFetchTime: Date | null;
    fetchCount: number;
    isRunning: boolean;
  } {
    return {
      lastFetchTime: this.lastFetchTime,
      fetchCount: this.fetchCount,
      isRunning: this.isRunning
    };
  }

  /**
   * 🧹 Cleanup old tweets (called daily)
   */
  async cleanupOldTweets(): Promise<void> {
    try {
      const { error } = await secureSupabaseClient.supabase
        .from('influencer_tweets')
        .delete()
        .lt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()); // 7 days old

      if (error) {
        console.error('❌ Failed to cleanup old tweets:', error);
      } else {
        console.log('🧹 Cleaned up old influencer tweets');
      }
    } catch (error) {
      console.error('❌ Cleanup error:', error);
    }
  }
}

export const influencerTweetFetcher = InfluencerTweetFetcher.getInstance();