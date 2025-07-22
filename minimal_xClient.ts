import TwitterApi from 'twitter-api-v2';
import dotenv from 'dotenv';

dotenv.config();

export interface TweetResult {
  success: boolean;
  tweetId?: string;
  error?: string;
}

class XService {
  private client: TwitterApi | null = null;

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
    } catch (error) {
      console.error('❌ Failed to initialize Twitter client:', error);
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
      const result = await this.client.v2.tweet(content);
      console.log(`✅ Tweet posted successfully: ${result.data.id}`);
      
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
}

export const xClient = new XService(); 