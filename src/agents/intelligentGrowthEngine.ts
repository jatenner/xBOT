/**
 * 🚀 INTELLIGENT GROWTH ENGINE (2024)
 * 
 * Adaptive posting strategy engine that learns from performance data.
 * Dynamically adjusts frequency, content types, and timing based on real metrics.
 * 
 * Key Features:
 * - Performance-driven posting frequency
 * - Trending topic integration
 * - Engagement pattern analysis
 * - Adaptive content strategy
 * - Growth stagnation detection
 * - Real-time strategy optimization
 */

import { minimalSupabaseClient } from '../utils/minimalSupabaseClient';
import { emergencyBudgetLockdown } from '../utils/emergencyBudgetLockdown';
import { OpenAI } from 'openai';

interface GrowthMetrics {
  followerCount: number;
  followerGrowthRate: number; // followers per day
  avgEngagementRate: number;
  avgLikes: number;
  avgRetweets: number;
  avgReplies: number;
  postsLast7Days: number;
  engagementTrend: 'improving' | 'stable' | 'declining';
}

interface PostingStrategy {
  dailyPostFrequency: number;
  preferredTimes: string[];
  priorityContentTypes: string[];
  trendingTopicUsage: number; // 0-1 percentage
  experimentalContent: number; // 0-1 percentage
  reasoning: string;
  adjustments: string[];
}

interface TrendingTopic {
  id: string;
  topic: string;
  relevanceScore: number;
  healthRelevance: number;
  volumeScore: number;
  lastUsed?: string;
  usageCount: number;
}

interface ContentPerformancePattern {
  contentType: string;
  avgEngagementRate: number;
  avgLikes: number;
  bestTimeSlots: string[];
  trendingTopicBoost: number;
  sampleSize: number;
}

export class IntelligentGrowthEngine {
  private static readonly MIN_POSTS_FOR_ANALYSIS = 10;
  private static readonly GROWTH_STAGNATION_DAYS = 5;
  private static readonly ENGAGEMENT_DECLINE_THRESHOLD = 0.15; // 15% decline
  private static readonly MAX_DAILY_POSTS = 8;
  private static readonly MIN_DAILY_POSTS = 2;
  private static openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  /**
   * 🎯 RUN GROWTH ANALYSIS AND OPTIMIZATION
   * Main function to analyze performance and adjust strategy
   */
  static async optimizeGrowthStrategy(): Promise<{
    success: boolean;
    currentMetrics: GrowthMetrics;
    newStrategy: PostingStrategy;
    recommendations: string[];
    actions: string[];
  }> {
    try {
      console.log('🚀 === INTELLIGENT GROWTH OPTIMIZATION ===');

      // Step 1: Analyze current growth metrics
      const currentMetrics = await this.analyzeGrowthMetrics();
      console.log('📊 Current Growth Metrics:');
      console.log(`   👥 Followers: ${currentMetrics.followerCount} (growth: ${currentMetrics.followerGrowthRate.toFixed(2)}/day)`);
      console.log(`   💫 Engagement Rate: ${(currentMetrics.avgEngagementRate * 100).toFixed(2)}%`);
      console.log(`   📈 Trend: ${currentMetrics.engagementTrend}`);
      console.log(`   📝 Posts (7 days): ${currentMetrics.postsLast7Days}`);

      // Step 2: Analyze content performance patterns
      const performancePatterns = await this.analyzeContentPerformance();
      console.log(`🔍 Found ${performancePatterns.length} content performance patterns`);

      // Step 3: Get relevant trending topics
      const trendingTopics = await this.getRelevantTrendingTopics();
      console.log(`📈 Found ${trendingTopics.length} relevant trending topics`);

      // Step 4: Generate optimized posting strategy
      const newStrategy = await this.generateOptimizedStrategy(
        currentMetrics,
        performancePatterns,
        trendingTopics
      );

      // Step 5: Generate specific recommendations
      const recommendations = this.generateRecommendations(currentMetrics, newStrategy);

      // Step 6: Generate action items
      const actions = this.generateActionItems(currentMetrics, newStrategy);

      console.log('🎯 Growth Optimization Complete:');
      console.log(`   📝 New posting frequency: ${newStrategy.dailyPostFrequency} posts/day`);
      console.log(`   📈 Trending topic usage: ${(newStrategy.trendingTopicUsage * 100).toFixed(0)}%`);
      console.log(`   🔬 Experimental content: ${(newStrategy.experimentalContent * 100).toFixed(0)}%`);
      console.log(`   ⏰ Priority times: ${newStrategy.preferredTimes.join(', ')}`);

      return {
        success: true,
        currentMetrics,
        newStrategy,
        recommendations,
        actions
      };

    } catch (error: any) {
      console.error('❌ Growth optimization failed:', error);
      return {
        success: false,
        currentMetrics: await this.getDefaultMetrics(),
        newStrategy: await this.getDefaultStrategy(),
        recommendations: ['Growth optimization failed - using default strategy'],
        actions: []
      };
    }
  }

  /**
   * 📊 ANALYZE GROWTH METRICS
   * Comprehensive analysis of account growth and engagement
   */
  private static async analyzeGrowthMetrics(): Promise<GrowthMetrics> {
    try {
      if (!minimalSupabaseClient.supabase) {
        return this.getDefaultMetrics();
      }

      // Get follower count history (last 7 days)
      const { data: followerData } = await minimalSupabaseClient.supabase
        .from('daily_stats')
        .select('follower_count, created_at')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(7);

      // Get recent tweet performance (last 30 days)
      const { data: tweetData } = await minimalSupabaseClient.supabase
        .from('tweets')
        .select('likes, retweets, replies, impressions, created_at')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      // Calculate metrics
      const currentFollowers = followerData?.[0]?.follower_count || 1000;
      const oldestFollowers = followerData?.[followerData.length - 1]?.follower_count || currentFollowers;
      const daysDiff = Math.max(1, followerData?.length || 1);
      const followerGrowthRate = (currentFollowers - oldestFollowers) / daysDiff;

      // Calculate engagement metrics
      const validTweets = (tweetData || []).filter(t => 
        t.likes !== null && t.retweets !== null && t.replies !== null
      );

      const avgLikes = validTweets.length > 0 
        ? validTweets.reduce((sum, t) => sum + (t.likes || 0), 0) / validTweets.length 
        : 0;

      const avgRetweets = validTweets.length > 0
        ? validTweets.reduce((sum, t) => sum + (t.retweets || 0), 0) / validTweets.length
        : 0;

      const avgReplies = validTweets.length > 0
        ? validTweets.reduce((sum, t) => sum + (t.replies || 0), 0) / validTweets.length
        : 0;

      const totalEngagement = avgLikes + avgRetweets + avgReplies;
      const avgImpressions = validTweets.length > 0
        ? validTweets.reduce((sum, t) => sum + (t.impressions || Math.max(totalEngagement * 10, 100)), 0) / validTweets.length
        : 100;

      const avgEngagementRate = avgImpressions > 0 ? totalEngagement / avgImpressions : 0;

      // Determine engagement trend
      const recentTweets = validTweets.slice(0, Math.floor(validTweets.length / 2));
      const olderTweets = validTweets.slice(Math.floor(validTweets.length / 2));

      const recentEngagement = recentTweets.length > 0
        ? recentTweets.reduce((sum, t) => sum + (t.likes || 0) + (t.retweets || 0) + (t.replies || 0), 0) / recentTweets.length
        : 0;

      const olderEngagement = olderTweets.length > 0
        ? olderTweets.reduce((sum, t) => sum + (t.likes || 0) + (t.retweets || 0) + (t.replies || 0), 0) / olderTweets.length
        : 0;

      let engagementTrend: 'improving' | 'stable' | 'declining' = 'stable';
      if (recentEngagement > olderEngagement * 1.1) {
        engagementTrend = 'improving';
      } else if (recentEngagement < olderEngagement * 0.9) {
        engagementTrend = 'declining';
      }

      const postsLast7Days = (tweetData || []).filter(t => 
        new Date(t.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      ).length;

      return {
        followerCount: currentFollowers,
        followerGrowthRate,
        avgEngagementRate,
        avgLikes,
        avgRetweets,
        avgReplies,
        postsLast7Days,
        engagementTrend
      };

    } catch (error: any) {
      console.error('❌ Failed to analyze growth metrics:', error);
      return this.getDefaultMetrics();
    }
  }

  /**
   * 📈 ANALYZE CONTENT PERFORMANCE
   * Identify top-performing content types and patterns
   */
  private static async analyzeContentPerformance(): Promise<ContentPerformancePattern[]> {
    try {
      if (!minimalSupabaseClient.supabase) {
        return [];
      }

      // Get detailed tweet performance with metadata
      const { data: tweetPerformance } = await minimalSupabaseClient.supabase
        .from('tweet_performance_analysis')
        .select('*')
        .gte('analyzed_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('engagement_rate', { ascending: false });

      if (!tweetPerformance || tweetPerformance.length < this.MIN_POSTS_FOR_ANALYSIS) {
        console.log('⚠️ Insufficient data for content performance analysis');
        return [];
      }

      // Group by content type and analyze patterns
      const contentGroups: { [key: string]: any[] } = {};
      
      tweetPerformance.forEach(tweet => {
        const contentType = tweet.content_type || 'general';
        if (!contentGroups[contentType]) {
          contentGroups[contentType] = [];
        }
        contentGroups[contentType].push(tweet);
      });

      const patterns: ContentPerformancePattern[] = [];

      for (const [contentType, tweets] of Object.entries(contentGroups)) {
        if (tweets.length >= 3) { // Minimum sample size
          const avgEngagementRate = tweets.reduce((sum, t) => sum + (t.engagement_rate || 0), 0) / tweets.length;
          const avgLikes = tweets.reduce((sum, t) => sum + (t.likes || 0), 0) / tweets.length;
          
          // Analyze best time slots
          const timeSlots: { [key: string]: number } = {};
          tweets.forEach(tweet => {
            const hour = new Date(tweet.posted_at || tweet.created_at).getHours();
            const timeSlot = this.getTimeSlot(hour);
            timeSlots[timeSlot] = (timeSlots[timeSlot] || 0) + (tweet.engagement_rate || 0);
          });

          const bestTimeSlots = Object.entries(timeSlots)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 2)
            .map(([slot]) => slot);

          // Check trending topic boost
          const withTrending = tweets.filter(t => t.used_trending_topic);
          const withoutTrending = tweets.filter(t => !t.used_trending_topic);
          
          const trendingBoost = withTrending.length > 0 && withoutTrending.length > 0
            ? (withTrending.reduce((sum, t) => sum + (t.engagement_rate || 0), 0) / withTrending.length) /
              (withoutTrending.reduce((sum, t) => sum + (t.engagement_rate || 0), 0) / withoutTrending.length)
            : 1;

          patterns.push({
            contentType,
            avgEngagementRate,
            avgLikes,
            bestTimeSlots,
            trendingTopicBoost: trendingBoost,
            sampleSize: tweets.length
          });
        }
      }

      // Sort by performance
      patterns.sort((a, b) => b.avgEngagementRate - a.avgEngagementRate);

      console.log(`📊 Content Performance Patterns:`);
      patterns.forEach(pattern => {
        console.log(`   ${pattern.contentType}: ${(pattern.avgEngagementRate * 100).toFixed(2)}% engagement (${pattern.sampleSize} posts)`);
      });

      return patterns;

    } catch (error: any) {
      console.error('❌ Failed to analyze content performance:', error);
      return [];
    }
  }

  /**
   * 📈 GET RELEVANT TRENDING TOPICS
   * Fetch health-relevant trending topics
   */
  private static async getRelevantTrendingTopics(): Promise<TrendingTopic[]> {
    try {
      if (!minimalSupabaseClient.supabase) {
        return [];
      }

      const { data: trendingData } = await minimalSupabaseClient.supabase
        .from('real_trending_topics')
        .select('*')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
        .gte('health_relevance', 0.6) // Only health-relevant topics
        .order('relevance_score', { ascending: false })
        .limit(20);

      if (!trendingData || trendingData.length === 0) {
        console.log('⚠️ No relevant trending topics found');
        return [];
      }

      // Convert to TrendingTopic format
      const topics: TrendingTopic[] = trendingData.map(trend => ({
        id: trend.id,
        topic: trend.topic,
        relevanceScore: trend.relevance_score || 0,
        healthRelevance: trend.health_relevance || 0,
        volumeScore: trend.volume_score || 0,
        lastUsed: trend.last_used,
        usageCount: trend.usage_count || 0
      }));

      console.log(`📈 Found ${topics.length} relevant trending topics`);
      return topics;

    } catch (error: any) {
      console.error('❌ Failed to get trending topics:', error);
      return [];
    }
  }

  /**
   * 🧠 GENERATE OPTIMIZED STRATEGY
   * Create adaptive posting strategy based on analysis
   */
  private static async generateOptimizedStrategy(
    metrics: GrowthMetrics,
    patterns: ContentPerformancePattern[],
    trendingTopics: TrendingTopic[]
  ): Promise<PostingStrategy> {
    try {
      await emergencyBudgetLockdown.enforceBeforeAICall('growth-strategy-optimization');

      // Base strategy calculation
      let dailyPostFrequency = 3; // Default
      let trendingTopicUsage = 0.3; // 30% default
      let experimentalContent = 0.2; // 20% default
      const adjustments: string[] = [];

      // Adjust frequency based on growth metrics
      if (metrics.engagementTrend === 'declining' && metrics.followerGrowthRate < 0.5) {
        dailyPostFrequency = Math.min(this.MAX_DAILY_POSTS, 5);
        adjustments.push('Increased frequency due to declining growth');
      } else if (metrics.engagementTrend === 'improving' && metrics.avgEngagementRate > 0.05) {
        dailyPostFrequency = Math.max(this.MIN_DAILY_POSTS, 2);
        adjustments.push('Maintaining quality over quantity due to good engagement');
      }

      // Adjust based on current posting volume
      if (metrics.postsLast7Days < 10) {
        dailyPostFrequency = Math.min(this.MAX_DAILY_POSTS, dailyPostFrequency + 1);
        adjustments.push('Increased frequency due to low posting volume');
      } else if (metrics.postsLast7Days > 30) {
        dailyPostFrequency = Math.max(this.MIN_DAILY_POSTS, dailyPostFrequency - 1);
        adjustments.push('Reduced frequency to prevent oversaturation');
      }

      // Adjust trending topic usage
      if (trendingTopics.length > 10) {
        trendingTopicUsage = 0.5; // 50% when many topics available
        adjustments.push('Increased trending topic usage due to high availability');
      }

      // Determine priority content types
      const priorityContentTypes = patterns.length > 0
        ? patterns.slice(0, 3).map(p => p.contentType)
        : ['health_tip', 'motivation', 'science'];

      // Determine preferred times
      const allTimeSlots = patterns.flatMap(p => p.bestTimeSlots);
      const timeSlotCounts: { [key: string]: number } = {};
      allTimeSlots.forEach(slot => {
        timeSlotCounts[slot] = (timeSlotCounts[slot] || 0) + 1;
      });

      const preferredTimes = Object.entries(timeSlotCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .map(([slot]) => slot);

      if (preferredTimes.length === 0) {
        preferredTimes.push('morning', 'afternoon'); // Default times
      }

      // Generate reasoning using AI
      const reasoning = await this.generateStrategyReasoning(metrics, patterns, adjustments);

      return {
        dailyPostFrequency,
        preferredTimes,
        priorityContentTypes,
        trendingTopicUsage,
        experimentalContent,
        reasoning,
        adjustments
      };

    } catch (error: any) {
      console.error('❌ Failed to generate optimized strategy:', error);
      return this.getDefaultStrategy();
    }
  }

  /**
   * 🧠 GENERATE STRATEGY REASONING
   * Use AI to generate human-readable strategy explanation
   */
  private static async generateStrategyReasoning(
    metrics: GrowthMetrics,
    patterns: ContentPerformancePattern[],
    adjustments: string[]
  ): Promise<string> {
    try {
      const prompt = `Generate a brief strategy explanation for this Twitter growth optimization:

CURRENT METRICS:
- Followers: ${metrics.followerCount} (growth: ${metrics.followerGrowthRate.toFixed(2)}/day)
- Engagement Rate: ${(metrics.avgEngagementRate * 100).toFixed(2)}%
- Trend: ${metrics.engagementTrend}
- Posts (7 days): ${metrics.postsLast7Days}

TOP CONTENT TYPES:
${patterns.slice(0, 3).map(p => `- ${p.contentType}: ${(p.avgEngagementRate * 100).toFixed(2)}% engagement`).join('\n')}

ADJUSTMENTS MADE:
${adjustments.join('\n')}

Explain the strategy in 1-2 sentences focusing on the key reasoning.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 150,
        temperature: 0.3
      });

      return response.choices[0]?.message?.content?.trim() || 
             'Strategy optimized based on current performance metrics and engagement patterns.';

    } catch (error: any) {
      console.error('❌ Failed to generate strategy reasoning:', error);
      return 'Strategy optimized based on current performance metrics and engagement patterns.';
    }
  }

  /**
   * 💡 GENERATE RECOMMENDATIONS
   * Create actionable recommendations based on analysis
   */
  private static generateRecommendations(metrics: GrowthMetrics, strategy: PostingStrategy): string[] {
    const recommendations: string[] = [];

    // Growth-based recommendations
    if (metrics.followerGrowthRate < 1) {
      recommendations.push('Focus on engagement quality over quantity to improve follower growth rate');
    }

    if (metrics.avgEngagementRate < 0.02) {
      recommendations.push('Consider more interactive content (questions, polls) to boost engagement');
    }

    if (metrics.engagementTrend === 'declining') {
      recommendations.push('Experiment with new content formats and posting times');
    }

    // Strategy-based recommendations
    if (strategy.trendingTopicUsage > 0.4) {
      recommendations.push('Monitor trending topics daily and adapt content to capitalize on trends');
    }

    if (strategy.dailyPostFrequency > 4) {
      recommendations.push('Ensure content quality remains high despite increased posting frequency');
    }

    // Default recommendations if none generated
    if (recommendations.length === 0) {
      recommendations.push('Continue current strategy while monitoring performance metrics');
    }

    return recommendations;
  }

  /**
   * ✅ GENERATE ACTION ITEMS
   * Create specific action items for implementation
   */
  private static generateActionItems(metrics: GrowthMetrics, strategy: PostingStrategy): string[] {
    const actions: string[] = [];

    // Frequency adjustments
    if (strategy.dailyPostFrequency !== 3) {
      actions.push(`Adjust posting frequency to ${strategy.dailyPostFrequency} posts per day`);
    }

    // Content type priorities
    if (strategy.priorityContentTypes.length > 0) {
      actions.push(`Prioritize content types: ${strategy.priorityContentTypes.join(', ')}`);
    }

    // Timing optimization
    if (strategy.preferredTimes.length > 0) {
      actions.push(`Schedule posts during optimal times: ${strategy.preferredTimes.join(', ')}`);
    }

    // Trending topic integration
    if (strategy.trendingTopicUsage > 0.3) {
      actions.push(`Incorporate trending topics in ${(strategy.trendingTopicUsage * 100).toFixed(0)}% of posts`);
    }

    // Engagement improvement
    if (metrics.avgEngagementRate < 0.03) {
      actions.push('Focus on creating more engaging, interactive content');
    }

    return actions;
  }

  /**
   * 🕐 GET TIME SLOT
   * Convert hour to time slot
   */
  private static getTimeSlot(hour: number): string {
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    if (hour >= 18 && hour < 24) return 'evening';
    return 'late_night';
  }

  /**
   * 📊 GET DEFAULT METRICS
   * Fallback metrics when data is unavailable
   */
  private static getDefaultMetrics(): GrowthMetrics {
    return {
      followerCount: 1000,
      followerGrowthRate: 1,
      avgEngagementRate: 0.025,
      avgLikes: 25,
      avgRetweets: 5,
      avgReplies: 3,
      postsLast7Days: 14,
      engagementTrend: 'stable'
    };
  }

  /**
   * 🎯 GET DEFAULT STRATEGY
   * Fallback strategy when optimization fails
   */
  private static async getDefaultStrategy(): Promise<PostingStrategy> {
    return {
      dailyPostFrequency: 3,
      preferredTimes: ['morning', 'afternoon'],
      priorityContentTypes: ['health_tip', 'motivation', 'science'],
      trendingTopicUsage: 0.3,
      experimentalContent: 0.2,
      reasoning: 'Using default balanced strategy for consistent growth',
      adjustments: []
    };
  }

  /**
   * 💾 SAVE STRATEGY
   * Store the optimized strategy for use by posting system
   */
  static async saveOptimizedStrategy(strategy: PostingStrategy): Promise<void> {
    try {
      if (!minimalSupabaseClient.supabase) {
        console.log('⚠️ Cannot save strategy - database not available');
        return;
      }

      await minimalSupabaseClient.supabase
        .from('growth_strategies')
        .insert({
          daily_post_frequency: strategy.dailyPostFrequency,
          preferred_times: strategy.preferredTimes,
          priority_content_types: strategy.priorityContentTypes,
          trending_topic_usage: strategy.trendingTopicUsage,
          experimental_content: strategy.experimentalContent,
          reasoning: strategy.reasoning,
          adjustments: strategy.adjustments,
          created_at: new Date().toISOString(),
          active: true
        });

      // Deactivate old strategies
      await minimalSupabaseClient.supabase
        .from('growth_strategies')
        .update({ active: false })
        .neq('created_at', new Date().toISOString());

      console.log('💾 Growth strategy saved successfully');

    } catch (error: any) {
      console.error('❌ Failed to save growth strategy:', error);
    }
  }

  /**
   * 📈 GET CURRENT STRATEGY
   * Retrieve the active growth strategy
   */
  static async getCurrentStrategy(): Promise<PostingStrategy> {
    try {
      if (!minimalSupabaseClient.supabase) {
        return this.getDefaultStrategy();
      }

      const { data } = await minimalSupabaseClient.supabase
        .from('growth_strategies')
        .select('*')
        .eq('active', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!data || data.length === 0) {
        return this.getDefaultStrategy();
      }

      const strategy = data[0];
      return {
        dailyPostFrequency: strategy.daily_post_frequency || 3,
        preferredTimes: strategy.preferred_times || ['morning', 'afternoon'],
        priorityContentTypes: strategy.priority_content_types || ['health_tip', 'motivation'],
        trendingTopicUsage: strategy.trending_topic_usage || 0.3,
        experimentalContent: strategy.experimental_content || 0.2,
        reasoning: strategy.reasoning || 'Current active strategy',
        adjustments: strategy.adjustments || []
      };

    } catch (error: any) {
      console.error('❌ Failed to get current strategy:', error);
      return this.getDefaultStrategy();
    }
  }
} 