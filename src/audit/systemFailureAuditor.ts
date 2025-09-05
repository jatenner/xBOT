/**
 * 🔍 SYSTEM FAILURE AUDITOR
 * 
 * Comprehensive tracking and analysis of system failures to:
 * 1. Identify what systems are failing most frequently
 * 2. Track emergency system usage patterns
 * 3. Analyze root causes of failures
 * 4. Provide actionable insights for system improvements
 * 5. Enable autonomous system optimization
 */

import { SimpleDatabaseManager } from '../lib/simpleDatabaseManager';

export interface SystemFailureEvent {
  timestamp: Date;
  systemName: string;
  failureType: 'primary_failure' | 'emergency_fallback' | 'complete_failure';
  rootCause: string;
  emergencySystemUsed?: string;
  attemptedAction: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export interface FailurePattern {
  systemName: string;
  failureCount: number;
  emergencyUsageCount: number;
  successRate: number;
  commonCauses: string[];
  recommendation: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export interface SystemHealthReport {
  timestamp: Date;
  overallHealth: number; // 0-100
  criticalSystems: string[];
  emergencyOveruse: string[];
  topFailures: FailurePattern[];
  recommendations: string[];
  autonomousImprovements: string[];
}

export class SystemFailureAuditor {
  private static instance: SystemFailureAuditor;
  private db: SimpleDatabaseManager;
  private failureEvents: SystemFailureEvent[] = [];

  constructor() {
    this.db = SimpleDatabaseManager.getInstance();
  }

  public static getInstance(): SystemFailureAuditor {
    if (!SystemFailureAuditor.instance) {
      SystemFailureAuditor.instance = new SystemFailureAuditor();
    }
    return SystemFailureAuditor.instance;
  }

  /**
   * 📊 RECORD SYSTEM FAILURE
   */
  public async recordFailure(event: Omit<SystemFailureEvent, 'timestamp'>): Promise<void> {
    const failureEvent: SystemFailureEvent = {
      ...event,
      timestamp: new Date()
    };

    this.failureEvents.push(failureEvent);
    
    // Store in database for persistent tracking
    try {
      await this.db.executeQuery('record_system_failure', async (client) => {
        const { error } = await client.from('system_failures').insert({
          timestamp: failureEvent.timestamp.toISOString(),
          system_name: failureEvent.systemName,
          failure_type: failureEvent.failureType,
          root_cause: failureEvent.rootCause,
          emergency_system_used: failureEvent.emergencySystemUsed,
          attempted_action: failureEvent.attemptedAction,
          error_message: failureEvent.errorMessage,
          metadata: failureEvent.metadata
        });
        
        if (error) throw error;
      });

      console.log(`🔍 FAILURE_RECORDED: ${event.systemName} - ${event.failureType}`);
      
      // Real-time analysis for critical failures
      if (event.failureType === 'complete_failure') {
        await this.analyzeSystemHealth();
      }
      
    } catch (error: any) {
      console.error('❌ AUDITOR_STORAGE_ERROR:', error.message);
    }
  }

  /**
   * 📈 ANALYZE SYSTEM HEALTH
   */
  public async analyzeSystemHealth(): Promise<SystemHealthReport> {
    console.log('🔍 SYSTEM_HEALTH_ANALYSIS: Analyzing failure patterns...');
    
    try {
      // Get recent failure data (last 7 days)
      const recentFailures = await this.getRecentFailures(7);
      const failurePatterns = await this.analyzeFailurePatterns(recentFailures);
      
      // Calculate overall system health
      const overallHealth = this.calculateSystemHealth(failurePatterns);
      
      // Identify critical issues
      const criticalSystems = failurePatterns
        .filter(p => p.priority === 'critical' || p.successRate < 50)
        .map(p => p.systemName);
      
      // Find emergency system overuse
      const emergencyOveruse = failurePatterns
        .filter(p => p.emergencyUsageCount > p.failureCount * 0.3) // >30% emergency usage
        .map(p => p.systemName);
      
      // Generate recommendations
      const recommendations = this.generateRecommendations(failurePatterns);
      const autonomousImprovements = this.generateAutonomousImprovements(failurePatterns);
      
      const report: SystemHealthReport = {
        timestamp: new Date(),
        overallHealth,
        criticalSystems,
        emergencyOveruse,
        topFailures: failurePatterns.slice(0, 10),
        recommendations,
        autonomousImprovements
      };
      
      // Log critical findings
      console.log(`📊 SYSTEM_HEALTH: ${overallHealth}% overall health`);
      if (criticalSystems.length > 0) {
        console.log(`🚨 CRITICAL_SYSTEMS: ${criticalSystems.join(', ')}`);
      }
      if (emergencyOveruse.length > 0) {
        console.log(`⚠️ EMERGENCY_OVERUSE: ${emergencyOveruse.join(', ')}`);
      }
      
      return report;
      
    } catch (error: any) {
      console.error('❌ HEALTH_ANALYSIS_ERROR:', error.message);
      
      return {
        timestamp: new Date(),
        overallHealth: 0,
        criticalSystems: ['health_analysis_system'],
        emergencyOveruse: [],
        topFailures: [],
        recommendations: ['Fix health analysis system'],
        autonomousImprovements: []
      };
    }
  }

  /**
   * 🔍 GET RECENT FAILURES
   */
  private async getRecentFailures(days: number): Promise<SystemFailureEvent[]> {
    try {
      const result = await this.db.executeQuery('get_recent_failures', async (client) => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        
        const { data, error } = await client
          .from('system_failures')
          .select('*')
          .gte('timestamp', cutoff.toISOString())
          .order('timestamp', { ascending: false });
        
        if (error) throw error;
        return data || [];
      });
      
      return (result as any[]).map(row => ({
        timestamp: new Date(row.timestamp),
        systemName: row.system_name,
        failureType: row.failure_type,
        rootCause: row.root_cause,
        emergencySystemUsed: row.emergency_system_used,
        attemptedAction: row.attempted_action,
        errorMessage: row.error_message,
        metadata: row.metadata
      }));
      
    } catch (error: any) {
      console.error('❌ GET_FAILURES_ERROR:', error.message);
      return this.failureEvents.filter(
        f => f.timestamp > new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      );
    }
  }

  /**
   * 📊 ANALYZE FAILURE PATTERNS
   */
  private async analyzeFailurePatterns(failures: SystemFailureEvent[]): Promise<FailurePattern[]> {
    const systemStats = new Map<string, {
      total: number;
      failures: number;
      emergencyUse: number;
      causes: Map<string, number>;
    }>();

    // Aggregate failure data by system
    failures.forEach(failure => {
      const system = failure.systemName;
      
      if (!systemStats.has(system)) {
        systemStats.set(system, {
          total: 0,
          failures: 0,
          emergencyUse: 0,
          causes: new Map()
        });
      }
      
      const stats = systemStats.get(system)!;
      stats.total++;
      
      if (failure.failureType !== 'primary_failure') {
        stats.failures++;
      }
      
      if (failure.emergencySystemUsed) {
        stats.emergencyUse++;
      }
      
      // Track root causes
      const cause = failure.rootCause;
      stats.causes.set(cause, (stats.causes.get(cause) || 0) + 1);
    });

    // Convert to failure patterns
    const patterns: FailurePattern[] = [];
    
    systemStats.forEach((stats, systemName) => {
      const successRate = ((stats.total - stats.failures) / stats.total) * 100;
      
      // Get top 3 causes
      const commonCauses = Array.from(stats.causes.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([cause]) => cause);
      
      // Determine priority
      let priority: FailurePattern['priority'] = 'low';
      if (successRate < 30) priority = 'critical';
      else if (successRate < 60) priority = 'high';
      else if (successRate < 80) priority = 'medium';
      
      // Generate recommendation
      const recommendation = this.generateSystemRecommendation(
        systemName, 
        successRate, 
        stats.emergencyUse, 
        commonCauses
      );
      
      patterns.push({
        systemName,
        failureCount: stats.failures,
        emergencyUsageCount: stats.emergencyUse,
        successRate,
        commonCauses,
        recommendation,
        priority
      });
    });

    return patterns.sort((a, b) => a.successRate - b.successRate);
  }

  /**
   * 🎯 GENERATE SYSTEM RECOMMENDATION
   */
  private generateSystemRecommendation(
    systemName: string, 
    successRate: number, 
    emergencyUse: number, 
    causes: string[]
  ): string {
    if (successRate < 30) {
      return `CRITICAL: ${systemName} needs immediate redesign (${successRate.toFixed(1)}% success)`;
    }
    
    if (emergencyUse > 5) {
      return `High emergency fallback usage (${emergencyUse}x) - strengthen primary system`;
    }
    
    if (causes.includes('validation_failed')) {
      return 'Improve validation logic and error handling';
    }
    
    if (causes.includes('api_timeout')) {
      return 'Add timeout handling and retry mechanisms';
    }
    
    if (causes.includes('rate_limit')) {
      return 'Implement better rate limiting and backoff strategies';
    }
    
    return `Monitor and optimize (${successRate.toFixed(1)}% success rate)`;
  }

  /**
   * 💡 GENERATE RECOMMENDATIONS
   */
  private generateRecommendations(patterns: FailurePattern[]): string[] {
    const recommendations: string[] = [];
    
    // Critical system fixes
    const critical = patterns.filter(p => p.priority === 'critical');
    if (critical.length > 0) {
      recommendations.push(`🚨 IMMEDIATE: Fix ${critical.length} critical systems: ${critical.map(p => p.systemName).join(', ')}`);
    }
    
    // Emergency overuse
    const overused = patterns.filter(p => p.emergencyUsageCount > 10);
    if (overused.length > 0) {
      recommendations.push(`⚠️ REDUCE EMERGENCY DEPENDENCY: ${overused.map(p => p.systemName).join(', ')}`);
    }
    
    // Common failure patterns
    const allCauses = patterns.flatMap(p => p.commonCauses);
    const causeCount = new Map<string, number>();
    allCauses.forEach(cause => causeCount.set(cause, (causeCount.get(cause) || 0) + 1));
    
    const topCauses = Array.from(causeCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    
    topCauses.forEach(([cause, count]) => {
      recommendations.push(`🔧 SYSTEMATIC FIX: Address '${cause}' affecting ${count} systems`);
    });
    
    return recommendations;
  }

  /**
   * 🤖 GENERATE AUTONOMOUS IMPROVEMENTS
   */
  private generateAutonomousImprovements(patterns: FailurePattern[]): string[] {
    const improvements: string[] = [];
    
    // Auto-retry for timeout issues
    if (patterns.some(p => p.commonCauses.includes('api_timeout'))) {
      improvements.push('Auto-implement exponential backoff for API timeouts');
    }
    
    // Validation strengthening
    if (patterns.some(p => p.commonCauses.includes('validation_failed'))) {
      improvements.push('Auto-enhance validation rules based on failure patterns');
    }
    
    // Rate limit adaptation
    if (patterns.some(p => p.commonCauses.includes('rate_limit'))) {
      improvements.push('Auto-adjust rate limits based on real-time API responses');
    }
    
    // Emergency system optimization
    const emergencyHeavy = patterns.filter(p => p.emergencyUsageCount > 5);
    if (emergencyHeavy.length > 0) {
      improvements.push('Auto-optimize emergency systems to handle load better');
    }
    
    return improvements;
  }

  /**
   * 📊 CALCULATE SYSTEM HEALTH
   */
  private calculateSystemHealth(patterns: FailurePattern[]): number {
    if (patterns.length === 0) return 100;
    
    const avgSuccessRate = patterns.reduce((sum, p) => sum + p.successRate, 0) / patterns.length;
    const criticalCount = patterns.filter(p => p.priority === 'critical').length;
    const emergencyOveruse = patterns.filter(p => p.emergencyUsageCount > 10).length;
    
    // Penalties for critical issues
    let health = avgSuccessRate;
    health -= criticalCount * 20; // -20 per critical system
    health -= emergencyOveruse * 10; // -10 per overused emergency system
    
    return Math.max(0, Math.min(100, health));
  }

  /**
   * 📊 GET HEALTH DASHBOARD
   */
  public async getHealthDashboard(): Promise<{
    currentHealth: number;
    criticalAlerts: string[];
    recentTrends: string[];
    actionItems: string[];
  }> {
    const report = await this.analyzeSystemHealth();
    
    return {
      currentHealth: report.overallHealth,
      criticalAlerts: [
        ...report.criticalSystems.map(s => `🚨 ${s} system critical`),
        ...report.emergencyOveruse.map(s => `⚠️ ${s} overusing emergency systems`)
      ],
      recentTrends: [
        `📊 ${report.topFailures.length} systems analyzed`,
        `🎯 ${report.recommendations.length} recommendations generated`,
        `🤖 ${report.autonomousImprovements.length} auto-improvements available`
      ],
      actionItems: [
        ...report.recommendations.slice(0, 3),
        ...report.autonomousImprovements.slice(0, 2)
      ]
    };
  }
}
