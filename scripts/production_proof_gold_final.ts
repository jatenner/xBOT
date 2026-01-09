/**
 * 🏆 PRODUCTION PROOF GOLD FINAL
 * Executable proof script that runs with Railway prod env vars
 * Outputs PASS/FAIL table for all critical checks
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

interface ProofResult {
  check: string;
  status: 'PASS' | 'FAIL';
  details: string;
  count?: number;
}

async function productionProofGoldFinal(): Promise<void> {
  const supabase = getSupabaseClient();
  // Use Railway deployment SHA (RAILWAY_GIT_COMMIT_SHA) or fallback to git HEAD
  const railwaySha = process.env.RAILWAY_GIT_COMMIT_SHA;
  const gitSha = process.env.GIT_SHA;
  // Accept either Railway SHA or git SHA (Railway may use different SHA format)
  const expectedSha = railwaySha || gitSha || 'unknown';
  const results: ProofResult[] = [];

  console.log('=== PRODUCTION PROOF GOLD FINAL ===\n');
  console.log(`Railway SHA: ${railwaySha ? railwaySha.substring(0, 8) : 'NOT SET'}`);
  console.log(`Git SHA: ${gitSha ? gitSha.substring(0, 8) : 'NOT SET'}`);
  console.log(`Expected SHA: ${expectedSha.substring(0, 8)}\n`);

  // A) Running SHA proof
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
    // Match if Railway SHA matches OR git SHA matches (Railway may use different SHA)
    const shaMatch = railwaySha 
      ? runningSha === railwaySha.substring(0, 8)
      : gitSha
        ? runningSha === gitSha.substring(0, 8)
        : false;
    
    results.push({
      check: 'A) Running SHA proof',
      status: shaMatch ? 'PASS' : 'FAIL',
      details: `Running: ${runningSha}, Expected: ${expectedSha.substring(0, 8)}${railwaySha ? ` (Railway: ${railwaySha.substring(0, 8)})` : ''}`,
    });
  } else {
    results.push({
      check: 'A) Running SHA proof',
      status: 'FAIL',
      details: 'No boot heartbeat found',
    });
  }

  // B) Worker-only posting proof
  const deployTime = latestBoot?.created_at || new Date(0).toISOString();
  const { count: blockedEvents } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'posting_blocked_wrong_service')
    .gte('created_at', deployTime);

  // Check for successful posts from non-worker
  const { data: nonWorkerPosts } = await supabase
    .from('post_attempts')
    .select('permit_id, created_at, pipeline_source')
    .not('pipeline_source', 'eq', 'reply_v2_scheduler')
    .gte('created_at', deployTime)
    .limit(1);

  const workerOnlyPass = (blockedEvents || 0) >= 0 && !nonWorkerPosts;
  results.push({
    check: 'B) Worker-only posting proof',
    status: workerOnlyPass ? 'PASS' : 'FAIL',
    details: `Blocked events: ${blockedEvents || 0}, Non-worker posts: ${nonWorkerPosts ? 1 : 0}`,
    count: blockedEvents || 0,
  });

  // C) Jobs ticking proof
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  
  const { count: watchdogReports } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'production_watchdog_report')
    .gte('created_at', fifteenMinAgo);

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

  const jobsTickingPass = (watchdogReports || 0) > 0 && (fetchStarted || 0) > 0 && (fetchCompleted || 0) > 0;
  results.push({
    check: 'C) Jobs ticking proof',
    status: jobsTickingPass ? 'PASS' : 'FAIL',
    details: `Watchdog: ${watchdogReports || 0}, Fetch started: ${fetchStarted || 0}, Fetch completed: ${fetchCompleted || 0}`,
    count: watchdogReports || 0,
  });

  // D) Pipeline proof
  const { count: queueSize } = await supabase
    .from('reply_candidate_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'queued')
    .gt('expires_at', new Date().toISOString());

  const sixtyMinAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  const { count: schedulerStarted } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'reply_v2_scheduler_job_started')
    .gte('created_at', sixtyMinAgo);

  const { count: permitsCreated } = await supabase
    .from('post_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('pipeline_source', 'reply_v2_scheduler')
    .gte('created_at', sixtyMinAgo);

  const { data: permitsUsed } = await supabase
    .from('post_attempts')
    .select('actual_tweet_id, used_at')
    .eq('status', 'USED')
    .eq('pipeline_source', 'reply_v2_scheduler')
    .not('actual_tweet_id', 'is', null)
    .gte('used_at', sixtyMinAgo)
    .limit(1)
    .single();

  const pipelinePass = (queueSize || 0) >= 5 && (schedulerStarted || 0) > 0 && (permitsCreated || 0) > 0 && !!permitsUsed;
  results.push({
    check: 'D) Pipeline proof',
    status: pipelinePass ? 'PASS' : 'FAIL',
    details: `Queue: ${queueSize || 0}, Scheduler: ${schedulerStarted || 0}, Permits created: ${permitsCreated || 0}, Permits used: ${permitsUsed ? 1 : 0}`,
    count: queueSize || 0,
  });

  // E) Ghost proof
  const { count: newGhosts } = await supabase
    .from('ghost_tweets')
    .select('*', { count: 'exact', head: true })
    .gte('detected_at', deployTime);

  const ghostPass = (newGhosts || 0) === 0;
  results.push({
    check: 'E) Ghost proof',
    status: ghostPass ? 'PASS' : 'FAIL',
    details: `New ghosts since deploy: ${newGhosts || 0}`,
    count: newGhosts || 0,
  });

  // Print results table
  console.log('=== PROOF RESULTS TABLE ===\n');
  console.log('| Check | Status | Details |');
  console.log('|-------|--------|---------|');
  results.forEach(r => {
    const statusIcon = r.status === 'PASS' ? '✅' : '❌';
    console.log(`| ${r.check} | ${statusIcon} ${r.status} | ${r.details} |`);
  });

  // Overall verdict
  const allPass = results.every(r => r.status === 'PASS');
  console.log(`\n=== OVERALL VERDICT ===`);
  console.log(`Status: ${allPass ? '✅ OPERATIONAL' : '❌ NOT OPERATIONAL'}`);

  // Identify blocker
  const failedChecks = results.filter(r => r.status === 'FAIL');
  if (failedChecks.length > 0) {
    console.log(`\n=== CURRENT BLOCKER ===`);
    console.log(`${failedChecks[0].check}: ${failedChecks[0].details}`);
  }

  // If fetch fails, show error details
  if (!jobsTickingPass && (fetchStarted || 0) > 0 && (fetchCompleted || 0) === 0) {
    const { data: fetchFailure } = await supabase
      .from('system_events')
      .select('created_at, event_data, message')
      .eq('event_type', 'reply_v2_fetch_job_failed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (fetchFailure) {
      const failureData = fetchFailure.event_data as any;
      console.log(`\n=== FETCH FAILURE DETAILS ===`);
      console.log(`Time: ${fetchFailure.created_at}`);
      console.log(`Error: ${failureData.error || fetchFailure.message}`);
      console.log(`Stack: ${failureData.stack?.substring(0, 500) || 'N/A'}`);
    }
  }

  // If queue is 0, show evaluation details
  if ((queueSize || 0) === 0 && (fetchCompleted || 0) > 0) {
    const { count: evaluations } = await supabase
      .from('candidate_evaluations')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', fifteenMinAgo);

    const { data: rejectionReasons } = await supabase
      .from('candidate_evaluations')
      .select('filter_reason')
      .gte('created_at', fifteenMinAgo)
      .limit(10);

    console.log(`\n=== QUEUE DIAGNOSIS ===`);
    console.log(`Evaluations (15m): ${evaluations || 0}`);
    console.log(`Top rejection reasons:`);
    rejectionReasons?.forEach((r, i) => {
      console.log(`  ${i + 1}. ${r.filter_reason || 'N/A'}`);
    });
  }

  // If permits not created, show scheduler details
  if ((permitsCreated || 0) === 0 && (queueSize || 0) >= 5) {
    const { data: schedulerFailure } = await supabase
      .from('system_events')
      .select('created_at, event_data, message')
      .eq('event_type', 'reply_v2_scheduler_job_failed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (schedulerFailure) {
      const failureData = schedulerFailure.event_data as any;
      console.log(`\n=== SCHEDULER FAILURE DETAILS ===`);
      console.log(`Time: ${schedulerFailure.created_at}`);
      console.log(`Error: ${failureData.error || schedulerFailure.message}`);
      console.log(`Stack: ${failureData.stack?.substring(0, 500) || 'N/A'}`);
    }

    // Show candidate status distribution
    const { data: candidateStatuses } = await supabase
      .from('reply_candidate_queue')
      .select('status')
      .limit(100);

    const statusCounts: Record<string, number> = {};
    candidateStatuses?.forEach(c => {
      statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
    });

    console.log(`\n=== CANDIDATE STATUS DISTRIBUTION ===`);
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });
  }

  process.exit(allPass ? 0 : 1);
}

productionProofGoldFinal().catch((error) => {
  console.error('❌ Proof script failed:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
});
