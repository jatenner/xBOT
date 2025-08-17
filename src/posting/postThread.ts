import { Page, BrowserContext } from 'playwright';
import { browserManager } from './BrowserManager';
import { upsertTweetMetrics, upsertLearningPost } from '../learning/metricsWriter';
import { throttledError } from '../utils/throttledWarn';
import { TwitterComposer, PostResult as ComposerResult } from './TwitterComposer';
import { throttleWarn, throttleError } from '../utils/log';

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
        
        // Set up network interception for tweet ID capture
        this.setupNetworkInterception(page);
        this.capturedTweetIds.clear();
        
        // Use robust TwitterComposer
        const composer = new TwitterComposer(page);
        const result = await composer.postSingleTweet(content);
        
        if (result.success) {
          // Try to get actual tweet ID from network capture
          const capturedId = this.getLatestCapturedTweetId();
          const tweetId = capturedId || result.tweetId || 'unknown';
          
          console.log(`✅ Posted single tweet: ${tweetId}`);
          await upsertTweetMetrics({ 
            tweet_id: tweetId, 
            likes: 0, 
            retweets: 0, 
            replies: 0, 
            content 
          });
          await upsertLearningPost({ 
            tweet_id: tweetId, 
            likes: 0, 
            retweets: 0, 
            replies: 0, 
            content 
          });
          return { success: true, tweetId };
        } else {
          throttleError('composer-single-fail', `Single tweet post failed: ${result.error}`);
          return { success: false, error: result.error };
        }
      });
      
    } catch (error: any) {
      throttledError(`Failed to post single tweet: ${error.message}`, 'post_single_tweet');
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
        
        // Use TwitterComposer for robust posting
        const composer = new TwitterComposer(page);
        
        // Post first tweet
        const firstResult = await composer.postSingleTweet(tweets[0]);
        if (!firstResult.success) {
          throttleError('composer-thread-first-fail', `Thread first tweet failed: ${firstResult.error}`);
          return { success: false, error: `Failed to post first tweet: ${firstResult.error}` };
        }
        
        const capturedId = this.getLatestCapturedTweetId();
        const rootTweetId = capturedId || firstResult.tweetId || 'unknown';
        const replyIds: string[] = [];
        
        console.log(`✅ Posted thread root: ${rootTweetId}`);
        
        // Post replies if there are more tweets
        for (let i = 1; i < tweets.length; i++) {
          try {
            const replyResult = await composer.postReply(tweets[i], rootTweetId);
            if (replyResult.success) {
              const replyId = this.getLatestCapturedTweetId() || replyResult.tweetId || 'unknown';
              replyIds.push(replyId);
              console.log(`✅ Posted reply ${i}: ${replyId}`);
            } else {
              throttleWarn('composer-reply-fail', `Failed to post reply ${i + 1}: ${replyResult.error}`);
            }
          } catch (replyError: any) {
            throttleWarn('composer-reply-error', `Reply ${i + 1} error: ${replyError.message}`);
          }
        }
        
        console.log(`✅ Posted thread: ${rootTweetId} with ${replyIds.length} replies`);
        return { success: true, rootTweetId, replyIds };
      });
      
    } catch (error: any) {
      throttleError('post-thread-error', `Failed to post thread: ${error.message}`);
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