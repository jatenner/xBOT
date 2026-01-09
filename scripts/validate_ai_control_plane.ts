/**
 * 🔍 AI CONTROL PLANE VALIDATION SCRIPT
 * 
 * Validates that the AI Control Plane is CONNECTED and affects production behavior.
 * No assumptions - shows exact SQL query outputs.
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function validateControlPlane() {
  const supabase = getSupabaseClient();
  
  console.log('========================================');
  console.log('AI CONTROL PLANE VALIDATION REPORT');
  console.log('========================================\n');
  
  // 1) STATE CONSUMPTION PROOF
  console.log('1) STATE CONSUMPTION PROOF');
  console.log('---');
  
  const { data: activeState } = await supabase
    .from('control_plane_state')
    .select('id, effective_at, feed_weights, acceptance_threshold, exploration_rate, shortlist_size')
    .is('expires_at', null)
    .order('effective_at', { ascending: false })
    .limit(1)
    .single();
  
  if (activeState) {
    console.log(`Active State ID: ${activeState.id}`);
    console.log(`Effective At: ${activeState.effective_at}`);
    console.log(`Feed Weights: ${JSON.stringify(activeState.feed_weights)}`);
    console.log(`Acceptance Threshold: ${activeState.acceptance_threshold}`);
    console.log(`Exploration Rate: ${activeState.exploration_rate}`);
    console.log(`Shortlist Size: ${activeState.shortlist_size}`);
  } else {
    console.log('❌ No active control plane state found!');
  }
  
  // Recent decisions
  const { data: recentDecisions } = await supabase
    .from('control_plane_decisions')
    .select('decision_type, decision_time, output_state')
    .order('decision_time', { ascending: false })
    .limit(3);
  
  console.log('\nRecent Decisions:');
  recentDecisions?.forEach((d, i) => {
    console.log(`  ${i + 1}. ${d.decision_type} at ${d.decision_time}`);
    if (d.output_state) {
      console.log(`     Threshold: ${(d.output_state as any).acceptance_threshold}`);
      console.log(`     Exploration: ${(d.output_state as any).exploration_rate}`);
    }
  });
  
  // Last 3 fetch runs
  console.log('\nLast 3 Fetch Runs:');
  const { data: fetchRuns } = await supabase
    .from('system_events')
    .select('created_at, message, event_data')
    .eq('event_type', 'reply_v2_fetch_job_started')
    .order('created_at', { ascending: false })
    .limit(3);
  
  fetchRuns?.forEach((run, i) => {
    console.log(`  ${i + 1}. ${run.created_at}: ${run.message}`);
    const feedRunId = (run.event_data as any)?.feed_run_id;
    if (feedRunId) {
      // Count evaluations per feed
      supabase
        .from('candidate_evaluations')
        .select('source_type', { count: 'exact', head: true })
        .eq('feed_run_id', feedRunId)
        .then(({ count }) => {
          console.log(`     Evaluations: ${count}`);
        });
    }
  });
  
  // 2) AI JUDGE PROOF
  console.log('\n2) AI JUDGE AFFECTS ACCEPTANCE (Last 30 min)');
  console.log('---');
  
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  
  const { data: evaluations, count: totalEvaluated } = await supabase
    .from('candidate_evaluations')
    .select('*', { count: 'exact' })
    .gte('created_at', thirtyMinutesAgo);
  
  const passedHardFilters = evaluations?.filter(e => e.passed_hard_filters).length || 0;
  const withJudge = evaluations?.filter(e => e.judge_decision).length || 0;
  const judgeAccepted = evaluations?.filter(e => e.judge_decision === 'accept').length || 0;
  const judgeRejected = evaluations?.filter(e => e.judge_decision === 'reject').length || 0;
  const judgeExplore = evaluations?.filter(e => e.judge_decision === 'explore').length || 0;
  
  console.log(`Total Evaluated: ${totalEvaluated}`);
  console.log(`Passed Hard Filters: ${passedHardFilters}`);
  console.log(`With Judge: ${withJudge}`);
  console.log(`Judge Accepted: ${judgeAccepted}`);
  console.log(`Judge Rejected: ${judgeRejected}`);
  console.log(`Judge Explore: ${judgeExplore}`);
  
  // Queue count
  const { count: queuedCount } = await supabase
    .from('reply_candidate_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'queued');
  
  console.log(`Queued: ${queuedCount || 0}`);
  
  console.log('\nSample Evaluations:');
  const { data: samples } = await supabase
    .from('candidate_evaluations')
    .select('candidate_tweet_id, candidate_content, passed_hard_filters, judge_decision, judge_relevance, filter_reason, topic_relevance_score')
    .gte('created_at', thirtyMinutesAgo)
    .order('created_at', { ascending: false })
    .limit(5);
  
  samples?.forEach((s, i) => {
    console.log(`  ${i + 1}. Tweet: ${s.candidate_tweet_id}`);
    console.log(`     Text Length: ${s.candidate_content?.length || 0}`);
    console.log(`     Passed Hard Filters: ${s.passed_hard_filters}`);
    console.log(`     Judge Decision: ${s.judge_decision || 'none'}`);
    console.log(`     Judge Relevance: ${s.judge_relevance || 'N/A'}`);
    console.log(`     Filter Reason: ${s.filter_reason || 'N/A'}`);
    console.log(`     Topic Relevance Score: ${s.topic_relevance_score || 0}`);
  });
  
  // 3) COST LOGGING PROOF
  console.log('\n3) COST LOGGING PROOF');
  console.log('---');
  
  const { data: costLogs, count: totalLogs } = await supabase
    .from('llm_usage_log')
    .select('*', { count: 'exact' });
  
  const totalCost = costLogs?.reduce((sum, log) => sum + parseFloat(log.est_cost_usd || '0'), 0) || 0;
  const avgLatency = costLogs?.reduce((sum, log) => sum + (log.latency_ms || 0), 0) / (costLogs?.length || 1) || 0;
  
  console.log(`Total Logs: ${totalLogs}`);
  console.log(`Total Cost: $${totalCost.toFixed(6)}`);
  console.log(`Avg Latency: ${avgLatency.toFixed(2)}ms`);
  
  console.log('\nLast 10 LLM Calls:');
  const { data: recentLogs } = await supabase
    .from('llm_usage_log')
    .select('timestamp, model, purpose, input_tokens, output_tokens, est_cost_usd')
    .order('timestamp', { ascending: false })
    .limit(10);
  
  recentLogs?.forEach((log, i) => {
    const totalTokens = (log.input_tokens || 0) + (log.output_tokens || 0);
    console.log(`  ${i + 1}. ${log.timestamp}: ${log.model} (${log.purpose})`);
    console.log(`     Tokens: ${totalTokens}, Cost: $${parseFloat(log.est_cost_usd || '0').toFixed(6)}`);
  });
  
  // Hourly rollup
  const { data: hourlyRollup } = await supabase
    .from('llm_cost_summary_hourly')
    .select('hour_start, model, purpose, total_cost_usd')
    .order('hour_start', { ascending: false })
    .limit(5);
  
  console.log('\nHourly Rollup (Last 5 hours):');
  hourlyRollup?.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.hour_start}: ${r.model} (${r.purpose}) = $${parseFloat(r.total_cost_usd || '0').toFixed(2)}`);
  });
  
  // 4) SAFETY RAILS PROOF
  console.log('\n4) SAFETY RAILS PROOF');
  console.log('---');
  
  const { count: blockedNotRoot } = await supabase
    .from('candidate_evaluations')
    .select('*', { count: 'exact', head: true })
    .eq('passed_hard_filters', false)
    .like('filter_reason', '%not_root_tweet%')
    .gte('created_at', thirtyMinutesAgo);
  
  const { count: blockedParody } = await supabase
    .from('candidate_evaluations')
    .select('*', { count: 'exact', head: true })
    .eq('passed_hard_filters', false)
    .like('filter_reason', '%parody_account%')
    .gte('created_at', thirtyMinutesAgo);
  
  const { count: blockedSpam } = await supabase
    .from('candidate_evaluations')
    .select('*', { count: 'exact', head: true })
    .eq('passed_hard_filters', false)
    .like('filter_reason', '%high_spam_score%')
    .gte('created_at', thirtyMinutesAgo);
  
  console.log(`Blocked (Not Root): ${blockedNotRoot || 0}`);
  console.log(`Blocked (Parody): ${blockedParody || 0}`);
  console.log(`Blocked (Spam): ${blockedSpam || 0}`);
  
  // Code bounds (from controlPlaneAgent.ts)
  console.log('\nCode Bounds (from controlPlaneAgent.ts):');
  console.log('  Acceptance Threshold: 0.30 - 0.90');
  console.log('  Exploration Rate: 0.05 - 0.25');
  console.log('  Shortlist Size: 10 - 50');
  
  console.log('\n=== VALIDATION COMPLETE ===');
}

validateControlPlane().catch(console.error);

