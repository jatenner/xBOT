/**
 * THREAD POSTING ENGINE - For sophisticated multi-tweet posts
 * 
 * This creates engaging thread posts with depth and substance
 */

import { TwitterPoster } from './postThread';
import { SophisticatedContentEngine } from '../content/sophisticatedContentEngine';
import { logInfo, logError } from '../utils/intelligentLogging';

export interface ThreadResult {
  success: boolean;
  rootTweetId?: string;
  threadTweetIds?: string[];
  totalTweets?: number;
  error?: string;
  engagementPrediction?: number;
}

export class ThreadPostingEngine {
  private static instance: ThreadPostingEngine;
  private contentEngine: SophisticatedContentEngine;
  private poster: TwitterPoster;

  private constructor() {
    this.contentEngine = SophisticatedContentEngine.getInstance();
    this.poster = new TwitterPoster();
  }

  public static getInstance(): ThreadPostingEngine {
    if (!ThreadPostingEngine.instance) {
      ThreadPostingEngine.instance = new ThreadPostingEngine();
    }
    return ThreadPostingEngine.instance;
  }

  /**
   * Create a sophisticated thread post
   */
  public async createSophisticatedThread(topic: string): Promise<ThreadResult> {
    try {
      logInfo('THREAD_ENGINE', `Creating sophisticated thread about: ${topic}`);

      // Generate unique, sophisticated content
      const threadContent = await this.contentEngine.generateThreadContent(topic);
      
      logInfo('THREAD_ENGINE', `Generated thread with ${threadContent.totalDepth} tweets`);
      
      // Validate thread quality
      if (threadContent.threadTweets.length < 2) {
        return {
          success: false,
          error: 'Thread too short - needs at least 3 tweets for depth'
        };
      }

      // Post the thread
      const threadResult = await this.postThread(threadContent.hookTweet, threadContent.threadTweets);
      
      if (threadResult.success) {
        logInfo('THREAD_ENGINE', `✅ Thread posted successfully: ${threadResult.rootTweetId}`);
        
        return {
          success: true,
          rootTweetId: threadResult.rootTweetId,
          threadTweetIds: threadResult.replyIds,
          totalTweets: threadContent.totalDepth,
          engagementPrediction: this.predictThreadEngagement(threadContent)
        };
      } else {
        return {
          success: false,
          error: threadResult.error || 'Failed to post thread'
        };
      }

    } catch (error: any) {
      logError('THREAD_ENGINE', `Failed to create thread: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Post a thread using the existing TwitterPoster
   */
  private async postThread(hookTweet: string, threadTweets: string[]): Promise<{
    success: boolean;
    rootTweetId?: string;
    replyIds?: string[];
    error?: string;
  }> {
    try {
      // Prepare tweets array for thread posting
      const allTweets = [hookTweet, ...threadTweets];
      
      logInfo('THREAD_ENGINE', `Posting thread with ${allTweets.length} tweets`);
      
      // Use the existing postThread method
      const result = await this.poster.postThread(allTweets);
      
      return result;

    } catch (error: any) {
      logError('THREAD_ENGINE', `Thread posting failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Predict thread engagement based on content quality
   */
  private predictThreadEngagement(threadContent: {
    hookTweet: string;
    threadTweets: string[];
    totalDepth: number;
  }): number {
    let score = 50; // Base score

    // Thread length bonus
    if (threadContent.totalDepth >= 4) score += 15;
    if (threadContent.totalDepth >= 6) score += 10;

    // Hook quality analysis
    const hook = threadContent.hookTweet.toLowerCase();
    if (hook.includes('🧵') || hook.includes('thread')) score += 10;
    if (hook.includes('unpopular') || hook.includes('controversial')) score += 15;
    if (hook.includes('data') || hook.includes('study') || hook.includes('research')) score += 12;
    if (hook.includes('nobody talks about') || hook.includes('secret')) score += 8;

    // Content depth analysis
    const allContent = [threadContent.hookTweet, ...threadContent.threadTweets].join(' ').toLowerCase();
    if (allContent.includes('because') || allContent.includes('why') || allContent.includes('how')) score += 8;
    if (allContent.includes('%') || allContent.includes('study') || allContent.includes('research')) score += 10;
    if (allContent.includes('step') || allContent.includes('practical') || allContent.includes('actionable')) score += 7;

    // Ensure reasonable bounds
    return Math.min(95, Math.max(30, score));
  }

  /**
   * Create a single sophisticated tweet (fallback)
   */
  public async createSophisticatedSingle(topic: string): Promise<ThreadResult> {
    try {
      logInfo('THREAD_ENGINE', `Creating sophisticated single tweet about: ${topic}`);

      // Generate unique content
      const variation = await this.contentEngine.generateUniqueContent(topic);
      
      // Create a sophisticated single tweet
      const tweetContent = this.buildSophisticatedTweet(variation);
      
      // Post the single tweet
      const result = await this.poster.postSingleTweet(tweetContent);
      
      if (result.success) {
        return {
          success: true,
          rootTweetId: result.tweetId,
          totalTweets: 1,
          engagementPrediction: variation.uniqueness_score * 100
        };
      } else {
        return {
          success: false,
          error: result.error || 'Failed to post tweet'
        };
      }

    } catch (error: any) {
      logError('THREAD_ENGINE', `Failed to create sophisticated single: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Build sophisticated single tweet from variation
   */
  private buildSophisticatedTweet(variation: any): string {
    const hooks = variation.hooks || ['Interesting insight:'];
    const hook = hooks[Math.floor(Math.random() * hooks.length)];
    
    // Create sophisticated content based on angle and depth
    const templates = {
      'meta_analysis': `${hook} After analyzing hundreds of studies on ${variation.topic}, the evidence points to one clear conclusion: [specific insight]. Most advice completely misses this.`,
      'contrarian_take': `${hook} Everyone tells you to [common advice about ${variation.topic}]. I spent 6 months testing the opposite approach. The results will surprise you.`,
      'first_principles': `${hook} Let's break down ${variation.topic} from first principles. When you understand the core mechanism, everything becomes obvious.`,
      'behavioral_psychology': `${hook} The psychology behind ${variation.topic} is fascinating. Your brain is wired to do exactly the wrong thing here.`
    };

    const template = templates[variation.angle as keyof typeof templates] || 
      `${hook} Here's what most people don't understand about ${variation.topic}...`;

    return template;
  }

  /**
   * Get posting recommendation
   */
  public getPostingRecommendation(topic: string): {
    shouldUseThread: boolean;
    reason: string;
  } {
    // Topics that work well as threads
    const threadTopics = [
      'productivity', 'optimization', 'strategy', 'analysis', 'breakdown',
      'system', 'framework', 'methodology', 'research', 'study'
    ];

    const shouldUseThread = threadTopics.some(threadTopic => 
      topic.toLowerCase().includes(threadTopic)
    );

    return {
      shouldUseThread,
      reason: shouldUseThread 
        ? 'Topic has depth potential - recommend thread format'
        : 'Topic better suited for single impactful tweet'
    };
  }
}
