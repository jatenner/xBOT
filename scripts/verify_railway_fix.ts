/**
 * 🔍 VERIFY RAILWAY FIX - Check if jobs are running
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function verifyRailwayFix() {
  const supabase = getSupabaseClient();
  
  console.log('========================================');
  console.log('RAILWAY FIX VERIFICATION');
  console.log('========================================\n');
  
  // 1) Check for fetch runs in last 10 minutes
  console.log('1) FETCH RUNS (Last 10 minutes)');
  console.log('---');
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  
  const { data: fetchRuns, count: fetchCount } = await supabase
    .from('system_events')
    .select('*', { count: 'exact' })
    .eq('event_type', 'reply_v2_fetch_job_started')
    .gte('created_at', tenMinutesAgo)
    .order('created_at', { ascending: false });
  
  console.log(`Count: ${fetchCount || 0}`);
  if (fetchRuns && fetchRuns.length > 0) {
    console.log('\nRecent runs:');
    fetchRuns.slice(0, 5).forEach((run, i) => {
      console.log(`  ${i + 1}. ${run.created_at}: ${run.message}`);
    });
    
    if (fetchCount && fetchCount >= 2) {
      console.log('\n✅ FETCH IS RUNNING! (At least 2 runs in last 10 min)');
    } else {
      console.log('\n⚠️  Only 1 fetch run - may need more time');
    }
  } else {
    console.log('\n❌ NO FETCH RUNS - Jobs not running!');
    console.log('   Check Railway Variables: JOBS_AUTOSTART must be "true"');
  }
  
  // 2) Check for judge calls
  console.log('\n2) JUDGE CALLS (Last 30 minutes)');
  console.log('---');
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  
  const { count: judgeCalls, data: judgeLogs } = await supabase
    .from('llm_usage_log')
    .select('*', { count: 'exact' })
    .eq('purpose', 'target_judge')
    .gte('timestamp', thirtyMinutesAgo);
  
  console.log(`Count: ${judgeCalls || 0}`);
  if (judgeCalls && judgeCalls > 0) {
    console.log('\n✅ JUDGE IS LIVE!');
    if (judgeLogs && judgeLogs.length > 0) {
      console.log('\nRecent calls:');
      judgeLogs.slice(0, 5).forEach((log, i) => {
        const candidateId = (log.trace_ids as any)?.candidate_id || 'unknown';
        const isTest = candidateId.toString().startsWith('test_');
        console.log(`  ${i + 1}. ${log.timestamp}: ${log.model} (${log.input_tokens + log.output_tokens} tokens)${isTest ? ' [TEST]' : ' [PRODUCTION]'}`);
      });
    }
  } else {
    console.log('\n⚠️  No judge calls yet - may need to wait for fetch run');
  }
  
  // 3) Check for evaluations with judge decisions
  console.log('\n3) CANDIDATES WITH JUDGE DECISIONS (Last 30 minutes)');
  console.log('---');
  const { count: withJudge, data: judgeEvals } = await supabase
    .from('candidate_evaluations')
    .select('*', { count: 'exact' })
    .not('ai_judge_decision', 'is', null)
    .gte('created_at', thirtyMinutesAgo);
  
  console.log(`Count: ${withJudge || 0}`);
  if (withJudge && withJudge > 0) {
    console.log('\n✅ JUDGE DECISIONS ARE BEING STORED!');
    if (judgeEvals && judgeEvals.length > 0) {
      console.log('\nSample decisions:');
      judgeEvals.slice(0, 3).forEach((eval, i) => {
        const decision = (eval.ai_judge_decision as any)?.decision || 'unknown';
        const relevance = (eval.ai_judge_decision as any)?.relevance || 0;
        console.log(`  ${i + 1}. Tweet ${eval.candidate_tweet_id}: ${decision} (relevance=${relevance})`);
      });
    }
  } else {
    console.log('\n⚠️  No judge decisions stored yet');
  }
  
  // 4) Summary
  console.log('\n=== SUMMARY ===');
  const allGood = (fetchCount || 0) >= 2 && (judgeCalls || 0) > 0 && (withJudge || 0) > 0;
  
  if (allGood) {
    console.log('✅ ALL SYSTEMS OPERATIONAL!');
    console.log('   - Fetch running ✅');
    console.log('   - Judge being called ✅');
    console.log('   - Decisions being stored ✅');
  } else {
    console.log('⚠️  SOME ISSUES DETECTED:');
    if ((fetchCount || 0) < 2) {
      console.log('   ❌ Fetch not running - Check JOBS_AUTOSTART in Railway');
    }
    if ((judgeCalls || 0) === 0) {
      console.log('   ⚠️  Judge not called yet - Wait for next fetch run');
    }
    if ((withJudge || 0) === 0) {
      console.log('   ⚠️  No judge decisions stored - Wait for next fetch run');
    }
  }
}

verifyRailwayFix().catch(console.error);

