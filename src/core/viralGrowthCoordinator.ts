/**
 * 🚀 VIRAL GROWTH COORDINATOR
 * ===========================
 * Master coordinator that orchestrates all viral growth systems for maximum follower acquisition.
 * Integrates existing sophisticated systems with optimal growth strategies.
 */

import { autonomousPostingEngine } from './autonomousPostingEngine';
import { supabaseClient } from '../utils/supabaseClient';
import { emergencyBudgetLockdown } from '../utils/emergencyBudgetLockdown';
import { DailyOptimizationLoop } from '../intelligence/dailyOptimizationLoop';
import { IntelligentGrowthMaster } from '../intelligence/intelligentGrowthMaster';

export interface ViralGrowthMetrics {
  followerGrowth24h: number;
  engagementRate: number;
  postsToday: number;
  viralHits: number;
  aiOptimizationScore: number;
  budgetEfficiency: number;
  systemHealth: 'excellent' | 'good' | 'warning' | 'critical';
}

export interface ViralGrowthConfig {
  targetDailyPosts: number;
  targetEngagementRate: number;
  targetFollowerGrowth: number;
  aiUsageRate: number;
  engagementAggressiveness: 'conservative' | 'balanced' | 'aggressive';
  optimizationFrequency: 'hourly' | 'daily' | 'weekly';
}

export class ViralGrowthCoordinator {
  private static instance: ViralGrowthCoordinator;
  private isActive = false;
  private growthConfig: ViralGrowthConfig;
  private lastOptimization: Date | null = null;
  private intervals: NodeJS.Timeout[] = [];

  private constructor() {
    this.growthConfig = this.getOptimalGrowthConfig();
  }

  static getInstance(): ViralGrowthCoordinator {
    if (!ViralGrowthCoordinator.instance) {
      ViralGrowthCoordinator.instance = new ViralGrowthCoordinator();
    }
    return ViralGrowthCoordinator.instance;
  }

  /**
   * 🚀 ACTIVATE VIRAL GROWTH MODE
   */
  async activateViralGrowth(): Promise<void> {
    if (this.isActive) {
      console.log('⚠️ Viral growth already active');
      return;
    }

    console.log('🚀 === ACTIVATING VIRAL GROWTH COORDINATOR ===');

    try {
      // 1. Validate system readiness
      await this.validateSystemReadiness();

      // 2. Initialize growth master and optimization loop
      const growthMaster = IntelligentGrowthMaster.getInstance();
      await growthMaster.initialize();

      const optimizationLoop = DailyOptimizationLoop.getInstance();

      // 3. Start coordinated growth cycles
      await this.startGrowthCycles();

      // 4. Initialize real-time monitoring
      this.startGrowthMonitoring();

      this.isActive = true;
      console.log('✅ Viral Growth Coordinator: ACTIVATED');
      console.log('🎯 Target: 8+ followers/day, 3.5%+ engagement, 8-25 posts/day');

    } catch (error) {
      console.error('❌ Failed to activate viral growth:', error);
      throw error;
    }
  }

  /**
   * 🛑 DEACTIVATE VIRAL GROWTH MODE
   */
  async deactivateViralGrowth(): Promise<void> {
    console.log('🛑 Deactivating viral growth coordinator...');
    
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];
    this.isActive = false;
    
    console.log('✅ Viral Growth Coordinator: DEACTIVATED');
  }

  /**
   * 🔄 START COORDINATED GROWTH CYCLES
   */
  private async startGrowthCycles(): Promise<void> {
    console.log('🔄 Starting coordinated growth cycles...');

    // Enhanced posting cycle (every 2-4 hours for optimal engagement)
    const postingInterval = setInterval(async () => {
      try {
        await this.executeIntelligentPost();
      } catch (error) {
        console.error('❌ Posting cycle error:', error);
      }
    }, 2.5 * 60 * 60 * 1000); // 2.5 hours

    // Engagement cycle (every 4 hours for human-like behavior)
    const engagementInterval = setInterval(async () => {
      try {
        await this.executeEngagementCycle();
      } catch (error) {
        console.error('❌ Engagement cycle error:', error);
      }
    }, 4 * 60 * 60 * 1000); // 4 hours

    // Optimization cycle (daily at 3 AM)
    const optimizationInterval = setInterval(async () => {
      const hour = new Date().getHours();
      if (hour === 3) { // 3 AM optimization
        try {
          await this.runDailyOptimization();
        } catch (error) {
          console.error('❌ Optimization cycle error:', error);
        }
      }
    }, 60 * 60 * 1000); // Check every hour

    this.intervals.push(postingInterval, engagementInterval, optimizationInterval);
    console.log('✅ All growth cycles started');
  }

  /**
   * 🧠 EXECUTE INTELLIGENT POST WITH VIRAL OPTIMIZATION
   */
  private async executeIntelligentPost(): Promise<void> {
    console.log('🧠 === EXECUTING INTELLIGENT VIRAL POST ===');

    try {
      // Check if we should post based on intelligent decision
      const postingDecision = await autonomousPostingEngine.makePostingDecision();
      
      if (!postingDecision.should_post) {
        console.log(`⏸️ Skipping post: ${postingDecision.reason}`);
        return;
      }

      // Get AI recommendations for optimal content
      const growthMaster = IntelligentGrowthMaster.getInstance();
      const recommendations = await growthMaster.getPostingRecommendations();

      console.log('🎯 AI Recommendations:');
      console.log(`   Optimal time: ${recommendations.postingTiming.nextOptimalTime}`);
      console.log(`   Priority topic: ${recommendations.contentStrategy.priorityTopic}`);
      console.log(`   Viral potential: ${recommendations.contentStrategy.viralPotential}%`);

      // Execute the post with AI optimization
      const result = await autonomousPostingEngine.executePost();

      if (result.success) {
        console.log('✅ Viral post executed successfully');
        console.log(`   Tweet ID: ${result.tweet_id}`);
        console.log(`   Confirmed: ${result.confirmed}`);
        
        // Store performance prediction for learning
        await this.storePostPrediction(result.tweet_id!, recommendations);
      } else {
        console.error('❌ Viral post failed:', result.error);
      }

    } catch (error) {
      console.error('❌ Intelligent posting error:', error);
    }
  }

  /**
   * 🤝 EXECUTE ENGAGEMENT CYCLE
   */
  private async executeEngagementCycle(): Promise<void> {
    console.log('🤝 === EXECUTING VIRAL ENGAGEMENT CYCLE ===');

    try {
      // Get intelligent engagement recommendations
      const growthMaster = IntelligentGrowthMaster.getInstance();
      const recommendations = await growthMaster.getPostingRecommendations();

      console.log('🎯 Engagement Strategy:');
      recommendations.engagementActions.forEach((action, index) => {
        console.log(`   ${index + 1}. ${action.actionType} @${action.targetInfluencer} (ROI: ${action.expectedROI})`);
      });

      // Let the master controller handle engagement with our viral focus
      // The existing engagement engine already targets health influencers optimally

      console.log('✅ Viral engagement cycle initiated');

    } catch (error) {
      console.error('❌ Engagement cycle error:', error);
    }
  }

  /**
   * 📊 RUN DAILY OPTIMIZATION
   */
  private async runDailyOptimization(): Promise<void> {
    console.log('📊 === RUNNING DAILY VIRAL OPTIMIZATION ===');

    try {
      const optimizationLoop = DailyOptimizationLoop.getInstance();
      const report = await optimizationLoop.runDailyOptimization();

      console.log('📈 Optimization Report:');
      console.log(`   Follower Growth: ${report.performanceAnalysis.followerGrowth}`);
      console.log(`   Engagement Rate: ${report.performanceAnalysis.engagementRate}%`);
      console.log(`   Viral Tweets: ${report.performanceAnalysis.viralTweets}`);
      console.log(`   Top Topics: ${report.performanceAnalysis.topPerformingTopics.join(', ')}`);

      // Store optimization results
      await this.storeOptimizationReport(report);

      this.lastOptimization = new Date();
      console.log('✅ Daily optimization complete');

    } catch (error) {
      console.error('❌ Daily optimization error:', error);
    }
  }

  /**
   * 📊 START GROWTH MONITORING
   */
  private startGrowthMonitoring(): void {
    console.log('📊 Starting viral growth monitoring...');

    // Monitor every 15 minutes
    const monitoringInterval = setInterval(async () => {
      try {
        const metrics = await this.getViralGrowthMetrics();
        await this.updateGrowthDashboard(metrics);
        
        // Auto-adjust strategy based on performance
        await this.autoAdjustStrategy(metrics);
        
      } catch (error) {
        console.error('❌ Growth monitoring error:', error);
      }
    }, 15 * 60 * 1000); // 15 minutes

    this.intervals.push(monitoringInterval);
    console.log('✅ Growth monitoring started');
  }

  /**
   * 📈 GET VIRAL GROWTH METRICS
   */
  async getViralGrowthMetrics(): Promise<ViralGrowthMetrics> {
    try {
      // Get recent performance data
      const { data: recentPosts } = await supabaseClient.supabase
        .from('tweets')
        .select('*')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      const { data: performance } = await supabaseClient.supabase
        .from('tweet_performance_analysis')
        .select('*')
        .gte('posting_time', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      // Calculate metrics
      const postsToday = recentPosts?.length || 0;
      const avgEngagement = performance?.length ? 
        performance.reduce((sum, p) => sum + (p.engagement_rate || 0), 0) / performance.length : 0;
      
      const viralHits = performance?.filter(p => (p.engagement_rate || 0) > 0.05).length || 0;

      // Budget efficiency  
      const budgetStatus = await emergencyBudgetLockdown.isLockedDown();
      const budgetEfficiency = budgetStatus.lockdownActive ? 0 : 0.8; // Assume good efficiency if not locked

      // System health assessment
      let systemHealth: ViralGrowthMetrics['systemHealth'] = 'excellent';
      if (postsToday < 3) systemHealth = 'warning';
      if (avgEngagement < 0.02) systemHealth = 'warning';
      if (budgetEfficiency < 0.2) systemHealth = 'critical';

      return {
        followerGrowth24h: 0, // Would integrate with Twitter API
        engagementRate: avgEngagement,
        postsToday,
        viralHits,
        aiOptimizationScore: this.lastOptimization ? 85 : 60,
        budgetEfficiency,
        systemHealth
      };

    } catch (error) {
      console.error('❌ Error getting growth metrics:', error);
      return {
        followerGrowth24h: 0,
        engagementRate: 0,
        postsToday: 0,
        viralHits: 0,
        aiOptimizationScore: 0,
        budgetEfficiency: 0,
        systemHealth: 'critical'
      };
    }
  }

  /**
   * 🎯 AUTO-ADJUST STRATEGY BASED ON PERFORMANCE
   */
  private async autoAdjustStrategy(metrics: ViralGrowthMetrics): Promise<void> {
    if (metrics.systemHealth === 'critical') {
      console.log('🚨 Critical performance detected - adjusting strategy');
      
      // Reduce posting frequency if engagement is low
      if (metrics.engagementRate < 0.015) {
        this.growthConfig.targetDailyPosts = Math.max(5, this.growthConfig.targetDailyPosts - 2);
        console.log(`📉 Reduced daily posts target to ${this.growthConfig.targetDailyPosts}`);
      }
    } else if (metrics.systemHealth === 'excellent') {
      // Increase posting if performance is excellent
      if (metrics.engagementRate > 0.04 && metrics.viralHits > 2) {
        this.growthConfig.targetDailyPosts = Math.min(25, this.growthConfig.targetDailyPosts + 1);
        console.log(`📈 Increased daily posts target to ${this.growthConfig.targetDailyPosts}`);
      }
    }
  }

  /**
   * 💾 STORE POST PREDICTION FOR LEARNING
   */
  private async storePostPrediction(tweetId: string, recommendations: any): Promise<void> {
    try {
      await supabaseClient.supabase
        .from('viral_predictions')
        .insert({
          tweet_id: tweetId,
          predicted_engagement: recommendations.contentStrategy.viralPotential / 100,
          predicted_topic_performance: recommendations.contentStrategy.priorityTopic,
          optimal_timing_confidence: recommendations.postingTiming.confidence,
          ai_reasoning: recommendations.contentStrategy.reasoning,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.warn('⚠️ Could not store viral prediction:', error.message);
    }
  }

  /**
   * 📊 STORE OPTIMIZATION REPORT
   */
  private async storeOptimizationReport(report: any): Promise<void> {
    try {
      await supabaseClient.supabase
        .from('daily_optimization_reports')
        .insert({
          optimization_date: report.optimizationDate,
          follower_growth: report.performanceAnalysis.followerGrowth,
          engagement_rate: report.performanceAnalysis.engagementRate,
          viral_tweets: report.performanceAnalysis.viralTweets,
          top_topics: report.performanceAnalysis.topPerformingTopics,
          strategic_changes: report.strategicChanges,
          recommendations: report.recommendations,
          confidence_score: report.expectedImpact.confidenceScore,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.warn('⚠️ Could not store optimization report:', error.message);
    }
  }

  /**
   * 📊 UPDATE GROWTH DASHBOARD
   */
  private async updateGrowthDashboard(metrics: ViralGrowthMetrics): Promise<void> {
    // Update runtime config for dashboard display
    try {
      const { RuntimeConfigManager } = await import('../utils/runtimeConfigManager');
      await RuntimeConfigManager.set('viral_growth_metrics', {
        ...metrics,
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      // Ignore duplicate key errors - they're harmless for dashboard updates
      if (error.message?.includes('duplicate key') || 
          error.message?.includes('already exists') || 
          error.code === '23505') {
        // Silently ignore - UPSERT should handle this but sometimes logs still show
        return;
      } else {
        console.warn('⚠️ Could not update dashboard:', error.message);
      }
    }
  }

  /**
   * ⚙️ VALIDATE SYSTEM READINESS
   */
  private async validateSystemReadiness(): Promise<void> {
    console.log('⚙️ Validating viral growth system readiness...');

    // Check environment variables
    const requiredVars = [
      'BOT_PHASE', 'ENABLE_ELITE_STRATEGIST', 'ENABLE_AUTO_ENGAGEMENT',
      'OPENAI_API_KEY', 'SUPABASE_URL'
    ];

    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    // Validate bot phase
    if (process.env.BOT_PHASE !== 'growth_mode') {
      console.warn('⚠️ BOT_PHASE is not set to growth_mode, viral growth may be limited');
    }

    // Check database connectivity
    const { data, error } = await supabaseClient.supabase
      .from('bot_config')
      .select('key')
      .limit(1);

    if (error) {
      throw new Error(`Database connectivity failed: ${error.message}`);
    }

    console.log('✅ System readiness validated');
  }

  /**
   * ⚙️ GET OPTIMAL GROWTH CONFIG
   */
  private getOptimalGrowthConfig(): ViralGrowthConfig {
    return {
      targetDailyPosts: parseInt(process.env.MAX_DAILY_POSTS || '15'),
      targetEngagementRate: parseFloat(process.env.TARGET_ENGAGEMENT_RATE || '0.035'),
      targetFollowerGrowth: parseInt(process.env.TARGET_DAILY_FOLLOWER_GROWTH || '8'),
      aiUsageRate: parseFloat(process.env.STRATEGIST_USAGE_RATE || '0.8'),
      engagementAggressiveness: 'aggressive',
      optimizationFrequency: 'daily'
    };
  }

  /**
   * 📊 GET CURRENT STATUS
   */
  getStatus(): {
    isActive: boolean;
    config: ViralGrowthConfig;
    lastOptimization: Date | null;
    activeIntervals: number;
  } {
    return {
      isActive: this.isActive,
      config: this.growthConfig,
      lastOptimization: this.lastOptimization,
      activeIntervals: this.intervals.length
    };
  }
}

export const viralGrowthCoordinator = ViralGrowthCoordinator.getInstance();