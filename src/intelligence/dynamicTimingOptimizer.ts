/**
 * 🕐 DYNAMIC TIMING OPTIMIZER
 * 
 * Learns optimal posting times from database engagement data
 * - If 7pm always gets comments, posts more at 7pm
 * - Identifies peak engagement windows from actual data
 * - Adapts posting schedule based on follower behavior
 * - Maximizes likes, comments, shares based on timing patterns
 */

import { AdvancedDatabaseManager } from '../lib/advancedDatabaseManager';

interface TimingInsights {
  optimal_hours: number[];
  peak_engagement_windows: {
    start_hour: number;
    end_hour: number;
    avg_engagement: number;
    comment_rate: number;
    like_rate: number;
    share_rate: number;
  }[];
  worst_hours: number[];
  day_of_week_patterns: {
    [day: number]: {
      best_hours: number[];
      engagement_multiplier: number;
    };
  };
  confidence_score: number;
}

interface EngagementWindow {
  hour: number;
  engagement_score: number;
  comment_probability: number;
  like_probability: number;
  follower_activity: number;
  sample_size: number;
}

export class DynamicTimingOptimizer {
  private static instance: DynamicTimingOptimizer;
  private db: AdvancedDatabaseManager;
  private timingCache: Map<string, TimingInsights> = new Map();
  private lastAnalysis: number = 0;
  private analysisInterval = 6 * 60 * 60 * 1000; // 6 hours

  private constructor() {
    this.db = AdvancedDatabaseManager.getInstance();
  }

  public static getInstance(): DynamicTimingOptimizer {
    if (!DynamicTimingOptimizer.instance) {
      DynamicTimingOptimizer.instance = new DynamicTimingOptimizer();
    }
    return DynamicTimingOptimizer.instance;
  }

  /**
   * 🎯 MAIN FUNCTION: Get optimal posting time based on engagement data
   */
  public async getOptimalPostingTime(): Promise<{
    should_post_now: boolean;
    optimal_in_minutes: number;
    current_window_score: number;
    reason: string;
    timing_insights: TimingInsights;
  }> {
    console.log('🕐 DYNAMIC_TIMING: Analyzing optimal posting time from engagement data');

    const currentHour = new Date().getHours();
    const currentDay = new Date().getDay();

    // Get fresh timing insights
    const insights = await this.analyzeTimingPatterns();
    
    // Calculate current window score
    const currentWindowScore = this.calculateCurrentWindowScore(currentHour, currentDay, insights);
    
    console.log(`⏰ TIMING_ANALYSIS: Current hour ${currentHour}, score: ${currentWindowScore.toFixed(2)}`);

    // Check if current time is optimal
    const isOptimalTime = insights.optimal_hours.includes(currentHour);
    const isPeakWindow = insights.peak_engagement_windows.some(window => 
      currentHour >= window.start_hour && currentHour <= window.end_hour
    );

    let shouldPostNow = false;
    let optimalInMinutes = 60; // Default: check again in 1 hour
    let reason = '';

    if (isOptimalTime && currentWindowScore > 0.7) {
      shouldPostNow = true;
      reason = `🎯 OPTIMAL_TIME: Hour ${currentHour} shows high engagement (${(currentWindowScore * 100).toFixed(0)}%)`;
    } else if (isPeakWindow && currentWindowScore > 0.6) {
      shouldPostNow = true;
      reason = `⚡ PEAK_WINDOW: Currently in high-engagement window (${(currentWindowScore * 100).toFixed(0)}%)`;
    } else {
      // Find next optimal time
      const nextOptimalHour = this.findNextOptimalTime(currentHour, insights);
      const hoursUntilOptimal = nextOptimalHour > currentHour 
        ? nextOptimalHour - currentHour 
        : (24 - currentHour) + nextOptimalHour;
      
      optimalInMinutes = hoursUntilOptimal * 60;
      reason = `⏳ WAIT_FOR_OPTIMAL: Next peak at ${nextOptimalHour}:00 (${hoursUntilOptimal}h)`;
      
      // But don't wait more than 2 hours if score is decent
      if (currentWindowScore > 0.5 && optimalInMinutes > 120) {
        shouldPostNow = true;
        reason = `✅ GOOD_ENOUGH: Decent engagement window (${(currentWindowScore * 100).toFixed(0)}%) - post now`;
        optimalInMinutes = 5;
      }
    }

    console.log(`🎯 TIMING_DECISION: ${shouldPostNow ? 'POST NOW' : 'WAIT'} - ${reason}`);

    return {
      should_post_now: shouldPostNow,
      optimal_in_minutes: Math.min(optimalInMinutes, 90), // Max wait 90 minutes
      current_window_score: currentWindowScore,
      reason,
      timing_insights: insights
    };
  }

  /**
   * 📊 Analyze timing patterns from database engagement data
   */
  private async analyzeTimingPatterns(): Promise<TimingInsights> {
    // Check cache first
    const cacheKey = 'timing_insights';
    const now = Date.now();
    
    if (this.timingCache.has(cacheKey) && (now - this.lastAnalysis) < this.analysisInterval) {
      console.log('🕐 Using cached timing insights');
      return this.timingCache.get(cacheKey)!;
    }

    console.log('🕐 Analyzing engagement timing patterns from database...');

    try {
      // Get posts from last 30 days with engagement metrics
      const engagementData = await this.db.executeQuery(
        'get_timing_analysis_data',
        async (client) => {
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          
          const { data: posts } = await client
            .from('learning_posts')
            .select('created_at, likes_count, retweets_count, replies_count, impressions_count')
            .gte('created_at', thirtyDaysAgo.toISOString())
            .order('created_at', { ascending: false });

          const { data: metrics } = await client
            .from('tweet_metrics')
            .select('created_at, likes_count, retweets_count, replies_count, impressions_count')
            .gte('created_at', thirtyDaysAgo.toISOString())
            .order('created_at', { ascending: false });

          return { posts: posts || [], metrics: metrics || [] };
        }
      );

      const insights = this.calculateTimingInsights(engagementData.posts, engagementData.metrics);
      
      // Cache the results
      this.timingCache.set(cacheKey, insights);
      this.lastAnalysis = now;

      console.log(`🕐 TIMING_INSIGHTS: ${insights.optimal_hours.length} optimal hours identified`);
      console.log(`📊 Best hours: ${insights.optimal_hours.join(', ')}`);

      return insights;
    } catch (error) {
      console.warn('⚠️ Could not analyze timing patterns:', error);
      return this.getFallbackTimingInsights();
    }
  }

  /**
   * 🧮 Calculate timing insights from engagement data
   */
  private calculateTimingInsights(posts: any[], metrics: any[]): TimingInsights {
    const allData = [...posts, ...metrics];
    const hourlyData: { [hour: number]: EngagementWindow } = {};

    // Initialize hourly data
    for (let hour = 0; hour < 24; hour++) {
      hourlyData[hour] = {
        hour,
        engagement_score: 0,
        comment_probability: 0,
        like_probability: 0,
        follower_activity: 0,
        sample_size: 0
      };
    }

    // Analyze each post/metric
    allData.forEach(item => {
      const date = new Date(item.created_at);
      const hour = date.getHours();
      
      const likes = item.likes_count || 0;
      const retweets = item.retweets_count || 0;
      const replies = item.replies_count || 0;
      const impressions = item.impressions_count || Math.max(100, likes * 20);
      
      const totalEngagement = likes + retweets + replies;
      const engagementRate = totalEngagement / Math.max(1, impressions);
      
      hourlyData[hour].engagement_score += engagementRate;
      hourlyData[hour].comment_probability += replies > 0 ? 1 : 0;
      hourlyData[hour].like_probability += likes > 0 ? 1 : 0;
      hourlyData[hour].sample_size += 1;
    });

    // Calculate averages
    Object.values(hourlyData).forEach(window => {
      if (window.sample_size > 0) {
        window.engagement_score /= window.sample_size;
        window.comment_probability /= window.sample_size;
        window.like_probability /= window.sample_size;
        window.follower_activity = window.sample_size / allData.length; // Relative activity
      }
    });

    // Find optimal hours (top 30% by engagement)
    const sortedHours = Object.values(hourlyData)
      .filter(window => window.sample_size >= 2) // Need at least 2 samples
      .sort((a, b) => b.engagement_score - a.engagement_score);

    const topCount = Math.max(3, Math.floor(sortedHours.length * 0.3));
    const optimalHours = sortedHours.slice(0, topCount).map(window => window.hour);
    
    // Find worst hours (bottom 20%)
    const worstCount = Math.max(2, Math.floor(sortedHours.length * 0.2));
    const worstHours = sortedHours.slice(-worstCount).map(window => window.hour);

    // Find peak engagement windows (consecutive high-performing hours)
    const peakWindows = this.findPeakWindows(hourlyData);

    // Calculate day-of-week patterns
    const dayPatterns = this.calculateDayOfWeekPatterns(allData);

    // Calculate confidence based on sample size
    const totalSamples = allData.length;
    const confidence = Math.min(1.0, totalSamples / 50); // Full confidence with 50+ samples

    return {
      optimal_hours: optimalHours,
      peak_engagement_windows: peakWindows,
      worst_hours: worstHours,
      day_of_week_patterns: dayPatterns,
      confidence_score: confidence
    };
  }

  /**
   * 🔍 Find consecutive high-engagement hour windows
   */
  private findPeakWindows(hourlyData: { [hour: number]: EngagementWindow }): any[] {
    const windows = [];
    const threshold = 0.02; // 2% engagement rate threshold
    
    let windowStart = -1;
    let windowEngagement = 0;
    let windowComments = 0;
    let windowLikes = 0;
    let windowCount = 0;

    for (let hour = 0; hour < 24; hour++) {
      const data = hourlyData[hour];
      
      if (data.engagement_score > threshold && data.sample_size >= 2) {
        if (windowStart === -1) {
          windowStart = hour;
          windowEngagement = data.engagement_score;
          windowComments = data.comment_probability;
          windowLikes = data.like_probability;
          windowCount = 1;
        } else {
          windowEngagement += data.engagement_score;
          windowComments += data.comment_probability;
          windowLikes += data.like_probability;
          windowCount++;
        }
      } else {
        if (windowStart !== -1 && windowCount >= 2) {
          windows.push({
            start_hour: windowStart,
            end_hour: hour - 1,
            avg_engagement: windowEngagement / windowCount,
            comment_rate: windowComments / windowCount,
            like_rate: windowLikes / windowCount,
            share_rate: 0.1 // Placeholder - would need retweet data
          });
        }
        windowStart = -1;
        windowEngagement = 0;
        windowComments = 0;
        windowLikes = 0;
        windowCount = 0;
      }
    }

    return windows.sort((a, b) => b.avg_engagement - a.avg_engagement).slice(0, 3);
  }

  /**
   * 📅 Calculate day-of-week engagement patterns
   */
  private calculateDayOfWeekPatterns(allData: any[]): any {
    const dayPatterns: any = {};
    
    // Initialize patterns for each day
    for (let day = 0; day < 7; day++) {
      dayPatterns[day] = {
        best_hours: [],
        engagement_multiplier: 1.0
      };
    }

    // Group data by day of week
    const dayData: { [day: number]: any[] } = {};
    allData.forEach(item => {
      const day = new Date(item.created_at).getDay();
      if (!dayData[day]) dayData[day] = [];
      dayData[day].push(item);
    });

    // Analyze each day
    Object.entries(dayData).forEach(([day, items]) => {
      const dayNum = parseInt(day);
      const hourlyEngagement: { [hour: number]: number } = {};
      
      items.forEach(item => {
        const hour = new Date(item.created_at).getHours();
        const engagement = (item.likes_count || 0) + (item.retweets_count || 0) + (item.replies_count || 0);
        
        if (!hourlyEngagement[hour]) hourlyEngagement[hour] = 0;
        hourlyEngagement[hour] += engagement;
      });

      // Find best hours for this day
      const sortedHours = Object.entries(hourlyEngagement)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3)
        .map(([hour]) => parseInt(hour));

      dayPatterns[dayNum].best_hours = sortedHours;
      
      // Calculate engagement multiplier (vs average)
      const dayTotal = Object.values(hourlyEngagement).reduce((sum: number, val: number) => sum + val, 0);
      const dayAverage = dayTotal / Math.max(1, Object.keys(hourlyEngagement).length);
      
      // Overall average across all days
      const overallAverage = allData.reduce((sum, item) => {
        return sum + (item.likes_count || 0) + (item.retweets_count || 0) + (item.replies_count || 0);
      }, 0) / allData.length;
      
      dayPatterns[dayNum].engagement_multiplier = dayAverage / Math.max(1, overallAverage);
    });

    return dayPatterns;
  }

  /**
   * 🎯 Calculate current window engagement score
   */
  private calculateCurrentWindowScore(hour: number, day: number, insights: TimingInsights): number {
    let score = 0.3; // Base score

    // Optimal hour bonus
    if (insights.optimal_hours.includes(hour)) {
      score += 0.4;
    }

    // Peak window bonus
    const inPeakWindow = insights.peak_engagement_windows.some(window => 
      hour >= window.start_hour && hour <= window.end_hour
    );
    if (inPeakWindow) {
      score += 0.3;
    }

    // Day of week multiplier
    const dayPattern = insights.day_of_week_patterns[day];
    if (dayPattern) {
      score *= dayPattern.engagement_multiplier;
      
      // Best hours for this day bonus
      if (dayPattern.best_hours.includes(hour)) {
        score += 0.2;
      }
    }

    // Worst hour penalty
    if (insights.worst_hours.includes(hour)) {
      score -= 0.3;
    }

    // Apply confidence factor
    score *= insights.confidence_score;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * ⏭️ Find next optimal posting time
   */
  private findNextOptimalTime(currentHour: number, insights: TimingInsights): number {
    const optimalHours = insights.optimal_hours.sort((a, b) => a - b);
    
    // Find next optimal hour today
    const nextTodayHour = optimalHours.find(hour => hour > currentHour);
    if (nextTodayHour !== undefined) {
      return nextTodayHour;
    }
    
    // Return first optimal hour tomorrow
    return optimalHours[0] || currentHour + 1;
  }

  /**
   * 🛟 Fallback timing insights if analysis fails
   */
  private getFallbackTimingInsights(): TimingInsights {
    return {
      optimal_hours: [8, 12, 18, 20], // Common peak times
      peak_engagement_windows: [
        { start_hour: 7, end_hour: 9, avg_engagement: 0.03, comment_rate: 0.1, like_rate: 0.4, share_rate: 0.1 },
        { start_hour: 12, end_hour: 13, avg_engagement: 0.025, comment_rate: 0.08, like_rate: 0.35, share_rate: 0.08 },
        { start_hour: 18, end_hour: 20, avg_engagement: 0.035, comment_rate: 0.12, like_rate: 0.45, share_rate: 0.12 }
      ],
      worst_hours: [1, 2, 3, 4, 5],
      day_of_week_patterns: {
        0: { best_hours: [10, 14, 19], engagement_multiplier: 0.8 }, // Sunday
        1: { best_hours: [8, 12, 18], engagement_multiplier: 1.1 }, // Monday
        2: { best_hours: [8, 12, 18], engagement_multiplier: 1.2 }, // Tuesday
        3: { best_hours: [8, 12, 18], engagement_multiplier: 1.15 }, // Wednesday
        4: { best_hours: [8, 12, 18], engagement_multiplier: 1.1 }, // Thursday
        5: { best_hours: [8, 13, 17], engagement_multiplier: 0.9 }, // Friday
        6: { best_hours: [9, 14, 19], engagement_multiplier: 0.85 } // Saturday
      },
      confidence_score: 0.6
    };
  }

  /**
   * 📈 Get detailed timing analysis for debugging
   */
  public async getTimingAnalysisReport(): Promise<any> {
    const insights = await this.analyzeTimingPatterns();
    const currentHour = new Date().getHours();
    const currentDay = new Date().getDay();
    const score = this.calculateCurrentWindowScore(currentHour, currentDay, insights);

    return {
      current_time: `${currentHour}:00`,
      current_score: score,
      optimal_hours: insights.optimal_hours,
      peak_windows: insights.peak_engagement_windows,
      worst_hours: insights.worst_hours,
      confidence: insights.confidence_score,
      recommendation: score > 0.7 ? 'POST_NOW' : score > 0.5 ? 'GOOD_TIME' : 'WAIT_FOR_BETTER'
    };
  }
}
