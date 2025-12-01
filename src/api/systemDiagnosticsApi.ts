/**
 * 🔍 SYSTEM DIAGNOSTICS API
 * Provides detailed diagnosis of what's failing in the system
 */

import { Request, Response } from 'express';
import { getSupabaseClient } from '../db';
import { getHeartbeat } from '../jobs/jobHeartbeat';
import { DiagnosticEngine } from '../diagnostics/diagnosticEngine';
import { getCircuitBreakerStatus } from '../jobs/postingQueue';

export async function getSystemDiagnostics(req: Request, res: Response): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    const engine = DiagnosticEngine.getInstance();
    
    // Get diagnostics
    const diagnostics = await engine.runDiagnostics();
    
    // Get job heartbeats
    const jobs = ['plan', 'posting', 'analytics', 'metrics_scraper', 'learn', 'reply_posting'];
    const jobStatuses: any[] = [];
    
    for (const jobName of jobs) {
      const heartbeat = await getHeartbeat(jobName);
      if (heartbeat) {
        jobStatuses.push({
          name: jobName,
          status: heartbeat.last_run_status,
          lastSuccess: heartbeat.last_success,
          lastFailure: heartbeat.last_failure,
          consecutiveFailures: heartbeat.consecutive_failures || 0,
          lastError: heartbeat.last_error || null
        });
      }
    }
    
    // Check posting attempts
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: attempts } = await supabase
      .from('posting_attempts')
      .select('status, error_message, created_at')
      .gte('created_at', oneDayAgo)
      .order('created_at', { ascending: false })
      .limit(50);
    
    let postingStats = {
      total: 0,
      success: 0,
      failed: 0,
      successRate: 0,
      recentFailures: [] as any[]
    };
    
    if (attempts && attempts.length > 0) {
      // 🔥 FIX: Only count final statuses ('success' or 'failed'), not 'attempting'
      // Every post logs: 'attempting' → 'success' OR 'failed'
      // Counting 'attempting' inflates the denominator incorrectly
      const finalAttempts = attempts.filter(a => a.status !== 'attempting');
      postingStats.total = finalAttempts.length;
      postingStats.success = finalAttempts.filter(a => a.status === 'success').length;
      postingStats.failed = finalAttempts.filter(a => a.status === 'failed').length;
      postingStats.successRate = finalAttempts.length > 0 
        ? (postingStats.success / finalAttempts.length) * 100 
        : 0;
      postingStats.recentFailures = attempts
        .filter(a => a.status === 'failed')
        .slice(0, 10)
        .map(a => ({
          time: a.created_at,
          error: a.error_message?.substring(0, 200) || 'No error message'
        }));
    }
    
    // Check queued content
    const { data: queued } = await supabase
      .from('content_metadata')
      .select('decision_id, decision_type, created_at, status')
      .eq('status', 'queued')
      .order('created_at', { ascending: false });
    
    // Get circuit breaker status
    const circuitBreaker = getCircuitBreakerStatus();
    
    // Identify critical issues
    const criticalIssues: any[] = [];
    
    // Check posting health
    const postingStage = diagnostics.stages.posting;
    if (postingStage.healthScore < 50) {
      criticalIssues.push({
        component: 'Posting',
        severity: 'critical',
        issue: `Health score is ${Math.round(postingStage.healthScore)}%`,
        details: postingStage.issues.map((i: any) => i.message).join('; ')
      });
    }
    
    // Check for consecutive failures
    jobStatuses.forEach((job: any) => {
      if (job.consecutiveFailures > 2) {
        criticalIssues.push({
          component: job.name,
          severity: 'critical',
          issue: `${job.consecutiveFailures} consecutive failures`,
          details: job.lastError || 'No error message'
        });
      }
    });
    
    // Check posting success rate
    if (postingStats.total > 0 && postingStats.successRate < 70) {
      criticalIssues.push({
        component: 'Posting',
        severity: 'critical',
        issue: `Success rate is ${postingStats.successRate.toFixed(1)}%`,
        details: `${postingStats.failed} out of ${postingStats.total} attempts failed`
      });
    }
    
    // Check circuit breaker
    if (circuitBreaker.state === 'open') {
      criticalIssues.push({
        component: 'Posting Circuit Breaker',
        severity: 'critical',
        issue: 'Circuit breaker is OPEN - posting blocked',
        details: `Failed ${circuitBreaker.failures} times. Will reset in ${Math.ceil((circuitBreaker.timeUntilReset || 0) / 1000)}s`
      });
    }
    
    res.json({
      overallStatus: diagnostics.overallStatus,
      timestamp: new Date().toISOString(),
      stages: diagnostics.stages,
      jobStatuses,
      postingStats,
      queuedContent: {
        total: queued?.length || 0,
        breakdown: {
          singles: queued?.filter((q: any) => q.decision_type === 'single').length || 0,
          threads: queued?.filter((q: any) => q.decision_type === 'thread').length || 0,
          replies: queued?.filter((q: any) => q.decision_type === 'reply').length || 0
        }
      },
      circuitBreaker,
      criticalIssues
    });
  } catch (error: any) {
    console.error('[SYSTEM_DIAGNOSTICS_API] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
}

