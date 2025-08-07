/**
 * 🏆 REWARD CALCULATOR
 * 
 * Calculates engagement rewards and updates format/timing statistics
 * Used by the multi-arm bandit algorithm for intelligent content selection
 */

import { supabaseClient } from './supabaseClient';

interface EngagementData {
  likes: number;
  retweets: number;
  replies: number;
  bookmarks?: number;
  impressions?: number;
}

interface RewardCalculationResult {
  reward: number;
  engagementRate: number;
  totalEngagements: number;
  breakdown: {
    likesReward: number;
    retweetsReward: number;
    repliesReward: number;
    bookmarksReward: number;
  };
}

interface FormatStatsUpdate {
  format_type: string;
  hook_type?: string;
  content_category?: string;
  reward: number;
  engagement_rate: number;
  likes: number;
  retweets: number;
}

interface TimingStatsUpdate {
  hour_of_day: number;
  day_of_week: number;
  reward: number;
  engagement_rate: number;
  likes: number;
  retweets: number;
}

export class RewardCalculator {
  // Reward weights (sum to 1.0)
  private static readonly WEIGHTS = {
    LIKES: 0.4,
    RETWEETS: 0.3,
    REPLIES: 0.2,
    BOOKMARKS: 0.1
  };

  /**
   * 🎯 CALCULATE ENGAGEMENT REWARD
   */
  static calculateReward(engagement: EngagementData): RewardCalculationResult {
    const likes = engagement.likes || 0;
    const retweets = engagement.retweets || 0;
    const replies = engagement.replies || 0;
    const bookmarks = engagement.bookmarks || 0;

    // Calculate weighted rewards
    const likesReward = likes * this.WEIGHTS.LIKES;
    const retweetsReward = retweets * this.WEIGHTS.RETWEETS;
    const repliesReward = replies * this.WEIGHTS.REPLIES;
    const bookmarksReward = bookmarks * this.WEIGHTS.BOOKMARKS;

    const totalReward = likesReward + retweetsReward + repliesReward + bookmarksReward;
    const totalEngagements = likes + retweets + replies + bookmarks;
    const engagementRate = engagement.impressions && engagement.impressions > 0 
      ? totalEngagements / engagement.impressions 
      : 0;

    return {
      reward: parseFloat(totalReward.toFixed(4)),
      engagementRate: parseFloat(engagementRate.toFixed(6)),
      totalEngagements,
      breakdown: {
        likesReward: parseFloat(likesReward.toFixed(4)),
        retweetsReward: parseFloat(retweetsReward.toFixed(4)),
        repliesReward: parseFloat(repliesReward.toFixed(4)),
        bookmarksReward: parseFloat(bookmarksReward.toFixed(4))
      }
    };
  }

  /**
   * 📊 UPDATE FORMAT STATISTICS
   */
  static async updateFormatStats(update: FormatStatsUpdate): Promise<{
    success: boolean;
    updatedStats?: any;
    error?: string;
  }> {
    try {
      console.log(`📊 Updating format stats: ${update.format_type}/${update.hook_type}/${update.content_category}`);

      // Use SQL function to update format stats
      const { data, error } = await supabaseClient.supabase!.rpc('update_format_stats', {
        p_format_type: update.format_type,
        p_hook_type: update.hook_type,
        p_content_category: update.content_category,
        p_reward: update.reward,
        p_engagement_rate: update.engagement_rate,
        p_likes: update.likes,
        p_retweets: update.retweets
      });

      if (error) {
        // Fallback to manual upsert if function doesn't exist
        return await this.manualFormatStatsUpdate(update);
      }

      console.log(`✅ Format stats updated successfully`);
      return { success: true, updatedStats: data };

    } catch (error) {
      console.error('❌ Error updating format stats:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 🕐 UPDATE TIMING STATISTICS
   */
  static async updateTimingStats(update: TimingStatsUpdate): Promise<{
    success: boolean;
    updatedStats?: any;
    error?: string;
  }> {
    try {
      console.log(`🕐 Updating timing stats: ${update.hour_of_day}h, day ${update.day_of_week}`);

      // Use SQL function to update timing stats
      const { data, error } = await supabaseClient.supabase!.rpc('update_timing_stats', {
        p_hour_of_day: update.hour_of_day,
        p_day_of_week: update.day_of_week,
        p_reward: update.reward,
        p_engagement_rate: update.engagement_rate,
        p_likes: update.likes,
        p_retweets: update.retweets
      });

      if (error) {
        // Fallback to manual upsert if function doesn't exist
        return await this.manualTimingStatsUpdate(update);
      }

      console.log(`✅ Timing stats updated successfully`);
      return { success: true, updatedStats: data };

    } catch (error) {
      console.error('❌ Error updating timing stats:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 🔄 UPDATE BOTH FORMAT AND TIMING STATS
   */
  static async updateAllStats(
    engagement: EngagementData,
    formatInfo: {
      format_type: string;
      hook_type?: string;
      content_category?: string;
    },
    timingInfo: {
      hour_of_day: number;
      day_of_week: number;
    }
  ): Promise<{
    success: boolean;
    reward: number;
    formatUpdate?: any;
    timingUpdate?: any;
    error?: string;
  }> {
    try {
      // Calculate reward
      const rewardResult = this.calculateReward(engagement);

      // Update format stats
      const formatUpdate = await this.updateFormatStats({
        ...formatInfo,
        reward: rewardResult.reward,
        engagement_rate: rewardResult.engagementRate,
        likes: engagement.likes || 0,
        retweets: engagement.retweets || 0
      });

      // Update timing stats
      const timingUpdate = await this.updateTimingStats({
        ...timingInfo,
        reward: rewardResult.reward,
        engagement_rate: rewardResult.engagementRate,
        likes: engagement.likes || 0,
        retweets: engagement.retweets || 0
      });

      const allSuccess = formatUpdate.success && timingUpdate.success;

      console.log(`🎯 Calculated reward: ${rewardResult.reward} (${rewardResult.totalEngagements} total engagements)`);

      return {
        success: allSuccess,
        reward: rewardResult.reward,
        formatUpdate: formatUpdate.updatedStats,
        timingUpdate: timingUpdate.updatedStats,
        error: allSuccess ? undefined : 'Some updates failed'
      };

    } catch (error) {
      console.error('❌ Error updating all stats:', error);
      return {
        success: false,
        reward: 0,
        error: error.message
      };
    }
  }

  /**
   * 🔧 MANUAL FORMAT STATS UPDATE (FALLBACK)
   */
  private static async manualFormatStatsUpdate(update: FormatStatsUpdate): Promise<{
    success: boolean;
    updatedStats?: any;
    error?: string;
  }> {
    try {
      // Get current stats
      const { data: currentStats } = await supabaseClient.supabase
        .from('format_stats')
        .select('*')
        .eq('format_type', update.format_type)
        .eq('hook_type', update.hook_type || '')
        .eq('content_category', update.content_category || '')
        .single();

      let newStats;
      if (currentStats) {
        // Update existing record
        const newTotalPosts = currentStats.total_posts + 1;
        const newTotalReward = currentStats.total_reward + update.reward;
        const newAvgReward = newTotalReward / newTotalPosts;
        const newAvgLikes = (currentStats.avg_likes * currentStats.total_posts + update.likes) / newTotalPosts;
        const newAvgRetweets = (currentStats.avg_retweets * currentStats.total_posts + update.retweets) / newTotalPosts;
        const newAvgEngagementRate = (currentStats.avg_engagement_rate * currentStats.total_posts + update.engagement_rate) / newTotalPosts;

        newStats = {
          total_posts: newTotalPosts,
          avg_likes: parseFloat(newAvgLikes.toFixed(2)),
          avg_retweets: parseFloat(newAvgRetweets.toFixed(2)),
          avg_engagement_rate: parseFloat(newAvgEngagementRate.toFixed(6)),
          total_reward: parseFloat(newTotalReward.toFixed(4)),
          avg_reward: parseFloat(newAvgReward.toFixed(4)),
          last_updated: new Date().toISOString()
        };

        const { error } = await supabaseClient.supabase
          .from('format_stats')
          .update(newStats)
          .eq('format_type', update.format_type)
          .eq('hook_type', update.hook_type || '')
          .eq('content_category', update.content_category || '');

        if (error) throw error;

      } else {
        // Insert new record
        newStats = {
          format_type: update.format_type,
          hook_type: update.hook_type || null,
          content_category: update.content_category || null,
          total_posts: 1,
          avg_likes: update.likes,
          avg_retweets: update.retweets,
          avg_engagement_rate: update.engagement_rate,
          total_reward: update.reward,
          avg_reward: update.reward,
          alpha: 1,
          beta: 1,
          last_updated: new Date().toISOString()
        };

        const { error } = await supabaseClient.supabase
          .from('format_stats')
          .insert(newStats);

        if (error) throw error;
      }

      return { success: true, updatedStats: newStats };

    } catch (error) {
      console.error('❌ Manual format stats update failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 🔧 MANUAL TIMING STATS UPDATE (FALLBACK)
   */
  private static async manualTimingStatsUpdate(update: TimingStatsUpdate): Promise<{
    success: boolean;
    updatedStats?: any;
    error?: string;
  }> {
    try {
      // Get current stats
      const { data: currentStats } = await supabaseClient.supabase
        .from('timing_stats')
        .select('*')
        .eq('hour_of_day', update.hour_of_day)
        .eq('day_of_week', update.day_of_week)
        .single();

      let newStats;
      if (currentStats) {
        // Update existing record
        const newTotalPosts = currentStats.total_posts + 1;
        const newTotalReward = currentStats.total_reward + update.reward;
        const newAvgReward = newTotalReward / newTotalPosts;
        const newAvgLikes = (currentStats.avg_likes * currentStats.total_posts + update.likes) / newTotalPosts;
        const newAvgRetweets = (currentStats.avg_retweets * currentStats.total_posts + update.retweets) / newTotalPosts;
        const newAvgEngagementRate = (currentStats.avg_engagement_rate * currentStats.total_posts + update.engagement_rate) / newTotalPosts;

        newStats = {
          total_posts: newTotalPosts,
          avg_engagement_rate: parseFloat(newAvgEngagementRate.toFixed(6)),
          avg_likes: parseFloat(newAvgLikes.toFixed(2)),
          avg_retweets: parseFloat(newAvgRetweets.toFixed(2)),
          total_reward: parseFloat(newTotalReward.toFixed(4)),
          avg_reward: parseFloat(newAvgReward.toFixed(4)),
          sample_size_adequate: newTotalPosts >= 5,
          confidence_score: Math.min(0.99, newTotalPosts / 10), // Higher confidence with more data
          last_updated: new Date().toISOString()
        };

        const { error } = await supabaseClient.supabase
          .from('timing_stats')
          .update(newStats)
          .eq('hour_of_day', update.hour_of_day)
          .eq('day_of_week', update.day_of_week);

        if (error) throw error;

      } else {
        // Insert new record
        newStats = {
          hour_of_day: update.hour_of_day,
          day_of_week: update.day_of_week,
          total_posts: 1,
          avg_engagement_rate: update.engagement_rate,
          avg_likes: update.likes,
          avg_retweets: update.retweets,
          total_reward: update.reward,
          avg_reward: update.reward,
          sample_size_adequate: false,
          confidence_score: 0.1,
          last_updated: new Date().toISOString()
        };

        const { error } = await supabaseClient.supabase
          .from('timing_stats')
          .insert(newStats);

        if (error) throw error;
      }

      return { success: true, updatedStats: newStats };

    } catch (error) {
      console.error('❌ Manual timing stats update failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 📈 GET TOP PERFORMING FORMATS
   */
  static async getTopFormats(limit: number = 5): Promise<Array<{
    format_type: string;
    hook_type: string;
    content_category: string;
    avg_reward: number;
    total_posts: number;
    confidence_score: number;
  }>> {
    try {
      const { data, error } = await supabaseClient.supabase
        .from('format_stats')
        .select('*')
        .gte('total_posts', 3) // Minimum sample size
        .order('avg_reward', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map(stat => ({
        format_type: stat.format_type,
        hook_type: stat.hook_type || '',
        content_category: stat.content_category || '',
        avg_reward: stat.avg_reward,
        total_posts: stat.total_posts,
        confidence_score: stat.total_posts >= 10 ? 0.95 : (stat.total_posts >= 5 ? 0.80 : 0.60)
      }));

    } catch (error) {
      console.error('❌ Error getting top formats:', error);
      return [];
    }
  }

  /**
   * 🕐 GET OPTIMAL POSTING TIMES
   */
  static async getOptimalTimes(limit: number = 10): Promise<Array<{
    hour_of_day: number;
    day_of_week: number;
    avg_reward: number;
    total_posts: number;
    confidence_score: number;
  }>> {
    try {
      const { data, error } = await supabaseClient.supabase
        .from('timing_stats')
        .select('*')
        .eq('sample_size_adequate', true)
        .order('avg_reward', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map(stat => ({
        hour_of_day: stat.hour_of_day,
        day_of_week: stat.day_of_week,
        avg_reward: stat.avg_reward,
        total_posts: stat.total_posts,
        confidence_score: stat.confidence_score
      }));

    } catch (error) {
      console.error('❌ Error getting optimal times:', error);
      return [];
    }
  }
} 