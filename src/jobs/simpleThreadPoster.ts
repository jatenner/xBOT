/**
 * 🧵 SIMPLE THREAD POSTER
 * Straightforward thread posting: post first tweet, then replies
 * No complex fallbacks - just works!
 * 
 * 🔒 SECURITY: Requires decision_id for authorization (unforgeable guard)
 */

import { UltimateTwitterPoster, createPostingGuard, PostingGuard } from '../posting/UltimateTwitterPoster';

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
   * 🔒 REQUIRES: decision_id for authorization
   */
  static async postThread(tweets: string[], decision_id?: string): Promise<SimpleThreadResult> {
    // 🔒 AUTHORIZATION CHECK: Block unauthorized posting
    if (!decision_id) {
      console.error(`[SIMPLE_THREAD] 🚨 BLOCKED: postThread called without decision_id`);
      return {
        success: false,
        tweetId: '',
        tweetUrl: '',
        tweetIds: [],
        mode: 'thread',
        error: 'postThread requires decision_id for authorization'
      };
    }
    
    // 🔒 Create guard for the first tweet
    let guard = createPostingGuard({ 
      decision_id, 
      pipeline_source: 'simpleThreadPoster',
      job_run_id: `thread_${Date.now()}`
    });
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
      
      const rootResult = await poster.postTweet(tweets[0], guard);
      
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
      
      // 🚨 CRITICAL: Ensure we have a REAL tweet ID, not a placeholder!
      if (rootTweetId.startsWith('posted_') || rootTweetId === 'unknown') {
        console.error(`[SIMPLE_THREAD] ❌ Root tweet ID is placeholder: ${rootTweetId}`);
        console.error(`[SIMPLE_THREAD] ⚠️ Cannot build thread with placeholder IDs - tweets won't link!`);
        await poster.dispose();
        return {
          success: true, // Tweet was posted
          tweetId: rootTweetId,
          tweetUrl: `https://x.com/${process.env.TWITTER_USERNAME || 'SignalAndSynapse'}/status/${rootTweetId}`,
          tweetIds: [rootTweetId],
          mode: 'thread',
          note: 'Single tweet only - could not extract real ID for threading',
          error: 'Tweet ID extraction failed - cannot build thread'
        };
      }
      
      tweetIds.push(rootTweetId);
      console.log(`[SIMPLE_THREAD] ✅ Root tweet posted with REAL ID: ${rootTweetId}`);
      
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
          
          // 🔒 CREATE NEW GUARD before each reply (guards expire after 60s)
          guard = createPostingGuard({ 
            decision_id: decision_id!, 
            pipeline_source: 'simpleThreadPoster_reply',
            job_run_id: `thread_reply_${i}_${Date.now()}`
          });
          
          const replyResult = await poster.postReply(tweets[i], lastTweetId, guard);
          
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
          
          // Check if we got a real ID for the reply
          if (replyTweetId.startsWith('posted_') || replyTweetId === 'unknown') {
            console.warn(`[SIMPLE_THREAD] ⚠️ Reply ${i + 1} has placeholder ID: ${replyTweetId}`);
            console.warn(`[SIMPLE_THREAD] ⚠️ Stopping thread - next tweet won't link properly`);
            tweetIds.push(replyTweetId);
            
            await poster.dispose();
            return {
              success: true,
              tweetId: rootTweetId,
              tweetUrl: `https://x.com/${process.env.TWITTER_USERNAME || 'SignalAndSynapse'}/status/${rootTweetId}`,
              tweetIds: tweetIds,
              mode: 'partial_thread',
              note: `Partial thread: ${tweetIds.length}/${tweets.length} tweets posted (ID extraction failed)`,
              error: `Reply ${i + 1} ID extraction failed - cannot continue thread`
            };
          }
          
          tweetIds.push(replyTweetId);
          lastTweetId = replyTweetId;
          
          console.log(`[SIMPLE_THREAD] ✅ Reply ${i + 1} posted with REAL ID: ${replyTweetId}`);
          
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

