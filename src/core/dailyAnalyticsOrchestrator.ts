/**
 * 📊 DAILY ANALYTICS ORCHESTRATOR
 * 
 * HONEST APPROACH: Works within Twitter's real API limits
 * Strategic once-daily analytics for maximum AI learning
 * 
 * DESIGN PHILOSOPHY:
 * - Respect API limits completely
 * - Maximize learning with minimal calls
 * - Prioritize most valuable tweets
 * - Ensure AI gets performance feedback
 */

import { secureSupabaseClient } from '../utils/secureSupabaseClient';
import { minimalSupabaseClient } from '../utils/minimalSupabaseClient';
import { xClient } from '../utils/xClient';

interface TweetAnalytics {
  tweet_id: string;
  content: string;
  likes: number;
  retweets: number;
  replies: number;
  quotes: number;
  impressions: number;
  engagement_rate: number;
  age_hours: number;
  learning_value: number; // How valuable this data is for AI
}

interface AnalyticsConfig {
  max_api_calls_per_day: number;       // Conservative API limit
  tweets_to_analyze: number;           // How many tweets to check
  prioritize_recent: boolean;          // Focus on recent tweets
  learning_threshold_hours: number;   // Minimum age for meaningful data
  schedule_time_utc: number;          // When to run (hour in UTC)
}

export class DailyAnalyticsOrchestrator {
  private static instance: DailyAnalyticsOrchestrator;
  private isRunning = false;
  private lastRunTime: Date | null = null;
  
  private readonly config: AnalyticsConfig = {
    max_api_calls_per_day: 20,         // Conservative - saves 5 calls for emergencies
    tweets_to_analyze: 15,             // Analyze last 15 tweets max
    prioritize_recent: true,           // Recent tweets have most learning value
    learning_threshold_hours: 2,       // Need 2+ hours for meaningful engagement
    schedule_time_utc: 3               // 3 AM UTC = 11 PM EST (off-peak)
  };

  private constructor() {
    console.log('📊 Daily Analytics Orchestrator initialized');
    console.log(`🎯 API Budget: ${this.config.max_api_calls_per_day} calls/day`);
    console.log(`📈 Analysis Target: ${this.config.tweets_to_analyze} tweets/day`);
  }

  static getInstance(): DailyAnalyticsOrchestrator {
    if (!DailyAnalyticsOrchestrator.instance) {
      DailyAnalyticsOrchestrator.instance = new DailyAnalyticsOrchestrator();
    }
    return DailyAnalyticsOrchestrator.instance;
  }

  /**
   * 🎯 STRATEGIC DAILY ANALYTICS RUN
   */
  async runDailyAnalytics(): Promise<{
    success: boolean;
    tweets_analyzed: number;
    api_calls_used: number;
    learning_insights: string[];
    next_run_time: Date;
  }> {
    if (this.isRunning) {
      console.log('⚠️ Daily analytics already running');
      return this.getFailureResult('Already running');
    }

    console.log('📊 === STRATEGIC DAILY ANALYTICS STARTING ===');
    console.log(`🕐 Run time: ${new Date().toISOString()}`);
    console.log(`🎯 API Budget: ${this.config.max_api_calls_per_day} calls`);

    this.isRunning = true;
    let apiCallsUsed = 0;
    let tweetsAnalyzed = 0;
    const learningInsights: string[] = [];

    try {
      // Step 1: Get tweets to analyze (database query - no API call)
      const candidateTweets = await this.getCandidateTweets();
      console.log(`📋 Found ${candidateTweets.length} candidate tweets for analysis`);

      if (candidateTweets.length === 0) {
        console.log('📭 No tweets to analyze');
        return this.getSuccessResult(0, 0, ['No tweets found for analysis']);
      }

      // Step 2: Prioritize tweets for maximum learning value
      const prioritizedTweets = this.prioritizeTweetsForLearning(candidateTweets);
      const tweetsToAnalyze = prioritizedTweets.slice(0, this.config.max_api_calls_per_day);
      
      console.log(`🎯 Prioritized ${tweetsToAnalyze.length} tweets for analysis`);

      // Step 3: Analyze tweets using browser-based performance data (no API limits)
      const analytics: TweetAnalytics[] = [];
      
      for (const tweet of tweetsToAnalyze) {
        try {
          const tweetAnalytics = await this.analyzeTweet(tweet);
          if (tweetAnalytics) {
            analytics.push(tweetAnalytics);
            await this.saveTweetAnalytics(tweetAnalytics);
            tweetsAnalyzed++;
          }

          // Small delay between database operations
          await this.sleep(200); // 200ms between database calls

        } catch (error) {
          console.warn(`⚠️ Failed to analyze tweet ${tweet.tweet_id}:`, error.message);
        }
      }

      // Step 4: Generate learning insights
      const insights = await this.generateLearningInsights(analytics);
      learningInsights.push(...insights);

      // Step 5: Update AI learning systems
      await this.updateAILearning(analytics, insights);

      console.log('✅ === DAILY ANALYTICS COMPLETE ===');
      console.log(`📊 Tweets analyzed: ${tweetsAnalyzed}`);
      console.log(`🔍 Using browser-based performance tracking (no API limits)`);
      console.log(`🧠 Learning insights: ${insights.length}`);

      this.lastRunTime = new Date();

      return this.getSuccessResult(tweetsAnalyzed, 0, learningInsights); // 0 API calls used

    } catch (error) {
      console.error('❌ Daily analytics error:', error);
      return this.getFailureResult(error.message);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 📋 GET CANDIDATE TWEETS (No API calls)
   */
  private async getCandidateTweets(): Promise<{
    tweet_id: string;
    content: string;
    created_at: string;
    last_analyzed?: string;
  }[]> {
    const { data, error } = await secureSupabaseClient.supabase
      ?.from('tweets')
      .select('tweet_id, content, created_at, updated_at')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
      .order('created_at', { ascending: false })
      .limit(50); // Get more candidates than we can analyze

    if (error) {
      console.error('❌ Error fetching candidate tweets:', error);
      return [];
    }

    return data || [];
  }

  /**
   * 🎯 PRIORITIZE TWEETS FOR MAXIMUM LEARNING VALUE
   */
  private prioritizeTweetsForLearning(tweets: any[]): any[] {
    return tweets
      .map(tweet => {
        const ageHours = (Date.now() - new Date(tweet.created_at).getTime()) / (1000 * 60 * 60);
        const wasRecentlyAnalyzed = tweet.updated_at && 
          (Date.now() - new Date(tweet.updated_at).getTime()) < (12 * 60 * 60 * 1000); // 12 hours

        // Calculate learning value score
        let learningValue = 0;
        
        // Recent tweets (2-24 hours) have high value
        if (ageHours >= this.config.learning_threshold_hours && ageHours <= 24) {
          learningValue += 10;
        }
        
        // Tweets 24-48 hours have medium value  
        if (ageHours > 24 && ageHours <= 48) {
          learningValue += 7;
        }
        
        // Older tweets have lower value
        if (ageHours > 48) {
          learningValue += 3;
        }
        
        // Penalize recently analyzed tweets
        if (wasRecentlyAnalyzed) {
          learningValue -= 5;
        }

        return { ...tweet, age_hours: ageHours, learning_value: learningValue };
      })
      .filter(tweet => tweet.learning_value > 0)
      .sort((a, b) => b.learning_value - a.learning_value);
  }

  /**
   * 📊 ANALYZE SINGLE TWEET (Browser-based scraping)
   */
  private async analyzeTweet(tweet: any): Promise<TweetAnalytics | null> {
    try {
      // Get the most recent performance data from the performance tracking system
      const perfResponse = await minimalSupabaseClient.supabase
        ?.from('tweets')
        .select('performance_log, likes, retweets, replies, impressions')
        .eq('tweet_id', tweet.tweet_id)
        .single();

      if (perfResponse?.error || !perfResponse?.data) {
        console.warn(`⚠️ No performance data found for tweet ${tweet.tweet_id}`);
        return null;
      }

      const performanceData = perfResponse.data;
      const likes = performanceData.likes || 0;
      const retweets = performanceData.retweets || 0;
      const replies = performanceData.replies || 0;
      const quotes = 0; // Not available via scraping
      const impressions = performanceData.impressions || 0;

      const totalEngagement = likes + retweets + replies + quotes;
      const engagement_rate = impressions > 0 ? (totalEngagement / impressions) * 100 : 
                              totalEngagement > 0 ? totalEngagement * 2 : 0; // Estimated rate

      return {
        tweet_id: tweet.tweet_id,
        content: tweet.content,
        likes,
        retweets,
        replies,
        quotes,
        impressions,
        engagement_rate,
        age_hours: tweet.age_hours,
        learning_value: tweet.learning_value
      };

    } catch (error) {
      console.warn(`⚠️ Failed to analyze tweet ${tweet.tweet_id}:`, error.message);
      return null;
    }
  }

  /**
   * 💾 SAVE TWEET ANALYTICS TO DATABASE
   */
  private async saveTweetAnalytics(analytics: TweetAnalytics): Promise<void> {
    try {
      // Update main tweets table
      await secureSupabaseClient.supabase
        ?.from('tweets')
        .update({
          likes_count: analytics.likes,
          retweets_count: analytics.retweets,
          replies_count: analytics.replies,
          quotes_count: analytics.quotes,
          impressions_count: analytics.impressions,
          engagement_score: analytics.engagement_rate,
          updated_at: new Date().toISOString()
        })
        .eq('tweet_id', analytics.tweet_id);

      // Save to analytics table for historical tracking
      await secureSupabaseClient.supabase
        ?.from('tweet_metrics')
        .upsert({
          tweet_id: analytics.tweet_id,
          like_count: analytics.likes,
          retweet_count: analytics.retweets,
          reply_count: analytics.replies,
          quote_count: analytics.quotes,
          impression_count: analytics.impressions,
          engagement_rate: analytics.engagement_rate,
          captured_at: new Date().toISOString()
        }, { onConflict: 'tweet_id' });

      console.log(`💾 Saved analytics for ${analytics.tweet_id}: ${analytics.likes} likes, ${analytics.impressions} impressions`);

    } catch (error) {
      console.error(`❌ Failed to save analytics for ${analytics.tweet_id}:`, error);
    }
  }

  /**
   * 🧠 GENERATE LEARNING INSIGHTS
   */
  private async generateLearningInsights(analytics: TweetAnalytics[]): Promise<string[]> {
    const insights: string[] = [];

    if (analytics.length === 0) {
      return ['No analytics data available for insights'];
    }

    // Calculate performance metrics
    const avgEngagement = analytics.reduce((sum, a) => sum + a.engagement_rate, 0) / analytics.length;
    const bestPerformer = analytics.reduce((best, current) => 
      current.engagement_rate > best.engagement_rate ? current : best
    );
    const worstPerformer = analytics.reduce((worst, current) => 
      current.engagement_rate < worst.engagement_rate ? current : worst
    );

    insights.push(`Average engagement rate: ${avgEngagement.toFixed(2)}%`);
    insights.push(`Best performer: ${bestPerformer.engagement_rate.toFixed(2)}% engagement (${bestPerformer.impressions} impressions)`);
    insights.push(`Needs improvement: ${worstPerformer.engagement_rate.toFixed(2)}% engagement`);

    // Analyze content patterns
    const highPerformers = analytics.filter(a => a.engagement_rate > avgEngagement);
    if (highPerformers.length > 0) {
      insights.push(`${highPerformers.length}/${analytics.length} tweets performed above average`);
    }

    return insights;
  }

  /**
   * 🤖 UPDATE AI LEARNING SYSTEMS
   */
  private async updateAILearning(analytics: TweetAnalytics[], insights: string[]): Promise<void> {
    try {
      // Save learning data for AI systems to use
      await secureSupabaseClient.supabase
        ?.from('ai_learning_data')
        .insert({
          analysis_date: new Date().toISOString(),
          tweets_analyzed: analytics.length,
          insights: insights,
          performance_data: analytics.map(a => ({
            content_preview: a.content.substring(0, 100),
            engagement_rate: a.engagement_rate,
            impressions: a.impressions
          }))
        });

      console.log('🧠 Updated AI learning systems with performance data');

    } catch (error) {
      console.log('⚠️ AI learning update failed (table may not exist):', error.message);
    }
  }

  /**
   * 🕐 CHECK IF DAILY RUN IS DUE
   */
  shouldRunToday(): boolean {
    if (!this.lastRunTime) return true;

    const now = new Date();
    const lastRun = new Date(this.lastRunTime);
    
    // Check if it's been more than 20 hours since last run
    const hoursSinceLastRun = (now.getTime() - lastRun.getTime()) / (1000 * 60 * 60);
    
    return hoursSinceLastRun >= 20;
  }

  /**
   * 📊 GET ANALYTICS STATUS
   */
  getStatus(): {
    is_running: boolean;
    last_run_time: Date | null;
    should_run_today: boolean;
    api_budget: number;
    config: AnalyticsConfig;
  } {
    return {
      is_running: this.isRunning,
      last_run_time: this.lastRunTime,
      should_run_today: this.shouldRunToday(),
      api_budget: this.config.max_api_calls_per_day,
      config: this.config
    };
  }

  // Helper methods
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getSuccessResult(tweets: number, apiCalls: number, insights: string[]) {
    return {
      success: true,
      tweets_analyzed: tweets,
      api_calls_used: apiCalls,
      learning_insights: insights,
      next_run_time: new Date(Date.now() + 24 * 60 * 60 * 1000)
    };
  }

  private getFailureResult(error: string) {
    return {
      success: false,
      tweets_analyzed: 0,
      api_calls_used: 0,
      learning_insights: [error],
      next_run_time: new Date(Date.now() + 2 * 60 * 60 * 1000) // Retry in 2 hours
    };
  }
}

// Export singleton instance
export const dailyAnalyticsOrchestrator = DailyAnalyticsOrchestrator.getInstance(); 