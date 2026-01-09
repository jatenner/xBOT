/**
 * 🔍 VERIFY AI JUDGE DEPLOYMENT AND LIVE STATUS
 * Runs validation queries to prove AI judge is working
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function verifyAIJudgeDeployment() {
  const supabase = getSupabaseClient();
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  
  console.log('========================================');
  console.log('AI JUDGE DEPLOYMENT VERIFICATION');
  console.log('========================================\n');
  console.log(`Checking data from: ${thirtyMinutesAgo} onwards\n`);
  
  // 1) Count target_judge calls
  console.log('1) TARGET_JUDGE CALLS (Last 30 min)');
  console.log('---');
  const { count: judgeCalls, data: judgeLogs } = await supabase
    .from('llm_usage_log')
    .select('*', { count: 'exact' })
    .eq('purpose', 'target_judge')
    .gte('timestamp', thirtyMinutesAgo);
  
  console.log(`Count: ${judgeCalls || 0}`);
  if (judgeLogs && judgeLogs.length > 0) {
    console.log(`\nRecent calls:`);
    judgeLogs.slice(0, 5).forEach((log, i) => {
      console.log(`  ${i + 1}. ${log.timestamp}: ${log.model} (${log.input_tokens + log.output_tokens} tokens, $${parseFloat(log.est_cost_usd || '0').toFixed(6)})`);
    });
  }
  
  // 2) Count candidates with ai_judge_decision
  console.log('\n2) CANDIDATES WITH AI_JUDGE_DECISION (Last 30 min)');
  console.log('---');
  const { count: withJudgeDecision, data: judgeEvals } = await supabase
    .from('candidate_evaluations')
    .select('*', { count: 'exact' })
    .not('ai_judge_decision', 'is', null)
    .gte('created_at', thirtyMinutesAgo);
  
  console.log(`Count: ${withJudgeDecision || 0}`);
  
  // 3) Show 5 latest candidate evaluations
  console.log('\n3) 5 LATEST CANDIDATE EVALUATIONS');
  console.log('---');
  const { data: recentEvals } = await supabase
    .from('candidate_evaluations')
    .select(`
      candidate_tweet_id,
      candidate_content,
      passed_hard_filters,
      ai_judge_decision,
      judge_decision,
      judge_relevance,
      judge_replyability,
      judge_momentum,
      filter_reason,
      topic_relevance_score,
      overall_score,
      created_at
    `)
    .order('created_at', { ascending: false })
    .limit(5);
  
  recentEvals?.forEach((evaluation, i) => {
    const textLength = evaluation.candidate_content?.length || 0;
    const aiDecision = evaluation.judge_decision || (evaluation.ai_judge_decision as any)?.decision || 'none';
    const relevance = evaluation.judge_relevance || (evaluation.ai_judge_decision as any)?.relevance || evaluation.topic_relevance_score || 0;
    const replyability = evaluation.judge_replyability || (evaluation.ai_judge_decision as any)?.replyability || 'N/A';
    const momentum = evaluation.judge_momentum || (evaluation.ai_judge_decision as any)?.momentum || 'N/A';
    const finalAcceptance = evaluation.passed_hard_filters ? 'ACCEPTED' : 'REJECTED';
    
    console.log(`\n${i + 1}. Tweet ID: ${evaluation.candidate_tweet_id}`);
    console.log(`   Text Length: ${textLength}`);
    console.log(`   Hard Filter Pass: ${evaluation.passed_hard_filters}`);
    console.log(`   AI Decision: ${aiDecision}`);
    console.log(`   Scores: relevance=${relevance}, replyability=${replyability}, momentum=${momentum}`);
    console.log(`   Final Acceptance: ${finalAcceptance}`);
    console.log(`   Filter Reason: ${evaluation.filter_reason || 'N/A'}`);
    console.log(`   Overall Score: ${evaluation.overall_score || 0}`);
    console.log(`   Created At: ${evaluation.created_at}`);
  });
  
  // 4) Check if low_topic_relevance is still the sole rejection reason
  console.log('\n4) REJECTION REASON ANALYSIS');
  console.log('---');
  const { data: rejectionReasons } = await supabase
    .from('candidate_evaluations')
    .select('filter_reason, candidate_content')
    .eq('passed_hard_filters', false)
    .gte('created_at', thirtyMinutesAgo)
    .limit(20);
  
  const reasonCounts: Record<string, number> = {};
  let withTextButLowRelevance = 0;
  
  rejectionReasons?.forEach(evaluation => {
    const reason = evaluation.filter_reason || 'unknown';
    reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    
    // Check if it's low_topic_relevance with text present
    if (reason.includes('low_topic_relevance') && evaluation.candidate_content && evaluation.candidate_content.length >= 20) {
      withTextButLowRelevance++;
    }
  });
  
  console.log('Rejection reasons (last 20):');
  Object.entries(reasonCounts).sort(([, a], [, b]) => b - a).forEach(([reason, count]) => {
    console.log(`  ${reason}: ${count}`);
  });
  
  console.log(`\nCandidates with text (>=20 chars) rejected only for low_topic_relevance: ${withTextButLowRelevance}`);
  console.log(`(Should be 0 if judge is working - judge should evaluate these)`);
  
  // 5) Summary
  console.log('\n=== SUMMARY ===');
  console.log(`✅ Judge calls: ${judgeCalls || 0}`);
  console.log(`✅ Candidates with judge decision: ${withJudgeDecision || 0}`);
  console.log(`⚠️  Text candidates rejected only for low_topic_relevance: ${withTextButLowRelevance}`);
  
  if ((judgeCalls || 0) === 0) {
    console.log('\n❌ NO JUDGE CALLS DETECTED - Checking for errors...');
    
    // Check system_events for judge errors
    const { data: judgeErrors } = await supabase
      .from('system_events')
      .select('created_at, message, event_data')
      .eq('event_type', 'judge_call_failed')
      .gte('created_at', thirtyMinutesAgo)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (judgeErrors && judgeErrors.length > 0) {
      console.log('\nJudge call errors found:');
      judgeErrors.forEach((err, i) => {
        console.log(`  ${i + 1}. ${err.created_at}: ${err.message}`);
      });
    } else {
      console.log('\nNo judge call errors in system_events.');
      console.log('Possible issues:');
      console.log('  1. Code not deployed yet (check Railway deployment status)');
      console.log('  2. No fetch runs in last 30 minutes');
      console.log('  3. All candidates failing hard filters before judge call');
    }
  } else {
    console.log('\n✅ AI JUDGE IS LIVE!');
  }
}

verifyAIJudgeDeployment().catch(console.error);

