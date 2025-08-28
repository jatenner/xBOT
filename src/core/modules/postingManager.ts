/**
 * 📮 POSTING MANAGER MODULE
 * 
 * Extracted from autonomousPostingEngine.ts to handle posting operations
 * Manages the posting workflow, timing, and error handling
 */

import { PerformanceOptimizer } from './performanceOptimizer';

export interface PostingOptions {
  opportunity?: any;
  forcePost?: boolean;
  testMode?: boolean;
  topic?: string;
}

export interface PostingResult {
  success: boolean;
  content?: string;
  tweetId?: string;
  type?: 'single' | 'thread';
  error?: string;
  metadata?: {
    processingTime: number;
    optimizationApplied: boolean;
    qualityScore?: number;
    strategy?: any;
  };
}

export class PostingManager {
  private static instance: PostingManager;
  private isPosting = false;
  private lastPostAttempt = 0;
  private consecutiveFailures = 0;
  private emergencyStopUntil = 0;
  private performanceOptimizer: PerformanceOptimizer;
  
  // 🧠 ADAPTIVE GROWTH ENGINE: Real follower optimization
  private adaptiveGrowthEngine: any = null;

  private constructor() {
    this.performanceOptimizer = PerformanceOptimizer.getInstance();
    this.initializeAdaptiveGrowth();
  }

  /**
   * 🧠 UNIFIED AI SYSTEM: Elite intelligent content creation
   */
  public async generateUltimateAiContent(topic?: string): Promise<{ content: string; metadata: any; isThread: boolean }> {
    try {
      console.log('🧠 POSTING_MANAGER: Activating Unified AI systems...');
      
      // Use unified learning coordinator for intelligent decisions
      const { getUnifiedLearningCoordinator } = await import('../../intelligence/unifiedLearningCoordinator');
      const learningCoordinator = getUnifiedLearningCoordinator();
      
      // Get intelligent decision
      const learningDecision = await learningCoordinator.makeIntelligentDecision(topic);
      
      // Use Master AI with learning insights
      const { getMasterAi } = await import('../../ai/masterAiOrchestrator');
      const masterAi = getMasterAi();
      
      const aiDecision = await masterAi.createUltimateContent(topic);
      
      // Determine if content is a thread
      const isThread = aiDecision.content.includes('1/') || aiDecision.content.includes('Thread:') || aiDecision.content.split('\n').length > 3;
      
      console.log(`✅ MASTER_AI: Created ${isThread ? 'thread' : 'single'} content with ${(aiDecision.predicted_performance.viral_probability * 100).toFixed(1)}% viral probability`);
      console.log(`🎯 STRATEGY: ${aiDecision.strategy}`);
      console.log(`🧬 EVOLUTION: ${aiDecision.ai_reasoning.evolutionary_advantages.join(', ')}`);
      
      return {
        content: aiDecision.content,
        isThread,
        metadata: {
          strategy: aiDecision.strategy,
          predicted_performance: aiDecision.predicted_performance,
          ai_reasoning: aiDecision.ai_reasoning,
          optimization_applied: aiDecision.optimization_applied,
          learning_decision: learningDecision,
          processingTime: Date.now(),
          optimizationApplied: true,
          qualityScore: Math.round(aiDecision.predicted_performance.confidence_score * 100),
          masterAiUsed: true,
          unifiedSystemUsed: true
        }
      };

    } catch (error: any) {
      console.error('❌ MASTER_AI: Ultimate content generation failed, using enhanced fallback:', error.message);
      
      // Enhanced fallback using existing systems
      try {
        const { getSocialContentOperator } = await import('../../ai/socialContentOperator');
        const operator = getSocialContentOperator();
        const content = await operator.generateContentPack(
          'Evidence-based health optimization specialist',
          ['evidence-based', 'actionable', 'surprising'],
          []
        );

        return {
          content: content.singles?.[0] || 'AI-generated health optimization insight',
          isThread: false,
          metadata: {
            strategy: 'enhanced_fallback',
            processingTime: Date.now(),
            optimizationApplied: true,
            qualityScore: 75,
            masterAiUsed: false
          }
        };
      } catch (fallbackError: any) {
        console.error('❌ Enhanced fallback also failed:', fallbackError.message);
        
        return {
          content: topic ? 
            `Revolutionary insights about ${topic}: Latest research reveals breakthrough strategies that optimize results.` :
            'Breaking: Advanced health optimization research reveals protocols that transform performance metrics.',
          isThread: false,
          metadata: {
            strategy: 'emergency_fallback',
            processingTime: Date.now(),
            optimizationApplied: false,
            qualityScore: 50,
            masterAiUsed: false
          }
        };
      }
    }
  }

  /**
   * 🧠 Initialize adaptive growth learning
   */
  private async initializeAdaptiveGrowth(): Promise<void> {
    try {
      const { AdaptiveGrowthEngine } = await import('../../intelligence/adaptiveGrowthEngine');
      this.adaptiveGrowthEngine = AdaptiveGrowthEngine.getInstance();
      console.log('🧠 ADAPTIVE_GROWTH: Engine initialized for follower optimization');
    } catch (error: any) {
      console.warn('⚠️ ADAPTIVE_GROWTH: Failed to initialize:', error.message);
    }
  }

  public static getInstance(): PostingManager {
    if (!PostingManager.instance) {
      PostingManager.instance = new PostingManager();
    }
    return PostingManager.instance;
  }

  /**
   * 🎯 Execute intelligent posting with performance optimization
   */
  public async executeIntelligentPost(options: PostingOptions = {}): Promise<PostingResult> {
    const startTime = Date.now();
    
    try {
      // Check if we can post using intelligent growth engine
      const canPost = await this.canAttemptPost();
      if (!canPost.allowed) {
        return {
          success: false,
          error: canPost.reason,
          metadata: {
            processingTime: Date.now() - startTime,
            optimizationApplied: false,
            strategy: canPost.strategy
          }
        };
      }

      // Mark as posting
      this.isPosting = true;
      this.lastPostAttempt = Date.now();

      console.log('🚀 POSTING_MANAGER: Starting intelligent post execution');

      // Generate content with performance monitoring
      let contentResult = await this.performanceOptimizer.measureExecution(
        () => this.generateOptimizedContent(options),
        'openai',
        'Content Generation'
      );

      // 🚨 DUPLICATE DETECTION: Check for duplicates before posting
      console.log('🔍 DEDUP_CHECK: Checking content for duplicates...');
      const { DualStoreManager } = await import('../../lib/dualStoreManager');
      const store = DualStoreManager.getInstance();

      const textForDedupe = Array.isArray(contentResult.content)
        ? contentResult.content.join(' ')
        : contentResult.content;

      for (let attempt = 1; attempt <= 3; attempt++) {
        const dup = await store.checkContentDuplicate(textForDedupe);
        if (!dup.exists) {
          console.log(`✅ DEDUP_CHECK: Content is unique (attempt ${attempt})`);
          break;
        }

        console.warn(`⚠️ DEDUP_BLOCKED: Duplicate detected (attempt ${attempt}): ${dup.hash?.substring(0, 8)}`);
        if (attempt === 3) {
          console.error('❌ DEDUP_SKIP: Max regeneration attempts reached, skipping post');
          return { 
            success: false, 
            error: 'Content too similar to recent posts',
            metadata: {
              processingTime: Date.now() - startTime,
              optimizationApplied: false
            }
          };
        }

        // Regenerate content with fresh angle
        console.log(`🔄 DEDUP_REGEN: Regenerating content (attempt ${attempt + 1})`);
        contentResult = await this.performanceOptimizer.measureExecution(
          () => this.generateOptimizedContent(options),
          'openai',
          `Content Regeneration ${attempt + 1}`
        );
      }

      // 🧠 LEARNING: Get content recommendations before posting
      console.log('🧠 LEARNING: Analyzing content for viral potential...');
      const { IntelligentLearningEngine } = await import('../../intelligence/intelligentLearningEngine');
      const learningEngine = IntelligentLearningEngine.getInstance();
      
      const contentText = Array.isArray(contentResult.content) 
        ? contentResult.content.join(' ') 
        : contentResult.content;
      
      const prediction = await learningEngine.predictContentPerformance(contentText);
      console.log(`🎯 PREDICTION: ${prediction.expectedLikes} likes, ${prediction.expectedFollowers} followers (${Math.round(prediction.confidenceScore * 100)}% confidence)`);
      
      // Store prediction for use after posting
      const postPrediction = prediction;

      // Execute the actual posting
      const postResult = await this.performanceOptimizer.optimizeBrowserOperation(
        'Tweet Posting',
        () => this.executeActualPosting(contentResult)
      );

      // Store content and metrics
      await this.performanceOptimizer.optimizeDatabaseOperation(
        'Store Tweet Content',
        () => this.storePostingResults(postResult, contentResult)
      );

      // 🚨 POST-POST HASH STORAGE: Store content hash for future deduplication
      try {
        const textStored = Array.isArray(contentResult.content)
          ? contentResult.content.join('\n\n')
          : contentResult.content;

        await store.checkContentDuplicate(textStored, postResult.tweetId); // stores hash with TTL when tweetId provided
        console.log('✅ DB_WRITE: Stored content hash for dedupe');
      } catch (e: any) {
        console.warn('⚠️ DEDUPE_STORE_SKIP:', e.message);
      }

      // 🧠 LEARNING: Store performance baseline for future learning
      try {
        console.log('🧠 LEARNING: Storing performance baseline...');
        const { FollowerGrowthOptimizer } = await import('../../intelligence/followerGrowthOptimizer');
        const growthOptimizer = FollowerGrowthOptimizer.getInstance();
        
        const learningTextStored = Array.isArray(contentResult.content)
          ? contentResult.content.join('\n\n')
          : contentResult.content;
        
        await growthOptimizer.recordPostBaseline({
          tweetId: postResult.tweetId,
          content: learningTextStored,
          contentType: contentResult.type || 'single',
          predictedLikes: postPrediction.expectedLikes,
          predictedFollowers: postPrediction.expectedFollowers,
          confidenceScore: postPrediction.confidenceScore,
          postedAt: new Date().toISOString()
        });
        
        console.log('✅ LEARNING: Performance baseline recorded');
      } catch (learningError: any) {
        console.warn('⚠️ LEARNING_SKIP:', learningError.message);
      }

      // Reset failure counter on success
      this.consecutiveFailures = 0;
      console.log('✅ POST_SUCCESS: Resetting failure counter (was 0)');

      return {
        success: true,
        content: contentResult.content,
        tweetId: postResult.tweetId,
        type: contentResult.type,
        metadata: {
          processingTime: Date.now() - startTime,
          optimizationApplied: contentResult.metadata?.optimized || false,
          qualityScore: contentResult.metadata?.qualityScore
        }
      };

    } catch (error: any) {
      console.error('❌ POSTING_MANAGER: Intelligent post failed:', error.message);
      
      // Increment failure counter
      this.consecutiveFailures++;
      
      // Implement exponential backoff for failures
      if (this.consecutiveFailures >= 3) {
        const backoffMinutes = Math.min(this.consecutiveFailures * 5, 60); // Max 1 hour
        this.emergencyStopUntil = Date.now() + (backoffMinutes * 60 * 1000);
        console.log(`🚨 EMERGENCY_STOP: Too many failures (${this.consecutiveFailures}), stopping for ${backoffMinutes} minutes`);
      }

      return {
        success: false,
        error: error.message,
        metadata: {
          processingTime: Date.now() - startTime,
          optimizationApplied: false
        }
      };

    } finally {
      this.isPosting = false;
    }
  }

  /**
   * 🧠 INTELLIGENT POSTING DECISION: Based on follower growth learning
   */
  private async canAttemptPost(): Promise<{ allowed: boolean; reason?: string; strategy?: any }> {
    // Check if already posting
    if (this.isPosting) {
      return { allowed: false, reason: 'Already posting' };
    }

    // Check emergency stop
    if (Date.now() < this.emergencyStopUntil) {
      const remainingMinutes = Math.ceil((this.emergencyStopUntil - Date.now()) / 60000);
      return { 
        allowed: false, 
        reason: `Emergency stop active for ${remainingMinutes} more minutes` 
      };
    }

    // 🧠 USE ADAPTIVE GROWTH ENGINE for intelligent decisions
    if (this.adaptiveGrowthEngine) {
      try {
        const decision = await this.adaptiveGrowthEngine.getOptimalPostingDecision();
        
        console.log(`🧠 GROWTH_DECISION: Post=${decision.shouldPost}, Reply=${decision.shouldReply}, Urgency=${decision.urgency}`);
        console.log(`📊 STRATEGY: ${decision.currentStrategy.optimalPostsPerDay} posts/day, ${decision.currentStrategy.optimalRepliesPerDay} replies/day`);
        console.log(`🎯 EXPECTED: +${decision.currentStrategy.expectedDailyFollowerGain} followers/day`);
        
        if (!decision.shouldPost) {
          return { 
            allowed: false, 
            reason: `Growth engine: ${decision.reason}`,
            strategy: decision.currentStrategy
          };
        }

        return { 
          allowed: true,
          reason: `Growth optimized: ${decision.reason}`,
          strategy: decision.currentStrategy
        };
      } catch (error: any) {
        console.warn('⚠️ ADAPTIVE_GROWTH: Decision failed, using fallback:', error.message);
      }
    }

    // FALLBACK: Smart interval calculation if adaptive engine fails
    const timeSinceLastPost = Date.now() - this.lastPostAttempt;
    const minimumInterval = 5 * 60 * 1000; // 5 minutes (more conservative)
    
    if (timeSinceLastPost < minimumInterval) {
      const remainingSeconds = Math.ceil((minimumInterval - timeSinceLastPost) / 1000);
      return { 
        allowed: false, 
        reason: `Fallback timing: ${remainingSeconds}s remaining (learning system offline)` 
      };
    }

    return { allowed: true, reason: 'Fallback timing allows posting' };
  }

  /**
   * 🎨 Generate optimized content
   */
  private async generateOptimizedContent(options: PostingOptions): Promise<any> {
    console.log('🎨 POSTING_MANAGER: Generating optimized content with Master AI');
    
    try {
      // 🧠 Try Master AI first for ultimate intelligence
      const masterContent = await this.generateUltimateAiContent(options.topic);
      
      // Convert to expected format
      if (masterContent.isThread) {
        // Convert thread content to array format
        const threadParts = masterContent.content.split(/\d+\//).filter(part => part.trim());
        return {
          content: threadParts,
          type: 'thread',
          topic: options.topic || 'AI-optimized content',
          metadata: masterContent.metadata
        };
      } else {
        return {
          content: masterContent.content,
          type: 'single',
          topic: options.topic || 'AI-optimized content',
          metadata: masterContent.metadata
        };
      }

    } catch (masterAiError: any) {
      console.warn('⚠️ Master AI unavailable, using ContentGenerator fallback:', masterAiError.message);
      
      // Fallback to existing content generator
      const { ContentGenerator } = await import('./contentGenerator');
      const generator = ContentGenerator.getInstance();
      
      const contentOptions = {
        brandNotes: "",
        diverseSeeds: undefined,
        recentPosts: [],
        aggressiveDecision: options.opportunity
      };
      
      return await generator.generateContent(contentOptions);
    }
  }

  /**
   * 📤 Execute actual posting operation with unified posting manager
   */
  private async executeActualPosting(contentResult: any): Promise<{ tweetId: string }> {
    console.log(`📤 POSTING_MANAGER: Executing ${contentResult.type} posting with unified system`);
    
    try {
      // Use unified posting manager for all operations
      const { getUnifiedPostingManager } = await import('../../posting/unifiedPostingManager');
      const unifiedPoster = getUnifiedPostingManager();
      
      const content = contentResult.type === 'thread' ? contentResult.content : contentResult.content;
      const result = await unifiedPoster.post(content, {
        topic: contentResult.topic,
        verificationRequired: true,
        retryAttempts: 3
      });
      
      if (result.success) {
        console.log(`✅ UNIFIED_POSTING: Posted successfully via ${result.method} method: ${result.tweetId}`);
        return { tweetId: result.tweetId || 'unified_post_success' };
      } else {
        throw new Error(`Unified posting failed: ${result.error}`);
      }
      
    } catch (error: any) {
      console.error('❌ Unified posting failed, using legacy fallback:', error.message);
      
      // Legacy fallback
      if (contentResult.type === 'thread') {
        return await this.postThread(contentResult);
      } else {
        return await this.postSingle(contentResult);
      }
    }
  }

  /**
   * 📝 Post single tweet using simplified approach
   */
  private async postSingle(contentResult: any): Promise<{ tweetId: string }> {
    try {
      console.log('📝 Posting content via simplified posting:', `"${contentResult.content.substring(0, 100)}..."`);
      
      // Use the postSingleTweet function from postThread module
      const { postSingleTweet } = await import('../../posting/postThread');
      
      const result = await postSingleTweet(contentResult.content);
      
      if (result.success && result.tweetId) {
        console.log(`✅ Posted successfully: ${result.tweetId}`);
        return { tweetId: result.tweetId };
      } else {
        throw new Error(`Posting failed: ${result.error}`);
      }
      
    } catch (error: any) {
      console.error('❌ Posting failed:', error.message);
      throw new Error(`Single tweet posting failed: ${error.message}`);
    }
  }

  /**
   * 🧵 Post thread content using NATIVE thread composer (ACTUALLY WORKS)
   */
  private async postThread(contentResult: any): Promise<{ tweetId: string }> {
    try {
      console.log('🧵 POSTING_MANAGER: Using NATIVE thread composer (reply-based was broken)');
      console.log(`📝 Thread content: ${contentResult.content?.length || 0} tweets`);
      
      // CRITICAL DEBUG: Log the actual data being received
      console.log('🔍 DEBUG_THREAD_DATA:', {
        contentType: typeof contentResult.content,
        isArray: Array.isArray(contentResult.content),
        contentLength: contentResult.content?.length,
        hasContentTweets: !!contentResult.tweets,
        tweetsLength: contentResult.tweets?.length,
        contentFirstFew: contentResult.content?.slice ? contentResult.content.slice(0, 2) : contentResult.content,
        fullStructure: Object.keys(contentResult)
      });
      
      // Import and use the NEW native thread composer
      const { NativeThreadComposer } = await import('../../posting/nativeThreadComposer');
      const composer = NativeThreadComposer.getInstance();
      
      // Extract thread data from content result
      let tweets = [];
      let topic = 'Health & Science Thread';
      
      if (Array.isArray(contentResult.content)) {
        tweets = contentResult.content;
        console.log(`✅ THREAD_EXTRACTED: Using contentResult.content array (${tweets.length} tweets)`);
      } else if (contentResult.tweets) {
        tweets = contentResult.tweets;
        console.log(`✅ THREAD_EXTRACTED: Using contentResult.tweets array (${tweets.length} tweets)`);
      } else {
        // CRITICAL ERROR: This should not happen for threads
        console.error('🚨 THREAD_CRITICAL_ERROR: No tweet array found!');
        console.error('🚨 contentResult.content:', contentResult.content);
        console.error('🚨 contentResult.tweets:', contentResult.tweets);
        console.error('🚨 contentResult type:', contentResult.type);
        console.error('🚨 Full contentResult:', JSON.stringify(contentResult, null, 2));
        
        // Fallback: treat as single tweet for now, but this shouldn't happen
        console.warn('⚠️ THREAD_WARNING: Expected array of tweets but got single content');
        tweets = [contentResult.content];
      }
      
      if (contentResult.topic) {
        topic = contentResult.topic;
      }
      
      console.log(`🧵 CRITICAL_CHECK: About to post ${tweets.length} tweet thread using NATIVE composer`);
      console.log(`🧵 TWEETS_PREVIEW:`, tweets.map((t, i) => `${i+1}: "${t.substring(0, 50)}..."`));
      
      // CRITICAL: Ensure we have multiple tweets
      if (tweets.length === 1) {
        console.error('🚨 THREAD_ABORT: Only 1 tweet detected - this will be posted as single, not thread!');
        console.error('🚨 Something corrupted the thread array between generation and posting');
        throw new Error('Thread corrupted: Expected multiple tweets but got single tweet');
      }
      
      // Post using NATIVE thread composer (should actually work)
      console.log('🚀 NATIVE_THREAD: Using Twitter\'s native thread creation instead of broken replies');
      const result = await composer.postNativeThread(tweets, topic);
      
      if (result.success && result.rootTweetId) {
        console.log(`✅ NATIVE_THREAD_SUCCESS: Root tweet ${result.rootTweetId} with ${result.replyIds?.length || 0} replies`);
        console.log('🎯 NATIVE_THREAD: This should actually create a real thread on Twitter!');
        return { tweetId: result.rootTweetId };
      } else {
        throw new Error(`Native thread posting failed: ${result.error}`);
      }
      
    } catch (error: any) {
      console.error('❌ NATIVE_THREAD_POSTING_FAILED:', error.message);
      throw new Error(`Native thread posting failed: ${error.message}`);
    }
  }

  /**
   * 💾 Store posting results and metrics
   */
  private async storePostingResults(postResult: any, contentResult: any): Promise<void> {
    try {
      console.log('💾 POSTING_MANAGER: Storing posting results');
      
      // Import content storage fix
      const { storeActualPostedContent } = await import('../../lib/contentStorageFix');
      
      // Store the actual content with comprehensive data
      await storeActualPostedContent({
        tweet_id: postResult.tweetId,
        actual_content: contentResult.content,
        content_type: contentResult.type,
        character_count: contentResult.content.length,
        posted_at: new Date().toISOString(),
        quality_score: contentResult.metadata?.qualityScore || 75
      });

      console.log('✅ POSTING_MANAGER: Results stored successfully');
      
    } catch (error: any) {
      console.warn('⚠️ POSTING_MANAGER: Failed to store results (non-critical):', error.message);
    }
  }

  /**
   * 📊 Get posting statistics with growth strategy
   */
  public async getStatistics(): Promise<{
    isPosting: boolean;
    lastPostAttempt: number;
    consecutiveFailures: number;
    emergencyStopUntil: number;
    canPost: boolean;
    currentStrategy?: any;
  }> {
    const canPost = await this.canAttemptPost();
    
    return {
      isPosting: this.isPosting,
      lastPostAttempt: this.lastPostAttempt,
      consecutiveFailures: this.consecutiveFailures,
      emergencyStopUntil: this.emergencyStopUntil,
      canPost: canPost.allowed,
      currentStrategy: canPost.strategy
    };
  }

  /**
   * 🔄 Reset posting state (for emergency recovery)
   */
  public resetState(): void {
    this.isPosting = false;
    this.consecutiveFailures = 0;
    this.emergencyStopUntil = 0;
    console.log('🔄 POSTING_MANAGER: State reset successfully');
  }

  /**
   * 🧪 Test posting system without actually posting
   */
  public async testPosting(options: PostingOptions = {}): Promise<PostingResult> {
    console.log('🧪 POSTING_MANAGER: Running test posting (no actual posting)');
    
    const testOptions = { ...options, testMode: true };
    
    try {
      // Generate content without posting
      const contentResult = await this.generateOptimizedContent(testOptions);
      
      return {
        success: true,
        content: contentResult.content,
        type: contentResult.type,
        metadata: {
          processingTime: 0,
          optimizationApplied: contentResult.metadata?.optimized || false,
          qualityScore: contentResult.metadata?.qualityScore
        }
      };
      
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        metadata: {
          processingTime: 0,
          optimizationApplied: false
        }
      };
    }
  }
}
