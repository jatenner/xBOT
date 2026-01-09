/**
 * 🔍 VERIFY PRODUCTION IS LIVE
 * Comprehensive verification after Railway fixes
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function verifyProductionLive() {
  const supabase = getSupabaseClient();
  
  console.log('========================================');
  console.log('PRODUCTION LIVE VERIFICATION');
  console.log('========================================\n');
  console.log(`Verification Time: ${new Date().toISOString()}\n`);
  
  // 1) Railway Service Restart Check
  console.log('1) RAILWAY SERVICE STATUS');
  console.log('---');
  console.log('⚠️  Cannot directly access Railway logs from here');
  console.log('   Check Railway Dashboard → Deployments tab for:');
  console.log('   - Recent deployment after variable changes');
  console.log('   - Logs showing: "[BOOT] jobs_start attempt"');
  console.log('   - Logs showing: "🕒 JOB_MANAGER: Starting job timers..."');
  console.log('   - Logs showing: "🕒 JOB_MANAGER: Job scheduling enabled (JOBS_AUTOSTART=true)"\n');
  
  // 2) Fetch Runs (Last 10 minutes)
  console.log('2) FETCH RUNS (Last 10 minutes)');
  console.log('---');
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  
  const { data: fetchEvents, count: fetchCount } = await supabase
    .from('system_events')
    .select('*', { count: 'exact' })
    .like('event_type', '%reply_v2_fetch%')
    .gte('created_at', tenMinutesAgo)
    .order('created_at', { ascending: false });
  
  const started = fetchEvents?.filter(e => e.event_type === 'reply_v2_fetch_job_started').length || 0;
  const completed = fetchEvents?.filter(e => e.event_type === 'reply_v2_fetch_job_completed' || e.event_type === 'reply_v2_fetch_job_finished').length || 0;
  
  console.log(`Total fetch events: ${fetchCount || 0}`);
  console.log(`  - Started: ${started}`);
  console.log(`  - Completed: ${completed}`);
  
  if (fetchEvents && fetchEvents.length > 0) {
    console.log('\nRecent events:');
    fetchEvents.slice(0, 5).forEach((event, i) => {
      console.log(`  ${i + 1}. ${event.created_at}: ${event.event_type}`);
      if (event.message) {
        console.log(`     ${event.message.substring(0, 80)}...`);
      }
    });
  }
  
  if (started >= 2) {
    console.log('\n✅ FETCH IS RUNNING! (At least 2 starts in last 10 min)');
  } else if (started === 1) {
    console.log('\n⚠️  Only 1 fetch run - may need more time');
  } else {
    console.log('\n❌ NO FETCH RUNS - Jobs not starting!');
    console.log('   Check Railway: JOBS_AUTOSTART must be exactly "true"');
  }
  
  // 3) Judge Calls (Last 30 minutes)
  console.log('\n3) JUDGE CALLS (Last 30 minutes)');
  console.log('---');
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  
  const { count: judgeCalls, data: judgeLogs } = await supabase
    .from('llm_usage_log')
    .select('*', { count: 'exact' })
    .eq('purpose', 'target_judge')
    .gte('timestamp', thirtyMinutesAgo);
  
  console.log(`Count: ${judgeCalls || 0}`);
  
  if (judgeCalls && judgeCalls > 0) {
    console.log('\n✅ JUDGE IS BEING CALLED!');
    if (judgeLogs && judgeLogs.length > 0) {
      const productionCalls = judgeLogs.filter(log => {
        const candidateId = (log.trace_ids as any)?.candidate_id || '';
        return !candidateId.toString().startsWith('test_');
      });
      console.log(`  Production calls: ${productionCalls.length}`);
      console.log(`  Test calls: ${judgeLogs.length - productionCalls.length}`);
      
      if (productionCalls.length > 0) {
        console.log('\nRecent production calls:');
        productionCalls.slice(0, 5).forEach((log, i) => {
          const candidateId = (log.trace_ids as any)?.candidate_id || 'unknown';
          const tokens = (log.input_tokens || 0) + (log.output_tokens || 0);
          console.log(`  ${i + 1}. ${log.timestamp}: ${log.model} (${tokens} tokens, $${parseFloat(log.est_cost_usd || '0').toFixed(6)})`);
          console.log(`     Candidate: ${candidateId}`);
        });
      }
    }
  } else {
    console.log('\n⚠️  No judge calls yet');
    if (started > 0) {
      console.log('   Fetch is running but judge not called - check for errors');
    } else {
      console.log('   Fetch not running - judge won\'t be called until fetch runs');
    }
  }
  
  // 4) Judge Decisions Stored (Last 30 minutes)
  console.log('\n4) JUDGE DECISIONS STORED (Last 30 minutes)');
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
      judgeEvals.slice(0, 5).forEach((evaluation, i) => {
        const decision = (evaluation.ai_judge_decision as any)?.decision || 'unknown';
        const relevance = (evaluation.ai_judge_decision as any)?.relevance || 0;
        const replyability = (evaluation.ai_judge_decision as any)?.replyability || 0;
        console.log(`  ${i + 1}. Tweet ${evaluation.candidate_tweet_id}: ${decision}`);
        console.log(`     Relevance: ${relevance}, Replyability: ${replyability}`);
        console.log(`     Passed: ${evaluation.passed_hard_filters}, Created: ${evaluation.created_at}`);
      });
    }
  } else {
    console.log('\n⚠️  No judge decisions stored yet');
    if (judgeCalls && judgeCalls > 0) {
      console.log('   Judge is being called but decisions not stored - check orchestrator');
    }
  }
  
  // 5) Queue Health
  console.log('\n5) QUEUE HEALTH');
  console.log('---');
  const { count: queuedCount, data: queueItems } = await supabase
    .from('reply_candidate_queue')
    .select('*', { count: 'exact' })
    .eq('status', 'queued');
  
  // Check for expired items
  const now = new Date().toISOString();
  const { count: expiredCount } = await supabase
    .from('reply_candidate_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'queued')
    .lt('expires_at', now);
  
  console.log(`Queued (not expired): ${(queuedCount || 0) - (expiredCount || 0)}`);
  console.log(`Total queued: ${queuedCount || 0}`);
  console.log(`Expired: ${expiredCount || 0}`);
  
  if (queuedCount && queuedCount > 0) {
    console.log('\n✅ QUEUE HAS CANDIDATES!');
    if (queueItems && queueItems.length > 0) {
      const tierDist: Record<number, number> = {};
      queueItems.forEach(item => {
        const tier = item.predicted_tier || 0;
        tierDist[tier] = (tierDist[tier] || 0) + 1;
      });
      console.log('Tier distribution:');
      Object.entries(tierDist).sort(([a], [b]) => parseInt(a) - parseInt(b)).forEach(([tier, count]) => {
        console.log(`  Tier ${tier}: ${count}`);
      });
    }
  } else {
    console.log('\n⚠️  Queue is empty');
    if (started > 0 && (withJudge || 0) > 0) {
      console.log('   Candidates evaluated but not queued - check queueManager');
    }
  }
  
  // 6) Scheduler Activity
  console.log('\n6) SCHEDULER ACTIVITY (Last 30 minutes)');
  console.log('---');
  const { count: schedulerEvents, data: schedulerData } = await supabase
    .from('reply_slo_events')
    .select('*', { count: 'exact' })
    .gte('created_at', thirtyMinutesAgo)
    .order('created_at', { ascending: false });
  
  console.log(`SLO Events: ${schedulerEvents || 0}`);
  
  if (schedulerEvents && schedulerEvents > 0) {
    console.log('\n✅ SCHEDULER IS ACTIVE!');
    if (schedulerData && schedulerData.length > 0) {
      const eventTypes: Record<string, number> = {};
      schedulerData.forEach(event => {
        const type = (event as any).event_type || 'unknown';
        eventTypes[type] = (eventTypes[type] || 0) + 1;
      });
      console.log('Event breakdown:');
      Object.entries(eventTypes).forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
      });
    }
  } else {
    console.log('\n⚠️  No scheduler activity');
    console.log('   Scheduler runs every 15 minutes - may need more time');
  }
  
  // Summary
  console.log('\n=== SUMMARY ===');
  const allGood = started >= 2 && (judgeCalls || 0) > 0 && (withJudge || 0) > 0;
  
  if (allGood) {
    console.log('✅ PRODUCTION IS LIVE!');
    console.log('   - Fetch running ✅');
    console.log('   - Judge being called ✅');
    console.log('   - Decisions being stored ✅');
  } else {
    console.log('⚠️  ISSUES DETECTED:');
    
    if (started < 2) {
      console.log('\n❌ ROOT CAUSE: Fetch not running');
      console.log('   Most likely: JOBS_AUTOSTART not set correctly in Railway');
      console.log('   Fix: Verify JOBS_AUTOSTART="true" (exact string, case-sensitive)');
      console.log('   Check Railway logs for: "[BOOT] jobs_start attempt"');
    } else if ((judgeCalls || 0) === 0) {
      console.log('\n❌ ROOT CAUSE: Judge not being called');
      console.log('   Most likely: Judge call failing silently or OpenAI API key issue');
      console.log('   Fix: Check Railway logs for judge errors');
      console.log('   Check: OPENAI_API_KEY is valid and has credits');
    } else if ((withJudge || 0) === 0) {
      console.log('\n❌ ROOT CAUSE: Judge decisions not being stored');
      console.log('   Most likely: Orchestrator not storing ai_judge_decision');
      console.log('   Fix: Check orchestrator.ts stores judge_decision in candidate_evaluations');
    }
  }
}

verifyProductionLive().catch(console.error);

