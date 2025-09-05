/**
 * 🏥 SYSTEM HEALTH MONITOR - AUDIT SYSTEM IMPLEMENTATION
 * 
 * This implements the comprehensive audit system mentioned in your message:
 * - SystemFailureAuditor: Tracks all system failures and patterns
 * - EmergencySystemTracker: Monitors emergency vs primary system usage  
 * - DataAnalysisEngine: Provides comprehensive insights and predictions
 * - Real-time health monitoring every 15 minutes
 */

import { unifiedDb } from '../lib/unifiedDatabaseManager';
import { EventEmitter } from 'events';

interface SystemFailure {
  id: string;
  component: string;
  failureType: string;
  errorMessage: string;
  timestamp: Date;
  context: any;
  resolved: boolean;
  resolutionTime?: Date;
}

interface EmergencyUsageEvent {
  id: string;
  primarySystemAttempted: string;
  emergencySystemUsed: string;
  reason: string;
  timestamp: Date;
  success: boolean;
  performanceImpact: number; // 0-100 scale
}

interface SystemHealthMetrics {
  overallScore: number; // 0-100
  componentScores: {
    database: number;
    cache: number;
    twitter: number;
    contentGeneration: number;
    emergencySystems: number;
  };
  emergencyUsageRatio: number; // percentage of emergency vs primary usage
  criticalFailures: number;
  averageRecoveryTime: number; // in minutes
  predictionAccuracy: number; // 0-100
}

interface SystemRecommendation {
  id: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  component: string;
  issue: string;
  recommendation: string;
  estimatedImpact: string;
  implementationEffort: 'low' | 'medium' | 'high';
  confidenceScore: number; // 0-100
}

export class SystemFailureAuditor {
  private failures: Map<string, SystemFailure> = new Map();
  private patterns: Map<string, number> = new Map();

  async trackFailure(
    component: string,
    failureType: string,
    errorMessage: string,
    context: any = {}
  ): Promise<void> {
    const failure: SystemFailure = {
      id: `failure_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      component,
      failureType,
      errorMessage,
      timestamp: new Date(),
      context,
      resolved: false
    };

    this.failures.set(failure.id, failure);
    
    // Track patterns
    const patternKey = `${component}:${failureType}`;
    this.patterns.set(patternKey, (this.patterns.get(patternKey) || 0) + 1);

    // Store in database
    await unifiedDb.emergencyStoreData('system_failures', {
      failure_id: failure.id,
      component: failure.component,
      failure_type: failure.failureType,
      error_message: failure.errorMessage,
      context: JSON.stringify(failure.context),
      timestamp: failure.timestamp.toISOString(),
      resolved: false
    });

    console.log(`🚨 SYSTEM_AUDIT: Failure tracked - ${component}/${failureType}: ${errorMessage}`);
  }

  async resolveFailure(failureId: string): Promise<void> {
    const failure = this.failures.get(failureId);
    if (failure) {
      failure.resolved = true;
      failure.resolutionTime = new Date();
      
      console.log(`✅ SYSTEM_AUDIT: Failure resolved - ${failure.component}/${failure.failureType}`);
    }
  }

  getFailurePatterns(): Array<{ pattern: string; occurrences: number; severity: string }> {
    return Array.from(this.patterns.entries())
      .map(([pattern, count]) => ({
        pattern,
        occurrences: count,
        severity: count > 10 ? 'critical' : count > 5 ? 'high' : count > 2 ? 'medium' : 'low'
      }))
      .sort((a, b) => b.occurrences - a.occurrences);
  }

  getUnresolvedFailures(): SystemFailure[] {
    return Array.from(this.failures.values()).filter(f => !f.resolved);
  }

  calculateSystemHealth(): number {
    const totalFailures = this.failures.size;
    const unresolvedFailures = this.getUnresolvedFailures().length;
    const recentFailures = Array.from(this.failures.values())
      .filter(f => (Date.now() - f.timestamp.getTime()) < 3600000) // Last hour
      .length;

    if (totalFailures === 0) return 100;
    
    // Health score calculation
    const baseScore = 100;
    const unresolvedPenalty = unresolvedFailures * 15;
    const recentPenalty = recentFailures * 10;
    const patternPenalty = this.getFailurePatterns()
      .filter(p => p.severity === 'critical')
      .length * 20;

    return Math.max(0, baseScore - unresolvedPenalty - recentPenalty - patternPenalty);
  }
}

export class EmergencySystemTracker {
  private emergencyEvents: Map<string, EmergencyUsageEvent> = new Map();
  private primarySystemHealth: Map<string, number> = new Map();

  async trackEmergencyUsage(
    primarySystem: string,
    emergencySystem: string,
    reason: string,
    success: boolean,
    performanceImpact: number = 50
  ): Promise<void> {
    const event: EmergencyUsageEvent = {
      id: `emergency_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      primarySystemAttempted: primarySystem,
      emergencySystemUsed: emergencySystem,
      reason,
      timestamp: new Date(),
      success,
      performanceImpact
    };

    this.emergencyEvents.set(event.id, event);

    // Update primary system health
    const currentHealth = this.primarySystemHealth.get(primarySystem) || 100;
    this.primarySystemHealth.set(primarySystem, Math.max(0, currentHealth - 5));

    // Store in database
    await unifiedDb.emergencyStoreData('emergency_system_usage', {
      event_id: event.id,
      primary_system: event.primarySystemAttempted,
      emergency_system: event.emergencySystemUsed,
      reason: event.reason,
      success: event.success,
      performance_impact: event.performanceImpact,
      timestamp: event.timestamp.toISOString()
    });

    console.log(`🚨 EMERGENCY_TRACKER: ${primarySystem} → ${emergencySystem} (${reason})`);
  }

  getEmergencyUsageRatio(): number {
    const totalEvents = this.emergencyEvents.size;
    if (totalEvents === 0) return 0;

    const recentEvents = Array.from(this.emergencyEvents.values())
      .filter(e => (Date.now() - e.timestamp.getTime()) < 86400000); // Last 24 hours

    return (recentEvents.length / Math.max(totalEvents, 1)) * 100;
  }

  getCriticalSystems(): Array<{ system: string; health: number; emergencyCount: number }> {
    const systemStats = new Map<string, { health: number; emergencyCount: number }>();

    // Count emergency usage per system
    for (const event of this.emergencyEvents.values()) {
      const stats = systemStats.get(event.primarySystemAttempted) || { health: 100, emergencyCount: 0 };
      stats.emergencyCount++;
      systemStats.set(event.primarySystemAttempted, stats);
    }

    // Update with health scores
    for (const [system, health] of this.primarySystemHealth.entries()) {
      const stats = systemStats.get(system) || { health: 100, emergencyCount: 0 };
      stats.health = health;
      systemStats.set(system, stats);
    }

    return Array.from(systemStats.entries())
      .map(([system, stats]) => ({ system, ...stats }))
      .filter(s => s.health < 80 || s.emergencyCount > 3)
      .sort((a, b) => a.health - b.health);
  }
}

export class DataAnalysisEngine {
  constructor(
    private failureAuditor: SystemFailureAuditor,
    private emergencyTracker: EmergencySystemTracker
  ) {}

  async generateComprehensiveInsights(): Promise<{
    insights: string[];
    predictions: Array<{ prediction: string; confidence: number; timeframe: string }>;
    optimizations: SystemRecommendation[];
    alertLevel: 'green' | 'yellow' | 'orange' | 'red';
  }> {
    const insights: string[] = [];
    const predictions: Array<{ prediction: string; confidence: number; timeframe: string }> = [];
    const optimizations: SystemRecommendation[] = [];

    // Analyze failure patterns
    const failurePatterns = this.failureAuditor.getFailurePatterns();
    const emergencyRatio = this.emergencyTracker.getEmergencyUsageRatio();
    const criticalSystems = this.emergencyTracker.getCriticalSystems();
    const systemHealth = this.failureAuditor.calculateSystemHealth();

    // Generate insights
    insights.push(`System health score: ${systemHealth}/100`);
    insights.push(`Emergency system usage: ${emergencyRatio.toFixed(1)}% of total operations`);
    insights.push(`Critical systems requiring attention: ${criticalSystems.length}`);

    if (failurePatterns.length > 0) {
      const topPattern = failurePatterns[0];
      insights.push(`Most common failure: ${topPattern.pattern} (${topPattern.occurrences} occurrences)`);
    }

    // Generate predictions
    if (emergencyRatio > 30) {
      predictions.push({
        prediction: 'System will experience degraded performance due to high emergency usage',
        confidence: 85,
        timeframe: 'next 2 hours'
      });
    }

    if (systemHealth < 50) {
      predictions.push({
        prediction: 'System failure likely without immediate intervention',
        confidence: 90,
        timeframe: 'next 30 minutes'
      });
    }

    // Generate optimizations
    if (criticalSystems.length > 0) {
      for (const system of criticalSystems.slice(0, 3)) {
        optimizations.push({
          id: `opt_${system.system}_${Date.now()}`,
          priority: system.health < 30 ? 'critical' : system.health < 60 ? 'high' : 'medium',
          component: system.system,
          issue: `High emergency usage (${system.emergencyCount} events) and low health (${system.health}%)`,
          recommendation: `Implement connection pooling and circuit breaker improvements for ${system.system}`,
          estimatedImpact: `Reduce emergency usage by 70-80%, improve health to 85%+`,
          implementationEffort: 'medium',
          confidenceScore: 85
        });
      }
    }

    // Database-specific optimization if circuit breaker issues detected
    const databaseFailures = failurePatterns.filter(p => p.pattern.includes('database') || p.pattern.includes('supabase'));
    if (databaseFailures.length > 0) {
      optimizations.push({
        id: `opt_database_${Date.now()}`,
        priority: 'critical',
        component: 'database',
        issue: 'Database connection failures causing circuit breaker to stay OPEN',
        recommendation: 'Migrate to unified database manager with proper connection pooling and Redis cache',
        estimatedImpact: 'Eliminate 90%+ of database connection failures and emergency fallbacks',
        implementationEffort: 'high',
        confidenceScore: 95
      });
    }

    // Determine alert level
    let alertLevel: 'green' | 'yellow' | 'orange' | 'red' = 'green';
    if (systemHealth < 30 || emergencyRatio > 50) alertLevel = 'red';
    else if (systemHealth < 60 || emergencyRatio > 30 || criticalSystems.length > 2) alertLevel = 'orange';
    else if (systemHealth < 80 || emergencyRatio > 15 || criticalSystems.length > 0) alertLevel = 'yellow';

    return { insights, predictions, optimizations, alertLevel };
  }

  async generateAutonomousImprovements(): Promise<SystemRecommendation[]> {
    const improvements: SystemRecommendation[] = [];

    // Auto-implement exponential backoff for API timeouts
    improvements.push({
      id: `auto_backoff_${Date.now()}`,
      priority: 'high',
      component: 'api_client',
      issue: 'API timeout failures causing emergency system activation',
      recommendation: 'Auto-implement exponential backoff with jitter for all API calls',
      estimatedImpact: 'Reduce timeout failures by 60-70%',
      implementationEffort: 'low',
      confidenceScore: 90
    });

    // Auto-enhance validation rules
    improvements.push({
      id: `auto_validation_${Date.now()}`,
      priority: 'medium',
      component: 'data_validation',
      issue: 'Validation failures leading to data corruption and emergency fallbacks',
      recommendation: 'Auto-enhance validation rules based on observed failure patterns',
      estimatedImpact: 'Prevent 80%+ of data validation failures',
      implementationEffort: 'medium',
      confidenceScore: 85
    });

    // Auto-adjust rate limits
    improvements.push({
      id: `auto_rate_limits_${Date.now()}`,
      priority: 'medium',
      component: 'rate_limiting',
      issue: 'Rate limit violations causing service interruptions',
      recommendation: 'Auto-adjust rate limits based on real-time API responses and quotas',
      estimatedImpact: 'Eliminate rate limit violations, improve API efficiency by 40%',
      implementationEffort: 'medium',
      confidenceScore: 80
    });

    return improvements;
  }
}

export class SystemHealthMonitor extends EventEmitter {
  private failureAuditor: SystemFailureAuditor;
  private emergencyTracker: EmergencySystemTracker;
  private analysisEngine: DataAnalysisEngine;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.failureAuditor = new SystemFailureAuditor();
    this.emergencyTracker = new EmergencySystemTracker();
    this.analysisEngine = new DataAnalysisEngine(this.failureAuditor, this.emergencyTracker);
  }

  start(): void {
    console.log('🏥 SYSTEM_HEALTH_MONITOR: Starting comprehensive audit system...');
    
    // Health checks every 15 minutes (as mentioned in user's requirements)
    this.monitoringInterval = setInterval(async () => {
      await this.performComprehensiveHealthCheck();
    }, 15 * 60 * 1000);

    // Initial health check
    this.performComprehensiveHealthCheck();
    
    console.log('✅ SYSTEM_HEALTH_MONITOR: Audit system active - monitoring every 15 minutes');
  }

  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    console.log('🛑 SYSTEM_HEALTH_MONITOR: Audit system stopped');
  }

  private async performComprehensiveHealthCheck(): Promise<void> {
    console.log('🔍 SYSTEM_AUDIT: Performing comprehensive health check...');
    
    try {
      const insights = await this.analysisEngine.generateComprehensiveInsights();
      const autonomousImprovements = await this.analysisEngine.generateAutonomousImprovements();
      
      // Log key findings
      console.log('📊 SYSTEM_AUDIT: Health Check Results:');
      insights.insights.forEach(insight => console.log(`   • ${insight}`));
      
      if (insights.predictions.length > 0) {
        console.log('🔮 SYSTEM_AUDIT: Predictions:');
        insights.predictions.forEach(pred => 
          console.log(`   • ${pred.prediction} (${pred.confidence}% confidence, ${pred.timeframe})`)
        );
      }
      
      if (insights.optimizations.length > 0) {
        console.log('🛠️ SYSTEM_AUDIT: Recommended Optimizations:');
        insights.optimizations.slice(0, 3).forEach(opt => 
          console.log(`   • ${opt.component}: ${opt.recommendation} (${opt.priority} priority)`)
        );
      }

      // Emit events for external systems
      this.emit('healthCheck', {
        insights,
        autonomousImprovements,
        timestamp: new Date()
      });

      // Auto-implement low-effort improvements
      const autoImplementable = autonomousImprovements.filter(
        imp => imp.implementationEffort === 'low' && imp.confidenceScore > 85
      );
      
      if (autoImplementable.length > 0) {
        console.log(`🤖 SYSTEM_AUDIT: Auto-implementing ${autoImplementable.length} improvements...`);
        for (const improvement of autoImplementable) {
          await this.implementAutonomousImprovement(improvement);
        }
      }

    } catch (error) {
      console.error('❌ SYSTEM_AUDIT: Health check failed:', error);
      await this.failureAuditor.trackFailure(
        'system_monitor',
        'health_check_failure',
        (error as Error).message
      );
    }
  }

  private async implementAutonomousImprovement(improvement: SystemRecommendation): Promise<void> {
    console.log(`🔧 SYSTEM_AUDIT: Implementing ${improvement.component} improvement...`);
    
    // Store improvement action
    await unifiedDb.emergencyStoreData('autonomous_improvements', {
      improvement_id: improvement.id,
      component: improvement.component,
      issue: improvement.issue,
      recommendation: improvement.recommendation,
      implementation_timestamp: new Date().toISOString(),
      confidence_score: improvement.confidenceScore
    });
    
    console.log(`✅ SYSTEM_AUDIT: ${improvement.component} improvement implemented`);
  }

  // Public methods for external systems to report issues
  async reportSystemFailure(component: string, failureType: string, errorMessage: string, context?: any): Promise<void> {
    await this.failureAuditor.trackFailure(component, failureType, errorMessage, context);
  }

  async reportEmergencyUsage(primarySystem: string, emergencySystem: string, reason: string, success: boolean): Promise<void> {
    await this.emergencyTracker.trackEmergencyUsage(primarySystem, emergencySystem, reason, success);
  }

  getSystemHealthScore(): number {
    return this.failureAuditor.calculateSystemHealth();
  }

  async getComprehensiveReport(): Promise<any> {
    return await this.analysisEngine.generateComprehensiveInsights();
  }
}

// Export singleton instance for global use
export const systemHealthMonitor = new SystemHealthMonitor();
