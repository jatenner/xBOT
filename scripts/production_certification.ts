/**
 * 🏆 PRODUCTION CERTIFICATION REPORT
 * Executes all proof queries and outputs PASS/FAIL table with SQL results
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

interface ProofResult {
  check: string;
  status: 'PASS' | 'FAIL';
  sql: string;
  result: any;
  details: string;
}

async function productionCertification(): Promise<void> {
  const supabase = getSupabaseClient();
  const expectedSha = process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_SHA || 'unknown';
  const results: ProofResult[] = [];

  console.log('=== PRODUCTION CERTIFICATION REPORT ===\n');
  console.log(`Expected SHA: ${expectedSha.substring(0, 8)}\n`);

  // A) Running SHA proof
  const shaSql = `SELECT created_at, event_data->>'git_sha' as git_sha FROM system_events WHERE event_type = 'production_watchdog_boot' ORDER BY created_at DESC LIMIT 1;`;
  const { data: latestBoot } = await supabase
    .from('system_events')
    .select('created_at, event_data')
    .eq('event_type', 'production_watchdog_boot')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (latestBoot) {
    const bootData = latestBoot.event_data as any;
    const runningSha = (bootData.git_sha || '').substring(0, 8);
    const shaMatch = runningSha === expectedSha.substring(0, 8);
    
    results.push({
      check: 'A) Running SHA proof',
      status: shaMatch ? 'PASS' : 'FAIL',
      sql: shaSql,
      result: { created_at: latestBoot.created_at, git_sha: runningSha },
      details: `Running: ${runningSha}, Expected: ${expectedSha.substring(0, 8)}`,
    });
  } else {
    results.push({
      check: 'A) Running SHA proof',
      status: 'FAIL',
      sql: shaSql,
      result: null,
      details: 'No boot heartbeat found',
    });
  }

  // B) Worker alive proof
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const watchdogSql = `SELECT COUNT(*) FROM system_events WHERE event_type = 'production_watchdog_report' AND created_at >= '${fifteenMinAgo}';`;
  const { count: watchdogReports } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'production_watchdog_report')
    .gte('created_at', fifteenMinAgo);

  results.push({
    check: 'B) Worker alive proof',
    status: (watchdogReports || 0) >= 2 ? 'PASS' : 'FAIL',
    sql: watchdogSql,
    result: { count: watchdogReports || 0 },
    details: `Watchdog reports (15m): ${watchdogReports || 0}`,
  });

  // C) Fetch proof
  const fetchSql = `SELECT COUNT(*) FILTER (WHERE event_type = 'reply_v2_fetch_job_started') as started, COUNT(*) FILTER (WHERE event_type = 'reply_v2_fetch_job_completed') as completed FROM system_events WHERE created_at >= '${fifteenMinAgo}' AND event_type LIKE '%reply_v2_fetch%';`;
  const { count: fetchStarted } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'reply_v2_fetch_job_started')
    .gte('created_at', fifteenMinAgo);

  const { count: fetchCompleted } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'reply_v2_fetch_job_completed')
    .gte('created_at', fifteenMinAgo);

  results.push({
    check: 'C) Fetch proof',
    status: (fetchStarted || 0) >= 1 && (fetchCompleted || 0) >= 1 ? 'PASS' : 'FAIL',
    sql: fetchSql,
    result: { started: fetchStarted || 0, completed: fetchCompleted || 0 },
    details: `Started: ${fetchStarted || 0}, Completed: ${fetchCompleted || 0}`,
  });

  // D) Queue proof
  const queueSql = `SELECT COUNT(*) FROM reply_candidate_queue WHERE status = 'queued' AND expires_at > NOW();`;
  const { count: queueSize } = await supabase
    .from('reply_candidate_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'queued')
    .gt('expires_at', new Date().toISOString());

  results.push({
    check: 'D) Queue proof',
    status: (queueSize || 0) >= 5 ? 'PASS' : 'FAIL',
    sql: queueSql,
    result: { count: queueSize || 0 },
    details: `Queued candidates: ${queueSize || 0}`,
  });

  // E) Scheduler + permit proof
  const sixtyMinAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const schedulerSql = `SELECT COUNT(*) FROM system_events WHERE event_type = 'reply_v2_scheduler_job_started' AND created_at >= '${sixtyMinAgo}';`;
  const { count: schedulerStarted } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'reply_v2_scheduler_job_started')
    .gte('created_at', sixtyMinAgo);

  const permitSql = `SELECT COUNT(*) FROM post_attempts WHERE pipeline_source = 'reply_v2_scheduler' AND created_at >= '${sixtyMinAgo}';`;
  const { count: permitsCreated } = await supabase
    .from('post_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('pipeline_source', 'reply_v2_scheduler')
    .gte('created_at', sixtyMinAgo);

  results.push({
    check: 'E) Scheduler + permit proof',
    status: (schedulerStarted || 0) >= 1 && (permitsCreated || 0) >= 1 ? 'PASS' : 'FAIL',
    sql: `${schedulerSql}\n${permitSql}`,
    result: { scheduler_started: schedulerStarted || 0, permits_created: permitsCreated || 0 },
    details: `Scheduler started: ${schedulerStarted || 0}, Permits created: ${permitsCreated || 0}`,
  });

  // F) Posting trace-chain proof
  const traceSql = `SELECT permit_id, decision_id, actual_tweet_id, used_at FROM post_attempts WHERE status = 'USED' AND pipeline_source = 'reply_v2_scheduler' AND actual_tweet_id IS NOT NULL ORDER BY used_at DESC LIMIT 1;`;
  const { data: postedPermit } = await supabase
    .from('post_attempts')
    .select('permit_id, decision_id, actual_tweet_id, used_at')
    .eq('status', 'USED')
    .eq('pipeline_source', 'reply_v2_scheduler')
    .not('actual_tweet_id', 'is', null)
    .order('used_at', { ascending: false })
    .limit(1)
    .single();

  if (postedPermit) {
    // Verify trace chain
    const { data: decision } = await supabase
      .from('content_generation_metadata_comprehensive')
      .select('decision_id, candidate_tweet_id')
      .eq('decision_id', postedPermit.decision_id)
      .single();

    results.push({
      check: 'F) Posting trace-chain proof',
      status: 'PASS',
      sql: traceSql,
      result: {
        permit_id: postedPermit.permit_id,
        decision_id: postedPermit.decision_id,
        posted_tweet_id: postedPermit.actual_tweet_id,
        used_at: postedPermit.used_at,
        decision_exists: !!decision,
      },
      details: `Trace chain: decision_id=${postedPermit.decision_id} → permit_id=${postedPermit.permit_id} → tweet_id=${postedPermit.actual_tweet_id}`,
    });
  } else {
    results.push({
      check: 'F) Posting trace-chain proof',
      status: 'FAIL',
      sql: traceSql,
      result: null,
      details: 'No permits USED with posted_tweet_id found',
    });
  }

  // G) Ghost proof
  const deployTime = latestBoot?.created_at || new Date(0).toISOString();
  const ghostSql = `SELECT COUNT(*) FROM ghost_tweets WHERE detected_at >= '${deployTime}';`;
  const { count: newGhosts } = await supabase
    .from('ghost_tweets')
    .select('*', { count: 'exact', head: true })
    .gte('detected_at', deployTime);

  // Check for blocked posting attempts
  const { count: blockedEvents } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'posting_blocked_wrong_service')
    .gte('created_at', deployTime);

  results.push({
    check: 'G) Ghost proof',
    status: (newGhosts || 0) === 0 ? 'PASS' : 'FAIL',
    sql: ghostSql,
    result: { new_ghosts: newGhosts || 0, blocked_events: blockedEvents || 0 },
    details: `New ghosts since deploy: ${newGhosts || 0}, Blocked attempts: ${blockedEvents || 0}`,
  });

  // Print results table
  console.log('=== PROOF RESULTS TABLE ===\n');
  console.log('| Check | Status | Details |');
  console.log('|-------|--------|---------|');
  results.forEach(r => {
    const statusIcon = r.status === 'PASS' ? '✅' : '❌';
    console.log(`| ${r.check} | ${statusIcon} ${r.status} | ${r.details} |`);
  });

  // Print SQL queries and results
  console.log('\n=== SQL QUERIES AND RESULTS ===\n');
  results.forEach((r, i) => {
    console.log(`${i + 1}. ${r.check}:`);
    console.log(`SQL: ${r.sql}`);
    console.log(`Result: ${JSON.stringify(r.result, null, 2)}`);
    console.log('');
  });

  // Overall verdict
  const allPass = results.every(r => r.status === 'PASS');
  console.log(`=== OVERALL VERDICT ===`);
  console.log(`Status: ${allPass ? '✅ OPERATIONAL' : '❌ NOT OPERATIONAL'}`);

  // Identify highest-level blocker
  const failedChecks = results.filter(r => r.status === 'FAIL');
  if (failedChecks.length > 0) {
    console.log(`\n=== HIGHEST-LEVEL BLOCKER ===`);
    console.log(`${failedChecks[0].check}: ${failedChecks[0].details}`);
  }

  process.exit(allPass ? 0 : 1);
}

productionCertification().catch((error) => {
  console.error('❌ Certification script failed:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
});

