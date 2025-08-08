/**
 * 🚀 SIMPLIFIED DATABASE LAYER - SUPABASE ONLY
 * =============================================
 * 
 * Simplified version that works without Redis dependencies.
 * Redis can be added later as an optional enhancement.
 */

import { createClient } from '@supabase/supabase-js';

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
  // 💾 ALL OPERATIONS GO TO SUPABASE
  // ==========================================

  /**
   * 💾 Save tweet (to Supabase)
   */
  async saveTweetFast(tweet: Tweet): Promise<void> {
    return this.saveTweetDurable(tweet);
  },

  /**
   * 📖 Get recent tweets (from Supabase)
   */
  async getRecentTweets(n: number = 20): Promise<Tweet[]> {
    return this.getRecentTweetsDurable(n);
  },

  /**
   * 🔄 Check for duplicate content (in Supabase)
   */
  async isDuplicateContent(content: string, lookbackHours: number = 24): Promise<boolean> {
    return this.isDuplicateContentDurable(content, lookbackHours);
  },

  /**
   * ⏱️ Rate limit check (in Supabase)
   */
  async checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitInfo> {
    return this.checkRateLimitDurable(key, limit, windowSeconds);
  },

  /**
   * 📊 Get daily tweet count (from Supabase)
   */
  async getDailyTweetCount(date?: string): Promise<number> {
    return this.getDailyTweetCountDurable(date);
  },

  // ==========================================
  // 💾 SUPABASE OPERATIONS
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
  // 🔄 NO-OP OPERATIONS (Redis would be here)
  // ==========================================

  /**
   * 🔄 Flush Redis to Supabase (no-op)
   */
  async flushToSupabase(): Promise<{ flushed: number; errors: number }> {
    console.log('📋 Supabase-only mode, no Redis to flush');
    return { flushed: 0, errors: 0 };
  },

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
    const results = { redis: 'disabled', supabase: 'unknown', overall: 'unknown' };

    // Check Supabase
    try {
      const { error } = await supa.from('tweets').select('id').limit(1);
      results.supabase = error ? 'error' : 'ok';
    } catch (error) {
      results.supabase = 'error';
    }

    results.overall = results.supabase === 'ok' ? 'healthy' : 'degraded';
    return results;
  },

  /**
   * 🔌 Close connections
   */
  async close(): Promise<void> {
    console.log('🔌 Supabase-only mode, no connections to close');
  }
};

// Export individual clients for advanced usage
export { supa };