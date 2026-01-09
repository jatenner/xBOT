/**
 * 🔍 PRODUCTION OPERATIONAL VERIFICATION
 * Checks all 9 proof requirements after deployment
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function verifyProduction() {
  const supabase = getSupabaseClient();
  const now = new Date();
  const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
  const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

  console.log('========================================');
  console.log('PRODUCTION OPERATIONAL VERIFICATION');
  console.log('========================================\n');
  console.log(`Report Time: ${now.toISOString()}\n`);

  const results: Record<string, { passed: boolean; value: any; details?: string }> = {};

  // 1) Boot heartbeat
  console.log('1) Boot Heartbeat (last 15 min)...');
  const { data: bootHeartbeat } = await supabase
    .from('system_events')
    .select('created_at, event_data')
    .eq('event_type', 'production_watchdog_boot')
    .gte('created_at', fifteenMinutesAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (bootHeartbeat) {
    const data = bootHeartbeat.event_data as any;
    const gitSha = data?.git_sha || 'unknown';
    results.bootHeartbeat = {
      passed: true,
      value: bootHeartbeat.created_at,
      details: `git_sha=${gitSha.substring(0, 8)} jobs_enabled=${data?.jobs_enabled}`
    };
    console.log(`✅ Found: ${bootHeartbeat.created_at} (${gitSha.substring(0, 8)})`);
  } else {
    results.bootHeartbeat = { passed: false, value: null };
    console.log('❌ NOT FOUND');
  }

  // 2) Watchdog reports
  console.log('\n2) Watchdog Reports (last 15 min)...');
  const { count: watchdogCount } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'production_watchdog_report')
    .gte('created_at', fifteenMinutesAgo.toISOString());

  results.watchdogReports = {
    passed: (watchdogCount || 0) >= 2,
    value: watchdogCount || 0
  };
  console.log(`${results.watchdogReports.passed ? '✅' : '❌'} Count: ${watchdogCount || 0} (requirement: >= 2)`);

  // 3) Fetch started
  console.log('\n3) Fetch Started (last 15 min)...');
  const { count: fetchStarted } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'reply_v2_fetch_job_started')
    .gte('created_at', fifteenMinutesAgo.toISOString());

  results.fetchStarted = {
    passed: (fetchStarted || 0) >= 2,
    value: fetchStarted || 0
  };
  console.log(`${results.fetchStarted.passed ? '✅' : '❌'} Count: ${fetchStarted || 0} (requirement: >= 2)`);

  // 4) Fetch completed
  console.log('\n4) Fetch Completed (last 15 min)...');
  const { count: fetchCompleted } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .like('event_type', '%reply_v2_fetch%completed%')
    .gte('created_at', fifteenMinutesAgo.toISOString());

  results.fetchCompleted = {
    passed: (fetchCompleted || 0) >= 1,
    value: fetchCompleted || 0
  };
  console.log(`${results.fetchCompleted.passed ? '✅' : '❌'} Count: ${fetchCompleted || 0} (requirement: >= 1)`);

  // 5) Candidate evaluations
  console.log('\n5) Candidate Evaluations (last 15 min)...');
  const { count: evalCount } = await supabase
    .from('candidate_evaluations')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', fifteenMinutesAgo.toISOString());

  results.candidateEvaluations = {
    passed: (evalCount || 0) > 0,
    value: evalCount || 0
  };
  console.log(`${results.candidateEvaluations.passed ? '✅' : '❌'} Count: ${evalCount || 0} (requirement: > 0)`);

  // 6) Queue size
  console.log('\n6) Queue Size (queued + not expired)...');
  const { count: queueSize } = await supabase
    .from('reply_candidate_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'queued')
    .gt('expires_at', now.toISOString());

  results.queueSize = {
    passed: (queueSize || 0) >= 5,
    value: queueSize || 0
  };
  console.log(`${results.queueSize.passed ? '✅' : '❌'} Count: ${queueSize || 0} (requirement: >= 5)`);

  // 7) AI judge calls
  console.log('\n7) AI Judge Calls (last 30 min)...');
  const { count: judgeCalls } = await supabase
    .from('llm_usage_log')
    .select('*', { count: 'exact', head: true })
    .eq('purpose', 'target_judge')
    .gte('timestamp', thirtyMinutesAgo.toISOString());

  results.judgeCalls = {
    passed: (judgeCalls || 0) > 0,
    value: judgeCalls || 0
  };
  console.log(`${results.judgeCalls.passed ? '✅' : '❌'} Count: ${judgeCalls || 0} (requirement: > 0)`);

  // 8) Scheduler started
  console.log('\n8) Scheduler Started (last 30 min)...');
  const { count: schedulerStarted } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'reply_v2_scheduler_job_started')
    .gte('created_at', thirtyMinutesAgo.toISOString());

  results.schedulerStarted = {
    passed: (schedulerStarted || 0) >= 1,
    value: schedulerStarted || 0
  };
  console.log(`${results.schedulerStarted.passed ? '✅' : '❌'} Count: ${schedulerStarted || 0} (requirement: >= 1)`);

  // 9) SLO events
  console.log('\n9) SLO Events (last 30 min)...');
  const { count: sloCount, data: sloData } = await supabase
    .from('reply_slo_events')
    .select('reason')
    .gte('created_at', thirtyMinutesAgo.toISOString());

  const hasReasonCode = sloData && sloData.length > 0 && sloData.some(e => e.reason);
  results.sloEvents = {
    passed: (sloCount || 0) > 0 && hasReasonCode,
    value: sloCount || 0,
    details: hasReasonCode ? 'reason_code populated' : 'no reason_code'
  };
  console.log(`${results.sloEvents.passed ? '✅' : '❌'} Count: ${sloCount || 0} (requirement: > 0 with reason_code)`);

  // Summary
  console.log('\n========================================');
  console.log('VERIFICATION SUMMARY');
  console.log('========================================\n');

  const allPassed = Object.values(results).every(r => r.passed);
  Object.entries(results).forEach(([key, result]) => {
    console.log(`${result.passed ? '✅' : '❌'} ${key}: ${result.value}${result.details ? ` (${result.details})` : ''}`);
  });

  console.log(`\n${allPassed ? '✅ ALL CHECKS PASSED' : '❌ SOME CHECKS FAILED'}`);

  // Additional diagnostics
  if (!results.fetchStarted.passed) {
    console.log('\n🔍 DIAGNOSTICS: Fetch not started');
    const { data: timerEvents } = await supabase
      .from('system_events')
      .select('*')
      .eq('event_type', 'timer_scheduled')
      .eq('event_data->>job_name', 'reply_v2_fetch')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (timerEvents && timerEvents.length > 0) {
      console.log('  ✅ Timer scheduled found');
    } else {
      console.log('  ❌ Timer scheduled NOT found');
    }

    const { data: firedEvents } = await supabase
      .from('system_events')
      .select('*')
      .eq('event_type', 'timer_fired')
      .eq('event_data->>job_name', 'reply_v2_fetch')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (firedEvents && firedEvents.length > 0) {
      console.log('  ✅ Timer fired found');
    } else {
      console.log('  ❌ Timer fired NOT found');
    }

    const { data: healEvents } = await supabase
      .from('system_events')
      .select('*')
      .eq('event_type', 'watchdog_self_heal')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (healEvents && healEvents.length > 0) {
      console.log(`  ℹ️  Watchdog self-heal attempted: ${healEvents[0].created_at}`);
    }
  }

  process.exit(allPassed ? 0 : 1);
}

verifyProduction().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

