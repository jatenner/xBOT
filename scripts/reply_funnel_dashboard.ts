#!/usr/bin/env tsx
/**
 * REPLY FUNNEL DASHBOARD
 * 
 * DB-first dashboard showing reply system metrics for last 6h and 24h
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

interface FunnelMetrics {
  period: string;
  fetch_started: number;
  fetch_completed: number;
  fetch_avg_duration_ms: number;
  candidates_evaluated: number;
  passed_hard_filters: number;
  passed_ai_judge: number;
  queue_size_min: number;
  queue_size_avg: number;
  queue_size_max: number;
  scheduler_ticks: number;
  attempts_created: number;
  permits_approved: number;
  permits_used: number;
  reply_posted: number;
  queued_to_used_p50_min: number;
  queued_to_used_p95_min: number;
  queued_to_used_n: number;
  views_30m_p50: number;
  views_30m_p95: number;
  views_4h_p50: number;
  views_4h_p95: number;
  views_24h_p50: number;
  views_24h_p95: number;
  success_rate_1000_views: number;
  // Bottleneck analysis
  acceptance_rates: {
    fetched_to_evaluated: number;
    evaluated_to_hardpass: number;
    hardpass_to_queued: number;
    queued_to_permit: number;
    permit_to_used: number;
    used_to_posted: number;
  };
  bottleneck_stage: string;
  top_reject_reasons: Array<{ reason: string; count: number }>;
}

export async function getFunnelMetrics(hours: number): Promise<FunnelMetrics> {
  const supabase = getSupabaseClient();
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  
  // Fetch events
  const { data: fetchStarted } = await supabase
    .from('system_events')
    .select('event_data, created_at')
    .eq('event_type', 'reply_v2_fetch_job_started')
    .gte('created_at', since);
  
  const { data: fetchCompleted } = await supabase
    .from('system_events')
    .select('event_data, created_at')
    .eq('event_type', 'reply_v2_fetch_job_completed')
    .gte('created_at', since);
  
  // Calculate avg duration
  const durations: number[] = [];
  fetchStarted?.forEach(start => {
    const completed = fetchCompleted?.find(c => {
      const startTime = new Date(start.created_at).getTime();
      const completeTime = new Date(c.created_at).getTime();
      return completeTime > startTime && completeTime - startTime < 10 * 60 * 1000; // Within 10 min
    });
    if (completed) {
      durations.push(new Date(completed.created_at).getTime() - new Date(start.created_at).getTime());
    }
  });
  const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
  
  // Candidates evaluated
  const { count: evaluatedCount } = await supabase
    .from('candidate_evaluations')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', since);
  
  const { count: passedHardFilters } = await supabase
    .from('candidate_evaluations')
    .select('*', { count: 'exact', head: true })
    .eq('passed_hard_filters', true)
    .gte('created_at', since);
  
  // Passed AI judge = passed hard filters AND has judge_decision='accept' or predicted_tier <= 3
  const { count: passedAIJudge } = await supabase
    .from('candidate_evaluations')
    .select('*', { count: 'exact', head: true })
    .eq('passed_hard_filters', true)
    .lte('predicted_tier', 3) // Tier 1-3 (exclude tier 4 = blocked)
    .gte('created_at', since);
  
  // Queue size stats
  const { data: queueSnapshots } = await supabase
    .from('reply_candidate_queue')
    .select('created_at')
    .eq('status', 'queued')
    .gte('created_at', since);
  
  // Get queue size at different times
  const queueSizes: number[] = [];
  const timePoints = Array.from({ length: 24 }, (_, i) => 
    new Date(Date.now() - (hours * 60 * 60 * 1000) + (i * hours * 60 * 60 * 1000 / 24))
  );
  
  for (const timePoint of timePoints) {
    const { count } = await supabase
      .from('reply_candidate_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'queued')
      .lte('created_at', timePoint.toISOString())
      .gt('expires_at', timePoint.toISOString());
    queueSizes.push(count || 0);
  }
  
  const queueMin = queueSizes.length > 0 ? Math.min(...queueSizes) : 0;
  const queueAvg = queueSizes.length > 0 ? queueSizes.reduce((a, b) => a + b, 0) / queueSizes.length : 0;
  const queueMax = queueSizes.length > 0 ? Math.max(...queueSizes) : 0;
  
  // Scheduler ticks
  const { count: schedulerTicks } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'reply_v2_scheduler_job_started')
    .gte('created_at', since);
  
  // Attempts created
  const { count: attemptsCreated } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'reply_v2_attempt_created')
    .gte('created_at', since);
  
  // Permits approved (from post_attempts table)
  const { count: permitsApproved } = await supabase
    .from('post_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'APPROVED')
    .eq('pipeline_source', 'reply_v2_scheduler')
    .gte('created_at', since);
  
  // Permits used (from post_attempts table)
  const { count: permitsUsed } = await supabase
    .from('post_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'USED')
    .eq('pipeline_source', 'reply_v2_scheduler')
    .not('used_at', 'is', null)
    .gte('used_at', since);
  
  // Reply posted
  const { count: replyPosted } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'reply_posted')
    .gte('created_at', since);
  
  // Queued to USED latency (from post_attempts, only reply_v2_scheduler)
  const { data: usedPermits } = await supabase
    .from('post_attempts')
    .select('created_at, used_at')
    .eq('status', 'USED')
    .eq('pipeline_source', 'reply_v2_scheduler')
    .not('used_at', 'is', null)
    .gte('used_at', since);
  
  const latencies = (usedPermits || [])
    .map(p => {
      const created = new Date(p.created_at).getTime();
      const used = new Date(p.used_at!).getTime();
      return (used - created) / 1000 / 60; // minutes
    })
    .sort((a, b) => a - b);
  
  const p50 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.5)] : 0;
  const p95 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)] : 0;
  
  // Views distribution - use reply_performance_metrics (primary) or content_metadata.actual_impressions (fallback)
  const { data: performanceMetrics } = await supabase
    .from('reply_performance_metrics')
    .select('views_30m, views_4h, views_24h')
    .gte('posted_at', since)
    .not('views_24h', 'is', null); // Only completed metrics
  
  const views30m: number[] = [];
  const views4h: number[] = [];
  const views24h: number[] = [];
  
  // Use performance_metrics if available
  if (performanceMetrics && performanceMetrics.length > 0) {
    for (const metric of performanceMetrics) {
      if (metric.views_30m !== null) views30m.push(metric.views_30m);
      if (metric.views_4h !== null) views4h.push(metric.views_4h);
      if (metric.views_24h !== null) views24h.push(metric.views_24h);
    }
  } else {
    // Fallback to content_metadata.actual_impressions (for replies posted in last 24h, use current views)
    const { data: postedReplies } = await supabase
      .from('content_metadata')
      .select('decision_id, tweet_id, posted_at, actual_impressions')
      .eq('decision_type', 'reply')
      .eq('status', 'posted')
      .not('tweet_id', 'is', null)
      .gte('posted_at', since);
    
    for (const reply of postedReplies || []) {
      if (reply.actual_impressions !== null && reply.actual_impressions > 0) {
        // Use actual_impressions as proxy for 24h views (best available)
        views24h.push(reply.actual_impressions);
      }
    }
  }
  
  const views30mSorted = views30m.sort((a, b) => a - b);
  const views4hSorted = views4h.sort((a, b) => a - b);
  const views24hSorted = views24h.sort((a, b) => a - b);
  
  const views30mP50 = views30mSorted.length > 0 ? views30mSorted[Math.floor(views30mSorted.length * 0.5)] : 0;
  const views30mP95 = views30mSorted.length > 0 ? views30mSorted[Math.floor(views30mSorted.length * 0.95)] : 0;
  const views4hP50 = views4hSorted.length > 0 ? views4hSorted[Math.floor(views4hSorted.length * 0.5)] : 0;
  const views4hP95 = views4hSorted.length > 0 ? views4hSorted[Math.floor(views4hSorted.length * 0.95)] : 0;
  const views24hP50 = views24hSorted.length > 0 ? views24hSorted[Math.floor(views24hSorted.length * 0.5)] : 0;
  const views24hP95 = views24hSorted.length > 0 ? views24hSorted[Math.floor(views24hSorted.length * 0.95)] : 0;
  
  // Success rate (>=1000 views)
  const successCount = views24hSorted.filter(v => v >= 1000).length;
  const successRate = views24hSorted.length > 0 ? (successCount / views24hSorted.length) * 100 : 0;
  
  // 🔒 TASK 3: Bottleneck analysis - acceptance rates per stage
  const fetched = fetchStarted?.length || 0;
  const evaluatedCount = evaluated || 0;
  const hardpass = passedHardFilters || 0;
  
  // Get queued count
  const { count: queued } = await supabase
    .from('reply_candidate_queue')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', since)
    .eq('status', 'queued');
  
  const queuedCount = queued || 0;
  const permitCount = permitsApproved || 0;
  const usedCount = permitsUsed || 0;
  const postedCount = replyPosted || 0;
  
  // Calculate acceptance rates
  const acceptanceRates = {
    fetched_to_evaluated: fetched > 0 ? (evaluatedCount / fetched) * 100 : 0,
    evaluated_to_hardpass: evaluatedCount > 0 ? (hardpass / evaluatedCount) * 100 : 0,
    hardpass_to_queued: hardpass > 0 ? (queuedCount / hardpass) * 100 : 0,
    queued_to_permit: queuedCount > 0 ? (permitCount / queuedCount) * 100 : 0,
    permit_to_used: permitCount > 0 ? (usedCount / permitCount) * 100 : 0,
    used_to_posted: usedCount > 0 ? (postedCount / usedCount) * 100 : 0,
  };
  
  // Find bottleneck (smallest conversion rate)
  const rates = [
    { stage: 'fetched→evaluated', rate: acceptanceRates.fetched_to_evaluated },
    { stage: 'evaluated→hardpass', rate: acceptanceRates.evaluated_to_hardpass },
    { stage: 'hardpass→queued', rate: acceptanceRates.hardpass_to_queued },
    { stage: 'queued→permit', rate: acceptanceRates.queued_to_permit },
    { stage: 'permit→used', rate: acceptanceRates.permit_to_used },
    { stage: 'used→posted', rate: acceptanceRates.used_to_posted },
  ];
  
  const bottleneck = rates.reduce((min, curr) => 
    curr.rate < min.rate ? curr : min
  , rates[0]);
  
  // 🔒 TASK 3: Top reject reasons
  const { data: rejectedCandidates } = await supabase
    .from('candidate_evaluations')
    .select('filter_reason')
    .eq('passed_hard_filters', false)
    .gte('created_at', since)
    .limit(1000);
  
  const rejectReasonCounts = new Map<string, number>();
  rejectedCandidates?.forEach(c => {
    if (c.filter_reason) {
      // Extract primary reason (first part before comma)
      const primaryReason = c.filter_reason.split(',')[0].trim();
      rejectReasonCounts.set(primaryReason, (rejectReasonCounts.get(primaryReason) || 0) + 1);
    }
  });
  
  const topRejectReasons = Array.from(rejectReasonCounts.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  
  return {
    period: `${hours}h`,
    fetch_started: fetchStarted?.length || 0,
    fetch_completed: fetchCompleted?.length || 0,
    fetch_avg_duration_ms: Math.round(avgDuration),
    candidates_evaluated: evaluatedCount || 0,
    passed_hard_filters: passedHardFilters || 0,
    passed_ai_judge: passedAIJudge || 0,
    queue_size_min: queueMin,
    queue_size_avg: Math.round(queueAvg * 10) / 10,
    queue_size_max: queueMax,
    scheduler_ticks: schedulerTicks || 0,
    attempts_created: attemptsCreated || 0,
    permits_approved: permitsApproved || 0,
    permits_used: permitsUsed || 0,
    reply_posted: replyPosted || 0,
    queued_to_used_p50_min: Math.round(p50 * 10) / 10,
    queued_to_used_p95_min: Math.round(p95 * 10) / 10,
    queued_to_used_n: latencies.length,
    views_30m_p50: views30mP50,
    views_30m_p95: views30mP95,
    views_4h_p50: views4hP50,
    views_4h_p95: views4hP95,
    views_24h_p50: views24hP50,
    views_24h_p95: views24hP95,
    success_rate_1000_views: Math.round(successRate * 10) / 10,
    acceptance_rates: acceptanceRates,
    bottleneck_stage: bottleneck.stage,
    top_reject_reasons: topRejectReasons,
  };
}

async function main() {
  console.log('=== REPLY FUNNEL DASHBOARD ===\n');
  
  const metrics6h = await getFunnelMetrics(6);
  const metrics24h = await getFunnelMetrics(24);
  
  console.log('| Metric | Last 6h | Last 24h |');
  console.log('|--------|---------|----------|');
  console.log(`| Fetch started | ${metrics6h.fetch_started} | ${metrics24h.fetch_started} |`);
  console.log(`| Fetch completed | ${metrics6h.fetch_completed} | ${metrics24h.fetch_completed} |`);
  console.log(`| Fetch avg duration (ms) | ${metrics6h.fetch_avg_duration_ms} | ${metrics24h.fetch_avg_duration_ms} |`);
  console.log(`| Candidates evaluated | ${metrics6h.candidates_evaluated} | ${metrics24h.candidates_evaluated} |`);
  console.log(`| Passed hard filters | ${metrics6h.passed_hard_filters} | ${metrics24h.passed_hard_filters} |`);
  console.log(`| Passed AI judge | ${metrics6h.passed_ai_judge} | ${metrics24h.passed_ai_judge} |`);
  console.log(`| Queue size (min/avg/max) | ${metrics6h.queue_size_min}/${metrics6h.queue_size_avg}/${metrics6h.queue_size_max} | ${metrics24h.queue_size_min}/${metrics24h.queue_size_avg}/${metrics24h.queue_size_max} |`);
  console.log(`| Scheduler ticks | ${metrics6h.scheduler_ticks} | ${metrics24h.scheduler_ticks} |`);
  console.log(`| Attempts created | ${metrics6h.attempts_created} | ${metrics24h.attempts_created} |`);
  console.log(`| Permits approved | ${metrics6h.permits_approved} | ${metrics24h.permits_approved} |`);
  console.log(`| Permits used | ${metrics6h.permits_used} | ${metrics24h.permits_used} |`);
  console.log(`| Reply posted | ${metrics6h.reply_posted} | ${metrics24h.reply_posted} |`);
  
  if (metrics6h.queued_to_used_n >= 20) {
    console.log(`| Queued→USED latency (p50/p95) | ${metrics6h.queued_to_used_p50_min}/${metrics6h.queued_to_used_p95_min} min | ${metrics24h.queued_to_used_p50_min}/${metrics24h.queued_to_used_p95_min} min |`);
  } else {
    console.log(`| Queued→USED latency (p50/p95) | n=${metrics6h.queued_to_used_n} | n=${metrics24h.queued_to_used_n} |`);
  }
  
  console.log(`| Views 30m (p50/p95) | ${metrics6h.views_30m_p50}/${metrics6h.views_30m_p95} | ${metrics24h.views_30m_p50}/${metrics24h.views_30m_p95} |`);
  console.log(`| Views 4h (p50/p95) | ${metrics6h.views_4h_p50}/${metrics6h.views_4h_p95} | ${metrics24h.views_4h_p50}/${metrics24h.views_4h_p95} |`);
  console.log(`| Views 24h (p50/p95) | ${metrics6h.views_24h_p50}/${metrics6h.views_24h_p95} | ${metrics24h.views_24h_p50}/${metrics24h.views_24h_p95} |`);
  console.log(`| Success rate (>=1000 views) | ${metrics6h.success_rate_1000_views}% | ${metrics24h.success_rate_1000_views}% |`);
  
  // 🔒 TASK 3: Bottleneck analysis
  console.log('\n=== BOTTLENECK ANALYSIS (24h) ===\n');
  console.log('| Stage | Acceptance Rate |');
  console.log('|-------|-----------------|');
  console.log(`| Fetched → Evaluated | ${metrics24h.acceptance_rates.fetched_to_evaluated.toFixed(1)}% |`);
  console.log(`| Evaluated → Hard Pass | ${metrics24h.acceptance_rates.evaluated_to_hardpass.toFixed(1)}% |`);
  console.log(`| Hard Pass → Queued | ${metrics24h.acceptance_rates.hardpass_to_queued.toFixed(1)}% |`);
  console.log(`| Queued → Permit | ${metrics24h.acceptance_rates.queued_to_permit.toFixed(1)}% |`);
  console.log(`| Permit → Used | ${metrics24h.acceptance_rates.permit_to_used.toFixed(1)}% |`);
  console.log(`| Used → Posted | ${metrics24h.acceptance_rates.used_to_posted.toFixed(1)}% |`);
  
  // Calculate bottleneck rate from acceptance_rates
  const bottleneckStageKey = metrics24h.bottleneck_stage.replace('→', '_to_').toLowerCase().replace(' ', '_');
  const bottleneckRateMap: Record<string, keyof typeof metrics24h.acceptance_rates> = {
    'fetched_to_evaluated': 'fetched_to_evaluated',
    'evaluated_to_hardpass': 'evaluated_to_hardpass',
    'hardpass_to_queued': 'hardpass_to_queued',
    'queued_to_permit': 'queued_to_permit',
    'permit_to_used': 'permit_to_used',
    'used_to_posted': 'used_to_posted',
  };
  const bottleneckKey = bottleneckStageKey.replace('hard_pass', 'hardpass');
  const bottleneckRate = metrics24h.acceptance_rates[bottleneckRateMap[bottleneckKey] || 'fetched_to_evaluated'] || 0;
  console.log(`\n🔴 BOTTLENECK: ${metrics24h.bottleneck_stage} (${bottleneckRate.toFixed(1)}%)`);
  
  // Top reject reasons
  console.log('\n=== TOP 5 REJECT REASONS (24h) ===\n');
  console.log('| Rank | Reason | Count |');
  console.log('|------|--------|-------|');
  metrics24h.top_reject_reasons.forEach((r, i) => {
    console.log(`| ${i + 1} | ${r.reason.substring(0, 50)} | ${r.count} |`);
  });
  
  process.exit(0);
}

main();

