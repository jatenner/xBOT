import { TwitterApi, TwitterV2IncludesHelper, TweetV2, UserV2 } from 'twitter-api-v2';
import dotenv from 'dotenv';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

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

class XService {
  private client: TwitterApi | null = null;

  constructor() {
    this.initializeClient();
  }

  private initializeClient(): void {
    const apiKey = process.env.TWITTER_APP_KEY;
    const apiSecret = process.env.TWITTER_APP_SECRET;
    const accessToken = process.env.TWITTER_ACCESS_TOKEN;
    const accessSecret = process.env.TWITTER_ACCESS_SECRET;

    if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
      console.error('❌ Twitter API credentials not found in environment variables');
      return;
    }

    try {
      this.client = new TwitterApi({
        appKey: apiKey,
        appSecret: apiSecret,
        accessToken: accessToken,
        accessSecret: accessSecret,
      });

      console.log('✅ X/Twitter client initialized');
    } catch (error) {
      console.error('❌ Failed to initialize X/Twitter client:', error);
    }
  }

  async postTweet(content: string): Promise<TweetResult> {
    if (!this.client) {
      return {
        success: false,
        error: 'Twitter client not initialized',
      };
    }

    try {
      const tweet = await this.client.v2.tweet(content);

      return {
        success: true,
        tweetId: tweet.data.id,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
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
      let mediaBuffer: Buffer;

      if (mediaUrl.startsWith('http')) {
        // Download image from URL
        const response = await axios.get(mediaUrl, { 
          responseType: 'arraybuffer',
          timeout: 10000,
          headers: {
            'User-Agent': 'Snap2Health-Bot/1.0'
          }
        });
        mediaBuffer = Buffer.from(response.data);
      } else {
        // Read local file
        mediaBuffer = fs.readFileSync(mediaUrl);
      }

      // Upload media to Twitter
      const mediaId = await this.client.v1.uploadMedia(mediaBuffer, {
        mimeType: this.getMimeType(mediaUrl),
        target: 'tweet'
      });

      // Add alt text if provided
      if (altText) {
        await this.client.v1.createMediaMetadata(mediaId, { alt_text: { text: altText } });
      }

      return {
        success: true,
        mediaId: mediaId,
      };

    } catch (error) {
      console.error('Error uploading media:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Media upload failed',
      };
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
      let mediaIds: string[] = [];

      // Upload media if URLs provided
      if (options.mediaUrls && options.mediaUrls.length > 0) {
        for (let i = 0; i < Math.min(options.mediaUrls.length, 4); i++) { // Max 4 images
          const mediaUrl = options.mediaUrls[i];
          const altText = options.altText?.[i];
          
          const uploadResult = await this.uploadMedia(mediaUrl, altText);
          
          if (uploadResult.success && uploadResult.mediaId) {
            mediaIds.push(uploadResult.mediaId);
          } else {
            console.warn(`Failed to upload media ${i + 1}:`, uploadResult.error);
          }
        }
      }

      // Use provided media IDs if available
      if (options.mediaIds && options.mediaIds.length > 0) {
        mediaIds.push(...options.mediaIds);
      }

      // Post tweet with media
      const tweetOptions: any = {
        text: options.text
      };

      if (mediaIds.length > 0) {
        tweetOptions.media = { media_ids: mediaIds };
      }

      const tweet = await this.client.v2.tweet(tweetOptions);

      return {
        success: true,
        tweetId: tweet.data.id,
      };

    } catch (error) {
      console.error('Error posting tweet with media:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Tweet with media failed',
      };
    }
  }

  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime'
    };
    
    return mimeTypes[ext] || 'image/jpeg';
  }

  async postReply(content: string, replyToTweetId: string): Promise<ReplyResult> {
    if (!this.client) {
      console.warn('Twitter client not initialized (test mode)');
      return {
        success: true,
        replyId: 'test_reply_' + Date.now(),
      };
    }
    try {
      // TODO: Implement rate limiting check before replying
      
      const reply = await this.client.v2.tweet({
        text: content,
        reply: {
          in_reply_to_tweet_id: replyToTweetId,
        },
      });
      
      return {
        success: true,
        replyId: reply.data.id,
      };
      
    } catch (error: any) {
      console.error('Error posting reply:', error);
      
      let errorMessage = 'Unknown error occurred';
      
      if (error.code === 429) {
        errorMessage = 'Rate limit exceeded';
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
        'tweet.fields': ['created_at', 'author_id', 'public_metrics'],
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

  async searchTweets(query: string, maxResults: number = 10): Promise<TweetData[]> {
    try {
      // TODO: Implement intelligent tweet searching for reply targets
      // 1. Search for tweets in AI, health, longevity, biotech space
      // 2. Filter for high-engagement tweets
      // 3. Prioritize tweets from influential accounts
      // 4. Avoid tweets we've already replied to
      
      const searchResults = await this.client.v2.search(query, {
        max_results: maxResults,
        'tweet.fields': ['created_at', 'author_id', 'public_metrics'],
        'user.fields': ['username', 'public_metrics'],
        expansions: ['author_id'],
      });
      
      const tweets: TweetData[] = [];
      
      for (const tweet of searchResults.tweets) {
        tweets.push({
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
      
      return tweets;
      
    } catch (error) {
      console.error('Error searching tweets:', error);
      return [];
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
    try {
      // TODO: Implement rate limit checking
      // 1. Check current API rate limit status
      // 2. Return remaining requests and reset time
      // 3. Used by agents to avoid hitting limits
      
      return {
        remaining: 100, // Placeholder
        resetTime: Date.now() + (15 * 60 * 1000), // 15 minutes from now
      };
      
    } catch (error) {
      console.error('Error checking rate limit:', error);
      return {
        remaining: 0,
        resetTime: Date.now() + (15 * 60 * 1000),
      };
    }
  }

  async getMyTweets(count: number = 10): Promise<TweetData[]> {
    try {
      // TODO: Implement fetching our own tweets for engagement analysis
      const tweets = await this.client.v2.userTimeline(await this.getMyUserId(), {
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

  private async getMyUserId(): Promise<string> {
    try {
      const me = await this.client.v2.me();
      return me.data.id;
    } catch (error) {
      console.error('Error getting my user ID:', error);
      throw error;
    }
  }
}

export const xClient = new XService(); 