import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Database types
export interface Tweet {
  id: string;
  tweet_id: string;
  content: string;
  tweet_type: string;
  content_type?: string;
  content_category?: string;
  source_attribution?: string;
  engagement_score: number;
  likes: number;
  retweets: number;
  replies: number;
  impressions: number;
  has_snap2health_cta: boolean;
  created_at: string;
  updated_at: string;
}

export interface Reply {
  id: string;
  reply_id: string;
  parent_tweet_id: string;
  content: string;
  engagement_score: number;
  likes: number;
  retweets: number;
  replies: number;
  created_at: string;
  updated_at: string;
}

export interface TargetTweet {
  id: string;
  tweet_id: string;
  author_username: string;
  content: string;
  engagement_score: number;
  reply_potential_score: number;
  has_replied: boolean;
  created_at: string;
  updated_at: string;
}

export interface EngagementAnalytics {
  id: string;
  content_type: string;
  content_id: string;
  metric_type: string;
  engagement_score: number;
  reach_score: number;
  recorded_at: string;
}

export interface BotConfig {
  id: string;
  key: string;
  value: string;
  description?: string;
  updated_at: string;
}

// Learning system interfaces
export interface LearningInsight {
  id: string;
  insight_type: string;
  insight_data: any;
  confidence_score: number;
  performance_impact: number;
  sample_size: number;
  created_at: string;
  expires_at: string;
}

export interface ContentTheme {
  id: string;
  theme_name: string;
  keywords: string[];
  avg_engagement: number;
  total_posts: number;
  best_performing_tweet_id?: string;
  last_used?: string;
  created_at: string;
  updated_at: string;
}

export interface TimingInsight {
  id: string;
  hour_of_day: number;
  day_of_week: number;
  avg_engagement: number;
  post_count: number;
  confidence_level: number;
  last_updated: string;
}

export interface StylePerformance {
  id: string;
  style_type: string;
  avg_engagement: number;
  total_posts: number;
  success_rate: number;
  last_updated: string;
}

class SupabaseService {
  private client: SupabaseClient | null = null;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      if (process.env.NODE_ENV === 'test' || process.argv.includes('--test')) {
        console.warn('⚠️  Running in test mode without Supabase credentials');
        return;
      }
      throw new Error('Missing Supabase credentials in environment variables');
    }

    this.client = createClient(supabaseUrl, supabaseKey);
  }

  // Public getter for direct client access when needed
  get supabase(): SupabaseClient | null {
    return this.client;
  }

  private checkClient() {
    if (!this.client) {
      console.warn('Supabase client not initialized (test mode)');
      return false;
    }
    return true;
  }

  // Tweet operations
  async insertTweet(tweetData: Omit<Tweet, 'id' | 'created_at' | 'updated_at'>): Promise<Tweet | null> {
    if (!this.client) {
      console.warn('Supabase client not initialized (test mode)');
      return null;
    }
    try {
      const { data, error } = await this.client
        .from('tweets')
        .insert(tweetData)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error inserting tweet:', error);
      return null;
    }
  }

  async updateTweetEngagement(tweetId: string, engagementData: Partial<Pick<Tweet, 'likes' | 'retweets' | 'replies' | 'impressions' | 'engagement_score'>>): Promise<boolean> {
    try {
      const { error } = await this.client
        .from('tweets')
        .update({ ...engagementData, updated_at: new Date().toISOString() })
        .eq('tweet_id', tweetId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating tweet engagement:', error);
      return false;
    }
  }

  // Reply operations
  async insertReply(replyData: Omit<Reply, 'id' | 'created_at' | 'updated_at'>): Promise<Reply | null> {
    try {
      const { data, error } = await this.client
        .from('replies')
        .insert(replyData)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error inserting reply:', error);
      return null;
    }
  }

  // Target tweet operations
  async insertTargetTweet(targetData: Omit<TargetTweet, 'id' | 'created_at' | 'updated_at'>): Promise<TargetTweet | null> {
    try {
      const { data, error } = await this.client
        .from('target_tweets')
        .insert(targetData)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error inserting target tweet:', error);
      return null;
    }
  }

  async getUnrepliedTargets(limit: number = 10): Promise<TargetTweet[]> {
    try {
      const { data, error } = await this.client
        .from('target_tweets')
        .select('*')
        .eq('has_replied', false)
        .order('reply_potential_score', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching unreplied targets:', error);
      return [];
    }
  }

  // Bot configuration
  async getBotConfig(key: string): Promise<string | null> {
    try {
      const { data, error } = await this.client
        .from('bot_config')
        .select('value')
        .eq('key', key)
        .single();

      if (error) throw error;
      return data?.value || null;
    } catch (error) {
      console.error(`Error fetching bot config for key ${key}:`, error);
      return null;
    }
  }

  async setBotConfig(key: string, value: string): Promise<boolean> {
    try {
      const { error } = await this.client
        .from('bot_config')
        .upsert({ key, value, updated_at: new Date().toISOString() });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error(`Error setting bot config for key ${key}:`, error);
      return false;
    }
  }

  // Analytics
  async recordEngagement(data: Omit<EngagementAnalytics, 'id' | 'recorded_at'>): Promise<boolean> {
    try {
      const { error } = await this.client
        .from('engagement_analytics')
        .insert(data);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error recording engagement analytics:', error);
      return false;
    }
  }

  // Rate limiting helpers
  async getTweetCountLastHour(): Promise<number> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count, error } = await this.client
        .from('tweets')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', oneHourAgo);

      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error('Error getting tweet count:', error);
      return 0;
    }
  }

  async getReplyCountLastHour(): Promise<number> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count, error } = await this.client
        .from('replies')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', oneHourAgo);

      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error('Error getting reply count:', error);
      return 0;
    }
  }

  // Kill switch check
  async isBotEnabled(): Promise<boolean> {
    const enabled = await this.getBotConfig('enabled');
    return enabled === 'true';
  }

  // Learning insights methods
  async storeLearningInsight(data: Omit<LearningInsight, 'id' | 'created_at' | 'expires_at'>): Promise<LearningInsight | null> {
    if (!this.checkClient()) return null;
    
    try {
      const { data: insight, error } = await this.client!
        .from('learning_insights')
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return insight;
    } catch (error) {
      console.error('Error storing learning insight:', error);
      return null;
    }
  }

  async getLearningInsights(type?: string | number, limit: number = 50): Promise<LearningInsight[]> {
    if (!this.checkClient()) {
      return [];
    }
    
    try {
      let query = this.client!
        .from('learning_insights')
        .select('*')
        .order('created_at', { ascending: false });

      // If type is a number, treat it as limit, if string treat as type filter
      if (typeof type === 'number') {
        query = query.limit(type);
      } else if (typeof type === 'string') {
        query = query.eq('insight_type', type).limit(limit);
      } else {
        query = query.limit(limit);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching learning insights:', error);
      return [];
    }
  }

  // Content theme methods
  async updateContentTheme(themeName: string, engagement: number, tweetId?: string): Promise<boolean> {
    if (!this.checkClient()) return false;
    
    try {
      // Get existing theme or create new one
      const { data: existing } = await this.client!
        .from('content_themes')
        .select('*')
        .eq('theme_name', themeName)
        .single();

      if (existing) {
        // Update existing theme
        const newTotalPosts = existing.total_posts + 1;
        const newAvgEngagement = ((existing.avg_engagement * existing.total_posts) + engagement) / newTotalPosts;
        
        const updateData: any = {
          avg_engagement: newAvgEngagement,
          total_posts: newTotalPosts,
          last_used: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        if (tweetId && engagement > existing.avg_engagement) {
          updateData.best_performing_tweet_id = tweetId;
        }

        const { error } = await this.client!
          .from('content_themes')
          .update(updateData)
          .eq('theme_name', themeName);

        if (error) throw error;
      } else {
        // Create new theme
        const { error } = await this.client!
          .from('content_themes')
          .insert({
            theme_name: themeName,
            keywords: [],
            avg_engagement: engagement,
            total_posts: 1,
            best_performing_tweet_id: tweetId,
            last_used: new Date().toISOString()
          });

        if (error) throw error;
      }

      return true;
    } catch (error) {
      console.error('Error updating content theme:', error);
      return false;
    }
  }

  async getBestContentThemes(limit: number = 10): Promise<ContentTheme[]> {
    if (!this.checkClient()) return [];
    
    try {
      const { data, error } = await this.client!
        .from('content_themes')
        .select('*')
        .order('avg_engagement', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching content themes:', error);
      return [];
    }
  }

  // Timing insights methods
  async updateTimingInsight(hour: number, dayOfWeek: number, engagement: number): Promise<boolean> {
    if (!this.checkClient()) return false;
    
    try {
      // Get existing timing data
      const { data: existing } = await this.client!
        .from('timing_insights')
        .select('*')
        .eq('hour_of_day', hour)
        .eq('day_of_week', dayOfWeek)
        .single();

      if (existing) {
        // Update existing data
        const newPostCount = existing.post_count + 1;
        const newAvgEngagement = ((existing.avg_engagement * existing.post_count) + engagement) / newPostCount;
        const confidenceLevel = Math.min(newPostCount / 10, 1); // Max confidence at 10+ posts

        const { error } = await this.client!
          .from('timing_insights')
          .update({
            avg_engagement: newAvgEngagement,
            post_count: newPostCount,
            confidence_level: confidenceLevel,
            last_updated: new Date().toISOString()
          })
          .eq('hour_of_day', hour)
          .eq('day_of_week', dayOfWeek);

        if (error) throw error;
      } else {
        // Create new timing insight
        const { error } = await this.client!
          .from('timing_insights')
          .insert({
            hour_of_day: hour,
            day_of_week: dayOfWeek,
            avg_engagement: engagement,
            post_count: 1,
            confidence_level: 0.1
          });

        if (error) throw error;
      }

      return true;
    } catch (error) {
      console.error('Error updating timing insight:', error);
      return false;
    }
  }

  async getBestPostingTimes(limit: number = 5): Promise<TimingInsight[]> {
    if (!this.checkClient()) return [];
    
    try {
      const { data, error } = await this.client!
        .from('timing_insights')
        .select('*')
        .gte('confidence_level', 0.3) // Only return times with some confidence
        .order('avg_engagement', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching best posting times:', error);
      return [];
    }
  }

  // Style performance methods
  async updateStylePerformance(style: string, engagement: number, threshold: number = 5): Promise<boolean> {
    if (!this.checkClient()) return false;
    
    try {
      const { data: existing } = await this.client!
        .from('style_performance')
        .select('*')
        .eq('style_type', style)
        .single();

      const isSuccessful = engagement >= threshold;

      if (existing) {
        const newTotalPosts = existing.total_posts + 1;
        const newAvgEngagement = ((existing.avg_engagement * existing.total_posts) + engagement) / newTotalPosts;
        
        // Calculate new success rate
        const successfulPosts = Math.round(existing.success_rate * existing.total_posts) + (isSuccessful ? 1 : 0);
        const newSuccessRate = successfulPosts / newTotalPosts;

        const { error } = await this.client!
          .from('style_performance')
          .update({
            avg_engagement: newAvgEngagement,
            total_posts: newTotalPosts,
            success_rate: newSuccessRate,
            last_updated: new Date().toISOString()
          })
          .eq('style_type', style);

        if (error) throw error;
      } else {
        const { error } = await this.client!
          .from('style_performance')
          .insert({
            style_type: style,
            avg_engagement: engagement,
            total_posts: 1,
            success_rate: isSuccessful ? 1 : 0
          });

        if (error) throw error;
      }

      return true;
    } catch (error) {
      console.error('Error updating style performance:', error);
      return false;
    }
  }

  async getBestPerformingStyles(): Promise<StylePerformance[]> {
    if (!this.checkClient()) return [];
    
    try {
      const { data, error } = await this.client!
        .from('style_performance')
        .select('*')
        .gte('total_posts', 3) // Only return styles with at least 3 posts
        .order('success_rate', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching style performance:', error);
      return [];
    }
  }

  // Recent tweets for learning
  async getRecentTweets(days: number = 7): Promise<Tweet[]> {
    if (!this.checkClient()) return [];
    
    try {
      const daysAgo = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await this.client!
        .from('tweets')
        .select('*')
        .gte('created_at', daysAgo)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching recent tweets:', error);
      return [];
    }
  }

  async getTimingInsights(): Promise<any[]> {
    try {
      const { data, error } = await this.client
        .from('timing_insights')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error fetching timing insights:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getTimingInsights:', error);
      return [];
    }
  }

  async getResearchInsights(limit: number = 5): Promise<any[]> {
    if (!this.checkClient()) {
      return [];
    }

    try {
      const { data, error } = await this.client
        .from('learning_insights')
        .select('*')
        .eq('insight_type', 'research')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching research insights:', error);
      return [];
    }
  }

  async getTweets(options: { limit?: number; days?: number } = {}): Promise<Tweet[]> {
    if (!this.checkClient()) {
      return [];
    }

    try {
      let query = this.client!
        .from('tweets')
        .select('*')
        .order('created_at', { ascending: false });

      if (options.limit) {
        query = query.limit(options.limit);
      }

      if (options.days) {
        const daysAgo = new Date();
        daysAgo.setDate(daysAgo.getDate() - options.days);
        query = query.gte('created_at', daysAgo.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching tweets:', error);
      return [];
    }
  }
}

export const supabaseClient = new SupabaseService();

// Export direct client access for new utilities that need raw supabase access
const serviceInstance = new SupabaseService();
export const supabase = serviceInstance['client']; 