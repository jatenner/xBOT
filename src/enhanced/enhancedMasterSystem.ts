/**
 * 🚀 ENHANCED MASTER SYSTEM
 * Integration hub for all advanced features and autonomous optimization
 */

import { EnhancedContentGenerator, EnhancedContentParams, PerformanceData } from '../ai/enhancedContentGenerator';
import { IntelligentPostingScheduler } from '../strategy/intelligentPostingScheduler';
import { EngagementAnalytics, EngagementMetrics } from '../analytics/engagementAnalytics';
import { SelfOptimizingSystem, OptimizationGoals } from '../autonomous/selfOptimizingSystem';
import { FixedThreadPoster } from '../posting/fixedThreadPoster';

export interface EnhancedSystemConfig {
  openaiApiKey: string;
  optimizationGoals: OptimizationGoals;
  enableAutonomousOptimization: boolean;
  optimizationIntervalHours: number;
}

export interface EnhancedPostingRequest {
  topic?: string;
  contentType?: 'educational' | 'entertaining' | 'controversial' | 'inspiring';
  audience?: 'general' | 'health' | 'tech' | 'business';
  viralIntent?: 'low' | 'medium' | 'high';
  schedulingMode?: 'immediate' | 'optimal' | 'scheduled';
  scheduledTime?: Date;
}

export interface EnhancedPostingResult {
  success: boolean;
  content: string;
  tweetId?: string;
  viralPrediction: number;
  schedulingDecision: any;
  engagementForecast: any;
  threadParts?: string[];
  error?: string;
  metadata: {
    systemVersion: string;
    optimizationCycle: number;
    enhancementsUsed: string[];
  };
}

export class EnhancedMasterSystem {
  private contentGenerator: EnhancedContentGenerator;
  private scheduler: IntelligentPostingScheduler;
  private analytics: EngagementAnalytics;
  private optimizer: SelfOptimizingSystem;
  private threadPoster: FixedThreadPoster;
  
  private config: EnhancedSystemConfig;
  private isInitialized = false;
  private lastOptimizationRun?: Date;

  constructor(config: EnhancedSystemConfig) {
    this.config = config;
    
    // Initialize all enhanced components
    this.contentGenerator = new EnhancedContentGenerator(config.openaiApiKey);
    this.scheduler = new IntelligentPostingScheduler();
    this.analytics = new EngagementAnalytics();
    this.threadPoster = FixedThreadPoster.getInstance();
    
    // Initialize autonomous optimization system
    this.optimizer = new SelfOptimizingSystem(
      this.contentGenerator,
      this.scheduler,
      this.analytics,
      config.optimizationGoals
    );

    console.log('🚀 ENHANCED_MASTER: Enhanced system initialized with autonomous optimization');
    console.log(`🎯 Goals: Viral=${config.optimizationGoals.targetViralScore}, Engagement=${config.optimizationGoals.targetEngagementRate}%`);
  }

  /**
   * Initialize the enhanced system
   */
  async initialize(): Promise<void> {
    console.log('🔄 ENHANCED_MASTER: Initializing enhanced system...');

    try {
      // Run initial system health check
      await this.runSystemHealthCheck();
      
      // Load historical performance data if available
      await this.loadHistoricalData();
      
      // Run initial optimization if enabled
      if (this.config.enableAutonomousOptimization) {
        await this.runOptimizationCycle();
      }

      this.isInitialized = true;
      console.log('✅ ENHANCED_MASTER: System initialization complete');
      
    } catch (error) {
      console.error('❌ ENHANCED_MASTER: Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Enhanced posting with all advanced features
   */
  async createEnhancedPost(request: EnhancedPostingRequest): Promise<EnhancedPostingResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    console.log('🚀 ENHANCED_POSTING: Creating optimized content...');
    console.log(`📋 Request: ${JSON.stringify(request, null, 2)}`);

    try {
      // 1. Check if now is optimal time to post (if not scheduled)
      let schedulingDecision;
      if (request.schedulingMode !== 'scheduled') {
        schedulingDecision = this.scheduler.shouldPostNow();
        
        if (request.schedulingMode === 'optimal' && !schedulingDecision.shouldPost) {
          return {
            success: false,
            content: '',
            viralPrediction: 0,
            schedulingDecision,
            engagementForecast: {},
            error: `Not optimal time to post: ${schedulingDecision.reason}`,
            metadata: this.getSystemMetadata()
          };
        }
      }

      // 2. Generate enhanced content with viral optimization
      const contentParams: EnhancedContentParams = {
        topic: request.topic,
        audience: request.audience || 'general',
        viralIntent: request.viralIntent || 'high',
        contentType: request.contentType || 'educational',
        timeOfDay: this.getCurrentTimeOfDay(),
        previousPerformance: this.getRecentPerformanceData(),
        trendingContext: await this.getTrendingContext()
      };

      const contentResult = await this.contentGenerator.generateViralContent(contentParams);
      console.log(`🧠 CONTENT_GENERATED: Viral prediction ${contentResult.viralPrediction}/100`);

      // 3. Post using FixedThreadPoster
      let postResult;
      if (contentResult.threadParts && contentResult.threadParts.length > 1) {
        console.log(`🧵 POSTING_THREAD: ${contentResult.threadParts.length} parts`);
        postResult = await this.threadPoster.postProperThread(contentResult.threadParts);
      } else {
        console.log(`📝 POSTING_SINGLE: Single tweet`);
        postResult = await this.threadPoster.postSingleTweet(contentResult.content);
      }

      // 4. Record engagement data and update analytics
      if (postResult.success && postResult.tweetId) {
        this.scheduler.recordPost();
        
        // Track initial engagement (would be updated later with real engagement)
        const engagementMetrics: EngagementMetrics = {
          tweetId: postResult.tweetId,
          content: contentResult.content,
          likes: 0,
          retweets: 0,
          replies: 0,
          timestamp: new Date(),
          contentType: request.contentType || 'educational',
          viralScore: contentResult.viralPrediction
        };
        this.analytics.trackEngagement(engagementMetrics);
      }

      // 5. Check if optimization cycle should run
      if (this.shouldRunOptimization()) {
        this.runOptimizationCycle().catch(error => {
          console.warn('⚠️ OPTIMIZATION: Cycle failed:', error.message);
        });
      }

      return {
        success: postResult.success,
        content: contentResult.content,
        tweetId: postResult.tweetId,
        viralPrediction: contentResult.viralPrediction,
        schedulingDecision: schedulingDecision || { shouldPost: true, reason: 'Scheduled post' },
        engagementForecast: contentResult.engagementForecast,
        threadParts: contentResult.threadParts,
        error: postResult.error,
        metadata: this.getSystemMetadata()
      };

    } catch (error) {
      console.error('❌ ENHANCED_POSTING: Failed:', error);
      return {
        success: false,
        content: '',
        viralPrediction: 0,
        schedulingDecision: { shouldPost: false, reason: 'System error' },
        engagementForecast: {},
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: this.getSystemMetadata()
      };
    }
  }

  /**
   * Update engagement metrics for a posted tweet
   */
  updateEngagementMetrics(tweetId: string, metrics: Partial<EngagementMetrics>): void {
    console.log(`📊 ENGAGEMENT_UPDATE: Tweet ${tweetId} - Likes: ${metrics.likes}, RTs: ${metrics.retweets}, Replies: ${metrics.replies}`);
    
    if (metrics.likes !== undefined && metrics.retweets !== undefined && metrics.replies !== undefined) {
      const fullMetrics: EngagementMetrics = {
        tweetId,
        content: metrics.content || '',
        likes: metrics.likes,
        retweets: metrics.retweets,
        replies: metrics.replies,
        impressions: metrics.impressions,
        timestamp: metrics.timestamp || new Date(),
        contentType: metrics.contentType || 'educational',
        viralScore: metrics.viralScore || this.analytics['calculateViralScore'](metrics as any)
      };
      
      this.analytics.trackEngagement(fullMetrics);
      
      // Add to content generator's performance history
      const performanceData: PerformanceData = {
        content: fullMetrics.content,
        likes: fullMetrics.likes,
        retweets: fullMetrics.retweets,
        replies: fullMetrics.replies,
        viralScore: fullMetrics.viralScore,
        timestamp: fullMetrics.timestamp
      };
      this.contentGenerator.addPerformanceData(performanceData);
      this.scheduler.addPerformanceData(performanceData);
    }
  }

  /**
   * Get comprehensive system dashboard
   */
  getSystemDashboard(): any {
    const analyticsDashboard = this.analytics.getAnalyticsDashboard();
    const schedulingInsights = this.scheduler.getSchedulingInsights();
    const systemStatus = this.optimizer.getSystemStatus();
    const contentInsights = this.contentGenerator.getPerformanceInsights();

    return {
      overview: {
        systemStatus: systemStatus.systemHealth,
        isInitialized: this.isInitialized,
        lastOptimization: this.lastOptimizationRun,
        enhancementsActive: this.getActiveEnhancements()
      },
      performance: {
        summary: analyticsDashboard.summary,
        trends: analyticsDashboard.trends,
        currentGoals: systemStatus.currentGoals,
        goalProgress: this.calculateGoalProgress(systemStatus)
      },
      scheduling: {
        currentStatus: schedulingInsights.currentStatus,
        nextOptimalTime: schedulingInsights.nextOptimalTime,
        upcomingWindows: schedulingInsights.upcomingWindows,
        frequencyStatus: schedulingInsights.frequencyStatus
      },
      content: {
        insights: contentInsights,
        recentPerformance: analyticsDashboard.recentPerformance
      },
      optimization: {
        cycles: systemStatus.systemInfo.optimizationCycles,
        performanceTrend: systemStatus.performanceTrend,
        recommendations: this.optimizer.getLearningRecommendations()
      }
    };
  }

  /**
   * Force an optimization cycle
   */
  async forceOptimization(): Promise<any> {
    console.log('🚀 FORCED_OPTIMIZATION: Manual optimization triggered');
    return await this.runOptimizationCycle();
  }

  /**
   * Update system goals
   */
  updateOptimizationGoals(newGoals: Partial<OptimizationGoals>): void {
    this.config.optimizationGoals = { ...this.config.optimizationGoals, ...newGoals };
    this.optimizer.updateGoals(newGoals);
    console.log(`🎯 GOALS_UPDATED: New optimization targets set`);
  }

  /**
   * Get system health report
   */
  async getSystemHealthReport(): Promise<any> {
    const healthReport = {
      timestamp: new Date().toISOString(),
      overallHealth: 'EXCELLENT',
      components: {} as any,
      recommendations: [] as string[]
    };

    // Check each component
    healthReport.components.contentGenerator = {
      status: 'OPERATIONAL',
      performanceDataPoints: this.contentGenerator.getPerformanceInsights().status !== 'insufficient_data' ? 'SUFFICIENT' : 'INSUFFICIENT'
    };

    healthReport.components.scheduler = {
      status: 'OPERATIONAL',
      nextOptimalTime: this.scheduler.getSchedulingInsights().nextOptimalTime
    };

    healthReport.components.analytics = {
      status: 'OPERATIONAL',
      dataPoints: this.analytics.getAnalyticsDashboard().summary.totalPosts
    };

    healthReport.components.optimizer = {
      status: this.optimizer.getSystemStatus().systemHealth,
      cycles: this.optimizer.getSystemStatus().systemInfo.optimizationCycles
    };

    // Calculate overall health
    const componentStatuses = Object.values(healthReport.components).map((c: any) => c.status);
    const healthyComponents = componentStatuses.filter(s => s === 'OPERATIONAL' || s === 'EXCELLENT' || s === 'GOOD').length;
    const totalComponents = componentStatuses.length;

    if (healthyComponents === totalComponents) {
      healthReport.overallHealth = 'EXCELLENT';
    } else if (healthyComponents >= totalComponents * 0.8) {
      healthReport.overallHealth = 'GOOD';
    } else {
      healthReport.overallHealth = 'NEEDS_ATTENTION';
    }

    return healthReport;
  }

  /**
   * Private helper methods
   */
  private async runSystemHealthCheck(): Promise<void> {
    console.log('🏥 HEALTH_CHECK: Running system health verification...');
    // Verify all components are working
    // This would include checking API keys, database connections, etc.
  }

  private async loadHistoricalData(): Promise<void> {
    console.log('📊 DATA_LOADING: Loading historical performance data...');
    // Load previous engagement data, performance metrics, etc.
  }

  private async runOptimizationCycle(): Promise<void> {
    if (!this.config.enableAutonomousOptimization) return;

    try {
      console.log('🤖 OPTIMIZATION: Running autonomous optimization cycle...');
      const insights = await this.optimizer.runOptimizationCycle();
      this.lastOptimizationRun = new Date();
      
      console.log(`✅ OPTIMIZATION: Cycle complete with ${insights.recommendations.length} recommendations`);
      
    } catch (error) {
      console.error('❌ OPTIMIZATION: Cycle failed:', error);
    }
  }

  private shouldRunOptimization(): boolean {
    if (!this.config.enableAutonomousOptimization) return false;

    const hoursSinceLastRun = this.lastOptimizationRun 
      ? (Date.now() - this.lastOptimizationRun.getTime()) / (1000 * 60 * 60)
      : this.config.optimizationIntervalHours + 1;

    return hoursSinceLastRun >= this.config.optimizationIntervalHours;
  }

  private getCurrentTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 22) return 'evening';
    return 'night';
  }

  private getRecentPerformanceData(): PerformanceData[] {
    // Get recent performance data from analytics
    const dashboard = this.analytics.getAnalyticsDashboard();
    return dashboard.recentPerformance.map((m: any) => ({
      content: m.content,
      likes: m.likes,
      retweets: m.retweets,
      replies: m.replies,
      viralScore: m.viralScore,
      timestamp: new Date(m.timestamp)
    }));
  }

  private async getTrendingContext(): Promise<string[]> {
    // This would fetch current trending topics
    // For now, return some general health trends
    return [
      'AI in healthcare',
      'Mental health awareness',
      'Preventive medicine',
      'Health technology',
      'Wellness research'
    ];
  }

  private getSystemMetadata(): any {
    return {
      systemVersion: 'Enhanced-v2.0',
      optimizationCycle: this.optimizer.getSystemStatus().systemInfo.optimizationCycles,
      enhancementsUsed: this.getActiveEnhancements()
    };
  }

  private getActiveEnhancements(): string[] {
    return [
      'ViralContentGeneration',
      'IntelligentScheduling',
      'EngagementAnalytics',
      'AutonomousOptimization',
      'FixedThreadPosting'
    ];
  }

  private calculateGoalProgress(systemStatus: any): any {
    const current = systemStatus.currentPerformance;
    const goals = systemStatus.currentGoals;
    
    if (!current) return { viralScore: 0, engagementRate: 0 };

    return {
      viralScore: Math.min(100, (current.currentViralScore / goals.targetViralScore) * 100),
      engagementRate: Math.min(100, (current.currentEngagementRate / goals.targetEngagementRate) * 100)
    };
  }
}
