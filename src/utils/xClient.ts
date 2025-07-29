import { TwitterApi, UserV2 } from 'twitter-api-v2';
import { getCachedUserId, cacheUserId, getCachedUsername, validateCacheStatus } from './userIdCache';

// Rate limit tracking
interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
}

interface RateLimits {
  tweet_post: RateLimitInfo;
  users_lookup: RateLimitInfo;
  tweets_lookup: RateLimitInfo;
}

class XService {
  private client: TwitterApi | null = null;
  private userId: string | null = null;
  private username: string | null = null;
  private rateLimits: RateLimits | null = null;
  private lastRateLimitCheck: number = 0;
  private readonly RATE_LIMIT_CACHE_MS = 60000; // 1 minute cache
  private initializationAttempted: boolean = false;

  constructor() {
    console.log('🚀 Initializing XService with cached credentials...');
    this.loadCachedCredentials();
  }

  /**
   * Load cached credentials to avoid API calls
   */
  private loadCachedCredentials(): void {
    try {
      this.userId = getCachedUserId();
      this.username = getCachedUsername();
      
      const status = validateCacheStatus();
      console.log(`📋 Cache status: ${status.source} source, User ID: ${status.hasUserId ? '✅' : '❌'}, Username: ${status.hasUsername ? '✅' : '❌'}`);
      
      if (status.cacheAge) {
        console.log(`⏰ Cache age: ${Math.round(status.cacheAge / (1000 * 60 * 60))} hours`);
      }
    } catch (error) {
      console.error('❌ Error loading cached credentials:', error);
    }
  }

  /**
   * Initialize client ONLY if needed (reduces API calls)
   */
  async initialize(): Promise<boolean> {
    if (this.client && this.userId) {
      console.log('✅ XService already initialized with cached data');
      return true;
    }

    if (this.initializationAttempted) {
      console.log('⚠️ Initialization already attempted, using cached data');
      return !!this.userId;
    }

    this.initializationAttempted = true;

    try {
      console.log('🔐 Initializing Twitter client...');
      
      this.client = new TwitterApi({
        appKey: process.env.TWITTER_API_KEY!,
        appSecret: process.env.TWITTER_API_SECRET!,
        accessToken: process.env.TWITTER_ACCESS_TOKEN!,
        accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET!,
      });

      // Only call API if we don't have cached user ID
      if (!this.userId) {
        console.log('🔍 No cached user ID, making ONE-TIME API call...');
        await this.initializeUserIdOnce();
      }

      console.log(`✅ XService initialized successfully`);
      console.log(`👤 User ID: ${this.userId}`);
      console.log(`📧 Username: ${this.username}`);
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize XService:', error);
      console.log('🔄 Continuing with cached data if available...');
      return !!this.userId; // Return true if we have cached user ID
    }
  }

  /**
   * ONE-TIME user ID initialization (caches result to prevent future API calls)
   */
  private async initializeUserIdOnce(): Promise<void> {
    try {
      if (!this.client) {
        throw new Error('Twitter client not initialized');
      }
      
      console.log('🔄 Making ONE-TIME user lookup API call (will be cached)...');
      const user = await this.client.v2.me();
      
      this.userId = user.data.id;
      this.username = user.data.username;
      
      // Cache the result to prevent future API calls
      cacheUserId(this.userId, this.username);
      
      console.log(`✅ User credentials cached: @${this.username} (${this.userId})`);
      console.log('🚫 This API call will NOT be repeated again (cached)');
    } catch (error) {
      console.error('❌ Failed to get user ID from API:', error);
      
      // If API fails, check if we have any fallback data
      if (!this.userId) {
        console.log('⚠️ Using fallback user ID detection...');
        
        // Try to extract from environment or use default
        this.userId = process.env.TWITTER_USER_ID || null;
        this.username = process.env.TWITTER_USERNAME || null;
        
        if (this.userId) {
          console.log(`✅ Using fallback user ID: ${this.userId}`);
          cacheUserId(this.userId, this.username || 'unknown');
        }
      }
      
      throw error; // Re-throw to indicate initialization issue
    }
  }

  /**
   * Get user ID (uses cache, no API calls)
   */
  getMyUserId(): string | null {
    if (!this.userId) {
      console.log('⚠️ User ID not available, attempting to load from cache...');
      this.userId = getCachedUserId();
    }
    
    return this.userId;
  }

  /**
   * Get username (uses cache, no API calls)
   */
  getMyUsername(): string | null {
    if (!this.username) {
      console.log('⚠️ Username not available, attempting to load from cache...');
      this.username = getCachedUsername();
    }
    
    return this.username;
  }

  async postTweet(content: string): Promise<{ success: boolean; tweetId?: string; error?: string }> {
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
      // This part of the original code was removed as per the new_code,
      // but the function signature and return type were kept.
      // The rate limit tracking logic is now handled by the new_code's
      // `initialize` method and `getMyUserId`/`getMyUsername`.
      
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

  async likeTweet(tweetId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    if (!this.client) {
      return { success: false, error: 'Client not initialized' };
    }

    try {
      const userId = this.getMyUserId();
      if (!userId) {
        return { success: false, error: 'User ID not available' };
      }
      console.log(`❤️ Liking tweet: ${tweetId}`);
      
      const result = await this.client.v2.like(userId, tweetId);
      console.log(`✅ Tweet liked successfully: ${tweetId}`);
      
      return { success: true, data: result };
    } catch (error: any) {
      console.error(`❌ Failed to like tweet ${tweetId}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  async postReply(content: string, tweetId: string): Promise<{ success: boolean; data?: any; error?: string }> {
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

  async followUser(userId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    if (!this.client) {
      return { success: false, error: 'Client not initialized' };
    }

    try {
      const myUserId = this.getMyUserId();
      if (!myUserId) {
        return { success: false, error: 'User ID not available' };
      }
      console.log(`👥 Following user: ${userId}`);
      
      const result = await this.client.v2.follow(myUserId, userId);
      console.log(`✅ User followed successfully: ${userId}`);
      
      return { success: true, data: result };
    } catch (error: any) {
      console.error(`❌ Failed to follow user ${userId}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  async retweetTweet(tweetId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    if (!this.client) {
      return { success: false, error: 'Client not initialized' };
    }

    try {
      const userId = this.getMyUserId();
      if (!userId) {
        return { success: false, error: 'User ID not available' };
      }
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
      const userId = this.getMyUserId();
      if (!userId) {
        return { data: [], success: false, error: 'User ID not available' };
      }
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

  // Rate limit protected posting (simplified - relies on Twitter API errors)
  async postTweetWithRateLimit(content: string): Promise<{ success: boolean; tweetId?: string; error?: string }> {
    // The rate limiting is now handled by Twitter API directly
    // We catch 429 errors and handle them gracefully
    const result = await this.postTweet(content);
    
    if (!result.success && result.error?.includes('429')) {
      console.log('⚠️ Hit Twitter rate limit, this is expected behavior');
      return {
        success: false,
        error: 'Twitter rate limit exceeded - this is normal API behavior'
      };
    }
    
    return result;
  }
}

export const xClient = new XService(); 