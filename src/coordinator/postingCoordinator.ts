/**
 * Main posting coordinator that orchestrates the entire pipeline
 */

import OpenAI from 'openai';
import { Page } from 'playwright';
import { config } from '../config/environment';
import { generateThread, regenerateWithFeedback } from '../ai/threadGenerator';
import { validateContent } from '../quality/qualityGate';
import { isDuplicateThread, storeTweetSignatures, storeThreadRecord } from '../utils/dedupe';
import { postThread, deletePartialThread } from '../posting/playwrightPoster';
import { ContentSelector } from '../utils/content/selector';
import { ViralHookGenerator } from '../utils/content/viralHooks';
import { EngagementTracker } from '../utils/engagement/tracker';
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
  private contentSelector: ContentSelector;
  private hookGenerator: ViralHookGenerator;
  private engagementTracker: EngagementTracker;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!
    });
    this.supabase = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY);
    this.contentSelector = ContentSelector.getInstance();
    this.hookGenerator = ViralHookGenerator.getInstance();
    this.engagementTracker = EngagementTracker.getInstance();
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

  async executePost(page: Page, fallbackTopic?: string): Promise<PostingResult> {
    console.log(`🚀 Starting viral content posting pipeline`);
    console.log(`📋 Config: threads=${config.ENABLE_THREADS}, quality_min=${config.QUALITY_MIN_SCORE}, force=${config.FORCE_POST}`);

    try {
      // Check if we should allow posting
      const postingCheck = await this.shouldAllowPosting();
      if (!postingCheck.allowed) {
        return { success: false, error: postingCheck.reason };
      }

      // 🎯 STEP 1: Intelligent content selection
      console.log(`🎯 Selecting optimal content parameters...`);
      const selection = await this.contentSelector.selectContent();
      console.log(`✅ Content selection: ${selection.pillar}/${selection.angle} (spice=${selection.spice_level})`);

      // 🎣 STEP 2: Generate viral hooks
      console.log(`🎣 Generating viral hooks...`);
      const hooks = this.hookGenerator.generateHooks(
        selection.topic, 
        selection.pillar, 
        selection.angle, 
        selection.spice_level
      );

      // 🧠 STEP 3: Generate thread content
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
            thread = await generateThread(selection, this.openai);
          } else {
            // Regenerate with feedback from quality gate
            thread = await regenerateWithFeedback(selection.topic, this.openai, qualityReport?.reasons || []);
          }

          console.log(`✅ Generated thread: ${thread.tweets.length} tweets`);

          // Override hooks with our viral ones
          thread.hook_A = hooks.hook_A;
          thread.hook_B = hooks.hook_B;

          // Quality assessment - use the built-in quality score from the LLM
          qualityReport = {
            score: thread.quality.score,
            reasons: thread.quality.reasons,
            dims: thread.quality.rubric,
            passed: thread.quality.score >= 90
          };
          console.log(`📊 Quality score: ${qualityReport.score}/100, Passed: ${qualityReport.passed}`);

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
      const isDuplicate = await isDuplicateThread([{ text: thread.hook_A }, ...thread.tweets]);
      if (isDuplicate) {
        return { success: false, error: 'Thread content is too similar to recent posts' };
      }

      // 🧵 STEP 4: Post the thread if threading is enabled
      if (config.ENABLE_THREADS) {
        // Determine which hook to use (A/B testing logic)
        const hookToUse = await this.determineHookToUse(selection.pillar);
        const selectedHook = hookToUse === 'A' ? thread.hook_A : thread.hook_B;
        
        console.log(`🧵 Posting complete thread with hook ${hookToUse}...`);
        console.log(`🎣 Hook: ${selectedHook.substring(0, 80)}...`);
        
        const postResult = await postThread(page, selectedHook, thread.tweets);

        if (!postResult.success) {
          return { 
            success: false, 
            error: `Thread posting failed: ${postResult.error}` 
          };
        }

        // 📊 STEP 5: Store comprehensive tracking data
        const allTweets = [{ text: selectedHook }, ...thread.tweets];
        await storeTweetSignatures(postResult.ids, allTweets);
        
        // Enhanced thread record with all metadata
        await this.storeEnhancedThreadRecord(
          postResult.rootId,
          postResult.ids.slice(1),
          thread,
          selection,
          hooks,
          hookToUse,
          qualityReport.score
        );

        // 📅 STEP 6: Schedule engagement evaluation
        this.engagementTracker.scheduleEvaluation(postResult.rootId);
        
        // 📈 STEP 7: Record selection for learning
        await this.contentSelector.recordSelectionOutcome(
          selection,
          {
            rootId: postResult.rootId,
            qualityScore: qualityReport.score
          },
          'pending', // Will be updated after 2h evaluation
          0 // Will be updated after 2h evaluation
        );

        console.log(`🎉 Thread posted successfully!`);
        console.log(`   Root ID: ${postResult.rootId}`);
        console.log(`   Reply IDs: ${postResult.ids.slice(1).join(', ')}`);
        console.log(`   Hook used: ${hookToUse} (${hooks.pattern_used})`);
        console.log(`   Quality score: ${qualityReport.score}/100`);
        console.log(`   Pillar: ${selection.pillar} | Angle: ${selection.angle} | Spice: ${selection.spice_level}`);

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
        console.log(`   Hook A: ${thread.hook_A}`);
        console.log(`   Hook B: ${thread.hook_B}`);
        thread.tweets.forEach((tweet, i) => {
          console.log(`   Tweet ${i + 1}: ${tweet.text}`);
        });
        console.log(`   CTA: ${thread.cta}`);
        console.log(`   Quality Score: ${qualityReport.score}/100`);
        console.log(`   Pillar: ${thread.metadata.pillar}`);

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

  /**
   * Determine which hook (A or B) to use based on performance
   */
  private async determineHookToUse(pillar: string): Promise<'A' | 'B'> {
    try {
      // Get recent performance for this pillar
      const { data, error } = await this.supabase
        .from('hook_performance')
        .select('hook_used, engagement_bucket, engagement_score')
        .eq('pillar', pillar)
        .gte('posted_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('posted_at', { ascending: false });

      if (error || !data || data.length < 4) {
        // Not enough data, alternate between A and B
        const lastHook = data?.[0]?.hook_used || 'B';
        return lastHook === 'A' ? 'B' : 'A';
      }

      // Calculate performance for each hook
      const hookAPerf = data.filter(h => h.hook_used === 'A');
      const hookBPerf = data.filter(h => h.hook_used === 'B');

      if (hookAPerf.length === 0) return 'A';
      if (hookBPerf.length === 0) return 'B';

      const avgScoreA = hookAPerf.reduce((sum, h) => sum + (h.engagement_score || 0), 0) / hookAPerf.length;
      const avgScoreB = hookBPerf.reduce((sum, h) => sum + (h.engagement_score || 0), 0) / hookBPerf.length;

      // If A is significantly better, use A more often (70% of time)
      // Otherwise alternate or favor B
      if (avgScoreA > avgScoreB * 1.2) {
        return Math.random() < 0.7 ? 'A' : 'B';
      } else if (avgScoreB > avgScoreA * 1.2) {
        return Math.random() < 0.7 ? 'B' : 'A';
      } else {
        // Similar performance, alternate
        const lastHook = data[0]?.hook_used || 'B';
        return lastHook === 'A' ? 'B' : 'A';
      }

    } catch (error) {
      console.warn('Error determining hook, defaulting to A:', error);
      return 'A';
    }
  }

  /**
   * Store enhanced thread record with all metadata
   */
  private async storeEnhancedThreadRecord(
    rootTweetId: string,
    replyTweetIds: string[],
    thread: any,
    selection: any,
    hooks: any,
    hookUsed: string,
    qualityScore: number
  ): Promise<void> {
    try {
      // Store main thread record
      await storeThreadRecord(rootTweetId, replyTweetIds, thread.topic, 
        hookUsed === 'A' ? thread.hook_A : thread.hook_B, qualityScore);

      // Update with enhanced metadata
      const { error: updateError } = await this.supabase
        .from('posted_threads')
        .update({
          metadata: {
            pillar: selection.pillar,
            angle: selection.angle,
            spice_level: selection.spice_level,
            evidence_mode: selection.evidence_mode,
            selection_reasoning: selection.reasoning
          },
          hook_used: hookUsed
        })
        .eq('root_tweet_id', rootTweetId);

      if (updateError) {
        console.error('Failed to update thread metadata:', updateError);
      }

      // Store hook performance data
      const { error: hookError } = await this.supabase
        .from('hook_performance')
        .insert({
          root_tweet_id: rootTweetId,
          hook_used: hookUsed,
          hook_text: hookUsed === 'A' ? thread.hook_A : thread.hook_B,
          pillar: selection.pillar,
          angle: selection.angle,
          pattern_used: hooks.pattern_used,
          psychology_trigger: hooks.psychology_trigger,
          posted_at: new Date().toISOString()
        });

      if (hookError) {
        console.warn('Could not store hook performance data:', hookError);
      }

      console.log(`✅ Stored enhanced thread metadata and hook performance`);

    } catch (error) {
      console.error('Error storing enhanced thread record:', error);
    }
  }
}
