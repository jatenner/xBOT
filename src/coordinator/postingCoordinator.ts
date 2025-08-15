/**
 * Main posting coordinator that orchestrates the entire pipeline
 */

import OpenAI from 'openai';
import { Page } from 'playwright';
import { config } from '../config/environment';
import { generateThread, regenerateWithFeedback } from '../ai/threadGenerator';
import { scoreThread, formatQualityReport } from '../quality/qualityGate';
import { isDuplicateThread, storeTweetSignatures, storeThreadRecord } from '../utils/dedupe';
import { postThread, deletePartialThread } from '../posting/playwrightPoster';
import { createClient } from '@supabase/supabase-js';

export interface PostingResult {
  success: boolean;
  error?: string;
  threadData?: {
    topic: string;
    rootId: string;
    replyIds: string[];
    qualityScore: number;
  };
}

export class PostingCoordinator {
  private openai: OpenAI;
  private supabase: any;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!
    });
    this.supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY);
  }

  async shouldAllowPosting(): Promise<{ allowed: boolean; reason?: string }> {
    // Check if posting is forced
    if (config.FORCE_POST) {
      return { allowed: true };
    }

    // Check minimum time between posts
    try {
      const { data, error } = await this.supabase
        .from('posted_threads')
        .select('posted_at')
        .order('posted_at', { ascending: false })
        .limit(1);

      if (error) {
        console.warn('Error checking last post time:', error);
        return { allowed: true };
      }

      const result = data?.[0]?.posted_at || null;

      if (result) {
        const lastPostTime = new Date(result);
        const minInterval = config.MIN_HOURS_BETWEEN_POSTS * 60 * 60 * 1000;
        const timeSinceLastPost = Date.now() - lastPostTime.getTime();

        if (timeSinceLastPost < minInterval) {
          const hoursRemaining = Math.ceil((minInterval - timeSinceLastPost) / (60 * 60 * 1000));
          return { 
            allowed: false, 
            reason: `Too soon since last post (${hoursRemaining}h remaining)` 
          };
        }
      }

      return { allowed: true };
    } catch (error) {
      console.warn('Error checking posting cadence, allowing post:', error);
      return { allowed: true };
    }
  }

  async executePost(page: Page, topic: string): Promise<PostingResult> {
    console.log(`🚀 Starting posting pipeline for topic: "${topic}"`);
    console.log(`📋 Config: threads=${config.ENABLE_THREADS}, quality_min=${config.QUALITY_MIN_SCORE}, force=${config.FORCE_POST}`);

    try {
      // Check if we should allow posting
      const postingCheck = await this.shouldAllowPosting();
      if (!postingCheck.allowed) {
        return { success: false, error: postingCheck.reason };
      }

      // Generate thread content
      console.log(`🧠 Generating thread content...`);
      let thread;
      let qualityReport;
      let attempts = 0;
      const maxAttempts = 2;

      while (attempts < maxAttempts) {
        attempts++;
        console.log(`🎯 Generation attempt ${attempts}/${maxAttempts}`);

        try {
          if (attempts === 1) {
            thread = await generateThread(topic, this.openai);
          } else {
            // Regenerate with feedback from quality gate
            thread = await regenerateWithFeedback(topic, this.openai, qualityReport?.reasons || []);
          }

          console.log(`✅ Generated thread: ${thread.tweets.length} tweets`);

          // Quality assessment
          qualityReport = scoreThread(thread.hook, thread.tweets);
          console.log(formatQualityReport(qualityReport));

          if (qualityReport.passed) {
            break; // Quality gate passed
          } else if (attempts === maxAttempts) {
            return { 
              success: false, 
              error: `Quality gate failed after ${maxAttempts} attempts: ${qualityReport.reasons.join(', ')}` 
            };
          }

        } catch (error) {
          if (attempts === maxAttempts) {
            return { 
              success: false, 
              error: `Content generation failed: ${error}` 
            };
          }
          console.warn(`⚠️ Generation attempt ${attempts} failed:`, error);
        }
      }

      if (!thread || !qualityReport) {
        return { success: false, error: 'Failed to generate valid thread' };
      }

      // Deduplication check
      console.log(`🔍 Checking for duplicates...`);
      const isDuplicate = await isDuplicateThread([{ text: thread.hook }, ...thread.tweets]);
      if (isDuplicate) {
        return { success: false, error: 'Thread content is too similar to recent posts' };
      }

      // Post the thread if threading is enabled
      if (config.ENABLE_THREADS) {
        console.log(`🧵 Posting complete thread...`);
        const postResult = await postThread(page, thread.hook, thread.tweets);

        if (!postResult.success) {
          return { 
            success: false, 
            error: `Thread posting failed: ${postResult.error}` 
          };
        }

        // Store signatures and thread record
        const allTweets = [{ text: thread.hook }, ...thread.tweets];
        await storeTweetSignatures(postResult.ids, allTweets);
        await storeThreadRecord(
          postResult.rootId,
          postResult.ids.slice(1), // Reply IDs (excluding root)
          thread.topic,
          thread.hook,
          qualityReport.score
        );

        console.log(`🎉 Thread posted successfully!`);
        console.log(`   Root ID: ${postResult.rootId}`);
        console.log(`   Reply IDs: ${postResult.ids.slice(1).join(', ')}`);

        return {
          success: true,
          threadData: {
            topic: thread.topic,
            rootId: postResult.rootId,
            replyIds: postResult.ids.slice(1),
            qualityScore: qualityReport.score
          }
        };

      } else {
        // Threading disabled - just log what would be posted
        console.log(`📝 Threading disabled - would post:`);
        console.log(`   Hook: ${thread.hook}`);
        thread.tweets.forEach((tweet, i) => {
          console.log(`   Tweet ${i + 1}: ${tweet.text}`);
        });
        console.log(`   Quality Score: ${qualityReport.score}/100`);

        return { success: false, error: 'Threading disabled (ENABLE_THREADS=false)' };
      }

    } catch (error) {
      console.error(`❌ Posting pipeline failed:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }
}
