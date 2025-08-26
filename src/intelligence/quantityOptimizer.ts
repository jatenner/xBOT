/**
 * 📊 QUANTITY OPTIMIZER
 * 
 * Learns optimal posting quantity from engagement data
 * - Tests different posting frequencies (7/day vs 50/day)
 * - Measures engagement per post vs total engagement
 * - Finds the sweet spot that maximizes followers and engagement
 * - Adapts quantity based on audience response
 */

import { AdvancedDatabaseManager } from '../lib/advancedDatabaseManager';

interface QuantityExperiment {
  date: string;
  posts_count: number;
  total_engagement: number;
  avg_engagement_per_post: number;
  followers_gained: number;
  engagement_rate: number;
  reach_efficiency: number;
}

interface QuantityInsights {
  optimal_daily_posts: number;
  optimal_hourly_frequency: number; // minutes between posts
  current_performance: {
    posts_per_day: number;
    engagement_per_post: number;
    total_daily_engagement: number;
    efficiency_score: number;
  };
  experiments: {
    low_frequency: QuantityExperiment[]; // 5-10 posts/day
    medium_frequency: QuantityExperiment[]; // 10-20 posts/day
    high_frequency: QuantityExperiment[]; // 20+ posts/day
  };
  recommendations: {
    increase_frequency: boolean;
    decrease_frequency: boolean;
    maintain_current: boolean;
    target_posts_today: number;
    next_post_in_minutes: number;
  };
}

export class QuantityOptimizer {
  private static instance: QuantityOptimizer;
  private db: AdvancedDatabaseManager;
  private currentDailyTarget = 12; // Start with 12 posts/day
  private lastOptimization = 0;
  private optimizationInterval = 24 * 60 * 60 * 1000; // Daily optimization

  private constructor() {
    this.db = AdvancedDatabaseManager.getInstance();
  }

  public static getInstance(): QuantityOptimizer {
    if (!QuantityOptimizer.instance) {
      QuantityOptimizer.instance = new QuantityOptimizer();
    }
    return QuantityOptimizer.instance;
  }

  /**
   * 🎯 MAIN FUNCTION: Get optimal posting quantity for today
   */
  public async getOptimalQuantity(): Promise<{
    should_post_more_today: boolean;
    posts_remaining_today: number;
    target_posts_today: number;
    frequency_minutes: number;
    reason: string;
    insights: QuantityInsights;
  }> {
    console.log('📊 QUANTITY_OPTIMIZER: Analyzing optimal posting frequency from engagement data');

    const insights = await this.analyzeQuantityPerformance();
    const currentPostsToday = await this.getTodaysPostCount();
    
    const postsRemaining = Math.max(0, insights.recommendations.target_posts_today - currentPostsToday);
    const shouldPostMore = postsRemaining > 0;
    
    console.log(`📊 QUANTITY_ANALYSIS: ${currentPostsToday}/${insights.recommendations.target_posts_today} posts today`);
    console.log(`🎯 Target frequency: Every ${insights.optimal_hourly_frequency} minutes`);

    let reason = '';
    if (insights.recommendations.increase_frequency) {
      reason = '📈 INCREASE_FREQUENCY: Higher volume shows better total engagement';
    } else if (insights.recommendations.decrease_frequency) {
      reason = '📉 DECREASE_FREQUENCY: Quality over quantity - fewer posts perform better';
    } else {
      reason = '✅ MAINTAIN_CURRENT: Current frequency is optimal';
    }

    return {
      should_post_more_today: shouldPostMore,
      posts_remaining_today: postsRemaining,
      target_posts_today: insights.recommendations.target_posts_today,
      frequency_minutes: insights.optimal_hourly_frequency,
      reason,
      insights
    };
  }

  /**
   * 📈 Analyze posting quantity performance from database
   */
  private async analyzeQuantityPerformance(): Promise<QuantityInsights> {
    try {
      console.log('📊 Analyzing posting quantity experiments...');

      // Get data from last 14 days
      const experimentData = await this.db.executeQuery(
        'get_quantity_experiments',
        async (client) => {
          const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
          
          // Get daily posting stats
          const { data: posts } = await client
            .from('learning_posts')
            .select('created_at, likes_count, retweets_count, replies_count, impressions_count')
            .gte('created_at', fourteenDaysAgo.toISOString())
            .order('created_at', { ascending: false });

          // Get daily metrics
          const { data: metrics } = await client
            .from('tweet_metrics')
            .select('created_at, likes_count, retweets_count, replies_count, impressions_count')
            .gte('created_at', fourteenDaysAgo.toISOString())
            .order('created_at', { ascending: false });

          return { posts: posts || [], metrics: metrics || [] };
        }
      );

      const insights = this.calculateQuantityInsights(experimentData.posts, experimentData.metrics);
      
      console.log(`📊 QUANTITY_INSIGHTS: Optimal ${insights.optimal_daily_posts} posts/day`);
      console.log(`⏱️ Frequency: Every ${insights.optimal_hourly_frequency} minutes`);

      return insights;
    } catch (error) {
      console.warn('⚠️ Could not analyze quantity performance:', error);
      return this.getFallbackQuantityInsights();
    }
  }

  /**
   * 🧮 Calculate quantity insights from historical data
   */
  private calculateQuantityInsights(posts: any[], metrics: any[]): QuantityInsights {
    const allData = [...posts, ...metrics];
    
    // Group data by day
    const dailyData: { [date: string]: any[] } = {};
    allData.forEach(item => {
      const date = new Date(item.created_at).toISOString().split('T')[0];
      if (!dailyData[date]) dailyData[date] = [];
      dailyData[date].push(item);
    });

    // Calculate daily experiments
    const experiments: QuantityExperiment[] = [];
    Object.entries(dailyData).forEach(([date, dayItems]) => {
      const postsCount = dayItems.length;
      const totalEngagement = dayItems.reduce((sum, item) => {
        return sum + (item.likes_count || 0) + (item.retweets_count || 0) + (item.replies_count || 0);
      }, 0);
      
      const avgEngagementPerPost = postsCount > 0 ? totalEngagement / postsCount : 0;
      const totalImpressions = dayItems.reduce((sum, item) => sum + (item.impressions_count || 100), 0);
      const engagementRate = totalImpressions > 0 ? totalEngagement / totalImpressions : 0;

      experiments.push({
        date,
        posts_count: postsCount,
        total_engagement: totalEngagement,
        avg_engagement_per_post: avgEngagementPerPost,
        followers_gained: 0, // Would need follower tracking
        engagement_rate: engagementRate,
        reach_efficiency: totalEngagement / Math.max(1, postsCount) // Engagement per post
      });
    });

    // Categorize experiments by frequency
    const lowFreq = experiments.filter(exp => exp.posts_count <= 10);
    const mediumFreq = experiments.filter(exp => exp.posts_count > 10 && exp.posts_count <= 20);
    const highFreq = experiments.filter(exp => exp.posts_count > 20);

    // Calculate averages for each frequency group
    const lowFreqAvg = this.calculateGroupAverage(lowFreq);
    const mediumFreqAvg = this.calculateGroupAverage(mediumFreq);
    const highFreqAvg = this.calculateGroupAverage(highFreq);

    console.log(`📊 QUANTITY_ANALYSIS:`);
    console.log(`   Low frequency (≤10): ${lowFreqAvg.avg_engagement_per_post.toFixed(2)} engagement/post`);
    console.log(`   Medium frequency (11-20): ${mediumFreqAvg.avg_engagement_per_post.toFixed(2)} engagement/post`);
    console.log(`   High frequency (21+): ${highFreqAvg.avg_engagement_per_post.toFixed(2)} engagement/post`);

    // Determine optimal strategy
    const optimalStrategy = this.determineOptimalStrategy(lowFreqAvg, mediumFreqAvg, highFreqAvg);
    
    // Calculate current performance
    const recentExperiments = experiments.slice(0, 7); // Last 7 days
    const currentPerformance = this.calculateGroupAverage(recentExperiments);

    return {
      optimal_daily_posts: optimalStrategy.optimal_posts,
      optimal_hourly_frequency: Math.floor(1440 / optimalStrategy.optimal_posts), // Minutes between posts
      current_performance: {
        posts_per_day: currentPerformance.posts_count,
        engagement_per_post: currentPerformance.avg_engagement_per_post,
        total_daily_engagement: currentPerformance.total_engagement,
        efficiency_score: currentPerformance.reach_efficiency
      },
      experiments: {
        low_frequency: lowFreq,
        medium_frequency: mediumFreq,
        high_frequency: highFreq
      },
      recommendations: optimalStrategy.recommendations
    };
  }

  /**
   * 📊 Calculate average metrics for a group of experiments
   */
  private calculateGroupAverage(experiments: QuantityExperiment[]): QuantityExperiment {
    if (experiments.length === 0) {
      return {
        date: 'no_data',
        posts_count: 0,
        total_engagement: 0,
        avg_engagement_per_post: 0,
        followers_gained: 0,
        engagement_rate: 0,
        reach_efficiency: 0
      };
    }

    const totals = experiments.reduce((acc, exp) => ({
      posts_count: acc.posts_count + exp.posts_count,
      total_engagement: acc.total_engagement + exp.total_engagement,
      avg_engagement_per_post: acc.avg_engagement_per_post + exp.avg_engagement_per_post,
      followers_gained: acc.followers_gained + exp.followers_gained,
      engagement_rate: acc.engagement_rate + exp.engagement_rate,
      reach_efficiency: acc.reach_efficiency + exp.reach_efficiency
    }), {
      posts_count: 0,
      total_engagement: 0,
      avg_engagement_per_post: 0,
      followers_gained: 0,
      engagement_rate: 0,
      reach_efficiency: 0
    });

    const count = experiments.length;
    return {
      date: 'average',
      posts_count: Math.round(totals.posts_count / count),
      total_engagement: Math.round(totals.total_engagement / count),
      avg_engagement_per_post: totals.avg_engagement_per_post / count,
      followers_gained: Math.round(totals.followers_gained / count),
      engagement_rate: totals.engagement_rate / count,
      reach_efficiency: totals.reach_efficiency / count
    };
  }

  /**
   * 🎯 Determine optimal posting strategy
   */
  private determineOptimalStrategy(low: QuantityExperiment, medium: QuantityExperiment, high: QuantityExperiment): any {
    console.log('🎯 Determining optimal posting strategy...');

    // Calculate efficiency scores (total engagement + per-post quality)
    const lowScore = (low.total_engagement * 0.6) + (low.avg_engagement_per_post * 0.4);
    const mediumScore = (medium.total_engagement * 0.6) + (medium.avg_engagement_per_post * 0.4);
    const highScore = (high.total_engagement * 0.6) + (high.avg_engagement_per_post * 0.4);

    console.log(`📊 Strategy scores: Low=${lowScore.toFixed(2)}, Medium=${mediumScore.toFixed(2)}, High=${highScore.toFixed(2)}`);

    let optimalPosts = 12; // Default
    let recommendations: any = {
      increase_frequency: false,
      decrease_frequency: false,
      maintain_current: true,
      target_posts_today: 12,
      next_post_in_minutes: 120
    };

    // Find best performing strategy
    if (highScore > mediumScore && highScore > lowScore && high.posts_count > 0) {
      // High frequency wins
      optimalPosts = Math.min(25, Math.max(20, high.posts_count)); // Cap at 25/day
      recommendations = {
        increase_frequency: true,
        decrease_frequency: false,
        maintain_current: false,
        target_posts_today: optimalPosts,
        next_post_in_minutes: Math.floor(1440 / optimalPosts) // Distribute throughout day
      };
      console.log('🚀 OPTIMAL_STRATEGY: High frequency posting');
    } else if (mediumScore > lowScore && medium.posts_count > 0) {
      // Medium frequency wins
      optimalPosts = Math.max(10, Math.min(20, medium.posts_count));
      recommendations = {
        increase_frequency: this.currentDailyTarget < optimalPosts,
        decrease_frequency: this.currentDailyTarget > optimalPosts,
        maintain_current: Math.abs(this.currentDailyTarget - optimalPosts) <= 2,
        target_posts_today: optimalPosts,
        next_post_in_minutes: Math.floor(1440 / optimalPosts)
      };
      console.log('⚖️ OPTIMAL_STRATEGY: Medium frequency posting');
    } else {
      // Low frequency wins or fallback
      optimalPosts = Math.max(5, Math.min(10, low.posts_count || 8));
      recommendations = {
        increase_frequency: false,
        decrease_frequency: this.currentDailyTarget > optimalPosts,
        maintain_current: this.currentDailyTarget <= optimalPosts,
        target_posts_today: optimalPosts,
        next_post_in_minutes: Math.floor(1440 / optimalPosts)
      };
      console.log('🎯 OPTIMAL_STRATEGY: Low frequency, high quality posting');
    }

    return {
      optimal_posts: optimalPosts,
      recommendations
    };
  }

  /**
   * 📅 Get today's post count
   */
  private async getTodaysPostCount(): Promise<number> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const count = await this.db.executeQuery(
        'get_todays_post_count',
        async (client) => {
          const { data: posts } = await client
            .from('learning_posts')
            .select('tweet_id', { count: 'exact' })
            .gte('created_at', today + 'T00:00:00.000Z')
            .lt('created_at', today + 'T23:59:59.999Z');

          return posts?.length || 0;
        }
      );

      return count;
    } catch (error) {
      console.warn('⚠️ Could not get today\'s post count:', error);
      return 0;
    }
  }

  /**
   * 🛟 Fallback quantity insights
   */
  private getFallbackQuantityInsights(): QuantityInsights {
    return {
      optimal_daily_posts: 12,
      optimal_hourly_frequency: 120, // Every 2 hours
      current_performance: {
        posts_per_day: 8,
        engagement_per_post: 2.5,
        total_daily_engagement: 20,
        efficiency_score: 2.5
      },
      experiments: {
        low_frequency: [],
        medium_frequency: [],
        high_frequency: []
      },
      recommendations: {
        increase_frequency: true,
        decrease_frequency: false,
        maintain_current: false,
        target_posts_today: 12,
        next_post_in_minutes: 120
      }
    };
  }

  /**
   * 🔧 Update daily target based on optimization
   */
  public updateDailyTarget(newTarget: number): void {
    this.currentDailyTarget = Math.max(5, Math.min(30, newTarget)); // Reasonable bounds
    console.log(`🎯 QUANTITY_TARGET: Updated to ${this.currentDailyTarget} posts/day`);
  }

  /**
   * 📊 Get quantity optimization report
   */
  public async getQuantityReport(): Promise<any> {
    const insights = await this.analyzeQuantityPerformance();
    const todaysCount = await this.getTodaysPostCount();

    return {
      current_target: this.currentDailyTarget,
      todays_posts: todaysCount,
      optimal_posts: insights.optimal_daily_posts,
      frequency_minutes: insights.optimal_hourly_frequency,
      performance: insights.current_performance,
      recommendation: insights.recommendations.increase_frequency ? 'INCREASE' : 
                     insights.recommendations.decrease_frequency ? 'DECREASE' : 'MAINTAIN'
    };
  }
}
