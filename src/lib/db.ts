/**
 * 🚀 DUAL DATABASE LAYER (DAL)
 * ============================
 * 
 * Redis Cloud: Hot-path KV store for ultra-fast operations
 * Supabase: Durable source-of-truth for analytics & long-term history
 * 
 * Architecture:
 * - Redis: Rate limits, recent tweets cache, queues, uniqueness checks
 * - Supabase: Analytics snapshots, historical data, complex queries
 * - Hourly flush: Redis → Supabase for durability
 */

// Dynamic imports to handle missing dependencies gracefully
import { createClient } from '@supabase/supabase-js';

// Environment configuration
const USE_SUPABASE_ONLY = process.env.USE_SUPABASE_ONLY !== 'false'; // Default to Supabase-only
const REDIS_URL = process.env.REDIS_URL || process.env.REDIS_CONNECTION_STRING;

// Initialize Redis Cloud connection (lazy loading)
let redis: any = null;
async function getRedisClient() {
  if (!redis && !USE_SUPABASE_ONLY && REDIS_URL) {
    try {
      const Redis = await import('ioredis');
      redis = new Redis.default(REDIS_URL!, {
        retryDelayOnFailover: 100,
        enableReadyCheck: false,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        // Redis Cloud SSL configuration
        tls: REDIS_URL?.startsWith('rediss://') ? {} : undefined,
      });
      
      // Connection event handlers
      redis.on('connect', () => console.log('✅ Redis Cloud connected'));
      redis.on('ready', () => console.log('🚀 Redis Cloud ready'));
      redis.on('error', (err: any) => console.error('❌ Redis Cloud error:', err));
    } catch (error) {
      console.warn('⚠️ Redis not available, falling back to Supabase-only mode');
      redis = null;
    }
  }
  return redis;
}

// Initialize Supabase client
const supa = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Tweet {
  id: string;
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

interface RateLimitInfo {
  count: number;
  resetTime: number;
  remaining: number;
}

export const DB = {
  
  // ==========================================
  // 🚀 HOT-PATH OPERATIONS (REDIS CLOUD)
  // ==========================================

  /**
   * 💾 Save tweet to Redis hot cache
   */
  async saveTweetFast(tweet: Tweet): Promise<void> {
    if (USE_SUPABASE_ONLY) {
      return this.saveTweetDurable(tweet);
    }

    const redisClient = await getRedisClient();
    if (!redisClient) {
      return this.saveTweetDurable(tweet);
    }

    try {
      const tweetData = {
        ...tweet,
        saved_at: new Date().toISOString(),
        source: 'hot_cache'
      };

      // Store tweet hash
      await redisClient.hset(`tweet:${tweet.id}`, tweetData);
      
      // Add to recent tweets sorted set (score = timestamp)
      const timestamp = new Date(tweet.posted_at).getTime();
      await redisClient.zadd('recent_tweets', timestamp, tweet.id);
      
      // Keep only last 1000 tweets in hot cache
      await redisClient.zremrangebyrank('recent_tweets', 0, -1001);
      
      // Add to daily count for rate limiting
      const today = new Date().toISOString().split('T')[0];
      await redisClient.incr(`daily_count:${today}`);
      await redisClient.expire(`daily_count:${today}`, 86400 * 2); // 2 days TTL

      console.log(`🚀 Tweet ${tweet.id} saved to Redis hot cache`);
      
    } catch (error) {
      console.error('❌ Redis save failed, falling back to Supabase:', error);
      await this.saveTweetDurable(tweet);
    }
  },

  /**
   * 📖 Get recent tweets from Redis hot cache
   */
  async getRecentTweets(n: number = 20): Promise<Tweet[]> {
    if (USE_SUPABASE_ONLY) {
      return this.getRecentTweetsDurable(n);
    }

    const redisClient = await getRedisClient();
    if (!redisClient) {
      return this.getRecentTweetsDurable(n);
    }

    try {
      // Get most recent tweet IDs (newest first)
      const ids = await redisClient.zrevrange('recent_tweets', 0, n - 1);
      
      if (ids.length === 0) {
        console.log('📥 No tweets in Redis cache, falling back to Supabase');
        return this.getRecentTweetsDurable(n);
      }

      // Get tweet data for each ID
      const tweets: Tweet[] = [];
      for (const id of ids) {
        const tweetData = await redisClient.hgetall(`tweet:${id}`);
        if (Object.keys(tweetData).length > 0) {
          tweets.push(tweetData as any);
        }
      }

      console.log(`📖 Retrieved ${tweets.length} tweets from Redis cache`);
      return tweets;
      
    } catch (error) {
      console.error('❌ Redis read failed, falling back to Supabase:', error);
      return this.getRecentTweetsDurable(n);
    }
  },

  /**
   * 🔄 Check for duplicate content (uniqueness filter)
   */
  async isDuplicateContent(content: string, lookbackHours: number = 24): Promise<boolean> {
    if (USE_SUPABASE_ONLY) {
      return this.isDuplicateContentDurable(content, lookbackHours);
    }

    try {
      // Generate content hash for fast comparison
      const contentHash = await this.generateContentHash(content);
      
      // Check if hash exists in recent duplicates set
      const exists = await redis.sismember('recent_content_hashes', contentHash);
      
      if (exists) {
        console.log(`🔍 Duplicate content detected (Redis): ${contentHash}`);
        return true;
      }

      // Add to recent hashes with TTL
      await redis.sadd('recent_content_hashes', contentHash);
      await redis.expire('recent_content_hashes', lookbackHours * 3600);
      
      return false;
      
    } catch (error) {
      console.error('❌ Redis duplicate check failed, falling back to Supabase:', error);
      return this.isDuplicateContentDurable(content, lookbackHours);
    }
  },

  /**
   * ⏱️ Rate limit check
   */
  async checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitInfo> {
    if (USE_SUPABASE_ONLY) {
      return this.checkRateLimitDurable(key, limit, windowSeconds);
    }

    try {
      const now = Date.now();
      const windowStart = now - (windowSeconds * 1000);
      
      // Remove expired entries
      await redis.zremrangebyscore(`rate_limit:${key}`, 0, windowStart);
      
      // Count current requests in window
      const count = await redis.zcard(`rate_limit:${key}`);
      
      if (count >= limit) {
        const oldestEntry = await redis.zrange(`rate_limit:${key}`, 0, 0, 'WITHSCORES');
        const resetTime = oldestEntry.length > 1 ? parseInt(oldestEntry[1]) + (windowSeconds * 1000) : now + (windowSeconds * 1000);
        
        return {
          count,
          remaining: 0,
          resetTime
        };
      }

      // Add current request
      await redis.zadd(`rate_limit:${key}`, now, `${now}_${Math.random()}`);
      await redis.expire(`rate_limit:${key}`, windowSeconds);
      
      return {
        count: count + 1,
        remaining: limit - count - 1,
        resetTime: now + (windowSeconds * 1000)
      };
      
    } catch (error) {
      console.error('❌ Redis rate limit failed, falling back to Supabase:', error);
      return this.checkRateLimitDurable(key, limit, windowSeconds);
    }
  },

  /**
   * 📊 Get daily tweet count (fast)
   */
  async getDailyTweetCount(date?: string): Promise<number> {
    if (USE_SUPABASE_ONLY) {
      return this.getDailyTweetCountDurable(date);
    }

    try {
      const today = date || new Date().toISOString().split('T')[0];
      const count = await redis.get(`daily_count:${today}`);
      return parseInt(count || '0');
      
    } catch (error) {
      console.error('❌ Redis daily count failed, falling back to Supabase:', error);
      return this.getDailyTweetCountDurable(date);
    }
  },

  // ==========================================
  // 💾 DURABLE OPERATIONS (SUPABASE)
  // ==========================================

  /**
   * 💾 Save tweet to Supabase (durable storage)
   */
  async saveTweetDurable(tweet: Tweet): Promise<void> {
    try {
      const { error } = await supa
        .from('tweets')
        .insert({
          tweet_id: tweet.id,
          content: tweet.content,
          posted_at: tweet.posted_at,
          likes: tweet.likes || 0,
          retweets: tweet.retweets || 0,
          replies: tweet.replies || 0,
          impressions: tweet.impressions || 0,
          engagement_score: tweet.engagement_score || 0,
          viral_score: tweet.viral_score || 5,
          content_type: tweet.content_type || 'health_content',
          ai_generated: tweet.ai_generated || true,
          created_at: new Date().toISOString()
        });

      if (error) {
        console.error('❌ Supabase save error:', error);
        throw new Error(`Supabase save failed: ${error.message}`);
      }

      console.log(`💾 Tweet ${tweet.id} saved to Supabase`);
      
    } catch (error) {
      console.error('❌ Failed to save tweet to Supabase:', error);
      throw error;
    }
  },

  /**
   * 📖 Get recent tweets from Supabase
   */
  async getRecentTweetsDurable(n: number = 20): Promise<Tweet[]> {
    try {
      const { data, error } = await supa
        .from('tweets')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(n);

      if (error) {
        console.error('❌ Supabase read error:', error);
        return [];
      }

      return data?.map(row => ({
        id: row.tweet_id,
        content: row.content,
        posted_at: row.posted_at || row.created_at,
        likes: row.likes,
        retweets: row.retweets,
        replies: row.replies,
        impressions: row.impressions,
        engagement_score: row.engagement_score,
        viral_score: row.viral_score,
        content_type: row.content_type,
        ai_generated: row.ai_generated
      })) || [];
      
    } catch (error) {
      console.error('❌ Failed to get recent tweets from Supabase:', error);
      return [];
    }
  },

  /**
   * 🔄 Check duplicate content in Supabase
   */
  async isDuplicateContentDurable(content: string, lookbackHours: number = 24): Promise<boolean> {
    try {
      const lookbackTime = new Date();
      lookbackTime.setHours(lookbackTime.getHours() - lookbackHours);

      const { data, error } = await supa
        .from('tweets')
        .select('content')
        .gte('created_at', lookbackTime.toISOString())
        .ilike('content', content);

      if (error) {
        console.error('❌ Supabase duplicate check error:', error);
        return false; // Fail open for posting
      }

      return (data?.length || 0) > 0;
      
    } catch (error) {
      console.error('❌ Failed duplicate check in Supabase:', error);
      return false; // Fail open
    }
  },

  /**
   * ⏱️ Rate limit check in Supabase (fallback)
   */
  async checkRateLimitDurable(key: string, limit: number, windowSeconds: number): Promise<RateLimitInfo> {
    try {
      const windowStart = new Date();
      windowStart.setSeconds(windowStart.getSeconds() - windowSeconds);

      const { data, error } = await supa
        .from('tweets')
        .select('id')
        .gte('created_at', windowStart.toISOString());

      if (error) {
        console.error('❌ Supabase rate limit error:', error);
        return { count: 0, remaining: limit, resetTime: Date.now() + (windowSeconds * 1000) };
      }

      const count = data?.length || 0;
      return {
        count,
        remaining: Math.max(0, limit - count),
        resetTime: Date.now() + (windowSeconds * 1000)
      };
      
    } catch (error) {
      console.error('❌ Failed rate limit check in Supabase:', error);
      return { count: 0, remaining: limit, resetTime: Date.now() + (windowSeconds * 1000) };
    }
  },

  /**
   * 📊 Get daily count from Supabase
   */
  async getDailyTweetCountDurable(date?: string): Promise<number> {
    try {
      const today = date || new Date().toISOString().split('T')[0];
      
      const { data, error } = await supa
        .from('tweets')
        .select('id')
        .gte('created_at', `${today}T00:00:00.000Z`)
        .lt('created_at', `${today}T23:59:59.999Z`);

      if (error) {
        console.error('❌ Supabase daily count error:', error);
        return 0;
      }

      return data?.length || 0;
      
    } catch (error) {
      console.error('❌ Failed to get daily count from Supabase:', error);
      return 0;
    }
  },

  // ==========================================
  // 🔄 HOURLY FLUSH OPERATIONS
  // ==========================================

  /**
   * 🔄 Flush Redis data to Supabase (hourly job)
   */
  async flushToSupabase(): Promise<{ flushed: number; errors: number }> {
    if (USE_SUPABASE_ONLY) {
      console.log('📋 Supabase-only mode, skipping Redis flush');
      return { flushed: 0, errors: 0 };
    }

    let flushed = 0;
    let errors = 0;

    try {
      console.log('🔄 Starting Redis → Supabase flush...');
      
      // Get all recent tweet IDs
      const ids = await redis.zrange('recent_tweets', 0, -1);
      console.log(`📊 Found ${ids.length} tweets in Redis cache`);

      for (const id of ids) {
        try {
          // Get tweet data from Redis
          const tweetData = await redis.hgetall(`tweet:${id}`);
          
          if (Object.keys(tweetData).length === 0) {
            continue; // Skip empty entries
          }

          // Check if already exists in Supabase
          const { data: existing } = await supa
            .from('tweets')
            .select('id')
            .eq('tweet_id', id)
            .single();

          if (existing) {
            console.log(`⏭️ Tweet ${id} already in Supabase, skipping`);
            continue;
          }

          // Insert into Supabase
          const { error } = await supa
            .from('tweets')
            .insert({
              tweet_id: id,
              content: tweetData.content,
              posted_at: tweetData.posted_at,
              likes: parseInt(tweetData.likes || '0'),
              retweets: parseInt(tweetData.retweets || '0'),
              replies: parseInt(tweetData.replies || '0'),
              impressions: parseInt(tweetData.impressions || '0'),
              engagement_score: parseInt(tweetData.engagement_score || '0'),
              viral_score: parseInt(tweetData.viral_score || '5'),
              content_type: tweetData.content_type || 'health_content',
              ai_generated: tweetData.ai_generated !== 'false',
              created_at: new Date().toISOString()
            });

          if (error) {
            console.error(`❌ Failed to flush tweet ${id}:`, error);
            errors++;
          } else {
            console.log(`✅ Flushed tweet ${id} to Supabase`);
            flushed++;
          }

        } catch (error) {
          console.error(`❌ Error processing tweet ${id}:`, error);
          errors++;
        }
      }

      console.log(`🔄 Flush complete: ${flushed} flushed, ${errors} errors`);
      return { flushed, errors };
      
    } catch (error) {
      console.error('❌ Fatal error during flush:', error);
      return { flushed, errors: errors + 1 };
    }
  },

  // ==========================================
  // 🔧 UTILITY METHODS
  // ==========================================

  /**
   * 🔐 Generate content hash for uniqueness
   */
  async generateContentHash(content: string): Promise<string> {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(content.toLowerCase().trim()).digest('hex');
  },

  /**
   * 🏥 Health check
   */
  async healthCheck(): Promise<{ redis: string; supabase: string; overall: string }> {
    const results = { redis: 'unknown', supabase: 'unknown', overall: 'unknown' };

    // Check Redis
    try {
      const start = Date.now();
      await redis.ping();
      const latency = Date.now() - start;
      results.redis = latency < 50 ? 'ok' : `slow_${latency}ms`;
    } catch (error) {
      results.redis = 'error';
    }

    // Check Supabase
    try {
      const { error } = await supa.from('tweets').select('id').limit(1);
      results.supabase = error ? 'error' : 'ok';
    } catch (error) {
      results.supabase = 'error';
    }

    // Overall status
    if (results.redis === 'ok' && results.supabase === 'ok') {
      results.overall = 'healthy';
    } else if (results.redis.includes('ok') || results.supabase === 'ok') {
      results.overall = 'degraded';
    } else {
      results.overall = 'down';
    }

    return results;
  },

  /**
   * 🔌 Close connections
   */
  async close(): Promise<void> {
    try {
      await redis.quit();
      console.log('🔌 Redis connection closed');
    } catch (error) {
      console.error('❌ Error closing Redis:', error);
    }
  }
};

// Export individual clients for advanced usage
export { redis, supa };