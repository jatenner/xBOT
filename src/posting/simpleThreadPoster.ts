/**
 * SIMPLE THREAD POSTER
 * Posts real Twitter threads using simple reply-based approach
 * Post tweet 1 → reply with tweet 2 → reply with tweet 3, etc.
 */

import { TwitterPoster } from './postThread';
import { TwitterComposer } from './TwitterComposer';
import { browserManager } from './BrowserManager';

export interface ThreadResult {
  success: boolean;
  rootTweetId?: string;
  replyIds?: string[];
  error?: string;
  totalTweets?: number;
}

export class SimpleThreadPoster {
  private static instance: SimpleThreadPoster;
  private poster: TwitterPoster;

  private constructor() {
    this.poster = new TwitterPoster();
  }

  public static getInstance(): SimpleThreadPoster {
    if (!SimpleThreadPoster.instance) {
      SimpleThreadPoster.instance = new SimpleThreadPoster();
    }
    return SimpleThreadPoster.instance;
  }

  /**
   * POST REAL TWITTER THREAD
   * Creates actual connected thread with reply chain
   */
  public async postRealThread(tweets: string[]): Promise<ThreadResult> {
    if (!tweets || tweets.length === 0) {
      return { success: false, error: 'No tweets provided' };
    }

    if (tweets.length === 1) {
      console.log('📝 SIMPLE_THREAD: Single tweet, posting normally');
      const result = await this.poster.postSingleTweet(tweets[0]);
      return {
        success: result.success,
        rootTweetId: result.tweetId,
        replyIds: [],
        totalTweets: 1,
        error: result.error
      };
    }

    console.log(`🧵 SIMPLE_THREAD: Creating ${tweets.length}-tweet thread`);
    console.log(`📝 Thread preview: "${tweets[0].substring(0, 80)}..."`);

    let currentTweetId: string | undefined;
    const replyIds: string[] = [];

    try {
      // Step 1: Post the root tweet
      console.log('🚀 THREAD_STEP_1: Posting root tweet...');
      console.log(`📝 ROOT_CONTENT: "${tweets[0].substring(0, 80)}..."`);
      
      const rootResult = await this.poster.postSingleTweet(tweets[0]);

      if (!rootResult.success || !rootResult.tweetId) {
        console.error(`❌ ROOT_TWEET_FAILED: ${rootResult.error}`);
        return {
          success: false,
          error: `Root tweet failed: ${rootResult.error}`,
          totalTweets: 0
        };
      }

      currentTweetId = rootResult.tweetId;
      console.log(`✅ THREAD_ROOT: Posted tweet 1/${tweets.length} (ID: ${currentTweetId})`);
      console.log(`🔗 THREAD_CHAIN: Ready to post ${tweets.length - 1} replies to root tweet`);

      // Step 2: Post each reply in sequence
      for (let i = 1; i < tweets.length; i++) {
        console.log(`🔗 THREAD_STEP_${i + 1}: Posting reply ${i + 1}/${tweets.length}...`);
        console.log(`📝 Reply preview: "${tweets[i].substring(0, 50)}..."`);

        // Add small delay between posts to avoid rate limiting
        if (i > 1) {
          console.log('⏱️ THREAD_DELAY: Waiting 2 seconds...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // Post reply to the current tweet using browser context
        console.log(`🔗 THREAD_REPLY: Attempting reply ${i + 1} to tweet ${currentTweetId}`);
        
        let replyResult;
        try {
          replyResult = await browserManager.withContext('posting', async (context) => {
            console.log(`🌐 BROWSER_CONTEXT: Creating new page for reply ${i + 1}`);
            const page = await context.newPage();
            const composer = new TwitterComposer(page);
            
            try {
              console.log(`🐦 COMPOSER: Posting reply "${tweets[i].substring(0, 50)}..." to ${currentTweetId}`);
              const result = await composer.postReply(tweets[i], currentTweetId);
              console.log(`📊 REPLY_RESULT: ${result.success ? 'SUCCESS' : 'FAILED'} - ${result.error || result.tweetId}`);
              return result;
            } finally {
              await page.close();
            }
          });
        } catch (contextError: any) {
          console.error(`❌ BROWSER_CONTEXT_ERROR: Failed to create context for reply ${i + 1}:`, contextError.message);
          replyResult = {
            success: false,
            error: `Browser context error: ${contextError.message}`
          };
        }

        if (!replyResult.success || !replyResult.tweetId) {
          console.warn(`⚠️ THREAD_PARTIAL: Reply ${i + 1} failed: ${replyResult.error}`);
          
          // Return partial success - we got some of the thread posted
          return {
            success: true, // Partial success
            rootTweetId: rootResult.tweetId,
            replyIds,
            totalTweets: i, // How many we actually posted
            error: `Partial thread - stopped at tweet ${i}: ${replyResult.error}`
          };
        }

        replyIds.push(replyResult.tweetId);
        currentTweetId = replyResult.tweetId; // Next reply goes to this tweet
        console.log(`✅ THREAD_REPLY: Posted reply ${i + 1}/${tweets.length} (ID: ${replyResult.tweetId})`);
      }

      // Success! Full thread posted
      console.log(`🎉 THREAD_SUCCESS: Complete ${tweets.length}-tweet thread posted!`);
      console.log(`🔗 Root: ${rootResult.tweetId}`);
      console.log(`🔗 Replies: ${replyIds.join(', ')}`);

      return {
        success: true,
        rootTweetId: rootResult.tweetId,
        replyIds,
        totalTweets: tweets.length,
        error: undefined
      };

    } catch (error: any) {
      console.error('❌ THREAD_ERROR: Unexpected error during thread posting:', error.message);
      return {
        success: false,
        error: `Thread posting crashed: ${error.message}`,
        rootTweetId: currentTweetId,
        replyIds,
        totalTweets: replyIds.length + (currentTweetId ? 1 : 0)
      };
    }
  }

  /**
   * Validate tweets before posting
   */
  public validateTweets(tweets: string[]): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    if (!tweets || tweets.length === 0) {
      issues.push('No tweets provided');
    }

    if (tweets.length > 25) {
      issues.push('Too many tweets (max 25 for threads)');
    }

    tweets.forEach((tweet, i) => {
      if (!tweet.trim()) {
        issues.push(`Tweet ${i + 1} is empty`);
      }
      if (tweet.length > 280) {
        issues.push(`Tweet ${i + 1} is too long (${tweet.length} chars)`);
      }
      if (tweet.length < 10) {
        issues.push(`Tweet ${i + 1} is too short (${tweet.length} chars)`);
      }
    });

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Get posting statistics for monitoring
   */
  public getStatistics(): {
    threadsAttempted: number;
    threadsSuccessful: number;
    averageTweetsPerThread: number;
    lastThreadResult?: ThreadResult;
  } {
    // In production, these would be tracked in database/memory
    return {
      threadsAttempted: 0,
      threadsSuccessful: 0,
      averageTweetsPerThread: 0
    };
  }
}
