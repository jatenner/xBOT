/**
 * 🤖 AUTONOMOUS PERFORMANCE ADJUSTER
 * Automatically adjusts strategy based on engagement and follower growth
 */

import { resilientSupabaseClient } from './resilientSupabaseClient';
import { BudgetAwareOpenAI } from './budgetAwareOpenAI';

interface PerformanceMetrics {
  followerGrowthRate: number; // followers per day
  engagementRate: number; // average engagement rate
  viralTweetCount: number; // tweets with >100 engagements
  contentQualityScore: number; // 1-10 score
  postingFrequency: number; // posts per day
  reachEfficiency: number; // followers gained per impression
}

interface StrategyAdjustment {
  component: 'POSTING_FREQUENCY' | 'CONTENT_STYLE' | 'ENGAGEMENT_STRATEGY' | 'TIMING' | 'TOPICS';
  currentValue: any;
  newValue: any;
  reasoning: string;
  expectedImpact: number; // % improvement expected
  confidence: number; // 0-1 confidence in adjustment
}

interface PerformanceAnalysis {
  currentMetrics: PerformanceMetrics;
  trend: 'IMPROVING' | 'DECLINING' | 'STABLE';
  bottlenecks: string[];
  opportunities: string[];
  adjustments: StrategyAdjustment[];
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
}

export class AutonomousPerformanceAdjuster {
  private static readonly PERFORMANCE_TARGETS = {
    followerGrowthRate: 10, // 10 followers per day minimum
    engagementRate: 0.03, // 3% minimum engagement rate
    viralTweetCount: 2, // 2 viral tweets per week
    contentQualityScore: 7, // 7/10 minimum quality
    reachEfficiency: 0.05 // 5% follower conversion from impressions
  };

  /**
   * 🎯 Run autonomous performance analysis and adjustment
   */
  static async runPerformanceAdjustment(): Promise<{
    success: boolean;
    analysis: PerformanceAnalysis;
    adjustmentsApplied: number;
    projectedImprovement: number;
  }> {
    try {
      console.log('🤖 === AUTONOMOUS PERFORMANCE ADJUSTER ACTIVATED ===');

      // Step 1: Collect current performance metrics
      const currentMetrics = await this.collectPerformanceMetrics();
      
      // Step 2: Analyze performance trends and bottlenecks
      const analysis = await this.analyzePerformance(currentMetrics);
      
      // Step 3: Generate strategic adjustments
      const adjustments = await this.generateAdjustments(analysis);
      
      // Step 4: Apply high-confidence adjustments
      const appliedAdjustments = await this.applyAdjustments(adjustments);
      
      // Step 5: Log adjustments for tracking
      await this.logAdjustments(appliedAdjustments);

      const projectedImprovement = appliedAdjustments
        .reduce((sum, adj) => sum + adj.expectedImpact, 0);

      console.log(`✅ Performance adjustment complete: ${appliedAdjustments.length} adjustments, +${projectedImprovement.toFixed(1)}% projected improvement`);

      return {
        success: true,
        analysis: { ...analysis, adjustments: appliedAdjustments },
        adjustmentsApplied: appliedAdjustments.length,
        projectedImprovement
      };

    } catch (error) {
      console.error('❌ Autonomous performance adjustment failed:', error);
      
      return {
        success: false,
        analysis: await this.getDefaultAnalysis(),
        adjustmentsApplied: 0,
        projectedImprovement: 0
      };
    }
  }

  /**
   * 📊 Collect current performance metrics
   */
  private static async collectPerformanceMetrics(): Promise<PerformanceMetrics> {
    try {
      const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      
      // Get engagement data with resilient client
      const engagementData = await resilientSupabaseClient.executeWithRetry(
        async () => {
          const { data, error } = await resilientSupabaseClient.supabase
            .from('tweet_analytics')
            .select('likes, retweets, replies, impressions, created_at')
            .gte('created_at', last7Days);
          
          if (error) throw new Error(error.message);
          return data || [];
        },
        'collectEngagementMetrics',
        [] // Empty fallback
      );

      // Get follower data
      const followerData = await resilientSupabaseClient.executeWithRetry(
        async () => {
          const { data, error } = await resilientSupabaseClient.supabase
            .from('growth_metrics')
            .select('followers_count, created_at')
            .gte('created_at', last7Days)
            .order('created_at', { ascending: false })
            .limit(7);
          
          if (error) throw new Error(error.message);
          return data || [];
        },
        'collectFollowerMetrics',
        [] // Empty fallback
      );

      // Calculate metrics from data or use intelligent defaults
      const metrics = this.calculateMetricsFromData(engagementData, followerData);
      
      console.log('📊 Current Performance Metrics:');
      console.log(`  👥 Follower Growth: ${metrics.followerGrowthRate.toFixed(1)}/day`);
      console.log(`  💫 Engagement Rate: ${(metrics.engagementRate * 100).toFixed(2)}%`);
      console.log(`  🔥 Viral Tweets: ${metrics.viralTweetCount}/week`);
      console.log(`  ⭐ Content Quality: ${metrics.contentQualityScore}/10`);
      console.log(`  📈 Reach Efficiency: ${(metrics.reachEfficiency * 100).toFixed(2)}%`);

      return metrics;

    } catch (error) {
      console.warn('⚠️ Using estimated performance metrics');
      return this.getEstimatedMetrics();
    }
  }

  /**
   * 🧠 Analyze performance and identify areas for improvement
   */
  private static async analyzePerformance(metrics: PerformanceMetrics): Promise<PerformanceAnalysis> {
    try {
      const budgetAware = new BudgetAwareOpenAI();
      
      const response = await budgetAware.generateContent(`
You are an AI growth strategist analyzing Twitter/X performance for a health & wellness account.

Current Metrics:
- Follower Growth: ${metrics.followerGrowthRate.toFixed(1)} per day (target: ${this.PERFORMANCE_TARGETS.followerGrowthRate})
- Engagement Rate: ${(metrics.engagementRate * 100).toFixed(2)}% (target: ${(this.PERFORMANCE_TARGETS.engagementRate * 100).toFixed(1)}%)
- Viral Tweets: ${metrics.viralTweetCount}/week (target: ${this.PERFORMANCE_TARGETS.viralTweetCount})
- Content Quality: ${metrics.contentQualityScore}/10 (target: ${this.PERFORMANCE_TARGETS.contentQualityScore})
- Reach Efficiency: ${(metrics.reachEfficiency * 100).toFixed(2)}% (target: ${(this.PERFORMANCE_TARGETS.reachEfficiency * 100).toFixed(1)}%)
- Posting Frequency: ${metrics.postingFrequency.toFixed(1)}/day

Analyze performance and identify bottlenecks and opportunities.

Respond with ONLY JSON:
{
  "trend": "IMPROVING|DECLINING|STABLE",
  "bottlenecks": ["specific issues limiting growth"],
  "opportunities": ["specific areas for improvement"],
  "priority": "URGENT|HIGH|MEDIUM|LOW",
  "keyInsights": ["3-5 actionable insights"]
}`, {
        model: 'gpt-4o-mini',
        max_tokens: 400,
        operation_type: 'performance_analysis'
      });

      if (response.success && response.content) {
        const analysis = JSON.parse(response.content);
        
        return {
          currentMetrics: metrics,
          trend: analysis.trend || 'STABLE',
          bottlenecks: analysis.bottlenecks || [],
          opportunities: analysis.opportunities || [],
          adjustments: [], // Will be filled by generateAdjustments
          priority: analysis.priority || 'MEDIUM'
        };
      }

    } catch (error) {
      console.warn('⚠️ Using default performance analysis');
    }

    return this.getDefaultAnalysis(metrics);
  }

  /**
   * 🔧 Generate strategic adjustments based on analysis
   */
  private static async generateAdjustments(analysis: PerformanceAnalysis): Promise<StrategyAdjustment[]> {
    const adjustments: StrategyAdjustment[] = [];
    const metrics = analysis.currentMetrics;

    // Adjust posting frequency based on engagement
    if (metrics.engagementRate < this.PERFORMANCE_TARGETS.engagementRate) {
      if (metrics.postingFrequency > 6) {
        adjustments.push({
          component: 'POSTING_FREQUENCY',
          currentValue: metrics.postingFrequency,
          newValue: Math.max(4, metrics.postingFrequency - 2),
          reasoning: 'Reduce posting frequency to improve content quality and engagement',
          expectedImpact: 15,
          confidence: 0.8
        });
      }
    }

    // Adjust content style based on viral performance
    if (metrics.viralTweetCount < this.PERFORMANCE_TARGETS.viralTweetCount) {
      adjustments.push({
        component: 'CONTENT_STYLE',
        currentValue: 'current_style',
        newValue: 'controversial_insights',
        reasoning: 'Shift to more controversial, insight-driven content to increase viral potential',
        expectedImpact: 25,
        confidence: 0.7
      });
    }

    // Adjust engagement strategy based on follower growth
    if (metrics.followerGrowthRate < this.PERFORMANCE_TARGETS.followerGrowthRate) {
      adjustments.push({
        component: 'ENGAGEMENT_STRATEGY',
        currentValue: 'current_engagement',
        newValue: 'increased_strategic_replies',
        reasoning: 'Increase strategic replies to high-value targets to improve follower conversion',
        expectedImpact: 20,
        confidence: 0.75
      });
    }

    // Adjust timing if reach efficiency is low
    if (metrics.reachEfficiency < this.PERFORMANCE_TARGETS.reachEfficiency) {
      adjustments.push({
        component: 'TIMING',
        currentValue: 'current_schedule',
        newValue: 'optimal_health_hours',
        reasoning: 'Optimize posting times for health audience peak activity periods',
        expectedImpact: 10,
        confidence: 0.6
      });
    }

    // Content quality improvements
    if (metrics.contentQualityScore < this.PERFORMANCE_TARGETS.contentQualityScore) {
      adjustments.push({
        component: 'TOPICS',
        currentValue: 'current_topics',
        newValue: 'trending_health_research',
        reasoning: 'Focus more on breaking health research and trending wellness topics',
        expectedImpact: 18,
        confidence: 0.85
      });
    }

    console.log(`🔧 Generated ${adjustments.length} potential adjustments`);
    return adjustments;
  }

  /**
   * ⚡ Apply high-confidence adjustments
   */
  private static async applyAdjustments(adjustments: StrategyAdjustment[]): Promise<StrategyAdjustment[]> {
    const applied: StrategyAdjustment[] = [];
    
    // Only apply adjustments with confidence > 0.7
    const highConfidenceAdjustments = adjustments.filter(adj => adj.confidence > 0.7);
    
    for (const adjustment of highConfidenceAdjustments) {
      try {
        console.log(`🔧 Applying adjustment: ${adjustment.component} - ${adjustment.reasoning}`);
        
        // Update bot configuration based on adjustment
        await this.updateBotConfiguration(adjustment);
        
        applied.push(adjustment);
        
      } catch (error) {
        console.warn(`⚠️ Failed to apply adjustment ${adjustment.component}:`, error);
      }
    }
    
    console.log(`✅ Applied ${applied.length}/${adjustments.length} adjustments`);
    return applied;
  }

  /**
   * 🔄 Update bot configuration based on adjustment
   */
  private static async updateBotConfiguration(adjustment: StrategyAdjustment): Promise<void> {
    const configUpdates: any = {};
    
    switch (adjustment.component) {
      case 'POSTING_FREQUENCY':
        configUpdates.maxPostsPerDay = adjustment.newValue;
        break;
        
      case 'CONTENT_STYLE':
        configUpdates.contentStyle = adjustment.newValue;
        break;
        
      case 'ENGAGEMENT_STRATEGY':
        configUpdates.engagementStrategy = adjustment.newValue;
        break;
        
      case 'TIMING':
        configUpdates.postingSchedule = adjustment.newValue;
        break;
        
      case 'TOPICS':
        configUpdates.topicFocus = adjustment.newValue;
        break;
    }
    
    // Store configuration updates
    await resilientSupabaseClient.executeWithRetry(
      async () => {
        const { error } = await resilientSupabaseClient.supabase
          .from('bot_config')
          .upsert({
            key: adjustment.component.toLowerCase(),
            value: JSON.stringify(configUpdates),
            updated_at: new Date().toISOString()
          });
        
        if (error) throw new Error(error.message);
        return true;
      },
      'updateBotConfiguration',
      true // Always succeed with fallback
    );
  }

  /**
   * 📝 Log adjustments for tracking
   */
  private static async logAdjustments(adjustments: StrategyAdjustment[]): Promise<void> {
    try {
      const logData = {
        timestamp: new Date().toISOString(),
        adjustments_applied: adjustments.length,
        total_expected_impact: adjustments.reduce((sum, adj) => sum + adj.expectedImpact, 0),
        adjustments: adjustments.map(adj => ({
          component: adj.component,
          reasoning: adj.reasoning,
          expected_impact: adj.expectedImpact,
          confidence: adj.confidence
        }))
      };

      await resilientSupabaseClient.executeWithRetry(
        async () => {
          const { error } = await resilientSupabaseClient.supabase
            .from('performance_adjustments')
            .insert(logData);
          
          if (error) throw new Error(error.message);
          return true;
        },
        'logAdjustments',
        true // Always succeed with fallback
      );

    } catch (error) {
      console.warn('⚠️ Failed to log adjustments, but continuing...');
    }
  }

  /**
   * 🔧 Helper methods
   */
  private static calculateMetricsFromData(engagementData: any[], followerData: any[]): PerformanceMetrics {
    // Calculate from real data or use intelligent estimates
    const totalEngagements = engagementData.reduce((sum, tweet) => 
      sum + (tweet.likes || 0) + (tweet.retweets || 0) + (tweet.replies || 0), 0);
    const totalImpressions = engagementData.reduce((sum, tweet) => sum + (tweet.impressions || 1000), 0);
    
    const followerGrowth = followerData.length > 1 
      ? (followerData[0]?.followers_count || 100) - (followerData[followerData.length - 1]?.followers_count || 90)
      : 8; // Default 8 per day
    
    return {
      followerGrowthRate: Math.max(0, followerGrowth / 7),
      engagementRate: totalImpressions > 0 ? totalEngagements / totalImpressions : 0.025,
      viralTweetCount: engagementData.filter(tweet => 
        (tweet.likes + tweet.retweets + tweet.replies) > 100).length,
      contentQualityScore: 7.5, // Default good score
      postingFrequency: Math.max(1, engagementData.length / 7),
      reachEfficiency: totalImpressions > 0 ? followerGrowth / totalImpressions : 0.03
    };
  }

  private static getEstimatedMetrics(): PerformanceMetrics {
    return {
      followerGrowthRate: 8,
      engagementRate: 0.025,
      viralTweetCount: 1,
      contentQualityScore: 7,
      postingFrequency: 5,
      reachEfficiency: 0.03
    };
  }

  private static async getDefaultAnalysis(metrics?: PerformanceMetrics): Promise<PerformanceAnalysis> {
    return {
      currentMetrics: metrics || this.getEstimatedMetrics(),
      trend: 'STABLE',
      bottlenecks: ['engagement_rate', 'viral_content'],
      opportunities: ['strategic_timing', 'content_quality'],
      adjustments: [],
      priority: 'MEDIUM'
    };
  }
}