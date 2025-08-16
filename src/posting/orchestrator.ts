import { CadenceGuard } from './cadenceGuard';
import { TwitterPoster } from './postThread';
import { getContentGenerator } from '../ai/generate';
import { validateContent, sanitizeForPosting, validateFinalLength } from '../quality/qualityGate';
import { scheduleMetricsTracking } from '../metrics/trackTweet';
import { storeLearningPost } from '../db/index';

/**
 * Posting phases for clear logging
 */
export enum PostingPhase {
  CADENCE_CHECK = 'CADENCE_CHECK',
  PROMPT_BUILD = 'PROMPT_BUILD', 
  MODEL_CALL = 'MODEL_CALL',
  QUALITY_GATE = 'QUALITY_GATE',
  POST = 'POST',
  STORE = 'STORE',
  DONE = 'DONE',
  FAILED = 'FAILED'
}

export interface PostingRequest {
  topic?: string;
  format?: 'thread' | 'single';
  forcePost?: boolean;
}

export interface PostingResult {
  success: boolean;
  phase: PostingPhase;
  tweetIds?: string[];
  rootTweetId?: string;
  qualityScore?: number;
  attempts?: number;
  error?: string;
  metrics?: {
    generationTimeMs: number;
    validationTimeMs: number;
    postingTimeMs: number;
    totalTimeMs: number;
  };
}

/**
 * Main posting orchestrator that prevents loops and manages the entire posting pipeline
 */
export class PostingOrchestrator {
  private static instance: PostingOrchestrator | null = null;
  private isPosting = false;

  static getInstance(): PostingOrchestrator {
    if (!this.instance) {
      this.instance = new PostingOrchestrator();
    }
    return this.instance;
  }

  /**
   * Execute a complete posting workflow with loop prevention
   */
  async executePost(request: PostingRequest = {}): Promise<PostingResult> {
    const startTime = Date.now();
    let currentPhase = PostingPhase.CADENCE_CHECK;

    // Prevent concurrent posting
    if (this.isPosting) {
      console.log('⚠️ Posting already in progress, skipping');
      return {
        success: false,
        phase: PostingPhase.FAILED,
        error: 'Another post is already in progress'
      };
    }

    this.isPosting = true;

    try {
      console.log('🚀 POST_ORCHESTRATOR: Starting posting workflow');
      console.log(`📝 Request: ${JSON.stringify(request)}`);

      // Phase 1: Cadence Check
      currentPhase = PostingPhase.CADENCE_CHECK;
      console.log(`📍 ${currentPhase}: Checking posting cadence and acquiring lock`);
      
      const cadenceCheck = await CadenceGuard.checkAndLock();
      if (!cadenceCheck.allowed) {
        console.log(`⏸️ ${currentPhase}: Posting not allowed - ${cadenceCheck.reason}`);
        return {
          success: false,
          phase: currentPhase,
          error: cadenceCheck.reason
        };
      }

      console.log(`✅ ${currentPhase}: Lock acquired, proceeding with post`);

      try {
        // Phase 2: Content Generation
        currentPhase = PostingPhase.PROMPT_BUILD;
        console.log(`📍 ${currentPhase}: Building content generation request`);
        
        const generationStart = Date.now();
        const generator = getContentGenerator();
        
        // Determine topic and format
        const topic = request.topic || await this.generateRandomTopic();
        const format = request.format || (Math.random() > 0.3 ? 'thread' : 'single');
        
        console.log(`🎯 Topic: "${topic}", Format: ${format}`);

        currentPhase = PostingPhase.MODEL_CALL;
        console.log(`📍 ${currentPhase}: Generating content with OpenAI`);
        
        const contentResult = await generator.generateContent({ topic, format });
        const generationTime = Date.now() - generationStart;
        
        if (!contentResult.success || !contentResult.content) {
          await CadenceGuard.markPostFailure(`Content generation failed: ${contentResult.error}`);
          return {
            success: false,
            phase: currentPhase,
            error: contentResult.error,
            attempts: contentResult.attempts
          };
        }

        console.log(`✅ ${currentPhase}: Content generated (${contentResult.attempts} attempts, score: ${contentResult.qualityScore}/100)`);

        // Phase 3: Quality Gate
        currentPhase = PostingPhase.QUALITY_GATE;
        console.log(`📍 ${currentPhase}: Final quality validation`);
        
        const validationStart = Date.now();
        const qualityResult = validateContent(contentResult.content);
        const validationTime = Date.now() - validationStart;

        if (!qualityResult.passed) {
          console.log(`❌ ${currentPhase}: Quality gate failed (${qualityResult.score}/100)`);
          console.log(`   Errors: ${qualityResult.errors.join(', ')}`);
          await CadenceGuard.markPostFailure(`Quality gate failed: ${qualityResult.errors[0]}`);
          return {
            success: false,
            phase: currentPhase,
            error: `Quality gate failed: ${qualityResult.errors[0]}`,
            qualityScore: qualityResult.score
          };
        }

        console.log(`✅ ${currentPhase}: Quality validation passed (${qualityResult.score}/100)`);

        // Phase 4: Sanitize and Post
        currentPhase = PostingPhase.POST;
        console.log(`📍 ${currentPhase}: Sanitizing content and posting to X`);
        
        const postingStart = Date.now();
        
        // Sanitize tweets
        const sanitizedTweets = contentResult.content.tweets.map(tweet => {
          const sanitized = sanitizeForPosting(tweet);
          const lengthCheck = validateFinalLength(sanitized);
          
          if (!lengthCheck.valid) {
            console.warn(`⚠️ Tweet length issue: ${lengthCheck.error}`);
            // Try to truncate gracefully
            return sanitized.substring(0, 275) + '...';
          }
          
          return sanitized;
        });

        console.log(`📝 Posting ${sanitizedTweets.length} tweets`);
        sanitizedTweets.forEach((tweet, i) => {
          console.log(`   ${i + 1}. "${tweet.substring(0, 60)}..." (${tweet.length} chars)`);
        });

        // Execute posting
        const poster = new TwitterPoster();
        await poster.initialize();

        let postResult;
        if (sanitizedTweets.length === 1) {
          postResult = await poster.postSingleTweet(sanitizedTweets[0], topic);
        } else {
          postResult = await poster.postThread(sanitizedTweets, topic);
        }

        await poster.close();
        const postingTime = Date.now() - postingStart;

        if (!postResult.success) {
          await CadenceGuard.markPostFailure(`Posting failed: ${postResult.error}`);
          return {
            success: false,
            phase: currentPhase,
            error: postResult.error
          };
        }

        const rootTweetId = 'rootTweetId' in postResult ? postResult.rootTweetId : postResult.tweetId;
        const tweetIds = 'tweetIds' in postResult ? postResult.tweetIds : [postResult.tweetId!];

        console.log(`✅ ${currentPhase}: Posted successfully`);
        console.log(`   Root tweet ID: ${rootTweetId}`);
        console.log(`   Tweet IDs: ${tweetIds.join(', ')}`);

        // Phase 5: Store Data
        currentPhase = PostingPhase.STORE;
        console.log(`📍 ${currentPhase}: Storing post data and scheduling metrics`);
        
        // Store learning data
        await this.storePostData(
          contentResult.content,
          rootTweetId!,
          qualityResult.score
        );

        // Schedule metrics tracking
        if (rootTweetId) {
          scheduleMetricsTracking(rootTweetId, 60); // Track after 1 hour
        }

        // Mark success and release lock
        await CadenceGuard.markPostSuccess();

        // Phase 6: Done
        currentPhase = PostingPhase.DONE;
        const totalTime = Date.now() - startTime;
        
        console.log(`✅ ${currentPhase}: Posting workflow completed successfully in ${totalTime}ms`);

        return {
          success: true,
          phase: currentPhase,
          tweetIds,
          rootTweetId,
          qualityScore: qualityResult.score,
          attempts: contentResult.attempts,
          metrics: {
            generationTimeMs: generationTime,
            validationTimeMs: validationTime,
            postingTimeMs: postingTime,
            totalTimeMs: totalTime
          }
        };

      } catch (error) {
        // Ensure lock is released on any error
        await CadenceGuard.markPostFailure(
          error instanceof Error ? error.message : 'Unknown posting error'
        );
        throw error;
      }

    } catch (error) {
      console.error(`❌ ${currentPhase}: Posting workflow failed:`, error);
      return {
        success: false,
        phase: PostingPhase.FAILED,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    } finally {
      this.isPosting = false;
    }
  }

  /**
   * Check if posting is currently allowed
   */
  async canPost(): Promise<{
    allowed: boolean;
    reason?: string;
    nextAllowedAt?: Date;
  }> {
    if (this.isPosting) {
      return { allowed: false, reason: 'Post currently in progress' };
    }

    try {
      const status = await CadenceGuard.getStatus();
      
      if (status.isLocked) {
        return { allowed: false, reason: 'Posting locked by another process' };
      }

      if (status.nextAllowedAt && status.nextAllowedAt > new Date()) {
        return { 
          allowed: false, 
          reason: 'Minimum posting interval not met',
          nextAllowedAt: status.nextAllowedAt
        };
      }

      return { allowed: true };
    } catch (error) {
      return { 
        allowed: false, 
        reason: `Cadence check failed: ${error}` 
      };
    }
  }

  /**
   * Get posting status
   */
  getStatus(): {
    isPosting: boolean;
    canPost: boolean;
  } {
    return {
      isPosting: this.isPosting,
      canPost: !this.isPosting
    };
  }

  private async generateRandomTopic(): Promise<string> {
    const healthTopics = [
      'morning hydration optimization',
      'post-workout recovery timing',
      'blue light and sleep quality',
      'micronutrient absorption hacks',
      'stress-cortisol reduction techniques',
      'metabolic flexibility strategies',
      'inflammation reduction foods',
      'circadian rhythm optimization'
    ];

    return healthTopics[Math.floor(Math.random() * healthTopics.length)];
  }

  private async storePostData(
    content: any,
    rootTweetId: string,
    qualityScore: number
  ): Promise<void> {
    try {
      await storeLearningPost({
        content: content.tweets.join('\n\n'),
        tweet_id: rootTweetId,
        topic: content.topic,
        quality_score: qualityScore,
        learning_metadata: {
          format: content.format,
          tweet_count: content.tweets.length,
          generation_timestamp: new Date().toISOString(),
          quality_passed: true
        }
      });

      console.log('✅ STORE: Post data saved successfully');
    } catch (error) {
      console.error('❌ STORE: Failed to store post data:', error);
    }
  }
}

/**
 * Convenience function for external use
 */
export async function executePost(request: PostingRequest = {}): Promise<PostingResult> {
  const orchestrator = PostingOrchestrator.getInstance();
  return orchestrator.executePost(request);
}

/**
 * Check if posting is allowed
 */
export async function canPost(): Promise<{
  allowed: boolean;
  reason?: string;
  nextAllowedAt?: Date;
}> {
  const orchestrator = PostingOrchestrator.getInstance();
  return orchestrator.canPost();
}
