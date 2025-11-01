/**
 * GRACEFUL DEGRADATION: Thread → Single Fallback
 * Don't let perfect be the enemy of good
 */

export interface FallbackResult {
  success: boolean;
  tweetId: string;
  tweetUrl: string;
  mode: 'thread' | 'degraded_thread';
  note?: string;
}

export class ThreadFallbackHandler {
  /**
   * Post thread with automatic fallback to single if it fails
   */
  static async postThreadWithFallback(
    thread_parts: string[],
    decisionId: string
  ): Promise<FallbackResult> {
    
    console.log(`[THREAD_FALLBACK] 🧵 Attempting to post ${thread_parts.length}-tweet thread...`);
    
    // Step 1: Pre-flight validation
    const { ThreadValidator } = await import('./threadValidator');
    const validation = await ThreadValidator.validateThreadBeforePosting(thread_parts);
    
    if (!validation.valid) {
      console.log(`[THREAD_FALLBACK] ⚠️ Pre-flight failed: ${validation.reason}`);
      
      if (!validation.canRetry) {
        // Content is invalid, don't retry - just post first tweet
        console.log(`[THREAD_FALLBACK] 🔄 Content invalid, falling back to single tweet`);
        return await this.postFirstTweetAsSingle(thread_parts[0], decisionId, validation.reason);
      }
      
      // Can retry later, but for now post as single
      console.log(`[THREAD_FALLBACK] 🔄 Temporary issue, falling back to single for now`);
      return await this.postFirstTweetAsSingle(thread_parts[0], decisionId, validation.reason);
    }
    
    // Step 2: Try posting as thread with aggressive timeout
    try {
      const THREAD_TIMEOUT = 60000; // 60 seconds max
      
      const threadPromise = this.attemptThreadPost(thread_parts);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Thread timeout after 60s')), THREAD_TIMEOUT);
      });
      
      const result = await Promise.race([threadPromise, timeoutPromise]);
      
      if (result.success) {
        console.log(`[THREAD_FALLBACK] ✅ Thread posted successfully!`);
        return {
          ...result,
          mode: 'thread'
        };
      } else {
        console.log(`[THREAD_FALLBACK] ❌ Thread failed: ${result.error}`);
        throw new Error(result.error || 'Thread posting failed');
      }
      
    } catch (error: any) {
      console.log(`[THREAD_FALLBACK] 💥 Thread error: ${error.message}`);
      console.log(`[THREAD_FALLBACK] 🔄 Falling back to single tweet`);
      
      // Fallback to single
      return await this.postFirstTweetAsSingle(
        thread_parts[0], 
        decisionId,
        `Thread failed: ${error.message}`
      );
    }
  }
  
  /**
   * Attempt to post thread (actual implementation)
   */
  private static async attemptThreadPost(thread_parts: string[]): Promise<any> {
    console.log(`[THREAD_FALLBACK] 🌐 Launching browser for thread...`);
    
    const { BulletproofThreadComposer } = await import('../posting/BulletproofThreadComposer');
    const result = await BulletproofThreadComposer.post(thread_parts);
    
    return result;
  }
  
  /**
   * Post just the first tweet as a single (fallback mode)
   */
  private static async postFirstTweetAsSingle(
    firstTweet: string,
    decisionId: string,
    reason: string
  ): Promise<FallbackResult> {
    
    console.log(`[THREAD_FALLBACK] 📝 Posting first tweet as single...`);
    console.log(`[THREAD_FALLBACK] Content: "${firstTweet.substring(0, 60)}..."`);
    
    try {
      const { UltimateTwitterPoster } = await import('../posting/UltimateTwitterPoster');
      const { BulletproofTweetExtractor } = await import('../utils/bulletproofTweetExtractor');
      
      const poster = new UltimateTwitterPoster();
      const result = await poster.postTweet(firstTweet);
      
      if (!result.success) {
        await poster.dispose();
        throw new Error(result.error || 'Single tweet posting failed');
      }
      
      // Extract tweet ID
      console.log(`[THREAD_FALLBACK] ✅ Single posted! Extracting ID...`);
      const page = (poster as any).page;
      
      if (!page) {
        await poster.dispose();
        throw new Error('No browser page available');
      }
      
      await page.waitForTimeout(5000);
      
      const extraction = await BulletproofTweetExtractor.extractTweetId(page, {
        expectedContent: firstTweet,
        expectedUsername: process.env.TWITTER_USERNAME || 'SignalAndSynapse',
        maxAgeSeconds: 600,
        navigateToVerify: true
      });
      
      await poster.dispose();
      
      if (!extraction.success || !extraction.tweetId) {
        throw new Error(`Tweet posted but ID extraction failed: ${extraction.error}`);
      }
      
      console.log(`[THREAD_FALLBACK] ✅ Single tweet posted successfully!`);
      console.log(`[THREAD_FALLBACK] 📊 Tweet ID: ${extraction.tweetId}`);
      
      // Mark in database as degraded thread
      await this.markAsDegradedThread(decisionId, reason);
      
      return {
        success: true,
        tweetId: extraction.tweetId,
        tweetUrl: extraction.url || `https://x.com/${process.env.TWITTER_USERNAME}/status/${extraction.tweetId}`,
        mode: 'degraded_thread',
        note: `Originally a thread, posted as single: ${reason}`
      };
      
    } catch (error: any) {
      console.error(`[THREAD_FALLBACK] ❌ Single tweet fallback failed: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Mark decision as degraded thread in database (for analytics)
   */
  private static async markAsDegradedThread(decisionId: string, reason: string): Promise<void> {
    try {
      const { getSupabaseClient } = await import('../db/index');
      const supabase = getSupabaseClient();
      
      await supabase
        .from('content_metadata')
        .update({
          features: {
            degraded_thread: true,
            degradation_reason: reason,
            degraded_at: new Date().toISOString()
          }
        })
        .eq('decision_id', decisionId);
      
      console.log(`[THREAD_FALLBACK] 📊 Marked as degraded thread for analytics`);
      
    } catch (error: any) {
      console.warn(`[THREAD_FALLBACK] ⚠️ Failed to mark as degraded: ${error.message}`);
    }
  }
}

