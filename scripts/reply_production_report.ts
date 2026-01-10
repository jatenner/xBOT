#!/usr/bin/env tsx
/**
 * REPLY PRODUCTION REPORT
 * 
 * Generates comprehensive report with:
 * - Funnel metrics (6h/24h)
 * - Top 20 accepted candidates with scores + why chosen
 * - Top 20 rejected candidates with reject reasons
 * - Recommended threshold tweaks
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

// Copy getFunnelMetrics implementation from dashboard (since it's not easily importable)
async function getFunnelMetrics(hours: number): Promise<any> {
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
      return completeTime > startTime && completeTime - startTime < 10 * 60 * 1000;
    });
    if (completed) {
      durations.push(new Date(completed.created_at).getTime() - new Date(start.created_at).getTime());
    }
  });
  const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
  
  // Candidates evaluated
  const { count: evaluated } = await supabase
    .from('candidate_evaluations')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', since);
  
  const { count: passedHardFilters } = await supabase
    .from('candidate_evaluations')
    .select('*', { count: 'exact', head: true })
    .eq('passed_hard_filters', true)
    .gte('created_at', since);
  
  const { count: passedAIJudge } = await supabase
    .from('candidate_evaluations')
    .select('*', { count: 'exact', head: true })
    .eq('passed_hard_filters', true)
    .lte('predicted_tier', 3)
    .gte('created_at', since);
  
  // Queue size stats (simplified - get current size)
  const { count: queueSize } = await supabase
    .from('reply_candidate_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'queued')
    .gt('expires_at', new Date().toISOString());
  
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
  
  // Permits approved
  const { count: permitsApproved } = await supabase
    .from('post_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'APPROVED')
    .eq('pipeline_source', 'reply_v2_scheduler')
    .gte('created_at', since);
  
  // Permits used
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
  
  // Queued to USED latency
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
      return (used - created) / 1000 / 60;
    })
    .sort((a, b) => a - b);
  
  const p50 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.5)] : 0;
  const p95 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)] : 0;
  
  // Views distribution
  const { data: performanceMetrics } = await supabase
    .from('reply_performance_metrics')
    .select('views_30m, views_4h, views_24h')
    .gte('posted_at', since)
    .not('views_24h', 'is', null);
  
  const views30m: number[] = [];
  const views4h: number[] = [];
  const views24h: number[] = [];
  
  if (performanceMetrics && performanceMetrics.length > 0) {
    for (const metric of performanceMetrics) {
      if (metric.views_30m !== null) views30m.push(metric.views_30m);
      if (metric.views_4h !== null) views4h.push(metric.views_4h);
      if (metric.views_24h !== null) views24h.push(metric.views_24h);
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
  
  const successCount = views24hSorted.filter(v => v >= 1000).length;
  const successRate = views24hSorted.length > 0 ? (successCount / views24hSorted.length) * 100 : 0;
  
  return {
    period: `${hours}h`,
    fetch_started: fetchStarted?.length || 0,
    fetch_completed: fetchCompleted?.length || 0,
    fetch_avg_duration_ms: Math.round(avgDuration),
    candidates_evaluated: evaluated || 0,
    passed_hard_filters: passedHardFilters || 0,
    passed_ai_judge: passedAIJudge || 0,
    queue_size_min: queueSize || 0,
    queue_size_avg: queueSize || 0,
    queue_size_max: queueSize || 0,
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
  };
}

interface CandidateSummary {
  tweet_id: string;
  author: string;
  content_preview: string;
  overall_score: number;
  predicted_tier: number;
  predicted_24h_views: number;
  velocity_score: number;
  recency_score: number;
  author_signal_score: number;
  filter_reason?: string;
  judge_decision?: string;
  why_chosen?: string;
}

async function getTopAcceptedCandidates(limit: number = 20): Promise<CandidateSummary[]> {
  const supabase = getSupabaseClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  const { data: candidates } = await supabase
    .from('candidate_evaluations')
    .select('candidate_tweet_id, candidate_author_username, candidate_content, overall_score, predicted_tier, predicted_24h_views, velocity_score, recency_score, author_signal_score, filter_reason, judge_decision, judge_reasons')
    .eq('passed_hard_filters', true)
    .lte('predicted_tier', 3) // Tier 1-3 only
    .gte('created_at', since)
    .order('overall_score', { ascending: false })
    .limit(limit);
  
  return (candidates || []).map(c => ({
    tweet_id: c.candidate_tweet_id,
    author: c.candidate_author_username,
    content_preview: (c.candidate_content || '').substring(0, 80) + '...',
    overall_score: Number(c.overall_score || 0),
    predicted_tier: c.predicted_tier || 4,
    predicted_24h_views: c.predicted_24h_views || 0,
    velocity_score: Number(c.velocity_score || 0),
    recency_score: Number(c.recency_score || 0),
    author_signal_score: Number(c.author_signal_score || 0),
    filter_reason: c.filter_reason || undefined,
    judge_decision: c.judge_decision?.decision || undefined,
    why_chosen: c.judge_decision?.reasons || c.filter_reason || 'high_score',
  }));
}

async function getTopRejectedCandidates(limit: number = 20): Promise<CandidateSummary[]> {
  const supabase = getSupabaseClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  const { data: candidates } = await supabase
    .from('candidate_evaluations')
    .select('candidate_tweet_id, candidate_author_username, candidate_content, overall_score, predicted_tier, predicted_24h_views, velocity_score, recency_score, author_signal_score, filter_reason, judge_decision, judge_reasons')
    .eq('passed_hard_filters', false)
    .gte('created_at', since)
    .order('overall_score', { ascending: false })
    .limit(limit);
  
  return (candidates || []).map(c => ({
    tweet_id: c.candidate_tweet_id,
    author: c.candidate_author_username,
    content_preview: (c.candidate_content || '').substring(0, 80) + '...',
    overall_score: Number(c.overall_score || 0),
    predicted_tier: c.predicted_tier || 4,
    predicted_24h_views: c.predicted_24h_views || 0,
    velocity_score: Number(c.velocity_score || 0),
    recency_score: Number(c.recency_score || 0),
    author_signal_score: Number(c.author_signal_score || 0),
    filter_reason: c.filter_reason || 'unknown',
    judge_decision: c.judge_decision?.decision || undefined,
    why_chosen: undefined,
  }));
}

function analyzeRejectReasons(rejected: CandidateSummary[]): Map<string, number> {
  const reasons = new Map<string, number>();
  
  for (const candidate of rejected) {
    const reason = candidate.filter_reason || 'unknown';
    // Extract primary reason (first part before comma)
    const primaryReason = reason.split(',')[0].trim();
    reasons.set(primaryReason, (reasons.get(primaryReason) || 0) + 1);
  }
  
  return reasons;
}

function generateThresholdRecommendations(
  metrics6h: any,
  metrics24h: any,
  accepted: CandidateSummary[],
  rejected: CandidateSummary[]
): string[] {
  const recommendations: string[] = [];
  
  // Check throughput
  const repliesPerHour6h = metrics6h.reply_posted / 6;
  const repliesPerHour24h = metrics24h.reply_posted / 24;
  
  if (repliesPerHour6h < 3.5 || repliesPerHour24h < 3.5) {
    recommendations.push(`⚠️ LOW THROUGHPUT: ${repliesPerHour6h.toFixed(1)}/hour (6h), ${repliesPerHour24h.toFixed(1)}/hour (24h). Target: 4/hour`);
    recommendations.push(`   → Consider: Lower predicted_tier threshold from 3 to 2 (allow tier 3 candidates)`);
    recommendations.push(`   → Consider: Increase discovered_accounts feed weight from 0.15 to 0.20`);
  }
  
  // Check success rate
  const successRate6h = metrics6h.success_rate_1000_views;
  const successRate24h = metrics24h.success_rate_1000_views;
  
  if (successRate24h < 50) {
    recommendations.push(`⚠️ LOW SUCCESS RATE: ${successRate24h.toFixed(1)}% >=1000 views (24h). Target: >=60%`);
    recommendations.push(`   → Consider: Increase velocity threshold (MIN_LIKES_PER_HOUR from 2 to 3)`);
    recommendations.push(`   → Consider: Increase predicted_24h_views threshold (require >=800 instead of >=500)`);
  } else if (successRate24h >= 70 && repliesPerHour24h < 4) {
    recommendations.push(`✅ HIGH SUCCESS RATE: ${successRate24h.toFixed(1)}% >=1000 views. Can relax thresholds slightly.`);
    recommendations.push(`   → Consider: Lower velocity threshold (MIN_LIKES_PER_HOUR from 2 to 1.5) to increase throughput`);
  }
  
  // Check queue size
  const avgQueueSize6h = metrics6h.queue_size_avg;
  const avgQueueSize24h = metrics24h.queue_size_avg;
  
  if (avgQueueSize24h < 10) {
    recommendations.push(`⚠️ LOW QUEUE SIZE: ${avgQueueSize24h.toFixed(1)} avg (24h). Target: >=15`);
    recommendations.push(`   → Consider: Increase fetch frequency or expand feed sources`);
    recommendations.push(`   → Consider: Lower acceptance_threshold in control_plane_state`);
  }
  
  // Analyze reject reasons
  const rejectReasons = analyzeRejectReasons(rejected);
  const topRejectReason = Array.from(rejectReasons.entries())
    .sort((a, b) => b[1] - a[1])[0];
  
  if (topRejectReason) {
    recommendations.push(`📊 TOP REJECT REASON: "${topRejectReason[0]}" (${topRejectReason[1]} candidates)`);
    
    if (topRejectReason[0].includes('low_velocity')) {
      recommendations.push(`   → Consider: Lower MIN_LIKES_PER_HOUR threshold if throughput is low`);
    } else if (topRejectReason[0].includes('low_conversation')) {
      recommendations.push(`   → Consider: Lower MIN_REPLY_RATE threshold or allow 0 replies for very recent tweets`);
    } else if (topRejectReason[0].includes('low_expected_views')) {
      recommendations.push(`   → Consider: Lower MIN_EXPECTED_VIEWS threshold or improve view prediction`);
    }
  }
  
  // Check candidate quality distribution
  const avgScoreAccepted = accepted.length > 0
    ? accepted.reduce((sum, c) => sum + c.overall_score, 0) / accepted.length
    : 0;
  
  if (avgScoreAccepted < 70) {
    recommendations.push(`⚠️ LOW ACCEPTED SCORE: ${avgScoreAccepted.toFixed(1)} avg. Target: >=75`);
    recommendations.push(`   → Consider: Increase overall_score threshold or improve scoring weights`);
  }
  
  return recommendations;
}

async function main() {
  console.log('=== REPLY PRODUCTION REPORT ===\n');
  
  // Get funnel metrics
  console.log('📊 Fetching funnel metrics...');
  const metrics6h = await getFunnelMetrics(6);
  const metrics24h = await getFunnelMetrics(24);
  
  // Get candidates
  console.log('📋 Fetching candidates...');
  const accepted = await getTopAcceptedCandidates(20);
  const rejected = await getTopRejectedCandidates(20);
  
  // Print funnel metrics
  console.log('\n=== FUNNEL METRICS ===\n');
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
  
  // Print top accepted candidates
  console.log('\n=== TOP 20 ACCEPTED CANDIDATES ===\n');
  console.log('| Rank | Author | Score | Tier | Views | Velocity | Recency | Why Chosen |');
  console.log('|------|--------|-------|------|-------|----------|---------|------------|');
  
  accepted.slice(0, 20).forEach((c, i) => {
    const why = (c.why_chosen || 'high_score').substring(0, 40);
    console.log(`| ${i + 1} | @${c.author.substring(0, 15)} | ${c.overall_score.toFixed(1)} | ${c.predicted_tier} | ${c.predicted_24h_views} | ${c.velocity_score.toFixed(2)} | ${c.recency_score.toFixed(2)} | ${why} |`);
  });
  
  // Print top rejected candidates
  console.log('\n=== TOP 20 REJECTED CANDIDATES ===\n');
  console.log('| Rank | Author | Score | Tier | Views | Velocity | Recency | Reject Reason |');
  console.log('|------|--------|-------|------|-------|----------|---------|---------------|');
  
  rejected.slice(0, 20).forEach((c, i) => {
    const reason = (c.filter_reason || 'unknown').substring(0, 50);
    console.log(`| ${i + 1} | @${c.author.substring(0, 15)} | ${c.overall_score.toFixed(1)} | ${c.predicted_tier} | ${c.predicted_24h_views} | ${c.velocity_score.toFixed(2)} | ${c.recency_score.toFixed(2)} | ${reason} |`);
  });
  
  // Generate recommendations
  console.log('\n=== RECOMMENDED THRESHOLD TWEAKS ===\n');
  const recommendations = generateThresholdRecommendations(metrics6h, metrics24h, accepted, rejected);
  
  if (recommendations.length === 0) {
    console.log('✅ System performing well - no threshold adjustments needed');
  } else {
    recommendations.forEach(rec => console.log(rec));
  }
  
  process.exit(0);
}

main();
