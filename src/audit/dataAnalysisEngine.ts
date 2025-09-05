/**
 * 📊 DATA ANALYSIS ENGINE
 * 
 * Advanced data extraction and analysis for autonomous system improvement.
 * This system:
 * 1. Extracts patterns from all system data
 * 2. Identifies optimization opportunities  
 * 3. Predicts system failures before they happen
 * 4. Generates autonomous improvement strategies
 * 5. Provides actionable insights for system enhancement
 */

import { SimpleDatabaseManager } from '../lib/simpleDatabaseManager';
import { SystemFailureAuditor } from './systemFailureAuditor';

export interface DataInsight {
  category: 'performance' | 'reliability' | 'engagement' | 'optimization';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  recommendation: string;
  expectedImpact: string;
  implementationComplexity: 'simple' | 'medium' | 'complex';
  dataPoints: number;
  confidence: number; // 0-100
}

export interface SystemMetrics {
  timestamp: Date;
  systemName: string;
  successRate: number;
  avgResponseTime: number;
  errorRate: number;
  emergencyUsage: number;
  engagementScore?: number;
  userSatisfaction?: number;
}

export interface PredictiveAlert {
  systemName: string;
  alertType: 'performance_degradation' | 'failure_prediction' | 'capacity_issue';
  probability: number; // 0-100
  timeToFailure: string; // e.g., "2 hours", "1 day"
  recommendation: string;
  preventiveActions: string[];
}

export class DataAnalysisEngine {
  private static instance: DataAnalysisEngine;
  private db: SimpleDatabaseManager;
  private auditor: SystemFailureAuditor;

  constructor() {
    this.db = SimpleDatabaseManager.getInstance();
    this.auditor = SystemFailureAuditor.getInstance();
  }

  public static getInstance(): DataAnalysisEngine {
    if (!DataAnalysisEngine.instance) {
      DataAnalysisEngine.instance = new DataAnalysisEngine();
    }
    return DataAnalysisEngine.instance;
  }

  /**
   * 🔍 COMPREHENSIVE DATA ANALYSIS
   */
  public async performComprehensiveAnalysis(): Promise<{
    insights: DataInsight[];
    predictions: PredictiveAlert[];
    optimizations: string[];
    healthScore: number;
  }> {
    console.log('🔍 DATA_ANALYSIS: Starting comprehensive system analysis...');
    
    try {
      const [
        systemMetrics,
        engagementData,
        failurePatterns,
        performanceData
      ] = await Promise.all([
        this.extractSystemMetrics(),
        this.extractEngagementData(),
        this.extractFailurePatterns(),
        this.extractPerformanceData()
      ]);

      // Generate insights from data
      const insights = await this.generateInsights(systemMetrics, engagementData, failurePatterns);
      
      // Create predictive alerts
      const predictions = await this.generatePredictiveAlerts(systemMetrics, failurePatterns);
      
      // Identify optimization opportunities
      const optimizations = await this.identifyOptimizations(performanceData, engagementData);
      
      // Calculate overall health score
      const healthScore = this.calculateSystemHealthScore(systemMetrics, failurePatterns);
      
      console.log(`📊 ANALYSIS_COMPLETE: ${insights.length} insights, ${predictions.length} predictions`);
      console.log(`🎯 HEALTH_SCORE: ${healthScore}/100`);
      
      return {
        insights,
        predictions,
        optimizations,
        healthScore
      };
      
    } catch (error: any) {
      console.error('❌ DATA_ANALYSIS_ERROR:', error.message);
      
      return {
        insights: [{
          category: 'reliability',
          priority: 'critical',
          title: 'Data Analysis System Failure',
          description: 'Unable to perform comprehensive analysis',
          recommendation: 'Fix data analysis engine',
          expectedImpact: 'Restored system insights',
          implementationComplexity: 'complex',
          dataPoints: 0,
          confidence: 100
        }],
        predictions: [],
        optimizations: [],
        healthScore: 0
      };
    }
  }

  /**
   * 📈 EXTRACT SYSTEM METRICS
   */
  private async extractSystemMetrics(): Promise<SystemMetrics[]> {
    try {
      const result = await this.db.executeQuery('extract_system_metrics', async (client) => {
        // Get recent system health data
        const { data: healthData, error: healthError } = await client
          .from('system_health_metrics')
          .select('*')
          .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .order('timestamp', { ascending: false });
        
        if (healthError) throw healthError;
        
        // Get failure counts
        const { data: failureData, error: failureError } = await client
          .from('system_failures')
          .select('system_name, failure_type, emergency_system_used')
          .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
        
        if (failureError) throw failureError;
        
        return { healthData: healthData || [], failureData: failureData || [] };
      });
      
      const { healthData, failureData } = result as any;
      
      // Process and combine data
      const metricsMap = new Map<string, SystemMetrics>();
      
      // Process health data
      healthData.forEach((row: any) => {
        const metric: SystemMetrics = {
          timestamp: new Date(row.timestamp),
          systemName: row.system_name,
          successRate: row.success_rate || 0,
          avgResponseTime: row.avg_response_time_ms || 0,
          errorRate: row.failed_attempts / Math.max(row.total_attempts, 1) * 100,
          emergencyUsage: row.emergency_fallbacks || 0
        };
        
        metricsMap.set(row.system_name, metric);
      });
      
      // Add failure data
      const emergencyCounts = new Map<string, number>();
      failureData.forEach((row: any) => {
        if (row.emergency_system_used) {
          emergencyCounts.set(row.system_name, (emergencyCounts.get(row.system_name) || 0) + 1);
        }
      });
      
      emergencyCounts.forEach((count, systemName) => {
        if (metricsMap.has(systemName)) {
          metricsMap.get(systemName)!.emergencyUsage += count;
        }
      });
      
      return Array.from(metricsMap.values());
      
    } catch (error: any) {
      console.error('❌ EXTRACT_METRICS_ERROR:', error.message);
      return [];
    }
  }

  /**
   * 💬 EXTRACT ENGAGEMENT DATA
   */
  private async extractEngagementData(): Promise<any[]> {
    try {
      const result = await this.db.executeQuery('extract_engagement_data', async (client) => {
        const { data, error } = await client
          .from('tweet_analytics')
          .select('*')
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data || [];
      });
      
      return result as any[];
      
    } catch (error: any) {
      console.error('❌ EXTRACT_ENGAGEMENT_ERROR:', error.message);
      return [];
    }
  }

  /**
   * 🔍 EXTRACT FAILURE PATTERNS
   */
  private async extractFailurePatterns(): Promise<any[]> {
    try {
      const result = await this.db.executeQuery('extract_failure_patterns', async (client) => {
        const { data, error } = await client
          .from('system_failures')
          .select('*')
          .gte('timestamp', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .order('timestamp', { ascending: false });
        
        if (error) throw error;
        return data || [];
      });
      
      return result as any[];
      
    } catch (error: any) {
      console.error('❌ EXTRACT_FAILURES_ERROR:', error.message);
      return [];
    }
  }

  /**
   * ⚡ EXTRACT PERFORMANCE DATA
   */
  private async extractPerformanceData(): Promise<any[]> {
    try {
      const result = await this.db.executeQuery('extract_performance_data', async (client) => {
        const { data, error } = await client
          .from('learning_posts')
          .select('*')
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data || [];
      });
      
      return result as any[];
      
    } catch (error: any) {
      console.error('❌ EXTRACT_PERFORMANCE_ERROR:', error.message);
      return [];
    }
  }

  /**
   * 💡 GENERATE INSIGHTS
   */
  private async generateInsights(
    systemMetrics: SystemMetrics[],
    engagementData: any[],
    failurePatterns: any[]
  ): Promise<DataInsight[]> {
    const insights: DataInsight[] = [];
    
    // System reliability insights
    systemMetrics.forEach(metric => {
      if (metric.successRate < 80) {
        insights.push({
          category: 'reliability',
          priority: metric.successRate < 50 ? 'critical' : 'high',
          title: `${metric.systemName} Reliability Issue`,
          description: `Success rate at ${metric.successRate.toFixed(1)}% with ${metric.emergencyUsage} emergency uses`,
          recommendation: 'Strengthen error handling and add retry mechanisms',
          expectedImpact: `Improve success rate to 95%+`,
          implementationComplexity: 'medium',
          dataPoints: 1,
          confidence: 90
        });
      }
      
      if (metric.avgResponseTime > 5000) {
        insights.push({
          category: 'performance',
          priority: 'medium',
          title: `${metric.systemName} Performance Degradation`,
          description: `Average response time ${metric.avgResponseTime}ms`,
          recommendation: 'Optimize queries and add caching',
          expectedImpact: 'Reduce response time by 60%',
          implementationComplexity: 'medium',
          dataPoints: 1,
          confidence: 85
        });
      }
    });
    
    // Engagement insights
    if (engagementData.length > 10) {
      const avgEngagement = engagementData.reduce((sum, post) => 
        sum + (post.likes + post.retweets + post.replies), 0) / engagementData.length;
      
      const lowEngagementPosts = engagementData.filter(post => 
        (post.likes + post.retweets + post.replies) < avgEngagement * 0.5);
      
      if (lowEngagementPosts.length > engagementData.length * 0.3) {
        insights.push({
          category: 'engagement',
          priority: 'medium',
          title: 'Content Engagement Below Average',
          description: `${lowEngagementPosts.length}/${engagementData.length} posts underperforming`,
          recommendation: 'Analyze high-performing content patterns and adjust strategy',
          expectedImpact: 'Increase average engagement by 40%',
          implementationComplexity: 'simple',
          dataPoints: engagementData.length,
          confidence: 75
        });
      }
    }
    
    // Emergency usage patterns
    const emergencyHeavySystems = systemMetrics.filter(m => m.emergencyUsage > 5);
    if (emergencyHeavySystems.length > 0) {
      insights.push({
        category: 'optimization',
        priority: 'high',
        title: 'High Emergency System Usage',
        description: `${emergencyHeavySystems.length} systems overusing emergency fallbacks`,
        recommendation: 'Redesign primary systems to reduce emergency dependency',
        expectedImpact: 'Reduce emergency usage by 80%',
        implementationComplexity: 'complex',
        dataPoints: emergencyHeavySystems.length,
        confidence: 95
      });
    }
    
    return insights.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * 🔮 GENERATE PREDICTIVE ALERTS
   */
  private async generatePredictiveAlerts(
    systemMetrics: SystemMetrics[],
    failurePatterns: any[]
  ): Promise<PredictiveAlert[]> {
    const alerts: PredictiveAlert[] = [];
    
    // Predict system failures based on trends
    systemMetrics.forEach(metric => {
      if (metric.successRate < 70 && metric.emergencyUsage > 3) {
        alerts.push({
          systemName: metric.systemName,
          alertType: 'failure_prediction',
          probability: 100 - metric.successRate,
          timeToFailure: metric.successRate < 50 ? '2 hours' : '1 day',
          recommendation: 'Immediate intervention required',
          preventiveActions: [
            'Enable additional error handling',
            'Increase timeout values',
            'Add circuit breaker pattern',
            'Scale resources if needed'
          ]
        });
      }
      
      if (metric.avgResponseTime > 3000) {
        alerts.push({
          systemName: metric.systemName,
          alertType: 'performance_degradation',
          probability: Math.min(90, metric.avgResponseTime / 100),
          timeToFailure: '4 hours',
          recommendation: 'Optimize performance before users notice',
          preventiveActions: [
            'Add caching layer',
            'Optimize database queries',
            'Review resource allocation'
          ]
        });
      }
    });
    
    return alerts.sort((a, b) => b.probability - a.probability);
  }

  /**
   * 🚀 IDENTIFY OPTIMIZATIONS
   */
  private async identifyOptimizations(performanceData: any[], engagementData: any[]): Promise<string[]> {
    const optimizations: string[] = [];
    
    // Content optimization
    if (engagementData.length > 0) {
      optimizations.push('🎯 Analyze high-performing content patterns for replication');
      optimizations.push('📊 A/B test posting times based on engagement patterns');
      optimizations.push('🔄 Optimize content types based on audience response');
    }
    
    // Performance optimization
    if (performanceData.length > 0) {
      optimizations.push('⚡ Implement intelligent caching for frequently accessed data');
      optimizations.push('🔍 Add predictive content generation to reduce wait times');
      optimizations.push('📈 Optimize database queries based on usage patterns');
    }
    
    // System optimization
    optimizations.push('🤖 Implement auto-scaling based on demand patterns');
    optimizations.push('🛡️ Add proactive error detection and prevention');
    optimizations.push('📋 Create automated system health monitoring');
    
    return optimizations;
  }

  /**
   * 💯 CALCULATE SYSTEM HEALTH SCORE
   */
  private calculateSystemHealthScore(systemMetrics: SystemMetrics[], failurePatterns: any[]): number {
    if (systemMetrics.length === 0) return 50; // Unknown state
    
    const avgSuccessRate = systemMetrics.reduce((sum, m) => sum + m.successRate, 0) / systemMetrics.length;
    const avgResponseTime = systemMetrics.reduce((sum, m) => sum + m.avgResponseTime, 0) / systemMetrics.length;
    const totalEmergencyUsage = systemMetrics.reduce((sum, m) => sum + m.emergencyUsage, 0);
    
    let healthScore = avgSuccessRate; // Start with success rate
    
    // Penalties
    if (avgResponseTime > 2000) healthScore -= 10; // Slow response penalty
    if (avgResponseTime > 5000) healthScore -= 20; // Very slow penalty
    if (totalEmergencyUsage > 10) healthScore -= 15; // Emergency overuse penalty
    if (failurePatterns.length > 20) healthScore -= 10; // Too many failures penalty
    
    // Bonuses
    if (avgSuccessRate > 95) healthScore += 5; // Excellence bonus
    if (avgResponseTime < 1000) healthScore += 5; // Fast response bonus
    
    return Math.max(0, Math.min(100, healthScore));
  }

  /**
   * 📊 GET REAL-TIME DASHBOARD DATA
   */
  public async getDashboardData(): Promise<{
    systemHealth: number;
    criticalAlerts: number;
    activeOptimizations: number;
    dataQuality: number;
    keyMetrics: {
      avgSuccessRate: number;
      avgResponseTime: number;
      emergencyUsage: number;
      totalDataPoints: number;
    };
  }> {
    const analysis = await this.performComprehensiveAnalysis();
    const systemMetrics = await this.extractSystemMetrics();
    
    const criticalAlerts = analysis.insights.filter(i => i.priority === 'critical').length +
                          analysis.predictions.filter(p => p.probability > 80).length;
    
    const avgSuccessRate = systemMetrics.length > 0 
      ? systemMetrics.reduce((sum, m) => sum + m.successRate, 0) / systemMetrics.length 
      : 0;
    
    const avgResponseTime = systemMetrics.length > 0 
      ? systemMetrics.reduce((sum, m) => sum + m.avgResponseTime, 0) / systemMetrics.length 
      : 0;
    
    const emergencyUsage = systemMetrics.reduce((sum, m) => sum + m.emergencyUsage, 0);
    
    return {
      systemHealth: analysis.healthScore,
      criticalAlerts,
      activeOptimizations: analysis.optimizations.length,
      dataQuality: systemMetrics.length > 5 ? 95 : systemMetrics.length * 20,
      keyMetrics: {
        avgSuccessRate,
        avgResponseTime,
        emergencyUsage,
        totalDataPoints: systemMetrics.length
      }
    };
  }
}
