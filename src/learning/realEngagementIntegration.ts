/**
 * REAL ENGAGEMENT INTEGRATION
 * 
 * Bridges the gap between posting tweets and actually tracking their engagement.
 * This system was missing - posts were recorded with 0 engagement and never updated!
 */

import { AggressiveLearningEngine } from './aggressiveLearningEngine';
import { TweetMetricsTracker } from '../metrics/trackTweet';
import { MetricsScraper } from '../metrics/scraper';

interface PostEngagementUpdate {
  post_id: string;
  likes: number;
  retweets: number;
  replies: number;
  impressions: number;
  followers_gained: number;
}

export class RealEngagementIntegration {
  private static instance: RealEngagementIntegration;
  private trackingQueue: Map<string, Date> = new Map();
  private learningEngine: AggressiveLearningEngine;
  private metricsTracker: TweetMetricsTracker;
  private metricsScraper: MetricsScraper;

  private constructor() {
    this.learningEngine = AggressiveLearningEngine.getInstance();
    this.metricsTracker = TweetMetricsTracker.getInstance();
    this.metricsScraper = MetricsScraper.getInstance();
  }

  public static getInstance(): RealEngagementIntegration {
    if (!RealEngagementIntegration.instance) {
      RealEngagementIntegration.instance = new RealEngagementIntegration();
    }
    return RealEngagementIntegration.instance;
  }

  /**
   * Start tracking a newly posted tweet
   */
  public async startTracking(tweetId: string): Promise<void> {
    console.log(`🔍 ENGAGEMENT_INTEGRATION: Starting real engagement tracking for ${tweetId}`);
    
    // Add to tracking queue
    this.trackingQueue.set(tweetId, new Date());
    
    // Schedule multiple engagement checks
    this.scheduleEngagementChecks(tweetId);
  }

  /**
   * Schedule engagement checks at strategic intervals
   */
  private scheduleEngagementChecks(tweetId: string): void {
    // Check after 10 minutes (early engagement)
    setTimeout(() => this.updateEngagementData(tweetId, 'early'), 10 * 60 * 1000);
    
    // Check after 1 hour (prime engagement window)
    setTimeout(() => this.updateEngagementData(tweetId, 'prime'), 60 * 60 * 1000);
    
    // Check after 6 hours (extended engagement)
    setTimeout(() => this.updateEngagementData(tweetId, 'extended'), 6 * 60 * 60 * 1000);
    
    // Final check after 24 hours
    setTimeout(() => this.updateEngagementData(tweetId, 'final'), 24 * 60 * 60 * 1000);
  }

  /**
   * Update engagement data for a specific tweet
   */
  private async updateEngagementData(tweetId: string, phase: string): Promise<void> {
    try {
      console.log(`📊 ENGAGEMENT_UPDATE: Checking ${phase} engagement for ${tweetId}`);
      
      // Use the robust tweet metrics tracker
      const result = await this.metricsTracker.trackTweet(tweetId);
      
      if (result.success && result.metrics) {
        const metrics = result.metrics;
        
        // Get current follower count to calculate growth
        const followerGrowth = await this.estimateFollowerGrowth(metrics);
        
        // Update the learning engine with REAL data
        await this.updateLearningEngine(tweetId, {
          post_id: tweetId,
          likes: metrics.likes,
          retweets: metrics.retweets,
          replies: metrics.replies,
          impressions: metrics.impressions,
          followers_gained: followerGrowth
        });

        console.log(`✅ ENGAGEMENT_UPDATED: ${tweetId} - ${metrics.likes}❤️ ${metrics.retweets}🔄 ${metrics.replies}💬 ${metrics.impressions}👁️ +${followerGrowth}👥`);
        
        // Remove from queue on final check
        if (phase === 'final') {
          this.trackingQueue.delete(tweetId);
        }
        
      } else {
        console.log(`⚠️ ENGAGEMENT_UPDATE_FAILED: Could not get metrics for ${tweetId} (${phase} check)`);
      }
      
    } catch (error: any) {
      console.error(`❌ ENGAGEMENT_UPDATE_ERROR: ${tweetId} (${phase}):`, error.message);
    }
  }

  /**
   * Estimate follower growth based on engagement patterns
   */
  private async estimateFollowerGrowth(metrics: any): Promise<number> {
    // Simple heuristic: high engagement usually correlates with follower growth
    const totalEngagement = metrics.likes + metrics.retweets + metrics.replies;
    const engagementRate = metrics.impressions > 0 ? totalEngagement / metrics.impressions : 0;
    
    // Estimate follower growth based on engagement
    // Health content typically converts at 0.5-2% of total engagement to followers
    const estimatedFollowerGrowth = Math.round(totalEngagement * 0.01); // 1% conversion rate
    
    return Math.max(0, estimatedFollowerGrowth);
  }

  /**
   * Update the learning engine with real engagement data
   */
  private async updateLearningEngine(tweetId: string, update: PostEngagementUpdate): Promise<void> {
    try {
      // Find the post in the learning engine's history
      const postHistory = this.learningEngine.getPostHistory();
      const postIndex = postHistory.findIndex(post => post.post_id === tweetId);
      
      if (postIndex !== -1) {
        // Update the existing post data
        const existingPost = postHistory[postIndex];
        
        // Calculate new derived metrics
        const totalEngagement = update.likes + update.retweets + update.replies;
        const engagementRate = update.impressions > 0 ? totalEngagement / update.impressions : 0;
        const followerConversionRate = update.impressions > 0 ? update.followers_gained / update.impressions : 0;
        
        // Update the post with real data
        postHistory[postIndex] = {
          ...existingPost,
          likes: update.likes,
          retweets: update.retweets,
          replies: update.replies,
          impressions: update.impressions,
          followers_gained: update.followers_gained,
          engagement_rate: engagementRate,
          follower_conversion_rate: followerConversionRate,
          actual_engagement: totalEngagement
        };
        
        console.log(`📈 LEARNING_ENGINE_UPDATED: ${tweetId} with real engagement data`);
        console.log(`   📊 Engagement: ${update.likes}❤️ ${update.retweets}🔄 ${update.replies}💬`);
        console.log(`   📈 Rate: ${(engagementRate * 100).toFixed(2)}% | Followers: +${update.followers_gained}`);
        
        // 🎯 AI LEARNING INTEGRATION: Future bandit integration point
        console.log(`🤖 AI_LEARNING: Post performance data ready for ML optimization`);
        console.log(`   📈 Engagement rate: ${(engagementRate * 100).toFixed(2)}%`);
        console.log(`   👥 Follower conversion: ${(followerConversionRate * 100).toFixed(3)}%`);
        
        // Trigger insights update with real data
        this.learningEngine.updateLearningInsights();
        
      } else {
        console.log(`⚠️ LEARNING_ENGINE_UPDATE: Post ${tweetId} not found in learning history`);
      }
      
    } catch (error: any) {
      console.error(`❌ LEARNING_ENGINE_UPDATE_ERROR: ${tweetId}:`, error.message);
    }
  }

  /**
   * Get the current tracking queue status
   */
  public getTrackingStatus(): { active: number; queue: string[] } {
    return {
      active: this.trackingQueue.size,
      queue: Array.from(this.trackingQueue.keys())
    };
  }

  /**
   * Force update all tweets in tracking queue
   */
  public async forceUpdateAll(): Promise<void> {
    console.log(`🔄 FORCE_UPDATE: Updating ${this.trackingQueue.size} tweets in tracking queue`);
    
    for (const [tweetId] of this.trackingQueue) {
      await this.updateEngagementData(tweetId, 'forced');
    }
  }

  /**
   * Add method to access post history for debugging
   */
  public getPostHistory() {
    return this.learningEngine.getPostHistory();
  }
}
