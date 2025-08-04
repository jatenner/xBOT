/**
 * 🎯 PERFORMANCE CALCULATOR
 * =========================
 * Standardized algorithms for calculating tweet performance scores
 * and identifying best performing content for learning
 */

import { supabaseClient } from '../utils/supabaseClient';

export interface TweetPerformanceData {
  tweet_id: string;
  content: string;
  posted_at: string;
  
  // Engagement metrics
  likes: number;
  retweets: number;
  replies: number;
  quotes: number;
  bookmarks: number;
  
  // Reach metrics
  impressions: number;
  views: number;
  profile_visits: number;
  
  // Growth metrics
  new_followers_attributed: number;
  
  // Calculated scores
  engagement_rate: number;
  viral_score: number;
  performance_score: number;
  performance_rank: number;
  performance_percentile: number;
}

export interface PerformanceAnalysis {
  total_tweets: number;
  avg_likes_per_tweet: number;
  avg_engagement_rate: number;
  best_performing_tweets: TweetPerformanceData[];
  worst_performing_tweets: TweetPerformanceData[];
  performance_trends: {
    last_7_days: number;
    last_30_days: number;
    trend_direction: 'improving' | 'declining' | 'stable';
  };
  recommendations: string[];
}

export class PerformanceCalculator {
  
  /**
   * 🎯 CALCULATE UNIFIED PERFORMANCE SCORE
   * Standardized scoring algorithm used across the entire system
   */
  static calculateUnifiedScore(metrics: {
    likes: number;
    retweets: number;
    replies: number;
    impressions: number;
    new_followers: number;
    profile_visits: number;
  }): number {
    // Engagement Score (0-25 points) - Raw engagement value
    const engagementScore = Math.min(25, (metrics.likes + metrics.retweets * 2 + metrics.replies * 3) / 4);
    
    // Reach Score (0-25 points) - Impression efficiency
    const reachScore = Math.min(25, metrics.impressions / 200);
    
    // Follower Score (0-30 points) - HIGHEST WEIGHT - actual growth
    const followerScore = Math.min(30, metrics.new_followers * 5);
    
    // Conversion Score (0-20 points) - Profile visit efficiency
    const conversionScore = metrics.impressions > 0 
      ? Math.min(20, (metrics.profile_visits / metrics.impressions) * 100 * 2)
      : 0;
    
    // Final Score (0-100)
    return Math.round(engagementScore + reachScore + followerScore + conversionScore);
  }

  /**
   * 📊 GET ACCURATE AVERAGE LIKES PER TWEET
   * Fixes the incorrect calculations that were causing confusion
   */
  static async getAccurateAverageLikes(daysPeriod: number = 30): Promise<{
    avg_likes_per_tweet: number;
    total_tweets: number;
    total_likes: number;
    tweets_with_likes: number;
    avg_likes_excluding_zero: number;
  }> {
    try {
      const { data, error } = await supabaseClient.supabase
        .from('unified_tweet_performance')
        .select('likes, impressions')
        .gte('posted_at', new Date(Date.now() - daysPeriod * 24 * 60 * 60 * 1000).toISOString())
        .not('likes', 'is', null);

      if (error) {
        console.error('❌ Failed to fetch tweet data for average calculation:', error);
        return {
          avg_likes_per_tweet: 0,
          total_tweets: 0,
          total_likes: 0,
          tweets_with_likes: 0,
          avg_likes_excluding_zero: 0
        };
      }

      const tweets = data || [];
      const totalTweets = tweets.length;
      const totalLikes = tweets.reduce((sum, tweet) => sum + (tweet.likes || 0), 0);
      const tweetsWithLikes = tweets.filter(tweet => (tweet.likes || 0) > 0).length;
      
      const avgLikesPerTweet = totalTweets > 0 ? totalLikes / totalTweets : 0;
      const avgLikesExcludingZero = tweetsWithLikes > 0 
        ? tweets.filter(tweet => (tweet.likes || 0) > 0).reduce((sum, tweet) => sum + tweet.likes, 0) / tweetsWithLikes
        : 0;

      console.log(`📊 Accurate Average Likes Analysis (${daysPeriod} days):`);
      console.log(`   Total Tweets: ${totalTweets}`);
      console.log(`   Total Likes: ${totalLikes}`);
      console.log(`   Average Likes Per Tweet: ${avgLikesPerTweet.toFixed(2)}`);
      console.log(`   Tweets with >0 Likes: ${tweetsWithLikes}`);
      console.log(`   Average Likes (excluding 0): ${avgLikesExcludingZero.toFixed(2)}`);

      return {
        avg_likes_per_tweet: Math.round(avgLikesPerTweet * 100) / 100,
        total_tweets: totalTweets,
        total_likes: totalLikes,
        tweets_with_likes: tweetsWithLikes,
        avg_likes_excluding_zero: Math.round(avgLikesExcludingZero * 100) / 100
      };

    } catch (error) {
      console.error('❌ Failed to calculate accurate average likes:', error);
      return {
        avg_likes_per_tweet: 0,
        total_tweets: 0,
        total_likes: 0,
        tweets_with_likes: 0,
        avg_likes_excluding_zero: 0
      };
    }
  }

  /**
   * 🏆 GET BEST PERFORMING TWEETS
   * Standardized method for identifying top content
   */
  static async getBestPerformingTweets(
    limit: number = 10,
    daysPeriod: number = 30,
    minEngagement: number = 1
  ): Promise<TweetPerformanceData[]> {
    try {
      const { data, error } = await supabaseClient.supabase
        .from('unified_tweet_performance')
        .select('*')
        .gte('posted_at', new Date(Date.now() - daysPeriod * 24 * 60 * 60 * 1000).toISOString())
        .gte('likes', minEngagement) // Only tweets with actual engagement
        .order('performance_score', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('❌ Failed to fetch best performing tweets:', error);
        return [];
      }

      return data || [];

    } catch (error) {
      console.error('❌ Failed to get best performing tweets:', error);
      return [];
    }
  }

  /**
   * 📈 COMPREHENSIVE PERFORMANCE ANALYSIS
   */
  static async analyzePerformance(daysPeriod: number = 30): Promise<PerformanceAnalysis> {
    try {
      // Get all tweets in period
      const { data: allTweets, error } = await supabaseClient.supabase
        .from('unified_tweet_performance')
        .select('*')
        .gte('posted_at', new Date(Date.now() - daysPeriod * 24 * 60 * 60 * 1000).toISOString())
        .order('posted_at', { ascending: false });

      if (error) {
        throw error;
      }

      const tweets = allTweets || [];
      
      // Calculate averages
      const totalTweets = tweets.length;
      const totalLikes = tweets.reduce((sum, tweet) => sum + (tweet.likes || 0), 0);
      const avgLikesPerTweet = totalTweets > 0 ? totalLikes / totalTweets : 0;
      
      const totalEngagement = tweets.reduce((sum, tweet) => 
        sum + ((tweet.likes || 0) + (tweet.retweets || 0) + (tweet.replies || 0)), 0);
      const totalImpressions = tweets.reduce((sum, tweet) => sum + (tweet.impressions || 0), 0);
      const avgEngagementRate = totalImpressions > 0 ? (totalEngagement / totalImpressions) * 100 : 0;

      // Get best and worst performers
      const sortedByScore = tweets
        .filter(tweet => tweet.performance_score !== null)
        .sort((a, b) => (b.performance_score || 0) - (a.performance_score || 0));

      const bestPerforming = sortedByScore.slice(0, 5);
      const worstPerforming = sortedByScore.slice(-5).reverse();

      // Calculate trends
      const last7Days = tweets.filter(tweet => 
        new Date(tweet.posted_at) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
      const last30Days = tweets.filter(tweet => 
        new Date(tweet.posted_at) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));

      const avg7DayScore = last7Days.length > 0 
        ? last7Days.reduce((sum, tweet) => sum + (tweet.performance_score || 0), 0) / last7Days.length
        : 0;
      const avg30DayScore = last30Days.length > 0
        ? last30Days.reduce((sum, tweet) => sum + (tweet.performance_score || 0), 0) / last30Days.length
        : 0;

      let trendDirection: 'improving' | 'declining' | 'stable' = 'stable';
      if (avg7DayScore > avg30DayScore * 1.1) {
        trendDirection = 'improving';
      } else if (avg7DayScore < avg30DayScore * 0.9) {
        trendDirection = 'declining';
      }

      // Generate recommendations
      const recommendations = this.generateRecommendations(tweets, avgLikesPerTweet, avgEngagementRate);

      const analysis: PerformanceAnalysis = {
        total_tweets: totalTweets,
        avg_likes_per_tweet: Math.round(avgLikesPerTweet * 100) / 100,
        avg_engagement_rate: Math.round(avgEngagementRate * 100) / 100,
        best_performing_tweets: bestPerforming,
        worst_performing_tweets: worstPerforming,
        performance_trends: {
          last_7_days: Math.round(avg7DayScore * 100) / 100,
          last_30_days: Math.round(avg30DayScore * 100) / 100,
          trend_direction: trendDirection
        },
        recommendations
      };

      console.log('📊 Performance Analysis Complete:');
      console.log(`   Total Tweets: ${analysis.total_tweets}`);
      console.log(`   Avg Likes/Tweet: ${analysis.avg_likes_per_tweet}`);
      console.log(`   Avg Engagement Rate: ${analysis.avg_engagement_rate}%`);
      console.log(`   Trend: ${analysis.performance_trends.trend_direction}`);

      return analysis;

    } catch (error) {
      console.error('❌ Failed to analyze performance:', error);
      return {
        total_tweets: 0,
        avg_likes_per_tweet: 0,
        avg_engagement_rate: 0,
        best_performing_tweets: [],
        worst_performing_tweets: [],
        performance_trends: {
          last_7_days: 0,
          last_30_days: 0,
          trend_direction: 'stable'
        },
        recommendations: ['Unable to analyze performance due to data collection issues']
      };
    }
  }

  /**
   * 💡 GENERATE PERFORMANCE RECOMMENDATIONS
   */
  private static generateRecommendations(
    tweets: any[], 
    avgLikes: number, 
    avgEngagementRate: number
  ): string[] {
    const recommendations: string[] = [];

    // Analyze performance levels
    if (avgLikes < 1) {
      recommendations.push('CRITICAL: Average likes below 1. Focus on content quality and audience targeting.');
      recommendations.push('Consider posting during optimal hours (7-9 AM, 7-9 PM).');
      recommendations.push('Increase use of engaging hooks and questions in tweets.');
    } else if (avgLikes < 5) {
      recommendations.push('LOW ENGAGEMENT: Average likes below 5. Improve content relevance and timing.');
      recommendations.push('Add more visual content and threads for complex topics.');
    } else if (avgLikes < 10) {
      recommendations.push('MODERATE ENGAGEMENT: Good foundation, optimize for viral potential.');
      recommendations.push('Experiment with controversial but ethical health takes.');
    } else {
      recommendations.push('STRONG ENGAGEMENT: Maintain current strategy and scale posting frequency.');
    }

    // Engagement rate analysis
    if (avgEngagementRate < 1) {
      recommendations.push('IMPRESSION ISSUE: Low engagement rate suggests poor reach. Optimize hashtags and timing.');
    } else if (avgEngagementRate < 3) {
      recommendations.push('ENGAGEMENT RATE: Below average. Focus on creating more interactive content.');
    } else {
      recommendations.push('ENGAGEMENT RATE: Good performance. Test scaling to more posts per day.');
    }

    // Content pattern analysis
    const topTweets = tweets
      .filter(tweet => (tweet.likes || 0) > avgLikes * 2)
      .slice(0, 5);

    if (topTweets.length > 0) {
      recommendations.push(`PATTERN: Your top tweets have common elements. Analyze and replicate successful patterns.`);
    }

    // Follower growth analysis
    const tweetsWithFollowerGrowth = tweets.filter(tweet => (tweet.new_followers_attributed || 0) > 0);
    if (tweetsWithFollowerGrowth.length < tweets.length * 0.2) {
      recommendations.push('FOLLOWER GROWTH: Low follower conversion. Add more profile-driving CTAs and bio optimization.');
    }

    return recommendations;
  }

  /**
   * 🔄 UPDATE ALL PERFORMANCE SCORES
   * Recalculates scores for all tweets using the unified algorithm
   */
  static async updateAllPerformanceScores(): Promise<{
    success: boolean;
    tweets_updated: number;
    error?: string;
  }> {
    try {
      console.log('🔄 Updating all performance scores with unified algorithm...');

      // Get all tweets with analytics data
      const { data: tweets, error } = await supabaseClient.supabase
        .from('tweet_analytics')
        .select('*')
        .eq('snapshot_interval', 'latest');

      if (error) {
        throw error;
      }

      let updatedCount = 0;

      for (const tweet of tweets || []) {
        const score = this.calculateUnifiedScore({
          likes: tweet.likes || 0,
          retweets: tweet.retweets || 0,
          replies: tweet.replies || 0,
          impressions: tweet.impressions || 0,
          new_followers: tweet.new_followers_attributed || 0,
          profile_visits: tweet.profile_visits || 0
        });

        // Update the score in database
        const { error: updateError } = await supabaseClient.supabase
          .from('tweet_analytics')
          .update({ 
            performance_score: score,
            updated_at: new Date().toISOString()
          })
          .eq('tweet_id', tweet.tweet_id)
          .eq('snapshot_interval', 'latest');

        if (!updateError) {
          updatedCount++;
        }
      }

      console.log(`✅ Updated performance scores for ${updatedCount} tweets`);

      return {
        success: true,
        tweets_updated: updatedCount
      };

    } catch (error) {
      console.error('❌ Failed to update performance scores:', error);
      return {
        success: false,
        tweets_updated: 0,
        error: error.message
      };
    }
  }
}

export const performanceCalculator = PerformanceCalculator;