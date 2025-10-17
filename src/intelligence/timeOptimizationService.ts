/**
 * ⏰ TIME OPTIMIZATION SERVICE
 * 
 * Analyzes optimal posting times based on historical performance
 * Integrates with scheduler - pure data analysis, no job changes
 */

import { getSupabaseClient } from '../db';

export interface TimePerformance {
  hour: number;
  avgImpressions: number;
  avgLikes: number;
  avgFollowers: number;
  totalPosts: number;
}

export class TimeOptimizationService {
  private static instance: TimeOptimizationService;
  
  private constructor() {}
  
  static getInstance(): TimeOptimizationService {
    if (!TimeOptimizationService.instance) {
      TimeOptimizationService.instance = new TimeOptimizationService();
    }
    return TimeOptimizationService.instance;
  }

  /**
   * Get hourly performance breakdown
   */
  async getHourlyPerformance(): Promise<Record<number, TimePerformance>> {
    const supabase = getSupabaseClient();
    
    const { data } = await supabase
      .from('outcomes')
      .select('post_hour, impressions, likes, followers_gained')
      .not('post_hour', 'is', null);
    
    // Initialize all hours
    const performance: Record<number, TimePerformance> = {};
    for (let hour = 0; hour < 24; hour++) {
      performance[hour] = {
        hour,
        avgImpressions: 0,
        avgLikes: 0,
        avgFollowers: 0,
        totalPosts: 0
      };
    }
    
    // Aggregate data
    for (const outcome of data || []) {
      const hour = Number(outcome.post_hour);
      if (hour < 0 || hour > 23 || isNaN(hour)) continue;
      
      performance[hour].totalPosts++;
      performance[hour].avgImpressions += Number(outcome.impressions) || 0;
      performance[hour].avgLikes += Number(outcome.likes) || 0;
      performance[hour].avgFollowers += Number(outcome.followers_gained) || 0;
    }
    
    // Calculate averages
    for (const hourKey in performance) {
      const hourNum = Number(hourKey);
      const p = performance[hourNum];
      if (p && p.totalPosts > 0) {
        p.avgImpressions = Math.round(p.avgImpressions / p.totalPosts);
        p.avgLikes = Math.round(p.avgLikes / p.totalPosts);
        p.avgFollowers = p.avgFollowers / p.totalPosts;
      }
    }
    
    return performance;
  }

  /**
   * Get optimal posting hours (sorted by follower gain)
   */
  async getOptimalPostingHours(params: {
    topN?: number;
    minPosts?: number;
  } = {}): Promise<number[]> {
    const topN = params.topN || 3;
    const minPosts = params.minPosts || 3;
    
    const performance = await this.getHourlyPerformance();
    
    // Sort hours by follower gain, require minimum posts
    const sorted = Object.values(performance)
      .filter(p => p.totalPosts >= minPosts)
      .sort((a, b) => b.avgFollowers - a.avgFollowers)
      .slice(0, topN)
      .map(p => p.hour);
    
    if (sorted.length > 0) {
      console.log('[TIME_OPTIMIZER] ⏰ Optimal posting hours:', sorted);
      sorted.forEach(hour => {
        const p = performance[hour];
        console.log(`  ${hour}:00 → ${p.avgFollowers.toFixed(1)} followers, ${p.avgLikes} likes (${p.totalPosts} posts)`);
      });
    }
    
    return sorted;
  }

  /**
   * Check if current time is optimal for posting
   */
  async isOptimalTime(hour?: number): Promise<boolean> {
    const currentHour = hour ?? new Date().getHours();
    const optimalHours = await this.getOptimalPostingHours({ topN: 5 });
    
    return optimalHours.includes(currentHour);
  }

  /**
   * Get next optimal posting time
   */
  async getNextOptimalTime(): Promise<{ hour: number; minutesUntil: number }> {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    
    const optimalHours = await this.getOptimalPostingHours({ topN: 5 });
    
    if (optimalHours.length === 0) {
      // No data yet, return current time + 1 hour
      return {
        hour: (currentHour + 1) % 24,
        minutesUntil: 60 - currentMinute
      };
    }
    
    // Find next optimal hour
    let nextHour = optimalHours[0];
    for (const hour of optimalHours) {
      if (hour > currentHour) {
        nextHour = hour;
        break;
      }
    }
    
    // Calculate minutes until next optimal time
    let minutesUntil: number;
    if (nextHour > currentHour) {
      minutesUntil = (nextHour - currentHour) * 60 - currentMinute;
    } else {
      // Next day
      minutesUntil = (24 - currentHour + nextHour) * 60 - currentMinute;
    }
    
    return { hour: nextHour, minutesUntil };
  }

  /**
   * Update time performance aggregates
   */
  async updateTimePerformance(): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      
      // Call database function to update aggregates
      await supabase.rpc('update_time_performance');
      
      console.log('[TIME_OPTIMIZER] ✅ Updated time performance aggregates');
      
    } catch (error: any) {
      console.error('[TIME_OPTIMIZER] ❌ Failed to update time performance:', error.message);
    }
  }
}

export const timeOptimizationService = TimeOptimizationService.getInstance();

