/**
 * 🚀 REDIS DATA STORE - COMPLETE SUPABASE REPLACEMENT
 * =====================================================
 * 
 * This completely replaces Supabase with Redis for all data operations.
 * Eliminates schema cache issues, column mismatches, and connection problems.
 * 
 * Features:
 * - ✅ Zero schema issues (schemaless)
 * - ✅ Lightning fast (sub-millisecond)
 * - ✅ Perfect for JSON data
 * - ✅ Built-in time-series support
 * - ✅ Automatic expiration
 * - ✅ Railway native support
 */

import Redis from 'ioredis';

// Environment variables from Railway Redis service
const REDIS_URL = process.env.REDIS_URL || process.env.REDIS_CONNECTION_STRING;
const REDIS_HOST = process.env.REDISHOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDISPORT || '6379');
const REDIS_PASSWORD = process.env.REDISPASSWORD;

interface TweetData {
  tweet_id: string;
  content: string;
  posted_at: string;
  likes?: number;
  retweets?: number;
  replies?: number;
  impressions?: number;
  engagement_score?: number;
  viral_score?: number;
  content_type?: string;
  ai_generated?: boolean;
  [key: string]: any;
}

interface AnalyticsData {
  tweet_id: string;
  likes: number;
  retweets: number;
  replies: number;
  impressions: number;
  engagement_rate: number;
  collected_at: string;
  [key: string]: any;
}

interface LearningData {
  post_id: string;
  content: string;
  engagement_metrics: any;
  quality_score: number;
  format_type: string;
  hook_type: string;
  learned_at: string;
  [key: string]: any;
}

export class RedisDataStore {
  private static instance: RedisDataStore;
  private redis: Redis;
  private isConnected: boolean = false;

  private constructor() {
    this.initializeRedis();
  }

  static getInstance(): RedisDataStore {
    if (!RedisDataStore.instance) {
      RedisDataStore.instance = new RedisDataStore();
    }
    return RedisDataStore.instance;
  }

  /**
   * 🔌 INITIALIZE REDIS CONNECTION
   */
  private initializeRedis(): void {
    try {
      if (REDIS_URL) {
        // Use Railway's REDIS_URL
        this.redis = new Redis(REDIS_URL, {
          retryDelayOnFailover: 100,
          enableReadyCheck: false,
          maxRetriesPerRequest: 3,
        });
        console.log('🔌 Connecting to Redis via REDIS_URL...');
      } else {
        // Use individual environment variables
        this.redis = new Redis({
          host: REDIS_HOST,
          port: REDIS_PORT,
          password: REDIS_PASSWORD,
          retryDelayOnFailover: 100,
          enableReadyCheck: false,
          maxRetriesPerRequest: 3,
        });
        console.log(`🔌 Connecting to Redis at ${REDIS_HOST}:${REDIS_PORT}...`);
      }

      this.redis.on('connect', () => {
        console.log('✅ Redis connected successfully');
        this.isConnected = true;
      });

      this.redis.on('error', (error) => {
        console.error('❌ Redis connection error:', error);
        this.isConnected = false;
      });

      this.redis.on('ready', () => {
        console.log('🚀 Redis ready for operations');
        this.isConnected = true;
      });

    } catch (error) {
      console.error('❌ Failed to initialize Redis:', error);
    }
  }

  /**
   * 🔍 CHECK CONNECTION STATUS
   */
  async isHealthy(): Promise<boolean> {
    try {
      const pong = await this.redis.ping();
      return pong === 'PONG' && this.isConnected;
    } catch (error) {
      console.error('❌ Redis health check failed:', error);
      return false;
    }
  }

  // ====================================================
  // 🐦 TWEET STORAGE OPERATIONS (Replaces tweets table)
  // ====================================================

  /**
   * 💾 STORE TWEET DATA
   */
  async storeTweet(tweetData: TweetData): Promise<{ success: boolean; error?: string }> {
    try {
      const key = `tweet:${tweetData.tweet_id}`;
      const data = {
        ...tweetData,
        stored_at: new Date().toISOString()
      };

      // Store main tweet data
      await this.redis.setex(key, 86400 * 30, JSON.stringify(data)); // 30 days

      // Add to daily count (for quota tracking)
      const today = new Date().toISOString().split('T')[0];
      await this.redis.sadd(`daily_tweets:${today}`, tweetData.tweet_id);
      await this.redis.expire(`daily_tweets:${today}`, 86400 * 2); // 2 days

      // Add to recent tweets (sorted by timestamp)
      const timestamp = new Date(tweetData.posted_at).getTime();
      await this.redis.zadd('recent_tweets', timestamp, tweetData.tweet_id);

      // Keep only last 1000 tweets in recent list
      await this.redis.zremrangebyrank('recent_tweets', 0, -1001);

      console.log(`✅ Tweet stored: ${tweetData.tweet_id}`);
      return { success: true };

    } catch (error) {
      console.error('❌ Failed to store tweet:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 📖 GET TWEET DATA
   */
  async getTweet(tweetId: string): Promise<TweetData | null> {
    try {
      const data = await this.redis.get(`tweet:${tweetId}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('❌ Failed to get tweet:', error);
      return null;
    }
  }

  /**
   * 📊 GET DAILY TWEET COUNT
   */
  async getDailyTweetCount(date?: string): Promise<number> {
    try {
      const today = date || new Date().toISOString().split('T')[0];
      const count = await this.redis.scard(`daily_tweets:${today}`);
      return count;
    } catch (error) {
      console.error('❌ Failed to get daily count:', error);
      return 0;
    }
  }

  /**
   * 📝 GET RECENT TWEETS
   */
  async getRecentTweets(limit: number = 50): Promise<TweetData[]> {
    try {
      // Get recent tweet IDs (newest first)
      const tweetIds = await this.redis.zrevrange('recent_tweets', 0, limit - 1);
      
      if (tweetIds.length === 0) return [];

      // Get tweet data for each ID
      const tweets: TweetData[] = [];
      for (const tweetId of tweetIds) {
        const tweet = await this.getTweet(tweetId);
        if (tweet) tweets.push(tweet);
      }

      return tweets;
    } catch (error) {
      console.error('❌ Failed to get recent tweets:', error);
      return [];
    }
  }

  // ========================================================
  // 📊 ANALYTICS STORAGE (Replaces tweet_analytics table)
  // ========================================================

  /**
   * 📈 STORE ANALYTICS DATA
   */
  async storeAnalytics(analyticsData: AnalyticsData): Promise<{ success: boolean; error?: string }> {
    try {
      const key = `analytics:${analyticsData.tweet_id}`;
      const data = {
        ...analyticsData,
        updated_at: new Date().toISOString()
      };

      await this.redis.setex(key, 86400 * 90, JSON.stringify(data)); // 90 days

      // Add to time-series for tracking
      const timestamp = new Date().getTime();
      await this.redis.zadd('analytics_timeline', timestamp, `${analyticsData.tweet_id}:${timestamp}`);

      console.log(`📊 Analytics stored: ${analyticsData.tweet_id}`);
      return { success: true };

    } catch (error) {
      console.error('❌ Failed to store analytics:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 📈 GET ANALYTICS DATA
   */
  async getAnalytics(tweetId: string): Promise<AnalyticsData | null> {
    try {
      const data = await this.redis.get(`analytics:${tweetId}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('❌ Failed to get analytics:', error);
      return null;
    }
  }

  // =======================================================
  // 🧠 LEARNING DATA STORAGE (Replaces learning_posts table)
  // =======================================================

  /**
   * 🧠 STORE LEARNING DATA
   */
  async storeLearningData(learningData: LearningData): Promise<{ success: boolean; error?: string }> {
    try {
      const key = `learning:${learningData.post_id}`;
      const data = {
        ...learningData,
        learned_at: new Date().toISOString()
      };

      await this.redis.setex(key, 86400 * 365, JSON.stringify(data)); // 1 year

      // Add to learning timeline
      const timestamp = new Date().getTime();
      await this.redis.zadd('learning_timeline', timestamp, learningData.post_id);

      console.log(`🧠 Learning data stored: ${learningData.post_id}`);
      return { success: true };

    } catch (error) {
      console.error('❌ Failed to store learning data:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 🧠 GET LEARNING DATA
   */
  async getLearningData(postId: string): Promise<LearningData | null> {
    try {
      const data = await this.redis.get(`learning:${postId}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('❌ Failed to get learning data:', error);
      return null;
    }
  }

  // =====================================================
  // 🎯 BANDIT DATA STORAGE (Replaces bandit tables)
  // =====================================================

  /**
   * 🎰 STORE BANDIT ARM DATA
   */
  async storeBanditArm(armId: string, armData: any): Promise<{ success: boolean; error?: string }> {
    try {
      const key = `bandit:${armId}`;
      const data = {
        ...armData,
        updated_at: new Date().toISOString()
      };

      await this.redis.set(key, JSON.stringify(data));

      // Add to arms list
      await this.redis.sadd('bandit_arms', armId);

      console.log(`🎰 Bandit arm stored: ${armId}`);
      return { success: true };

    } catch (error) {
      console.error('❌ Failed to store bandit arm:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 🎰 GET ALL BANDIT ARMS
   */
  async getAllBanditArms(): Promise<any[]> {
    try {
      const armIds = await this.redis.smembers('bandit_arms');
      const arms = [];

      for (const armId of armIds) {
        const data = await this.redis.get(`bandit:${armId}`);
        if (data) {
          arms.push(JSON.parse(data));
        }
      }

      return arms;
    } catch (error) {
      console.error('❌ Failed to get bandit arms:', error);
      return [];
    }
  }

  // ============================================
  // 🔧 UTILITY METHODS
  // ============================================

  /**
   * 🧹 CLEANUP OLD DATA
   */
  async cleanupOldData(): Promise<void> {
    try {
      // Remove old daily counts (older than 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      for (let i = 0; i < 30; i++) {
        const date = new Date(sevenDaysAgo);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        await this.redis.del(`daily_tweets:${dateStr}`);
      }

      console.log('🧹 Old data cleanup completed');
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
    }
  }

  /**
   * 📊 GET SYSTEM STATS
   */
  async getSystemStats(): Promise<any> {
    try {
      const stats = {
        redis_connected: this.isConnected,
        total_tweets: await this.redis.zcard('recent_tweets'),
        daily_tweet_count: await this.getDailyTweetCount(),
        bandit_arms_count: await this.redis.scard('bandit_arms'),
        memory_usage: await this.redis.memory('usage'),
        last_updated: new Date().toISOString()
      };

      return stats;
    } catch (error) {
      console.error('❌ Failed to get system stats:', error);
      return { error: error.message };
    }
  }

  /**
   * 🔌 CLOSE CONNECTION
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      console.log('🔌 Redis connection closed');
    }
  }
}

// Export singleton instance
export const redisDataStore = RedisDataStore.getInstance();