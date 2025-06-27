/**
 * Draft Drain Job
 * Processes queued drafts when Twitter API quota is available
 */

import { getNextDraft, removeDraft, getDraftQueueStats, clearOldDrafts } from '../utils/drafts.js';
import { xClient } from '../utils/xClient.js';
import { supabaseClient } from '../utils/supabaseClient.js';

export class DraftDrainJob {
  private isRunning = false;

  constructor() {
    console.log('📤 Draft Drain Job initialized');
  }

  /**
   * Process draft queue - called by scheduler hourly
   */
  async processDraftQueue(): Promise<void> {
    if (this.isRunning) {
      console.log('⏳ Draft drain already running, skipping...');
      return;
    }

    try {
      this.isRunning = true;
      console.log('📤 Starting draft queue processing...');

      // Get queue stats first
      const stats = await getDraftQueueStats();
      if (stats.total === 0) {
        console.log('📤 Draft queue empty, nothing to process');
        return;
      }

      console.log(`📤 Processing draft queue: ${stats.total} total (${stats.high} high, ${stats.medium} medium, ${stats.low} low)`);

      // Check Twitter API rate limits
      const rateLimitInfo = await xClient.checkRateLimit();
      if (rateLimitInfo.remaining <= 2) {
        console.log(`⚠️ Twitter API quota low (${rateLimitInfo.remaining} remaining), skipping draft processing`);
        return;
      }

      // Process up to 3 drafts per run to avoid exhausting quota
      const maxDraftsToProcess = Math.min(3, rateLimitInfo.remaining - 1);
      let processedCount = 0;

      for (let i = 0; i < maxDraftsToProcess; i++) {
        const draft = await getNextDraft();
        if (!draft) {
          console.log('📤 No more drafts to process');
          break;
        }

        try {
          console.log(`📤 Processing draft: ${draft.content.substring(0, 50)}... (${draft.source})`);

          // Post the tweet
          const result = await xClient.postTweetWithRateLimit(draft.content);
          
          // Save to database
          await this.saveTweetToDatabase(result.data.id, draft.content, draft.source);

          // Remove from queue
          await removeDraft(draft.id!);

          console.log(`✅ Draft posted successfully: ${result.data.id}`);
          processedCount++;

        } catch (error: any) {
          if (error.code === 429) {
            console.log('⚠️ Rate limit hit during draft processing, stopping...');
            break;
          } else if (error.code === 403) {
            console.log(`⚠️ Draft forbidden, removing from queue: ${draft.content.substring(0, 50)}...`);
            await removeDraft(draft.id!);
          } else {
            console.log(`⚠️ Error posting draft: ${error.message}`);
          }
        }

        // Small delay between posts
        if (i < maxDraftsToProcess - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      console.log(`📤 Draft queue processing complete: ${processedCount} tweets posted`);

      // Clean up old drafts weekly
      if (Math.random() < 0.1) { // 10% chance per run
        await clearOldDrafts();
      }

    } catch (error) {
      console.log('⚠️ Error in draft queue processing:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Save tweet to database
   */
  private async saveTweetToDatabase(tweetId: string, content: string, source: string): Promise<void> {
    try {
      const tweetData = {
        tweet_id: tweetId,
        content: content,
        posted_at: new Date().toISOString(),
        source: source,
        engagement_likes: 0,
        engagement_retweets: 0,
        engagement_replies: 0,
        engagement_quotes: 0,
        visibility_impressions: 0
      };

      const { error } = await supabaseClient.supabase
        ?.from('tweets')
        .insert(tweetData);

      if (error) {
        console.log('⚠️ Failed to save tweet to database:', error.message);
      }

    } catch (error) {
      console.log('⚠️ Error saving tweet to database:', error);
    }
  }

  /**
   * Get current status of draft queue
   */
  async getStatus(): Promise<{
    isRunning: boolean;
    queueStats: any;
    rateLimitRemaining?: number;
  }> {
    const queueStats = await getDraftQueueStats();
    
    let rateLimitRemaining: number | undefined;
    try {
      const rateLimitInfo = await xClient.checkRateLimit();
      rateLimitRemaining = rateLimitInfo.remaining;
    } catch (error) {
      // Ignore rate limit check errors in status
    }

    return {
      isRunning: this.isRunning,
      queueStats,
      rateLimitRemaining
    };
  }
}

export const draftDrainJob = new DraftDrainJob();
