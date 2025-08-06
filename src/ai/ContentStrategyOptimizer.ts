/**
 * 🚀 CONTENT STRATEGY OPTIMIZER
 * ============================
 * Uses learning insights to dynamically optimize content strategy for maximum follower growth
 * Integrates with your bandit algorithm and strategy decision tables
 */

import { supabaseClient } from '../utils/supabaseClient';
import { openaiService } from '../services/openaiService';
import { contentPerformanceLearning } from './ContentPerformanceLearning';

interface StrategyConfig {
  contentTypes: {
    text: { weight: number; frequency: number };
    thread: { weight: number; frequency: number };
    poll: { weight: number; frequency: number };
    quote: { weight: number; frequency: number };
  };
  timingStrategy: {
    optimalHours: number[];
    avoidHours: number[];
    optimalDays: number[];
  };
  contentRules: {
    minLength: number;
    maxLength: number;
    includeQuestions: boolean;
    includeNumbers: boolean;
    includeEmojis: boolean;
    maxHashtags: number;
  };
  engagementTargets: {
    likesPerPost: number;
    retweetsPerPost: number;
    repliesPerPost: number;
    followersPerPost: number;
  };
}

interface OptimizationRecommendation {
  type: 'content' | 'timing' | 'strategy' | 'format';
  priority: 'high' | 'medium' | 'low';
  recommendation: string;
  expectedImpact: string;
  confidence: number;
  implementation: string;
}

export class ContentStrategyOptimizer {

  /**
   * 🎯 MAIN OPTIMIZATION FUNCTION
   * Analyzes current performance and optimizes strategy
   */
  async optimizeStrategy(): Promise<{
    currentStrategy: StrategyConfig;
    recommendations: OptimizationRecommendation[];
    newStrategy: StrategyConfig;
  }> {
    console.log('🚀 === CONTENT STRATEGY OPTIMIZATION STARTING ===');
    
    try {
      // 1. Get current strategy
      const currentStrategy = await this.getCurrentStrategy();
      
      // 2. Run learning analysis
      const learningInsights = await contentPerformanceLearning.learnFromRecentPerformance();
      
      // 3. Analyze current performance vs targets
      const performanceAnalysis = await this.analyzeCurrentPerformance();
      
      // 4. Generate optimization recommendations
      const recommendations = await this.generateOptimizationRecommendations(
        currentStrategy, 
        learningInsights, 
        performanceAnalysis
      );
      
      // 5. Create optimized strategy
      const newStrategy = await this.createOptimizedStrategy(currentStrategy, recommendations);
      
      // 6. Store strategy decision
      await this.storeStrategyDecision(currentStrategy, newStrategy, recommendations);
      
      console.log(`✅ Strategy optimization completed: ${recommendations.length} recommendations`);
      
      return {
        currentStrategy,
        recommendations,
        newStrategy
      };
      
    } catch (error) {
      console.error('❌ Strategy optimization error:', error);
      throw error;
    }
  }

  /**
   * 📊 GET CURRENT STRATEGY
   * Retrieves current strategy from database
   */
  private async getCurrentStrategy(): Promise<StrategyConfig> {
    // Get latest strategy from content_strategies table
    const { data: latestStrategy } = await supabaseClient
      .from('content_strategies')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (latestStrategy?.strategy_config) {
      return latestStrategy.strategy_config;
    }

    // Return default strategy if none exists
    return this.getDefaultStrategy();
  }

  /**
   * 📈 ANALYZE CURRENT PERFORMANCE
   * Evaluates how current strategy is performing
   */
  private async analyzeCurrentPerformance() {
    const [
      recentTweets,
      followerGrowth,
      engagementMetrics
    ] = await Promise.all([
      supabaseClient
        .from('tweets')
        .select('*')
        .order('posted_at', { ascending: false })
        .limit(30),
        
      supabaseClient
        .from('follower_growth_analytics')
        .select('*')
        .order('date', { ascending: false })
        .limit(7),
        
      supabaseClient
        .from('engagement_metrics')
        .select('*')
        .order('calculated_at', { ascending: false })
        .limit(7)
    ]);

    const tweets = recentTweets.data || [];
    const growth = followerGrowth.data || [];
    const engagement = engagementMetrics.data || [];

    return {
      avgFollowersPerTweet: tweets.reduce((sum, t) => sum + (t.new_followers || 0), 0) / Math.max(tweets.length, 1),
      avgLikesPerTweet: tweets.reduce((sum, t) => sum + (t.likes || 0), 0) / Math.max(tweets.length, 1),
      avgRetweetsPerTweet: tweets.reduce((sum, t) => sum + (t.retweets || 0), 0) / Math.max(tweets.length, 1),
      avgRepliesPerTweet: tweets.reduce((sum, t) => sum + (t.replies || 0), 0) / Math.max(tweets.length, 1),
      totalFollowerGrowth: growth.reduce((sum, g) => sum + (g.new_followers || 0), 0),
      engagementTrend: this.calculateTrend(engagement.map(e => e.engagement_rate || 0)),
      postingFrequency: tweets.length / 7, // tweets per day
      contentTypeDistribution: this.analyzeContentTypes(tweets)
    };
  }

  /**
   * 💡 GENERATE OPTIMIZATION RECOMMENDATIONS
   * Creates specific recommendations based on insights and performance
   */
  private async generateOptimizationRecommendations(
    currentStrategy: StrategyConfig,
    insights: any[],
    performance: any
  ): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];

    // Analyze follower growth performance
    if (performance.avgFollowersPerTweet < 1) {
      recommendations.push({
        type: 'strategy',
        priority: 'high',
        recommendation: 'Focus on follower-driving content strategies',
        expectedImpact: 'Increase followers per tweet from ' + performance.avgFollowersPerTweet.toFixed(1) + ' to 2+',
        confidence: 0.8,
        implementation: 'Increase thread frequency, add more educational content, use engagement hooks'
      });
    }

    // Analyze engagement performance
    if (performance.avgLikesPerTweet < 20) {
      recommendations.push({
        type: 'content',
        priority: 'high',
        recommendation: 'Improve content engagement appeal',
        expectedImpact: 'Increase likes per tweet from ' + performance.avgLikesPerTweet.toFixed(1) + ' to 30+',
        confidence: 0.7,
        implementation: 'Add more questions, controversial takes, actionable tips'
      });
    }

    // Process learning insights
    for (const insight of insights) {
      if (insight.impact === 'high' && insight.confidence > 0.7) {
        recommendations.push({
          type: 'content',
          priority: insight.impact,
          recommendation: insight.recommendation,
          expectedImpact: `Apply learned pattern: ${insight.pattern}`,
          confidence: insight.confidence,
          implementation: `Based on analysis of ${insight.evidence?.sampleSize || 'recent'} tweets`
        });
      }
    }

    // Content type optimization
    for (const [type, data] of Object.entries(performance.contentTypeDistribution)) {
      const typeData = data as { count: number; avgFollowers: number };
      if (typeData.avgFollowers > performance.avgFollowersPerTweet * 1.5 && typeData.count >= 3) {
        recommendations.push({
          type: 'strategy',
          priority: 'medium',
          recommendation: `Increase ${type} content frequency`,
          expectedImpact: `${type} content averages ${typeData.avgFollowers.toFixed(1)} followers vs ${performance.avgFollowersPerTweet.toFixed(1)} overall`,
          confidence: 0.6,
          implementation: `Increase ${type} weight in content strategy from ${currentStrategy.contentTypes[type as keyof typeof currentStrategy.contentTypes]?.weight || 0.25} to ${Math.min(0.5, (currentStrategy.contentTypes[type as keyof typeof currentStrategy.contentTypes]?.weight || 0.25) * 1.5)}`
        });
      }
    }

    // Timing optimization using AI analysis
    const timingRecommendations = await this.analyzeTimingOptimization(performance);
    recommendations.push(...timingRecommendations);

    return recommendations.slice(0, 8); // Limit to top 8 recommendations
  }

  /**
   * ⏰ ANALYZE TIMING OPTIMIZATION
   * Uses AI to find optimal posting times
   */
  private async analyzeTimingOptimization(performance: any): Promise<OptimizationRecommendation[]> {
    try {
      // Get optimal posting windows data
      const { data: optimalWindows } = await supabaseClient
        .from('optimal_posting_windows')
        .select('*')
        .order('engagement_multiplier', { ascending: false })
        .limit(10);

      if (!optimalWindows?.length) return [];

      const bestWindows = optimalWindows.slice(0, 3);
      
      return bestWindows.map(window => ({
        type: 'timing' as const,
        priority: 'medium' as const,
        recommendation: `Optimize posting for ${window.day_of_week} between ${window.hour_start}-${window.hour_end}`,
        expectedImpact: `${(window.engagement_multiplier * 100).toFixed(0)}% higher engagement`,
        confidence: 0.7,
        implementation: `Schedule more content during this high-engagement window`
      }));
      
    } catch (error) {
      console.error('Timing optimization error:', error);
      return [];
    }
  }

  /**
   * 🎯 CREATE OPTIMIZED STRATEGY
   * Builds new strategy based on recommendations
   */
  private async createOptimizedStrategy(
    currentStrategy: StrategyConfig,
    recommendations: OptimizationRecommendation[]
  ): Promise<StrategyConfig> {
    const newStrategy = JSON.parse(JSON.stringify(currentStrategy)); // Deep copy

    // Apply recommendations
    for (const rec of recommendations) {
      if (rec.priority === 'high' && rec.confidence > 0.7) {
        if (rec.type === 'content') {
          // Adjust content rules based on learning
          if (rec.recommendation.includes('questions')) {
            newStrategy.contentRules.includeQuestions = true;
          }
          if (rec.recommendation.includes('numbers')) {
            newStrategy.contentRules.includeNumbers = true;
          }
        }
        
        if (rec.type === 'strategy') {
          // Adjust content type weights
          const typeMatch = rec.recommendation.match(/Increase (\w+) content/);
          if (typeMatch) {
            const type = typeMatch[1] as keyof typeof newStrategy.contentTypes;
            if (newStrategy.contentTypes[type]) {
              newStrategy.contentTypes[type].weight = Math.min(0.6, 
                newStrategy.contentTypes[type].weight * 1.3
              );
            }
          }
        }
      }
    }

    // Normalize content type weights
    const totalWeight = Object.values(newStrategy.contentTypes)
      .reduce((sum, type) => sum + type.weight, 0);
    
    if (totalWeight > 0) {
      for (const type of Object.keys(newStrategy.contentTypes)) {
        const key = type as keyof typeof newStrategy.contentTypes;
        newStrategy.contentTypes[key].weight /= totalWeight;
      }
    }

    return newStrategy;
  }

  /**
   * 💾 STORE STRATEGY DECISION
   * Records the strategy optimization decision for tracking
   */
  private async storeStrategyDecision(
    oldStrategy: StrategyConfig,
    newStrategy: StrategyConfig,
    recommendations: OptimizationRecommendation[]
  ) {
    // Store in content_strategy_decisions table
    await supabaseClient.supabase.from('content_strategy_decisions').insert({
      previous_strategy: oldStrategy,
      new_strategy: newStrategy,
      recommendations: recommendations,
      optimization_reason: 'automated_learning_optimization',
      expected_improvements: recommendations.filter(r => r.priority === 'high').map(r => r.expectedImpact),
      confidence_score: recommendations.reduce((sum, r) => sum + r.confidence, 0) / recommendations.length,
      decided_at: new Date().toISOString()
    });

    // Update current strategy
    await supabaseClient.supabase.from('content_strategies').insert({
      strategy_name: `optimized_${Date.now()}`,
      strategy_config: newStrategy,
      optimization_source: 'ai_learning',
      performance_targets: newStrategy.engagementTargets,
      created_at: new Date().toISOString(),
      is_active: true
    });

    // Mark previous strategies as inactive
    await supabaseClient
      .from('content_strategies')
      .update({ is_active: false })
      .neq('created_at', new Date().toISOString());
  }

  // Helper methods
  private getDefaultStrategy(): StrategyConfig {
    return {
      contentTypes: {
        text: { weight: 0.4, frequency: 0.4 },
        thread: { weight: 0.3, frequency: 0.3 },
        poll: { weight: 0.2, frequency: 0.2 },
        quote: { weight: 0.1, frequency: 0.1 }
      },
      timingStrategy: {
        optimalHours: [9, 12, 15, 18, 21],
        avoidHours: [2, 3, 4, 5, 6],
        optimalDays: [1, 2, 3, 4, 5] // Monday to Friday
      },
      contentRules: {
        minLength: 50,
        maxLength: 280,
        includeQuestions: false,
        includeNumbers: false,
        includeEmojis: true,
        maxHashtags: 2
      },
      engagementTargets: {
        likesPerPost: 20,
        retweetsPerPost: 5,
        repliesPerPost: 3,
        followersPerPost: 1
      }
    };
  }

  private calculateTrend(values: number[]): 'increasing' | 'decreasing' | 'stable' {
    if (values.length < 2) return 'stable';
    const recent = values.slice(0, Math.ceil(values.length / 2));
    const older = values.slice(Math.ceil(values.length / 2));
    
    const recentAvg = recent.reduce((sum, v) => sum + v, 0) / recent.length;
    const olderAvg = older.reduce((sum, v) => sum + v, 0) / older.length;
    
    const diff = (recentAvg - olderAvg) / olderAvg;
    return diff > 0.1 ? 'increasing' : diff < -0.1 ? 'decreasing' : 'stable';
  }

  private analyzeContentTypes(tweets: any[]) {
    const distribution: Record<string, { count: number; avgFollowers: number }> = {};
    
    for (const tweet of tweets) {
      const type = tweet.content_type || 'text';
      if (!distribution[type]) {
        distribution[type] = { count: 0, avgFollowers: 0 };
      }
      distribution[type].count++;
      distribution[type].avgFollowers += (tweet.new_followers || 0);
    }
    
    // Calculate averages
    for (const type of Object.keys(distribution)) {
      distribution[type].avgFollowers /= distribution[type].count;
    }
    
    return distribution;
  }
}

export const contentStrategyOptimizer = new ContentStrategyOptimizer();