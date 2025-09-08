/**
 * Posting Router for xBOT
 * Routes content to appropriate posting methods (single vs thread)
 */

import { simplifiedPoster as BulletproofPoster } from './simplifiedBulletproofPoster';
import { ContentScores } from '../ai/content/scoring';

export interface PostingPayload {
  content: string;
  tweets?: string[];
  format: 'single' | 'thread';
  scores: ContentScores;
  topic: string;
  metadata?: {
    strategy: any;
    contentType: string;
    pillar: string;
  };
}

export interface PostingResult {
  success: boolean;
  tweetIds: string[];
  error?: string;
  postedContent: string[];
  postingMethod: 'single' | 'thread';
  metadata: {
    totalTweets: number;
    timeToPost: number;
    retryCount: number;
  };
}

export class PostingRouter {
  private poster: BulletproofPoster;

  constructor() {
    this.poster = new BulletproofPoster();
  }

  /**
   * Route content to appropriate posting method
   */
  async routePost(payload: PostingPayload): Promise<PostingResult> {
    console.log(`📤 POSTING_ROUTER: Routing ${payload.format} content for topic "${payload.topic}"`);
    
    const startTime = Date.now();
    
    try {
      // Validate payload
      this.validatePayload(payload);
      
      // Route based on format
      let result: PostingResult;
      
      if (payload.format === 'thread') {
        result = await this.routeThread(payload);
      } else {
        result = await this.routeSingle(payload);
      }
      
      // Add timing metadata
      result.metadata.timeToPost = Date.now() - startTime;
      
      console.log(`✅ POSTING_COMPLETE: ${result.success ? 'SUCCESS' : 'FAILED'} - ${result.metadata.totalTweets} tweets in ${result.metadata.timeToPost}ms`);
      
      return result;
      
    } catch (error) {
      console.error('❌ POSTING_ROUTER_ERROR:', error);
      
      return {
        success: false,
        tweetIds: [],
        error: error instanceof Error ? error.message : 'Unknown routing error',
        postedContent: [],
        postingMethod: payload.format,
        metadata: {
          totalTweets: 0,
          timeToPost: Date.now() - startTime,
          retryCount: 0
        }
      };
    }
  }

  /**
   * Route thread posting
   */
  private async routeThread(payload: PostingPayload): Promise<PostingResult> {
    if (!payload.tweets || payload.tweets.length === 0) {
      throw new Error('Thread payload missing tweets array');
    }
    
    console.log(`🧵 THREAD_ROUTING: Posting ${payload.tweets.length} tweet thread`);
    
    // Log thread preview
    payload.tweets.forEach((tweet, index) => {
      console.log(`📝 Tweet ${index + 1}/${payload.tweets!.length}: "${tweet.substring(0, 80)}${tweet.length > 80 ? '...' : ''}"`);
    });
    
    const result = await this.poster.postThread(payload.tweets);
    
    return {
      success: result.success,
      tweetIds: result.tweetIds,
      error: result.error,
      postedContent: payload.tweets,
      postingMethod: 'thread',
      metadata: {
        totalTweets: payload.tweets.length,
        timeToPost: 0, // Will be set by router
        retryCount: result.retryCount || 0
      }
    };
  }

  /**
   * Route single tweet posting
   */
  private async routeSingle(payload: PostingPayload): Promise<PostingResult> {
    console.log(`📄 SINGLE_ROUTING: Posting single tweet`);
    console.log(`📝 Content: "${payload.content.substring(0, 120)}${payload.content.length > 120 ? '...' : ''}"`);
    
    const result = await this.poster.postSingle(payload.content);
    
    return {
      success: result.success,
      tweetIds: result.tweetId ? [result.tweetId] : [],
      error: result.error,
      postedContent: [payload.content],
      postingMethod: 'single',
      metadata: {
        totalTweets: 1,
        timeToPost: 0, // Will be set by router
        retryCount: result.retryCount || 0
      }
    };
  }

  /**
   * Validate posting payload
   */
  private validatePayload(payload: PostingPayload): void {
    if (!payload.content && (!payload.tweets || payload.tweets.length === 0)) {
      throw new Error('Payload must have either content or tweets');
    }
    
    if (payload.format === 'thread' && (!payload.tweets || payload.tweets.length < 2)) {
      throw new Error('Thread format requires at least 2 tweets');
    }
    
    if (payload.format === 'single' && !payload.content) {
      throw new Error('Single format requires content string');
    }
    
    if (payload.format === 'thread' && payload.tweets && payload.tweets.length > 5) {
      throw new Error('Thread cannot exceed 5 tweets');
    }
    
    // Validate individual tweet lengths
    if (payload.format === 'thread' && payload.tweets) {
      payload.tweets.forEach((tweet, index) => {
        if (tweet.length > 280) {
          throw new Error(`Tweet ${index + 1} exceeds 280 characters (${tweet.length})`);
        }
      });
    }
    
    if (payload.format === 'single' && payload.content.length > 280) {
      throw new Error(`Single tweet exceeds 280 characters (${payload.content.length})`);
    }
  }

  /**
   * Get posting statistics
   */
  async getPostingStats(): Promise<{
    totalPosts: number;
    successRate: number;
    avgTimeToPost: number;
    threadVsSingle: { threads: number; singles: number };
  }> {
    try {
      const stats = await this.poster.getPostingStats();
      return stats;
    } catch (error) {
      console.warn('⚠️ Could not fetch posting stats');
      return {
        totalPosts: 0,
        successRate: 0,
        avgTimeToPost: 0,
        threadVsSingle: { threads: 0, singles: 0 }
      };
    }
  }

  /**
   * Test posting capabilities without actually posting
   */
  async testPostingCapabilities(): Promise<{
    composerAccessible: boolean;
    sessionValid: boolean;
    errors: string[];
  }> {
    console.log('🧪 POSTING_TEST: Testing posting capabilities...');
    
    try {
      const testResult = await this.poster.testComposerAccess();
      
      console.log(`✅ POSTING_TEST_COMPLETE: Composer ${testResult.composerAccessible ? 'accessible' : 'blocked'}, Session ${testResult.sessionValid ? 'valid' : 'invalid'}`);
      
      return testResult;
    } catch (error) {
      console.error('❌ POSTING_TEST_FAILED:', error);
      return {
        composerAccessible: false,
        sessionValid: false,
        errors: [error instanceof Error ? error.message : 'Test failed']
      };
    }
  }
}

export default PostingRouter;
