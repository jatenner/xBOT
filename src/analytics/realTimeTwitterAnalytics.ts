/**
 * 📊 REAL-TIME TWITTER ANALYTICS COLLECTOR
 * Scrapes and analyzes Twitter performance data for AI decision making
 */

import { Page } from 'playwright';
import { admin as supabase } from '../lib/supabaseClients';
import { intelligentDecision } from '../ai/intelligentDecisionEngine';
import { systemMonitor } from '../monitoring/systemPerformanceMonitor';

export interface TwitterPostAnalytics {
  tweet_id: string;
  content: string;
  content_type: string;
  voice_style: string;
  posted_at: Date;
  likes: number;
  retweets: number;
  replies: number;
  views: number;
  engagement_rate: number;
  follower_conversion_rate: number;
  time_to_peak_engagement: number; // minutes
  viral_coefficient: number;
}

export interface TrendingTopicData {
  topic: string;
  volume: number;
  health_relevance_score: number;
  competition_level: number;
  opportunity_window: number; // minutes until trend peaks
  suggested_content_angle: string;
}

export interface AudienceActivityData {
  hour: number;
  day_of_week: number;
  active_followers_estimate: number;
  engagement_multiplier: number;
  optimal_content_types: string[];
  competition_accounts_active: number;
}

export class RealTimeTwitterAnalytics {
  private static instance: RealTimeTwitterAnalytics;
  private isCollecting = false;
  private collectionInterval?: NodeJS.Timeout;
  
  private constructor() {}

  public static getInstance(): RealTimeTwitterAnalytics {
    if (!RealTimeTwitterAnalytics.instance) {
      RealTimeTwitterAnalytics.instance = new RealTimeTwitterAnalytics();
    }
    return RealTimeTwitterAnalytics.instance;
  }

  /**
   * 🚀 START CONTINUOUS ANALYTICS COLLECTION
   */
  public startAnalyticsCollection(page: Page): void {
    if (this.isCollecting) {
      console.log('📊 ANALYTICS: Collection already running');
      return;
    }

    this.isCollecting = true;
    console.log('📊 ANALYTICS: Starting real-time data collection...');

    // Collect analytics every 5 minutes
    this.collectionInterval = setInterval(async () => {
      await this.collectAllAnalytics(page);
    }, 5 * 60 * 1000);

    // Initial collection
    this.collectAllAnalytics(page);
  }

  public stopAnalyticsCollection(): void {
    this.isCollecting = false;
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = undefined;
    }
    console.log('📊 ANALYTICS: Stopped data collection');
  }

  /**
   * 📈 COLLECT ALL ANALYTICS DATA
   */
  private async collectAllAnalytics(page: Page): Promise<void> {
    try {
      console.log('📊 ANALYTICS: Collecting real-time data...');

      // Collect different types of analytics in parallel
      const [postAnalytics, trendingTopics, audienceActivity] = await Promise.all([
        this.collectPostAnalytics(page),
        this.collectTrendingTopics(page),
        this.collectAudienceActivity(page)
      ]);

      // Store analytics data
      await this.storeAnalyticsData(postAnalytics, trendingTopics, audienceActivity);

      // Feed data to AI decision engine
      await this.feedDataToAI(postAnalytics, trendingTopics, audienceActivity);

      console.log(`✅ ANALYTICS: Collected ${postAnalytics.length} post analytics, ${trendingTopics.length} trending topics`);

    } catch (error) {
      console.error('❌ ANALYTICS: Collection failed:', error);
    }
  }

  /**
   * 📝 COLLECT POST PERFORMANCE ANALYTICS
   */
  private async collectPostAnalytics(page: Page): Promise<TwitterPostAnalytics[]> {
    try {
      // Navigate to our profile to check recent posts
      await page.goto('https://twitter.com/home');
      await page.waitForTimeout(2000);

      const analytics: TwitterPostAnalytics[] = [];

      // Find our recent tweets and collect engagement data
      const tweets = await page.$$('[data-testid="tweet"]');

      for (let i = 0; i < Math.min(tweets.length, 10); i++) {
        try {
          const tweet = tweets[i];
          
          // Extract engagement metrics
          const metrics = await this.extractTweetMetrics(tweet);
          
          if (metrics) {
            analytics.push(metrics);
          }

        } catch (error) {
          console.warn(`⚠️ TWEET_ANALYTICS: Failed to process tweet ${i}:`, error);
        }
      }

      return analytics;

    } catch (error) {
      console.error('❌ POST_ANALYTICS: Collection failed:', error);
      return [];
    }
  }

  /**
   * 🔥 COLLECT TRENDING TOPICS RELEVANT TO HEALTH
   */
  private async collectTrendingTopics(page: Page): Promise<TrendingTopicData[]> {
    try {
      // Navigate to trending section
      await page.goto('https://twitter.com/explore');
      await page.waitForTimeout(2000);

      const trendingData: TrendingTopicData[] = [];

      // Find trending topics
      const trendingItems = await page.$$('[data-testid="trend"]');

      for (let i = 0; i < Math.min(trendingItems.length, 20); i++) {
        try {
          const item = trendingItems[i];
          const trendText = await item.textContent();
          
          if (trendText && this.isHealthRelevant(trendText)) {
            const trendData = await this.analyzeTrendingTopic(trendText, page);
            if (trendData) {
              trendingData.push(trendData);
            }
          }

        } catch (error) {
          console.warn(`⚠️ TRENDING_ANALYSIS: Failed to process trend ${i}:`, error);
        }
      }

      return trendingData;

    } catch (error) {
      console.error('❌ TRENDING_ANALYTICS: Collection failed:', error);
      return [];
    }
  }

  /**
   * 👥 COLLECT AUDIENCE ACTIVITY DATA
   */
  private async collectAudienceActivity(page: Page): Promise<AudienceActivityData> {
    try {
      const hour = new Date().getHours();
      const dayOfWeek = new Date().getDay();

      // Estimate audience activity based on homepage engagement
      await page.goto('https://twitter.com/home');
      await page.waitForTimeout(2000);

      // Count recent tweets to estimate activity level
      const recentTweets = await page.$$('[data-testid="tweet"]');
      const activityLevel = Math.min(recentTweets.length * 10, 1000);

      // Analyze engagement patterns on health-related content
      const healthEngagement = await this.analyzeHealthContentEngagement(page);

      return {
        hour,
        day_of_week: dayOfWeek,
        active_followers_estimate: activityLevel,
        engagement_multiplier: healthEngagement.multiplier,
        optimal_content_types: healthEngagement.optimal_types,
        competition_accounts_active: healthEngagement.competition_level
      };

    } catch (error) {
      console.error('❌ AUDIENCE_ANALYTICS: Collection failed:', error);
      
      // Return default data
      return {
        hour: new Date().getHours(),
        day_of_week: new Date().getDay(),
        active_followers_estimate: 500,
        engagement_multiplier: 1.0,
        optimal_content_types: ['myth_busting'],
        competition_accounts_active: 50
      };
    }
  }

  /**
   * 📊 EXTRACT TWEET METRICS FROM DOM
   */
  private async extractTweetMetrics(tweetElement: any): Promise<TwitterPostAnalytics | null> {
    try {
      // Extract tweet text
      const textElement = await tweetElement.$('[data-testid="tweetText"]');
      const content = textElement ? await textElement.textContent() : '';

      // Extract engagement metrics
      const likeElement = await tweetElement.$('[data-testid="like"]');
      const retweetElement = await tweetElement.$('[data-testid="retweet"]');
      const replyElement = await tweetElement.$('[data-testid="reply"]');

      const likes = await this.extractMetricNumber(likeElement);
      const retweets = await this.extractMetricNumber(retweetElement);
      const replies = await this.extractMetricNumber(replyElement);

      // Calculate engagement rate (simplified)
      const totalEngagement = likes + retweets + replies;
      const estimatedViews = Math.max(totalEngagement * 20, 100); // Rough estimate
      const engagementRate = (totalEngagement / estimatedViews) * 100;

      // Determine content type and voice style (simplified analysis)
      const contentAnalysis = this.analyzeContentType(content);

      return {
        tweet_id: `tweet_${Date.now()}_${Math.random()}`,
        content: content.substring(0, 280),
        content_type: contentAnalysis.type,
        voice_style: contentAnalysis.style,
        posted_at: new Date(Date.now() - Math.random() * 60 * 60 * 1000), // Estimate posting time
        likes,
        retweets,
        replies,
        views: estimatedViews,
        engagement_rate: engagementRate,
        follower_conversion_rate: this.estimateFollowerConversion(totalEngagement),
        time_to_peak_engagement: Math.round(Math.random() * 120), // 0-120 minutes
        viral_coefficient: this.calculateViralCoefficient(likes, retweets, replies)
      };

    } catch (error) {
      console.warn('⚠️ METRIC_EXTRACTION: Failed to extract metrics:', error);
      return null;
    }
  }

  /**
   * 🔢 EXTRACT NUMERIC METRICS FROM ELEMENTS
   */
  private async extractMetricNumber(element: any): Promise<number> {
    try {
      if (!element) return 0;
      
      const text = await element.textContent();
      if (!text) return 0;

      // Parse numbers like "1.2K" or "500"
      const match = text.match(/(\d+(?:\.\d+)?)\s*([KM]?)/);
      if (!match) return 0;

      const number = parseFloat(match[1]);
      const suffix = match[2];

      if (suffix === 'K') return Math.round(number * 1000);
      if (suffix === 'M') return Math.round(number * 1000000);
      return Math.round(number);

    } catch {
      return 0;
    }
  }

  /**
   * 🏥 CHECK IF TOPIC IS HEALTH RELEVANT
   */
  private isHealthRelevant(topic: string): boolean {
    const healthKeywords = [
      'health', 'wellness', 'nutrition', 'fitness', 'mental health',
      'sleep', 'diet', 'exercise', 'medical', 'doctor', 'vitamin',
      'supplement', 'biohacking', 'longevity', 'metabolism'
    ];

    return healthKeywords.some(keyword => 
      topic.toLowerCase().includes(keyword)
    );
  }

  /**
   * 📈 ANALYZE TRENDING TOPIC OPPORTUNITY
   */
  private async analyzeTrendingTopic(topic: string, page: Page): Promise<TrendingTopicData | null> {
    try {
      // Click on the trend to see volume and discussion
      await page.goto(`https://twitter.com/search?q=${encodeURIComponent(topic)}&src=trend_click`);
      await page.waitForTimeout(2000);

      // Count tweets about this topic (rough volume estimate)
      const topicTweets = await page.$$('[data-testid="tweet"]');
      const volume = topicTweets.length * 100; // Rough multiplier

      // Analyze health relevance
      const healthRelevance = this.calculateHealthRelevance(topic);

      // Estimate competition level
      const competitionLevel = Math.min(volume / 10, 100);

      // Calculate opportunity window (when trend will peak)
      const opportunityWindow = 30 + Math.random() * 120; // 30-150 minutes

      return {
        topic: topic.trim(),
        volume,
        health_relevance_score: healthRelevance,
        competition_level: competitionLevel,
        opportunity_window: opportunityWindow,
        suggested_content_angle: this.suggestContentAngle(topic)
      };

    } catch (error) {
      console.warn('⚠️ TREND_ANALYSIS: Failed to analyze trend:', error);
      return null;
    }
  }

  /**
   * 🎯 ANALYZE HEALTH CONTENT ENGAGEMENT PATTERNS
   */
  private async analyzeHealthContentEngagement(page: Page): Promise<any> {
    try {
      // Search for recent health content
      await page.goto('https://twitter.com/search?q=health%20wellness&src=typed_query&f=live');
      await page.waitForTimeout(2000);

      const healthTweets = await page.$$('[data-testid="tweet"]');
      let totalEngagement = 0;
      let competitorCount = 0;

      // Analyze first 10 health tweets
      for (let i = 0; i < Math.min(healthTweets.length, 10); i++) {
        try {
          const tweet = healthTweets[i];
          const likeElement = await tweet.$('[data-testid="like"]');
          const likes = await this.extractMetricNumber(likeElement);
          
          totalEngagement += likes;
          if (likes > 20) competitorCount++; // Active health accounts

        } catch (error) {
          console.warn(`⚠️ HEALTH_ENGAGEMENT: Failed to analyze tweet ${i}:`, error);
        }
      }

      const avgEngagement = totalEngagement / Math.max(healthTweets.length, 1);
      const multiplier = Math.max(0.5, Math.min(2.0, avgEngagement / 50));

      return {
        multiplier,
        optimal_types: this.determineOptimalTypes(avgEngagement),
        competition_level: competitorCount
      };

    } catch (error) {
      console.error('❌ HEALTH_ENGAGEMENT: Analysis failed:', error);
      return {
        multiplier: 1.0,
        optimal_types: ['myth_busting'],
        competition_level: 5
      };
    }
  }

  // Helper methods for analysis
  private analyzeContentType(content: string): { type: string; style: string } {
    const lowerContent = content.toLowerCase();

    // Determine content type based on keywords
    if (lowerContent.includes('myth') || lowerContent.includes('wrong')) {
      return { type: 'myth_busting', style: 'controversy_starter' };
    } else if (lowerContent.includes('study') || lowerContent.includes('research')) {
      return { type: 'counterintuitive_insight', style: 'medical_authority' };
    } else if (lowerContent.includes('tried') || lowerContent.includes('experiment')) {
      return { type: 'practical_experiment', style: 'results_driven_experimenter' };
    } else if (lowerContent.includes('doctor') || lowerContent.includes('medical')) {
      return { type: 'personal_discovery', style: 'medical_authority' };
    }

    return { type: 'story_insight', style: 'expensive_insider' };
  }

  private estimateFollowerConversion(totalEngagement: number): number {
    // Rough estimate: 1-5% of high engagement converts to follows
    return Math.min(5, Math.max(0.5, totalEngagement * 0.02));
  }

  private calculateViralCoefficient(likes: number, retweets: number, replies: number): number {
    // Viral coefficient = (retweets * 2 + replies) / total engagement
    const totalEngagement = likes + retweets + replies;
    if (totalEngagement === 0) return 0;
    return ((retweets * 2 + replies) / totalEngagement) * 100;
  }

  private calculateHealthRelevance(topic: string): number {
    const healthKeywords = ['health', 'wellness', 'nutrition', 'fitness', 'medical'];
    const relevanceScore = healthKeywords.reduce((score, keyword) => {
      return score + (topic.toLowerCase().includes(keyword) ? 20 : 0);
    }, 0);
    return Math.min(100, relevanceScore);
  }

  private suggestContentAngle(topic: string): string {
    const angles = [
      `Controversial take on ${topic}`,
      `What doctors don't tell you about ${topic}`,
      `The hidden truth about ${topic}`,
      `${topic}: separating fact from fiction`
    ];
    return angles[Math.floor(Math.random() * angles.length)];
  }

  private determineOptimalTypes(avgEngagement: number): string[] {
    if (avgEngagement > 100) {
      return ['controversy_starter', 'myth_busting'];
    } else if (avgEngagement > 50) {
      return ['medical_authority', 'counterintuitive_insight'];
    }
    return ['personal_discovery', 'practical_experiment'];
  }

  /**
   * 💾 STORE ANALYTICS DATA IN DATABASE
   */
  private async storeAnalyticsData(
    postAnalytics: TwitterPostAnalytics[],
    trendingTopics: TrendingTopicData[],
    audienceActivity: AudienceActivityData
  ): Promise<void> {
    try {
      // Store post analytics
      for (const post of postAnalytics) {
        await systemMonitor.trackDBQuery('store_post_analytics', async () => {
          return supabase
            .from('real_time_post_analytics')
            .insert({
              tweet_id: post.tweet_id,
              content: post.content,
              content_type: post.content_type,
              voice_style: post.voice_style,
              likes: post.likes,
              retweets: post.retweets,
              replies: post.replies,
              views: post.views,
              engagement_rate: post.engagement_rate,
              follower_conversion_rate: post.follower_conversion_rate,
              viral_coefficient: post.viral_coefficient,
              posted_at: post.posted_at.toISOString(),
              analyzed_at: new Date().toISOString()
            });
        });
      }

      // Store trending topics
      for (const trend of trendingTopics) {
        await systemMonitor.trackDBQuery('store_trending_data', async () => {
          return supabase
            .from('trending_topics_analysis')
            .insert({
              topic: trend.topic,
              volume: trend.volume,
              health_relevance_score: trend.health_relevance_score,
              competition_level: trend.competition_level,
              opportunity_window_minutes: trend.opportunity_window,
              suggested_content_angle: trend.suggested_content_angle,
              detected_at: new Date().toISOString()
            });
        });
      }

      // Store audience activity
      await systemMonitor.trackDBQuery('store_audience_activity', async () => {
        return supabase
          .from('audience_activity_data')
          .insert({
            hour_of_day: audienceActivity.hour,
            day_of_week: audienceActivity.day_of_week,
            active_followers_estimate: audienceActivity.active_followers_estimate,
            engagement_multiplier: audienceActivity.engagement_multiplier,
            optimal_content_types: audienceActivity.optimal_content_types,
            competition_accounts_active: audienceActivity.competition_accounts_active,
            recorded_at: new Date().toISOString()
          });
      });

    } catch (error) {
      console.error('❌ ANALYTICS_STORAGE: Failed to store data:', error);
    }
  }

  /**
   * 🤖 FEED DATA TO AI DECISION ENGINE
   */
  private async feedDataToAI(
    postAnalytics: TwitterPostAnalytics[],
    trendingTopics: TrendingTopicData[],
    audienceActivity: AudienceActivityData
  ): Promise<void> {
    try {
      // Feed analytics to intelligent decision engine
      for (const post of postAnalytics) {
        await intelligentDecision.storeTwitterAnalytics({
          likes: post.likes,
          retweets: post.retweets,
          replies: post.replies,
          impressions: post.views,
          followers_gained: Math.round(post.follower_conversion_rate),
          content_type: post.content_type,
          voice_style: post.voice_style,
          engagement_rate: post.engagement_rate,
          follower_conversion_rate: post.follower_conversion_rate,
          trending_topics: trendingTopics.map(t => t.topic),
          optimal_posting_window: audienceActivity.engagement_multiplier > 1.2
        });
      }

      console.log(`🤖 AI_FEED: Fed ${postAnalytics.length} analytics records to decision engine`);

    } catch (error) {
      console.error('❌ AI_FEED: Failed to feed data to AI:', error);
    }
  }
}

// Export singleton instance
export const realTimeAnalytics = RealTimeTwitterAnalytics.getInstance();
