import { CadenceGuard } from './cadenceGuard';
import { TwitterPoster } from './postThread';
import { getContentGenerator } from '../ai/generate';
import { validateContent, sanitizeForPosting, validateFinalLength, normalizeSingle } from '../quality/qualityGate';
import { scheduleMetricsTracking } from '../metrics/trackTweet';
import { storeLearningPost } from '../db/index';
import { getPostLock } from '../infra/postLockInstance';
import { throttledWarn } from '../utils/throttledWarn';
import { browserManager } from './BrowserManager';

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

  static getInstance(): PostingOrchestrator {
    if (!this.instance) {
      this.instance = new PostingOrchestrator();
    }
    return this.instance;
  }

  /**
   * Execute a complete posting workflow with distributed lock prevention
   */
  async executePost(request: PostingRequest = {}): Promise<PostingResult> {
    const startTime = Date.now();
    let currentPhase = PostingPhase.CADENCE_CHECK;

    // Use distributed PostLock instead of local isPosting flag
    const postLock = getPostLock();
    const reason = `orchestrator_post_${request.topic || 'auto'}`;

    return await postLock.run(
      reason,
      async (corrId) => this.executePostInternal(request, startTime, corrId),
      () => {
        throttledWarn('Another post is already in progress', 'posting_locked');
        return {
          success: false,
          phase: PostingPhase.FAILED,
          error: 'Another post is already in progress'
        };
      }
    ) || {
      success: false,
      phase: PostingPhase.FAILED,
      error: 'Another post is already in progress'
    };
  }

  /**
   * Internal posting workflow (runs within PostLock)
   */
  private async executePostInternal(
    request: PostingRequest,
    startTime: number,
    corrId: string
  ): Promise<PostingResult> {
    let currentPhase = PostingPhase.CADENCE_CHECK;

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
        
        // Determine topic and format using intelligent decision engine
        const topic = request.topic || await this.generateRandomTopic();
        let format: 'single' | 'thread' = request.format;
        
        if (!format) {
          // Use enhanced format decision engine
          const { makeFormatDecision } = await import('./format');
          const decision = await makeFormatDecision(topic);
          format = decision.format;
          
          // Log the format decision prominently with diversity details
          const { getRecentFormats } = await import('./format');
          const recentFormats = await getRecentFormats(15).catch(() => []);
          const lastThreadIndex = recentFormats.findIndex(f => f === 'thread');
          const lastThreadAt = lastThreadIndex >= 0 
            ? new Date(Date.now() - (lastThreadIndex * 2 * 60 * 60 * 1000))
            : null;
          const threadsInLast9 = recentFormats.slice(-9).filter(f => f === 'thread').length;
          
          console.log(`FORMAT_DECISION ${JSON.stringify({
            format: decision.format,
            confidence: decision.confidence,
            reason: decision.reason,
            topic_preview: topic.substring(0, 30),
            diversity_cooldown: {
              lastThreadAt: lastThreadAt?.toISOString(),
              threadsInLast9
            }
          })}`);
        }
        
        // Check cadence before proceeding
        const { checkCadenceWithLogging } = await import('./cadence');
        const { getRecentPosts } = await import('../learning/metricsWriter').catch(() => ({ getRecentPosts: null }));
        
        const recentPosts = getRecentPosts ? await getRecentPosts(10) : [];
        const lastPostAt = recentPosts.length > 0 ? new Date(recentPosts[0].createdAt) : undefined;
        
        const cadenceCheck = checkCadenceWithLogging({
          now: new Date(),
          lastPostAt,
          format,
          totalPosts: recentPosts.length
        });
        
        if (!cadenceCheck.allowed) {
          return {
            success: false,
            phase: PostingPhase.FAILED,
            error: `Cadence limit: wait ${cadenceCheck.waitMin} minutes`
          };
        }
        
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

        // Phase 3: Quality Gate with normalization
        currentPhase = PostingPhase.QUALITY_GATE;
        console.log(`📍 ${currentPhase}: Final quality validation`);
        
        const validationStart = Date.now();
        
        // Auto-repair single format before validation
        let normalizedContent = contentResult.content;
        if (format === 'single' && normalizedContent.tweets && normalizedContent.tweets.length !== 1) {
          console.log(`🔧 Normalizing single format from ${normalizedContent.tweets.length} to 1 tweet`);
          normalizedContent = normalizeSingle(normalizedContent);
        }
        
        const qualityResult = validateContent(normalizedContent);
        const validationTime = Date.now() - validationStart;

        if (!qualityResult.passed) {
          console.log(`❌ ${currentPhase}: Quality gate failed (${qualityResult.score}/100)`);
          console.log(`   Errors: ${qualityResult.errors.join(', ')}`);
          
          // THREAD FALLBACK LOGIC: If thread fails quality gate, try single
          if (format === 'thread') {
            console.log(`THREAD_FAILED_GATE ${JSON.stringify({ reason: qualityResult.errors[0] })}`);
            console.log('FALLING_BACK_TO_SINGLE');
            
            try {
              // Generate single tweet version
              const singleResult = await generator.generateContent({ topic, format: 'single' });
              
              if (singleResult.success && singleResult.content) {
                const singleQuality = validateContent(singleResult.content);
                
                if (singleQuality.passed) {
                  console.log(`✅ FALLBACK_SINGLE_PASSED quality_score=${singleQuality.score}/100`);
                  
                  // Update format and content for successful single fallback
                  format = 'single';
                  normalizedContent = singleResult.content;
                  
                  // Continue with single post execution
                  console.log(`📍 POST: Sanitizing fallback single content and posting to X`);
                  
                  const sanitizedTweets = normalizedContent.tweets.map(tweet => 
                    sanitizeForPosting(tweet)
                  );
                  
                  console.log(`📝 Posting ${sanitizedTweets.length} tweets`);
                  sanitizedTweets.forEach((tweet, i) => 
                    console.log(`   ${i + 1}. "${tweet.substring(0, 50)}..." (${tweet.length} chars)`)
                  );
                  
                  const poster = new TwitterPoster();
                  const postResult = await poster.postSingleTweet(sanitizedTweets[0], topic);
                  
                  if (postResult.success) {
                    const rootTweetId = postResult.tweetId;
                    console.log(`FALLBACK_SINGLE_POSTED ${JSON.stringify({ tweet_id: rootTweetId })}`);
                    
                    // Store metrics with new system (non-fatal)
                    try {
                      const { storeNewPostMetrics } = await import('./metrics');
                      await storeNewPostMetrics({
                        tweet_id: rootTweetId,
                        format: 'single',
                        content: sanitizedTweets[0]
                      });
                    } catch (error: any) {
                      console.warn(`METRICS_UPSERT_SOFTFAIL tweet_id=${rootTweetId} reason=${error.message} action=skipped (post succeeded)`);
                    }
                    
                    await this.storePostData(normalizedContent, rootTweetId, singleQuality.score);
                    await CadenceGuard.markPostSuccess();
                    
                    return {
                      success: true,
                      phase: PostingPhase.DONE,
                      rootTweetId,
                      qualityScore: singleQuality.score,
                      metrics: {
                        generationTimeMs: generationTime,
                        validationTimeMs: validationTime,
                        postingTimeMs: Date.now() - startTime,
                        totalTimeMs: Date.now() - startTime
                      }
                    };
                  } else {
                    throw new Error(`Fallback single post failed: ${postResult.error}`);
                  }
                } else {
                  console.log(`❌ FALLBACK_SINGLE_FAILED quality_score=${singleQuality.score}/100 errors=${singleQuality.errors.join(', ')}`);
                }
              }
            } catch (fallbackError: any) {
              console.log(`❌ FALLBACK_SINGLE_ERROR: ${fallbackError.message}`);
            }
          }
          
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
        
        // Sanitize tweets (use normalized content)
        const sanitizedTweets = normalizedContent.tweets.map(tweet => {
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
        
        // Store metrics with new system (non-fatal)
        try {
          const { storeNewPostMetrics } = await import('./metrics');
          await storeNewPostMetrics({
            tweet_id: rootTweetId!,
            format,
            content: normalizedContent.tweets.join(' ')
          });
        } catch (error: any) {
          console.warn(`METRICS_UPSERT_SOFTFAIL tweet_id=${rootTweetId} reason=${error.message} action=skipped (post succeeded)`);
        }
        
        // Store learning data (legacy system)
        await this.storePostData(
          normalizedContent,
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
    // Check distributed posting lock
    const postLock = getPostLock();
    const lockStatus = await postLock.status();
    
    if (lockStatus.locked && !lockStatus.stale) {
      return { allowed: false, reason: 'Post currently in progress by another instance' };
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
  async getStatus(): Promise<{
    isPosting: boolean;
    canPost: boolean;
  }> {
    const lockStatus = await getPostLock().status();
    const isPosting = lockStatus.locked && !lockStatus.stale;
    
    return {
      isPosting,
      canPost: !isPosting
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
