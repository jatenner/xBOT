/**
 * ⏰ INTELLIGENT POSTING FREQUENCY OPTIMIZER
 * 
 * Dynamically optimizes posting frequency based on:
 * - Audience online patterns
 * - Twitter algorithm peak times
 * - Recent post performance
 * - Competitor activity
 * - Engagement momentum
 */

import { getSupabaseClient } from '../db/index';

export interface OptimalTimingStrategy {
  next_post_time: Date;
  confidence_score: number;
  reasoning: string;
  frequency_adjustment: 'increase' | 'decrease' | 'maintain';
  optimal_window: {
    start_hour: number;
    end_hour: number;
    timezone: string;
  };
  performance_prediction: {
    expected_likes: number;
    expected_engagement_rate: number;
    viral_probability: number;
  };
}

export interface FrequencyAnalysis {
  current_frequency: string;
  optimal_frequency: string;
  audience_activity_pattern: Array<{
    hour: number;
    engagement_multiplier: number;
    confidence: number;
  }>;
  recent_performance_trend: 'improving' | 'declining' | 'stable';
  saturation_risk: number; // 0-1, higher = more risk of over-posting
}

export class IntelligentFrequencyOptimizer {
  private static instance: IntelligentFrequencyOptimizer;
  
  public static getInstance(): IntelligentFrequencyOptimizer {
    if (!IntelligentFrequencyOptimizer.instance) {
      IntelligentFrequencyOptimizer.instance = new IntelligentFrequencyOptimizer();
    }
    return IntelligentFrequencyOptimizer.instance;
  }

  /**
   * 🎯 Get optimal posting strategy for next post
   */
  public async getOptimalTimingStrategy(): Promise<OptimalTimingStrategy> {
    console.log('⏰ FREQUENCY_OPTIMIZER: Analyzing optimal posting timing...');
    
    try {
      const [
        audiencePattern,
        recentPerformance,
        competitorActivity,
        algorithmInsights
      ] = await Promise.all([
        this.analyzeAudiencePattern(),
        this.analyzeRecentPerformance(),
        this.analyzeCompetitorActivity(),
        this.getTwitterAlgorithmInsights()
      ]);

      const strategy = this.calculateOptimalStrategy(
        audiencePattern,
        recentPerformance,
        competitorActivity,
        algorithmInsights
      );

      console.log(`✅ OPTIMAL_TIMING: Next post in ${Math.round((strategy.next_post_time.getTime() - Date.now()) / 60000)} minutes`);
      console.log(`📊 CONFIDENCE: ${strategy.confidence_score}/100, Action: ${strategy.frequency_adjustment}`);

      return strategy;

    } catch (error: any) {
      console.error('❌ FREQUENCY_OPTIMIZER_ERROR:', error.message);
      return this.getFallbackStrategy();
    }
  }

  /**
   * 👥 Analyze audience activity patterns
   */
  private async analyzeAudiencePattern(): Promise<FrequencyAnalysis['audience_activity_pattern']> {
    try {
      const supabase = getSupabaseClient();
      
      // Get recent engagement data grouped by hour
      const { data: recentMetrics } = await supabase
        .from('real_tweet_metrics')
        .select('*')
        .gte('collected_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
        .order('collected_at', { ascending: false });

      if (!recentMetrics || recentMetrics.length === 0) {
        // Default pattern based on general Twitter activity
        return this.getDefaultActivityPattern();
      }

      // Group by hour and calculate engagement multipliers
      const hourlyStats: Record<number, { total_engagement: number; count: number }> = {};
      
      recentMetrics.forEach((metric: any) => {
        const hour = new Date(metric.collected_at as string).getHours();
        if (!hourlyStats[hour]) hourlyStats[hour] = { total_engagement: 0, count: 0 };
        hourlyStats[hour].total_engagement += (metric.engagement_rate || 0);
        hourlyStats[hour].count += 1;
      });

      // Calculate multipliers (compared to average)
      const avgEngagement = Object.values(hourlyStats).reduce(
        (sum, stat) => sum + (stat.total_engagement / stat.count), 0
      ) / Object.keys(hourlyStats).length;

      const activityPattern = Array.from({ length: 24 }, (_, hour) => {
        const stats = hourlyStats[hour];
        if (!stats || stats.count === 0) {
          return { hour, engagement_multiplier: 1.0, confidence: 0.2 };
        }

        const hourAvg = stats.total_engagement / stats.count;
        const multiplier = avgEngagement > 0 ? hourAvg / avgEngagement : 1.0;
        const confidence = Math.min(stats.count / 5, 1.0); // Higher confidence with more data

        return { hour, engagement_multiplier: multiplier, confidence };
      });

      return activityPattern;

    } catch (error) {
      return this.getDefaultActivityPattern();
    }
  }

  /**
   * 📈 Analyze recent posting performance trends
   */
  private async analyzeRecentPerformance(): Promise<{
    trend: 'improving' | 'declining' | 'stable';
    saturation_risk: number;
    avg_gap_between_posts: number;
    recent_engagement_trend: number;
  }> {
    try {
      const supabase = getSupabaseClient();
      
      const { data: recentPosts } = await supabase
        .from('unified_posts')
        .select('*')
        .gte('createdAt', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('createdAt', { ascending: false })
        .limit(20);

      if (!recentPosts || recentPosts.length < 3) {
        return {
          trend: 'stable',
          saturation_risk: 0.3,
          avg_gap_between_posts: 60, // Default 1 hour
          recent_engagement_trend: 0
        };
      }

      // Calculate average time between posts
      const timeDiffs = [];
      for (let i = 1; i < recentPosts.length; i++) {
        const diff = new Date((recentPosts[i-1] as any).createdAt as string).getTime() - new Date((recentPosts[i] as any).createdAt as string).getTime();
        timeDiffs.push(diff / (60 * 1000)); // Convert to minutes
      }
      const avgGap = timeDiffs.reduce((a, b) => a + b, 0) / timeDiffs.length;

      // Assess saturation risk based on posting frequency
      const postsLast24h = recentPosts.filter(
        (p: any) => new Date(p.createdAt as string).getTime() > Date.now() - 24 * 60 * 60 * 1000
      ).length;
      
      const saturationRisk = Math.min(postsLast24h / 12, 1.0); // Risk increases after 12 posts/day

      return {
        trend: 'stable', // Will be enhanced with actual engagement correlation
        saturation_risk: saturationRisk,
        avg_gap_between_posts: avgGap,
        recent_engagement_trend: 0
      };

    } catch (error) {
      return {
        trend: 'stable',
        saturation_risk: 0.3,
        avg_gap_between_posts: 60,
        recent_engagement_trend: 0
      };
    }
  }

  /**
   * 🔍 Analyze competitor activity patterns
   */
  private async analyzeCompetitorActivity(): Promise<{
    posting_frequency: number;
    peak_hours: number[];
    content_gaps: string[];
  }> {
    // Simplified for now - will be enhanced with actual competitor monitoring
    return {
      posting_frequency: 4, // Average posts per day
      peak_hours: [9, 12, 17, 20], // Peak posting hours
      content_gaps: ['morning motivation', 'evening wellness tips']
    };
  }

  /**
   * 🧠 Get Twitter algorithm insights
   */
  private async getTwitterAlgorithmInsights(): Promise<{
    optimal_hours: number[];
    engagement_windows: Array<{ start: number; end: number; multiplier: number }>;
    avoid_hours: number[];
  }> {
    // Based on general Twitter algorithm knowledge + will be enhanced with real data
    return {
      optimal_hours: [8, 9, 12, 13, 17, 18, 19, 20], // Prime engagement hours
      engagement_windows: [
        { start: 8, end: 10, multiplier: 1.3 }, // Morning commute
        { start: 12, end: 14, multiplier: 1.2 }, // Lunch break
        { start: 17, end: 21, multiplier: 1.4 } // Evening peak
      ],
      avoid_hours: [0, 1, 2, 3, 4, 5, 6] // Low activity hours
    };
  }

  /**
   * 🎯 Calculate optimal posting strategy
   */
  private calculateOptimalStrategy(
    audiencePattern: FrequencyAnalysis['audience_activity_pattern'],
    recentPerformance: any,
    competitorActivity: any,
    algorithmInsights: any
  ): OptimalTimingStrategy {
    const now = new Date();
    const currentHour = now.getHours();

    // Find next optimal hour based on audience pattern and algorithm insights
    let nextOptimalHour = currentHour + 1;
    let maxScore = 0;
    
    for (let hour = currentHour + 1; hour < currentHour + 24; hour++) {
      const checkHour = hour % 24;
      const audienceScore = audiencePattern[checkHour]?.engagement_multiplier || 1.0;
      const algorithmScore = algorithmInsights.optimal_hours.includes(checkHour) ? 1.2 : 0.8;
      const avoidPenalty = algorithmInsights.avoid_hours.includes(checkHour) ? 0.3 : 1.0;
      
      const totalScore = audienceScore * algorithmScore * avoidPenalty;
      
      if (totalScore > maxScore) {
        maxScore = totalScore;
        nextOptimalHour = checkHour;
      }
    }

    // Calculate next post time
    const nextPostTime = new Date();
    nextPostTime.setHours(nextOptimalHour, 0, 0, 0);
    if (nextPostTime <= now) {
      nextPostTime.setDate(nextPostTime.getDate() + 1);
    }

    // Adjust for saturation risk
    const minGap = recentPerformance.saturation_risk > 0.7 ? 180 : // 3 hours if high saturation
                   recentPerformance.saturation_risk > 0.4 ? 120 : // 2 hours if medium
                   60; // 1 hour if low

    const timeSinceNow = nextPostTime.getTime() - now.getTime();
    if (timeSinceNow < minGap * 60 * 1000) {
      nextPostTime.setTime(now.getTime() + minGap * 60 * 1000);
    }

    // Determine frequency adjustment
    let frequencyAdjustment: 'increase' | 'decrease' | 'maintain' = 'maintain';
    if (recentPerformance.saturation_risk > 0.7) {
      frequencyAdjustment = 'decrease';
    } else if (recentPerformance.saturation_risk < 0.3 && maxScore > 1.2) {
      frequencyAdjustment = 'increase';
    }

    const confidenceScore = Math.round(
      (maxScore * 30) + 
      (audiencePattern[nextOptimalHour]?.confidence || 0.5) * 30 + 
      (1 - recentPerformance.saturation_risk) * 40
    );

    return {
      next_post_time: nextPostTime,
      confidence_score: Math.min(confidenceScore, 100),
      reasoning: `Optimal hour ${nextOptimalHour}:00 based on audience activity (${(audiencePattern[nextOptimalHour]?.engagement_multiplier || 1).toFixed(2)}x) and algorithm insights. Saturation risk: ${(recentPerformance.saturation_risk * 100).toFixed(0)}%`,
      frequency_adjustment: frequencyAdjustment,
      optimal_window: {
        start_hour: Math.max(nextOptimalHour - 1, 0),
        end_hour: Math.min(nextOptimalHour + 2, 23),
        timezone: 'UTC'
      },
      performance_prediction: {
        expected_likes: Math.round(15 * maxScore), // Base 15 likes * score multiplier
        expected_engagement_rate: Math.min(0.05 * maxScore, 0.15),
        viral_probability: Math.min(maxScore * 0.1, 0.3)
      }
    };
  }

  /**
   * 📊 Get default activity pattern
   */
  private getDefaultActivityPattern(): FrequencyAnalysis['audience_activity_pattern'] {
    // Based on general health/professional audience patterns
    const basePattern = [
      0.3, 0.2, 0.1, 0.1, 0.1, 0.2, 0.4, 0.8, // 0-7: Low activity
      1.3, 1.2, 1.0, 1.0, 1.4, 1.3, 1.0, 0.9, // 8-15: Business hours peak
      0.8, 1.2, 1.4, 1.3, 1.2, 1.0, 0.8, 0.5  // 16-23: Evening peak
    ];

    return basePattern.map((multiplier, hour) => ({
      hour,
      engagement_multiplier: multiplier,
      confidence: 0.6 // Medium confidence for default pattern
    }));
  }

  /**
   * 🚨 Fallback strategy when analysis fails
   */
  private getFallbackStrategy(): OptimalTimingStrategy {
    const nextPost = new Date();
    nextPost.setTime(nextPost.getTime() + 90 * 60 * 1000); // 90 minutes from now

    return {
      next_post_time: nextPost,
      confidence_score: 50,
      reasoning: 'Using fallback timing due to analysis error. Posting in 90 minutes to allow for audience engagement.',
      frequency_adjustment: 'maintain',
      optimal_window: {
        start_hour: 9,
        end_hour: 21,
        timezone: 'UTC'
      },
      performance_prediction: {
        expected_likes: 10,
        expected_engagement_rate: 0.03,
        viral_probability: 0.05
      }
    };
  }
}

// Export singleton
export const intelligentFrequencyOptimizer = IntelligentFrequencyOptimizer.getInstance();
