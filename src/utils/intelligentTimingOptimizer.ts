/**
 * ⏰ INTELLIGENT TIMING OPTIMIZER
 * Learns optimal posting times from actual engagement data
 */

import { supabaseClient } from './supabaseClient';

export interface TimingInsights {
  optimal_posting_hours: number[];
  optimal_reply_hours: number[];
  peak_engagement_windows: { start: number; end: number; score: number }[];
  follower_growth_by_hour: { [hour: number]: number };
  engagement_patterns: {
    weekday_vs_weekend: { weekday: number; weekend: number };
    morning_vs_evening: { morning: number; evening: number };
    hourly_performance: { [hour: number]: number };
  };
}

export class IntelligentTimingOptimizer {
  private static instance: IntelligentTimingOptimizer;
  
  static getInstance(): IntelligentTimingOptimizer {
    if (!this.instance) {
      this.instance = new IntelligentTimingOptimizer();
    }
    return this.instance;
  }

  /**
   * 📊 Analyze timing performance from learning data
   */
  async analyzeOptimalTiming(): Promise<TimingInsights | null> {
    try {
      if (!supabaseClient.supabase) return null;

      // Get posts from last 30 days with performance data
      const { data: posts } = await supabaseClient.supabase
        .from('learning_posts')
        .select('*')
        .eq('was_posted', true)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      if (!posts || posts.length < 10) {
        console.log('📊 Not enough data for timing analysis (need 10+ posts)');
        return null;
      }

      const insights = this.calculateTimingInsights(posts);
      
      console.log('⏰ Timing Analysis Complete:', {
        total_posts_analyzed: posts.length,
        optimal_hours: insights.optimal_posting_hours,
        peak_windows: insights.peak_engagement_windows.length
      });

      return insights;

    } catch (error) {
      console.error('❌ Error analyzing timing:', error);
      return null;
    }
  }

  /**
   * 🧮 Calculate insights from post data
   */
  private calculateTimingInsights(posts: any[]): TimingInsights {
    const hourlyPerformance: { [hour: number]: { total: number; engagement: number; followers: number } } = {};
    
    // Initialize hourly data
    for (let hour = 0; hour < 24; hour++) {
      hourlyPerformance[hour] = { total: 0, engagement: 0, followers: 0 };
    }

    // Analyze each post
    posts.forEach(post => {
      const hour = new Date(post.created_at).getHours();
      const engagement = (post.likes_count || 0) + (post.retweets_count || 0) + (post.replies_count || 0);
      const followers = post.converted_followers || 0;
      
      hourlyPerformance[hour].total++;
      hourlyPerformance[hour].engagement += engagement;
      hourlyPerformance[hour].followers += followers;
    });

    // Calculate averages and find optimal hours
    const hourlyAvgEngagement: { [hour: number]: number } = {};
    const hourlyAvgFollowers: { [hour: number]: number } = {};
    
    Object.entries(hourlyPerformance).forEach(([hour, data]) => {
      const hourNum = parseInt(hour);
      hourlyAvgEngagement[hourNum] = data.total > 0 ? data.engagement / data.total : 0;
      hourlyAvgFollowers[hourNum] = data.total > 0 ? data.followers / data.total : 0;
    });

    // Find top performing hours
    const engagementHours = Object.entries(hourlyAvgEngagement)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 6)
      .map(([hour]) => parseInt(hour));

    const followerHours = Object.entries(hourlyAvgFollowers)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 4)
      .map(([hour]) => parseInt(hour));

    // Find peak engagement windows (consecutive high-performing hours)
    const peakWindows = this.findPeakWindows(hourlyAvgEngagement);

    // Calculate weekday vs weekend and morning vs evening performance
    const patterns = this.calculateEngagementPatterns(posts);

    return {
      optimal_posting_hours: engagementHours,
      optimal_reply_hours: followerHours,
      peak_engagement_windows: peakWindows,
      follower_growth_by_hour: hourlyAvgFollowers,
      engagement_patterns: patterns
    };
  }

  /**
   * 🔍 Find consecutive high-performing hour windows
   */
  private findPeakWindows(hourlyEngagement: { [hour: number]: number }): { start: number; end: number; score: number }[] {
    const windows = [];
    const threshold = Object.values(hourlyEngagement).reduce((a, b) => a + b, 0) / 24 * 1.2; // 20% above average
    
    let windowStart = -1;
    let windowScore = 0;
    
    for (let hour = 0; hour < 24; hour++) {
      if (hourlyEngagement[hour] > threshold) {
        if (windowStart === -1) {
          windowStart = hour;
          windowScore = hourlyEngagement[hour];
        } else {
          windowScore += hourlyEngagement[hour];
        }
      } else {
        if (windowStart !== -1) {
          windows.push({
            start: windowStart,
            end: hour - 1,
            score: windowScore / (hour - windowStart)
          });
          windowStart = -1;
          windowScore = 0;
        }
      }
    }
    
    return windows.sort((a, b) => b.score - a.score).slice(0, 3);
  }

  /**
   * 📈 Calculate engagement patterns
   */
  private calculateEngagementPatterns(posts: any[]): any {
    let weekdayEngagement = 0, weekendEngagement = 0;
    let morningEngagement = 0, eveningEngagement = 0;
    let weekdayCount = 0, weekendCount = 0;
    let morningCount = 0, eveningCount = 0;
    
    posts.forEach(post => {
      const date = new Date(post.created_at);
      const hour = date.getHours();
      const dayOfWeek = date.getDay();
      const engagement = (post.likes_count || 0) + (post.retweets_count || 0) + (post.replies_count || 0);
      
      if (dayOfWeek === 0 || dayOfWeek === 6) { // Weekend
        weekendEngagement += engagement;
        weekendCount++;
      } else { // Weekday
        weekdayEngagement += engagement;
        weekdayCount++;
      }
      
      if (hour >= 6 && hour < 12) { // Morning
        morningEngagement += engagement;
        morningCount++;
      } else if (hour >= 18 && hour < 24) { // Evening
        eveningEngagement += engagement;
        eveningCount++;
      }
    });
    
    return {
      weekday_vs_weekend: {
        weekday: weekdayCount > 0 ? weekdayEngagement / weekdayCount : 0,
        weekend: weekendCount > 0 ? weekendEngagement / weekendCount : 0
      },
      morning_vs_evening: {
        morning: morningCount > 0 ? morningEngagement / morningCount : 0,
        evening: eveningCount > 0 ? eveningEngagement / eveningCount : 0
      },
      hourly_performance: Object.fromEntries(
        Array.from({length: 24}, (_, hour) => {
          const hourPosts = posts.filter(p => new Date(p.created_at).getHours() === hour);
          const avgEngagement = hourPosts.length > 0 
            ? hourPosts.reduce((sum, p) => sum + ((p.likes_count || 0) + (p.retweets_count || 0) + (p.replies_count || 0)), 0) / hourPosts.length
            : 0;
          return [hour, avgEngagement];
        })
      )
    };
  }
}