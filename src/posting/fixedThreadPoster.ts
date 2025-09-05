/**
 * 🔧 FIXED THREAD POSTER - EMERGENCY FIX
 * 
 * This fixes the critical thread posting bug where replies go to wrong tweets.
 * The issue: reply chains are broken, causing individual tweets instead of threads.
 */

import { BrowserManager } from './BrowserManager';
import { TwitterComposer } from './TwitterComposer';

export interface FixedThreadResult {
  success: boolean;
  rootTweetId?: string;
  replyIds?: string[];
  error?: string;
  totalTweetsPosted: number;
}

export class FixedThreadPoster {
  private static instance: FixedThreadPoster;

  // Add missing validateTweets method that other systems expect
  public validateTweets(tweets: string[]): { valid: boolean; issues: string[] } {
    const issues: string[] = [];
    
    if (!tweets || tweets.length === 0) {
      issues.push('No tweets provided');
    }
    
    tweets.forEach((tweet, index) => {
      if (!tweet || tweet.trim().length === 0) {
        issues.push(`Tweet ${index + 1} is empty`);
      }
      if (tweet.length > 280) {
        issues.push(`Tweet ${index + 1} exceeds 280 characters`);
      }
    });
    
    return {
      valid: issues.length === 0,
      issues
    };
  }

  public static getInstance(): FixedThreadPoster {
    if (!FixedThreadPoster.instance) {
      FixedThreadPoster.instance = new FixedThreadPoster();
    }
    return FixedThreadPoster.instance;
  }

  /**
   * 🔧 EMERGENCY FIX: Post proper thread with correct reply chains
   */
  public async postProperThread(tweets: string[]): Promise<FixedThreadResult> {
    console.log('🔧 FIXED_THREAD: Starting emergency thread fix...');
    console.log(`🧵 THREAD_CONTENT: ${tweets.length} tweets to post as proper chain`);

    if (!tweets || tweets.length === 0) {
      return {
        success: false,
        error: 'No tweets provided',
        totalTweetsPosted: 0
      };
    }

    if (tweets.length === 1) {
      console.log('📝 SINGLE_TWEET: Only 1 tweet, posting as single');
      // Handle single tweet posting
      return this.postSingleTweet(tweets[0]);
    }

    try {
      return await BrowserManager.withPage(async (page) => {
        const composer = new TwitterComposer(page);
        
        // Step 1: Post root tweet
        console.log('🚀 STEP_1: Posting root tweet...');
        console.log(`📝 ROOT: "${tweets[0].substring(0, 80)}..."`);
        
        const rootResult = await composer.postSingleTweet(tweets[0]);
        
        if (!rootResult.success || !rootResult.tweetId) {
          console.error(`❌ ROOT_FAILED: ${rootResult.error}`);
          return {
            success: false,
            error: `Root tweet failed: ${rootResult.error}`,
            totalTweetsPosted: 0
          };
        }

        let currentTweetId = rootResult.tweetId;
        const replyIds: string[] = [];
        
        console.log(`✅ ROOT_SUCCESS: Posted root tweet ${currentTweetId}`);
        console.log(`🔗 CHAIN_START: Will post ${tweets.length - 1} replies to build chain`);

        // Step 2: Post each reply in proper sequence
        for (let i = 1; i < tweets.length; i++) {
          console.log(`🔗 STEP_${i + 1}: Posting reply ${i}/${tweets.length - 1}...`);
          console.log(`📝 REPLY_TO: ${currentTweetId}`);
          console.log(`📝 CONTENT: "${tweets[i].substring(0, 50)}..."`);

          // Wait between posts to ensure proper ordering
          if (i > 1) {
            console.log('⏱️ DELAY: Waiting 3 seconds for proper sequencing...');
            await new Promise(resolve => setTimeout(resolve, 3000));
          }

          // 🔧 CRITICAL FIX: Always reply to the PREVIOUS tweet in the chain
          const replyToTweetId = currentTweetId;
          
          console.log(`🔗 REPLY_TARGET: Replying to ${replyToTweetId} (previous in chain)`);
          
          const replyResult = await composer.postReply(tweets[i], replyToTweetId);
          
          if (replyResult.success && replyResult.tweetId) {
            // 🔧 CRITICAL: Update currentTweetId to the new reply for next iteration
            currentTweetId = replyResult.tweetId;
            replyIds.push(replyResult.tweetId);
            
            console.log(`✅ REPLY_${i}: Posted ${replyResult.tweetId}`);
            console.log(`🔗 CHAIN_UPDATE: Next reply will target ${currentTweetId}`);
          } else {
            console.error(`❌ REPLY_${i}_FAILED: ${replyResult.error}`);
            // Continue with the chain even if one reply fails
            console.log(`🔄 CHAIN_CONTINUE: Continuing chain despite failure`);
          }
        }

        const totalPosted = 1 + replyIds.length;
        
        console.log(`🎉 THREAD_COMPLETE: ${totalPosted}/${tweets.length} tweets posted`);
        console.log(`🔗 CHAIN: ${rootResult.tweetId} → ${replyIds.join(' → ')}`);

        return {
          success: true,
          rootTweetId: rootResult.tweetId,
          replyIds,
          totalTweetsPosted: totalPosted
        };
      });

    } catch (error: any) {
      console.error('❌ FIXED_THREAD_ERROR:', error.message);
      return {
        success: false,
        error: error.message,
        totalTweetsPosted: 0
      };
    }
  }

  /**
   * 📝 Post single tweet (fallback)
   */
  private async postSingleTweet(content: string): Promise<FixedThreadResult> {
    try {
      return await BrowserManager.withPage(async (page) => {
        const composer = new TwitterComposer(page);
        const result = await composer.postSingleTweet(content);
        
        return {
          success: result.success,
          rootTweetId: result.tweetId,
          replyIds: [],
          error: result.error,
          totalTweetsPosted: result.success ? 1 : 0
        };
      });
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        totalTweetsPosted: 0
      };
    }
  }

  /**
   * 🔍 Validate tweets before posting
   */
  public validateThreadTweets(tweets: string[]): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    if (!tweets || tweets.length === 0) {
      issues.push('No tweets provided');
    }

    for (let i = 0; i < tweets.length; i++) {
      if (!tweets[i] || tweets[i].trim().length === 0) {
        issues.push(`Tweet ${i + 1} is empty`);
      }
      
      if (tweets[i] && tweets[i].length > 280) {
        issues.push(`Tweet ${i + 1} exceeds 280 characters (${tweets[i].length})`);
      }
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }
}
