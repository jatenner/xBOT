/**
 * 📊 SUMMARY REPORTER
 * 
 * Generates hourly and daily summary reports
 */

import { getSupabaseClient } from '../../db/index';

/**
 * Generate hourly summary
 */
export async function generateHourlySummary(): Promise<void> {
  console.log('[SUMMARY] 📊 Generating hourly summary...');
  
  const supabase = getSupabaseClient();
  const now = new Date();
  const hourStart = new Date(now);
  hourStart.setMinutes(0, 0, 0);
  
  // Get evaluations from this hour
  const { data: evaluations } = await supabase
    .from('candidate_evaluations')
    .select('passed_hard_filters, filter_reason, predicted_tier')
    .gte('created_at', hourStart.toISOString())
    .lt('created_at', now.toISOString());
  
  const candidatesEvaluated = evaluations?.length || 0;
  const candidatesPassed = evaluations?.filter(e => e.passed_hard_filters === true).length || 0;
  const candidatesBlocked = candidatesEvaluated - candidatesPassed;
  
  // Count block reasons
  const blockReasons: Record<string, number> = {};
  evaluations?.forEach(e => {
    if (!e.passed_hard_filters && e.filter_reason) {
      const reason = e.filter_reason.split(',')[0]; // First reason
      blockReasons[reason] = (blockReasons[reason] || 0) + 1;
    }
  });
  
  // Get queue metrics
  const { data: queue } = await supabase
    .from('reply_candidate_queue')
    .select('predicted_tier')
    .eq('status', 'queued')
    .gt('expires_at', now.toISOString());
  
  const queueSize = queue?.length || 0;
  const tierDistribution = {
    tier_1: queue?.filter(q => q.predicted_tier === 1).length || 0,
    tier_2: queue?.filter(q => q.predicted_tier === 2).length || 0,
    tier_3: queue?.filter(q => q.predicted_tier === 3).length || 0,
  };
  
  // Get SLO events from this hour
  const { data: sloEvents } = await supabase
    .from('reply_slo_events')
    .select('posted, reason')
    .gte('slot_time', hourStart.toISOString())
    .lt('slot_time', now.toISOString());
  
  const sloHits = sloEvents?.filter(e => e.posted === true).length || 0;
  const sloMisses = sloEvents?.filter(e => e.posted === false).length || 0;
  
  const sloReasons: Record<string, number> = {};
  sloEvents?.forEach(e => {
    if (!e.posted && e.reason) {
      sloReasons[e.reason] = (sloReasons[e.reason] || 0) + 1;
    }
  });
  
  // Get replies posted this hour
  const { data: replies } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, candidate_evaluation_id')
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .gte('posted_at', hourStart.toISOString())
    .lt('posted_at', now.toISOString());
  
  const repliesPosted = replies?.length || 0;
  
  // Get tier breakdown for posted replies
  const evaluationIds = replies?.map(r => r.candidate_evaluation_id).filter(Boolean) || [];
  let tierBreakdown = { tier_1: 0, tier_2: 0, tier_3: 0 };
  
  if (evaluationIds.length > 0) {
    const { data: evals } = await supabase
      .from('candidate_evaluations')
      .select('predicted_tier')
      .in('id', evaluationIds);
    
    tierBreakdown = {
      tier_1: evals?.filter(e => e.predicted_tier === 1).length || 0,
      tier_2: evals?.filter(e => e.predicted_tier === 2).length || 0,
      tier_3: evals?.filter(e => e.predicted_tier === 3).length || 0,
    };
  }
  
  // Insert summary
  await supabase
    .from('reply_system_summary_hourly')
    .insert({
      hour_start: hourStart.toISOString(),
      candidates_evaluated: candidatesEvaluated,
      candidates_passed_filters: candidatesPassed,
      candidates_blocked: candidatesBlocked,
      block_reasons: blockReasons,
      queue_size: queueSize,
      tier_distribution: tierDistribution,
      slo_target: 4,
      slo_hits: sloHits,
      slo_misses: sloMisses,
      slo_reasons: sloReasons,
      replies_posted: repliesPosted,
      replies_tier_1: tierBreakdown.tier_1,
      replies_tier_2: tierBreakdown.tier_2,
      replies_tier_3: tierBreakdown.tier_3,
    });
  
  // Log to system_events
  await supabase
    .from('system_events')
    .insert({
      event_type: 'reply_system_hourly_summary',
      severity: 'info',
      message: `Hourly summary: ${candidatesEvaluated} evaluated, ${candidatesPassed} passed, ${queueSize} queued, ${sloHits} SLO hits, ${sloMisses} misses`,
      event_data: {
        hour_start: hourStart.toISOString(),
        candidates_evaluated: candidatesEvaluated,
        candidates_passed_filters: candidatesPassed,
        queue_size: queueSize,
        tier_distribution: tierDistribution,
        slo_hits: sloHits,
        slo_misses: sloMisses,
        replies_posted: repliesPosted,
      },
      created_at: now.toISOString(),
    });
  
  console.log(`[SUMMARY] ✅ Hourly summary: ${candidatesEvaluated} evaluated, ${queueSize} queued, ${sloHits}/${sloHits + sloMisses} SLO hits`);
}

/**
 * Generate daily summary
 */
export async function generateDailySummary(): Promise<void> {
  console.log('[SUMMARY] 📊 Generating daily summary...');
  
  const supabase = getSupabaseClient();
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  
  // Get all replies posted today with 24h metrics
  const { data: metrics } = await supabase
    .from('reply_performance_metrics')
    .select('views_24h, predicted_tier')
    .gte('posted_at', dayStart.toISOString())
    .lt('posted_at', now.toISOString())
    .not('views_24h', 'is', null);
  
  const totalReplies = metrics?.length || 0;
  const views24h = metrics?.map(m => m.views_24h || 0).filter(v => v > 0) || [];
  
  if (views24h.length === 0) {
    console.log('[SUMMARY] ⚠️ No 24h metrics available yet');
    return;
  }
  
  // Calculate distribution
  const distribution = {
    '0-100': views24h.filter(v => v < 100).length,
    '100-500': views24h.filter(v => v >= 100 && v < 500).length,
    '500-1000': views24h.filter(v => v >= 500 && v < 1000).length,
    '1000-5000': views24h.filter(v => v >= 1000 && v < 5000).length,
    '5000+': views24h.filter(v => v >= 5000).length,
  };
  
  // Calculate statistics
  const sorted = [...views24h].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const mean = views24h.reduce((a, b) => a + b, 0) / views24h.length;
  const p25 = sorted[Math.floor(sorted.length * 0.25)];
  const p75 = sorted[Math.floor(sorted.length * 0.75)];
  
  // Success rates
  const successRate1000 = (views24h.filter(v => v >= 1000).length / views24h.length) * 100;
  const successRate5000 = (views24h.filter(v => v >= 5000).length / views24h.length) * 100;
  
  // Tier performance
  const tier1Metrics = metrics?.filter(m => m.predicted_tier === 1).map(m => m.views_24h || 0) || [];
  const tier2Metrics = metrics?.filter(m => m.predicted_tier === 2).map(m => m.views_24h || 0) || [];
  const tier3Metrics = metrics?.filter(m => m.predicted_tier === 3).map(m => m.views_24h || 0) || [];
  
  const tier1Performance = {
    count: tier1Metrics.length,
    median: tier1Metrics.length > 0 ? [...tier1Metrics].sort((a, b) => a - b)[Math.floor(tier1Metrics.length / 2)] : 0,
    mean: tier1Metrics.length > 0 ? tier1Metrics.reduce((a, b) => a + b, 0) / tier1Metrics.length : 0,
  };
  
  const tier2Performance = {
    count: tier2Metrics.length,
    median: tier2Metrics.length > 0 ? [...tier2Metrics].sort((a, b) => a - b)[Math.floor(tier2Metrics.length / 2)] : 0,
    mean: tier2Metrics.length > 0 ? tier2Metrics.reduce((a, b) => a + b, 0) / tier2Metrics.length : 0,
  };
  
  const tier3Performance = {
    count: tier3Metrics.length,
    median: tier3Metrics.length > 0 ? [...tier3Metrics].sort((a, b) => a - b)[Math.floor(tier3Metrics.length / 2)] : 0,
    mean: tier3Metrics.length > 0 ? tier3Metrics.reduce((a, b) => a + b, 0) / tier3Metrics.length : 0,
  };
  
  // Insert summary
  await supabase
    .from('reply_system_summary_daily')
    .insert({
      date: dayStart.toISOString().split('T')[0],
      total_replies: totalReplies,
      replies_with_24h_metrics: views24h.length,
      views_24h_distribution: distribution,
      views_24h_median: median,
      views_24h_mean: mean,
      views_24h_p25: p25,
      views_24h_p75: p75,
      success_rate_1000: successRate1000,
      success_rate_5000: successRate5000,
      tier_1_actual_performance: tier1Performance,
      tier_2_actual_performance: tier2Performance,
      tier_3_actual_performance: tier3Performance,
    });
  
  // Log to system_events
  await supabase
    .from('system_events')
    .insert({
      event_type: 'reply_system_daily_summary',
      severity: 'info',
      message: `Daily summary: ${totalReplies} replies, ${views24h.length} with 24h metrics, median=${median}, success_rate_1000=${successRate1000.toFixed(1)}%`,
      event_data: {
        date: dayStart.toISOString().split('T')[0],
        total_replies: totalReplies,
        views_24h_median: median,
        views_24h_mean: mean,
        success_rate_1000: successRate1000,
        success_rate_5000: successRate5000,
        distribution,
      },
      created_at: now.toISOString(),
    });
  
  console.log(`[SUMMARY] ✅ Daily summary: ${totalReplies} replies, median=${median}, success_rate=${successRate1000.toFixed(1)}%`);
}

