/**
 * 🛡️ ROBUST TWEET STORAGE SYSTEM
 * 
 * Fixes database sync issues and enforces 17 tweet daily limit
 */

import { secureSupabaseClient } from './secureSupabaseClient';

interface TweetData {
  tweet_id: string;
  content: string;
  content_type?: string;
  viral_score?: number;
  ai_growth_prediction?: number;
  ai_optimized?: boolean;
  generation_method?: string;
}

interface StorageResult {
  success: boolean;
  error?: string;
  tweet_count_today?: number;
  limit_reached?: boolean;
}

export class RobustTweetStorage {
  private static readonly DAILY_TWEET_LIMIT = 17; // Free tier limit
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY = 1000; // 1 second

  /**
   * 📊 Check daily tweet count and enforce limits
   */
  static async checkDailyLimit(): Promise<{ count: number; canPost: boolean; remaining: number }> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data: todayTweets, error } = await secureSupabaseClient.supabase
        ?.from('tweets')
        .select('tweet_id')
        .gte('created_at', `${today}T00:00:00.000Z`)
        .lt('created_at', `${today}T23:59:59.999Z`);

      if (error) {
        console.error('❌ Error checking daily tweet count:', error);
        return { count: 0, canPost: false, remaining: 0 };
      }

      const count = todayTweets?.length || 0;
      const remaining = Math.max(0, this.DAILY_TWEET_LIMIT - count);
      const canPost = count < this.DAILY_TWEET_LIMIT;

      console.log(`📊 Daily Tweet Status: ${count}/${this.DAILY_TWEET_LIMIT} used, ${remaining} remaining`);

      return { count, canPost, remaining };
    } catch (error) {
      console.error('❌ Error in checkDailyLimit:', error);
      return { count: 0, canPost: false, remaining: 0 };
    }
  }

  /**
   * 💾 Store tweet with retries and validation
   */
  static async storeTweet(tweetData: TweetData): Promise<StorageResult> {
    // First check daily limit
    const limitCheck = await this.checkDailyLimit();
    if (!limitCheck.canPost) {
      console.log('🚫 Daily tweet limit reached! Cannot store more tweets today.');
      return {
        success: false,
        error: 'Daily tweet limit exceeded',
        tweet_count_today: limitCheck.count,
        limit_reached: true
      };
    }

    // Attempt to store with retries
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        console.log(`💾 Storing tweet (attempt ${attempt}/${this.MAX_RETRIES}): ${tweetData.tweet_id}`);

        const { error } = await secureSupabaseClient.supabase
          ?.from('tweets')
          .insert({
            tweet_id: tweetData.tweet_id,
            content: tweetData.content,
            tweet_type: tweetData.content_type || 'original',
            content_type: tweetData.content_type || 'health_content',
            viral_score: tweetData.viral_score || 5,
            ai_growth_prediction: tweetData.ai_growth_prediction || 5,
            ai_optimized: tweetData.ai_optimized || true,
            generation_method: tweetData.generation_method || 'ai_enhanced',
            created_at: new Date().toISOString()
          });

        if (error) {
          console.error(`❌ Database insert error (attempt ${attempt}):`, error);
          
          if (attempt === this.MAX_RETRIES) {
            return {
              success: false,
              error: `Failed after ${this.MAX_RETRIES} attempts: ${error.message}`,
              tweet_count_today: limitCheck.count
            };
          }
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY * attempt));
          continue;
        }

        console.log(`✅ Tweet stored successfully: ${tweetData.tweet_id}`);
        
        // Verify storage
        const verification = await this.verifyTweetStorage(tweetData.tweet_id);
        if (!verification.success) {
          console.warn('⚠️ Tweet storage verification failed, but insert succeeded');
        }

        // Update API usage tracking
        await this.updateApiUsageTracking();

        return {
          success: true,
          tweet_count_today: limitCheck.count + 1
        };

      } catch (error) {
        console.error(`❌ Unexpected error storing tweet (attempt ${attempt}):`, error);
        
        if (attempt === this.MAX_RETRIES) {
          return {
            success: false,
            error: `Unexpected error after ${this.MAX_RETRIES} attempts: ${error.message}`,
            tweet_count_today: limitCheck.count
          };
        }
        
        await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY * attempt));
      }
    }

    return {
      success: false,
      error: 'Max retries exceeded',
      tweet_count_today: limitCheck.count
    };
  }

  /**
   * ✅ Verify tweet was actually stored
   */
  private static async verifyTweetStorage(tweetId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error } = await secureSupabaseClient.supabase
        ?.from('tweets')
        .select('tweet_id')
        .eq('tweet_id', tweetId)
        .single();

      if (error || !data) {
        return { success: false, error: 'Tweet not found in database after insert' };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: `Verification failed: ${error.message}` };
    }
  }

  /**
   * 📈 Update API usage tracking
   */
  private static async updateApiUsageTracking(): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data: existingUsage } = await secureSupabaseClient.supabase
        ?.from('api_usage_tracking')
        .select('count')
        .eq('date', today)
        .eq('api_type', 'twitter')
        .single();

      if (existingUsage) {
        // Update existing record
        await secureSupabaseClient.supabase
          ?.from('api_usage_tracking')
          .update({ 
            count: existingUsage.count + 1,
            last_updated: new Date().toISOString()
          })
          .eq('date', today)
          .eq('api_type', 'twitter');
      } else {
        // Create new record
        await secureSupabaseClient.supabase
          ?.from('api_usage_tracking')
          .insert({
            date: today,
            api_type: 'twitter',
            count: 1,
            last_updated: new Date().toISOString()
          });
      }

      console.log('📈 API usage tracking updated');
    } catch (error) {
      console.warn('⚠️ Failed to update API usage tracking:', error);
    }
  }

  /**
   * 🔍 Get current status
   */
  static async getStatus(): Promise<{
    tweetsToday: number;
    remaining: number;
    canPost: boolean;
    limitReached: boolean;
  }> {
    const limitCheck = await this.checkDailyLimit();
    
    return {
      tweetsToday: limitCheck.count,
      remaining: limitCheck.remaining,
      canPost: limitCheck.canPost,
      limitReached: !limitCheck.canPost
    };
  }

  /**
   * 🧹 Clean up failed tweets (diagnostic tool)
   */
  static async findMissingTweets(): Promise<{
    tweetsInDb: number;
    apiCallsToday: number;
    gap: number;
  }> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Count tweets in database
      const { data: tweets } = await secureSupabaseClient.supabase
        ?.from('tweets')
        .select('tweet_id')
        .gte('created_at', `${today}T00:00:00.000Z`)
        .lt('created_at', `${today}T23:59:59.999Z`);

      // Get API usage
      const { data: apiUsage } = await secureSupabaseClient.supabase
        ?.from('api_usage_tracking')
        .select('count')
        .eq('date', today)
        .eq('api_type', 'twitter')
        .single();

      const tweetsInDb = tweets?.length || 0;
      const apiCallsToday = apiUsage?.count || 0;
      const gap = apiCallsToday - tweetsInDb;

      console.log(`🔍 Tweet Gap Analysis: ${tweetsInDb} in DB, ${apiCallsToday} API calls, ${gap} missing`);

      return { tweetsInDb, apiCallsToday, gap };
    } catch (error) {
      console.error('❌ Error in findMissingTweets:', error);
      return { tweetsInDb: 0, apiCallsToday: 0, gap: 0 };
    }
  }
}

export default RobustTweetStorage; 