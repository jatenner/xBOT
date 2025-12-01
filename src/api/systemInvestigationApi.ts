/**
 * 🔍 SYSTEM INVESTIGATION API
 * Deep dive into actual system state to verify dashboard claims
 */

import { Request, Response } from 'express';
import { getSupabaseClient } from '../db';
import { getHeartbeat } from '../jobs/jobHeartbeat';
import { getCircuitBreakerStatus } from '../jobs/postingQueue';

export async function getSystemInvestigation(req: Request, res: Response): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    const investigation: any = {
      timestamp: new Date().toISOString(),
      posting: {},
      metrics: {},
      coverage: {},
      recentActivity: {},
      circuitBreaker: {},
      summary: {}
    };
    
    // 1. Posting Job Analysis
    const postingHeartbeat = await getHeartbeat('posting');
    investigation.posting = {
      status: postingHeartbeat?.last_run_status || 'unknown',
      lastSuccess: postingHeartbeat?.last_success || null,
      lastFailure: postingHeartbeat?.last_failure || null,
      consecutiveFailures: postingHeartbeat?.consecutive_failures || 0,
      lastError: postingHeartbeat?.last_error || null,
      minutesSinceSuccess: postingHeartbeat?.last_success 
        ? Math.floor((Date.now() - new Date(postingHeartbeat.last_success).getTime()) / (1000 * 60))
        : null
    };
    
    // 2. Posting Attempts Analysis
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: attempts } = await supabase
      .from('posting_attempts')
      .select('status, error_message, created_at')
      .gte('created_at', oneDayAgo)
      .order('created_at', { ascending: false });
    
    if (attempts && attempts.length > 0) {
      // 🔥 FIX: Only count final statuses ('success' or 'failed'), not 'attempting'
      // Every post logs: 'attempting' → 'success' OR 'failed'
      // Counting 'attempting' inflates the denominator incorrectly
      const finalAttempts = attempts.filter(a => a.status !== 'attempting');
      const success = finalAttempts.filter(a => a.status === 'success').length;
      const failed = finalAttempts.filter(a => a.status === 'failed').length;
      const successRate = finalAttempts.length > 0 
        ? (success / finalAttempts.length) * 100 
        : 0;
      
      investigation.posting.attempts = {
        total: finalAttempts.length,
        success,
        failed,
        successRate: successRate.toFixed(1),
        recentFailures: attempts
          .filter(a => a.status === 'failed')
          .slice(0, 5)
          .map(a => ({
            time: a.created_at,
            error: a.error_message?.substring(0, 200) || 'No error message'
          })),
        last10Attempts: attempts.slice(0, 10).map(a => ({
          time: a.created_at,
          status: a.status
        }))
      };
    } else {
      investigation.posting.attempts = {
        total: 0,
        message: 'No posting attempts found in last 24 hours'
      };
    }
    
    // 3. Metrics Scraper Analysis
    const metricsHeartbeat = await getHeartbeat('metrics_scraper') || await getHeartbeat('analytics');
    investigation.metrics = {
      status: metricsHeartbeat?.last_run_status || 'unknown',
      lastSuccess: metricsHeartbeat?.last_success || null,
      lastFailure: metricsHeartbeat?.last_failure || null,
      consecutiveFailures: metricsHeartbeat?.consecutive_failures || 0,
      lastError: metricsHeartbeat?.last_error || null,
      minutesSinceSuccess: metricsHeartbeat?.last_success
        ? Math.floor((Date.now() - new Date(metricsHeartbeat.last_success).getTime()) / (1000 * 60))
        : null,
      isStale: metricsHeartbeat?.last_success
        ? (Date.now() - new Date(metricsHeartbeat.last_success).getTime()) > (20 * 60 * 1000)
        : true
    };
    
    // 4. Metrics Coverage
    const { count: totalPosted } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'posted')
      .not('tweet_id', 'is', null);
    
    const { count: withMetrics } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'posted')
      .not('tweet_id', 'is', null)
      .not('actual_impressions', 'is', null);
    
    investigation.coverage = {
      totalPosted: totalPosted || 0,
      withMetrics: withMetrics || 0,
      coverage: totalPosted && totalPosted > 0
        ? Math.round((withMetrics || 0) / totalPosted * 100)
        : 100,
      missingMetrics: (totalPosted || 0) - (withMetrics || 0)
    };
    
    // 5. Recent Activity
    const { data: recentPosts } = await supabase
      .from('content_metadata')
      .select('decision_id, posted_at, decision_type, status, tweet_id')
      .eq('status', 'posted')
      .order('posted_at', { ascending: false })
      .limit(10);
    
    if (recentPosts && recentPosts.length > 0) {
      const lastPost = new Date(recentPosts[0].posted_at);
      investigation.recentActivity = {
        lastPostTime: recentPosts[0].posted_at,
        minutesSinceLastPost: Math.floor((Date.now() - lastPost.getTime()) / (1000 * 60)),
        isInactive: (Date.now() - lastPost.getTime()) > (30 * 60 * 1000),
        recentPosts: recentPosts.map(p => ({
          time: p.posted_at,
          type: p.decision_type,
          hasTweetId: !!p.tweet_id
        }))
      };
    } else {
      investigation.recentActivity = {
        message: 'No recent posts found'
      };
    }
    
    // 6. Circuit Breaker
    const circuitBreaker = getCircuitBreakerStatus();
    investigation.circuitBreaker = {
      state: circuitBreaker.state,
      failures: circuitBreaker.failures,
      threshold: circuitBreaker.threshold,
      isOpen: circuitBreaker.state === 'open',
      timeUntilReset: circuitBreaker.timeUntilReset || null
    };
    
    // 7. Queued Content
    const { data: queued } = await supabase
      .from('content_metadata')
      .select('decision_id, created_at, decision_type, status')
      .eq('status', 'queued')
      .order('created_at', { ascending: true });
    
    if (queued && queued.length > 0) {
      const oldest = new Date(queued[0].created_at);
      investigation.queuedContent = {
        total: queued.length,
        singles: queued.filter((q: any) => q.decision_type === 'single').length,
        threads: queued.filter((q: any) => q.decision_type === 'thread').length,
        replies: queued.filter((q: any) => q.decision_type === 'reply').length,
        oldestQueuedHours: (Date.now() - oldest.getTime()) / (1000 * 60 * 60),
        isStale: (Date.now() - oldest.getTime()) > (2 * 60 * 60 * 1000)
      };
    } else {
      investigation.queuedContent = {
        total: 0,
        message: 'No content in queue'
      };
    }
    
    // 8. Plan Job
    const planHeartbeat = await getHeartbeat('plan');
    investigation.planJob = {
      status: planHeartbeat?.last_run_status || 'unknown',
      lastSuccess: planHeartbeat?.last_success || null,
      consecutiveFailures: planHeartbeat?.consecutive_failures || 0,
      lastError: planHeartbeat?.last_error || null
    };
    
    // 9. Summary
    const postingWorking = investigation.posting.lastSuccess && 
      investigation.posting.minutesSinceSuccess !== null &&
      investigation.posting.minutesSinceSuccess < 30;
    const metricsWorking = investigation.metrics.lastSuccess &&
      investigation.metrics.minutesSinceSuccess !== null &&
      investigation.metrics.minutesSinceSuccess < 30;
    const successRate = investigation.posting.attempts?.successRate 
      ? parseFloat(investigation.posting.attempts.successRate)
      : null;
    
    investigation.summary = {
      postingJobWorking: postingWorking,
      metricsScraperWorking: metricsWorking,
      postingSuccessRate: successRate,
      circuitBreakerOpen: circuitBreaker.state === 'open',
      overallAssessment: postingWorking && metricsWorking && successRate !== null && successRate > 70 && circuitBreaker.state !== 'open'
        ? 'System is working normally'
        : 'System has issues that need attention'
    };
    
    res.json(investigation);
  } catch (error: any) {
    console.error('[SYSTEM_INVESTIGATION_API] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
}

