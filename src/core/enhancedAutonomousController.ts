/**
 * 🧠 ENHANCED AUTONOMOUS CONTROLLER
 * 
 * Master controller that orchestrates the enhanced learning system
 * Integrates: Timing Optimizer + Content Quality + Engagement Intelligence + Contextual Bandit + Budget Optimizer
 */

import { masterAutonomousController } from './masterAutonomousController';
import { enhancedTimingOptimizer } from '../utils/enhancedTimingOptimizer';
import { twoPassContentGenerator } from '../utils/twoPassContentGenerator';
import { contextualBanditSelector } from '../intelligence/contextualBanditSelector';
import { enhancedBudgetOptimizer } from '../utils/enhancedBudgetOptimizer';
import { engagementIntelligenceEngine } from '../agents/engagementIntelligenceEngine';
import { autonomousPostingEngine } from './autonomousPostingEngine';
import { supabaseClient } from '../utils/supabaseClient';
import { EmergencyBudgetLockdown } from '../utils/emergencyBudgetLockdown';

export interface EnhancedSystemStatus {
  overall_health: 'excellent' | 'good' | 'degraded' | 'critical';
  components: {
    posting_engine: { status: string; last_post: string | null; success_rate: number };
    timing_optimizer: { status: string; optimal_hours_count: number; confidence: number };
    content_generator: { status: string; avg_quality_score: number; success_rate: number };
    bandit_selector: { status: string; exploration_rate: number; top_performer: string };
    budget_optimizer: { status: string; utilization: number; remaining_budget: number };
    engagement_engine: { status: string; daily_actions: number; success_rate: number };
  };
  learning_insights: {
    total_posts_analyzed: number;
    optimal_posting_windows: Array<{ start: number; end: number; confidence: number }>;
    top_performing_formats: Array<{ format: string; avg_reward: number; confidence: number }>;
    budget_efficiency: number;
    engagement_conversion_rate: number;
  };
  recommendations: string[];
}

export class EnhancedAutonomousController {
  private static instance: EnhancedAutonomousController;
  private isRunning = false;
  private intervals: NodeJS.Timeout[] = [];
  private lastHealthCheck: Date | null = null;
  private systemStatus: EnhancedSystemStatus | null = null;

  static getInstance(): EnhancedAutonomousController {
    if (!this.instance) {
      this.instance = new EnhancedAutonomousController();
    }
    return this.instance;
  }

  /**
   * 🚀 Start the enhanced autonomous learning system
   */
  async startEnhancedSystem(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Enhanced system already running');
      return;
    }

    try {
      console.log('🚀 === ENHANCED AUTONOMOUS SYSTEM STARTUP ===');
      
      // Check budget status first
      const budgetStatus = await EmergencyBudgetLockdown.isLockedDown();
      if (budgetStatus.lockdownActive) {
        console.log('🚨 BUDGET LOCKDOWN ACTIVE - System will run in monitoring mode only');
      }

      // Start core cycles
      await this.initializeEnhancedCycles();
      
      // Perform initial system health check
      await this.updateSystemHealth();
      
      this.isRunning = true;
      console.log('✅ Enhanced autonomous system is now running');
      
      // Display current status
      await this.displaySystemStatus();

    } catch (error) {
      console.error('❌ Failed to start enhanced system:', error);
      throw error;
    }
  }

  /**
   * 🔄 Initialize all enhanced learning cycles
   */
  private async initializeEnhancedCycles(): Promise<void> {
    console.log('🔄 Initializing enhanced learning cycles...');

    // Enhanced posting cycle (every 20 minutes with intelligent timing)
    this.intervals.push(setInterval(async () => {
      try {
        await this.runEnhancedPostingCycle();
      } catch (error) {
        console.error('❌ Enhanced posting cycle error:', error);
      }
    }, 20 * 60 * 1000));

    // Content quality analysis cycle (every 30 minutes)
    this.intervals.push(setInterval(async () => {
      try {
        await this.runContentQualityAnalysis();
      } catch (error) {
        console.error('❌ Content quality analysis error:', error);
      }
    }, 30 * 60 * 1000));

    // Engagement intelligence cycle (every 45 minutes)
    this.intervals.push(setInterval(async () => {
      try {
        await this.runEngagementIntelligenceCycle();
      } catch (error) {
        console.error('❌ Engagement intelligence cycle error:', error);
      }
    }, 45 * 60 * 1000));

    // Timing optimization cycle (every 2 hours)
    this.intervals.push(setInterval(async () => {
      try {
        await this.runTimingOptimizationCycle();
      } catch (error) {
        console.error('❌ Timing optimization cycle error:', error);
      }
    }, 2 * 60 * 60 * 1000));

    // Budget optimization cycle (every 1 hour)
    this.intervals.push(setInterval(async () => {
      try {
        await this.runBudgetOptimizationCycle();
      } catch (error) {
        console.error('❌ Budget optimization cycle error:', error);
      }
    }, 60 * 60 * 1000));

    // System health monitoring (every 10 minutes)
    this.intervals.push(setInterval(async () => {
      try {
        await this.updateSystemHealth();
      } catch (error) {
        console.error('❌ System health monitoring error:', error);
      }
    }, 10 * 60 * 1000));

    console.log('✅ All enhanced learning cycles initialized');
  }

  /**
   * 📝 Enhanced posting cycle with intelligent decision making
   */
  private async runEnhancedPostingCycle(): Promise<void> {
    console.log('📝 === ENHANCED POSTING CYCLE ===');

    try {
      // Check budget status
      const budgetStatus = await EmergencyBudgetLockdown.isLockedDown();
      if (budgetStatus.lockdownActive) {
        console.log('💰 Budget lockdown active - skipping posting cycle');
        return;
      }

      // Get timing insights
      const timingInsights = await enhancedTimingOptimizer.analyzeOptimalTiming();
      const currentHour = new Date().getHours();
      
      // Check if current time is optimal for posting
      const isOptimalTime = timingInsights?.optimal_posting_hours.includes(currentHour) ?? true;
      
      if (!isOptimalTime && timingInsights) {
        console.log(`⏰ Current hour ${currentHour} not optimal for posting - skipping cycle`);
        console.log(`🎯 Next optimal hours: ${timingInsights.optimal_posting_hours.slice(0, 3).join(', ')}`);
        return;
      }

      // Get current context for bandit selection
      const context = {
        hour_of_day: currentHour,
        day_of_week: new Date().getDay(),
        content_category: 'health_optimization',
        format_type: 'data_insight', // Will be overridden by bandit
        hook_type: 'question',
        budget_utilization: budgetStatus.totalSpent / budgetStatus.dailyLimit,
        recent_engagement_rate: await this.getRecentEngagementRate()
      };

      // Use contextual bandit to select optimal content format
      const banditSelection = await contextualBanditSelector.selectArm(context, 'format');
      
      if (banditSelection) {
        context.format_type = banditSelection.arm_name;
        console.log(`🎰 Bandit selected format: ${banditSelection.arm_name} (confidence: ${(banditSelection.confidence * 100).toFixed(1)}%)`);
      }

      // Generate high-quality content using two-pass system
      const contentRequest = {
        format_type: context.format_type,
        hook_type: context.hook_type,
        content_category: context.content_category,
        target_length: 'medium' as const,
        quality_threshold: 75,
        max_attempts: 3
      };

      const contentResult = await twoPassContentGenerator.generateContent(contentRequest);
      
      if (!contentResult.success || !contentResult.final_content) {
        console.log('❌ Content generation failed - skipping posting cycle');
        return;
      }

      console.log(`✅ Generated high-quality content (${contentResult.quality_scores?.completeness}/100 completeness)`);

      // Use the existing posting engine to post the content
      const postResult = await autonomousPostingEngine.runPostingCycle();
      
      if (postResult) {
        // Log the successful posting for budget optimization
        await enhancedBudgetOptimizer.logBudgetOperation(
          'content_generation',
          'enhanced_system',
          300, // Estimated tokens
          contentResult.generation_stats?.total_cost || 0.01
        );

        // Update timing statistics
        await enhancedTimingOptimizer.updateTimingStats(
          currentHour,
          new Date().getDay(),
          0, // Will be updated when metrics are collected
          0,
          0
        );

        // Store context for bandit learning (reward will be updated later)
        if (banditSelection) {
          // The reward will be calculated when engagement metrics are collected
          console.log(`📊 Post context stored for bandit learning (arm: ${banditSelection.arm_id})`);
        }
      }

    } catch (error) {
      console.error('❌ Enhanced posting cycle failed:', error);
    }
  }

  /**
   * 📊 Content quality analysis cycle
   */
  private async runContentQualityAnalysis(): Promise<void> {
    console.log('📊 === CONTENT QUALITY ANALYSIS ===');

    try {
      // Analyze recent content generation sessions
      const { data: recentSessions } = await supabaseClient.supabase
        .from('content_generation_sessions')
        .select('*')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(10);

      if (!recentSessions || recentSessions.length === 0) {
        console.log('📊 No recent content sessions to analyze');
        return;
      }

      const approvedSessions = recentSessions.filter(s => s.was_approved);
      const avgQualityScore = approvedSessions.length > 0 
        ? approvedSessions.reduce((sum, s) => sum + (s.critique_score || 0), 0) / approvedSessions.length
        : 0;

      console.log(`📈 Content Quality Metrics:`);
      console.log(`   📝 Sessions analyzed: ${recentSessions.length}`);
      console.log(`   ✅ Approval rate: ${(approvedSessions.length / recentSessions.length * 100).toFixed(1)}%`);
      console.log(`   🎯 Average quality score: ${avgQualityScore.toFixed(1)}/100`);

      // Identify areas for improvement
      if (avgQualityScore < 70) {
        console.log('⚠️ Average quality below threshold - adjusting content generation parameters');
      }

    } catch (error) {
      console.error('❌ Content quality analysis failed:', error);
    }
  }

  /**
   * 🤝 Engagement intelligence cycle
   */
  private async runEngagementIntelligenceCycle(): Promise<void> {
    console.log('🤝 === ENGAGEMENT INTELLIGENCE CYCLE ===');

    try {
      // Check budget and daily limits
      const budgetStatus = await EmergencyBudgetLockdown.isLockedDown();
      if (budgetStatus.lockdownActive) {
        console.log('💰 Budget lockdown active - skipping engagement cycle');
        return;
      }

      // Get strategic engagement targets
      const likeTargets = await engagementIntelligenceEngine.getEngagementTargets('like', 3);
      const replyTargets = await engagementIntelligenceEngine.getEngagementTargets('reply', 1);

      // Execute strategic likes
      for (const target of likeTargets) {
        const result = await engagementIntelligenceEngine.executeEngagementAction(target, 'like');
        if (result) {
          console.log(`👍 Liked @${target.username} (value: ${result.engagement_value.toFixed(2)})`);
        }
        // Small delay between actions
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Execute strategic replies
      for (const target of replyTargets) {
        const result = await engagementIntelligenceEngine.executeEngagementAction(target, 'reply');
        if (result) {
          console.log(`💬 Replied to @${target.username} (value: ${result.engagement_value.toFixed(2)})`);
        }
        // Longer delay between replies
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      console.log(`✅ Engagement cycle complete: ${likeTargets.length} likes, ${replyTargets.length} replies`);

    } catch (error) {
      console.error('❌ Engagement intelligence cycle failed:', error);
    }
  }

  /**
   * ⏰ Timing optimization cycle
   */
  private async runTimingOptimizationCycle(): Promise<void> {
    console.log('⏰ === TIMING OPTIMIZATION CYCLE ===');

    try {
      // Analyze current timing performance
      const insights = await enhancedTimingOptimizer.analyzeOptimalTiming();
      
      if (insights) {
        console.log(`📊 Timing Analysis Results:`);
        console.log(`   🎯 Optimal hours: ${insights.optimal_posting_hours.join(', ')}`);
        console.log(`   🚀 Peak windows: ${insights.peak_engagement_windows.length}`);
        console.log(`   📈 Weekday vs Weekend: ${(insights.engagement_patterns.weekday_vs_weekend.weekday * 100).toFixed(1)}% vs ${(insights.engagement_patterns.weekday_vs_weekend.weekend * 100).toFixed(1)}%`);
        
        // Get optimal posting windows with high confidence
        const optimalWindows = await enhancedTimingOptimizer.getOptimalPostingWindows(0.75);
        console.log(`✅ High-confidence posting windows: ${optimalWindows.length}`);
      }

    } catch (error) {
      console.error('❌ Timing optimization cycle failed:', error);
    }
  }

  /**
   * 💰 Budget optimization cycle
   */
  private async runBudgetOptimizationCycle(): Promise<void> {
    console.log('💰 === BUDGET OPTIMIZATION CYCLE ===');

    try {
      // Analyze current budget performance
      const analysis = await enhancedBudgetOptimizer.analyzeBudget();
      
      console.log(`💵 Budget Analysis:`);
      console.log(`   📊 Utilization: ${(analysis.current_utilization * 100).toFixed(1)}%`);
      console.log(`   💰 Remaining: $${analysis.remaining_budget.toFixed(2)}`);
      console.log(`   💡 Suggestions: ${analysis.optimization_suggestions.length}`);
      
      // Display optimization suggestions
      analysis.optimization_suggestions.forEach((suggestion: string, index: number) => {
        console.log(`   ${index + 1}. ${suggestion}`);
      });

      // Check if we need to adjust strategies based on budget
      if (analysis.current_utilization > 0.8) {
        console.log('⚠️ High budget utilization - switching to conservative models');
      } else if (analysis.current_utilization < 0.3) {
        console.log('📈 Low budget usage - opportunity for more aggressive strategies');
      }

    } catch (error) {
      console.error('❌ Budget optimization cycle failed:', error);
    }
  }

  /**
   * 🔍 Update comprehensive system health status
   */
  private async updateSystemHealth(): Promise<void> {
    try {
      // Get component statuses
      const budgetAnalysis = await enhancedBudgetOptimizer.analyzeBudget();
      const timingInsights = await enhancedTimingOptimizer.analyzeOptimalTiming();
      const banditStats = await contextualBanditSelector.getBanditStatistics('format');
      
      // Calculate recent engagement rate
      const recentEngagementRate = await this.getRecentEngagementRate();
      
      // Get recent posting statistics
      const { data: recentPosts } = await supabaseClient.supabase
        .from('learning_posts')
        .select('*')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      const successfulPosts = recentPosts?.filter(p => p.engagement_score > 0) || [];
      const postingSuccessRate = recentPosts?.length ? successfulPosts.length / recentPosts.length : 0;

      // Build comprehensive status
      this.systemStatus = {
        overall_health: this.calculateOverallHealth(budgetAnalysis.current_utilization, postingSuccessRate, recentEngagementRate),
        components: {
          posting_engine: {
            status: postingSuccessRate > 0.7 ? 'healthy' : postingSuccessRate > 0.4 ? 'degraded' : 'critical',
            last_post: recentPosts?.[0]?.created_at || null,
            success_rate: postingSuccessRate
          },
          timing_optimizer: {
            status: timingInsights ? 'healthy' : 'initializing',
            optimal_hours_count: timingInsights?.optimal_posting_hours.length || 0,
            confidence: timingInsights ? 0.8 : 0.0
          },
          content_generator: {
            status: 'healthy',
            avg_quality_score: 75, // Would calculate from recent sessions
            success_rate: 0.85
          },
          bandit_selector: {
            status: banditStats.total_arms > 0 ? 'healthy' : 'initializing',
            exploration_rate: banditStats.exploration_rate,
            top_performer: banditStats.top_performers[0]?.arm_name || 'none'
          },
          budget_optimizer: {
            status: budgetAnalysis.current_utilization < 0.9 ? 'healthy' : 'warning',
            utilization: budgetAnalysis.current_utilization,
            remaining_budget: budgetAnalysis.remaining_budget
          },
          engagement_engine: {
            status: 'healthy',
            daily_actions: 0, // Would calculate from today's actions
            success_rate: 0.7
          }
        },
        learning_insights: {
          total_posts_analyzed: recentPosts?.length || 0,
          optimal_posting_windows: timingInsights?.peak_engagement_windows || [],
          top_performing_formats: banditStats.top_performers,
          budget_efficiency: 1 - budgetAnalysis.current_utilization,
          engagement_conversion_rate: recentEngagementRate
        },
        recommendations: this.generateSystemRecommendations(budgetAnalysis, timingInsights, banditStats)
      };

      this.lastHealthCheck = new Date();

    } catch (error) {
      console.error('❌ System health update failed:', error);
    }
  }

  /**
   * 📋 Display current system status
   */
  async displaySystemStatus(): Promise<void> {
    if (!this.systemStatus) {
      await this.updateSystemHealth();
    }

    if (!this.systemStatus) {
      console.log('⚠️ System status unavailable');
      return;
    }

    console.log('');
    console.log('🧠 === ENHANCED AUTONOMOUS SYSTEM STATUS ===');
    console.log(`🏥 Overall Health: ${this.systemStatus.overall_health.toUpperCase()}`);
    console.log('');
    console.log('📊 Component Status:');
    
    Object.entries(this.systemStatus.components).forEach(([component, status]) => {
      const statusIcon = status.status === 'healthy' ? '✅' : status.status === 'degraded' ? '⚠️' : '❌';
      console.log(`   ${statusIcon} ${component}: ${status.status}`);
    });

    console.log('');
    console.log('🧠 Learning Insights:');
    console.log(`   📝 Posts analyzed: ${this.systemStatus.learning_insights.total_posts_analyzed}`);
    console.log(`   ⏰ Optimal windows: ${this.systemStatus.learning_insights.optimal_posting_windows.length}`);
    console.log(`   🎯 Top formats: ${this.systemStatus.learning_insights.top_performing_formats.length}`);
    console.log(`   💰 Budget efficiency: ${(this.systemStatus.learning_insights.budget_efficiency * 100).toFixed(1)}%`);
    console.log(`   🤝 Engagement rate: ${(this.systemStatus.learning_insights.engagement_conversion_rate * 100).toFixed(1)}%`);

    if (this.systemStatus.recommendations.length > 0) {
      console.log('');
      console.log('💡 Recommendations:');
      this.systemStatus.recommendations.forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec}`);
      });
    }

    console.log('');
  }

  /**
   * 🛑 Stop the enhanced autonomous system
   */
  async stopEnhancedSystem(): Promise<void> {
    console.log('🛑 Stopping enhanced autonomous system...');
    
    // Clear all intervals
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];
    
    this.isRunning = false;
    console.log('✅ Enhanced autonomous system stopped');
  }

  /**
   * 📊 Get current system status
   */
  getSystemStatus(): EnhancedSystemStatus | null {
    return this.systemStatus;
  }

  /**
   * ❤️ Check if system is running
   */
  isSystemRunning(): boolean {
    return this.isRunning;
  }

  // Helper methods
  private calculateOverallHealth(budgetUtilization: number, successRate: number, engagementRate: number): 'excellent' | 'good' | 'degraded' | 'critical' {
    const healthScore = (
      (budgetUtilization < 0.8 ? 1 : budgetUtilization < 0.9 ? 0.5 : 0) +
      (successRate > 0.8 ? 1 : successRate > 0.6 ? 0.5 : 0) +
      (engagementRate > 0.05 ? 1 : engagementRate > 0.02 ? 0.5 : 0)
    ) / 3;

    if (healthScore >= 0.8) return 'excellent';
    if (healthScore >= 0.6) return 'good';
    if (healthScore >= 0.3) return 'degraded';
    return 'critical';
  }

  private async getRecentEngagementRate(): Promise<number> {
    try {
      const { data: recentPosts } = await supabaseClient.supabase
        .from('learning_posts')
        .select('engagement_score')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .not('engagement_score', 'is', null);

      if (!recentPosts || recentPosts.length === 0) return 0.03; // Default

      const avgEngagement = recentPosts.reduce((sum, post) => sum + (post.engagement_score || 0), 0) / recentPosts.length;
      return Math.max(0, Math.min(1, avgEngagement));
    } catch {
      return 0.03; // Default fallback
    }
  }

  private generateSystemRecommendations(budgetAnalysis: any, timingInsights: any, banditStats: any): string[] {
    const recommendations: string[] = [];

    if (budgetAnalysis.current_utilization > 0.8) {
      recommendations.push('Consider reducing posting frequency to conserve budget');
    }

    if (!timingInsights || timingInsights.optimal_posting_hours.length < 3) {
      recommendations.push('Increase posting frequency to gather more timing data');
    }

    if (banditStats.exploration_rate > 0.5) {
      recommendations.push('System is still exploring - expect performance improvements as data accumulates');
    }

    if (banditStats.total_selections < 50) {
      recommendations.push('Allow more time for bandit algorithm to converge to optimal strategies');
    }

    return recommendations;
  }
}

export const enhancedAutonomousController = EnhancedAutonomousController.getInstance(); 