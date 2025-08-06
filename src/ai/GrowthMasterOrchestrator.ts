/**
 * 🎼 GROWTH MASTER ORCHESTRATOR
 * ============================
 * Coordinates all AI growth systems for maximum follower acquisition
 * Integrates prediction, learning, optimization, and A/B testing
 */

import { predictiveGrowthEngine } from './PredictiveGrowthEngine';
import { contentPerformanceLearning } from './ContentPerformanceLearning';
import { contentStrategyOptimizer } from './ContentStrategyOptimizer';
import { systematicABTesting } from './SystematicABTesting';
import { supabase } from '../utils/supabaseClient';

interface GrowthDecision {
  shouldPost: boolean;
  confidence: number;
  prediction: any;
  abTestAssignment?: any;
  contentModifications?: any;
  reasoning: string;
  alternativeRecommendations?: string[];
}

interface DailyGrowthReport {
  date: string;
  followersGained: number;
  tweetsPosted: number;
  avgFollowersPerTweet: number;
  bestPerformingTweet: any;
  learningInsights: any[];
  strategyOptimizations: any;
  activeTests: number;
  recommendations: string[];
}

export class GrowthMasterOrchestrator {

  /**
   * 🎯 MAIN GROWTH DECISION FUNCTION
   * Makes intelligent decision about whether and how to post content
   */
  async makeGrowthDecision(contentAnalysis: any): Promise<GrowthDecision> {
    console.log('🎼 === GROWTH MASTER ORCHESTRATOR ACTIVATED ===');
    
    try {
      // 1. Get growth prediction
      const prediction = await predictiveGrowthEngine.predictGrowthPotential(contentAnalysis);
      
      console.log(`📊 Growth prediction: ${prediction.predictedFollowers} followers (${prediction.confidence}% confidence)`);
      
      // 2. Check A/B test assignment
      const abAssignment = await systematicABTesting.assignTestVariant(
        this.hashContent(contentAnalysis.content)
      );
      
      // 3. Apply A/B test modifications if assigned
      let modifiedContent = contentAnalysis;
      if (abAssignment.testId && abAssignment.modifications) {
        modifiedContent = this.applyABTestModifications(contentAnalysis, abAssignment.modifications);
        console.log(`🧪 A/B test active: ${abAssignment.testId} (${abAssignment.variant})`);
      }
      
      // 4. Make posting decision based on criteria
      const decision = this.evaluatePostingDecision(prediction, abAssignment);
      
      // 5. Generate alternative recommendations if declining to post
      let alternatives: string[] = [];
      if (!decision.shouldPost) {
        alternatives = await this.generateAlternativeRecommendations(prediction);
      }
      
      // 6. Log decision for learning
      await this.logGrowthDecision(modifiedContent, prediction, decision, abAssignment);
      
      return {
        shouldPost: decision.shouldPost,
        confidence: decision.confidence,
        prediction,
        abTestAssignment: abAssignment,
        contentModifications: abAssignment.modifications,
        reasoning: decision.reasoning,
        alternativeRecommendations: alternatives
      };
      
    } catch (error) {
      console.error('❌ Growth decision error:', error);
      return this.getDefaultDecision();
    }
  }

  /**
   * 📚 RUN DAILY LEARNING CYCLE
   * Orchestrates all learning and optimization systems
   */
  async runDailyLearningCycle(): Promise<DailyGrowthReport> {
    console.log('📚 === DAILY LEARNING CYCLE STARTING ===');
    
    try {
      // 1. Learn from recent performance
      const learningInsights = await contentPerformanceLearning.learnFromRecentPerformance();
      console.log(`📖 Generated ${learningInsights.length} learning insights`);
      
      // 2. Optimize content strategy
      const strategyOptimization = await contentStrategyOptimizer.optimizeStrategy();
      console.log(`🚀 Generated ${strategyOptimization.recommendations.length} strategy optimizations`);
      
      // 3. Run A/B testing cycle
      await systematicABTesting.runTestingCycle();
      console.log('🧪 A/B testing cycle completed');
      
      // 4. Generate daily report
      const report = await this.generateDailyReport(learningInsights, strategyOptimization);
      
      // 5. Store learning cycle results
      await this.storeLearningCycleResults(report);
      
      console.log('✅ Daily learning cycle completed');
      return report;
      
    } catch (error) {
      console.error('❌ Learning cycle error:', error);
      throw error;
    }
  }

  /**
   * 📈 MONITOR GROWTH PERFORMANCE
   * Tracks progress towards follower growth goals
   */
  async monitorGrowthPerformance(): Promise<{
    dailyGrowth: number;
    weeklyGrowth: number;
    growthRate: number;
    onTrackForGoals: boolean;
    recommendations: string[];
  }> {
    try {
      // Get recent follower growth data
      const { data: growthData } = await supabaseClient
        .from('follower_growth_analytics')
        .select('*')
        .order('date', { ascending: false })
        .limit(30);

      if (!growthData?.length) {
        return {
          dailyGrowth: 0,
          weeklyGrowth: 0,
          growthRate: 0,
          onTrackForGoals: false,
          recommendations: ['Insufficient growth data - need more posting history']
        };
      }

      const dailyGrowth = growthData[0]?.new_followers || 0;
      const weeklyGrowth = growthData.slice(0, 7).reduce((sum, day) => sum + (day.new_followers || 0), 0);
      const growthRate = this.calculateGrowthRate(growthData);
      
      // Check if on track for goals (target: 15+ followers per day)
      const onTrackForGoals = dailyGrowth >= 15 && weeklyGrowth >= 100;
      
      // Generate recommendations
      const recommendations = await this.generateGrowthRecommendations(
        dailyGrowth, 
        weeklyGrowth, 
        growthRate, 
        onTrackForGoals
      );
      
      return {
        dailyGrowth,
        weeklyGrowth,
        growthRate,
        onTrackForGoals,
        recommendations
      };
      
    } catch (error) {
      console.error('Growth monitoring error:', error);
      throw error;
    }
  }

  /**
   * 🎯 POST-PERFORMANCE LEARNING
   * Records actual performance and updates learning systems
   */
  async recordPostPerformance(
    contentHash: string,
    actualMetrics: {
      followers: number;
      likes: number;
      retweets: number;
      replies: number;
      impressions: number;
    },
    abTestId?: string
  ) {
    try {
      console.log(`📊 Recording performance for content: ${contentHash}`);
      
      // 1. Record A/B test performance if applicable
      if (abTestId) {
        await systematicABTesting.recordTestPerformance(abTestId, contentHash, actualMetrics);
      }
      
      // 2. Store performance data for learning
      await supabaseClient.from('growth_performance_log').insert({
        content_hash: contentHash,
        actual_followers: actualMetrics.followers,
        actual_likes: actualMetrics.likes,
        actual_retweets: actualMetrics.retweets,
        actual_replies: actualMetrics.replies,
        actual_impressions: actualMetrics.impressions,
        recorded_at: new Date().toISOString()
      });
      
      // 3. Update learning signals
      const isHighPerforming = actualMetrics.followers > 2 || actualMetrics.likes > 50;
      await supabaseClient.from('algorithm_signals').insert({
        signal_type: isHighPerforming ? 'high_performance' : 'standard_performance',
        signal_data: {
          contentHash,
          metrics: actualMetrics,
          performance_tier: this.classifyPerformance(actualMetrics)
        },
        confidence: isHighPerforming ? 0.9 : 0.6,
        created_at: new Date().toISOString()
      });
      
      console.log(`✅ Performance recorded: ${actualMetrics.followers} followers, ${actualMetrics.likes} likes`);
      
    } catch (error) {
      console.error('Performance recording error:', error);
    }
  }

  // Helper methods
  private evaluatePostingDecision(prediction: any, abAssignment: any): {
    shouldPost: boolean;
    confidence: number;
    reasoning: string;
  } {
    // Decision criteria
    const minFollowerThreshold = 0.5;
    const minConfidenceThreshold = 60;
    
    // A/B tests get priority posting
    if (abAssignment.testId) {
      return {
        shouldPost: true,
        confidence: 0.8,
        reasoning: `A/B test assignment: ${abAssignment.testId} (${abAssignment.variant})`
      };
    }
    
    // High confidence, high prediction
    if (prediction.confidence >= 80 && prediction.predictedFollowers >= 2) {
      return {
        shouldPost: true,
        confidence: 0.9,
        reasoning: `High confidence prediction: ${prediction.predictedFollowers} followers (${prediction.confidence}% confidence)`
      };
    }
    
    // Medium confidence, medium prediction
    if (prediction.confidence >= minConfidenceThreshold && prediction.predictedFollowers >= minFollowerThreshold) {
      return {
        shouldPost: true,
        confidence: 0.7,
        reasoning: `Meets posting thresholds: ${prediction.predictedFollowers} followers predicted`
      };
    }
    
    // Low prediction
    return {
      shouldPost: false,
      confidence: 0.6,
      reasoning: `Below thresholds: ${prediction.predictedFollowers} followers predicted (${prediction.confidence}% confidence)`
    };
  }

  private applyABTestModifications(content: any, modifications: any): any {
    const modified = { ...content };
    
    if (modifications.includeQuestion && !content.content.includes('?')) {
      modified.content += ' What do you think?';
    }
    
    if (modifications.format === 'numbered_list') {
      // Convert to numbered format if not already
      if (!content.content.match(/^\d+\./)) {
        modified.content = `1. ${content.content}`;
      }
    }
    
    return modified;
  }

  private async generateAlternativeRecommendations(prediction: any): Promise<string[]> {
    const recommendations: string[] = [];
    
    if (prediction.confidence < 60) {
      recommendations.push('Improve content quality - add more engagement hooks');
    }
    
    if (prediction.predictedFollowers < 1) {
      recommendations.push('Consider thread format for higher follower acquisition');
      recommendations.push('Add educational value or controversial take');
    }
    
    if (prediction.riskLevel === 'high') {
      recommendations.push('Wait for better timing or revise content approach');
    }
    
    return recommendations;
  }

  private async generateDailyReport(
    insights: any[], 
    optimization: any
  ): Promise<DailyGrowthReport> {
    // Get today's performance
    const { data: todayGrowth } = await supabaseClient
      .from('follower_growth_analytics')
      .select('*')
      .gte('date', new Date().toISOString().split('T')[0])
      .single();

    const { data: todayTweets } = await supabaseClient
      .from('tweets')
      .select('*')
      .gte('posted_at', new Date().toISOString().split('T')[0]);

    const { data: activeTests } = await supabaseClient
      .from('ab_tests')
      .select('test_id')
      .eq('status', 'active');

    // Find best performing tweet
    const bestTweet = todayTweets?.reduce((best, tweet) => 
      (tweet.new_followers || 0) > (best?.new_followers || 0) ? tweet : best
    );

    return {
      date: new Date().toISOString().split('T')[0],
      followersGained: todayGrowth?.new_followers || 0,
      tweetsPosted: todayTweets?.length || 0,
      avgFollowersPerTweet: todayTweets?.length ? 
        (todayGrowth?.new_followers || 0) / todayTweets.length : 0,
      bestPerformingTweet: bestTweet,
      learningInsights: insights,
      strategyOptimizations: optimization,
      activeTests: activeTests?.length || 0,
      recommendations: [
        ...insights.filter(i => i.impact === 'high').map(i => i.recommendation),
        ...optimization.recommendations.filter(r => r.priority === 'high').map(r => r.recommendation)
      ].slice(0, 5)
    };
  }

  private async storeLearningCycleResults(report: DailyGrowthReport) {
    await supabaseClient.from('daily_growth_strategy').insert({
      date: report.date,
      followers_gained: report.followersGained,
      tweets_posted: report.tweetsPosted,
      avg_followers_per_tweet: report.avgFollowersPerTweet,
      learning_insights_count: report.learningInsights.length,
      strategy_optimizations: report.strategyOptimizations.recommendations.length,
      active_ab_tests: report.activeTests,
      top_recommendations: report.recommendations,
      best_performing_content: report.bestPerformingTweet?.content,
      created_at: new Date().toISOString()
    });
  }

  private calculateGrowthRate(growthData: any[]): number {
    if (growthData.length < 7) return 0;
    
    const recent = growthData.slice(0, 7).reduce((sum, d) => sum + (d.new_followers || 0), 0);
    const previous = growthData.slice(7, 14).reduce((sum, d) => sum + (d.new_followers || 0), 0);
    
    return previous > 0 ? ((recent - previous) / previous) * 100 : 0;
  }

  private async generateGrowthRecommendations(
    daily: number, 
    weekly: number, 
    rate: number, 
    onTrack: boolean
  ): Promise<string[]> {
    const recommendations: string[] = [];
    
    if (!onTrack) {
      recommendations.push('Increase posting frequency and focus on high-engagement content');
    }
    
    if (daily < 5) {
      recommendations.push('Prioritize thread content and educational posts for follower growth');
    }
    
    if (rate < 0) {
      recommendations.push('Analyze recent underperforming content and adjust strategy');
    }
    
    return recommendations;
  }

  private classifyPerformance(metrics: any): string {
    if (metrics.followers >= 5 || metrics.likes >= 100) return 'excellent';
    if (metrics.followers >= 2 || metrics.likes >= 50) return 'good';
    if (metrics.followers >= 1 || metrics.likes >= 20) return 'average';
    return 'poor';
  }

  private async logGrowthDecision(content: any, prediction: any, decision: any, abAssignment: any) {
    await supabaseClient.from('growth_decision_log').insert({
      content_hash: this.hashContent(content.content),
      predicted_followers: prediction.predictedFollowers,
      prediction_confidence: prediction.confidence,
      decision_result: decision.shouldPost ? 'approved' : 'declined',
      decision_confidence: decision.confidence,
      decision_reasoning: decision.reasoning,
      ab_test_id: abAssignment.testId,
      ab_test_variant: abAssignment.variant,
      decided_at: new Date().toISOString()
    });
  }

  private getDefaultDecision(): GrowthDecision {
    return {
      shouldPost: false,
      confidence: 0.5,
      prediction: null,
      reasoning: 'Error in growth analysis - default to conservative approach',
      alternativeRecommendations: ['Fix growth analysis system', 'Try manual posting']
    };
  }

  private hashContent(content: string): string {
    return Buffer.from(content).toString('base64').slice(0, 32);
  }
}

export const growthMasterOrchestrator = new GrowthMasterOrchestrator();