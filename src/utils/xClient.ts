import { TwitterApi } from 'twitter-api-v2';
import * as dotenv from 'dotenv';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { supabaseClient } from './supabaseClient';
import fetch from 'node-fetch';

dotenv.config();

export interface TweetResult {
  success: boolean;
  tweetId?: string;
  error?: string;
}

export interface ReplyResult {
  success: boolean;
  replyId?: string;
  error?: string;
}

export interface LikeResult {
  success: boolean;
  error?: string;
}

export interface FollowResult {
  success: boolean;
  error?: string;
}

export interface RetweetResult {
  success: boolean;
  retweetId?: string;
  error?: string;
}

export interface TweetData {
  id: string;
  text: string;
  author_id: string;
  created_at: string;
  public_metrics: {
    retweet_count: number;
    like_count: number;
    reply_count: number;
    quote_count: number;
    impression_count: number;
  };
}

export interface UserData {
  id: string;
  username: string;
  name: string;
  public_metrics: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
  };
}

export interface MediaUploadResult {
  success: boolean;
  mediaId?: string;
  error?: string;
}

export interface TweetWithMediaOptions {
  text: string;
  mediaUrls?: string[];
  mediaIds?: string[];
  altText?: string[];
}

export interface TweetSearchResult {
  success: boolean;
  tweets: SearchedTweet[];
  message?: string;
  error?: string;
}

export interface SearchedTweet {
  id: string;
  text: string;
  authorId: string;
  authorUsername: string;
  authorName: string;
  createdAt: string;
  publicMetrics: {
    retweet_count: number;
    like_count: number;
    reply_count: number;
    quote_count: number;
  };
}

/**
 * Real Twitter API v2 Rate Limits (as of 2024)
 * Free Tier Write Limits:
 * - 300 tweets per 3-hour rolling window
 * - 2400 tweets per 24-hour rolling window
 */
interface TwitterRateLimits {
  tweets3Hour: { used: number; limit: number; resetTime: Date };
  tweets24Hour: { used: number; limit: number; resetTime: Date };
  lastTweetTime: Date | null;
}

class XService {
  private client: TwitterApi | null = null;
  private lastPostTime = 0;
  private minPostInterval = 90000; // 1.5 minutes minimum between posts
  private consecutiveErrors = 0;
  private maxConsecutiveErrors = 3;
  private rateLimits: TwitterRateLimits;
  
  // 🎯 CACHED USER ID - No more /users/me calls!
  private myUserId: string | null = null;

  constructor() {
    this.initializeClient();
    this.initializeRateLimits();
    this.loadCachedUserId();
  }

  private initializeClient(): void {
    try {
      const bearerToken = process.env.TWITTER_BEARER_TOKEN;
      const apiKey = process.env.TWITTER_API_KEY;
      const apiSecret = process.env.TWITTER_API_SECRET;
      const accessToken = process.env.TWITTER_ACCESS_TOKEN;
      const accessSecret = process.env.TWITTER_ACCESS_SECRET;

      if (!bearerToken || !apiKey || !apiSecret || !accessToken || !accessSecret) {
        throw new Error('Missing Twitter API credentials');
      }

      this.client = new TwitterApi({
        appKey: apiKey,
        appSecret: apiSecret,
        accessToken: accessToken,
        accessSecret: accessSecret,
      });

      console.log('✅ X/Twitter client initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Twitter client:', error);
    }
  }

  private initializeRateLimits(): void {
    this.rateLimits = {
      tweets3Hour: { used: 0, limit: 300, resetTime: this.getNext3HourReset() },
      tweets24Hour: { used: 0, limit: 2400, resetTime: this.getNext24HourReset() },
      lastTweetTime: null
    };
  }

  private loadCachedUserId(): void {
    // 🎯 Use environment variable for user ID (no API call needed!)
    this.myUserId = process.env.TWITTER_USER_ID || null;
    
    if (!this.myUserId) {
      console.warn('⚠️ TWITTER_USER_ID not found in environment variables');
      console.warn('💡 Run: node get_twitter_user_id.js to get your user ID');
    } else {
      console.log(`✅ Using cached user ID: ${this.myUserId}`);
    }
  }

  private getNext3HourReset(): Date {
    const now = new Date();
    const next3Hour = new Date(now);
    const hours = now.getHours();
    const next3HourBoundary = Math.ceil((hours + 1) / 3) * 3;
    next3Hour.setHours(next3HourBoundary, 0, 0, 0);
    if (next3Hour <= now) {
      next3Hour.setHours(next3Hour.getHours() + 3);
    }
    return next3Hour;
  }

  private getNext24HourReset(): Date {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  }

  /**
   * 🚨 REAL RATE LIMIT CHECK - Only Twitter's actual limits
   */
  private async checkRealRateLimits(): Promise<boolean> {
    const now = new Date();
    
    // Reset counters if time windows have passed
    if (now >= this.rateLimits.tweets3Hour.resetTime) {
      this.rateLimits.tweets3Hour.used = 0;
      this.rateLimits.tweets3Hour.resetTime = this.getNext3HourReset();
    }
    
    if (now >= this.rateLimits.tweets24Hour.resetTime) {
      this.rateLimits.tweets24Hour.used = 0;
      this.rateLimits.tweets24Hour.resetTime = this.getNext24HourReset();
    }
    
    // Check if we can post based on real Twitter limits
    const can3Hour = this.rateLimits.tweets3Hour.used < this.rateLimits.tweets3Hour.limit;
    const can24Hour = this.rateLimits.tweets24Hour.used < this.rateLimits.tweets24Hour.limit;
    
    if (!can3Hour) {
      const minutesToReset = Math.ceil((this.rateLimits.tweets3Hour.resetTime.getTime() - now.getTime()) / 60000);
      console.log(`🚨 3-hour rate limit reached (${this.rateLimits.tweets3Hour.used}/${this.rateLimits.tweets3Hour.limit}). Reset in ${minutesToReset} minutes.`);
      return false;
    }
    
    if (!can24Hour) {
      const hoursToReset = Math.ceil((this.rateLimits.tweets24Hour.resetTime.getTime() - now.getTime()) / 3600000);
      console.log(`🚨 24-hour rate limit reached (${this.rateLimits.tweets24Hour.used}/${this.rateLimits.tweets24Hour.limit}). Reset in ${hoursToReset} hours.`);
      return false;
    }
    
    return true;
  }

  private incrementTweetCount(): void {
    this.rateLimits.tweets3Hour.used++;
    this.rateLimits.tweets24Hour.used++;
    this.rateLimits.lastTweetTime = new Date();
    
    console.log(`📊 Tweet count: 3h(${this.rateLimits.tweets3Hour.used}/${this.rateLimits.tweets3Hour.limit}) 24h(${this.rateLimits.tweets24Hour.used}/${this.rateLimits.tweets24Hour.limit})`);
  }

  async postTweet(content: string): Promise<TweetResult> {
    if (!this.client) {
      return {
        success: false,
        error: 'Twitter client not initialized',
      };
    }

    try {
      // 🚨 CHECK REAL RATE LIMITS ONLY
      if (!(await this.checkRealRateLimits())) {
        return {
          success: false,
          error: 'Real Twitter rate limit reached'
        };
      }

      const result = await this.client.v2.tweet(content);
      this.incrementTweetCount();
      
      console.log(`✅ Tweet posted successfully: ${result.data.id}`);
      
      return {
        success: true,
        tweetId: result.data.id,
      };
    } catch (error: any) {
      console.error('Error posting tweet:', error);
      
      // Handle only real 429 errors from Twitter
      if (error.code === 429) {
        console.log('⚠️ Real Twitter rate limit hit - will wait for reset');
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to post tweet',
      };
    }
  }

  async uploadMedia(mediaUrl: string, altText?: string): Promise<MediaUploadResult> {
    if (!this.client) {
      return {
        success: false,
        error: 'Twitter client not initialized',
      };
    }

    try {
      // Download the media file
      const response = await fetch(mediaUrl);
      const buffer = await response.buffer();
      
      // Create a temporary file
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const fileName = `temp_media_${Date.now()}.${this.getFileExtension(mediaUrl)}`;
      const filePath = path.join(tempDir, fileName);
      
      fs.writeFileSync(filePath, buffer);
      
      try {
        // Upload media to Twitter
        const mediaId = await this.client.v1.uploadMedia(filePath, {
          mimeType: this.getMimeType(filePath),
          target: 'tweet',
        });
        
        // Add alt text if provided
        if (altText) {
          await this.client.v1.createMediaMetadata(mediaId, { alt_text: { text: altText } });
        }
        
        // Clean up temp file
        fs.unlinkSync(filePath);
        
        return {
          success: true,
          mediaId: mediaId,
        };
      } catch (uploadError) {
        // Clean up temp file on error
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        throw uploadError;
      }
    } catch (error: any) {
      console.error('Error uploading media:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to upload media',
      };
    }
  }

  private getFileExtension(url: string): string {
    const urlParts = url.split('.');
    return urlParts[urlParts.length - 1].split('?')[0] || 'jpg';
  }

  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.png':
        return 'image/png';
      case '.gif':
        return 'image/gif';
      case '.mp4':
        return 'video/mp4';
      case '.webp':
        return 'image/webp';
      default:
        return 'image/jpeg';
    }
  }

  async postTweetWithMedia(options: TweetWithMediaOptions): Promise<TweetResult> {
    if (!this.client) {
      return {
        success: false,
        error: 'Twitter client not initialized',
      };
    }

    try {
      // 🚨 CHECK REAL RATE LIMITS ONLY
      if (!(await this.checkRealRateLimits())) {
        return {
          success: false,
          error: 'Real Twitter rate limit reached'
        };
      }

      let mediaIds: string[] = [];

      // Upload media if URLs are provided
      if (options.mediaUrls && options.mediaUrls.length > 0) {
        for (let i = 0; i < options.mediaUrls.length; i++) {
          const mediaUrl = options.mediaUrls[i];
          const altText = options.altText?.[i];
          
          const uploadResult = await this.uploadMedia(mediaUrl, altText);
          
          if (!uploadResult.success) {
            return {
              success: false,
              error: `Failed to upload media: ${uploadResult.error}`,
            };
          }
          
          if (uploadResult.mediaId) {
            mediaIds.push(uploadResult.mediaId);
          }
        }
      }

      // Use provided media IDs if no URLs
      if (options.mediaIds && options.mediaIds.length > 0 && mediaIds.length === 0) {
        mediaIds = options.mediaIds;
      }

      // Post tweet with media
      const tweetOptions: any = {
        text: options.text,
      };

      if (mediaIds.length > 0) {
        tweetOptions.media = {
          media_ids: mediaIds,
        };
      }

      const result = await this.client.v2.tweet(tweetOptions);
      this.incrementTweetCount();
      
      console.log(`✅ Tweet with media posted successfully: ${result.data.id}`);
      
      return {
        success: true,
        tweetId: result.data.id,
      };
    } catch (error: any) {
      console.error('Error posting tweet with media:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to post tweet with media',
      };
    }
  }

  async postReply(content: string, replyToTweetId: string): Promise<ReplyResult> {
    if (!this.client) {
      return {
        success: false,
        error: 'Twitter client not initialized',
      };
    }

    try {
      // 🚨 CHECK REAL RATE LIMITS ONLY
      if (!(await this.checkRealRateLimits())) {
        return {
          success: false,
          error: 'Real Twitter rate limit reached'
        };
      }

      const result = await this.client.v2.reply(content, replyToTweetId);
      this.incrementTweetCount();
      
      console.log(`✅ Reply posted successfully: ${result.data.id}`);
      
      return {
        success: true,
        replyId: result.data.id,
      };
    } catch (error: any) {
      console.error('Error posting reply:', error);
      
      let errorMessage = 'Unknown error occurred';
      
      if (error.code === 429) {
        errorMessage = 'Real Twitter rate limit exceeded';
      } else if (error.code === 403) {
        errorMessage = 'Reply forbidden';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async getTweetById(tweetId: string): Promise<TweetData | null> {
    try {
      const tweet = await this.client.v2.singleTweet(tweetId, {
        'tweet.fields': ['created_at', 'public_metrics'],
      });
      
      return {
        id: tweet.data.id,
        text: tweet.data.text,
        author_id: tweet.data.author_id || '',
        created_at: tweet.data.created_at || '',
        public_metrics: {
          retweet_count: tweet.data.public_metrics?.retweet_count || 0,
          like_count: tweet.data.public_metrics?.like_count || 0,
          reply_count: tweet.data.public_metrics?.reply_count || 0,
          quote_count: tweet.data.public_metrics?.quote_count || 0,
          impression_count: tweet.data.public_metrics?.impression_count || 0,
        },
      };
    } catch (error) {
      console.error('Error fetching tweet:', error);
      return null;
    }
  }

  async searchTweets(query: string, count: number = 10): Promise<TweetSearchResult> {
    if (!this.client) {
      return {
        success: false,
        error: 'Twitter client not initialized',
        tweets: [],
      };
    }

    try {
      const response = await this.client.v2.search(query, {
        max_results: Math.min(count, 100),
        'tweet.fields': ['author_id', 'created_at', 'public_metrics', 'context_annotations'],
        'user.fields': ['username', 'name', 'public_metrics'],
        expansions: ['author_id']
      });

      const tweets: SearchedTweet[] = [];
      
      if (response.data && response.data.data) {
        for (const tweet of response.data.data) {
          const author = response.data.includes?.users?.find(user => user.id === tweet.author_id);
          
          tweets.push({
            id: tweet.id,
            text: tweet.text,
            authorId: tweet.author_id,
            authorUsername: author?.username || 'unknown',
            authorName: author?.name || 'Unknown User',
            createdAt: tweet.created_at || new Date().toISOString(),
            publicMetrics: tweet.public_metrics || {
              retweet_count: 0,
              like_count: 0,
              reply_count: 0,
              quote_count: 0
            }
          });
        }
      }

      return {
        success: true,
        tweets,
      };
    } catch (error: any) {
      // Only handle actual API errors, no artificial monthly caps
      if (error.code === 429) {
        console.log('⚠️ Search rate limit hit - will retry later');
        return {
          success: false,
          error: 'Search rate limit exceeded - try again later',
          tweets: [],
        };
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Search failed',
        tweets: [],
      };
    }
  }

  async getUserByUsername(username: string): Promise<UserData | null> {
    try {
      const user = await this.client.v2.userByUsername(username, {
        'user.fields': ['public_metrics'],
      });
      
      return {
        id: user.data.id,
        username: user.data.username,
        name: user.data.name,
        public_metrics: {
          followers_count: user.data.public_metrics?.followers_count || 0,
          following_count: user.data.public_metrics?.following_count || 0,
          tweet_count: user.data.public_metrics?.tweet_count || 0,
        },
      };
      
    } catch (error) {
      console.error('Error fetching user:', error);
      return null;
    }
  }

  async checkRateLimit(): Promise<{ remaining: number; resetTime: number }> {
    // Return real rate limit status based on our tracking
    const now = new Date();
    const remaining3h = this.rateLimits.tweets3Hour.limit - this.rateLimits.tweets3Hour.used;
    const remaining24h = this.rateLimits.tweets24Hour.limit - this.rateLimits.tweets24Hour.used;
    
    // Return the most restrictive limit
    const remaining = Math.min(remaining3h, remaining24h);
    const resetTime = remaining3h < remaining24h 
      ? this.rateLimits.tweets3Hour.resetTime.getTime()
      : this.rateLimits.tweets24Hour.resetTime.getTime();
    
    return {
      remaining,
      resetTime,
    };
  }

  async getMyTweets(count: number = 10): Promise<TweetData[]> {
    if (!this.myUserId) {
      console.error('❌ Cannot fetch my tweets: User ID not available');
      return [];
    }

    try {
      const tweets = await this.client.v2.userTimeline(this.myUserId, {
        max_results: count,
        'tweet.fields': ['created_at', 'public_metrics'],
      });
      
      const result: TweetData[] = [];
      
      for (const tweet of tweets.tweets) {
        result.push({
          id: tweet.id,
          text: tweet.text,
          author_id: tweet.author_id || '',
          created_at: tweet.created_at || '',
          public_metrics: {
            retweet_count: tweet.public_metrics?.retweet_count || 0,
            like_count: tweet.public_metrics?.like_count || 0,
            reply_count: tweet.public_metrics?.reply_count || 0,
            quote_count: tweet.public_metrics?.quote_count || 0,
            impression_count: tweet.public_metrics?.impression_count || 0,
          },
        });
      }
      
      return result;
      
    } catch (error) {
      console.error('Error fetching my tweets:', error);
      return [];
    }
  }

  /**
   * 🎯 Get cached user ID (no API call!)
   */
  getMyUserId(): string {
    if (!this.myUserId) {
      throw new Error('User ID not available. Set TWITTER_USER_ID environment variable.');
    }
    return this.myUserId;
  }

  async likeTweet(tweetId: string): Promise<LikeResult> {
    if (!this.client) {
      return {
        success: false,
        error: 'Twitter client not initialized',
      };
    }

    try {
      await this.client.v2.like(this.getMyUserId(), tweetId);
      
      return {
        success: true,
      };
    } catch (error: any) {
      console.error('Error liking tweet:', error);
      
      let errorMessage = 'Unknown error occurred';
      
      if (error.code === 429) {
        errorMessage = 'Rate limit exceeded for likes';
      } else if (error.code === 403) {
        errorMessage = 'Like forbidden or already liked';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async followUser(userId: string): Promise<FollowResult> {
    if (!this.client) {
      return {
        success: false,
        error: 'Twitter client not initialized',
      };
    }

    try {
      await this.client.v2.follow(this.getMyUserId(), userId);
      
      return {
        success: true,
      };
    } catch (error: any) {
      console.error('Error following user:', error);
      
      let errorMessage = 'Unknown error occurred';
      
      if (error.code === 429) {
        errorMessage = 'Rate limit exceeded for follows';
      } else if (error.code === 403) {
        errorMessage = 'Follow forbidden or already following';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async retweetTweet(tweetId: string): Promise<RetweetResult> {
    if (!this.client) {
      return {
        success: false,
        error: 'Twitter client not initialized',
      };
    }

    try {
      const retweet = await this.client.v2.retweet(this.getMyUserId(), tweetId);
      
      return {
        success: true,
        retweetId: tweetId,
      };
    } catch (error: any) {
      console.error('Error retweeting:', error);
      
      let errorMessage = 'Unknown error occurred';
      
      if (error.code === 429) {
        errorMessage = 'Rate limit exceeded for retweets';
      } else if (error.code === 403) {
        errorMessage = 'Retweet forbidden or already retweeted';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async getUsersToFollow(query: string, maxResults: number = 10): Promise<UserData[]> {
    try {
      // Search for tweets and get their authors as a workaround
      const searchResults = await this.client.v2.search(query, {
        max_results: Math.min(maxResults, 10),
        'tweet.fields': ['author_id'],
        'user.fields': ['public_metrics'],
        expansions: ['author_id'],
      });
      
      const users: UserData[] = [];
      
      if (searchResults.includes?.users) {
        for (const user of searchResults.includes.users) {
          users.push({
            id: user.id,
            username: user.username,
            name: user.name,
            public_metrics: {
              followers_count: user.public_metrics?.followers_count || 0,
              following_count: user.public_metrics?.following_count || 0,
              tweet_count: user.public_metrics?.tweet_count || 0,
            },
          });
        }
      }
      
      return users.slice(0, maxResults);
      
    } catch (error) {
      console.error('Error searching users to follow:', error);
      // Return empty array if search fails
      return [];
    }
  }

  /**
   * Enhanced tweet posting with real rate limit protection only
   */
  async postTweetWithRateLimit(content: string): Promise<any> {
    // Check real rate limits first
    if (!(await this.checkRealRateLimits())) {
      throw new Error('Real Twitter rate limit reached');
    }

    // Check if we need to wait (minimum interval protection)
    const now = Date.now();
    const timeSinceLastPost = now - this.lastPostTime;
    
    if (timeSinceLastPost < this.minPostInterval) {
      const waitTime = this.minPostInterval - timeSinceLastPost;
      console.log(`⏳ Rate limit protection: waiting ${Math.round(waitTime/1000)}s before posting`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    // Exponential backoff for consecutive errors
    if (this.consecutiveErrors > 0) {
      const backoffTime = Math.min(300000, 30000 * Math.pow(2, this.consecutiveErrors - 1)); // Max 5 min
      console.log(`⏸️  Backoff delay: ${Math.round(backoffTime/1000)}s (${this.consecutiveErrors} consecutive errors)`);
      await new Promise(resolve => setTimeout(resolve, backoffTime));
    }

    try {
      const result = await this.client.v2.tweet(content);
      this.lastPostTime = Date.now();
      this.consecutiveErrors = 0; // Reset on success
      this.incrementTweetCount();
      return result;
    } catch (error: any) {
      this.consecutiveErrors++;
      
      if (error.code === 429) {
        console.log('⚠️ Rate limit hit, increasing interval');
        this.minPostInterval = Math.min(600000, this.minPostInterval * 1.5); // Max 10 min
      } else if (error.code === 403) {
        console.log('⚠️ Tweet forbidden, may be duplicate or violate policies');
      }
      
      // Circuit breaker
      if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
        console.log('🛑 Circuit breaker: too many consecutive errors, pausing for 10 minutes');
        await new Promise(resolve => setTimeout(resolve, 600000));
        this.consecutiveErrors = 0;
      }
      
      throw error;
    }
  }

  /**
   * Get current rate limit status
   */
  getRateLimitStatus(): TwitterRateLimits {
    return { ...this.rateLimits };
  }

  /**
   * Reset rate limit counters (for testing or manual reset)
   */
  resetRateLimits(): void {
    this.initializeRateLimits();
    console.log('🔄 Rate limits reset');
  }
}

export const xClient = new XService(); 