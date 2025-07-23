import TwitterApi from 'twitter-api-v2';
import dotenv from 'dotenv';

dotenv.config();

export interface TweetResult {
  success: boolean;
  tweetId?: string;
  error?: string;
}

export interface EngagementResult {
  success: boolean;
  data?: any;
  error?: string;
}

export interface RateLimitStatus {
  tweets3Hour: { used: number; limit: number; resetTime: Date };
  tweets24Hour: { used: number; limit: number; resetTime: Date };
}

class XService {
  private client: TwitterApi | null = null;
  private userId: string | null = null;
  private rateLimitTracking = {
    tweets3Hour: { used: 0, limit: 300, resetTime: new Date() },
    tweets24Hour: { used: 0, limit: 2400, resetTime: new Date() }
  };

  constructor() {
    this.initializeClient();
  }

  private initializeClient(): void {
    try {
      const bearerToken = process.env.TWITTER_BEARER_TOKEN;
      const apiKey = process.env.TWITTER_API_KEY;
      const apiSecret = process.env.TWITTER_API_SECRET;
      const accessToken = process.env.TWITTER_ACCESS_TOKEN;
      const accessSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;

      if (!bearerToken || !apiKey || !apiSecret || !accessToken || !accessSecret) {
        throw new Error('Missing Twitter API credentials');
      }

      this.client = new TwitterApi({
        appKey: apiKey,
        appSecret: apiSecret,
        accessToken: accessToken,
        accessSecret: accessSecret,
      });

      console.log('✅ Twitter client initialized successfully');
      this.initializeUserId();
    } catch (error) {
      console.error('❌ Failed to initialize Twitter client:', error);
    }
  }

  private async initializeUserId(): Promise<void> {
    try {
      if (!this.client) return;
      
      const user = await this.client.v2.me();
      this.userId = user.data.id;
      console.log(`✅ User ID initialized: ${this.userId}`);
    } catch (error) {
      console.error('❌ Failed to get user ID:', error);
    }
  }

  private async getUserId(): Promise<string> {
    if (!this.userId && this.client) {
      await this.initializeUserId();
    }
    
    if (!this.userId) {
      throw new Error('User ID not available');
    }
    
    return this.userId;
  }

  async postTweet(content: string): Promise<TweetResult> {
    if (!this.client) {
      return {
        success: false,
        error: 'Twitter client not initialized',
      };
    }

    try {
      const result = await this.client.v2.tweet(content);
      console.log(`✅ Tweet posted successfully: ${result.data.id}`);
      
      // Update rate limit tracking
      this.rateLimitTracking.tweets3Hour.used++;
      this.rateLimitTracking.tweets24Hour.used++;
      
      return {
        success: true,
        tweetId: result.data.id,
      };
    } catch (error: any) {
      console.error('Error posting tweet:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to post tweet',
      };
    }
  }

  // 🚀 REAL TWITTER API METHODS (No more fakes!)
  
  async searchTweets(query: string, count: number = 10): Promise<{ data: any[]; success: boolean; error?: string }> {
    if (!this.client) {
      return { data: [], success: false, error: 'Client not initialized' };
    }

    try {
      console.log(`🔍 Searching tweets: "${query}" (limit: ${count})`);
      
      // Use Twitter API v2 recent search with proper parameters
      const result = await this.client.v2.search(query, {
        max_results: Math.max(Math.min(count, 100), 10), // Twitter requires 10-100
        'tweet.fields': ['author_id', 'created_at', 'public_metrics'],
        expansions: ['author_id']
      });

      const tweets = result.data?.data || [];
      console.log(`✅ Found ${tweets.length} tweets for query: "${query}"`);
      
      return { data: tweets, success: true };
    } catch (error: any) {
      // More detailed error logging
      console.error(`❌ Search failed for "${query}":`, {
        message: error.message,
        code: error.code,
        errors: error.errors
      });
      
      // Try a simpler search as fallback
      try {
        console.log('🔄 Trying simplified search...');
        const fallbackResult = await this.client.v2.search(query);
        const fallbackTweets = fallbackResult.data?.data || [];
        console.log(`✅ Fallback found ${fallbackTweets.length} tweets`);
        return { data: fallbackTweets, success: true };
      } catch (fallbackError: any) {
        console.error('❌ Fallback search also failed:', fallbackError.message);
        return { data: [], success: false, error: fallbackError.message };
      }
    }
  }

  async likeTweet(tweetId: string): Promise<EngagementResult> {
    if (!this.client) {
      return { success: false, error: 'Client not initialized' };
    }

    try {
      const userId = await this.getUserId();
      console.log(`❤️ Liking tweet: ${tweetId}`);
      
      const result = await this.client.v2.like(userId, tweetId);
      console.log(`✅ Tweet liked successfully: ${tweetId}`);
      
      return { success: true, data: result };
    } catch (error: any) {
      console.error(`❌ Failed to like tweet ${tweetId}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  async postReply(content: string, tweetId: string): Promise<EngagementResult> {
    if (!this.client) {
      return { success: false, error: 'Client not initialized' };
    }

    try {
      console.log(`💬 Replying to tweet ${tweetId}: "${content.substring(0, 50)}..."`);
      
      const result = await this.client.v2.reply(content, tweetId);
      console.log(`✅ Reply posted successfully to ${tweetId}`);
      
      return { success: true, data: result };
    } catch (error: any) {
      console.error(`❌ Failed to reply to tweet ${tweetId}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  async followUser(userId: string): Promise<EngagementResult> {
    if (!this.client) {
      return { success: false, error: 'Client not initialized' };
    }

    try {
      const myUserId = await this.getUserId();
      console.log(`👥 Following user: ${userId}`);
      
      const result = await this.client.v2.follow(myUserId, userId);
      console.log(`✅ User followed successfully: ${userId}`);
      
      return { success: true, data: result };
    } catch (error: any) {
      console.error(`❌ Failed to follow user ${userId}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  async retweetTweet(tweetId: string): Promise<EngagementResult> {
    if (!this.client) {
      return { success: false, error: 'Client not initialized' };
    }

    try {
      const userId = await this.getUserId();
      console.log(`🔄 Retweeting: ${tweetId}`);
      
      const result = await this.client.v2.retweet(userId, tweetId);
      console.log(`✅ Tweet retweeted successfully: ${tweetId}`);
      
      return { success: true, data: result };
    } catch (error: any) {
      console.error(`❌ Failed to retweet ${tweetId}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  async getUsersToFollow(query: string, count: number = 10): Promise<{ data: any[]; success: boolean; error?: string }> {
    if (!this.client) {
      return { data: [], success: false, error: 'Client not initialized' };
    }

    try {
      console.log(`👥 Searching users: "${query}" (limit: ${count})`);
      
      // Use tweet search to find active users in health space
      const searchResult = await this.client.v2.search(`from:verified "${query}" OR "${query} health"`, {
        max_results: Math.min(count, 10),
        'tweet.fields': ['author_id', 'public_metrics'],
        'user.fields': ['public_metrics', 'description', 'verified'],
        expansions: ['author_id']
      });

      // Extract unique users from search results
      const tweets = searchResult.data?.data || [];
      const users = searchResult.includes?.users || [];
      
      console.log(`✅ Found ${users.length} users for query: "${query}"`);
      
      return { data: users, success: true };
    } catch (error: any) {
      console.error(`❌ User search failed for "${query}":`, error.message);
      return { data: [], success: false, error: error.message };
    }
  }

  async getMyTweets(count: number = 10): Promise<{ data: any[]; success: boolean; error?: string }> {
    if (!this.client) {
      return { data: [], success: false, error: 'Client not initialized' };
    }

    try {
      const userId = await this.getUserId();
      console.log(`📋 Getting my tweets (limit: ${count})`);
      
      const result = await this.client.v2.userTimeline(userId, {
        max_results: Math.min(count, 100),
        'tweet.fields': ['created_at', 'public_metrics']
      });

      const tweets = result.data?.data || [];
      console.log(`✅ Retrieved ${tweets.length} of my tweets`);
      
      return { data: tweets, success: true };
    } catch (error: any) {
      console.error('❌ Failed to get my tweets:', error.message);
      return { data: [], success: false, error: error.message };
    }
  }

  async getTweetById(tweetId: string): Promise<{ data: any; success: boolean; error?: string }> {
    if (!this.client) {
      return { data: null, success: false, error: 'Client not initialized' };
    }

    try {
      console.log(`📄 Getting tweet: ${tweetId}`);
      
      const result = await this.client.v2.singleTweet(tweetId, {
        'tweet.fields': ['author_id', 'created_at', 'public_metrics'],
        'user.fields': ['username'],
        expansions: ['author_id']
      });

      console.log(`✅ Retrieved tweet: ${tweetId}`);
      return { data: result.data, success: true };
    } catch (error: any) {
      console.error(`❌ Failed to get tweet ${tweetId}:`, error.message);
      return { data: null, success: false, error: error.message };
    }
  }

  getRateLimitStatus(): RateLimitStatus {
    return this.rateLimitTracking;
  }

  // Rate limit protected posting
  async postTweetWithRateLimit(content: string): Promise<TweetResult> {
    const status = this.getRateLimitStatus();
    
    if (status.tweets3Hour.used >= status.tweets3Hour.limit) {
      return {
        success: false,
        error: '3-hour rate limit exceeded'
      };
    }
    
    if (status.tweets24Hour.used >= status.tweets24Hour.limit) {
      return {
        success: false,
        error: '24-hour rate limit exceeded'
      };
    }
    
    return this.postTweet(content);
  }
}

export const xClient = new XService(); 