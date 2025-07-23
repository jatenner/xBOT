import { supabaseClient } from './supabaseClient';

export interface EngagementAction {
  action_type: 'like' | 'reply' | 'follow' | 'retweet' | 'search';
  target_id: string; // tweet_id or user_id
  target_type: 'tweet' | 'user';
  content?: string; // For replies
  success: boolean;
  error_message?: string;
  response_data?: any;
  timestamp?: string;
}

export class EngagementDatabaseLogger {
  
  /**
   * 📊 LOG ENGAGEMENT ACTION TO DATABASE
   */
  static async logEngagement(action: EngagementAction): Promise<void> {
    try {
      if (!supabaseClient.supabase) {
        console.warn('⚠️ Database not available - logging to console only');
        console.log(`📝 ENGAGEMENT LOG: ${action.action_type} ${action.target_type} ${action.target_id} - ${action.success ? 'SUCCESS' : 'FAILED'}`);
        return;
      }

      const engagementData = {
        action_type: action.action_type,
        target_id: action.target_id,
        target_type: action.target_type,
        content: action.content || null,
        success: action.success,
        error_message: action.error_message || null,
        response_data: action.response_data ? JSON.stringify(action.response_data) : null,
        created_at: action.timestamp || new Date().toISOString()
      };

      const { error } = await supabaseClient.supabase
        .from('engagement_history')
        .insert(engagementData);

      if (error) {
        console.warn('⚠️ Database logging failed - using console fallback:', error.message);
        console.log(`📝 ENGAGEMENT LOG: ${action.action_type} ${action.target_type} ${action.target_id} - ${action.success ? 'SUCCESS' : 'FAILED'}`);
        // Don't throw - engagement logging shouldn't break the main flow
      } else {
        console.log(`✅ Logged ${action.action_type} action for ${action.target_type} ${action.target_id}`);
      }

    } catch (error) {
      console.warn('❌ Engagement logging error - using console fallback:', error);
      console.log(`📝 ENGAGEMENT LOG: ${action.action_type} ${action.target_type} ${action.target_id} - ${action.success ? 'SUCCESS' : 'FAILED'}`);
      // Don't throw - this is logging only
    }
  }

  /**
   * 📈 GET TODAY'S ENGAGEMENT STATS
   */
  static async getTodaysEngagementStats(): Promise<{
    likes: number;
    replies: number;
    follows: number;
    retweets: number;
    total: number;
    success_rate: number;
  }> {
    try {
      if (!supabaseClient.supabase) {
        return { likes: 0, replies: 0, follows: 0, retweets: 0, total: 0, success_rate: 0 };
      }

      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabaseClient.supabase
        .from('engagement_history')
        .select('action_type, success')
        .gte('created_at', today + 'T00:00:00.000Z')
        .lt('created_at', today + 'T23:59:59.999Z');

      if (error) {
        console.error('❌ Failed to get engagement stats:', error);
        return { likes: 0, replies: 0, follows: 0, retweets: 0, total: 0, success_rate: 0 };
      }

      const stats = {
        likes: 0,
        replies: 0,
        follows: 0,
        retweets: 0,
        total: 0,
        success_rate: 0
      };

      let successCount = 0;

      (data || []).forEach((record: any) => {
        stats.total++;
        
        if (record.success) {
          successCount++;
          
          switch (record.action_type) {
            case 'like':
              stats.likes++;
              break;
            case 'reply':
              stats.replies++;
              break;
            case 'follow':
              stats.follows++;
              break;
            case 'retweet':
              stats.retweets++;
              break;
          }
        }
      });

      stats.success_rate = stats.total > 0 ? (successCount / stats.total) * 100 : 0;

      return stats;

    } catch (error) {
      console.error('❌ Error getting engagement stats:', error);
      return { likes: 0, replies: 0, follows: 0, retweets: 0, total: 0, success_rate: 0 };
    }
  }

  /**
   * 🚫 CHECK RATE LIMITS FOR ENGAGEMENT
   */
  static async checkEngagementRateLimits(): Promise<{
    canLike: boolean;
    canReply: boolean;
    canFollow: boolean;
    canRetweet: boolean;
    dailyLikes: number;
    dailyReplies: number;
    dailyFollows: number;
    dailyRetweets: number;
  }> {
    const stats = await this.getTodaysEngagementStats();
    
    // Twitter API v2 Free Tier Daily Limits
    const DAILY_LIMITS = {
      LIKES: 1000,
      REPLIES: 300,
      FOLLOWS: 400,
      RETWEETS: 300
    };

    return {
      canLike: stats.likes < DAILY_LIMITS.LIKES,
      canReply: stats.replies < DAILY_LIMITS.REPLIES,
      canFollow: stats.follows < DAILY_LIMITS.FOLLOWS,
      canRetweet: stats.retweets < DAILY_LIMITS.RETWEETS,
      dailyLikes: stats.likes,
      dailyReplies: stats.replies,
      dailyFollows: stats.follows,
      dailyRetweets: stats.retweets
    };
  }

  /**
   * 🛠️ ENSURE ENGAGEMENT HISTORY TABLE EXISTS
   */
  static async ensureEngagementTableExists(): Promise<boolean> {
    try {
      if (!supabaseClient.supabase) {
        console.warn('⚠️ Database not available');
        return false;
      }

      // Test if table exists by trying to query it
      const { error } = await supabaseClient.supabase
        .from('engagement_history')
        .select('id')
        .limit(1);

      if (error && error.message.includes('does not exist')) {
        console.log('📋 Creating engagement_history table...');
        
        // The table will be created by the database migration
        // For now, just log that we need it
        console.warn('⚠️ engagement_history table needs to be created in database');
        console.log('📝 Required SQL:');
        console.log(`
CREATE TABLE IF NOT EXISTS engagement_history (
  id SERIAL PRIMARY KEY,
  action_type VARCHAR(20) NOT NULL,
  target_id VARCHAR(50) NOT NULL,
  target_type VARCHAR(10) NOT NULL,
  content TEXT,
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  response_data TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_engagement_history_created_at ON engagement_history(created_at);
CREATE INDEX IF NOT EXISTS idx_engagement_history_action_type ON engagement_history(action_type);
`);
        
        return false;
      }

      console.log('✅ engagement_history table is ready');
      return true;

    } catch (error) {
      console.error('❌ Error checking engagement table:', error);
      return false;
    }
  }
} 