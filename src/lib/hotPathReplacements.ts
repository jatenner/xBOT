/**
 * 🚀 HOT-PATH REPLACEMENTS
 * ========================
 * 
 * Drop-in replacements for critical Supabase operations that should use Redis hot-path.
 * These functions maintain the same API but use Redis for performance-critical operations.
 * 
 * Usage: Replace direct Supabase calls with these functions in posting/duplicate checking logic.
 */

import { DB } from './db';

export class HotPathReplacements {

  /**
   * 🚀 STORE TWEET (HOT-PATH)
   * Replaces: supabase.from('tweets').insert(...)
   */
  static async storeTweet(tweetData: {
    tweet_id: string;
    content: string;
    content_type?: string;
    viral_score?: number;
    ai_optimized?: boolean;
    generation_method?: string;
    posted_at?: string;
    likes?: number;
    retweets?: number;
    replies?: number;
    impressions?: number;
    [key: string]: any;
  }): Promise<{ success: boolean; error?: string; database_id?: string }> {
    try {
      console.log(`🚀 Hot-path storing tweet: ${tweetData.tweet_id}`);

      const tweet = {
        id: tweetData.tweet_id,
        content: tweetData.content,
        posted_at: tweetData.posted_at || new Date().toISOString(),
        likes: tweetData.likes || 0,
        retweets: tweetData.retweets || 0,
        replies: tweetData.replies || 0,
        impressions: tweetData.impressions || 0,
        viral_score: tweetData.viral_score || 5,
        content_type: tweetData.content_type || 'health_content',
        ai_generated: tweetData.ai_optimized !== false,
        generation_method: tweetData.generation_method || 'ai_enhanced'
      };

      await DB.saveTweetFast(tweet);

      return {
        success: true,
        database_id: tweetData.tweet_id
      };

    } catch (error) {
      console.error('❌ Hot-path tweet storage failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 🔍 CHECK DUPLICATE CONTENT (HOT-PATH)
   * Replaces: supabase.from('tweets').select('content').ilike(content)
   */
  static async isDuplicateContent(content: string, lookbackHours: number = 24): Promise<boolean> {
    try {
      console.log(`🔍 Hot-path duplicate check for content: ${content.substring(0, 50)}...`);
      return await DB.isDuplicateContent(content, lookbackHours);
    } catch (error) {
      console.error('❌ Hot-path duplicate check failed:', error);
      return false; // Fail open for posting
    }
  }

  /**
   * 📊 GET DAILY TWEET COUNT (HOT-PATH)
   * Replaces: supabase.from('tweets').select('id').gte('created_at', today).count()
   */
  static async getDailyTweetCount(date?: string): Promise<number> {
    try {
      console.log(`📊 Hot-path getting daily count for: ${date || 'today'}`);
      return await DB.getDailyTweetCount(date);
    } catch (error) {
      console.error('❌ Hot-path daily count failed:', error);
      return 0;
    }
  }

  /**
   * ⏱️ CHECK RATE LIMIT (HOT-PATH)
   * New functionality - check if we can post based on rate limits
   */
  static async canPost(dailyLimit: number = 17): Promise<{ canPost: boolean; count: number; remaining: number }> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const currentCount = await DB.getDailyTweetCount(today);

      return {
        canPost: currentCount < dailyLimit,
        count: currentCount,
        remaining: Math.max(0, dailyLimit - currentCount)
      };
    } catch (error) {
      console.error('❌ Hot-path rate limit check failed:', error);
      return { canPost: false, count: 0, remaining: 0 };
    }
  }

  /**
   * 📖 GET RECENT TWEETS (HOT-PATH)
   * Replaces: supabase.from('tweets').select('*').order('created_at', desc).limit(n)
   */
  static async getRecentTweets(limit: number = 20): Promise<Array<{
    id: string;
    content: string;
    posted_at: string;
    likes?: number;
    retweets?: number;
    replies?: number;
    impressions?: number;
    [key: string]: any;
  }>> {
    try {
      console.log(`📖 Hot-path getting ${limit} recent tweets`);
      return await DB.getRecentTweets(limit);
    } catch (error) {
      console.error('❌ Hot-path recent tweets failed:', error);
      return [];
    }
  }

  /**
   * 🎯 CHECK CONTENT UNIQUENESS (ENHANCED)
   * Combines duplicate check with recent content analysis
   */
  static async isContentUnique(
    content: string, 
    options: {
      lookbackHours?: number;
      similarityThreshold?: number;
      checkRecent?: number;
    } = {}
  ): Promise<{ isUnique: boolean; reason?: string; confidence: number }> {
    try {
      const { lookbackHours = 24, similarityThreshold = 0.85, checkRecent = 50 } = options;

      // Check exact duplicates in Redis hot cache
      const isDuplicate = await this.isDuplicateContent(content, lookbackHours);
      if (isDuplicate) {
        return {
          isUnique: false,
          reason: 'Exact duplicate found in recent posts',
          confidence: 1.0
        };
      }

      // Check similarity against recent tweets
      const recentTweets = await this.getRecentTweets(checkRecent);
      const normalizedContent = content.toLowerCase().trim();

      for (const tweet of recentTweets) {
        const tweetContent = tweet.content.toLowerCase().trim();
        
        // Simple similarity check (could be enhanced with more sophisticated algorithms)
        const similarity = this.calculateSimilarity(normalizedContent, tweetContent);
        
        if (similarity > similarityThreshold) {
          return {
            isUnique: false,
            reason: `Similar content found (${(similarity * 100).toFixed(1)}% similarity)`,
            confidence: similarity
          };
        }
      }

      return {
        isUnique: true,
        confidence: 1.0
      };

    } catch (error) {
      console.error('❌ Content uniqueness check failed:', error);
      return {
        isUnique: true, // Fail open for posting
        reason: 'Check failed, allowing post',
        confidence: 0.5
      };
    }
  }

  /**
   * 📊 GET POSTING STATS (HOT-PATH)
   * Get quick stats for monitoring
   */
  static async getPostingStats(): Promise<{
    today: number;
    thisWeek: number;
    recentTweets: number;
    lastPosted?: string;
  }> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const todayCount = await this.getDailyTweetCount(today);
      
      // Calculate week start (Sunday)
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      
      let weekCount = todayCount;
      for (let i = 1; i <= now.getDay(); i++) {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + i);
        const dayCount = await this.getDailyTweetCount(date.toISOString().split('T')[0]);
        weekCount += dayCount;
      }

      const recentTweets = await this.getRecentTweets(1);
      const lastPosted = recentTweets.length > 0 ? recentTweets[0].posted_at : undefined;

      return {
        today: todayCount,
        thisWeek: weekCount,
        recentTweets: recentTweets.length,
        lastPosted
      };

    } catch (error) {
      console.error('❌ Hot-path posting stats failed:', error);
      return {
        today: 0,
        thisWeek: 0,
        recentTweets: 0
      };
    }
  }

  /**
   * 🔧 UTILITY: Calculate content similarity
   */
  private static calculateSimilarity(content1: string, content2: string): number {
    if (content1 === content2) return 1.0;
    
    // Simple word-based similarity (could be enhanced)
    const words1 = content1.split(/\s+/);
    const words2 = content2.split(/\s+/);
    
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  /**
   * 🏥 HEALTH CHECK FOR HOT-PATH
   */
  static async healthCheck(): Promise<{
    hotPath: 'healthy' | 'degraded' | 'down';
    redis: string;
    supabase: string;
    latency: number;
  }> {
    const start = Date.now();
    
    try {
      const health = await DB.healthCheck();
      const latency = Date.now() - start;

      let hotPath: 'healthy' | 'degraded' | 'down';
      if (health.redis === 'ok' && health.supabase === 'ok') {
        hotPath = 'healthy';
      } else if (health.redis.includes('ok') || health.supabase === 'ok') {
        hotPath = 'degraded';
      } else {
        hotPath = 'down';
      }

      return {
        hotPath,
        redis: health.redis,
        supabase: health.supabase,
        latency
      };

    } catch (error) {
      return {
        hotPath: 'down',
        redis: 'error',
        supabase: 'error',
        latency: Date.now() - start
      };
    }
  }
}

// Export for easy importing
export const hotPath = HotPathReplacements;