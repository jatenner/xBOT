/**
 * 📊 OUTCOME TRACKER
 * Tracks AI decision outcomes and updates success scores for learning
 * 
 * Connects AI decisions to actual results for continuous improvement
 */

import { getUnifiedDataManager } from './unifiedDataManager';

interface DecisionOutcome {
  decisionId: number;
  postId?: string;
  actualResult: {
    posted: boolean;
    followers_gained: number;
    engagement: number;
    viral_score: number;
    timing_accuracy: number;
  };
  successScore: number; // 0-1 how good was this decision
  outcomeTimestamp: Date;
}

export class OutcomeTracker {
  private static instance: OutcomeTracker;
  private dataManager = getUnifiedDataManager();

  private constructor() {}

  public static getInstance(): OutcomeTracker {
    if (!OutcomeTracker.instance) {
      OutcomeTracker.instance = new OutcomeTracker();
    }
    return OutcomeTracker.instance;
  }

  /**
   * 📝 RECORD POSTING OUTCOME
   * Called when a post is made following an AI decision
   */
  public async recordPostingOutcome(
    decisionId: number,
    postId: string,
    expectedGrowth: number
  ): Promise<void> {
    console.log(`📊 OUTCOME_TRACKER: Recording outcome for decision ${decisionId}, post ${postId}`);

    try {
      // Initial outcome record (will be updated with metrics later)
      const outcome: DecisionOutcome = {
        decisionId,
        postId,
        actualResult: {
          posted: true,
          followers_gained: 0, // Will be updated
          engagement: 0, // Will be updated
          viral_score: 0, // Will be updated
          timing_accuracy: 1.0 // Posted as recommended
        },
        successScore: 0.5, // Neutral until we have results
        outcomeTimestamp: new Date()
      };

      await this.updateDecisionOutcome(decisionId, outcome);

      // Schedule follow-up tracking
      this.scheduleOutcomeUpdates(decisionId, postId, expectedGrowth);

      console.log(`✅ OUTCOME_TRACKER: Initial outcome recorded for decision ${decisionId}`);

    } catch (error: any) {
      console.error('❌ OUTCOME_TRACKER failed to record posting outcome:', error.message);
    }
  }

  /**
   * ⏰ SCHEDULE OUTCOME UPDATES
   * Updates outcomes at 1h, 24h, and 7d intervals
   */
  private scheduleOutcomeUpdates(
    decisionId: number,
    postId: string,
    expectedGrowth: number
  ): void {
    // Update at 1 hour
    setTimeout(() => {
      this.updatePostOutcome(decisionId, postId, expectedGrowth, '1hour');
    }, 60 * 60 * 1000);

    // Update at 24 hours
    setTimeout(() => {
      this.updatePostOutcome(decisionId, postId, expectedGrowth, '24hours');
    }, 24 * 60 * 60 * 1000);

    // Final update at 7 days
    setTimeout(() => {
      this.updatePostOutcome(decisionId, postId, expectedGrowth, '7days');
    }, 7 * 24 * 60 * 60 * 1000);
  }

  /**
   * 🔄 UPDATE POST OUTCOME
   * Updates decision outcome with actual performance data
   */
  private async updatePostOutcome(
    decisionId: number,
    postId: string,
    expectedGrowth: number,
    timepoint: '1hour' | '24hours' | '7days'
  ): Promise<void> {
    console.log(`🔄 OUTCOME_TRACKER: Updating ${timepoint} outcome for decision ${decisionId}`);

    try {
      // Get actual post performance
      const posts = await this.dataManager.getPostPerformance(1);
      const post = posts.find(p => p.postId === postId);

      if (!post) {
        console.warn(`⚠️ OUTCOME_TRACKER: Post ${postId} not found for outcome update`);
        return;
      }

      // Calculate success metrics
      const actualFollowers = post.followersAttributed;
      const totalEngagement = post.likes + post.retweets + post.replies;
      const viralScore = this.calculateViralScore(post);
      
      // Calculate success score based on performance vs prediction
      const successScore = this.calculateSuccessScore(
        expectedGrowth,
        actualFollowers,
        totalEngagement,
        timepoint
      );

      const outcome: DecisionOutcome = {
        decisionId,
        postId,
        actualResult: {
          posted: true,
          followers_gained: actualFollowers,
          engagement: totalEngagement,
          viral_score: viralScore,
          timing_accuracy: 1.0
        },
        successScore,
        outcomeTimestamp: new Date()
      };

      await this.updateDecisionOutcome(decisionId, outcome);

      console.log(`✅ OUTCOME_TRACKER: ${timepoint} outcome updated - Success score: ${successScore.toFixed(2)}`);

    } catch (error: any) {
      console.error(`❌ OUTCOME_TRACKER failed to update ${timepoint} outcome:`, error.message);
    }
  }

  /**
   * 📊 CALCULATE SUCCESS SCORE
   * Determines how successful the AI decision was (0-1 scale)
   */
  private calculateSuccessScore(
    expectedGrowth: number,
    actualFollowers: number,
    engagement: number,
    timepoint: string
  ): number {
    let score = 0.5; // Base neutral score

    // Follower performance vs expectation (40% of score)
    const followerRatio = expectedGrowth > 0 ? actualFollowers / expectedGrowth : 1;
    const followerScore = Math.min(1.0, Math.max(0, followerRatio));
    score += (followerScore - 0.5) * 0.8; // ±0.4 points

    // Engagement performance (30% of score)
    const engagementThreshold = timepoint === '1hour' ? 10 : timepoint === '24hours' ? 25 : 50;
    const engagementScore = Math.min(1.0, engagement / engagementThreshold);
    score += (engagementScore - 0.5) * 0.6; // ±0.3 points

    // Time-based bonuses (30% of score)
    if (timepoint === '1hour' && actualFollowers > 0) {
      score += 0.1; // Early success bonus
    }
    if (timepoint === '24hours' && actualFollowers >= expectedGrowth) {
      score += 0.15; // Met expectations bonus
    }
    if (timepoint === '7days' && actualFollowers > expectedGrowth * 1.5) {
      score += 0.15; // Exceeded expectations bonus
    }

    return Math.min(1.0, Math.max(0, score));
  }

  /**
   * 🔥 CALCULATE VIRAL SCORE
   */
  private calculateViralScore(post: any): number {
    const totalEngagement = post.likes + post.retweets + post.replies;
    const impressions = post.impressions || 1;
    const engagementRate = totalEngagement / impressions;
    
    // Viral indicators
    let viralScore = 0;
    
    if (engagementRate > 0.05) viralScore += 0.3; // 5%+ engagement rate
    if (post.retweets > 10) viralScore += 0.3; // Good retweet count
    if (post.followersAttributed > 2) viralScore += 0.4; // Strong follower gain
    
    return Math.min(1.0, viralScore);
  }

  /**
   * 💾 UPDATE DECISION OUTCOME IN DATABASE
   */
  private async updateDecisionOutcome(
    decisionId: number,
    outcome: DecisionOutcome
  ): Promise<void> {
    try {
      // Update the unified_ai_intelligence table with outcome data
      await this.dataManager.storeAIDecision({
        decisionTimestamp: new Date(),
        decisionType: 'outcome_update',
        recommendation: outcome.actualResult,
        confidence: outcome.successScore,
        reasoning: `Outcome tracking: ${outcome.actualResult.followers_gained} followers, ${outcome.actualResult.engagement} engagement`,
        dataPointsUsed: 1,
        outcomeData: outcome.actualResult,
        successScore: outcome.successScore,
        implementationTimestamp: outcome.outcomeTimestamp
      });

    } catch (error: any) {
      console.error('❌ OUTCOME_TRACKER failed to update database:', error.message);
    }
  }

  /**
   * 📈 GET DECISION EFFECTIVENESS STATS
   */
  public async getDecisionEffectiveness(): Promise<{
    totalDecisions: number;
    avgSuccessScore: number;
    bestStrategy: string;
    improvementTrend: number;
  }> {
    try {
      const decisions = await this.dataManager.getAIDecisions(30); // Last 30 days
      
      if (decisions.length === 0) {
        return {
          totalDecisions: 0,
          avgSuccessScore: 0.5,
          bestStrategy: 'learning_mode',
          improvementTrend: 0
        };
      }

      const avgSuccessScore = decisions.reduce((sum, d) => sum + (d.successScore || 0.5), 0) / decisions.length;
      
      // Find best performing strategy
      const strategyScores = new Map<string, number[]>();
      decisions.forEach(d => {
        const strategy = (d.recommendation as any)?.strategy || 'unknown';
        if (!strategyScores.has(strategy)) {
          strategyScores.set(strategy, []);
        }
        strategyScores.get(strategy)!.push(d.successScore || 0.5);
      });

      let bestStrategy = 'learning_mode';
      let bestScore = 0;
      for (const [strategy, scores] of strategyScores) {
        const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
        if (avgScore > bestScore) {
          bestScore = avgScore;
          bestStrategy = strategy;
        }
      }

      // Calculate improvement trend (last week vs previous week)
      const now = new Date();
      const lastWeek = decisions.filter(d => 
        d.decisionTimestamp >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      );
      const previousWeek = decisions.filter(d => 
        d.decisionTimestamp >= new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000) &&
        d.decisionTimestamp < new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      );

      const lastWeekAvg = lastWeek.length > 0 
        ? lastWeek.reduce((sum, d) => sum + (d.successScore || 0.5), 0) / lastWeek.length 
        : 0.5;
      const previousWeekAvg = previousWeek.length > 0 
        ? previousWeek.reduce((sum, d) => sum + (d.successScore || 0.5), 0) / previousWeek.length 
        : 0.5;

      const improvementTrend = lastWeekAvg - previousWeekAvg;

      return {
        totalDecisions: decisions.length,
        avgSuccessScore,
        bestStrategy,
        improvementTrend
      };

    } catch (error: any) {
      console.error('❌ OUTCOME_TRACKER failed to get effectiveness stats:', error.message);
      return {
        totalDecisions: 0,
        avgSuccessScore: 0.5,
        bestStrategy: 'learning_mode',
        improvementTrend: 0
      };
    }
  }

  /**
   * 🎯 RECORD DECISION NOT IMPLEMENTED
   * When AI decides not to post
   */
  public async recordDecisionNotImplemented(
    decisionId: number,
    reason: string
  ): Promise<void> {
    console.log(`📊 OUTCOME_TRACKER: Recording non-implementation for decision ${decisionId}`);

    try {
      const outcome: DecisionOutcome = {
        decisionId,
        actualResult: {
          posted: false,
          followers_gained: 0,
          engagement: 0,
          viral_score: 0,
          timing_accuracy: 1.0 // Correctly decided not to post
        },
        successScore: 0.6, // Slightly positive for correct restraint
        outcomeTimestamp: new Date()
      };

      await this.updateDecisionOutcome(decisionId, outcome);

      console.log(`✅ OUTCOME_TRACKER: Non-implementation recorded for decision ${decisionId}`);

    } catch (error: any) {
      console.error('❌ OUTCOME_TRACKER failed to record non-implementation:', error.message);
    }
  }
}

export const getOutcomeTracker = () => OutcomeTracker.getInstance();
