/**
 * ⚡ PERFORMANCE OPTIMIZER JOB
 * Monitors system performance and optimizes resource usage
 * Runs every 2 hours to ensure efficient operation
 */

import { getSupabaseClient } from '../db/index';
import { trackError } from '../utils/errorTracker';
import { BrowserSemaphore } from '../browser/BrowserSemaphore';

export interface PerformanceMetrics {
  databaseQueries: {
    slowQueries: number;
    avgQueryTime: number;
    totalQueries: number;
  };
  jobExecution: {
    slowJobs: Array<{ name: string; avgDuration: number }>;
    failedJobs: number;
    totalJobs: number;
  };
  resourceUsage: {
    browserQueueLength: number;
    activeBrowserJobs: number;
    memoryPressure: 'low' | 'medium' | 'high';
  };
  postingEfficiency: {
    successRate: number;
    avgPostTime: number;
    rateLimitHits: number;
  };
}

export interface OptimizationAction {
  type: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  implemented: boolean;
  reason: string;
}

export interface PerformanceReport {
  timestamp: string;
  metrics: PerformanceMetrics;
  optimizations: OptimizationAction[];
  recommendations: string[];
}

export async function runPerformanceOptimization(): Promise<PerformanceReport> {
  console.log('[PERF_OPTIMIZER] ⚡ Starting performance optimization cycle...');
  
  const optimizations: OptimizationAction[] = [];
  const recommendations: string[] = [];
  const supabase = getSupabaseClient();
  
  try {
    // 1. ANALYZE JOB EXECUTION TIMES (from job_heartbeats)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: jobHeartbeats, error: jobError } = await supabase
      .from('job_heartbeats')
      .select('job_name, status, execution_time_ms, created_at')
      .gte('created_at', oneDayAgo)
      .order('created_at', { ascending: false });
    
    const jobMetrics = {
      slowJobs: [] as Array<{ name: string; avgDuration: number }>,
      failedJobs: 0,
      totalJobs: jobHeartbeats?.length || 0
    };
    
    if (!jobError && jobHeartbeats) {
      // Group by job name and calculate averages
      const jobStats = new Map<string, { total: number; count: number; failures: number }>();
      
      jobHeartbeats.forEach((heartbeat: any) => {
        const name = heartbeat.job_name;
        const stats = jobStats.get(name) || { total: 0, count: 0, failures: 0 };
        
        if (heartbeat.status === 'failure') {
          stats.failures++;
        }
        
        if (heartbeat.execution_time_ms) {
          stats.total += heartbeat.execution_time_ms;
          stats.count++;
        }
        
        jobStats.set(name, stats);
      });
      
      // Identify slow jobs (>5 minutes average)
      jobStats.forEach((stats, name) => {
        if (stats.count > 0) {
          const avgDuration = stats.total / stats.count;
          if (avgDuration > 300000) { // 5 minutes
            jobMetrics.slowJobs.push({ name, avgDuration });
          }
        }
        
        if (stats.failures > 0) {
          jobMetrics.failedJobs += stats.failures;
        }
      });
      
      // Optimization: Flag slow jobs for investigation
      if (jobMetrics.slowJobs.length > 0) {
        jobMetrics.slowJobs.forEach(job => {
          optimizations.push({
            type: 'slow_job_identification',
            description: `Job "${job.name}" averaging ${Math.round(job.avgDuration/1000)}s execution time`,
            impact: 'medium',
            implemented: false,
            reason: 'Requires code-level optimization'
          });
          recommendations.push(`Investigate and optimize "${job.name}" job (currently ${Math.round(job.avgDuration/1000)}s avg)`);
        });
      }
    }
    
    // 2. ANALYZE POSTING EFFICIENCY
    const { data: recentPosts, error: postsError } = await supabase
      .from('content_metadata')
      .select('status, posted_at, created_at')
      .gte('created_at', oneDayAgo)
      .in('decision_type', ['single', 'thread']);
    
    const postingMetrics = {
      successRate: 0,
      avgPostTime: 0,
      rateLimitHits: 0
    };
    
    if (!postsError && recentPosts) {
      const successful = recentPosts.filter((p: any) => p.status === 'posted').length;
      const total = recentPosts.length;
      postingMetrics.successRate = total > 0 ? (successful / total) * 100 : 0;
      
      // Calculate average post time (created_at to posted_at)
      const postTimes = recentPosts
        .filter((p: any) => p.status === 'posted' && p.posted_at && p.created_at)
        .map((p: any) => {
          const created = new Date(p.created_at).getTime();
          const posted = new Date(p.posted_at).getTime();
          return posted - created;
        });
      
      if (postTimes.length > 0) {
        postingMetrics.avgPostTime = postTimes.reduce((a, b) => a + b, 0) / postTimes.length;
      }
      
      // Check for rate limit issues (would need to track this separately)
      const failed = recentPosts.filter((p: any) => p.status === 'failed').length;
      if (failed > total * 0.2) { // >20% failure rate
        recommendations.push(`High posting failure rate: ${((failed/total)*100).toFixed(1)}% - investigate rate limiting`);
      }
    }
    
    // 3. ANALYZE RESOURCE USAGE
    const browserSemaphore = BrowserSemaphore.getInstance();
    const browserStatus = browserSemaphore.getStatus();
    
    const resourceMetrics = {
      browserQueueLength: browserStatus.queued,
      activeBrowserJobs: browserStatus.active.length,
      memoryPressure: 'low' as 'low' | 'medium' | 'high'
    };
    
    // Determine memory pressure based on queue length
    if (browserStatus.queued > 10) {
      resourceMetrics.memoryPressure = 'high';
      optimizations.push({
        type: 'browser_queue_optimization',
        description: `Browser queue has ${browserStatus.queued} jobs waiting - consider optimizing browser operations`,
        impact: 'high',
        implemented: false,
        reason: 'Requires browser operation optimization'
      });
      recommendations.push(`Browser queue backed up (${browserStatus.queued} jobs) - optimize browser-heavy operations`);
    } else if (browserStatus.queued > 5) {
      resourceMetrics.memoryPressure = 'medium';
    }
    
    // 4. ANALYZE DATABASE QUERY PERFORMANCE
    // Note: Would need query logging to get actual query times
    // For now, we'll check for common performance issues
    
    const { data: stuckPosts } = await supabase
      .from('content_metadata')
      .select('decision_id', { count: 'exact', head: true })
      .eq('status', 'posting')
      .lt('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString());
    
    if (stuckPosts && stuckPosts.length > 10) {
      recommendations.push(`High number of stuck posts (${stuckPosts.length}) - check posting queue health`);
    }
    
    // 5. GENERATE OPTIMIZATION RECOMMENDATIONS
    if (postingMetrics.successRate < 80) {
      recommendations.push(`Posting success rate is ${postingMetrics.successRate.toFixed(1)}% (target: 80%+)`);
    }
    
    if (postingMetrics.avgPostTime > 600000) { // >10 minutes
      recommendations.push(`Average post time is ${Math.round(postingMetrics.avgPostTime/1000)}s (target: <10min)`);
    }
    
    if (jobMetrics.failedJobs > jobMetrics.totalJobs * 0.1) {
      recommendations.push(`High job failure rate: ${((jobMetrics.failedJobs/jobMetrics.totalJobs)*100).toFixed(1)}%`);
    }
    
    // 6. CREATE PERFORMANCE REPORT
    const metrics: PerformanceMetrics = {
      databaseQueries: {
        slowQueries: 0, // Would need query logging
        avgQueryTime: 0,
        totalQueries: 0
      },
      jobExecution: jobMetrics,
      resourceUsage: resourceMetrics,
      postingEfficiency: postingMetrics
    };
    
    const report: PerformanceReport = {
      timestamp: new Date().toISOString(),
      metrics,
      optimizations,
      recommendations
    };
    
    // Store report in system_events
    await supabase.from('system_events').insert({
      event_type: 'performance_optimization_report',
      severity: resourceMetrics.memoryPressure === 'high' ? 'warning' : 'info',
      event_data: report,
      created_at: new Date().toISOString()
    });
    
    console.log(`[PERF_OPTIMIZER] ✅ Performance optimization complete:`);
    console.log(`  Posting success rate: ${postingMetrics.successRate.toFixed(1)}%`);
    console.log(`  Avg post time: ${Math.round(postingMetrics.avgPostTime/1000)}s`);
    console.log(`  Browser queue: ${browserStatus.queued} jobs`);
    console.log(`  Slow jobs: ${jobMetrics.slowJobs.length}`);
    console.log(`  Recommendations: ${recommendations.length}`);
    
    return report;
    
  } catch (error: any) {
    console.error('[PERF_OPTIMIZER] ❌ Performance optimization failed:', error.message);
    
    await trackError(
      'performance_optimizer',
      'optimization_failed',
      error.message,
      'error',
      { error_stack: error.stack?.substring(0, 300) }
    );
    
    return {
      timestamp: new Date().toISOString(),
      metrics: {
        databaseQueries: { slowQueries: 0, avgQueryTime: 0, totalQueries: 0 },
        jobExecution: { slowJobs: [], failedJobs: 0, totalJobs: 0 },
        resourceUsage: { browserQueueLength: 0, activeBrowserJobs: 0, memoryPressure: 'low' },
        postingEfficiency: { successRate: 0, avgPostTime: 0, rateLimitHits: 0 }
      },
      optimizations: [],
      recommendations: ['Performance optimization cycle failed - check logs']
    };
  }
}




