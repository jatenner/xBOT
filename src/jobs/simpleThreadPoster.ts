/**
 * 🧵 SIMPLE THREAD POSTER
 * Straightforward thread posting: post first tweet, then replies
 * No complex fallbacks - just works!
 */

import { UltimateTwitterPoster } from '../posting/UltimateTwitterPoster';

export interface SimpleThreadResult {
  success: boolean;
  tweetId: string; // Root tweet ID
  tweetUrl: string;
  tweetIds: string[]; // All tweet IDs in order
  mode: 'thread' | 'partial_thread';
  note?: string;
  error?: string;
}

export class SimpleThreadPoster {
  /**
   * Post a thread as a series of linked tweets
   */
  static async postThread(tweets: string[]): Promise<SimpleThreadResult> {
    console.log(`[SIMPLE_THREAD] 🧵 Posting ${tweets.length}-tweet thread...`);
    
    if (tweets.length === 0) {
      return {
        success: false,
        tweetId: '',
        tweetUrl: '',
        tweetIds: [],
        mode: 'thread',
        error: 'No tweets provided'
      };
    }
    
    if (tweets.length === 1) {
      console.log(`[SIMPLE_THREAD] ℹ️ Only 1 tweet - posting as single`);
    }
    
    const tweetIds: string[] = [];
    const poster = new UltimateTwitterPoster();
    
    try {
      // Post first tweet (root)
      console.log(`[SIMPLE_THREAD] 📝 Posting root tweet (1/${tweets.length})...`);
      console.log(`[SIMPLE_THREAD] 📄 Content: "${tweets[0].substring(0, 80)}..."`);
      
      const rootResult = await poster.postTweet(tweets[0]);
      
      if (!rootResult.success) {
        await poster.dispose();
        return {
          success: false,
          tweetId: '',
          tweetUrl: '',
          tweetIds: [],
          mode: 'thread',
          error: `Root tweet failed: ${rootResult.error}`
        };
      }
      
      const rootTweetId = rootResult.tweetId || 'unknown';
      tweetIds.push(rootTweetId);
      console.log(`[SIMPLE_THREAD] ✅ Root tweet posted: ${rootTweetId}`);
      
      // If only one tweet, we're done
      if (tweets.length === 1) {
        await poster.dispose();
        return {
          success: true,
          tweetId: rootTweetId,
          tweetUrl: `https://x.com/${process.env.TWITTER_USERNAME || 'SignalAndSynapse'}/status/${rootTweetId}`,
          tweetIds: tweetIds,
          mode: 'thread'
        };
      }
      
      // Post remaining tweets as replies
      let lastTweetId = rootTweetId;
      
      for (let i = 1; i < tweets.length; i++) {
        try {
          console.log(`[SIMPLE_THREAD] 📝 Posting reply ${i + 1}/${tweets.length}...`);
          console.log(`[SIMPLE_THREAD] 🔗 Replying to: ${lastTweetId}`);
          console.log(`[SIMPLE_THREAD] 📄 Content: "${tweets[i].substring(0, 80)}..."`);
          
          // Wait between tweets to avoid rate limits
          if (i > 1) {
            console.log(`[SIMPLE_THREAD] ⏳ Waiting 3s between tweets...`);
            await new Promise(r => setTimeout(r, 3000));
          }
          
          const replyResult = await poster.postReply(tweets[i], lastTweetId);
          
          if (!replyResult.success) {
            console.error(`[SIMPLE_THREAD] ❌ Reply ${i + 1} failed: ${replyResult.error}`);
            console.log(`[SIMPLE_THREAD] ⚠️ Stopping at ${i}/${tweets.length} tweets`);
            
            // Partial success - some tweets posted
            await poster.dispose();
            return {
              success: true, // Root tweet succeeded
              tweetId: rootTweetId,
              tweetUrl: `https://x.com/${process.env.TWITTER_USERNAME || 'SignalAndSynapse'}/status/${rootTweetId}`,
              tweetIds: tweetIds,
              mode: 'partial_thread',
              note: `Partial thread: ${i}/${tweets.length} tweets posted`,
              error: `Reply ${i + 1} failed: ${replyResult.error}`
            };
          }
          
          const replyTweetId = replyResult.tweetId || 'unknown';
          tweetIds.push(replyTweetId);
          lastTweetId = replyTweetId;
          
          console.log(`[SIMPLE_THREAD] ✅ Reply ${i + 1} posted: ${replyTweetId}`);
          
        } catch (replyError: any) {
          console.error(`[SIMPLE_THREAD] ❌ Reply ${i + 1} error: ${replyError.message}`);
          console.log(`[SIMPLE_THREAD] ⚠️ Stopping at ${i}/${tweets.length} tweets`);
          
          // Partial success
          await poster.dispose();
          return {
            success: true,
            tweetId: rootTweetId,
            tweetUrl: `https://x.com/${process.env.TWITTER_USERNAME || 'SignalAndSynapse'}/status/${rootTweetId}`,
            tweetIds: tweetIds,
            mode: 'partial_thread',
            note: `Partial thread: ${i}/${tweets.length} tweets posted`,
            error: `Reply ${i + 1} exception: ${replyError.message}`
          };
        }
      }
      
      // Full thread success!
      await poster.dispose();
      console.log(`[SIMPLE_THREAD] 🎉 Full thread posted: ${tweetIds.length}/${tweets.length} tweets`);
      console.log(`[SIMPLE_THREAD] 🔗 Tweet IDs: ${tweetIds.join(', ')}`);
      
      return {
        success: true,
        tweetId: rootTweetId,
        tweetUrl: `https://x.com/${process.env.TWITTER_USERNAME || 'SignalAndSynapse'}/status/${rootTweetId}`,
        tweetIds: tweetIds,
        mode: 'thread'
      };
      
    } catch (error: any) {
      console.error(`[SIMPLE_THREAD] ❌ Thread posting failed: ${error.message}`);
      await poster.dispose();
      
      // If root tweet posted, it's partial success
      if (tweetIds.length > 0) {
        return {
          success: true,
          tweetId: tweetIds[0],
          tweetUrl: `https://x.com/${process.env.TWITTER_USERNAME || 'SignalAndSynapse'}/status/${tweetIds[0]}`,
          tweetIds: tweetIds,
          mode: 'partial_thread',
          note: `Partial thread: ${tweetIds.length}/${tweets.length} tweets posted`,
          error: error.message
        };
      }
      
      // Total failure
      return {
        success: false,
        tweetId: '',
        tweetUrl: '',
        tweetIds: [],
        mode: 'thread',
        error: error.message
      };
    }
  }
}

