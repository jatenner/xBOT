/**
 * 🚨 EMERGENCY SYSTEM TRACKER
 * 
 * Automatically tracks when emergency systems are used and identifies
 * patterns that indicate primary systems are failing too frequently.
 * 
 * This helps us:
 * 1. Reduce dependency on emergency fallbacks  
 * 2. Fix root causes of primary system failures
 * 3. Improve overall system reliability
 * 4. Provide data for autonomous improvements
 */

import { SystemFailureAuditor } from './systemFailureAuditor';

export class EmergencySystemTracker {
  private static instance: EmergencySystemTracker;
  private auditor: SystemFailureAuditor;
  private emergencyUsage: Map<string, number> = new Map();

  constructor() {
    this.auditor = SystemFailureAuditor.getInstance();
  }

  public static getInstance(): EmergencySystemTracker {
    if (!EmergencySystemTracker.instance) {
      EmergencySystemTracker.instance = new EmergencySystemTracker();
    }
    return EmergencySystemTracker.instance;
  }

  /**
   * 🚨 TRACK EMERGENCY SYSTEM USAGE
   */
  public async trackEmergencyUsage(
    primarySystem: string,
    emergencySystem: string,
    reason: string,
    context?: Record<string, any>
  ): Promise<void> {
    console.log(`🚨 EMERGENCY_USED: ${emergencySystem} replacing ${primarySystem} - ${reason}`);
    
    // Track usage count
    const key = `${primarySystem}→${emergencySystem}`;
    this.emergencyUsage.set(key, (this.emergencyUsage.get(key) || 0) + 1);
    
    // Record in failure auditor
    await this.auditor.recordFailure({
      systemName: primarySystem,
      failureType: 'emergency_fallback',
      rootCause: reason,
      emergencySystemUsed: emergencySystem,
      attemptedAction: context?.action || 'unknown_action',
      errorMessage: context?.error,
      metadata: {
        ...context,
        emergencyUsageCount: this.emergencyUsage.get(key)
      }
    });
    
    // Check if this system is overusing emergency fallbacks
    const usageCount = this.emergencyUsage.get(key) || 0;
    if (usageCount % 5 === 0) { // Every 5th usage
      console.log(`⚠️ EMERGENCY_OVERUSE: ${key} used ${usageCount} times`);
      await this.analyzeEmergencyPattern(primarySystem, emergencySystem);
    }
  }

  /**
   * 📊 ANALYZE EMERGENCY PATTERNS
   */
  private async analyzeEmergencyPattern(primarySystem: string, emergencySystem: string): Promise<void> {
    const key = `${primarySystem}→${emergencySystem}`;
    const usageCount = this.emergencyUsage.get(key) || 0;
    
    console.log(`🔍 EMERGENCY_PATTERN_ANALYSIS: ${key} (${usageCount} uses)`);
    
    // Generate recommendations based on usage patterns
    let recommendation = '';
    let priority: 'low' | 'medium' | 'high' | 'critical' = 'medium';
    
    if (usageCount >= 20) {
      recommendation = `CRITICAL: ${primarySystem} needs immediate redesign - emergency system used ${usageCount} times`;
      priority = 'critical';
    } else if (usageCount >= 10) {
      recommendation = `HIGH: ${primarySystem} reliability issues - strengthen primary logic`;
      priority = 'high';
    } else if (usageCount >= 5) {
      recommendation = `MEDIUM: Monitor ${primarySystem} - improve error handling`;
      priority = 'medium';
    }
    
    if (recommendation) {
      console.log(`💡 EMERGENCY_RECOMMENDATION: ${recommendation}`);
      
      // Store improvement recommendation
      await this.auditor.recordFailure({
        systemName: primarySystem,
        failureType: 'emergency_fallback',
        rootCause: 'frequent_emergency_usage',
        emergencySystemUsed: emergencySystem,
        attemptedAction: 'pattern_analysis',
        metadata: {
          usageCount,
          recommendation,
          priority,
          analysisType: 'emergency_pattern'
        }
      });
    }
  }

  /**
   * 📈 GET EMERGENCY USAGE REPORT
   */
  public getEmergencyUsageReport(): {
    totalEmergencyUses: number;
    systemBreakdown: Array<{
      primarySystem: string;
      emergencySystem: string;
      usageCount: number;
      riskLevel: 'low' | 'medium' | 'high' | 'critical';
    }>;
    recommendations: string[];
  } {
    const systemBreakdown = Array.from(this.emergencyUsage.entries()).map(([key, count]) => {
      const [primarySystem, emergencySystem] = key.split('→');
      
      let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
      if (count >= 20) riskLevel = 'critical';
      else if (count >= 10) riskLevel = 'high';
      else if (count >= 5) riskLevel = 'medium';
      
      return {
        primarySystem,
        emergencySystem,
        usageCount: count,
        riskLevel
      };
    }).sort((a, b) => b.usageCount - a.usageCount);
    
    const totalEmergencyUses = Array.from(this.emergencyUsage.values()).reduce((sum, count) => sum + count, 0);
    
    const recommendations = systemBreakdown
      .filter(item => item.riskLevel !== 'low')
      .map(item => {
        switch (item.riskLevel) {
          case 'critical':
            return `🚨 URGENT: Redesign ${item.primarySystem} (${item.usageCount} emergency uses)`;
          case 'high':
            return `⚠️ HIGH: Strengthen ${item.primarySystem} reliability`;
          case 'medium':
            return `📊 MONITOR: Improve ${item.primarySystem} error handling`;
          default:
            return '';
        }
      })
      .filter(rec => rec !== '');
    
    return {
      totalEmergencyUses,
      systemBreakdown,
      recommendations
    };
  }

  /**
   * 🔧 COMMON EMERGENCY TRACKING HELPERS
   */
  
  // For thread posting failures
  public async trackThreadEmergency(reason: string, context?: any): Promise<void> {
    await this.trackEmergencyUsage(
      'BulletproofThreadGeneration',
      'EmergencyThreadFixer',
      reason,
      { action: 'thread_posting', ...context }
    );
  }
  
  // For content generation failures  
  public async trackContentEmergency(reason: string, context?: any): Promise<void> {
    await this.trackEmergencyUsage(
      'ViralContentOrchestrator',
      'EmergencyContentGeneration',
      reason,
      { action: 'content_generation', ...context }
    );
  }
  
  // For posting failures
  public async trackPostingEmergency(reason: string, context?: any): Promise<void> {
    await this.trackEmergencyUsage(
      'SimpleThreadPoster',
      'FallbackPoster',
      reason,
      { action: 'post_submission', ...context }
    );
  }
  
  // For reply generation failures
  public async trackReplyEmergency(reason: string, context?: any): Promise<void> {
    await this.trackEmergencyUsage(
      'EnhancedStrategicReplies',
      'BasicReplyGeneration',
      reason,
      { action: 'reply_generation', ...context }
    );
  }
  
  // For database failures
  public async trackDatabaseEmergency(reason: string, context?: any): Promise<void> {
    await this.trackEmergencyUsage(
      'SupabaseConnection',
      'LocalCaching',
      reason,
      { action: 'database_operation', ...context }
    );
  }
  
  // For API failures
  public async trackAPIEmergency(apiName: string, reason: string, context?: any): Promise<void> {
    await this.trackEmergencyUsage(
      `${apiName}API`,
      'RetryMechanism',
      reason,
      { action: 'api_call', api: apiName, ...context }
    );
  }
}
