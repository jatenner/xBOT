/**
 * 🔄 DATA STORE MIGRATION ADAPTER
 * ================================
 * 
 * This adapter gradually migrates from Supabase to Redis without breaking the system.
 * It provides the same interface as Supabase but uses Redis under the hood.
 * 
 * Phase 1: All new data goes to Redis, reads try Redis first then Supabase
 * Phase 2: Migrate existing data from Supabase to Redis
 * Phase 3: Remove Supabase completely
 */

import { redisDataStore } from './redisDataStore';
import { supabaseClient } from '../utils/supabaseClient';

interface MigrationResult {
  success: boolean;
  source: 'redis' | 'supabase' | 'fallback';
  error?: string;
  data?: any;
}

export class DataStoreMigrationAdapter {
  private static readonly REDIS_ENABLED = true; // Feature flag
  private static readonly SUPABASE_FALLBACK = true; // Fallback to Supabase if Redis fails

  /**
   * 🐦 STORE TWEET (REDIS FIRST)
   */
  static async storeTweet(tweetData: any): Promise<MigrationResult> {
    console.log('📝 Storing tweet via Migration Adapter...');

    // Try Redis first
    if (this.REDIS_ENABLED) {
      try {
        const redisResult = await redisDataStore.storeTweet({
          tweet_id: tweetData.tweet_id,
          content: tweetData.content,
          posted_at: tweetData.posted_at || new Date().toISOString(),
          likes: tweetData.likes || 0,
          retweets: tweetData.retweets || 0,
          replies: tweetData.replies || 0,
          impressions: tweetData.impressions || 0,
          engagement_score: tweetData.engagement_score || 0,
          viral_score: tweetData.viral_score || 5,
          content_type: tweetData.content_type || 'health_content',
          ai_generated: true,
          ...tweetData
        });

        if (redisResult.success) {
          console.log('✅ Tweet stored in Redis successfully');
          return {
            success: true,
            source: 'redis',
            data: { id: tweetData.tweet_id }
          };
        }
      } catch (error) {
        console.warn('⚠️ Redis storage failed, trying Supabase fallback:', error);
      }
    }

    // Fallback to Supabase if Redis fails
    if (this.SUPABASE_FALLBACK) {
      try {
        const { data, error } = await supabaseClient.supabase
          .from('tweets')
          .insert({
            tweet_id: tweetData.tweet_id,
            content: tweetData.content,
            tweet_type: tweetData.tweet_type || 'original',
            content_type: tweetData.content_type || 'health_content',
            viral_score: tweetData.viral_score || 5,
            ai_growth_prediction: tweetData.ai_growth_prediction || 5,
            ai_optimized: tweetData.ai_optimized || true,
            generation_method: tweetData.generation_method || 'ai_enhanced',
            created_at: new Date().toISOString()
          })
          .select('id')
          .single();

        if (!error) {
          console.log('✅ Tweet stored in Supabase (fallback)');
          return {
            success: true,
            source: 'supabase',
            data
          };
        } else {
          console.error('❌ Supabase storage also failed:', error);
        }
      } catch (supabaseError) {
        console.error('❌ Supabase storage error:', supabaseError);
      }
    }

    return {
      success: false,
      source: 'fallback',
      error: 'Both Redis and Supabase storage failed'
    };
  }

  /**
   * 📖 GET TWEET (REDIS FIRST, SUPABASE FALLBACK)
   */
  static async getTweet(tweetId: string): Promise<MigrationResult> {
    // Try Redis first
    if (this.REDIS_ENABLED) {
      try {
        const redisData = await redisDataStore.getTweet(tweetId);
        if (redisData) {
          return {
            success: true,
            source: 'redis',
            data: redisData
          };
        }
      } catch (error) {
        console.warn('⚠️ Redis read failed, trying Supabase:', error);
      }
    }

    // Fallback to Supabase
    if (this.SUPABASE_FALLBACK) {
      try {
        const { data, error } = await supabaseClient.supabase
          .from('tweets')
          .select('*')
          .eq('tweet_id', tweetId)
          .single();

        if (!error && data) {
          // Optionally migrate to Redis for future reads
          if (this.REDIS_ENABLED) {
            await redisDataStore.storeTweet({
              tweet_id: data.tweet_id,
              content: data.content,
              posted_at: data.created_at,
              likes: data.likes || 0,
              retweets: data.retweets || 0,
              replies: data.replies || 0,
              impressions: data.impressions || 0,
              engagement_score: data.engagement_score || 0,
              viral_score: data.viral_score || 5,
              content_type: data.content_type,
              ai_generated: true
            });
            console.log('📤 Migrated tweet to Redis for future reads');
          }

          return {
            success: true,
            source: 'supabase',
            data
          };
        }
      } catch (supabaseError) {
        console.error('❌ Supabase read error:', supabaseError);
      }
    }

    return {
      success: false,
      source: 'fallback',
      error: 'Tweet not found in Redis or Supabase'
    };
  }

  /**
   * 📊 STORE ANALYTICS (REDIS ONLY - NO SCHEMA ISSUES)
   */
  static async storeAnalytics(analyticsData: any): Promise<MigrationResult> {
    console.log('📊 Storing analytics via Redis (bypassing Supabase schema issues)...');

    try {
      const result = await redisDataStore.storeAnalytics({
        tweet_id: analyticsData.tweet_id,
        likes: analyticsData.likes || 0,
        retweets: analyticsData.retweets || 0,
        replies: analyticsData.replies || 0,
        impressions: analyticsData.impressions || 0,
        engagement_rate: analyticsData.engagement_rate || 0,
        collected_at: new Date().toISOString(),
        ...analyticsData
      });

      if (result.success) {
        return {
          success: true,
          source: 'redis',
          data: { stored: true }
        };
      }
    } catch (error) {
      console.error('❌ Redis analytics storage failed:', error);
    }

    return {
      success: false,
      source: 'fallback',
      error: 'Analytics storage failed'
    };
  }

  /**
   * 🧠 STORE LEARNING DATA (REDIS ONLY - AVOID SCHEMA PROBLEMS)
   */
  static async storeLearningData(learningData: any): Promise<MigrationResult> {
    console.log('🧠 Storing learning data via Redis (bypassing schema issues)...');

    try {
      const result = await redisDataStore.storeLearningData({
        post_id: learningData.post_id || learningData.tweet_id,
        content: learningData.content,
        engagement_metrics: learningData.engagement_metrics || {},
        quality_score: learningData.quality_score || 0,
        format_type: learningData.format_type || 'unknown',
        hook_type: learningData.hook_type || 'unknown',
        learned_at: new Date().toISOString(),
        ...learningData
      });

      if (result.success) {
        return {
          success: true,
          source: 'redis',
          data: { stored: true }
        };
      }
    } catch (error) {
      console.error('❌ Redis learning storage failed:', error);
    }

    return {
      success: false,
      source: 'fallback',
      error: 'Learning data storage failed'
    };
  }

  /**
   * 📈 GET DAILY TWEET COUNT
   */
  static async getDailyTweetCount(date?: string): Promise<number> {
    // Try Redis first
    if (this.REDIS_ENABLED) {
      try {
        const count = await redisDataStore.getDailyTweetCount(date);
        if (count !== undefined) {
          return count;
        }
      } catch (error) {
        console.warn('⚠️ Redis daily count failed, trying Supabase:', error);
      }
    }

    // Fallback to Supabase
    if (this.SUPABASE_FALLBACK) {
      try {
        const today = date || new Date().toISOString().split('T')[0];
        const { data, error } = await supabaseClient.supabase
          .from('tweets')
          .select('id')
          .gte('created_at', `${today}T00:00:00.000Z`)
          .lt('created_at', `${today}T23:59:59.999Z`);

        if (!error && data) {
          return data.length;
        }
      } catch (supabaseError) {
        console.error('❌ Supabase daily count error:', supabaseError);
      }
    }

    return 0;
  }

  /**
   * 🎰 STORE BANDIT DATA (REDIS ONLY)
   */
  static async storeBanditArm(armId: string, armData: any): Promise<MigrationResult> {
    try {
      const result = await redisDataStore.storeBanditArm(armId, armData);
      return {
        success: result.success,
        source: 'redis',
        data: result.success ? { stored: true } : undefined,
        error: result.error
      };
    } catch (error) {
      return {
        success: false,
        source: 'fallback',
        error: error.message
      };
    }
  }

  /**
   * 🎰 GET ALL BANDIT ARMS (REDIS ONLY)
   */
  static async getAllBanditArms(): Promise<any[]> {
    try {
      return await redisDataStore.getAllBanditArms();
    } catch (error) {
      console.error('❌ Failed to get bandit arms:', error);
      return [];
    }
  }

  /**
   * 🔍 HEALTH CHECK
   */
  static async healthCheck(): Promise<{
    redis: boolean;
    supabase: boolean;
    overall: 'healthy' | 'degraded' | 'down';
  }> {
    const redisHealth = await redisDataStore.isHealthy();
    
    let supabaseHealth = false;
    try {
      const { data, error } = await supabaseClient.supabase
        .from('tweets')
        .select('id')
        .limit(1);
      supabaseHealth = !error;
    } catch (error) {
      supabaseHealth = false;
    }

    let overall: 'healthy' | 'degraded' | 'down';
    if (redisHealth && supabaseHealth) {
      overall = 'healthy';
    } else if (redisHealth || supabaseHealth) {
      overall = 'degraded';
    } else {
      overall = 'down';
    }

    return {
      redis: redisHealth,
      supabase: supabaseHealth,
      overall
    };
  }

  /**
   * 📊 GET MIGRATION STATS
   */
  static async getMigrationStats(): Promise<any> {
    try {
      const redisStats = await redisDataStore.getSystemStats();
      const health = await this.healthCheck();

      return {
        migration_status: 'active',
        redis_enabled: this.REDIS_ENABLED,
        supabase_fallback: this.SUPABASE_FALLBACK,
        health_status: health,
        redis_stats: redisStats,
        last_checked: new Date().toISOString()
      };
    } catch (error) {
      return {
        migration_status: 'error',
        error: error.message,
        last_checked: new Date().toISOString()
      };
    }
  }
}

// Export for easy importing
export const dataStore = DataStoreMigrationAdapter;