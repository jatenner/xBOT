import { Page, BrowserContext } from 'playwright';
import { browserManager } from './BrowserManager';
import { storeTweetMetrics } from '../db/index';
import { throttledError } from '../utils/throttledWarn';

interface TweetResult {
  success: boolean;
  tweetId?: string;
  error?: string;
}

interface ThreadResult {
  success: boolean;
  rootTweetId?: string;
  replyIds?: string[];
  error?: string;
}

/**
 * Enhanced tweet posting with BrowserManager integration
 */
export class TwitterPoster {
  private capturedTweetIds: Map<number, string> = new Map();

  constructor() {
    console.log('🐦 TwitterPoster initialized with BrowserManager');
  }

  private setupNetworkInterception(page: Page): void {
    page.on('response', async (response) => {
      const url = response.url();
      
      // Intercept Twitter API responses that contain tweet IDs
      if (this.isTweetCreationResponse(url)) {
        try {
          const responseData = await response.json();
          const tweetId = this.extractTweetIdFromResponse(responseData);
          if (tweetId) {
            this.capturedTweetIds.set(Date.now(), tweetId);
            console.log(`📡 Captured tweet ID: ${tweetId}`);
          }
        } catch (error) {
          // Ignore non-JSON responses
        }
      }
    });
  }

  private isTweetCreationResponse(url: string): boolean {
    return url.includes('CreateTweet') || 
           url.includes('CreateRetweet') || 
           url.includes('api/1.1/statuses/update') ||
           url.includes('api/2/timeline/home.json');
  }

  private extractTweetIdFromResponse(responseData: any): string | null {
    // Try various response structures
    if (responseData?.data?.create_tweet?.tweet_results?.result?.rest_id) {
      return responseData.data.create_tweet.tweet_results.result.rest_id;
    }
    
    if (responseData?.data?.tweet?.rest_id) {
      return responseData.data.tweet.rest_id;
    }
    
    if (responseData?.id_str) {
      return responseData.id_str;
    }
    
    return null;
  }

  private getLatestCapturedTweetId(): string | null {
    if (this.capturedTweetIds.size === 0) return null;
    
    const latestTimestamp = Math.max(...this.capturedTweetIds.keys());
    return this.capturedTweetIds.get(latestTimestamp) || null;
  }

  async postSingleTweet(content: string, topic?: string): Promise<TweetResult> {
    try {
      console.log(`📝 Posting single tweet: "${content.substring(0, 50)}..."`);
      
      return await browserManager.withContext('posting', async (context) => {
        const page = await context.newPage();
        
        // Set up network interception for this posting session
        this.setupNetworkInterception(page);
        this.capturedTweetIds.clear();
        
        return await this.executeSingleTweetPost(page, content, topic);
      });
      
    } catch (error: any) {
      throttledError(`Failed to post single tweet: ${error.message}`, 'post_single_tweet');
      return { success: false, error: error.message };
    }
  }

  private async executeSingleTweetPost(page: Page, content: string, topic?: string): Promise<TweetResult> {
    try {
      // Navigate to compose
      await page.goto('https://x.com/compose/tweet', { waitUntil: 'networkidle' });
      
      // Wait for composer and type content
      const tweetTextarea = await page.waitForSelector('[data-testid="tweetTextarea_0"]', { timeout: 10000 });
      await tweetTextarea.fill(content);
      
      // Post tweet
      const postButton = await page.waitForSelector('[data-testid="tweetButtonInline"]', { timeout: 5000 });
      await postButton.click();
      
      // Wait for posting to complete
      await page.waitForTimeout(3000);
      
      // Get tweet ID from captured network data
      const tweetId = this.getLatestCapturedTweetId();
      
      if (tweetId) {
        console.log(`✅ Posted single tweet: ${tweetId}`);
        await storeTweetMetrics({ tweet_id: tweetId, content, topic });
        return { success: true, tweetId };
      } else {
        console.warn('⚠️ Tweet posted but ID not captured from network');
        return { success: true, tweetId: 'unknown' };
      }
      
    } catch (error: any) {
      console.error('❌ Failed to execute single tweet post:', error);
      return { success: false, error: error.message };
    }
  }

  async postThread(tweets: string[], topic?: string): Promise<ThreadResult> {
    try {
      console.log(`📋 Posting thread with ${tweets.length} tweets`);
      
      return await browserManager.withContext('posting', async (context) => {
        const page = await context.newPage();
        
        // Set up network interception
        this.setupNetworkInterception(page);
        this.capturedTweetIds.clear();
        
        // Post first tweet
        const firstResult = await this.executeSingleTweetPost(page, tweets[0], topic);
        if (!firstResult.success || !firstResult.tweetId) {
          return { success: false, error: `Failed to post first tweet: ${firstResult.error}` };
        }
        
        const rootTweetId = firstResult.tweetId;
        const replyIds: string[] = [];
        
        // Post replies if there are more tweets
        for (let i = 1; i < tweets.length; i++) {
          const replyResult = await this.postReply(page, tweets[i], rootTweetId);
          if (replyResult.success && replyResult.tweetId) {
            replyIds.push(replyResult.tweetId);
          } else {
            console.warn(`⚠️ Failed to post reply ${i + 1}: ${replyResult.error}`);
          }
        }
        
        console.log(`✅ Posted thread: ${rootTweetId} with ${replyIds.length} replies`);
        return { success: true, rootTweetId, replyIds };
      });
      
    } catch (error: any) {
      throttledError(`Failed to post thread: ${error.message}`, 'post_thread');
      return { success: false, error: error.message };
    }
  }

  private async postReply(page: Page, content: string, targetTweetId: string): Promise<TweetResult> {
    try {
      // Navigate to the tweet to reply to
      await page.goto(`https://x.com/i/web/status/${targetTweetId}`, { waitUntil: 'networkidle' });
      
      // Click reply button
      const replyButton = await page.waitForSelector('[data-testid="reply"]', { timeout: 10000 });
      await replyButton.click();
      
      // Wait for reply composer and type content
      const replyTextarea = await page.waitForSelector('[data-testid="tweetTextarea_0"]', { timeout: 5000 });
      await replyTextarea.fill(content);
      
      // Post reply
      const postButton = await page.waitForSelector('[data-testid="tweetButton"]', { timeout: 5000 });
      await postButton.click();
      
      // Wait for posting to complete
      await page.waitForTimeout(3000);
      
      const tweetId = this.getLatestCapturedTweetId();
      return { success: !!tweetId, tweetId: tweetId || 'unknown' };
      
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async close(): Promise<void> {
    // BrowserManager handles cleanup automatically
    this.capturedTweetIds.clear();
  }
}

/**
 * Convenience function for posting a single tweet
 */
export async function postSingleTweet(content: string, topic?: string): Promise<TweetResult> {
  const poster = new TwitterPoster();
  return await poster.postSingleTweet(content, topic);
}

/**
 * Convenience function for posting a thread
 */
export async function postThread(tweets: string[], topic?: string): Promise<ThreadResult> {
  const poster = new TwitterPoster();
  return await poster.postThread(tweets, topic);
}