/**
 * 🔍 PROVE AI JUDGE IS LIVE AND AFFECTING ACCEPTANCE
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function proveAIJudgeLive() {
  const supabase = getSupabaseClient();
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  
  console.log('========================================');
  console.log('AI JUDGE LIVE VALIDATION');
  console.log('========================================\n');
  
  // 1) Last 30 minutes counts
  console.log('1) LAST 30 MINUTES COUNTS');
  console.log('---');
  
  const { count: judgeCalls } = await supabase
    .from('llm_usage_log')
    .select('*', { count: 'exact', head: true })
    .eq('purpose', 'target_judge')
    .gte('timestamp', thirtyMinutesAgo);
  
  const { count: withJudgeDecision } = await supabase
    .from('candidate_evaluations')
    .select('*', { count: 'exact', head: true })
    .not('ai_judge_decision', 'is', null)
    .gte('created_at', thirtyMinutesAgo);
  
  const { count: passedHardFilters } = await supabase
    .from('candidate_evaluations')
    .select('*', { count: 'exact', head: true })
    .eq('passed_hard_filters', true)
    .gte('created_at', thirtyMinutesAgo);
  
  const { count: acceptedToQueue } = await supabase
    .from('candidate_evaluations')
    .select('*', { count: 'exact', head: true })
    .eq('passed_hard_filters', true)
    .gte('created_at', thirtyMinutesAgo);
  
  // Check queue status
  const { count: queuedCount } = await supabase
    .from('reply_candidate_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'queued');
  
  console.log(`target_judge calls: ${judgeCalls || 0}`);
  console.log(`candidates with ai_judge_decision: ${withJudgeDecision || 0}`);
  console.log(`passed_hard_filters=true: ${passedHardFilters || 0}`);
  console.log(`accepted_to_queue (queued): ${queuedCount || 0}`);
  
  // 2) 10 most recent candidate_evaluations
  console.log('\n2) 10 MOST RECENT CANDIDATE_EVALUATIONS');
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
    .limit(10);
  
  recentEvals?.forEach((evaluation, i) => {
    const textLength = evaluation.candidate_content?.length || 0;
    const aiDecision = evaluation.judge_decision || (evaluation.ai_judge_decision as any)?.decision || 'none';
    const relevance = evaluation.judge_relevance || (evaluation.ai_judge_decision as any)?.relevance || evaluation.topic_relevance_score || 0;
    const replyability = evaluation.judge_replyability || (evaluation.ai_judge_decision as any)?.replyability || 'N/A';
    const momentum = evaluation.judge_momentum || (evaluation.ai_judge_decision as any)?.momentum || 'N/A';
    
    console.log(`\n${i + 1}. Tweet ID: ${evaluation.candidate_tweet_id}`);
    console.log(`   Text Length: ${textLength}`);
    console.log(`   Hard Filter Pass: ${evaluation.passed_hard_filters}`);
    console.log(`   AI Decision: ${aiDecision}`);
    console.log(`   Scores: relevance=${relevance}, replyability=${replyability}, momentum=${momentum}`);
    console.log(`   Final Acceptance: ${evaluation.passed_hard_filters ? 'PASSED' : 'REJECTED'}`);
    console.log(`   Filter Reason: ${evaluation.filter_reason || 'N/A'}`);
    console.log(`   Overall Score: ${evaluation.overall_score || 0}`);
    console.log(`   Created At: ${evaluation.created_at}`);
  });
  
  // 3) Queue size and tier distribution
  console.log('\n3) QUEUE SIZE AND TIER DISTRIBUTION');
  console.log('---');
  
  const { data: queueItems } = await supabase
    .from('reply_candidate_queue')
    .select('predicted_tier, status')
    .eq('status', 'queued');
  
  const tierDistribution: Record<number, number> = {};
  queueItems?.forEach(item => {
    tierDistribution[item.predicted_tier || 0] = (tierDistribution[item.predicted_tier || 0] || 0) + 1;
  });
  
  console.log(`Queue Size: ${queueItems?.length || 0}`);
  console.log('Tier Distribution:');
  Object.entries(tierDistribution).sort(([a], [b]) => parseInt(a) - parseInt(b)).forEach(([tier, count]) => {
    console.log(`  Tier ${tier}: ${count}`);
  });
  
  // Check scheduled posts
  const { data: scheduledPosts } = await supabase
    .from('reply_decisions')
    .select('tier_selected, status')
    .eq('status', 'scheduled')
    .gte('scheduled_for', new Date().toISOString());
  
  const scheduledTierDist: Record<number, number> = {};
  scheduledPosts?.forEach(post => {
    const tier = (post as any).tier_selected || 0;
    scheduledTierDist[tier] = (scheduledTierDist[tier] || 0) + 1;
  });
  
  console.log(`\nScheduled Posts: ${scheduledPosts?.length || 0}`);
  console.log('Scheduled Tier Distribution:');
  Object.entries(scheduledTierDist).sort(([a], [b]) => parseInt(a) - parseInt(b)).forEach(([tier, count]) => {
    console.log(`  Tier ${tier}: ${count}`);
  });
  
  // 4) If judge calls are 0, check call site
  if ((judgeCalls || 0) === 0) {
    console.log('\n⚠️  WARNING: No target_judge calls found!');
    console.log('Checking call site...');
    
    // Check if there are any recent evaluations that should have triggered judge
    const { data: recentWithoutJudge } = await supabase
      .from('candidate_evaluations')
      .select('candidate_tweet_id, passed_hard_filters, filter_reason, created_at')
      .gte('created_at', thirtyMinutesAgo)
      .is('ai_judge_decision', null)
      .limit(5);
    
    console.log(`\nRecent evaluations without judge (should have been called):`);
    recentWithoutJudge?.forEach((evaluation, i) => {
      console.log(`  ${i + 1}. ${evaluation.candidate_tweet_id}: passed_hard_filters=${evaluation.passed_hard_filters}, reason=${evaluation.filter_reason}`);
    });
  }
  
  console.log('\n=== VALIDATION COMPLETE ===');
}

proveAIJudgeLive().catch(console.error);

