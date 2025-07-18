import { createClient, SupabaseClient, PostgrestError } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

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
  
  // Configuration properties for compatibility (UPDATED for smart orchestration)
  public fallbackStaggerMinutes: number = 120; // 2 hours between posts
  public maxPostsPerHour: number = 1;          // Maximum 1 post per hour
  public maxPostsPerDay: number = 6;           // 6 perfectly spaced posts per day
  public minInterval: number = 20;
  public quality = { readabilityMin: 55, credibilityMin: 0.85 };
  public postingStrategy: string = "nuclear_intelligence_unleashed";
  public emergencyMode: boolean = false;
  public disableLearning: boolean = false;
  public dailyBudgetLimit: number = 3;
  public startupThrottling: boolean = false;
  public respectOnlyRealTwitterLimits: boolean = true;

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

  // Retry helper with exponential back-off
  private async withRetries<T>(fn: () => Promise<T>): Promise<T> {
    const maxRetries = parseInt(process.env.SUPABASE_MAX_RETRIES ?? '3');
    let lastError: any;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        
        // Don't retry config missing errors
        if (error?.code === 'PGRST116') {
          throw error;
        }
        
        // Last attempt, don't wait
        if (attempt === maxRetries - 1) {
          break;
        }
        
        // Exponential back-off: 300ms → 600ms → 1200ms
        const delay = 300 * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
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
      const safeData = {
        ...tweetData,
        id: crypto.randomUUID()
      };
      
      const result = await this.withRetries(async () => {
        const { data, error } = await this.client!
          .from('tweets')
          .insert(safeData)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      });

      return result;
    } catch (error) {
      console.error('Error inserting tweet:', error);
      return null;
    }
  }

  // Enhanced database save with verification and retry logic
  async saveTweetToDatabase(tweetData: any, xResponse: any = null): Promise<Tweet | null> {
    const maxRetries = 3;
    let attempt = 0;
    let lastError = null;
    
    // Add X response data if available with safe ID handling
    if (xResponse && xResponse.data) {
      const tweetId = xResponse.data.id ?? crypto.randomUUID();
      tweetData.tweet_id = tweetId;
      tweetData.external_url = `https://twitter.com/${process.env.TWITTER_USERNAME}/status/${tweetId}`;
    }
    
    // Ensure required fields have defaults
    const safeTweetData = {
      ...tweetData,
      tweet_id: tweetData.tweet_id || crypto.randomUUID(),
      content_type: tweetData.content_type || 'general',
      content_category: tweetData.content_category || 'health_tech',
      source_attribution: tweetData.source_attribution || 'AI Generated',
      engagement_score: tweetData.engagement_score || 0,
      likes: tweetData.likes || 0,
      retweets: tweetData.retweets || 0,
      replies: tweetData.replies || 0,
      impressions: tweetData.impressions || 0,
      has_snap2health_cta: tweetData.has_snap2health_cta || false
    };
    
    while (attempt < maxRetries) {
      try {
        attempt++;
        console.log(`💾 Database save attempt ${attempt}/${maxRetries} for tweet: ${safeTweetData.tweet_id}`);
        
        // Use the retry wrapper for the database operation
        const result = await this.withRetries(async () => {
          const { data, error } = await this.client!
            .from('tweets')
            .select('*')
            .eq('tweet_id', safeTweetData.tweet_id)
            .maybeSingle();

          if (error) throw error;
          
          if (data) {
            console.log('✅ Tweet already exists in database');
            return data;
          }

          // Insert new tweet
          const { data: insertData, error: insertError } = await this.client!
            .from('tweets')
            .insert(safeTweetData)
            .select()
            .single();

          if (insertError) throw insertError;
          return insertData;
        });

        console.log('✅ Tweet successfully saved to database');
        return result;

      } catch (error: any) {
        lastError = error;
        console.error(`❌ Database save attempt ${attempt} failed:`, error.message);
        
        if (attempt >= maxRetries) {
          console.error('💥 All database save attempts failed');
          break;
        }
        
        // Wait before retry (but this is handled by withRetries now)
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
    
    return null;
  }

  // System logging
  async logDatabaseAction(action: string, data: any): Promise<void> {
    if (!this.checkClient()) return;
    
    try {
      await this.withRetries(async () => {
        const { error } = await this.client!
          .from('system_logs')
          .insert({
            action,
            data: JSON.stringify(data),
            created_at: new Date().toISOString()
          });
        
        if (error) throw error;
      });
    } catch (error) {
      console.error('Error logging database action:', error);
    }
  }

  // Check for missing tweets that were posted to X but not saved to DB
  async reconcileMissingTweets(): Promise<{ api_writes: number; db_tweets: number; missing: number } | null> {
    if (!this.checkClient()) return null;
    
    try {
      const [apiData, dbData] = await Promise.all([
        this.withRetries(async () => {
          const result = await this.client!
            .from('api_usage')
            .select('*')
            .eq('action', 'post_tweet');
          return result;
        }),
        this.withRetries(async () => {
          const result = await this.client!
            .from('tweets')
            .select('*');
          return result;
        })
      ]);

      if (apiData.error) throw apiData.error;
      if (dbData.error) throw dbData.error;

      const apiWrites = apiData.data?.length || 0;
      const dbTweets = dbData.data?.length || 0;
      const missing = Math.max(0, apiWrites - dbTweets);

      return { api_writes: apiWrites, db_tweets: dbTweets, missing };
    } catch (error) {
      console.error('Error reconciling missing tweets:', error);
      return null;
    }
  }

  async updateTweetEngagement(tweetId: string, engagementData: Partial<Pick<Tweet, 'likes' | 'retweets' | 'replies' | 'impressions' | 'engagement_score'>>): Promise<boolean> {
    if (!this.checkClient()) return false;

    try {
      const { error } = await this.withRetries(async () => {
        const result = await this.client!
          .from('tweets')
          .update({ ...engagementData, updated_at: new Date().toISOString() })
          .eq('tweet_id', tweetId);
        return result;
      });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating tweet engagement:', error);
      return false;
    }
  }

  async insertReply(replyData: Omit<Reply, 'id' | 'created_at' | 'updated_at'>): Promise<Reply | null> {
    if (!this.checkClient()) return null;

    try {
      const { data, error } = await this.withRetries(async () => {
        const result = await this.client!
          .from('replies')
          .insert(replyData)
          .select()
          .single();
        return result;
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error inserting reply:', error);
      return null;
    }
  }

  async insertTargetTweet(targetData: Omit<TargetTweet, 'id' | 'created_at' | 'updated_at'>): Promise<TargetTweet | null> {
    if (!this.checkClient()) return null;

    try {
      const { data, error } = await this.withRetries(async () => {
        const result = await this.client!
          .from('target_tweets')
          .insert(targetData)
          .select()
          .single();
        return result;
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error inserting target tweet:', error);
      return null;
    }
  }

  async getUnrepliedTargets(limit: number = 10): Promise<TargetTweet[]> {
    if (!this.checkClient()) return [];

    try {
      const { data, error } = await this.withRetries(async () => {
        const result = await this.client!
          .from('target_tweets')
          .select('*')
          .eq('has_replied', false)
          .order('reply_potential_score', { ascending: false })
          .limit(limit);
        return result;
      });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching unreplied targets:', error);
      return [];
    }
  }

  async getBotConfig(key: string): Promise<string | null> {
    if (!this.checkClient()) return null;

    try {
      const { data, error } = await this.withRetries(async () => {
        const result = await this.client!
          .from('bot_config')
          .select('value')
          .eq('key', key)
          .single();
        return result;
      });

      if (error) throw error;
      return data?.value || null;
    } catch (error) {
      console.error('Error fetching bot config:', error);
      return null;
    }
  }

  async setBotConfig(key: string, value: string): Promise<boolean> {
    if (!this.checkClient()) return false;

    try {
      const { error } = await this.withRetries(async () => {
        const result = await this.client!
          .from('bot_config')
          .upsert({ key, value });
        return result;
      });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error setting bot config:', error);
      return false;
    }
  }

  async recordEngagement(data: Omit<EngagementAnalytics, 'id' | 'recorded_at'>): Promise<boolean> {
    if (!this.checkClient()) return false;

    try {
      const { error } = await this.withRetries(async () => {
        const result = await this.client!
          .from('engagement_analytics')
          .insert(data);
        return result;
      });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error recording engagement:', error);
      return false;
    }
  }

  async getTweetCountLastHour(): Promise<number> {
    if (!this.checkClient()) return 0;

    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count, error } = await this.withRetries(async () => {
        const result = await this.client!
          .from('tweets')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', oneHourAgo);
        return result;
      });

      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error('Error getting tweet count:', error);
      return 0;
    }
  }

  async getReplyCountLastHour(): Promise<number> {
    if (!this.checkClient()) return 0;

    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count, error } = await this.withRetries(async () => {
        const result = await this.client!
          .from('replies')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', oneHourAgo);
        return result;
      });

      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error('Error getting reply count:', error);
      return 0;
    }
  }

  async isBotEnabled(): Promise<boolean> {
    const enabled = await this.getBotConfig('enabled');
    return enabled === 'true';
  }

  // Learning system methods
  async storeLearningInsight(data: Omit<LearningInsight, 'id' | 'created_at' | 'expires_at'>): Promise<LearningInsight | null> {
    if (!this.checkClient()) return null;

    try {
      const { data: result, error } = await this.withRetries(async () => {
        const response = await this.client!
          .from('learning_insights')
          .insert(data)
          .select()
          .single();
        return response;
      });

      if (error) throw error;
      return result;
    } catch (error) {
      console.error('Error storing learning insight:', error);
      return null;
    }
  }

  async getLearningInsights(type?: string | number, limit: number = 50): Promise<LearningInsight[]> {
    if (!this.checkClient()) return [];

    try {
      let query = this.client!
        .from('learning_insights')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      // Handle both string type and number type for backwards compatibility
      if (type !== undefined) {
        if (typeof type === 'string') {
          query = query.eq('insight_type', type);
        } else {
          // Legacy number type - convert to string equivalent
          const typeMap: { [key: number]: string } = {
            1: 'content_style',
            2: 'timing_optimization',
            3: 'engagement_pattern',
            4: 'topic_performance'
          };
          const mappedType = typeMap[type];
          if (mappedType) {
            query = query.eq('insight_type', mappedType);
          }
        }
      }

      const { data, error } = await this.withRetries(async () => {
        const result = await query;
        return result;
      });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching learning insights:', error);
      return [];
    }
  }

  // Content theme learning
  async updateContentTheme(themeName: string, engagement: number, tweetId?: string): Promise<boolean> {
    if (!this.checkClient()) return false;

    try {
      const { data: existing } = await this.withRetries(async () => {
        const result = await this.client!
          .from('content_themes')
          .select('*')
          .eq('theme_name', themeName)
          .single();
        return result;
      });

      if (existing) {
        const newTotalPosts = existing.total_posts + 1;
        const newAvgEngagement = ((existing.avg_engagement * existing.total_posts) + engagement) / newTotalPosts;
        
        let updateData: any = {
          avg_engagement: newAvgEngagement,
          total_posts: newTotalPosts,
          last_used: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        // Update best performing tweet if this one is better
        if (tweetId && engagement > existing.avg_engagement) {
          updateData.best_performing_tweet_id = tweetId;
        }

        const { error } = await this.withRetries(async () => {
          const result = await this.client!
            .from('content_themes')
            .update(updateData)
            .eq('theme_name', themeName);
          return result;
        });

        if (error) throw error;
      } else {
        const { error } = await this.withRetries(async () => {
          const result = await this.client!
            .from('content_themes')
            .insert({
              theme_name: themeName,
              keywords: [themeName],
              avg_engagement: engagement,
              total_posts: 1,
              best_performing_tweet_id: tweetId,
              last_used: new Date().toISOString()
            });
          return result;
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
      const { data, error } = await this.withRetries(async () => {
        const result = await this.client!
          .from('content_themes')
          .select('*')
          .gte('total_posts', 3) // Only return themes with at least 3 posts
          .order('avg_engagement', { ascending: false })
          .limit(limit);
        return result;
      });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching best content themes:', error);
      return [];
    }
  }

  // Timing optimization
  async updateTimingInsight(hour: number, dayOfWeek: number, engagement: number): Promise<boolean> {
    if (!this.checkClient()) return false;

    try {
      const { data: existing } = await this.withRetries(async () => {
        const result = await this.client!
          .from('timing_insights')
          .select('*')
          .eq('hour_of_day', hour)
          .eq('day_of_week', dayOfWeek)
          .single();
        return result;
      });

      if (existing) {
        const newPostCount = existing.post_count + 1;
        const newAvgEngagement = ((existing.avg_engagement * existing.post_count) + engagement) / newPostCount;
        const newConfidenceLevel = Math.min(1.0, newPostCount / 10); // Max confidence after 10 posts

        const { error } = await this.withRetries(async () => {
          const result = await this.client!
            .from('timing_insights')
            .update({
              avg_engagement: newAvgEngagement,
              post_count: newPostCount,
              confidence_level: newConfidenceLevel,
              last_updated: new Date().toISOString()
            })
            .eq('hour_of_day', hour)
            .eq('day_of_week', dayOfWeek);
          return result;
        });

        if (error) throw error;
      } else {
        const { error } = await this.withRetries(async () => {
          const result = await this.client!
            .from('timing_insights')
            .insert({
              hour_of_day: hour,
              day_of_week: dayOfWeek,
              avg_engagement: engagement,
              post_count: 1,
              confidence_level: 0.1
            });
          return result;
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
      const { data, error } = await this.withRetries(async () => {
        const result = await this.client!
          .from('timing_insights')
          .select('*')
          .gte('confidence_level', 0.3) // Only return times with some confidence
          .order('avg_engagement', { ascending: false })
          .limit(limit);
        return result;
      });

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
      const { data: existing } = await this.withRetries(async () => {
        const result = await this.client!
          .from('style_performance')
          .select('*')
          .eq('style_type', style)
          .single();
        return result;
      });

      const isSuccessful = engagement >= threshold;

      if (existing) {
        const newTotalPosts = existing.total_posts + 1;
        const newAvgEngagement = ((existing.avg_engagement * existing.total_posts) + engagement) / newTotalPosts;
        
        // Calculate new success rate
        const successfulPosts = Math.round(existing.success_rate * existing.total_posts) + (isSuccessful ? 1 : 0);
        const newSuccessRate = successfulPosts / newTotalPosts;

        const { error } = await this.withRetries(async () => {
          const result = await this.client!
            .from('style_performance')
            .update({
              avg_engagement: newAvgEngagement,
              total_posts: newTotalPosts,
              success_rate: newSuccessRate,
              last_updated: new Date().toISOString()
            })
            .eq('style_type', style);
          return result;
        });

        if (error) throw error;
      } else {
        const { error } = await this.withRetries(async () => {
          const result = await this.client!
            .from('style_performance')
            .insert({
              style_type: style,
              avg_engagement: engagement,
              total_posts: 1,
              success_rate: isSuccessful ? 1 : 0
            });
          return result;
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
      const { data, error } = await this.withRetries(async () => {
        const result = await this.client!
          .from('style_performance')
          .select('*')
          .gte('total_posts', 3) // Only return styles with at least 3 posts
          .order('success_rate', { ascending: false });
        return result;
      });

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
      const { data, error } = await this.withRetries(async () => {
        const result = await this.client!
          .from('tweets')
          .select('*')
          .gte('created_at', daysAgo)
          .order('created_at', { ascending: false });
        return result;
      });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching recent tweets:', error);
      return [];
    }
  }

  async getTimingInsights(): Promise<any[]> {
    try {
      const { data, error } = await this.withRetries(async () => {
        const result = await this.client!
          .from('timing_insights')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10);
        return result;
      });

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
      const { data, error } = await this.withRetries(async () => {
        const result = await this.client!
          .from('learning_insights')
          .select('*')
          .eq('insight_type', 'research')
          .order('created_at', { ascending: false })
          .limit(limit);
        return result;
      });

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

      const { data, error } = await this.withRetries(async () => {
        const result = await query;
        return result;
      });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching tweets:', error);
      return [];
    }
  }

  async getTweetById(id: string): Promise<any | null> {
    if (!this.client) {
      console.warn('Supabase client not initialized');
      return null;
    }
    return this.withRetries(async () => 
      await this.client!.from('tweets').select('*').eq('id', id).single()
    );
  }

  async getConfig(key: string): Promise<any | null> {
    if (!this.client) {
      console.warn('Supabase client not initialized');
      return null;
    }
    
    return this.withRetries(async () => 
      await this.client!.from('bot_config').select('value').eq('key', key).single()
    );
  }

  async updateConfig(key: string, value: any): Promise<void> {
    if (!this.client) {
      console.warn('Supabase client not initialized');
      return;
    }
    
    try {
      const { error } = await this.withRetries(async () => 
        await this.client!.from('bot_config').upsert({ key, value })
      );
      if (error) throw error;
    } catch (error) {
      console.error('Error updating config:', error);
    }
  }

  async getTweetsSince(since: Date): Promise<any[]> {
    if (!this.client) {
      console.warn('Supabase client not initialized');
      return [];
    }
    
    try {
      const { data, error } = await this.withRetries(async () => 
        await this.client!.from('tweets')
          .select('*')
          .gte('created_at', since.toISOString())
          .order('created_at', { ascending: false })
      );
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching tweets since:', error);
      return [];
    }
  }

  async saveTweet(tweet: any): Promise<any | null> {
    if (!this.client) {
      console.warn('Supabase client not initialized');
      return null;
    }
    
    return this.withRetries(async () => 
      await this.client!.from('tweets').insert(tweet)
    );
  }

  async saveEngagementMetrics(tweetId: string, metrics: any): Promise<any | null> {
    if (!this.client) {
      console.warn('Supabase client not initialized');
      return null;
    }
    
    return this.withRetries(async () => 
      await this.client!.from('engagement_history').insert({
        tweet_id: tweetId,
        likes: metrics.likes || 0,
        retweets: metrics.retweets || 0,
        replies: metrics.replies || 0,
        impressions: metrics.impressions || 0
      })
    );
  }

  async searchKnowledge(query: string, limit: number = 10): Promise<any[]> {
    if (!this.client) {
      console.warn('Supabase client not initialized');
      return [];
    }
    
    try {
      const { data, error } = await this.withRetries(async () => 
        await this.client!.from('knowledge_store')
          .select('*')
          .textSearch('text', query)
          .limit(limit)
      );
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error searching knowledge:', error);
      return [];
    }
  }

  async saveKnowledge(source: string, sourceId: string, text: string, embedding: number[], metadata: any = {}): Promise<any | null> {
    if (!this.client) {
      console.warn('Supabase client not initialized');
      return null;
    }
    
    return this.withRetries(async () => 
      await this.client!.from('knowledge_store').insert({
        source,
        source_id: sourceId,
        text,
        embedding,
        metadata
      })
    );
  }
}

export const supabaseClient = new SupabaseService();

// Export direct client access for new utilities that need raw supabase access
const serviceInstance = new SupabaseService();
export const supabase = serviceInstance['client']; 