/**
 * 🏥 SYSTEM HEALTH MONITOR JOB
 * Comprehensive system health monitoring and autonomous improvements
 * Runs every 30 minutes to track system health and suggest improvements
 */

import { ErrorTracker } from '../utils/errorTracker';
import { SystemFailureAuditor } from '../audit/systemFailureAuditor';
import { getSupabaseClient } from '../db/index';

export interface SystemHealthReport {
  timestamp: string;
  overallHealth: number; // 0-100
  errorRate: number; // errors per hour
  recoveryRate: number; // % of errors recovered
  postingSuccessRate: number; // % of posts that succeed
  systemAvailability: number; // % of time system is operational
  criticalIssues: string[];
  recommendations: string[];
  autonomousActions: string[];
}

export async function runSystemHealthMonitor(): Promise<SystemHealthReport> {
  console.log('[HEALTH_MONITOR] 🏥 Starting comprehensive system health check...');
  
  try {
    const tracker = ErrorTracker.getInstance();
    const auditor = SystemFailureAuditor.getInstance();
    const supabase = getSupabaseClient();
    
    // 1. Get error metrics
    const errorFrequency = await tracker.getErrorFrequency(24);
    const recoveryMetrics = await tracker.getRecoveryMetrics();
    
    // 2. Get posting success rate (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: totalPosts } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .in('decision_type', ['single', 'thread', 'reply'])
      .gte('created_at', oneDayAgo);
    
    const { count: successfulPosts } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .in('decision_type', ['single', 'thread', 'reply'])
      .eq('status', 'posted')
      .gte('created_at', oneDayAgo);
    
    const postingSuccessRate = totalPosts && totalPosts > 0 
      ? (successfulPosts || 0) / totalPosts * 100 
      : 100;
    
    // 3. Get job health (from job_heartbeats)
    const { data: jobHealth } = await supabase
      .from('job_heartbeats')
      .select('job_name, last_run_status, consecutive_failures, updated_at')
      .gte('updated_at', oneDayAgo);
    
    const totalJobs = jobHealth?.length || 0;
    const failedJobs = jobHealth?.filter(j => j.last_run_status === 'failure').length || 0;
    const jobHealthRate = totalJobs > 0 ? ((totalJobs - failedJobs) / totalJobs) * 100 : 100;
    
    // 4. Calculate overall health score
    const errorRate = errorFrequency.reduce((sum, e) => sum + e.count, 0) / 24; // errors per hour
    const errorHealth = Math.max(0, 100 - (errorRate * 10)); // Penalize high error rates
    
    const overallHealth = Math.round(
      (errorHealth * 0.3) +
      (recoveryMetrics.recoveryRate * 0.2) +
      (postingSuccessRate * 0.3) +
      (jobHealthRate * 0.2)
    );
    
    // 5. Identify critical issues
    const criticalIssues: string[] = [];
    
    if (errorRate > 5) {
      criticalIssues.push(`High error rate: ${errorRate.toFixed(1)} errors/hour`);
    }
    
    if (recoveryMetrics.recoveryRate < 80) {
      criticalIssues.push(`Low recovery rate: ${recoveryMetrics.recoveryRate.toFixed(1)}%`);
    }
    
    if (postingSuccessRate < 90) {
      criticalIssues.push(`Low posting success rate: ${postingSuccessRate.toFixed(1)}%`);
    }
    
    if (jobHealthRate < 90) {
      criticalIssues.push(`Job failures detected: ${failedJobs}/${totalJobs} jobs failing`);
    }
    
    // 6. Generate recommendations
    const recommendations: string[] = [];
    const autonomousActions: string[] = [];
    
    if (errorFrequency.length > 0) {
      const topError = errorFrequency[0];
      if (topError.count >= 10) {
        recommendations.push(`Investigate ${topError.errorKey} (${topError.count} occurrences)`);
        autonomousActions.push(`Auto-increase retry attempts for ${topError.errorKey}`);
      }
    }
    
    if (recoveryMetrics.recoveryRate < 80) {
      recommendations.push('Improve error recovery mechanisms');
      autonomousActions.push('Auto-enable additional recovery strategies');
    }
    
    if (postingSuccessRate < 90) {
      recommendations.push('Review posting failures and improve success rate');
      autonomousActions.push('Auto-adjust posting strategy based on failure patterns');
    }
    
    // 7. Store health report
    const healthReport: SystemHealthReport = {
      timestamp: new Date().toISOString(),
      overallHealth,
      errorRate,
      recoveryRate: recoveryMetrics.recoveryRate,
      postingSuccessRate,
      systemAvailability: overallHealth, // Simplified: health = availability
      criticalIssues,
      recommendations,
      autonomousActions
    };
    
    await supabase.from('system_events').insert({
      event_type: 'system_health_report',
      severity: overallHealth < 70 ? 'warning' : 'info',
      event_data: healthReport,
      created_at: new Date().toISOString()
    });
    
    // 8. Log summary
    console.log('[HEALTH_MONITOR] 📊 System Health Summary:');
    console.log(`  Overall Health: ${overallHealth}/100`);
    console.log(`  Error Rate: ${errorRate.toFixed(2)} errors/hour`);
    console.log(`  Recovery Rate: ${recoveryMetrics.recoveryRate.toFixed(1)}%`);
    console.log(`  Posting Success: ${postingSuccessRate.toFixed(1)}%`);
    console.log(`  Job Health: ${jobHealthRate.toFixed(1)}%`);
    
    if (criticalIssues.length > 0) {
      console.log('[HEALTH_MONITOR] 🚨 Critical Issues:');
      criticalIssues.forEach(issue => console.log(`  - ${issue}`));
    }
    
    if (recommendations.length > 0) {
      console.log('[HEALTH_MONITOR] 💡 Recommendations:');
      recommendations.forEach(rec => console.log(`  - ${rec}`));
    }
    
    if (autonomousActions.length > 0) {
      console.log('[HEALTH_MONITOR] 🤖 Autonomous Actions:');
      autonomousActions.forEach(action => console.log(`  - ${action}`));
    }
    
    console.log('[HEALTH_MONITOR] ✅ Health check complete');
    
    return healthReport;
    
  } catch (error: any) {
    console.error('[HEALTH_MONITOR] ❌ Health check failed:', error.message);
    
    // Return minimal report on error
    return {
      timestamp: new Date().toISOString(),
      overallHealth: 0,
      errorRate: 0,
      recoveryRate: 0,
      postingSuccessRate: 0,
      systemAvailability: 0,
      criticalIssues: [`Health check failed: ${error.message}`],
      recommendations: ['Fix health monitoring system'],
      autonomousActions: []
    };
  }
}

