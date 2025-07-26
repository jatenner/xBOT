#!/usr/bin/env node

/**
 * 🤖 HUMAN-LIKE POSTING MANAGER
 * 
 * Ensures the bot behaves like a human running a Twitter account:
 * - Intelligent spacing between tweets (never burst posting)
 * - Natural posting patterns throughout the day
 * - Realistic engagement with timing variations
 * - Prevents machine-like behavior that could trigger suspicion
 */

import { supabaseClient } from './supabaseClient';

interface PostingPattern {
  min_interval_minutes: number;
  max_interval_minutes: number;
  preferred_times: number[]; // Hours of day (0-23)
  avoid_times: number[]; // Hours to avoid posting
  max_posts_per_hour: number;
  natural_variation_minutes: number;
}

interface HumanBehaviorRules {
  no_posting_after_midnight: boolean;
  weekend_different_pattern: boolean;
  avoid_too_regular: boolean;
  add_random_delays: boolean;
  respect_sleep_hours: boolean;
}

export class HumanLikePostingManager {
  private static readonly DEFAULT_PATTERN: PostingPattern = {
    min_interval_minutes: 45, // Minimum 45 minutes between posts
    max_interval_minutes: 120, // Maximum 2 hours between posts
    preferred_times: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20], // 8 AM to 8 PM
    avoid_times: [22, 23, 0, 1, 2, 3, 4, 5, 6, 7], // 10 PM to 7 AM
    max_posts_per_hour: 2,
    natural_variation_minutes: 15 // ±15 minutes random variation
  };

  private static readonly HUMAN_RULES: HumanBehaviorRules = {
    no_posting_after_midnight: true,
    weekend_different_pattern: true,
    avoid_too_regular: true,
    add_random_delays: true,
    respect_sleep_hours: true
  };

  /**
   * 🤖 CHECK IF POSTING IS HUMANLY APPROPRIATE
   */
  static async canPostNow(): Promise<{
    can_post: boolean;
    reason?: string;
    next_optimal_time?: Date;
    wait_minutes?: number;
  }> {
    try {
      const now = new Date();
      const estTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
      const currentHour = estTime.getHours();
      const currentMinute = estTime.getMinutes();

      console.log('🤖 Checking human-like posting rules...');

      // Rule 1: Check if we're in preferred posting hours
      if (this.DEFAULT_PATTERN.avoid_times.includes(currentHour)) {
        const nextPreferredHour = this.getNextPreferredHour(currentHour);
        const nextOptimalTime = new Date(estTime);
        nextOptimalTime.setHours(nextPreferredHour, 0, 0, 0);
        
        if (nextOptimalTime <= estTime) {
          nextOptimalTime.setDate(nextOptimalTime.getDate() + 1);
        }

        const waitMinutes = Math.ceil((nextOptimalTime.getTime() - estTime.getTime()) / (1000 * 60));

        return {
          can_post: false,
          reason: `Outside preferred posting hours (${currentHour}:${currentMinute.toString().padStart(2, '0')} EST)`,
          next_optimal_time: nextOptimalTime,
          wait_minutes: waitMinutes
        };
      }

      // Rule 2: Check recent posting frequency (prevent burst posting)
      const recentPostingCheck = await this.checkRecentPostingFrequency();
      if (!recentPostingCheck.allowed) {
        return {
          can_post: false,
          reason: recentPostingCheck.reason,
          next_optimal_time: recentPostingCheck.next_safe_time,
          wait_minutes: recentPostingCheck.wait_minutes
        };
      }

      // Rule 3: Check hourly limits
      const hourlyCheck = await this.checkHourlyLimits(estTime);
      if (!hourlyCheck.allowed) {
        return {
          can_post: false,
          reason: hourlyCheck.reason,
          wait_minutes: hourlyCheck.wait_minutes
        };
      }

      // Rule 4: Add natural variation (don't be too regular)
      const lastPostTime = await this.getLastPostTime();
      if (lastPostTime) {
        const timeSinceLastPost = (now.getTime() - lastPostTime.getTime()) / (1000 * 60);
        
        if (timeSinceLastPost < this.DEFAULT_PATTERN.min_interval_minutes) {
          const waitMinutes = Math.ceil(this.DEFAULT_PATTERN.min_interval_minutes - timeSinceLastPost);
          const nextOptimalTime = new Date(now.getTime() + (waitMinutes * 60 * 1000));

          return {
            can_post: false,
            reason: `Too soon after last post (${timeSinceLastPost.toFixed(1)} min ago)`,
            next_optimal_time: nextOptimalTime,
            wait_minutes: waitMinutes
          };
        }
      }

      // All checks passed - can post with human-like timing
      return { can_post: true };

    } catch (error) {
      console.error('❌ Human-like posting check error:', error);
      return {
        can_post: false,
        reason: 'Error checking posting rules - being cautious'
      };
    }
  }

  /**
   * 📊 GET OPTIMAL POSTING SCHEDULE FOR TODAY
   */
  static async getOptimalDailySchedule(remainingPosts: number): Promise<{
    schedule: Date[];
    strategy: 'morning_focus' | 'evening_focus' | 'distributed' | 'weekend_casual';
    total_posts: number;
  }> {
    const now = new Date();
    const estTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
    const isWeekend = estTime.getDay() === 0 || estTime.getDay() === 6;
    
    const schedule: Date[] = [];
    
    // Determine strategy based on day and remaining time
    let strategy: 'morning_focus' | 'evening_focus' | 'distributed' | 'weekend_casual';
    const currentHour = estTime.getHours();
    
    if (isWeekend) {
      strategy = 'weekend_casual';
    } else if (currentHour < 12) {
      strategy = 'morning_focus';
    } else if (currentHour > 17) {
      strategy = 'evening_focus';
    } else {
      strategy = 'distributed';
    }

    // Generate schedule based on strategy
    const preferredHours = this.getPreferredHoursForStrategy(strategy);
    const remainingHours = preferredHours.filter(hour => hour >= currentHour);
    
    if (remainingHours.length === 0) {
      // No more preferred hours today
      return { schedule: [], strategy, total_posts: 0 };
    }

    // Distribute posts across remaining preferred hours
    const postsPerTimeSlot = Math.min(remainingPosts, remainingHours.length * this.DEFAULT_PATTERN.max_posts_per_hour);
    
    for (let i = 0; i < postsPerTimeSlot && i < remainingPosts; i++) {
      const hourIndex = i % remainingHours.length;
      const targetHour = remainingHours[hourIndex];
      
      // Add natural variation
      const minuteVariation = Math.floor(Math.random() * this.DEFAULT_PATTERN.natural_variation_minutes * 2) - this.DEFAULT_PATTERN.natural_variation_minutes;
      const baseMinute = Math.floor(Math.random() * 60);
      
      const postTime = new Date(estTime);
      postTime.setHours(targetHour, baseMinute + minuteVariation, 0, 0);
      
      // Ensure minimum interval from previous posts
      if (schedule.length > 0) {
        const lastScheduledTime = schedule[schedule.length - 1];
        const minNextTime = new Date(lastScheduledTime.getTime() + (this.DEFAULT_PATTERN.min_interval_minutes * 60 * 1000));
        
        if (postTime < minNextTime) {
          postTime.setTime(minNextTime.getTime());
        }
      }
      
      // Only add if it's in the future
      if (postTime > now) {
        schedule.push(postTime);
      }
    }

    // Sort schedule chronologically
    schedule.sort((a, b) => a.getTime() - b.getTime());

    return {
      schedule: schedule.slice(0, remainingPosts),
      strategy,
      total_posts: Math.min(schedule.length, remainingPosts)
    };
  }

  /**
   * 🎯 GET NEXT OPTIMAL POSTING TIME
   */
  static async getNextOptimalPostTime(): Promise<{
    next_post_time: Date;
    reason: string;
    wait_minutes: number;
  }> {
    const canPostResult = await this.canPostNow();
    
    if (canPostResult.can_post) {
      return {
        next_post_time: new Date(),
        reason: 'Can post immediately',
        wait_minutes: 0
      };
    }

    if (canPostResult.next_optimal_time) {
      const waitMinutes = canPostResult.wait_minutes || 0;
      return {
        next_post_time: canPostResult.next_optimal_time,
        reason: canPostResult.reason || 'Following human-like timing',
        wait_minutes: waitMinutes
      };
    }

    // Fallback: next preferred hour
    const now = new Date();
    const estTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
    const nextHour = this.getNextPreferredHour(estTime.getHours());
    
    const nextTime = new Date(estTime);
    nextTime.setHours(nextHour, Math.floor(Math.random() * 60), 0, 0);
    
    if (nextTime <= estTime) {
      nextTime.setDate(nextTime.getDate() + 1);
    }

    const waitMinutes = Math.ceil((nextTime.getTime() - now.getTime()) / (1000 * 60));

    return {
      next_post_time: nextTime,
      reason: 'Next preferred posting window',
      wait_minutes: waitMinutes
    };
  }

  // Private helper methods
  private static async checkRecentPostingFrequency(): Promise<{
    allowed: boolean;
    reason?: string;
    next_safe_time?: Date;
    wait_minutes?: number;
  }> {
    try {
      // Check last 3 hours for posting frequency
      const threeHoursAgo = new Date(Date.now() - (3 * 60 * 60 * 1000));
      
      const { data: recentPosts, error } = await supabaseClient.supabase
        ?.from('tweets')
        .select('created_at')
        .gte('created_at', threeHoursAgo.toISOString())
        .eq('success', true)
        .order('created_at', { ascending: false });

      if (error || !recentPosts) {
        return { allowed: true }; // Assume safe if we can't check
      }

      // Check for burst posting (more than 3 posts in 3 hours)
      if (recentPosts.length >= 3) {
        const oldestRecentPost = new Date(recentPosts[recentPosts.length - 1].created_at);
        const nextSafeTime = new Date(oldestRecentPost.getTime() + (3 * 60 * 60 * 1000));
        const waitMinutes = Math.ceil((nextSafeTime.getTime() - Date.now()) / (1000 * 60));

        return {
          allowed: false,
          reason: `Preventing burst posting (${recentPosts.length} posts in 3 hours)`,
          next_safe_time: nextSafeTime,
          wait_minutes: Math.max(waitMinutes, 30) // Minimum 30 min wait
        };
      }

      return { allowed: true };

    } catch (error) {
      console.error('❌ Recent posting frequency check error:', error);
      return { allowed: true }; // Fail open
    }
  }

  private static async checkHourlyLimits(currentTime: Date): Promise<{
    allowed: boolean;
    reason?: string;
    wait_minutes?: number;
  }> {
    try {
      const currentHour = currentTime.getHours();
      const hourStart = new Date(currentTime);
      hourStart.setMinutes(0, 0, 0);
      
      const { data: hourlyPosts, error } = await supabaseClient.supabase
        ?.from('tweets')
        .select('created_at')
        .gte('created_at', hourStart.toISOString())
        .eq('success', true);

      if (error || !hourlyPosts) {
        return { allowed: true };
      }

      if (hourlyPosts.length >= this.DEFAULT_PATTERN.max_posts_per_hour) {
        const nextHour = new Date(hourStart);
        nextHour.setHours(nextHour.getHours() + 1);
        const waitMinutes = Math.ceil((nextHour.getTime() - currentTime.getTime()) / (1000 * 60));

        return {
          allowed: false,
          reason: `Hourly limit reached (${hourlyPosts.length}/${this.DEFAULT_PATTERN.max_posts_per_hour})`,
          wait_minutes: waitMinutes
        };
      }

      return { allowed: true };

    } catch (error) {
      console.error('❌ Hourly limits check error:', error);
      return { allowed: true };
    }
  }

  private static async getLastPostTime(): Promise<Date | null> {
    try {
      const { data: lastPost, error } = await supabaseClient.supabase
        ?.from('tweets')
        .select('created_at')
        .eq('success', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !lastPost) {
        return null;
      }

      return new Date(lastPost.created_at);

    } catch (error) {
      console.error('❌ Last post time check error:', error);
      return null;
    }
  }

  private static getNextPreferredHour(currentHour: number): number {
    const preferredHours = this.DEFAULT_PATTERN.preferred_times;
    
    // Find next preferred hour today
    for (const hour of preferredHours) {
      if (hour > currentHour) {
        return hour;
      }
    }
    
    // If no more today, return first preferred hour tomorrow
    return preferredHours[0];
  }

  private static getPreferredHoursForStrategy(strategy: string): number[] {
    switch (strategy) {
      case 'morning_focus':
        return [8, 9, 10, 11, 12]; // Morning heavy
      case 'evening_focus':
        return [17, 18, 19, 20]; // Evening focus
      case 'weekend_casual':
        return [10, 12, 14, 16, 18, 20]; // Relaxed weekend pattern
      case 'distributed':
      default:
        return this.DEFAULT_PATTERN.preferred_times; // Even distribution
    }
  }

  /**
   * 📊 GET HUMAN BEHAVIOR REPORT
   */
  static async getHumanBehaviorReport(): Promise<{
    current_status: string;
    next_posting_window: string;
    daily_pattern: string;
    recent_activity: string;
    recommendations: string[];
  }> {
    const canPost = await this.canPostNow();
    const nextOptimal = await this.getNextOptimalPostTime();
    const lastPostTime = await this.getLastPostTime();

    const report = {
      current_status: canPost.can_post ? 'Ready to post' : canPost.reason || 'Waiting',
      next_posting_window: `${nextOptimal.next_post_time.toLocaleTimeString()} (${nextOptimal.wait_minutes} min)`,
      daily_pattern: 'Human-like distributed posting (8 AM - 8 PM EST)',
      recent_activity: lastPostTime 
        ? `Last post: ${Math.round((Date.now() - lastPostTime.getTime()) / (1000 * 60))} min ago`
        : 'No recent posts found',
      recommendations: [
        '✅ Maintain 45-120 min intervals between posts',
        '✅ Avoid posting during sleep hours (10 PM - 7 AM)',
        '✅ Limit to 2 posts per hour maximum',
        '✅ Add natural timing variations',
        '✅ Respect weekend posting patterns'
      ]
    };

    return report;
  }
}

// Export for use throughout the application
export const humanLikePosting = HumanLikePostingManager; 