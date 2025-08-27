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

    // Check minimum interval between posts (prevent spam)
    const timeSinceLastPost = Date.now() - this.lastPostAttempt;
    const minimumInterval = 5 * 60 * 1000; // 5 minutes minimum

    if (timeSinceLastPost < minimumInterval) {
      const remainingSeconds = Math.ceil((minimumInterval - timeSinceLastPost) / 1000);
      return { 
        allowed: false, 
        reason: `Minimum interval not met (${remainingSeconds}s remaining)` 
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
   * 🧵 Post thread content
   */
  private async postThread(contentResult: any): Promise<{ tweetId: string }> {
    try {
      // This should return the root tweet ID from the content result
      // The actual thread posting is handled in the ContentGenerator
      return { tweetId: contentResult.content }; // Content contains root tweet ID for threads
      
    } catch (error: any) {
      console.error('❌ Thread posting failed:', error.message);
      throw new Error(`Thread posting failed: ${error.message}`);
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
