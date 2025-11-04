/**
 * ⏰ TIMING OPTIMIZER
 * 
 * Learns optimal posting times for replies based on performance data.
 * Tracks engagement by hour/day to find best times for each account.
 */

import { getSupabaseClient } from '../db';

export interface TimingPerformance {
  hour: number; // 0-23
  day_of_week: number; // 0-6 (Sunday-Saturday)
  avg_followers_gained: number;
  avg_engagement: number;
  sample_size: number;
  confidence: number;
}

export interface OptimalTiming {
  best_hours: number[]; // Top 5 hours
  best_days: number[]; // Top 3 days
  worst_hours: number[]; // Bottom 3 hours to avoid
  account_specific?: Map<string, number[]>; // Account-specific optimal hours
}

export class TimingOptimizer {
  private static instance: TimingOptimizer;
  private supabase = getSupabaseClient();
  
  // Cache
  private optimalTiming: OptimalTiming | null = null;
  private lastCacheUpdate = 0;
  private cacheExpiry = 60 * 60 * 1000; // 1 hour

  private constructor() {}

  public static getInstance(): TimingOptimizer {
    if (!TimingOptimizer.instance) {
      TimingOptimizer.instance = new TimingOptimizer();
    }
    return TimingOptimizer.instance;
  }

  /**
   * Analyze timing performance from historical data
   */
  public async analyzeTimingPerformance(): Promise<TimingPerformance[]> {
    console.log('[TIMING] ⏰ Analyzing optimal reply timing...');

    // Get all reply conversions with timestamps
    const { data: conversions } = await this.supabase
      .from('reply_conversions')
      .select('replied_at, followers_gained, reply_likes')
      .not('replied_at', 'is', null)
      .not('measured_at', 'is', null)
      .order('replied_at', { ascending: false })
      .limit(1000); // Last 1000 replies

    if (!conversions || conversions.length === 0) {
      console.log('[TIMING] No data available for analysis');
      return [];
    }

    // Group by hour and day of week
    const hourlyStats = new Map<string, {
      followers: number[];
      engagement: number[];
    }>();

    conversions.forEach(conv => {
      const date = new Date(conv.replied_at);
      const hour = date.getHours();
      const dayOfWeek = date.getDay();
      const key = `${hour}_${dayOfWeek}`;

      if (!hourlyStats.has(key)) {
        hourlyStats.set(key, { followers: [], engagement: [] });
      }

      const stats = hourlyStats.get(key)!;
      stats.followers.push(conv.followers_gained || 0);
      stats.engagement.push(conv.reply_likes || 0);
    });

    // Calculate performance for each hour/day combination
    const performance: TimingPerformance[] = [];

    for (const [key, stats] of hourlyStats.entries()) {
      const [hour, dayOfWeek] = key.split('_').map(Number);

      const avgFollowers = stats.followers.reduce((sum, f) => sum + f, 0) / stats.followers.length;
      const avgEngagement = stats.engagement.reduce((sum, e) => sum + e, 0) / stats.engagement.length;

      performance.push({
        hour,
        day_of_week: dayOfWeek,
        avg_followers_gained: avgFollowers,
        avg_engagement: avgEngagement,
        sample_size: stats.followers.length,
        confidence: Math.min(0.95, stats.followers.length / 20) // Higher confidence with more samples
      });
    }

    // Sort by avg followers gained
    performance.sort((a, b) => b.avg_followers_gained - a.avg_followers_gained);

    console.log(`[TIMING] Analyzed ${performance.length} hour/day combinations`);
    
    // Log top 5 best times
    console.log('[TIMING] Top 5 best times:');
    performance.slice(0, 5).forEach((p, i) => {
      const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][p.day_of_week];
      console.log(`[TIMING]   ${i + 1}. ${dayName} ${p.hour}:00 - ${p.avg_followers_gained.toFixed(2)} followers/reply (n=${p.sample_size})`);
    });

    return performance;
  }

  /**
   * Get optimal timing recommendations
   */
  public async getOptimalTiming(): Promise<OptimalTiming> {
    await this.ensureCacheValid();

    if (!this.optimalTiming) {
      const performance = await this.analyzeTimingPerformance();
      
      if (performance.length === 0) {
        // No data yet - return reasonable defaults
        return {
          best_hours: [9, 12, 15, 18, 21], // 9am, 12pm, 3pm, 6pm, 9pm
          best_days: [1, 2, 3], // Mon, Tue, Wed
          worst_hours: [2, 3, 4] // Late night/early morning
        };
      }

      // Filter for high-confidence data points
      const confident = performance.filter(p => p.sample_size >= 5);

      // Get best hours (aggregate across days)
      const hourlyPerf = new Map<number, number[]>();
      confident.forEach(p => {
        if (!hourlyPerf.has(p.hour)) {
          hourlyPerf.set(p.hour, []);
        }
        hourlyPerf.get(p.hour)!.push(p.avg_followers_gained);
      });

      const hourAvgs = Array.from(hourlyPerf.entries())
        .map(([hour, followers]) => ({
          hour,
          avg: followers.reduce((sum, f) => sum + f, 0) / followers.length
        }))
        .sort((a, b) => b.avg - a.avg);

      const best_hours = hourAvgs.slice(0, 5).map(h => h.hour);
      const worst_hours = hourAvgs.slice(-3).map(h => h.hour);

      // Get best days (aggregate across hours)
      const dailyPerf = new Map<number, number[]>();
      confident.forEach(p => {
        if (!dailyPerf.has(p.day_of_week)) {
          dailyPerf.set(p.day_of_week, []);
        }
        dailyPerf.get(p.day_of_week)!.push(p.avg_followers_gained);
      });

      const dayAvgs = Array.from(dailyPerf.entries())
        .map(([day, followers]) => ({
          day,
          avg: followers.reduce((sum, f) => sum + f, 0) / followers.length
        }))
        .sort((a, b) => b.avg - a.avg);

      const best_days = dayAvgs.slice(0, 3).map(d => d.day);

      this.optimalTiming = {
        best_hours,
        best_days,
        worst_hours
      };

      this.lastCacheUpdate = Date.now();
    }

    return this.optimalTiming;
  }

  /**
   * Get optimal hour for posting right now
   */
  public async getOptimalHourNow(): Promise<number> {
    const timing = await this.getOptimalTiming();
    const currentHour = new Date().getHours();
    const currentDay = new Date().getDay();

    // If current hour is in best hours, use it
    if (timing.best_hours.includes(currentHour)) {
      return currentHour;
    }

    // Find next best hour
    const nextBestHours = timing.best_hours.filter(h => h > currentHour);
    if (nextBestHours.length > 0) {
      return nextBestHours[0];
    }

    // If no hours later today, return first best hour tomorrow
    return timing.best_hours[0];
  }

  /**
   * Check if current time is optimal for posting
   */
  public async isOptimalTimeNow(): Promise<{
    is_optimal: boolean;
    score: number; // 0-1, where 1 is best
    reason: string;
  }> {
    const timing = await this.getOptimalTiming();
    const currentHour = new Date().getHours();
    const currentDay = new Date().getDay();

    // Check if in worst hours
    if (timing.worst_hours.includes(currentHour)) {
      return {
        is_optimal: false,
        score: 0.2,
        reason: `Hour ${currentHour} is in worst performing hours`
      };
    }

    // Check if in best hours
    if (timing.best_hours.includes(currentHour)) {
      // Also check day
      if (timing.best_days.includes(currentDay)) {
        return {
          is_optimal: true,
          score: 1.0,
          reason: 'Both hour and day are optimal'
        };
      }

      return {
        is_optimal: true,
        score: 0.8,
        reason: 'Hour is optimal (day is average)'
      };
    }

    // Average time
    return {
      is_optimal: false,
      score: 0.5,
      reason: 'Average performance time'
    };
  }

  /**
   * Get optimal delay (in minutes) to wait for better timing
   */
  public async getOptimalDelay(): Promise<number> {
    const timing = await this.getOptimalTiming();
    const currentHour = new Date().getHours();
    const currentMinute = new Date().getMinutes();

    // If current hour is optimal, post now
    if (timing.best_hours.includes(currentHour)) {
      return 0;
    }

    // Find next optimal hour
    const nextOptimalHour = timing.best_hours.find(h => h > currentHour) || timing.best_hours[0];

    // Calculate delay in minutes
    let delay;
    if (nextOptimalHour > currentHour) {
      delay = (nextOptimalHour - currentHour) * 60 - currentMinute;
    } else {
      // Next day
      delay = (24 - currentHour + nextOptimalHour) * 60 - currentMinute;
    }

    // Cap delay at 4 hours (don't wait too long)
    return Math.min(delay, 4 * 60);
  }

  /**
   * Ensure cache is valid
   */
  private async ensureCacheValid(): Promise<void> {
    if (Date.now() - this.lastCacheUpdate > this.cacheExpiry) {
      this.optimalTiming = null; // Force recalculation
    }
  }

  /**
   * Print timing analysis to console
   */
  public async printAnalysis(): Promise<void> {
    const performance = await this.analyzeTimingPerformance();
    const timing = await this.getOptimalTiming();

    console.log('\n' + '═'.repeat(80));
    console.log('⏰ TIMING OPTIMIZATION ANALYSIS');
    console.log('═'.repeat(80));

    console.log('\n📊 BEST HOURS TO POST:');
    timing.best_hours.forEach((hour, i) => {
      const perf = performance.find(p => p.hour === hour);
      console.log(`   ${i + 1}. ${hour}:00 - ${perf?.avg_followers_gained.toFixed(2) || 'N/A'} avg followers/reply`);
    });

    console.log('\n📅 BEST DAYS TO POST:');
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    timing.best_days.forEach((day, i) => {
      console.log(`   ${i + 1}. ${dayNames[day]}`);
    });

    console.log('\n❌ HOURS TO AVOID:');
    timing.worst_hours.forEach((hour, i) => {
      const perf = performance.find(p => p.hour === hour);
      console.log(`   ${i + 1}. ${hour}:00 - ${perf?.avg_followers_gained.toFixed(2) || 'N/A'} avg followers/reply`);
    });

    const now = await this.isOptimalTimeNow();
    console.log(`\n🕐 CURRENT TIME (${new Date().getHours()}:00):`);
    console.log(`   Optimal: ${now.is_optimal ? 'YES ✅' : 'NO ⚠️'}`);
    console.log(`   Score: ${(now.score * 100).toFixed(0)}%`);
    console.log(`   ${now.reason}`);

    if (!now.is_optimal) {
      const delay = await this.getOptimalDelay();
      console.log(`   Recommendation: Wait ${delay} minutes for optimal timing`);
    }

    console.log('\n' + '═'.repeat(80) + '\n');
  }
}

// Export singleton
export const timingOptimizer = TimingOptimizer.getInstance();

