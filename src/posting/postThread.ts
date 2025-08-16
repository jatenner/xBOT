import { Page } from 'playwright';
import { createContext, resetBrowser } from '../playwright/browserFactory';
import { storeTweetMetrics } from '../db/index';

interface TweetResult {
  success: boolean;
  tweetId?: string;
  error?: string;
}

interface ThreadResult {
  success: boolean;
  rootTweetId?: string;
  tweetIds?: string[];
  error?: string;
}

/**
 * Enhanced tweet posting with network interception for reliable ID capture
 */
export class TwitterPoster {
  private capturedTweetIds: Map<number, string> = new Map();
  private page: Page | null = null;

  async initialize(): Promise<void> {
    try {
      const context = await createContext();
      this.page = await context.newPage();
      
      // Set up network interception for tweet ID capture
      this.setupNetworkInterception();
      
      console.log('🐦 TwitterPoster initialized with network interception');
    } catch (error) {
      console.error('Failed to initialize TwitterPoster:', error);
      throw error;
    }
  }

  private setupNetworkInterception(): void {
    if (!this.page) return;

    this.page.on('response', async (response) => {
      const url = response.url();
      
      // Intercept Twitter API responses that contain tweet IDs
      if (this.isTweetCreationResponse(url)) {
        try {
          const json = await response.json();
          const tweetId = this.extractTweetId(json);
          
          if (tweetId) {
            const timestamp = Date.now();
            this.capturedTweetIds.set(timestamp, tweetId);
            console.log(`📦 Captured tweet ID: ${tweetId} from ${url}`);
          }
        } catch (error) {
          console.warn('Failed to parse tweet creation response:', error);
        }
      }
    });
  }

  private isTweetCreationResponse(url: string): boolean {
    return url.includes('CreateTweet') || 
           url.includes('TweetCreate') || 
           url.includes('/1.1/statuses/update') ||
           url.includes('graphql') && url.includes('tweet');
  }

  private extractTweetId(json: any): string | null {
    // Handle multiple API response formats
    const candidates = [
      json?.data?.create_tweet?.tweet_results?.result?.rest_id,
      json?.data?.tweetResult?.result?.rest_id,
      json?.data?.createTweet?.tweet?.rest_id,
      json?.data?.tweet?.rest_id,
      json?.rest_id,
      json?.id_str,
      json?.id
    ];

    for (const candidate of candidates) {
      if (candidate && typeof candidate === 'string' && /^\d+$/.test(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  async postSingleTweet(content: string, topic?: string): Promise<TweetResult> {
    if (!this.page) {
      throw new Error('TwitterPoster not initialized');
    }

    try {
      console.log(`📝 Posting single tweet: "${content.substring(0, 50)}..."`);
      
      // Navigate to compose
      await this.page.goto('https://x.com/compose/tweet', { waitUntil: 'networkidle' });
      
      // Clear captured IDs before posting
      this.capturedTweetIds.clear();
      
      // Wait for composer and type content
      const tweetTextarea = await this.page.waitForSelector('[data-testid="tweetTextarea_0"]', { timeout: 10000 });
      await tweetTextarea.fill(content);
      
      // Post tweet
      const postButton = await this.page.waitForSelector('[data-testid="tweetButtonInline"]', { timeout: 5000 });
      await postButton.click();
      
      // Wait for posting to complete and capture ID
      await this.page.waitForTimeout(3000);
      
      const tweetId = await this.waitForCapturedTweetId(5000);
      
      if (!tweetId) {
        // Fallback: try to extract from URL
        const urlTweetId = await this.extractTweetIdFromUrl();
        if (urlTweetId) {
          console.log(`🔄 Used URL fallback for tweet ID: ${urlTweetId}`);
          await this.storeTweetData(urlTweetId, content, 1, urlTweetId, topic);
          return { success: true, tweetId: urlTweetId };
        }
        
        console.warn('⚠️ Failed to capture tweet ID, but post likely succeeded');
        return { success: true, tweetId: undefined };
      }
      
      await this.storeTweetData(tweetId, content, 1, tweetId, topic);
      console.log(`✅ Single tweet posted successfully: ${tweetId}`);
      return { success: true, tweetId };
      
    } catch (error) {
      console.error('❌ Failed to post single tweet:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async postThread(tweets: string[], topic?: string): Promise<ThreadResult> {
    if (!this.page) {
      throw new Error('TwitterPoster not initialized');
    }

    if (tweets.length === 0) {
      return { success: false, error: 'No tweets provided' };
    }

    try {
      console.log(`📋 Posting thread with ${tweets.length} tweets`);
      
      const tweetIds: string[] = [];
      let rootTweetId: string | undefined;
      
      // Post first tweet
      const firstResult = await this.postSingleTweet(tweets[0], topic);
      if (!firstResult.success || !firstResult.tweetId) {
        return { success: false, error: `Failed to post first tweet: ${firstResult.error}` };
      }
      
      rootTweetId = firstResult.tweetId;
      tweetIds.push(rootTweetId);
      
      // Post remaining tweets as replies
      for (let i = 1; i < tweets.length; i++) {
        const replyResult = await this.postReply(tweets[i], rootTweetId, topic, i + 1, tweetIds[i - 1]);
        
        if (!replyResult.success) {
          console.warn(`⚠️ Failed to post tweet ${i + 1} of thread: ${replyResult.error}`);
          // Continue with remaining tweets
          tweetIds.push(`failed_${i + 1}`);
        } else if (replyResult.tweetId) {
          tweetIds.push(replyResult.tweetId);
        } else {
          tweetIds.push(`unknown_${i + 1}`);
        }
      }
      
      console.log(`✅ Thread posted successfully. Root: ${rootTweetId}, Total: ${tweetIds.length} tweets`);
      return { success: true, rootTweetId, tweetIds };
      
    } catch (error) {
      console.error('❌ Failed to post thread:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private async postReply(content: string, rootTweetId: string, topic?: string, position = 1, replyToId?: string): Promise<TweetResult> {
    try {
      console.log(`📝 Posting reply ${position}: "${content.substring(0, 30)}..."`);
      
      // Navigate to compose reply
      const targetTweetId = replyToId || rootTweetId;
      await this.page!.goto(`https://x.com/i/web/status/${targetTweetId}`, { waitUntil: 'networkidle' });
      
      // Clear captured IDs
      this.capturedTweetIds.clear();
      
      // Click reply button
      const replyButton = await this.page!.waitForSelector('[data-testid="reply"]', { timeout: 10000 });
      await replyButton.click();
      
      // Wait for reply composer and type content
      const replyTextarea = await this.page!.waitForSelector('[data-testid="tweetTextarea_0"]', { timeout: 5000 });
      await replyTextarea.fill(content);
      
      // Post reply
      const postButton = await this.page!.waitForSelector('[data-testid="tweetButton"]', { timeout: 5000 });
      await postButton.click();
      
      // Wait for posting and capture ID
      await this.page!.waitForTimeout(3000);
      
      const tweetId = await this.waitForCapturedTweetId(5000);
      
      if (tweetId) {
        await this.storeTweetData(tweetId, content, position, rootTweetId, topic);
        console.log(`✅ Reply ${position} posted: ${tweetId}`);
        return { success: true, tweetId };
      } else {
        console.warn(`⚠️ Reply ${position} posted but ID not captured`);
        return { success: true, tweetId: undefined };
      }
      
    } catch (error) {
      console.error(`❌ Failed to post reply ${position}:`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private async waitForCapturedTweetId(timeoutMs: number): Promise<string | null> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      if (this.capturedTweetIds.size > 0) {
        // Get the most recent captured ID
        const timestamps = Array.from(this.capturedTweetIds.keys()).sort((a, b) => b - a);
        const latestTimestamp = timestamps[0];
        return this.capturedTweetIds.get(latestTimestamp) || null;
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return null;
  }

  private async extractTweetIdFromUrl(): Promise<string | null> {
    if (!this.page) return null;
    
    try {
      // Wait for navigation to tweet page
      await this.page.waitForFunction(
        () => window.location.href.includes('/status/'),
        { timeout: 5000 }
      );
      
      const url = this.page.url();
      const match = url.match(/\/status\/(\d+)/);
      return match ? match[1] : null;
    } catch (error) {
      console.warn('Failed to extract tweet ID from URL:', error);
      return null;
    }
  }

  private async storeTweetData(
    tweetId: string, 
    content: string, 
    position: number, 
    rootTweetId: string, 
    topic?: string
  ): Promise<void> {
    try {
      await storeTweetMetrics({
        tweet_id: tweetId,
        root_tweet_id: rootTweetId,
        thread_position: position,
        content,
        topic,
        learning_metadata: {
          posted_via: 'browser_automation',
          capture_method: this.capturedTweetIds.has(Date.now()) ? 'network_interception' : 'url_extraction',
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Failed to store tweet data:', error);
    }
  }

  async close(): Promise<void> {
    try {
      if (this.page) {
        await this.page.context().close();
        this.page = null;
      }
      this.capturedTweetIds.clear();
    } catch (error) {
      console.error('Error closing TwitterPoster:', error);
      // Force reset browser on error
      await resetBrowser();
    }
  }
}

/**
 * Convenience function for posting a single tweet
 */
export async function postSingleTweet(content: string, topic?: string): Promise<TweetResult> {
  const poster = new TwitterPoster();
  try {
    await poster.initialize();
    return await poster.postSingleTweet(content, topic);
  } finally {
    await poster.close();
  }
}

/**
 * Convenience function for posting a thread
 */
export async function postThread(tweets: string[], topic?: string): Promise<ThreadResult> {
  const poster = new TwitterPoster();
  try {
    await poster.initialize();
    return await poster.postThread(tweets, topic);
  } finally {
    await poster.close();
  }
}
