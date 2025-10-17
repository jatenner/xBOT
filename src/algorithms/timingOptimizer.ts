/**
 * ⏰ PERSONALIZED TIMING OPTIMIZER
 * 
 * Learns when YOUR specific followers are most active
 * Not generic "best times" - learns YOUR audience
 * 
 * Budget: ~$0.05/day (analysis only, no AI calls)
 */

import { getSupabaseClient } from '../db/index';

export interface TimingPattern {
  hour: number;           // 0-23
  day_of_week: number;    // 0-6 (Sunday=0)
  avg_impressions: number;
  avg_engagement: number;
  avg_followers_gained: number;
  success_rate: number;   // 0-1
  post_count: number;
}

export interface OptimalSchedule {
  best_hours: number[];        // [14, 18, 20]
  worst_hours: number[];       // [3, 4, 5]
  best_days: number[];         // [1, 3, 5] (Mon, Wed, Fri)
  peak_window: string;         // "2-4 PM EST"
  recommendations: string[];
}

export class TimingOptimizer {
  private static instance: TimingOptimizer;
  private supabase = getSupabaseClient();
  private cachedSchedule: OptimalSchedule | null = null;
  private cacheTimestamp: number = 0;
  private CACHE_TTL_MS = 86400 * 1000; // 24 hours

  private constructor() {}

  public static getInstance(): TimingOptimizer {
    if (!TimingOptimizer.instance) {
      TimingOptimizer.instance = new TimingOptimizer();
    }
    return TimingOptimizer.instance;
  }

  /**
   * Analyze YOUR followers' activity patterns
   */
  async analyzeTimingPatterns(): Promise<TimingPattern[]> {
    console.log('[TIMING] ⏰ Analyzing YOUR followers\' activity patterns...');

    try {
      // Get last 30 days of posts with performance data
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: posts } = await this.supabase
        .from('content_decisions')
        .select('created_at, actual_performance')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .not('actual_performance', 'is', null);

      if (!posts || posts.length < 10) {
        console.log('[TIMING] ⚠️ Not enough data yet, using defaults');
        return this.getDefaultPatterns();
      }

      // Group by hour and day of week
      const patterns: Record<string, {
        impressions: number[];
        engagement: number[];
        followers: number[];
      }> = {};

      posts.forEach(post => {
        const date = new Date(String(post.created_at));
        const hour = date.getHours();
        const dayOfWeek = date.getDay();
        const key = `${hour}-${dayOfWeek}`;

        if (!patterns[key]) {
          patterns[key] = {
            impressions: [],
            engagement: [],
            followers: []
          };
        }

        const perf = post.actual_performance as any || {};
        patterns[key].impressions.push(Number(perf.views) || Number(perf.impressions) || 0);
        patterns[key].engagement.push((Number(perf.likes) || 0) + (Number(perf.retweets) || 0) + (Number(perf.replies) || 0));
        patterns[key].followers.push(Number(perf.followers_gained) || 0);
      });

      // Calculate averages for each time slot
      const timingPatterns: TimingPattern[] = [];

      for (const [key, data] of Object.entries(patterns)) {
        const [hourStr, dayStr] = key.split('-');
        const hour = parseInt(hourStr);
        const dayOfWeek = parseInt(dayStr);

        const avgImpressions = data.impressions.reduce((a, b) => a + b, 0) / data.impressions.length;
        const avgEngagement = data.engagement.reduce((a, b) => a + b, 0) / data.engagement.length;
        const avgFollowers = data.followers.reduce((a, b) => a + b, 0) / data.followers.length;

        // Success rate = how often this time slot performs above average
        const overallAvgFollowers = posts
          .reduce((sum, p) => sum + ((p.actual_performance as any)?.followers_gained || 0), 0) / posts.length;
        
        const successCount = data.followers.filter(f => f > overallAvgFollowers).length;
        const successRate = successCount / data.followers.length;

        timingPatterns.push({
          hour,
          day_of_week: dayOfWeek,
          avg_impressions: avgImpressions,
          avg_engagement: avgEngagement,
          avg_followers_gained: avgFollowers,
          success_rate: successRate,
          post_count: data.impressions.length
        });
      }

      // Sort by followers gained (best performance)
      timingPatterns.sort((a, b) => b.avg_followers_gained - a.avg_followers_gained);

      console.log(`[TIMING] ✅ Analyzed ${timingPatterns.length} time slots`);
      
      return timingPatterns;

    } catch (error: any) {
      console.error('[TIMING] ❌ Error analyzing patterns:', error.message);
      return this.getDefaultPatterns();
    }
  }

  /**
   * Get optimal posting schedule based on YOUR data
   */
  async getOptimalSchedule(forceRefresh: boolean = false): Promise<OptimalSchedule> {
    // Check cache
    if (!forceRefresh && this.cachedSchedule && (Date.now() - this.cacheTimestamp) < this.CACHE_TTL_MS) {
      console.log('[TIMING] ✅ Using cached schedule');
      return this.cachedSchedule;
    }

    console.log('[TIMING] 🔄 Calculating optimal schedule...');

    const patterns = await this.analyzeTimingPatterns();

    if (patterns.length === 0) {
      return this.getDefaultSchedule();
    }

    // Aggregate by hour (across all days)
    const hourlyStats: Record<number, {
      impressions: number[];
      followers: number[];
      success_rate: number[];
    }> = {};

    patterns.forEach(p => {
      if (!hourlyStats[p.hour]) {
        hourlyStats[p.hour] = {
          impressions: [],
          followers: [],
          success_rate: []
        };
      }
      hourlyStats[p.hour].impressions.push(p.avg_impressions);
      hourlyStats[p.hour].followers.push(p.avg_followers_gained);
      hourlyStats[p.hour].success_rate.push(p.success_rate);
    });

    // Calculate best and worst hours
    const hourScores: Array<{ hour: number; score: number }> = [];

    for (const [hourStr, stats] of Object.entries(hourlyStats)) {
      const hour = parseInt(hourStr);
      const avgFollowers = stats.followers.reduce((a, b) => a + b, 0) / stats.followers.length;
      const avgSuccess = stats.success_rate.reduce((a, b) => a + b, 0) / stats.success_rate.length;
      
      // Combined score (followers * success rate)
      const score = avgFollowers * avgSuccess;
      
      hourScores.push({ hour, score });
    }

    hourScores.sort((a, b) => b.score - a.score);

    const bestHours = hourScores.slice(0, 3).map(h => h.hour);
    const worstHours = hourScores.slice(-3).map(h => h.hour);

    // Aggregate by day of week
    const daylyStats: Record<number, number[]> = {};
    
    patterns.forEach(p => {
      if (!daylyStats[p.day_of_week]) {
        daylyStats[p.day_of_week] = [];
      }
      daylyStats[p.day_of_week].push(p.avg_followers_gained);
    });

    const dayScores: Array<{ day: number; score: number }> = [];
    
    for (const [dayStr, followers] of Object.entries(daylyStats)) {
      const day = parseInt(dayStr);
      const avgFollowers = followers.reduce((a, b) => a + b, 0) / followers.length;
      dayScores.push({ day, score: avgFollowers });
    }

    dayScores.sort((a, b) => b.score - a.score);
    const bestDays = dayScores.slice(0, 3).map(d => d.day);

    // Determine peak window
    const peakHour = bestHours[0];
    const peakWindow = `${peakHour}:00-${(peakHour + 2) % 24}:00`;

    const schedule: OptimalSchedule = {
      best_hours: bestHours,
      worst_hours: worstHours,
      best_days: bestDays,
      peak_window: peakWindow,
      recommendations: [
        `Post most content during ${peakWindow} (YOUR peak window)`,
        `Avoid posting at ${worstHours.map(h => `${h}:00`).join(', ')} (YOUR dead zones)`,
        `Best days: ${bestDays.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')}`,
        `This is based on YOUR followers' activity (not generic advice)`
      ]
    };

    // Cache result
    this.cachedSchedule = schedule;
    this.cacheTimestamp = Date.now();

    console.log('[TIMING] ✅ Optimal schedule calculated');
    console.log(`[TIMING] 🎯 Best hours: ${bestHours.join(', ')}`);
    console.log(`[TIMING] 🎯 Peak window: ${peakWindow}`);

    return schedule;
  }

  /**
   * Is this a good time to post?
   */
  async isGoodTimeToPost(scheduledTime?: Date): Promise<{
    is_good: boolean;
    score: number;
    reason: string;
  }> {
    const time = scheduledTime || new Date();
    const hour = time.getHours();
    const dayOfWeek = time.getDay();

    const schedule = await this.getOptimalSchedule();

    const isBestHour = schedule.best_hours.includes(hour);
    const isWorstHour = schedule.worst_hours.includes(hour);
    const isBestDay = schedule.best_days.includes(dayOfWeek);

    let score = 0.5; // Base score
    let reason = '';

    if (isBestHour) {
      score += 0.3;
      reason = '✅ Peak hour for YOUR followers';
    } else if (isWorstHour) {
      score -= 0.4;
      reason = '❌ Dead zone for YOUR followers';
    } else {
      reason = '⚠️ Medium time for YOUR followers';
    }

    if (isBestDay) {
      score += 0.2;
    }

    score = Math.max(0, Math.min(1, score));

    return {
      is_good: score >= 0.6,
      score,
      reason
    };
  }

  /**
   * Get recommended posting time (next optimal slot)
   */
  async getRecommendedTime(): Promise<Date> {
    const schedule = await this.getOptimalSchedule();
    const now = new Date();
    const currentHour = now.getHours();

    // Find next best hour
    const nextBestHour = schedule.best_hours.find(h => h > currentHour) || schedule.best_hours[0];

    const recommended = new Date();
    recommended.setHours(nextBestHour, 0, 0, 0);

    // If the hour is in the past today, move to tomorrow
    if (recommended <= now) {
      recommended.setDate(recommended.getDate() + 1);
    }

    return recommended;
  }

  /**
   * Default patterns when no data
   */
  private getDefaultPatterns(): TimingPattern[] {
    return [
      { hour: 14, day_of_week: 1, avg_impressions: 500, avg_engagement: 25, avg_followers_gained: 2, success_rate: 0.7, post_count: 5 },
      { hour: 18, day_of_week: 3, avg_impressions: 600, avg_engagement: 30, avg_followers_gained: 3, success_rate: 0.8, post_count: 5 },
      { hour: 20, day_of_week: 5, avg_impressions: 550, avg_engagement: 28, avg_followers_gained: 2.5, success_rate: 0.75, post_count: 5 }
    ];
  }

  /**
   * Default schedule when no data
   */
  private getDefaultSchedule(): OptimalSchedule {
    return {
      best_hours: [14, 18, 20],
      worst_hours: [3, 4, 5],
      best_days: [1, 3, 5],
      peak_window: '2-4 PM',
      recommendations: [
        'Post during 2-4 PM (standard peak)',
        'Avoid 3-5 AM (dead zone)',
        'Best days: Mon, Wed, Fri',
        'Note: This will personalize to YOUR followers once we have data'
      ]
    };
  }
}

export const getTimingOptimizer = () => TimingOptimizer.getInstance();

