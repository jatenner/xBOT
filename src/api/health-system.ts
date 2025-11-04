/**
 * 🏥 SYSTEM HEALTH ENDPOINT
 * Provides real-time visibility into content system health
 */

import { getSupabaseClient } from '../db/index';
import { getPlanMetrics } from '../jobs/planJobUnified';
import { getReplyLLMMetrics } from '../jobs/replyJob';

export interface SystemHealthResponse {
  status: 'healthy' | 'degraded' | 'critical';
  timestamp: string;
  metrics: {
    posts_today: number;
    posts_target: number;
    success_rate_percent: number;
    queue_depth: number;
    queue_ready: number;
    threads_today: number;
    replies_today: number;
  };
  generation: {
    calls_total: number;
    calls_successful: number;
    calls_failed: number;
    failure_rate_percent: number;
    avg_quality_score: number;
  };
  errors: {
    recent_count: number;
    categories: Record<string, number>;
  };
  alerts: string[];
}

export async function getSystemHealth(): Promise<SystemHealthResponse> {
  const supabase = getSupabaseClient();
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  
  // Get metrics
  const planMetrics = getPlanMetrics();
  const replyMetrics = getReplyLLMMetrics();
  
  // Count today's posts
  const { count: postsToday } = await supabase
    .from('posted_decisions')
    .select('*', { count: 'exact', head: true })
    .gte('posted_at', todayStart.toISOString());
  
  // Count today's attempts
  const { count: attemptsToday } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', todayStart.toISOString());
  
  // Queue depth
  const { count: queueDepth } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'queued');
  
  // Ready to post
  const { count: queueReady } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'queued')
    .lte('scheduled_at', new Date(Date.now() + 5 * 60 * 1000).toISOString());
  
  // Threads today
  const { count: threadsToday } = await supabase
    .from('posted_decisions')
    .select('*', { count: 'exact', head: true })
    .gte('posted_at', todayStart.toISOString())
    .eq('decision_type', 'thread');
  
  // Replies today
  const { count: repliesToday } = await supabase
    .from('posted_decisions')
    .select('*', { count: 'exact', head: true })
    .gte('posted_at', todayStart.toISOString())
    .eq('decision_type', 'reply');
  
  // Recent errors (last hour)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const { data: recentErrors } = await supabase
    .from('system_errors')
    .select('error_category')
    .gte('created_at', oneHourAgo.toISOString());
  
  const errorCategories = (recentErrors || []).reduce((acc: Record<string, number>, err: any) => {
    const cat = err.error_category || 'unknown';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {});
  
  // Calculate metrics
  const postsCount = postsToday || 0;
  const attemptsCount = attemptsToday || 0;
  const successRate = attemptsCount > 0 ? (postsCount / attemptsCount) * 100 : 0;
  const failureRate = planMetrics.calls_total > 0 
    ? (planMetrics.calls_failed / planMetrics.calls_total) * 100 
    : 0;
  
  // Determine status
  const alerts: string[] = [];
  let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
  
  // Check for issues
  if (postsCount < 20 && now.getHours() > 12) {
    alerts.push('Low post count for this time of day');
    status = 'degraded';
  }
  
  if ((queueDepth || 0) === 0) {
    alerts.push('Queue is empty - generation may be failing');
    status = 'critical';
  }
  
  if (successRate < 50) {
    alerts.push(`Low success rate: ${successRate.toFixed(1)}%`);
    status = 'degraded';
  }
  
  if (failureRate > 30) {
    alerts.push(`High generation failure rate: ${failureRate.toFixed(1)}%`);
    status = 'degraded';
  }
  
  if ((recentErrors || []).length > 10) {
    alerts.push(`High error rate: ${recentErrors.length} errors in last hour`);
    status = 'critical';
  }
  
  // All clear
  if (alerts.length === 0) {
    status = 'healthy';
  }
  
  return {
    status,
    timestamp: now.toISOString(),
    metrics: {
      posts_today: postsCount,
      posts_target: 48,
      success_rate_percent: Math.round(successRate * 10) / 10,
      queue_depth: queueDepth || 0,
      queue_ready: queueReady || 0,
      threads_today: threadsToday || 0,
      replies_today: repliesToday || 0
    },
    generation: {
      calls_total: planMetrics.calls_total + replyMetrics.calls_total,
      calls_successful: planMetrics.calls_successful,
      calls_failed: planMetrics.calls_failed + replyMetrics.calls_failed,
      failure_rate_percent: Math.round(failureRate * 10) / 10,
      avg_quality_score: Math.round(planMetrics.avg_quality_score * 10) / 10
    },
    errors: {
      recent_count: (recentErrors || []).length,
      categories: errorCategories
    },
    alerts
  };
}

