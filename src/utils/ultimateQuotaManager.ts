#!/usr/bin/env node

/**
 * 🎯 ULTIMATE QUOTA MANAGER
 * 
 * Integrates with Ultimate Storage Architecture to provide accurate quota tracking
 * Replaces all broken quota systems with database-based truth
 */

import { supabaseClient } from './supabaseClient';

interface QuotaStatus {
  daily_used: number;
  daily_limit: number;
  daily_remaining: number;
  can_post: boolean;
  reset_time: Date;
  percentage_used: number;
}

export class UltimateQuotaManager {
  private static readonly DAILY_LIMIT = 17;
  private static cache: Map<string, { data: QuotaStatus; timestamp: number }> = new Map();
  private static readonly CACHE_TTL = 30000; // 30 seconds cache

  /**
   * 🎯 GET ACCURATE QUOTA STATUS
   * Always uses database as source of truth
   */
  static async getQuotaStatus(): Promise<QuotaStatus> {
    try {
      // Check cache first
      const cacheKey = this.getTodayKey();
      const cached = this.cache.get(cacheKey);
      
      if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
        console.log('📊 Using cached quota status');
        return cached.data;
      }

      console.log('📊 Fetching real-time quota status from database...');
      
      // Get today's date range (EST timezone)
      const today = this.getTodayDateRange();
      
      // Query database for actual tweets posted today
      const { data: todayTweets, error } = await supabaseClient.supabase
        ?.from('tweets')
        .select('tweet_id, created_at')
        .gte('created_at', today.start)
        .lt('created_at', today.end)
        .eq('success', true);

      if (error) {
        console.error('❌ Quota check database error:', error);
        return this.getDefaultQuotaStatus();
      }

      const dailyUsed = todayTweets?.length || 0;
      const dailyRemaining = Math.max(0, this.DAILY_LIMIT - dailyUsed);
      const canPost = dailyUsed < this.DAILY_LIMIT;
      const percentageUsed = Math.round((dailyUsed / this.DAILY_LIMIT) * 100);
      
      // Calculate next reset time (9:05 PM EST next day)
      const resetTime = this.getNextResetTime();

      const quotaStatus: QuotaStatus = {
        daily_used: dailyUsed,
        daily_limit: this.DAILY_LIMIT,
        daily_remaining: dailyRemaining,
        can_post: canPost,
        reset_time: resetTime,
        percentage_used: percentageUsed
      };

      // Cache the result
      this.cache.set(cacheKey, {
        data: quotaStatus,
        timestamp: Date.now()
      });

      console.log(`📊 QUOTA STATUS: ${dailyUsed}/${this.DAILY_LIMIT} (${percentageUsed}%) - ${canPost ? 'CAN POST' : 'QUOTA EXHAUSTED'}`);
      
      return quotaStatus;

    } catch (error) {
      console.error('❌ Ultimate Quota Manager error:', error);
      return this.getDefaultQuotaStatus();
    }
  }

  /**
   * 🚦 CHECK IF POSTING IS ALLOWED
   */
  static async canPost(): Promise<{ allowed: boolean; reason?: string; resetTime?: Date }> {
    const status = await this.getQuotaStatus();
    
    if (!status.can_post) {
      return {
        allowed: false,
        reason: `Daily quota exhausted: ${status.daily_used}/${status.daily_limit} tweets used`,
        resetTime: status.reset_time
      };
    }

    return { allowed: true };
  }

  /**
   * 📊 GET DETAILED QUOTA REPORT
   */
  static async getDetailedReport(): Promise<{
    status: QuotaStatus;
    timeUntilReset: string;
    recommendation: string;
    optimalPostingTimes: string[];
  }> {
    const status = await this.getQuotaStatus();
    const timeUntilReset = this.formatTimeUntilReset(status.reset_time);
    
    let recommendation = '';
    if (status.can_post) {
      if (status.percentage_used < 50) {
        recommendation = 'Normal posting pace - plenty of quota remaining';
      } else if (status.percentage_used < 80) {
        recommendation = 'Moderate posting pace - quota getting low';
      } else {
        recommendation = 'Conservative posting - quota almost exhausted';
      }
    } else {
      recommendation = `Quota exhausted - wait ${timeUntilReset} for reset`;
    }

    const optimalPostingTimes = this.getOptimalPostingTimes(status.daily_remaining);

    return {
      status,
      timeUntilReset,
      recommendation,
      optimalPostingTimes
    };
  }

  /**
   * 🔄 FORCE QUOTA REFRESH
   * Clears cache and fetches fresh data
   */
  static async forceRefresh(): Promise<QuotaStatus> {
    this.cache.clear();
    return await this.getQuotaStatus();
  }

  /**
   * 📈 GET QUOTA TREND
   * Analyze posting patterns over time
   */
  static async getQuotaTrend(): Promise<{
    daily_average: number;
    weekly_trend: number;
    efficiency_score: number;
  }> {
    try {
      // Get last 7 days of data
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: recentTweets } = await supabaseClient.supabase
        ?.from('tweets')
        .select('created_at')
        .gte('created_at', sevenDaysAgo.toISOString())
        .eq('success', true) || { data: [] };

      if (!recentTweets || recentTweets.length === 0) {
        return { daily_average: 0, weekly_trend: 0, efficiency_score: 0 };
      }

      // Calculate daily averages
      const dailyCounts = new Map<string, number>();
      for (const tweet of recentTweets) {
        const date = new Date(tweet.created_at).toISOString().split('T')[0];
        dailyCounts.set(date, (dailyCounts.get(date) || 0) + 1);
      }

      const daily_average = recentTweets.length / 7;
      const weekly_trend = daily_average; // Simplified trend calculation
      const efficiency_score = Math.min(100, (daily_average / this.DAILY_LIMIT) * 100);

      return {
        daily_average: Math.round(daily_average * 10) / 10,
        weekly_trend: Math.round(weekly_trend * 10) / 10,
        efficiency_score: Math.round(efficiency_score)
      };

    } catch (error) {
      console.error('❌ Quota trend calculation error:', error);
      return { daily_average: 0, weekly_trend: 0, efficiency_score: 0 };
    }
  }

  // Private utility methods
  private static getTodayKey(): string {
    return new Date().toISOString().split('T')[0];
  }

  private static getTodayDateRange(): { start: string; end: string } {
    // Use EST timezone for consistent day boundaries
    const now = new Date();
    const estOffset = -5; // EST is UTC-5
    const estDate = new Date(now.getTime() + (estOffset * 60 * 60 * 1000));
    
    const today = estDate.toISOString().split('T')[0];
    const tomorrow = new Date(estDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return {
      start: `${today}T04:00:00.000Z`, // 4 AM UTC = 11 PM EST previous day
      end: `${tomorrow.toISOString().split('T')[0]}T04:00:00.000Z`
    };
  }

  private static getNextResetTime(): Date {
    // Twitter quota resets at 9:05 PM EST
    const now = new Date();
    const resetTime = new Date();
    resetTime.setHours(21, 5, 0, 0); // 9:05 PM
    
    // If we've passed today's reset time, set for tomorrow
    if (now > resetTime) {
      resetTime.setDate(resetTime.getDate() + 1);
    }
    
    return resetTime;
  }

  private static getDefaultQuotaStatus(): QuotaStatus {
    return {
      daily_used: 0,
      daily_limit: this.DAILY_LIMIT,
      daily_remaining: this.DAILY_LIMIT,
      can_post: true,
      reset_time: this.getNextResetTime(),
      percentage_used: 0
    };
  }

  private static formatTimeUntilReset(resetTime: Date): string {
    const now = new Date();
    const diff = resetTime.getTime() - now.getTime();
    
    if (diff <= 0) return 'Reset time passed';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  private static getOptimalPostingTimes(remainingPosts: number): string[] {
    if (remainingPosts <= 0) return [];
    
    const times = [];
    const now = new Date();
    const endOfDay = new Date();
    endOfDay.setHours(23, 0, 0, 0); // 11 PM
    
    const remainingHours = Math.max(1, Math.floor((endOfDay.getTime() - now.getTime()) / (1000 * 60 * 60)));
    const interval = Math.max(1, Math.floor(remainingHours / remainingPosts));
    
    for (let i = 0; i < remainingPosts && i < 5; i++) {
      const nextTime = new Date(now.getTime() + (interval * (i + 1) * 60 * 60 * 1000));
      times.push(nextTime.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      }));
    }
    
    return times;
  }
}

// Export singleton
export const ultimateQuotaManager = UltimateQuotaManager; 