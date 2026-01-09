/**
 * 🔍 PRODUCTION LIVENESS PROOF
 * Checks all production metrics
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function productionLiveness() {
  const supabase = getSupabaseClient();
  
  console.log('========================================');
  console.log('PRODUCTION LIVENESS PROOF');
  console.log('========================================\n');
  
  const results: Record<string, any> = {};
  
  // Production watchdog boot
  const { data: boot } = await supabase
    .from('system_events')
    .select('*')
    .eq('event_type', 'production_watchdog_boot')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  results.boot = {
    found: !!boot,
    created_at: boot?.created_at,
    jobs_enabled: boot?.event_data?.jobs_enabled,
    git_sha: boot?.event_data?.git_sha,
  };
  
  // Watchdog reports (last 15 min)
  const fifteenMinAgo = new Date(Date.now() - 15 * 60000).toISOString();
  const { count: watchdogReports } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'production_watchdog_report')
    .gte('created_at', fifteenMinAgo);
  
  results.watchdog_reports = {
    count: watchdogReports || 0,
    pass: (watchdogReports || 0) >= 2,
  };
  
  // Fetch started/completed (last 15 min)
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
  
  results.fetch = {
    started: fetchStarted || 0,
    completed: fetchCompleted || 0,
    pass: (fetchStarted || 0) >= 2 && (fetchCompleted || 0) >= 1,
  };
  
  // Scheduler started (last 60 min)
  const sixtyMinAgo = new Date(Date.now() - 60 * 60000).toISOString();
  const { count: schedulerStarted } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'reply_v2_scheduler_job_started')
    .gte('created_at', sixtyMinAgo);
  
  results.scheduler = {
    started: schedulerStarted || 0,
    pass: (schedulerStarted || 0) > 0,
  };
  
  // SLO events (last 60 min)
  const { count: sloEvents } = await supabase
    .from('reply_slo_events')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', sixtyMinAgo);
  
  results.slo_events = {
    count: sloEvents || 0,
    pass: (sloEvents || 0) > 0,
  };
  
  // Candidate evaluations (last 60 min)
  const { count: evaluations } = await supabase
    .from('candidate_evaluations')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', sixtyMinAgo);
  
  results.evaluations = {
    count: evaluations || 0,
    pass: (evaluations || 0) > 0,
  };
  
  // Queue size (current)
  const { count: queueSize } = await supabase
    .from('reply_candidate_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'queued')
    .gt('expires_at', new Date().toISOString());
  
  results.queue = {
    size: queueSize || 0,
    pass: (queueSize || 0) >= 5,
  };
  
  // AI judge calls (last 60 min)
  const { count: judgeCalls } = await supabase
    .from('llm_usage_log')
    .select('*', { count: 'exact', head: true })
    .eq('purpose', 'target_judge')
    .gte('timestamp', sixtyMinAgo);
  
  results.judge = {
    count: judgeCalls || 0,
    pass: (judgeCalls || 0) > 0,
  };
  
  // Print results
  console.log('📊 RESULTS:\n');
  console.log(JSON.stringify(results, null, 2));
  
  return results;
}

productionLiveness().then(results => {
  console.log('\n========================================');
  console.log('SUMMARY');
  console.log('========================================\n');
  
  const allPassed = Object.values(results).every((r: any) => r.pass !== false);
  Object.entries(results).forEach(([key, value]: [string, any]) => {
    const pass = value.pass !== false;
    console.log(`${pass ? '✅' : '❌'} ${key}: ${pass ? 'PASS' : 'FAIL'}`);
    if (value.count !== undefined) console.log(`   Count: ${value.count}`);
    if (value.started !== undefined) console.log(`   Started: ${value.started}, Completed: ${value.completed}`);
  });
  
  console.log(`\n${allPassed ? '✅ ALL CHECKS PASSED' : '❌ SOME CHECKS FAILED'}`);
  process.exit(allPassed ? 0 : 1);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

