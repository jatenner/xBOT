/**
 * 🚀 ELITE POSTING MANAGER
 * Simplified integration of enhanced AI with learning
 * 
 * Replaces complex posting flow with streamlined elite system
 */

import { getEnhancedPostingOrchestrator } from './enhancedPostingOrchestrator';
import { getUnifiedDataManager } from '../lib/unifiedDataManager';
import { getOutcomeTracker } from '../lib/outcomeTracker';

export class ElitePostingManager {
  private static instance: ElitePostingManager;
  private orchestrator = getEnhancedPostingOrchestrator();
  private dataManager = getUnifiedDataManager();
  private outcomeTracker = getOutcomeTracker();

  private constructor() {}

  public static getInstance(): ElitePostingManager {
    if (!ElitePostingManager.instance) {
      ElitePostingManager.instance = new ElitePostingManager();
    }
    return ElitePostingManager.instance;
  }

  /**
   * 🎯 CREATE AND POST ELITE CONTENT
   * Single method that handles everything
   */
  public async createAndPost(): Promise<{ success: boolean; tweetId?: string; metrics?: any }> {
    console.log('🎯 ELITE_POSTING: Creating and posting elite content...');

    try {
      // Step 1: Create elite tweet with full AI power
      const eliteResult = await this.orchestrator.createEliteTweet({
        urgency: 'high',
        audience_analysis: {},
        recent_performance: {},
        learning_insights: {}
      });

      console.log('✅ ELITE_CONTENT created:');
      console.log(`📝 Content: "${eliteResult.content.substring(0, 100)}..."`);
      console.log(`📊 Quality Score: ${eliteResult.quality_score.toFixed(2)}`);
      console.log(`🔥 Viral Probability: ${(eliteResult.viral_probability * 100).toFixed(1)}%`);
      console.log(`🎯 Learning Applied: ${eliteResult.learning_applied.join(', ')}`);

      // Step 2: Post the content
      const postResult = await this.postContent(eliteResult.content);

      if (postResult.success && postResult.tweetId) {
        // Step 3: Store with full metrics
        await this.storeElitePost(postResult.tweetId, eliteResult);

        // Step 4: Track outcome for learning
        await this.outcomeTracker.recordPostingOutcome(
          Date.now(), // Simple decision ID
          postResult.tweetId,
          Math.round(eliteResult.predicted_engagement * 10)
        );

        console.log(`🚀 ELITE_POST_SUCCESS: ${postResult.tweetId}`);
        
        return {
          success: true,
          tweetId: postResult.tweetId,
          metrics: {
            quality_score: eliteResult.quality_score,
            viral_probability: eliteResult.viral_probability,
            predicted_engagement: eliteResult.predicted_engagement
          }
        };
      } else {
        throw new Error('Posting failed');
      }

    } catch (error: any) {
      console.error('❌ ELITE_POSTING failed:', error.message);
      return { success: false };
    }
  }

  /**
   * 📤 POST CONTENT
   * Use existing posting infrastructure
   */
  private async postContent(content: string): Promise<{ success: boolean; tweetId?: string }> {
    try {
      // Use unified posting manager
      const { getUnifiedPostingManager } = await import('../posting/unifiedPostingManager');
      const unifiedPoster = getUnifiedPostingManager();
      
      const result = await unifiedPoster.post(content, {
        topic: 'health_optimization',
        verificationRequired: true,
        retryAttempts: 3
      });

      return {
        success: result.success,
        tweetId: result.tweetId
      };

    } catch (error: any) {
      console.error('❌ Content posting failed:', error.message);
      return { success: false };
    }
  }

  /**
   * 💾 STORE ELITE POST
   * Store with all elite metrics and learning data
   */
  private async storeElitePost(tweetId: string, eliteResult: any): Promise<void> {
    try {
      await this.dataManager.storePost({
        postId: tweetId,
        content: eliteResult.content,
        postType: 'single',
        contentLength: eliteResult.content.length,
        postedAt: new Date(),
        hourPosted: new Date().getHours(),
        minutePosted: new Date().getMinutes(),
        dayOfWeek: new Date().getDay(),
        likes: 0,
        retweets: 0,
        replies: 0,
        impressions: 0,
        profileClicks: 0,
        linkClicks: 0,
        bookmarks: 0,
        shares: 0,
        followersBefore: 23, // Will be updated by metrics scraper
        followersAttributed: 0,
        aiGenerated: true,
        aiStrategy: 'enhanced_orchestrator',
        aiConfidence: eliteResult.quality_score,
        viralScore: eliteResult.viral_probability
      });

      console.log('✅ ELITE_POST stored with full metrics');

    } catch (error: any) {
      console.error('❌ Elite post storage failed:', error.message);
      // Don't throw - posting was successful
    }
  }

  /**
   * 💬 CREATE SMART REPLY
   * Elite reply generation
   */
  public async createSmartReply(
    originalTweet: string,
    context: string = 'health optimization discussion'
  ): Promise<{ success: boolean; reply?: string; strategy?: string }> {
    console.log('💬 ELITE_POSTING: Creating smart reply...');

    try {
      const replyResult = await this.orchestrator.createSmartReply(
        originalTweet,
        context,
        'educate'
      );

      console.log('✅ SMART_REPLY created:');
      console.log(`📝 Reply: "${replyResult.reply}"`);
      console.log(`🎯 Strategy: ${replyResult.strategy}`);

      return {
        success: true,
        reply: replyResult.reply,
        strategy: replyResult.strategy
      };

    } catch (error: any) {
      console.error('❌ Smart reply creation failed:', error.message);
      return { success: false };
    }
  }

  /**
   * 📊 GET PERFORMANCE SUMMARY
   */
  public async getPerformanceSummary(): Promise<{
    total_posts: number;
    avg_quality_score: number;
    learning_insights: number;
    system_health: string;
  }> {
    try {
      const dataStatus = await this.dataManager.getDataStatus();
      const posts = await this.dataManager.getPostPerformance(7);
      
      const avgQuality = posts.length > 0 
        ? posts.reduce((sum, p) => sum + (p.viralScore || 0.5), 0) / posts.length
        : 0.5;

      return {
        total_posts: dataStatus.totalPosts,
        avg_quality_score: avgQuality,
        learning_insights: dataStatus.totalDecisions,
        system_health: dataStatus.systemHealth
      };

    } catch (error: any) {
      console.error('❌ Performance summary failed:', error.message);
      return {
        total_posts: 0,
        avg_quality_score: 0.5,
        learning_insights: 0,
        system_health: 'unknown'
      };
    }
  }
}

export const getElitePostingManager = () => ElitePostingManager.getInstance();
