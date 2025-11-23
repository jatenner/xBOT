/**
 * 📊 ERROR ANALYSIS JOB
 * Analyzes system errors and provides insights for improvements
 * Runs every 6 hours to identify patterns and trends
 */

import { ErrorTracker } from '../utils/errorTracker';
import { SystemFailureAuditor } from '../audit/systemFailureAuditor';
import { getSupabaseClient } from '../db/index';

export async function runErrorAnalysis(): Promise<void> {
  console.log('[ERROR_ANALYSIS] 🔍 Starting error analysis...');
  
  try {
    const tracker = ErrorTracker.getInstance();
    const auditor = SystemFailureAuditor.getInstance();
    
    // 1. Get error frequency (last 24 hours)
    const errorFrequency = await tracker.getErrorFrequency(24);
    console.log(`[ERROR_ANALYSIS] 📊 Found ${errorFrequency.length} unique error types in last 24h`);
    
    if (errorFrequency.length > 0) {
      console.log('[ERROR_ANALYSIS] 🔝 Top 10 errors:');
      errorFrequency.slice(0, 10).forEach((error, index) => {
        console.log(`  ${index + 1}. ${error.errorKey}: ${error.count} occurrences (${error.severity})`);
      });
    }
    
    // 2. Get recovery metrics
    const recoveryMetrics = await tracker.getRecoveryMetrics();
    console.log(`[ERROR_ANALYSIS] 📈 Recovery metrics:`);
    console.log(`  Total errors: ${recoveryMetrics.totalErrors}`);
    console.log(`  Recovered: ${recoveryMetrics.recoveredErrors}`);
    console.log(`  Recovery rate: ${recoveryMetrics.recoveryRate.toFixed(1)}%`);
    console.log(`  Avg recovery time: ${Math.round(recoveryMetrics.averageRecoveryTime)}ms`);
    
    // 3. Analyze system health
    const healthReport = await auditor.analyzeSystemHealth();
    console.log(`[ERROR_ANALYSIS] 🏥 System health: ${healthReport.overallHealth}/100`);
    
    if (healthReport.criticalSystems.length > 0) {
      console.log(`[ERROR_ANALYSIS] 🚨 Critical systems: ${healthReport.criticalSystems.join(', ')}`);
    }
    
    if (healthReport.topFailures.length > 0) {
      console.log(`[ERROR_ANALYSIS] 📋 Top failures:`);
      healthReport.topFailures.slice(0, 5).forEach((failure, index) => {
        console.log(`  ${index + 1}. ${failure.systemName}: ${failure.failureCount} failures`);
        console.log(`     Recommendation: ${failure.recommendation}`);
      });
    }
    
    // 4. Store analysis in database
    const supabase = getSupabaseClient();
    await supabase.from('system_events').insert({
      event_type: 'error_analysis_complete',
      severity: 'info',
      event_data: {
        error_frequency: errorFrequency,
        recovery_metrics: recoveryMetrics,
        system_health: healthReport.overallHealth,
        critical_systems: healthReport.criticalSystems,
        top_failures: healthReport.topFailures.slice(0, 10),
        recommendations: healthReport.recommendations,
        timestamp: new Date().toISOString()
      },
      created_at: new Date().toISOString()
    });
    
    // 5. Generate actionable recommendations
    if (errorFrequency.length > 0) {
      const topError = errorFrequency[0];
      if (topError.count >= 10) {
        console.log(`[ERROR_ANALYSIS] ⚠️ ACTION REQUIRED: ${topError.errorKey} has ${topError.count} occurrences`);
        console.log(`[ERROR_ANALYSIS] 💡 Consider investigating root cause and implementing fix`);
      }
    }
    
    if (recoveryMetrics.recoveryRate < 80) {
      console.log(`[ERROR_ANALYSIS] ⚠️ ACTION REQUIRED: Recovery rate is ${recoveryMetrics.recoveryRate.toFixed(1)}% (target: 80%+)`);
      console.log(`[ERROR_ANALYSIS] 💡 Consider improving error recovery mechanisms`);
    }
    
    if (healthReport.overallHealth < 70) {
      console.log(`[ERROR_ANALYSIS] ⚠️ ACTION REQUIRED: System health is ${healthReport.overallHealth}/100 (target: 70+)`);
      console.log(`[ERROR_ANALYSIS] 💡 Review critical systems and implement improvements`);
    }
    
    console.log('[ERROR_ANALYSIS] ✅ Error analysis complete');
    
  } catch (error: any) {
    console.error('[ERROR_ANALYSIS] ❌ Error analysis failed:', error.message);
    // Don't throw - this is a monitoring job, shouldn't break system
  }
}

