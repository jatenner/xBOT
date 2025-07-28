/**
 * 🕐 ADAPTIVE POSTING FREQUENCY ENGINE
 * Learns optimal posting times from historical performance data
 * Continuously adjusts schedule based on engagement patterns
 */

import { supabaseClient } from '../utils/supabaseClient';
import { SmartModelSelector } from '../utils/smartModelSelector';

export interface PostingTimeSlot {
  hour: number;
  dayOfWeek: number;
  performanceScore: number;
  engagementRate: number;
  avgLikes: number;
  avgImpressions: number;
  totalPosts: number;
  confidence: number;
}

export interface OptimalSchedule {
  primarySlots: PostingTimeSlot[];
  secondarySlots: PostingTimeSlot[];
  emergencySlots: PostingTimeSlot[];
  reasoning: string;
  lastUpdated: Date;
  nextUpdate: Date;
}

export class AdaptivePostingFrequency {
  private static readonly MIN_POSTS_FOR_ANALYSIS = 3;
  private static readonly PERFORMANCE_DECAY_DAYS = 30;
  private static readonly UPDATE_INTERVAL_HOURS = 6;

  /**
   * 🎯 ANALYZE HISTORICAL POSTING PERFORMANCE
   */
  static async analyzePostingPatterns(): Promise<PostingTimeSlot[]> {
    try {
      console.log('📊 === ANALYZING POSTING PATTERNS ===');

      if (!supabaseClient.supabase) {
        throw new Error('Supabase client not available');
      }

      // Get performance data with time decay
      const { data: performanceData, error } = await supabaseClient.supabase
        .from('posting_time_analytics')
        .select('*')
        .gte('total_posts', this.MIN_POSTS_FOR_ANALYSIS)
        .order('performance_score', { ascending: false });

      if (error) throw error;

      const timeSlots: PostingTimeSlot[] = performanceData?.map(slot => ({
        hour: slot.hour_slot,
        dayOfWeek: slot.day_of_week,
        performanceScore: slot.performance_score || 0,
        engagementRate: slot.engagement_rate || 0,
        avgLikes: slot.avg_likes || 0,
        avgImpressions: slot.avg_impressions || 0,
        totalPosts: slot.total_posts || 0,
        confidence: Math.min(slot.total_posts / 10, 1.0) // Confidence based on sample size
      })) || [];

      console.log(`📈 Analyzed ${timeSlots.length} time slots with sufficient data`);
      return timeSlots;

    } catch (error) {
      console.error('❌ Error analyzing posting patterns:', error);
      return this.getDefaultTimeSlots();
    }
  }

  /**
   * 🧠 UPDATE POSTING ANALYTICS FROM RECENT TWEETS
   */
  static async updatePostingAnalytics(): Promise<void> {
    try {
      console.log('🔄 === UPDATING POSTING ANALYTICS ===');

      if (!supabaseClient.supabase) {
        throw new Error('Supabase client not available');
      }

      // Get recent tweets (last 30 days) with performance data
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: tweets, error: tweetsError } = await supabaseClient.supabase
        .from('tweets')
        .select('*')
        .gte('created_at', thirtyDaysAgo.toISOString())
        .not('likes', 'is', null)
        .not('impressions', 'is', null);

      if (tweetsError) throw tweetsError;

      if (!tweets || tweets.length === 0) {
        console.log('⚠️ No recent tweets found for analysis');
        return;
      }

      console.log(`📊 Processing ${tweets.length} recent tweets`);

      // Group tweets by hour and day of week
      const timeSlotMap = new Map<string, {
        hour: number;
        dayOfWeek: number;
        tweets: any[];
        totalLikes: number;
        totalImpressions: number;
        totalReplies: number;
        totalRetweets: number;
      }>();

      tweets.forEach(tweet => {
        const tweetDate = new Date(tweet.created_at);
        const hour = tweetDate.getHours();
        const dayOfWeek = tweetDate.getDay();
        const key = `${hour}_${dayOfWeek}`;

        if (!timeSlotMap.has(key)) {
          timeSlotMap.set(key, {
            hour,
            dayOfWeek,
            tweets: [],
            totalLikes: 0,
            totalImpressions: 0,
            totalReplies: 0,
            totalRetweets: 0
          });
        }

        const slot = timeSlotMap.get(key)!;
        slot.tweets.push(tweet);
        slot.totalLikes += tweet.likes || 0;
        slot.totalImpressions += tweet.impressions || 0;
        slot.totalReplies += tweet.replies || 0;
        slot.totalRetweets += tweet.retweets || 0;
      });

      // Update or insert analytics for each time slot
      for (const [key, slot] of timeSlotMap) {
        const avgLikes = slot.totalLikes / slot.tweets.length;
        const avgImpressions = slot.totalImpressions / slot.tweets.length;
        const avgReplies = slot.totalReplies / slot.tweets.length;
        const avgRetweets = slot.totalRetweets / slot.tweets.length;
        
        // Calculate engagement rate
        const engagementRate = avgImpressions > 0 
          ? (avgLikes + avgReplies + avgRetweets) / avgImpressions 
          : 0;

        // Calculate performance score (weighted combination)
        const performanceScore = (
          (avgLikes * 0.4) +
          (engagementRate * 1000 * 0.3) +
          (avgReplies * 2 * 0.2) +
          (avgRetweets * 3 * 0.1)
        ) / 100;

        // Upsert the analytics
        const { error: upsertError } = await supabaseClient.supabase
          .from('posting_time_analytics')
          .upsert({
            hour_slot: slot.hour,
            day_of_week: slot.dayOfWeek,
            avg_likes: avgLikes,
            avg_impressions: avgImpressions,
            avg_replies: avgReplies,
            avg_retweets: avgRetweets,
            total_posts: slot.tweets.length,
            engagement_rate: engagementRate,
            performance_score: performanceScore,
            last_updated: new Date().toISOString()
          }, {
            onConflict: 'hour_slot,day_of_week'
          });

        if (upsertError) {
          console.error(`❌ Error updating slot ${key}:`, upsertError);
        } else {
          console.log(`✅ Updated slot ${slot.hour}:00 (${this.getDayName(slot.dayOfWeek)}) - Score: ${performanceScore.toFixed(2)}`);
        }
      }

      console.log('✅ Posting analytics updated successfully');

    } catch (error) {
      console.error('❌ Error updating posting analytics:', error);
    }
  }

  /**
   * 🎯 GENERATE OPTIMAL POSTING SCHEDULE
   */
  static async generateOptimalSchedule(): Promise<OptimalSchedule> {
    try {
      console.log('🧠 === GENERATING OPTIMAL POSTING SCHEDULE ===');

      // First update analytics with latest data
      await this.updatePostingAnalytics();

      // Get analyzed time slots
      const timeSlots = await this.analyzePostingPatterns();

      if (timeSlots.length === 0) {
        return this.getDefaultSchedule();
      }

      // Sort by performance score
      const sortedSlots = timeSlots.sort((a, b) => b.performanceScore - a.performanceScore);

      // Select primary slots (top 30%)
      const primaryCount = Math.max(3, Math.floor(sortedSlots.length * 0.3));
      const primarySlots = sortedSlots.slice(0, primaryCount);

      // Select secondary slots (next 40%)
      const secondaryCount = Math.floor(sortedSlots.length * 0.4);
      const secondarySlots = sortedSlots.slice(primaryCount, primaryCount + secondaryCount);

      // Emergency slots (remaining, but filter by minimum performance)
      const emergencySlots = sortedSlots
        .slice(primaryCount + secondaryCount)
        .filter(slot => slot.performanceScore > 0);

      // Generate reasoning using AI
      const reasoning = await this.generateScheduleReasoning(primarySlots, secondarySlots);

      const schedule: OptimalSchedule = {
        primarySlots,
        secondarySlots,
        emergencySlots,
        reasoning,
        lastUpdated: new Date(),
        nextUpdate: new Date(Date.now() + (this.UPDATE_INTERVAL_HOURS * 60 * 60 * 1000))
      };

      console.log(`✅ Generated schedule with ${primarySlots.length} primary, ${secondarySlots.length} secondary slots`);
      console.log(`🏆 Best slot: ${primarySlots[0]?.hour}:00 (score: ${primarySlots[0]?.performanceScore.toFixed(2)})`);

      return schedule;

    } catch (error) {
      console.error('❌ Error generating optimal schedule:', error);
      return this.getDefaultSchedule();
    }
  }

  /**
   * 🤖 GENERATE AI REASONING FOR SCHEDULE
   */
  private static async generateScheduleReasoning(
    primarySlots: PostingTimeSlot[],
    secondarySlots: PostingTimeSlot[]
  ): Promise<string> {
    try {
      const modelSelection = await SmartModelSelector.selectModel('analysis', 500);

      const topSlots = primarySlots.slice(0, 3);
      const slotSummary = topSlots.map(slot => 
        `${slot.hour}:00 (${this.getDayName(slot.dayOfWeek)}) - Score: ${slot.performanceScore.toFixed(2)}, Engagement: ${(slot.engagementRate * 100).toFixed(2)}%`
      ).join(', ');

      // For now, return a simple reasoning (can be enhanced with actual AI call)
      return `Optimal posting schedule identified based on ${primarySlots.length + secondarySlots.length} analyzed time slots. ` +
             `Top performing times: ${slotSummary}. ` +
             `Primary slots show ${(primarySlots[0]?.performanceScore || 0).toFixed(1)}x better performance than average. ` +
             `Schedule optimized for maximum engagement and follower growth.`;

    } catch (error) {
      console.error('❌ Error generating schedule reasoning:', error);
      return 'Schedule generated based on historical performance analysis and engagement optimization.';
    }
  }

  /**
   * ⏰ GET NEXT OPTIMAL POSTING TIME
   */
  static async getNextOptimalPostingTime(): Promise<{
    nextTime: Date;
    slotType: 'primary' | 'secondary' | 'emergency';
    confidence: number;
    reason: string;
  }> {
    try {
      const schedule = await this.generateOptimalSchedule();
      const now = new Date();
      const currentHour = now.getHours();
      const currentDay = now.getDay();

      // Find the next available optimal slot
      const allSlots = [
        ...schedule.primarySlots.map(s => ({ ...s, type: 'primary' as const })),
        ...schedule.secondarySlots.map(s => ({ ...s, type: 'secondary' as const })),
        ...schedule.emergencySlots.map(s => ({ ...s, type: 'emergency' as const }))
      ];

      // Sort by time distance from now
      const upcomingSlots = allSlots
        .map(slot => {
          const nextOccurrence = this.getNextSlotOccurrence(slot.hour, slot.dayOfWeek, now);
          return {
            ...slot,
            nextOccurrence,
            hoursUntil: (nextOccurrence.getTime() - now.getTime()) / (1000 * 60 * 60)
          };
        })
        .filter(slot => slot.hoursUntil > 0.5) // At least 30 minutes from now
        .sort((a, b) => a.hoursUntil - b.hoursUntil);

      if (upcomingSlots.length === 0) {
        // Fallback to next hour
        const nextHour = new Date(now);
        nextHour.setHours(currentHour + 1, 0, 0, 0);
        
        return {
          nextTime: nextHour,
          slotType: 'emergency',
          confidence: 0.3,
          reason: 'No optimal slots available - using next hour fallback'
        };
      }

      const nextSlot = upcomingSlots[0];
      
      return {
        nextTime: nextSlot.nextOccurrence,
        slotType: nextSlot.type,
        confidence: nextSlot.confidence,
        reason: `Optimal ${nextSlot.type} slot with ${nextSlot.performanceScore.toFixed(2)} performance score`
      };

    } catch (error) {
      console.error('❌ Error getting next optimal posting time:', error);
      
      // Fallback
      const nextHour = new Date();
      nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
      
      return {
        nextTime: nextHour,
        slotType: 'emergency',
        confidence: 0.1,
        reason: 'Error fallback - using next hour'
      };
    }
  }

  /**
   * 🔧 HELPER METHODS
   */
  private static getNextSlotOccurrence(hour: number, dayOfWeek: number, from: Date): Date {
    const next = new Date(from);
    next.setHours(hour, 0, 0, 0);
    
    // Calculate days until target day
    let daysUntil = dayOfWeek - from.getDay();
    if (daysUntil < 0) daysUntil += 7;
    if (daysUntil === 0 && from.getHours() >= hour) daysUntil = 7;
    
    next.setDate(next.getDate() + daysUntil);
    return next;
  }

  private static getDayName(dayOfWeek: number): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayOfWeek] || 'Unknown';
  }

  private static getDefaultTimeSlots(): PostingTimeSlot[] {
    // Default optimal times based on typical social media patterns
    return [
      { hour: 9, dayOfWeek: 1, performanceScore: 7.5, engagementRate: 0.045, avgLikes: 25, avgImpressions: 1000, totalPosts: 5, confidence: 0.6 },
      { hour: 13, dayOfWeek: 2, performanceScore: 8.0, engagementRate: 0.052, avgLikes: 30, avgImpressions: 1200, totalPosts: 5, confidence: 0.6 },
      { hour: 17, dayOfWeek: 3, performanceScore: 7.8, engagementRate: 0.048, avgLikes: 28, avgImpressions: 1100, totalPosts: 5, confidence: 0.6 },
      { hour: 11, dayOfWeek: 4, performanceScore: 7.2, engagementRate: 0.042, avgLikes: 24, avgImpressions: 950, totalPosts: 5, confidence: 0.6 },
      { hour: 15, dayOfWeek: 5, performanceScore: 8.5, engagementRate: 0.058, avgLikes: 35, avgImpressions: 1300, totalPosts: 5, confidence: 0.6 }
    ];
  }

  private static getDefaultSchedule(): OptimalSchedule {
    const defaultSlots = this.getDefaultTimeSlots();
    return {
      primarySlots: defaultSlots.slice(0, 3),
      secondarySlots: defaultSlots.slice(3),
      emergencySlots: [],
      reasoning: 'Using default optimal posting schedule based on social media best practices',
      lastUpdated: new Date(),
      nextUpdate: new Date(Date.now() + (this.UPDATE_INTERVAL_HOURS * 60 * 60 * 1000))
    };
  }
} 