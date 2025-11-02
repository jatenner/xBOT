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
    
    // Step 0: Basic content validation
    console.log('[THREAD_FALLBACK] 📏 Validating content length...');
    for (let i = 0; i < thread_parts.length; i++) {
      const tweet = thread_parts[i];
      if (tweet.length > 280) {
        console.error(`[THREAD_FALLBACK] ❌ Tweet ${i + 1} too long: ${tweet.length} chars (max 280)`);
        console.error(`[THREAD_FALLBACK] 📝 Content: "${tweet.substring(0, 100)}..."`);
        return await this.postFirstTweetAsSingle(
          thread_parts[0],
          decisionId,
          `Tweet ${i + 1} exceeds 280 characters (${tweet.length})`
        );
      }
      console.log(`[THREAD_FALLBACK]    ✅ Tweet ${i + 1}: ${tweet.length} chars`);
    }
    
    // Step 1: Pre-flight validation
    const { ThreadValidator } = await import('./threadValidator');
    const validation = await ThreadValidator.validateThreadBeforePosting(thread_parts);
    
    if (!validation.valid) {
      console.log(`[THREAD_FALLBACK] ⚠️ Pre-flight failed: ${validation.reason}`);
      
      if (!validation.canRetry) {
        // Content is invalid - mark as permanently failed
        console.log(`[THREAD_FALLBACK] ❌ Content invalid, marking as failed`);
        await this.markThreadFailed(decisionId, validation.reason);
        throw new Error(`Thread validation failed (permanent): ${validation.reason}`);
      }
      
      // Temporary issue - reschedule for later (DON'T degrade to single)
      console.log(`[THREAD_FALLBACK] 🔄 Temporary issue, rescheduling thread for later`);
      await this.rescheduleThread(decisionId, validation.retryDelay || 10 * 60 * 1000);
      throw new Error(`Thread validation failed (will retry): ${validation.reason}`);
    }
    
    // Step 2: Try posting as thread with extended timeout
    try {
      const THREAD_TIMEOUT = 180000; // 180 seconds (3 minutes) - threads need more time
      
      console.log(`[THREAD_FALLBACK] ⏱️ Starting thread post (timeout: ${THREAD_TIMEOUT/1000}s)`);
      
      const threadPromise = this.attemptThreadPost(thread_parts);
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Thread timeout after 180s')), THREAD_TIMEOUT);
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
      console.log(`[THREAD_FALLBACK] ❌ Thread failed - will NOT degrade to single`);
      
      // Mark as failed - don't post incomplete content
      await this.markThreadFailed(decisionId, `Thread posting failed: ${error.message}`);
      
      throw new Error(`Thread posting failed: ${error.message}`);
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
   * Reschedule thread for later (when conditions improve)
   */
  private static async rescheduleThread(decisionId: string, delayMs: number): Promise<void> {
    try {
      const { getSupabaseClient } = await import('../db/index');
      const supabase = getSupabaseClient();
      
      const newScheduledTime = new Date(Date.now() + delayMs);
      
      await supabase
        .from('content_metadata')
        .update({
          status: 'queued',
          scheduled_at: newScheduledTime.toISOString(),
          features: {
            rescheduled: true,
            rescheduled_at: new Date().toISOString(),
            retry_delay_ms: delayMs
          }
        })
        .eq('decision_id', decisionId);
      
      console.log(`[THREAD_FALLBACK] 🔄 Thread rescheduled for ${new Date(newScheduledTime).toLocaleTimeString()}`);
      
    } catch (error: any) {
      console.warn(`[THREAD_FALLBACK] ⚠️ Failed to reschedule thread: ${error.message}`);
    }
  }
  
  /**
   * Mark thread as permanently failed (bad content)
   */
  private static async markThreadFailed(decisionId: string, reason: string): Promise<void> {
    try {
      const { getSupabaseClient } = await import('../db/index');
      const supabase = getSupabaseClient();
      
      await supabase
        .from('content_metadata')
        .update({
          status: 'failed',
          error_message: reason,
          features: {
            failed_permanently: true,
            failed_at: new Date().toISOString(),
            failure_reason: reason
          }
        })
        .eq('decision_id', decisionId);
      
      console.log(`[THREAD_FALLBACK] ❌ Thread marked as permanently failed: ${reason}`);
      
    } catch (error: any) {
      console.warn(`[THREAD_FALLBACK] ⚠️ Failed to mark thread as failed: ${error.message}`);
    }
  }
}

