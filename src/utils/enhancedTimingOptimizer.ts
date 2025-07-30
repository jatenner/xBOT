/**
 * ⏰ ENHANCED TIMING OPTIMIZER V2.0
 * Learns optimal posting times with confidence intervals and Bayesian inference
 */

import { supabaseClient } from './supabaseClient';

export interface TimingInsights {
  optimal_posting_hours: number[];
  optimal_reply_hours: number[];
  peak_engagement_windows: { start: number; end: number; score: number; confidence: number }[];
  confidence_by_hour: { [hour: number]: number };
  engagement_patterns: {
    weekday_vs_weekend: { weekday: number; weekend: number };
    morning_vs_evening: { morning: number; evening: number };
    hourly_performance: { [hour: number]: number };
  };
}

export class EnhancedTimingOptimizer {
  private static instance: EnhancedTimingOptimizer;
  
  static getInstance(): EnhancedTimingOptimizer {
    if (!this.instance) {
      this.instance = new EnhancedTimingOptimizer();
    }
    return this.instance;
  }

  /**
   * 📊 Analyze optimal timing with confidence intervals
   */
  async analyzeOptimalTiming(): Promise<TimingInsights | null> {
    try {
      console.log('⏰ === ENHANCED TIMING ANALYSIS ===');

      // Get timing statistics from database
      const { data: timingStats } = await supabaseClient.supabase
        .from('enhanced_timing_stats')
        .select('*')
        .gte('total_posts', 3) // Minimum sample size
        .order('avg_engagement_rate', { ascending: false });

      if (!timingStats || timingStats.length === 0) {
        console.log('📊 No timing data available yet');
        return null;
      }

      const insights = this.calculateTimingInsights(timingStats);
      
      console.log('✅ Timing analysis complete:', {
        optimal_hours_count: insights.optimal_posting_hours.length,
        peak_windows_count: insights.peak_engagement_windows.length,
        total_hours_analyzed: timingStats.length
      });

      return insights;

    } catch (error) {
      console.error('❌ Enhanced timing analysis failed:', error);
      return null;
    }
  }

  /**
   * 🧮 Calculate enhanced timing insights
   */
  private calculateTimingInsights(stats: any[]): TimingInsights {
    // Find top performing hours with high confidence
    const highConfidenceHours = stats
      .filter(stat => stat.confidence_score >= 0.7)
      .sort((a, b) => b.avg_engagement_rate - a.avg_engagement_rate)
      .slice(0, 8)
      .map(stat => stat.hour_of_day);

    // Find peak engagement windows (consecutive high-performing hours)
    const peakWindows = this.findPeakWindows(stats);

    // Build confidence mapping
    const confidenceByHour: { [hour: number]: number } = {};
    stats.forEach(stat => {
      confidenceByHour[stat.hour_of_day] = stat.confidence_score;
    });

    // Calculate engagement patterns
    const patterns = this.calculateEngagementPatterns(stats);

    return {
      optimal_posting_hours: highConfidenceHours,
      optimal_reply_hours: highConfidenceHours.slice(0, 4), // Top 4 for replies
      peak_engagement_windows: peakWindows,
      confidence_by_hour: confidenceByHour,
      engagement_patterns: patterns
    };
  }

  /**
   * 🔍 Find consecutive high-performing hour windows
   */
  private findPeakWindows(stats: any[]): Array<{ start: number; end: number; score: number; confidence: number }> {
    const windows = [];
    const hourlyData: { [hour: number]: any } = {};
    
    stats.forEach(stat => {
      hourlyData[stat.hour_of_day] = stat;
    });

    let windowStart = -1;
    let windowScore = 0;
    let windowConfidence = 0;
    let windowCount = 0;

    for (let hour = 0; hour < 24; hour++) {
      const stat = hourlyData[hour];
      
      if (stat && stat.avg_engagement_rate > 0.02 && stat.confidence_score >= 0.7) {
        if (windowStart === -1) {
          windowStart = hour;
          windowScore = stat.avg_engagement_rate;
          windowConfidence = stat.confidence_score;
          windowCount = 1;
        } else {
          windowScore += stat.avg_engagement_rate;
          windowConfidence += stat.confidence_score;
          windowCount++;
        }
      } else {
        if (windowStart !== -1 && windowCount >= 2) {
          windows.push({
            start: windowStart,
            end: hour - 1,
            score: windowScore / windowCount,
            confidence: windowConfidence / windowCount
          });
        }
        windowStart = -1;
        windowScore = 0;
        windowConfidence = 0;
        windowCount = 0;
      }
    }

    return windows
      .sort((a, b) => (b.score * b.confidence) - (a.score * a.confidence))
      .slice(0, 3);
  }

  /**
   * 📈 Calculate engagement patterns
   */
  private calculateEngagementPatterns(stats: any[]): any {
    let weekdayScore = 0, weekendScore = 0;
    let morningScore = 0, eveningScore = 0;
    let weekdayCount = 0, weekendCount = 0;
    let morningCount = 0, eveningCount = 0;

    const hourlyPerformance: { [hour: number]: number } = {};

    stats.forEach(stat => {
      const hour = stat.hour_of_day;
      const score = stat.avg_engagement_rate;
      
      hourlyPerformance[hour] = score;
      
      if (stat.day_of_week === 0 || stat.day_of_week === 6) { // Weekend
        weekendScore += score;
        weekendCount++;
      } else { // Weekday
        weekdayScore += score;
        weekdayCount++;
      }
      
      if (hour >= 6 && hour < 12) { // Morning
        morningScore += score;
        morningCount++;
      } else if (hour >= 18 && hour < 24) { // Evening
        eveningScore += score;
        eveningCount++;
      }
    });

    return {
      weekday_vs_weekend: {
        weekday: weekdayCount > 0 ? weekdayScore / weekdayCount : 0,
        weekend: weekendCount > 0 ? weekendScore / weekendCount : 0
      },
      morning_vs_evening: {
        morning: morningCount > 0 ? morningScore / morningCount : 0,
        evening: eveningCount > 0 ? eveningScore / eveningCount : 0
      },
      hourly_performance: hourlyPerformance
    };
  }

  /**
   * 🕒 Update timing statistics for a post
   */
  async updateTimingStats(
    hour: number,
    dayOfWeek: number,
    engagement: number,
    impressions: number = 0,
    followersGained: number = 0
  ): Promise<void> {
    try {
      console.log(`🕒 Updating timing stats: Hour ${hour}, Day ${dayOfWeek}, Engagement ${engagement}`);

      const { error } = await supabaseClient.supabase
        .rpc('update_enhanced_timing_stats', {
          p_hour: hour,
          p_day_of_week: dayOfWeek,
          p_engagement: engagement,
          p_impressions: impressions,
          p_followers_gained: followersGained
        });

      if (error) {
        console.error('❌ Failed to update timing stats:', error);
      } else {
        console.log('✅ Timing stats updated successfully');
      }

    } catch (error) {
      console.error('❌ Timing stats update error:', error);
    }
  }

  /**
   * 🎯 Get optimal posting windows
   */
  async getOptimalPostingWindows(confidenceThreshold: number = 0.7): Promise<any[]> {
    try {
      const { data, error } = await supabaseClient.supabase
        .rpc('get_optimal_posting_windows', {
          confidence_threshold: confidenceThreshold
        });

      if (error) {
        console.error('❌ Failed to get optimal windows:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('❌ Optimal windows query error:', error);
      return [];
    }
  }
}

export const enhancedTimingOptimizer = EnhancedTimingOptimizer.getInstance();