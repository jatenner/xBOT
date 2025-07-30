/**
 * 📊 PERFORMANCE TRACKER
 * 
 * Automatically track tweet performance and update learning system
 */

import { learningSystemIntegration } from './learningSystemIntegration';

export class PerformanceTracker {
  
  /**
   * 📈 TRACK TWEET PERFORMANCE
   */
  static async trackTweetPerformance(tweetData: {
    tweet_id: string;
    likes?: number;
    retweets?: number;
    replies?: number;
    impressions?: number;
  }): Promise<void> {
    try {
      console.log(`📊 Tracking performance for tweet: ${tweetData.tweet_id}`);
      
      const success = await learningSystemIntegration.updateTweetPerformance(
        tweetData.tweet_id,
        tweetData.likes || 0,
        tweetData.retweets || 0,
        tweetData.replies || 0,
        tweetData.impressions
      );

      if (success) {
        const engagementScore = await learningSystemIntegration.calculateEngagementScore(
          tweetData.likes || 0,
          tweetData.retweets || 0,
          tweetData.replies || 0,
          tweetData.impressions
        );

        console.log(`✅ Performance tracked: Engagement score = ${engagementScore}`);
      } else {
        console.log(`⚠️  Failed to track performance for ${tweetData.tweet_id}`);
      }

    } catch (error) {
      console.error('❌ Error tracking tweet performance:', error);
    }
  }

  /**
   * 🎯 GET PERFORMANCE INSIGHTS
   */
  static async getPerformanceInsights(): Promise<{
    bestFormat: string;
    optimalTiming: any;
    banditStats: any[];
  }> {
    try {
      const [bestFormat, optimalTiming, banditStats] = await Promise.all([
        learningSystemIntegration.getBestContentFormat(),
        learningSystemIntegration.getOptimalPostingTime(),
        learningSystemIntegration.getBanditArmStatistics()
      ]);

      return {
        bestFormat,
        optimalTiming,
        banditStats
      };
    } catch (error) {
      console.error('❌ Error getting performance insights:', error);
      return {
        bestFormat: 'controversy_evidence_stance',
        optimalTiming: null,
        banditStats: []
      };
    }
  }
}

export const performanceTracker = PerformanceTracker;
