import { FixedTweetStorage, TweetData } from './fixedTweetStorage';

/**
 * 🔧 FIXED SUPABASE CLIENT WRAPPER
 * 
 * This provides a drop-in replacement for the broken saveTweetToDatabase functions
 * that the existing agents are using.
 */
export class FixedSupabaseClient {
  
  /**
   * Save tweet to database with correct schema and authentication
   * This replaces the broken saveTweetToDatabase functions
   */
  static async saveTweetToDatabase(tweetData: {
    tweet_id: string;
    content: string;
    tweet_type?: string;
    content_type?: string;
    source_attribution?: string;
    engagement_score?: number;
    likes?: number;
    retweets?: number;
    replies?: number;
    impressions?: number;
    has_snap2health_cta?: boolean;
  }, twitterResult?: any): Promise<string | null> {
    
    try {
      console.log('💾 Using FIXED storage system...');
      
      const fixedTweetData: TweetData = {
        tweet_id: tweetData.tweet_id,
        content: tweetData.content,
        tweet_type: tweetData.tweet_type || 'original',
        content_type: tweetData.content_type || 'general',
        content_category: this.categorizeContent(tweetData.content),
        source_attribution: tweetData.source_attribution || 'AI Generated',
        engagement_score: tweetData.engagement_score || 0,
        likes: tweetData.likes || 0,
        retweets: tweetData.retweets || 0,
        replies: tweetData.replies || 0,
        impressions: tweetData.impressions || 0,
        has_snap2health_cta: tweetData.has_snap2health_cta || false,
        new_followers: 0,
        image_url: null
      };

      const storedId = await FixedTweetStorage.storeTweet(fixedTweetData);
      
      if (storedId) {
        console.log(`✅ FIXED STORAGE: Tweet saved successfully with ID: ${storedId}`);
        return storedId;
      } else {
        console.error('❌ FIXED STORAGE: Failed to save tweet');
        return null;
      }
      
    } catch (error) {
      console.error('❌ FIXED STORAGE ERROR:', error);
      return null;
    }
  }

  /**
   * Smart content categorization based on content analysis
   */
  private static categorizeContent(content: string): string {
    const lowerContent = content.toLowerCase();
    
    if (lowerContent.includes('study') || lowerContent.includes('research') || lowerContent.includes('trial')) {
      return 'clinical_research';
    }
    if (lowerContent.includes('ai') || lowerContent.includes('artificial intelligence') || lowerContent.includes('machine learning')) {
      return 'ai_technology';
    }
    if (lowerContent.includes('fda') || lowerContent.includes('approved') || lowerContent.includes('regulation')) {
      return 'regulatory';
    }
    if (lowerContent.includes('breaking') || lowerContent.includes('just in') || lowerContent.includes('news')) {
      return 'breaking_news';
    }
    if (lowerContent.includes('digital therapeutics') || lowerContent.includes('dtx') || lowerContent.includes('app')) {
      return 'digital_therapeutics';
    }
    if (lowerContent.includes('startup') || lowerContent.includes('funding') || lowerContent.includes('investment')) {
      return 'business';
    }
    
    return 'health_tech';
  }

  /**
   * Check if tweet already exists to prevent duplicates
   */
  static async tweetExists(tweetId: string): Promise<boolean> {
    return await FixedTweetStorage.tweetExists(tweetId);
  }

  /**
   * Update tweet metrics after posting
   */
  static async updateTweetMetrics(tweetId: string, metrics: {
    likes?: number;
    retweets?: number;
    replies?: number;
    impressions?: number;
    engagement_score?: number;
  }): Promise<boolean> {
    return await FixedTweetStorage.updateTweetMetrics(tweetId, metrics);
  }

  /**
   * Get recent tweets for analysis
   */
  static async getRecentTweets(hours: number = 24): Promise<TweetData[]> {
    return await FixedTweetStorage.getRecentTweets(hours);
  }
}

// Create a global instance that can be imported as supabaseClient
export const fixedSupabaseClient = {
  saveTweetToDatabase: FixedSupabaseClient.saveTweetToDatabase.bind(FixedSupabaseClient),
  tweetExists: FixedSupabaseClient.tweetExists.bind(FixedSupabaseClient),
  updateTweetMetrics: FixedSupabaseClient.updateTweetMetrics.bind(FixedSupabaseClient),
  getRecentTweets: FixedSupabaseClient.getRecentTweets.bind(FixedSupabaseClient)
}; 