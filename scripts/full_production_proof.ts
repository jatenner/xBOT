/**
 * 🔍 FULL PRODUCTION PROOF CHECK
 * End-to-end verification with hard evidence (SQL outputs)
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function fullProductionProof() {
  const supabase = getSupabaseClient();
  const now = new Date();
  const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
  const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
  const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

  console.log('========================================');
  console.log('PRODUCTION PROOF REPORT');
  console.log('========================================\n');
  console.log(`Report Time: ${now.toISOString()}\n`);

  // 1) Deploy + Jobs Enabled
  console.log('1) DEPLOY + JOBS ENABLED');
  console.log('---');
  console.log('SQL:');
  console.log(`SELECT created_at, event_data->>'jobs_enabled' as jobs_enabled,`);
  console.log(`       event_data->>'git_sha' as git_sha,`);
  console.log(`       event_data->>'railway_environment' as railway_environment,`);
  console.log(`       event_data->>'node_env' as node_env`);
  console.log(`FROM system_events`);
  console.log(`WHERE event_type = 'production_watchdog_boot'`);
  console.log(`ORDER BY created_at DESC LIMIT 1;\n`);

  const { data: bootHeartbeat } = await supabase
    .from('system_events')
    .select('created_at, event_data, message')
    .eq('event_type', 'production_watchdog_boot')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (bootHeartbeat) {
    const data = bootHeartbeat.event_data as any;
    console.log(`Result:`);
    console.log(`  created_at: ${bootHeartbeat.created_at}`);
    console.log(`  jobs_enabled: ${data?.jobs_enabled}`);
    console.log(`  git_sha: ${data?.git_sha || 'N/A'}`);
    console.log(`  railway_environment: ${data?.railway_environment || 'N/A'}`);
    console.log(`  node_env: ${data?.node_env || 'N/A'}`);
    console.log(`  message: ${bootHeartbeat.message}`);
    
    if (data?.jobs_enabled === true) {
      console.log('\n✅ JOBS ENABLED: TRUE');
    } else {
      console.log('\n❌ JOBS ENABLED: FALSE');
    }
  } else {
    console.log('Result: NO BOOT HEARTBEAT FOUND');
    console.log('\n❌ NO DEPLOYMENT DETECTED - Watchdog not started');
  }

  // 2) Watchdog Running Continuously
  console.log('\n2) WATCHDOG RUNNING CONTINUOUSLY');
  console.log('---');
  console.log('SQL:');
  console.log(`SELECT COUNT(*) FROM system_events`);
  console.log(`WHERE event_type = 'production_watchdog_report'`);
  console.log(`  AND created_at >= NOW() - INTERVAL '15 minutes';\n`);

  const { count: watchdogReports, data: recentReports } = await supabase
    .from('system_events')
    .select('*', { count: 'exact' })
    .eq('event_type', 'production_watchdog_report')
    .gte('created_at', fifteenMinutesAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(3);

  console.log(`Result: ${watchdogReports || 0} reports in last 15 minutes`);

  if (recentReports && recentReports.length > 0) {
    console.log('\nMost recent 3 reports:');
    recentReports.forEach((report, i) => {
      const data = report.event_data as any;
      console.log(`\n  ${i + 1}. ${report.created_at}:`);
      console.log(`     jobs_enabled: ${data?.jobs_enabled}`);
      console.log(`     last_fetch_started: ${data?.last_fetch_started || 'never'}`);
      console.log(`     last_fetch_completed: ${data?.last_fetch_completed || 'never'}`);
      console.log(`     queue_size: ${data?.queue_size || 0}`);
      console.log(`     judge_calls_30m: ${data?.judge_calls_30m || 0}`);
      console.log(`     status: ${data?.status || 'unknown'}`);
    });

    if ((watchdogReports || 0) >= 2) {
      console.log('\n✅ WATCHDOG RUNNING: Continuous reports detected');
    } else {
      console.log('\n⚠️  WATCHDOG: Only 1 report - may need more time');
    }
  } else {
    console.log('\n❌ WATCHDOG NOT RUNNING: No reports in last 15 minutes');
  }

  // 3) Reply System Jobs Ticking
  console.log('\n3) REPLY SYSTEM JOBS TICKING');
  console.log('---');
  console.log('SQL (last 10 min):');
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

  console.log(`Fetch (last 10 min): started=${fetchStarted || 0}, completed=${fetchCompleted || 0}`);

  console.log('\nSQL (last 30 min):');
  console.log(`SELECT COUNT(*) FROM system_events`);
  console.log(`WHERE event_type = 'reply_v2_scheduler_job_started'`);
  console.log(`  AND created_at >= NOW() - INTERVAL '30 minutes';\n`);

  const { count: schedulerStarted } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'reply_v2_scheduler_job_started')
    .gte('created_at', thirtyMinutesAgo.toISOString());

  console.log(`Scheduler (last 30 min): started=${schedulerStarted || 0}`);

  console.log('\nSQL (SLO events):');
  console.log(`SELECT COUNT(*) FROM reply_slo_events`);
  console.log(`WHERE created_at >= NOW() - INTERVAL '30 minutes';\n`);

  const { count: sloEvents, data: sloData } = await supabase
    .from('reply_slo_events')
    .select('*', { count: 'exact' })
    .gte('created_at', thirtyMinutesAgo.toISOString());

  const { count: sloPosted } = await supabase
    .from('reply_slo_events')
    .select('*', { count: 'exact', head: true })
    .eq('posted', true)
    .gte('created_at', thirtyMinutesAgo.toISOString());

  console.log(`SLO Events (last 30 min): total=${sloEvents || 0}, posted=${sloPosted || 0}`);

  if (sloData && sloData.length > 0) {
    const reasonCounts: Record<string, number> = {};
    sloData.forEach((event: any) => {
      const reason = event.reason || 'unknown';
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    });
    console.log('Reason breakdown:');
    Object.entries(reasonCounts).forEach(([reason, count]) => {
      console.log(`  ${reason}: ${count}`);
    });
  }

  if ((fetchStarted || 0) >= 1) {
    console.log('\n✅ FETCH JOBS TICKING: At least 1 run in last 10 min');
  } else {
    console.log('\n❌ FETCH JOBS NOT TICKING: 0 runs in last 10 min');
  }

  // 4) AI Judge Live
  console.log('\n4) AI JUDGE LIVE AND CONNECTED');
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

  console.log(`Judge calls (last 30 min): ${judgeCalls || 0}`);

  console.log('\nSQL:');
  console.log(`SELECT COUNT(*) FROM candidate_evaluations`);
  console.log(`WHERE ai_judge_decision IS NOT NULL`);
  console.log(`  AND created_at >= NOW() - INTERVAL '30 minutes';\n`);

  const { count: judgeDecisions, data: recentEvals } = await supabase
    .from('candidate_evaluations')
    .select('candidate_tweet_id, candidate_content, ai_judge_decision, passed_hard_filters, filter_reason, feed_run_id, created_at')
    .not('ai_judge_decision', 'is', null)
    .gte('created_at', thirtyMinutesAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(5);

  console.log(`Judge decisions stored (last 30 min): ${judgeDecisions || 0}`);

  if (recentEvals && recentEvals.length > 0) {
    console.log('\n5 Most Recent Evaluations:');
    recentEvals.forEach((evaluation, i) => {
      const decision = (evaluation.ai_judge_decision as any)?.decision || 'unknown';
      const textLength = evaluation.candidate_content?.length || 0;
      const finalStatus = evaluation.passed_hard_filters ? 'ACCEPTED' : 'REJECTED';
      console.log(`\n  ${i + 1}. Tweet ID: ${evaluation.candidate_tweet_id}`);
      console.log(`     Text Length: ${textLength}`);
      console.log(`     Judge Decision: ${decision}`);
      console.log(`     Final Status: ${finalStatus}`);
      console.log(`     Filter Reason: ${evaluation.filter_reason || 'N/A'}`);
      console.log(`     Feed Run ID: ${evaluation.feed_run_id || 'N/A'}`);
      console.log(`     Created: ${evaluation.created_at}`);
    });
  }

  if ((judgeCalls || 0) > 0 && (judgeDecisions || 0) > 0) {
    console.log('\n✅ AI JUDGE LIVE: Calls and decisions detected');
  } else {
    console.log('\n❌ AI JUDGE NOT LIVE: No calls or decisions');
  }

  // 5) Queue Health
  console.log('\n5) QUEUE HEALTH');
  console.log('---');
  console.log('SQL:');
  console.log(`SELECT COUNT(*) FROM reply_candidate_queue`);
  console.log(`WHERE status = 'queued'`);
  console.log(`  AND expires_at > NOW();\n`);

  const { count: queueSize, data: queueItems } = await supabase
    .from('reply_candidate_queue')
    .select('predicted_tier')
    .eq('status', 'queued')
    .gt('expires_at', now.toISOString());

  console.log(`Queue size (not expired): ${queueSize || 0}`);

  if (queueItems && queueItems.length > 0) {
    const tierDist: Record<number, number> = {};
    queueItems.forEach(item => {
      const tier = item.predicted_tier || 0;
      tierDist[tier] = (tierDist[tier] || 0) + 1;
    });
    console.log('\nTier Distribution:');
    Object.entries(tierDist).sort(([a], [b]) => parseInt(a) - parseInt(b)).forEach(([tier, count]) => {
      console.log(`  Tier ${tier}: ${count}`);
    });
  }

  if ((queueSize || 0) >= 5) {
    console.log('\n✅ QUEUE HEALTHY: >= 5 candidates');
  } else {
    console.log('\n⚠️  QUEUE LOW: < 5 candidates');
  }

  // Summary
  console.log('\n========================================');
  console.log('PROOF SUMMARY');
  console.log('========================================\n');

  const jobsEnabled = bootHeartbeat && (bootHeartbeat.event_data as any)?.jobs_enabled === true;
  const watchdogRunning = (watchdogReports || 0) >= 2;
  const fetchTicking = (fetchStarted || 0) >= 1;
  const judgeLive = (judgeCalls || 0) > 0 && (judgeDecisions || 0) > 0;
  const queueHealthy = (queueSize || 0) >= 5;

  console.log(`Jobs Enabled: ${jobsEnabled ? '✅' : '❌'} (${bootHeartbeat ? 'boot heartbeat found' : 'no boot heartbeat'})`);
  console.log(`Watchdog Running: ${watchdogRunning ? '✅' : '❌'} (${watchdogReports || 0} reports)`);
  console.log(`Fetch Ticking: ${fetchTicking ? '✅' : '❌'} (${fetchStarted || 0} started, ${fetchCompleted || 0} completed)`);
  console.log(`Judge Live: ${judgeLive ? '✅' : '❌'} (${judgeCalls || 0} calls, ${judgeDecisions || 0} decisions)`);
  console.log(`Queue Healthy: ${queueHealthy ? '✅' : '⚠️'} (${queueSize || 0} candidates)`);

  // Root Cause Analysis
  console.log('\n========================================');
  console.log('ROOT CAUSE ANALYSIS');
  console.log('========================================\n');

  if (!bootHeartbeat) {
    console.log('❌ ROOT CAUSE: No boot heartbeat - deployment may not have completed');
    console.log('   Fix: Wait for Railway deployment, check logs for watchdog startup');
  } else if (!jobsEnabled) {
    console.log('❌ ROOT CAUSE: Jobs disabled in boot heartbeat');
    console.log('   Fix: Check Railway Variables - JOBS_AUTOSTART or RAILWAY_ENVIRONMENT_NAME');
  } else if (!watchdogRunning) {
    console.log('❌ ROOT CAUSE: Watchdog not running continuously');
    console.log('   Fix: Check Railway logs for watchdog errors');
  } else if (!fetchTicking) {
    console.log('❌ ROOT CAUSE: Fetch jobs not ticking');
    console.log('   Fix: Check job manager startup logs, verify timers are set');
  } else if (!judgeLive) {
    console.log('❌ ROOT CAUSE: AI judge not being called');
    console.log('   Fix: Check orchestrator calls judgeTargetSuitability, verify OpenAI API key');
  } else if (!queueHealthy) {
    console.log('⚠️  ROOT CAUSE: Queue low (may be normal if filters are strict)');
    console.log('   Fix: Check filter reasons, may need to adjust thresholds');
  } else {
    console.log('✅ ALL SYSTEMS OPERATIONAL!');
  }

  console.log('\n========================================');
  console.log('NEXT STEP');
  console.log('========================================\n');

  if (!bootHeartbeat || !jobsEnabled || !watchdogRunning || !fetchTicking) {
    console.log('1. Check Railway logs for boot sequence');
    console.log('2. Verify RAILWAY_ENVIRONMENT_NAME is set to "production"');
    console.log('3. Check for job manager startup errors');
    console.log('4. Wait 5-10 minutes and rerun this check');
  } else if (!judgeLive) {
    console.log('1. Check orchestrator.ts calls judgeTargetSuitability');
    console.log('2. Verify OpenAI API key is valid');
    console.log('3. Check for judge call errors in logs');
  } else if (!queueHealthy) {
    console.log('1. Review filter reasons in candidate_evaluations');
    console.log('2. Check if acceptance threshold is too high');
    console.log('3. May be normal if filters are working correctly');
  } else {
    console.log('✅ Production is fully operational!');
    console.log('   Monitor watchdog reports every 5 minutes');
    console.log('   Verify fetch runs continue every 5 minutes');
  }
}

fullProductionProof().catch(console.error);

