/**
 * 📊 PRODUCTION PROOF REPORT
 * Generates comprehensive proof that production is live
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function generateProductionProofReport() {
  const supabase = getSupabaseClient();
  const now = new Date();
  const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
  const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

  console.log('========================================');
  console.log('PRODUCTION PROOF REPORT');
  console.log('========================================\n');
  console.log(`Report Time: ${now.toISOString()}\n`);

  // 1) Jobs Starting Proof
  console.log('1) JOBS STARTING PROOF');
  console.log('---');
  console.log('SQL:');
  console.log(`SELECT COUNT(*) FILTER (WHERE event_type = 'reply_v2_fetch_job_started') as fetch_started,`);
  console.log(`       COUNT(*) FILTER (WHERE event_type LIKE '%reply_v2_fetch%completed%') as fetch_completed`);
  console.log(`FROM system_events`);
  console.log(`WHERE created_at >= NOW() - INTERVAL '10 minutes'`);
  console.log(`  AND event_type LIKE '%reply_v2_fetch%';\n`);

  const { count: fetchStarted } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'reply_v2_fetch_job_started')
    .gte('created_at', tenMinutesAgo.toISOString());

  const { count: fetchCompleted } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .like('event_type', '%reply_v2_fetch%completed%')
    .gte('created_at', tenMinutesAgo.toISOString());

  const { data: recentFetches } = await supabase
    .from('system_events')
    .select('created_at, event_type, message')
    .eq('event_type', 'reply_v2_fetch_job_started')
    .gte('created_at', tenMinutesAgo.toISOString())
    .order('created_at', { ascending: false });

  console.log(`Result: fetch_started=${fetchStarted || 0}, fetch_completed=${fetchCompleted || 0}`);

  if (recentFetches && recentFetches.length > 0) {
    console.log('\nRecent fetch runs:');
    recentFetches.forEach((event, i) => {
      console.log(`  ${i + 1}. ${event.created_at}: ${event.message}`);
    });
  }

  if ((fetchStarted || 0) >= 1) {
    console.log('\n✅ PROOF: Jobs are starting!');
  } else {
    console.log('\n❌ PROOF: Jobs NOT starting (0 fetch runs in last 10 min)');
  }

  // 2) AI Judge Live Proof
  console.log('\n2) AI JUDGE LIVE PROOF');
  console.log('---');
  console.log('SQL:');
  console.log(`SELECT COUNT(*) FROM llm_usage_log`);
  console.log(`WHERE purpose = 'target_judge'`);
  console.log(`  AND timestamp >= NOW() - INTERVAL '30 minutes';\n`);

  const { count: judgeCalls } = await supabase
    .from('llm_usage_log')
    .select('*', { count: 'exact', head: true })
    .eq('purpose', 'target_judge')
    .gte('timestamp', thirtyMinutesAgo.toISOString());

  console.log(`Result: judge_calls=${judgeCalls || 0}`);

  if ((judgeCalls || 0) > 0) {
    console.log('\n✅ PROOF: Judge is being called!');
  } else {
    console.log('\n❌ PROOF: Judge NOT being called');
  }

  // 3) Judge Decisions Stored Proof
  console.log('\n3) JUDGE DECISIONS STORED PROOF');
  console.log('---');
  console.log('SQL:');
  console.log(`SELECT COUNT(*) FROM candidate_evaluations`);
  console.log(`WHERE ai_judge_decision IS NOT NULL`);
  console.log(`  AND created_at >= NOW() - INTERVAL '30 minutes';\n`);

  const { count: judgeDecisions } = await supabase
    .from('candidate_evaluations')
    .select('*', { count: 'exact', head: true })
    .not('ai_judge_decision', 'is', null)
    .gte('created_at', thirtyMinutesAgo.toISOString());

  console.log(`Result: judge_decisions=${judgeDecisions || 0}`);

  if ((judgeDecisions || 0) > 0) {
    console.log('\n✅ PROOF: Judge decisions are being stored!');
  } else {
    console.log('\n❌ PROOF: Judge decisions NOT being stored');
  }

  // 4) Queue Health Proof
  console.log('\n4) QUEUE HEALTH PROOF');
  console.log('---');
  console.log('SQL:');
  console.log(`SELECT COUNT(*) FROM reply_candidate_queue`);
  console.log(`WHERE status = 'queued'`);
  console.log(`  AND expires_at > NOW();\n`);

  const { count: queueSize } = await supabase
    .from('reply_candidate_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'queued')
    .gt('expires_at', now.toISOString());

  console.log(`Result: queue_size=${queueSize || 0}`);

  if ((queueSize || 0) >= 5) {
    console.log('\n✅ PROOF: Queue has candidates!');
  } else {
    console.log('\n⚠️  PROOF: Queue has fewer than 5 candidates');
  }

  // 5) Scheduler Activity Proof
  console.log('\n5) SCHEDULER ACTIVITY PROOF');
  console.log('---');
  console.log('SQL:');
  console.log(`SELECT COUNT(*) FROM reply_slo_events`);
  console.log(`WHERE created_at >= NOW() - INTERVAL '30 minutes';\n`);

  const { count: schedulerEvents } = await supabase
    .from('reply_slo_events')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', thirtyMinutesAgo.toISOString());

  console.log(`Result: scheduler_events=${schedulerEvents || 0}`);

  // 6) Watchdog Reports
  console.log('\n6) WATCHDOG REPORTS');
  console.log('---');
  const { data: watchdogReports } = await supabase
    .from('system_events')
    .select('created_at, event_data, message')
    .eq('event_type', 'production_watchdog_report')
    .order('created_at', { ascending: false })
    .limit(3);

  if (watchdogReports && watchdogReports.length > 0) {
    console.log('Recent watchdog reports:');
    watchdogReports.forEach((report, i) => {
      const data = report.event_data as any;
      console.log(`  ${i + 1}. ${report.created_at}: status=${data?.status} queue=${data?.queue_size} judge=${data?.judge_calls_30m}`);
    });
  } else {
    console.log('No watchdog reports yet (may need more time)');
  }

  // Summary
  console.log('\n=== PROOF SUMMARY ===');
  const allGood = (fetchStarted || 0) >= 1 && (judgeCalls || 0) > 0 && (judgeDecisions || 0) > 0;

  console.log(`Jobs Starting: ${(fetchStarted || 0) >= 1 ? '✅' : '❌'} (${fetchStarted || 0} runs)`);
  console.log(`Judge Called: ${(judgeCalls || 0) > 0 ? '✅' : '❌'} (${judgeCalls || 0} calls)`);
  console.log(`Decisions Stored: ${(judgeDecisions || 0) > 0 ? '✅' : '❌'} (${judgeDecisions || 0} decisions)`);
  console.log(`Queue Size: ${(queueSize || 0) >= 5 ? '✅' : '⚠️'} (${queueSize || 0} candidates)`);
  console.log(`Scheduler Active: ${(schedulerEvents || 0) > 0 ? '✅' : '⚠️'} (${schedulerEvents || 0} events)`);

  if (allGood) {
    console.log('\n✅ PRODUCTION IS LIVE!');
  } else {
    console.log('\n⚠️  PRODUCTION NOT FULLY OPERATIONAL');
    console.log('\nNext Steps:');
    if ((fetchStarted || 0) === 0) {
      console.log('1. Check Railway logs for job manager startup');
      console.log('2. Verify JOBS_AUTOSTART is set correctly');
      console.log('3. Check watchdog reports for status');
    }
    if ((judgeCalls || 0) === 0) {
      console.log('4. Wait for fetch runs to trigger judge calls');
    }
    if ((judgeDecisions || 0) === 0) {
      console.log('5. Check orchestrator is storing ai_judge_decision');
    }
  }
}

generateProductionProofReport().catch(console.error);

