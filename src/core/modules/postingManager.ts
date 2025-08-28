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
  };
}

export class PostingManager {
  private static instance: PostingManager;
  private isPosting = false;
  private lastPostAttempt = 0;
  private consecutiveFailures = 0;
  private emergencyStopUntil = 0;
  private performanceOptimizer: PerformanceOptimizer;

  private constructor() {
    this.performanceOptimizer = PerformanceOptimizer.getInstance();
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
      // Check if we can post
      const canPost = this.canAttemptPost();
      if (!canPost.allowed) {
        return {
          success: false,
          error: canPost.reason,
          metadata: {
            processingTime: Date.now() - startTime,
            optimizationApplied: false
          }
        };
      }

      // Mark as posting
      this.isPosting = true;
      this.lastPostAttempt = Date.now();

      console.log('🚀 POSTING_MANAGER: Starting intelligent post execution');

      // Generate content with performance monitoring
      const contentResult = await this.performanceOptimizer.measureExecution(
        () => this.generateOptimizedContent(options),
        'openai',
        'Content Generation'
      );

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
   * 🔍 Check if posting is allowed
   */
  private canAttemptPost(): { allowed: boolean; reason?: string } {
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

    // PROFESSIONAL TIMING: Variable intervals like a real influencer
    const timeSinceLastPost = Date.now() - this.lastPostAttempt;
    
    // Smart interval calculation (3-8 minutes, weighted toward 5-6 minutes)
    const baseInterval = 5 * 60 * 1000; // 5 minutes base
    const randomVariation = (Math.random() * 3 - 1.5) * 60 * 1000; // ±1.5 minutes
    const minimumInterval = Math.max(3 * 60 * 1000, baseInterval + randomVariation); // 3-8 minutes

    if (timeSinceLastPost < minimumInterval) {
      const remainingSeconds = Math.ceil((minimumInterval - timeSinceLastPost) / 1000);
      return { 
        allowed: false, 
        reason: `Professional posting interval: ${remainingSeconds}s remaining (natural pacing)` 
      };
    }

    return { allowed: true };
  }

  /**
   * 🎨 Generate optimized content
   */
  private async generateOptimizedContent(options: PostingOptions): Promise<any> {
    console.log('🎨 POSTING_MANAGER: Generating optimized content');
    
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

  /**
   * 📤 Execute actual posting operation
   */
  private async executeActualPosting(contentResult: any): Promise<{ tweetId: string }> {
    console.log(`📤 POSTING_MANAGER: Executing ${contentResult.type} posting`);
    
    if (contentResult.type === 'thread') {
      return await this.postThread(contentResult);
    } else {
      return await this.postSingle(contentResult);
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
   * 📊 Get posting statistics
   */
  public getStatistics(): {
    isPosting: boolean;
    lastPostAttempt: number;
    consecutiveFailures: number;
    emergencyStopUntil: number;
    canPost: boolean;
  } {
    const canPost = this.canAttemptPost();
    
    return {
      isPosting: this.isPosting,
      lastPostAttempt: this.lastPostAttempt,
      consecutiveFailures: this.consecutiveFailures,
      emergencyStopUntil: this.emergencyStopUntil,
      canPost: canPost.allowed
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
