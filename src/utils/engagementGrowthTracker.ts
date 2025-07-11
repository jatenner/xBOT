/**
 * 📈 ENGAGEMENT & GROWTH TRACKER
 * 
 * Sophisticated analytics system that tracks:
 * - Follower growth and retention
 * - Engagement rates and patterns
 * - Content performance insights
 * - Growth optimization recommendations
 * - Competitive analysis
 */

import { supabaseClient } from './supabaseClient';
import { unifiedBudget, type OperationCost } from './unifiedBudgetManager';

export interface EngagementMetrics {
  likes: number;
  retweets: number;
  replies: number;
  impressions: number;
  profile_clicks: number;
  url_clicks: number;
  quote_tweets: number;
  bookmarks: number;
}

export interface GrowthMetrics {
  followers_count: number;
  following_count: number;
  follower_growth_rate: number; // daily %
  engagement_rate: number; // %
  reach_rate: number; // %
  viral_coefficient: number; // retweets/followers
}

export interface ContentPerformance {
  tweet_id: string;
  content: string;
  metrics: EngagementMetrics;
  performance_score: number;
  content_type: string;
  posted_at: Date;
  peak_engagement_time?: Date;
}

export interface GrowthInsight {
  type: 'content_optimization' | 'timing_optimization' | 'engagement_strategy' | 'follower_retention';
  insight: string;
  evidence: any;
  recommendation: string;
  impact_estimate: 'low' | 'medium' | 'high';
  confidence: number; // 0-1
}

export interface CompetitorAnalysis {
  handle: string;
  followers: number;
  avg_engagement_rate: number;
  posting_frequency: number;
  top_performing_content_types: string[];
  strategies_to_adopt: string[];
}

export class EngagementGrowthTracker {
  private static instance: EngagementGrowthTracker;
  
  // Performance thresholds for analysis
  private static readonly THRESHOLDS = {
    HIGH_ENGAGEMENT: 0.05,      // 5% engagement rate
    LOW_ENGAGEMENT: 0.01,       // 1% engagement rate
    VIRAL_THRESHOLD: 0.10,      // 10% retweet rate
    GOOD_REACH: 1000,           // 1000+ impressions
    EXCELLENT_GROWTH: 0.02      // 2% daily follower growth
  };

  static getInstance(): EngagementGrowthTracker {
    if (!EngagementGrowthTracker.instance) {
      EngagementGrowthTracker.instance = new EngagementGrowthTracker();
    }
    return EngagementGrowthTracker.instance;
  }

  /**
   * 📊 RECORD TWEET PERFORMANCE
   */
  async recordTweetPerformance(
    tweetId: string,
    content: string,
    contentType: string,
    initialMetrics?: Partial<EngagementMetrics>
  ): Promise<void> {
    try {
      const metrics: EngagementMetrics = {
        likes: 0,
        retweets: 0,
        replies: 0,
        impressions: 0,
        profile_clicks: 0,
        url_clicks: 0,
        quote_tweets: 0,
        bookmarks: 0,
        ...initialMetrics
      };

      const performanceScore = this.calculatePerformanceScore(metrics);

      if (supabaseClient.supabase) {
        await supabaseClient.supabase
          .from('tweet_performance')
          .insert({
            tweet_id: tweetId,
            content,
            content_type: contentType,
            likes: metrics.likes,
            retweets: metrics.retweets,
            replies: metrics.replies,
            impressions: metrics.impressions,
            profile_clicks: metrics.profile_clicks,
            url_clicks: metrics.url_clicks,
            quote_tweets: metrics.quote_tweets,
            bookmarks: metrics.bookmarks,
            performance_score: performanceScore,
            posted_at: new Date().toISOString(),
            created_at: new Date().toISOString()
          });
      }

      console.log(`📊 Recorded tweet performance: ${tweetId} (Score: ${performanceScore.toFixed(2)})`);
    } catch (error) {
      console.error('❌ Failed to record tweet performance:', error);
    }
  }

  /**
   * 🔄 UPDATE TWEET METRICS
   */
  async updateTweetMetrics(tweetId: string, metrics: Partial<EngagementMetrics>): Promise<void> {
    try {
      if (!supabaseClient.supabase) return;

      const performanceScore = this.calculatePerformanceScore(metrics as EngagementMetrics);

      await supabaseClient.supabase
        .from('tweet_performance')
        .update({
          ...metrics,
          performance_score: performanceScore,
          updated_at: new Date().toISOString()
        })
        .eq('tweet_id', tweetId);

      // Update peak engagement time if this is a significant update
      if (metrics.likes && metrics.likes > 10) {
        await supabaseClient.supabase
          .from('tweet_performance')
          .update({
            peak_engagement_time: new Date().toISOString()
          })
          .eq('tweet_id', tweetId);
      }

    } catch (error) {
      console.error('❌ Failed to update tweet metrics:', error);
    }
  }

  /**
   * 📈 RECORD FOLLOWER GROWTH
   */
  async recordFollowerGrowth(
    followersCount: number,
    followingCount: number,
    additionalMetrics?: Partial<GrowthMetrics>
  ): Promise<void> {
    try {
      if (!supabaseClient.supabase) return;

      // Calculate growth rate compared to yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const { data: yesterdayData } = await supabaseClient.supabase
        .from('daily_growth')
        .select('followers_count')
        .eq('date', yesterday.toISOString().split('T')[0])
        .single();

      const followerGrowthRate = yesterdayData 
        ? ((followersCount - yesterdayData.followers_count) / yesterdayData.followers_count) * 100
        : 0;

      const growthMetrics: GrowthMetrics = {
        followers_count: followersCount,
        following_count: followingCount,
        follower_growth_rate: followerGrowthRate,
        engagement_rate: 0, // Will be calculated separately
        reach_rate: 0,
        viral_coefficient: 0,
        ...additionalMetrics
      };

      await supabaseClient.supabase
        .from('daily_growth')
        .upsert({
          date: new Date().toISOString().split('T')[0],
          ...growthMetrics,
          recorded_at: new Date().toISOString()
        });

      console.log(`📈 Recorded growth: ${followersCount} followers (${followerGrowthRate.toFixed(2)}% growth)`);
    } catch (error) {
      console.error('❌ Failed to record follower growth:', error);
    }
  }

  /**
   * 🧠 GENERATE GROWTH INSIGHTS
   */
  async generateGrowthInsights(): Promise<GrowthInsight[]> {
    const operationCost: OperationCost = {
      type: 'learning',
      estimatedCost: 0.005, // $0.005 for insights
      priority: 'important',
      fallbackAvailable: true
    };

    const budgetCheck = await unifiedBudget.canAfford(operationCost);
    if (!budgetCheck.approved) {
      console.log('💡 Using cached insights due to budget constraints');
      return this.getCachedInsights();
    }

    try {
      const insights: GrowthInsight[] = [];

      // Analyze content performance patterns
      const contentInsights = await this.analyzeContentPerformance();
      insights.push(...contentInsights);

      // Analyze timing patterns
      const timingInsights = await this.analyzeTimingPatterns();
      insights.push(...timingInsights);

      // Analyze engagement patterns
      const engagementInsights = await this.analyzeEngagementPatterns();
      insights.push(...engagementInsights);

      // Analyze follower growth patterns
      const growthInsights = await this.analyzeGrowthPatterns();
      insights.push(...growthInsights);

      // Cache insights for future use
      await this.cacheInsights(insights);

      await unifiedBudget.recordSpending(operationCost, 0.005);

      return insights;
    } catch (error) {
      console.error('❌ Failed to generate insights:', error);
      return this.getCachedInsights();
    }
  }

  /**
   * 📊 GET PERFORMANCE DASHBOARD
   */
  async getPerformanceDashboard(): Promise<{
    todayStats: any;
    weeklyTrends: any;
    topPerformers: ContentPerformance[];
    insights: GrowthInsight[];
    recommendations: string[];
  }> {
    try {
      const [todayStats, weeklyTrends, topPerformers, insights] = await Promise.all([
        this.getTodayStats(),
        this.getWeeklyTrends(),
        this.getTopPerformers(5),
        this.generateGrowthInsights()
      ]);

      const recommendations = this.generateRecommendations(insights, todayStats, weeklyTrends);

      return {
        todayStats,
        weeklyTrends,
        topPerformers,
        insights,
        recommendations
      };
    } catch (error) {
      console.error('❌ Failed to get performance dashboard:', error);
      return {
        todayStats: {},
        weeklyTrends: {},
        topPerformers: [],
        insights: [],
        recommendations: ['Unable to generate recommendations due to system error']
      };
    }
  }

  /**
   * 🎯 CONTENT OPTIMIZATION RECOMMENDATIONS
   */
  async getContentOptimizationRecommendations(): Promise<{
    bestPerformingTypes: string[];
    optimalLength: { min: number; max: number };
    bestHashtags: string[];
    engagementTriggers: string[];
    timingRecommendations: string[];
  }> {
    try {
      if (!supabaseClient.supabase) {
        return this.getDefaultRecommendations();
      }

      // Analyze top performing content
      const { data: topTweets } = await supabaseClient.supabase
        .from('tweet_performance')
        .select('*')
        .gte('performance_score', 0.75)
        .order('performance_score', { ascending: false })
        .limit(20);

      if (!topTweets || topTweets.length === 0) {
        return this.getDefaultRecommendations();
      }

      // Analyze content types
      const contentTypeCounts = topTweets.reduce((acc, tweet) => {
        acc[tweet.content_type] = (acc[tweet.content_type] || 0) + 1;
        return acc;
      }, {});

      const bestPerformingTypes = Object.entries(contentTypeCounts)
        .sort(([,a], [,b]) => (b as number) - (a as number))
        .slice(0, 3)
        .map(([type]) => type);

      // Analyze content length
      const lengths = topTweets.map(tweet => tweet.content.length);
      const optimalLength = {
        min: Math.min(...lengths),
        max: Math.max(...lengths)
      };

      // Extract hashtags from top performers
      const allHashtags = topTweets
        .flatMap(tweet => tweet.content.match(/#\w+/g) || [])
        .reduce((acc, tag) => {
          acc[tag] = (acc[tag] || 0) + 1;
          return acc;
        }, {});

      const bestHashtags = Object.entries(allHashtags)
        .sort(([,a], [,b]) => (b as number) - (a as number))
        .slice(0, 5)
        .map(([tag]) => tag);

      // Identify engagement triggers
      const engagementTriggers = this.identifyEngagementTriggers(topTweets);

      // Get timing recommendations
      const timingRecommendations = await this.getTimingRecommendations();

      return {
        bestPerformingTypes,
        optimalLength,
        bestHashtags,
        engagementTriggers,
        timingRecommendations
      };

    } catch (error) {
      console.error('❌ Failed to get content optimization recommendations:', error);
      return this.getDefaultRecommendations();
    }
  }

  /**
   * 🔍 IDENTIFY UNDERPERFORMING CONTENT
   */
  async identifyUnderperformingContent(): Promise<{
    lowPerformers: ContentPerformance[];
    commonIssues: string[];
    improvementActions: string[];
  }> {
    try {
      if (!supabaseClient.supabase) {
        return { lowPerformers: [], commonIssues: [], improvementActions: [] };
      }

      const { data: lowPerformers } = await supabaseClient.supabase
        .from('tweet_performance')
        .select('*')
        .lte('performance_score', 0.25)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('performance_score', { ascending: true })
        .limit(10);

      if (!lowPerformers || lowPerformers.length === 0) {
        return { lowPerformers: [], commonIssues: [], improvementActions: [] };
      }

      // Analyze common issues
      const commonIssues = this.analyzeCommonIssues(lowPerformers);
      const improvementActions = this.generateImprovementActions(commonIssues);

      return {
        lowPerformers: lowPerformers.map(tweet => ({
          tweet_id: tweet.tweet_id,
          content: tweet.content,
          metrics: {
            likes: tweet.likes,
            retweets: tweet.retweets,
            replies: tweet.replies,
            impressions: tweet.impressions,
            profile_clicks: tweet.profile_clicks,
            url_clicks: tweet.url_clicks,
            quote_tweets: tweet.quote_tweets,
            bookmarks: tweet.bookmarks
          },
          performance_score: tweet.performance_score,
          content_type: tweet.content_type,
          posted_at: new Date(tweet.posted_at),
          peak_engagement_time: tweet.peak_engagement_time ? new Date(tweet.peak_engagement_time) : undefined
        })),
        commonIssues,
        improvementActions
      };

    } catch (error) {
      console.error('❌ Failed to identify underperforming content:', error);
      return { lowPerformers: [], commonIssues: [], improvementActions: [] };
    }
  }

  /**
   * 📈 HELPER METHODS
   */
  private calculatePerformanceScore(metrics: EngagementMetrics): number {
    const totalEngagement = metrics.likes + metrics.retweets + metrics.replies + metrics.quote_tweets;
    const impressions = metrics.impressions || 1;
    
    // Base engagement rate
    const engagementRate = totalEngagement / impressions;
    
    // Weighted scoring (retweets and replies are more valuable)
    const weightedScore = (
      metrics.likes * 1 +
      metrics.retweets * 3 +
      metrics.replies * 2 +
      metrics.quote_tweets * 2 +
      metrics.bookmarks * 1.5
    ) / impressions;

    // Normalize to 0-1 scale
    return Math.min(1, weightedScore * 100);
  }

  private async analyzeContentPerformance(): Promise<GrowthInsight[]> {
    const insights: GrowthInsight[] = [];
    
    try {
      if (!supabaseClient.supabase) return insights;

      const { data: recentTweets } = await supabaseClient.supabase
        .from('tweet_performance')
        .select('*')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('performance_score', { ascending: false });

      if (!recentTweets || recentTweets.length === 0) return insights;

      // Analyze content type performance
      const typePerformance = recentTweets.reduce((acc, tweet) => {
        if (!acc[tweet.content_type]) {
          acc[tweet.content_type] = { total: 0, count: 0 };
        }
        acc[tweet.content_type].total += tweet.performance_score;
        acc[tweet.content_type].count++;
        return acc;
      }, {});

      const bestType = Object.entries(typePerformance)
        .map(([type, data]: [string, any]) => ({ type, avg: data.total / data.count }))
        .sort((a, b) => b.avg - a.avg)[0];

      if (bestType) {
        insights.push({
          type: 'content_optimization',
          insight: `${bestType.type} content performs best`,
          evidence: { averageScore: bestType.avg, sampleSize: typePerformance[bestType.type].count },
          recommendation: `Focus on creating more ${bestType.type} content`,
          impact_estimate: 'medium',
          confidence: 0.8
        });
      }

    } catch (error) {
      console.error('❌ Content analysis failed:', error);
    }

    return insights;
  }

  private async analyzeTimingPatterns(): Promise<GrowthInsight[]> {
    // Placeholder for timing analysis
    return [];
  }

  private async analyzeEngagementPatterns(): Promise<GrowthInsight[]> {
    // Placeholder for engagement pattern analysis
    return [];
  }

  private async analyzeGrowthPatterns(): Promise<GrowthInsight[]> {
    // Placeholder for growth pattern analysis
    return [];
  }

  private async getTodayStats(): Promise<any> {
    try {
      if (!supabaseClient.supabase) return {};

      const today = new Date().toISOString().split('T')[0];
      
      const { data: todayTweets } = await supabaseClient.supabase
        .from('tweet_performance')
        .select('*')
        .gte('created_at', today);

      const { data: todayGrowth } = await supabaseClient.supabase
        .from('daily_growth')
        .select('*')
        .eq('date', today)
        .single();

      return {
        tweetsPosted: todayTweets?.length || 0,
        avgPerformanceScore: todayTweets?.reduce((sum, tweet) => sum + tweet.performance_score, 0) / (todayTweets?.length || 1),
        followerGrowth: todayGrowth?.follower_growth_rate || 0,
        totalEngagement: todayTweets?.reduce((sum, tweet) => sum + tweet.likes + tweet.retweets + tweet.replies, 0) || 0
      };
    } catch (error) {
      return {};
    }
  }

  private async getWeeklyTrends(): Promise<any> {
    // Placeholder for weekly trends
    return {};
  }

  private async getTopPerformers(limit: number): Promise<ContentPerformance[]> {
    try {
      if (!supabaseClient.supabase) return [];

      const { data: topTweets } = await supabaseClient.supabase
        .from('tweet_performance')
        .select('*')
        .order('performance_score', { ascending: false })
        .limit(limit);

      return topTweets?.map(tweet => ({
        tweet_id: tweet.tweet_id,
        content: tweet.content,
        metrics: {
          likes: tweet.likes,
          retweets: tweet.retweets,
          replies: tweet.replies,
          impressions: tweet.impressions,
          profile_clicks: tweet.profile_clicks,
          url_clicks: tweet.url_clicks,
          quote_tweets: tweet.quote_tweets,
          bookmarks: tweet.bookmarks
        },
        performance_score: tweet.performance_score,
        content_type: tweet.content_type,
        posted_at: new Date(tweet.posted_at),
        peak_engagement_time: tweet.peak_engagement_time ? new Date(tweet.peak_engagement_time) : undefined
      })) || [];
    } catch (error) {
      return [];
    }
  }

  private generateRecommendations(insights: GrowthInsight[], todayStats: any, weeklyTrends: any): string[] {
    const recommendations: string[] = [];
    
    // Add recommendations based on insights
    insights.forEach(insight => {
      if (insight.impact_estimate === 'high') {
        recommendations.push(`HIGH IMPACT: ${insight.recommendation}`);
      }
    });

    // Add performance-based recommendations
    if (todayStats.avgPerformanceScore < 0.3) {
      recommendations.push('Consider reviewing content strategy - performance below average');
    }

    if (todayStats.followerGrowth < 0) {
      recommendations.push('Focus on follower retention and growth strategies');
    }

    return recommendations.length > 0 ? recommendations : ['Continue current strategy - performance is good'];
  }

  private identifyEngagementTriggers(tweets: any[]): string[] {
    const triggers: string[] = [];
    
    // Analyze common phrases in high-performing tweets
    const commonPhrases = ['breakthrough', 'just published', 'new study', 'data shows', 'insider tip'];
    
    tweets.forEach(tweet => {
      commonPhrases.forEach(phrase => {
        if (tweet.content.toLowerCase().includes(phrase.toLowerCase())) {
          if (!triggers.includes(phrase)) {
            triggers.push(phrase);
          }
        }
      });
    });

    return triggers;
  }

  private async getTimingRecommendations(): Promise<string[]> {
    return [
      'Post during peak hours: 9-11 AM EST',
      'Avoid posting late at night',
      'Consider Tuesday-Thursday for best engagement'
    ];
  }

  private getDefaultRecommendations() {
    return {
      bestPerformingTypes: ['research_insight', 'breaking_news', 'analysis'],
      optimalLength: { min: 180, max: 250 },
      bestHashtags: ['#HealthTech', '#AI', '#Innovation'],
      engagementTriggers: ['breakthrough', 'new study', 'data shows'],
      timingRecommendations: ['Post during peak hours', 'Avoid weekends']
    };
  }

  private analyzeCommonIssues(lowPerformers: any[]): string[] {
    const issues: string[] = [];
    
    // Check for common patterns in low performers
    const avgLength = lowPerformers.reduce((sum, tweet) => sum + tweet.content.length, 0) / lowPerformers.length;
    
    if (avgLength > 250) {
      issues.push('Content too long - consider shorter, punchier tweets');
    }
    
    if (avgLength < 100) {
      issues.push('Content too short - add more value and context');
    }

    const hasImages = lowPerformers.filter(tweet => tweet.content.includes('pic.twitter.com')).length;
    if (hasImages / lowPerformers.length < 0.3) {
      issues.push('Low image usage - visual content performs better');
    }

    return issues;
  }

  private generateImprovementActions(issues: string[]): string[] {
    return issues.map(issue => {
      if (issue.includes('too long')) return 'Aim for 180-220 characters per tweet';
      if (issue.includes('too short')) return 'Add more context and value in your tweets';
      if (issue.includes('image')) return 'Include relevant images in 60%+ of tweets';
      return 'Review and optimize content strategy';
    });
  }

  private async cacheInsights(insights: GrowthInsight[]): Promise<void> {
    try {
      if (!supabaseClient.supabase) return;

      await supabaseClient.supabase
        .from('cached_insights')
        .upsert({
          id: 'latest',
          insights: insights,
          generated_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('❌ Failed to cache insights:', error);
    }
  }

  private async getCachedInsights(): Promise<GrowthInsight[]> {
    try {
      if (!supabaseClient.supabase) return [];

      const { data } = await supabaseClient.supabase
        .from('cached_insights')
        .select('insights')
        .eq('id', 'latest')
        .single();

      return data?.insights || [];
    } catch (error) {
      return [];
    }
  }
}

// Export singleton instance
export const engagementTracker = EngagementGrowthTracker.getInstance(); 