import { supabaseClient } from './supabaseClient';

export interface TweetData {
  tweet_id: string;
  content: string;
  tweet_type?: string;
  content_type?: string;
  content_category?: string;
  source_attribution?: string;
  engagement_score?: number;
  likes?: number;
  retweets?: number;
  replies?: number;
  impressions?: number;
  has_snap2health_cta?: boolean;
  new_followers?: number;
  image_url?: string;
}

/**
 * 💾 FIXED TWEET STORAGE
 * 
 * This utility fixes the database storage issue by using the correct column names
 * that match the actual database schema.
 */
export class FixedTweetStorage {
  
  /**
   * Store tweet in database using correct schema
   */
  static async storeTweet(tweetData: TweetData): Promise<string | null> {
    try {
      console.log('💾 Storing tweet with correct schema...');
      console.log(`📝 Tweet ID: ${tweetData.tweet_id}`);
      console.log(`📄 Content: ${tweetData.content.substring(0, 80)}...`);

      // Only use columns that definitely exist in the database (discovered schema)
      const insertData = {
        tweet_id: tweetData.tweet_id,
        content: tweetData.content,
        tweet_type: tweetData.tweet_type || 'original',
        content_type: tweetData.content_type || 'general',
        content_category: tweetData.content_category || 'health_tech',
        source_attribution: tweetData.source_attribution || 'AI Generated',
        engagement_score: tweetData.engagement_score || 0,
        likes: tweetData.likes || 0,
        retweets: tweetData.retweets || 0,
        replies: tweetData.replies || 0,
        impressions: tweetData.impressions || 0,
        has_snap2health_cta: tweetData.has_snap2health_cta || false,
        new_followers: tweetData.new_followers || 0,
        image_url: tweetData.image_url || null
        // Note: id, created_at, updated_at are auto-managed by database
      };

      const { data, error } = await supabaseClient.supabase
        ?.from('tweets')
        .insert(insertData)
        .select('id')
        .single();

      if (error) {
        console.error('❌ Fixed storage error:', error);
        console.error('❌ Error details:', {
          message: error.message,
          code: error.code,
          details: error.details
        });
        return null;
      }

      console.log(`✅ Tweet successfully stored with ID: ${data?.id}`);
      return data?.id || null;

    } catch (error) {
      console.error('❌ Unexpected storage error:', error);
      return null;
    }
  }

  /**
   * Check if tweet already exists
   */
  static async tweetExists(tweetId: string): Promise<boolean> {
    try {
      const { data, error } = await supabaseClient.supabase
        ?.from('tweets')
        .select('id')
        .eq('tweet_id', tweetId)
        .limit(1);

      if (error) {
        console.error('❌ Error checking tweet existence:', error);
        return false;
      }

      return data && data.length > 0;
    } catch (error) {
      console.error('❌ Error in existence check:', error);
      return false;
    }
  }

  /**
   * Update tweet engagement metrics
   */
  static async updateTweetMetrics(tweetId: string, metrics: {
    likes?: number;
    retweets?: number;
    replies?: number;
    impressions?: number;
    engagement_score?: number;
  }): Promise<boolean> {
    try {
      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (metrics.likes !== undefined) updateData.likes = metrics.likes;
      if (metrics.retweets !== undefined) updateData.retweets = metrics.retweets;
      if (metrics.replies !== undefined) updateData.replies = metrics.replies;
      if (metrics.impressions !== undefined) updateData.impressions = metrics.impressions;
      if (metrics.engagement_score !== undefined) updateData.engagement_score = metrics.engagement_score;

      const { error } = await supabaseClient.supabase
        ?.from('tweets')
        .update(updateData)
        .eq('tweet_id', tweetId);

      if (error) {
        console.error('❌ Error updating tweet metrics:', error);
        return false;
      }

      console.log(`✅ Updated metrics for tweet: ${tweetId}`);
      return true;
    } catch (error) {
      console.error('❌ Error updating metrics:', error);
      return false;
    }
  }

  /**
   * Get recent tweets for analysis
   */
  static async getRecentTweets(hours: number = 24): Promise<TweetData[]> {
    try {
      const hoursAgo = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabaseClient.supabase
        ?.from('tweets')
        .select('*')
        .gte('created_at', hoursAgo)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching recent tweets:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('❌ Error getting recent tweets:', error);
      return [];
    }
  }

  /**
   * Test the storage system
   */
  static async testStorage(): Promise<boolean> {
    try {
      console.log('🧪 Testing tweet storage system...');

      const testTweet: TweetData = {
        tweet_id: `test_${Date.now()}`,
        content: 'Test tweet content for storage validation',
        tweet_type: 'test',
        content_type: 'TEST',
        has_snap2health_cta: false
      };

      const storedId = await this.storeTweet(testTweet);
      
      if (storedId) {
        console.log('✅ Storage test passed');
        
        // Clean up test tweet
        await supabaseClient.supabase
          ?.from('tweets')
          .delete()
          .eq('id', storedId);
        
        console.log('🗑️ Test tweet cleaned up');
        return true;
      } else {
        console.log('❌ Storage test failed');
        return false;
      }

    } catch (error) {
      console.error('❌ Storage test error:', error);
      return false;
    }
  }
} 