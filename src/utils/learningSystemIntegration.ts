/**
 * 🧠 LEARNING SYSTEM INTEGRATION
 * 
 * Utilities to connect bot logic with the learning database functions
 */

import { supabase } from './supabaseClient';

export interface OptimalTiming {
  optimal_hour: number;
  day_of_week: number;
  predicted_engagement: number;
  confidence: number;
}

export interface BanditArmStats {
  arm_name: string;
  arm_type: string;
  success_rate: number;
  confidence: number;
  total_selections: number;
}

export class LearningSystemIntegration {
  
  /**
   * 🕐 GET OPTIMAL POSTING TIME
   */
  static async getOptimalPostingTime(targetDayOfWeek?: number): Promise<OptimalTiming | null> {
    try {
      const { data, error } = await supabase.rpc('get_optimal_posting_time', {
        target_day_of_week: targetDayOfWeek || null
      });

      if (error) {
        console.error('❌ Failed to get optimal posting time:', error);
        return null;
      }

      return data?.[0] || null;
    } catch (error) {
      console.error('❌ Error calling get_optimal_posting_time:', error);
      return null;
    }
  }

  /**
   * 🎯 GET BEST CONTENT FORMAT
   */
  static async getBestContentFormat(): Promise<string> {
    try {
      const { data, error } = await supabase.rpc('get_best_content_format');

      if (error) {
        console.error('❌ Failed to get best content format:', error);
        return 'controversy_evidence_stance'; // fallback
      }

      return data || 'controversy_evidence_stance';
    } catch (error) {
      console.error('❌ Error calling get_best_content_format:', error);
      return 'controversy_evidence_stance';
    }
  }

  /**
   * 📊 GET BANDIT ARM STATISTICS
   */
  static async getBanditArmStatistics(): Promise<BanditArmStats[]> {
    try {
      const { data, error } = await supabase.rpc('get_bandit_arm_statistics');

      if (error) {
        console.error('❌ Failed to get bandit statistics:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('❌ Error calling get_bandit_arm_statistics:', error);
      return [];
    }
  }

  /**
   * 📈 UPDATE TWEET PERFORMANCE
   */
  static async updateTweetPerformance(
    tweetId: string,
    likes: number,
    retweets: number,
    replies: number,
    impressions?: number
  ): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('update_tweet_performance', {
        tweet_id_param: tweetId,
        new_likes: likes,
        new_retweets: retweets,
        new_replies: replies,
        new_impressions: impressions || null
      });

      if (error) {
        console.error('❌ Failed to update tweet performance:', error);
        return false;
      }

      return data === true;
    } catch (error) {
      console.error('❌ Error calling update_tweet_performance:', error);
      return false;
    }
  }

  /**
   * 💯 CALCULATE ENGAGEMENT SCORE
   */
  static async calculateEngagementScore(
    likes: number,
    retweets: number,
    replies: number,
    impressions?: number
  ): Promise<number> {
    try {
      const { data, error } = await supabase.rpc('calculate_engagement_score', {
        likes_count: likes,
        retweets_count: retweets,
        replies_count: replies,
        impressions_count: impressions || null
      });

      if (error) {
        console.error('❌ Failed to calculate engagement score:', error);
        return 0;
      }

      return Number(data) || 0;
    } catch (error) {
      console.error('❌ Error calling calculate_engagement_score:', error);
      return 0;
    }
  }

  /**
   * 🎰 SELECT OPTIMAL FORMAT USING BANDIT
   */
  static async selectOptimalFormat(): Promise<{format: string; confidence: number; reasoning: string}> {
    const stats = await this.getBanditArmStatistics();
    
    if (stats.length === 0) {
      return {
        format: 'controversy_evidence_stance',
        confidence: 0.5,
        reasoning: 'Using fallback format - no bandit data available'
      };
    }

    // Filter to only format arms
    const formatArms = stats.filter(arm => arm.arm_type === 'format');
    
    if (formatArms.length === 0) {
      return {
        format: 'controversy_evidence_stance',
        confidence: 0.5,
        reasoning: 'Using fallback format - no format arms found'
      };
    }

    // Get the best performing format
    const bestFormat = formatArms[0]; // Already sorted by success rate
    
    return {
      format: bestFormat.arm_name,
      confidence: bestFormat.confidence,
      reasoning: `Selected ${bestFormat.arm_name} (success rate: ${(bestFormat.success_rate * 100).toFixed(1)}%)`
    };
  }

  /**
   * ⏰ CHECK IF NOW IS OPTIMAL POSTING TIME
   */
  static async isOptimalPostingTime(): Promise<{isOptimal: boolean; score: number; reasoning: string}> {
    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay();

    const optimalTiming = await this.getOptimalPostingTime(currentDay);

    if (!optimalTiming) {
      return {
        isOptimal: false,
        score: 0.5,
        reasoning: 'No timing data available'
      };
    }

    const hourDiff = Math.abs(currentHour - optimalTiming.optimal_hour);
    const score = Math.max(0, 1 - (hourDiff / 4)); // Score decreases with hour difference

    return {
      isOptimal: score >= 0.7,
      score,
      reasoning: `Current: ${currentHour}h, Optimal: ${optimalTiming.optimal_hour}h (score: ${(score * 100).toFixed(1)}%)`
    };
  }
}

export const learningSystemIntegration = LearningSystemIntegration;
