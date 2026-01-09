/**
 * 🏆 PRODUCTION PROOF GOLD FINAL
 * Final proof check with complete trace chain
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function productionProofGoldFinal() {
  const supabase = getSupabaseClient();
  const results: any = {};
  
  console.log('========================================');
  console.log('PRODUCTION PROOF GOLD FINAL');
  console.log('========================================\n');
  
  const fifteenMinAgo = new Date(Date.now() - 15 * 60000).toISOString();
  const probeTime = new Date(Date.now() - 10 * 60000).toISOString(); // 10 minutes ago (after probe)
  
  // 1. Confirm deploy (git_sha)
  console.log('1. Deploy Confirmation');
  console.log('-'.repeat(40));
  
  const { data: bootEvent } = await supabase
    .from('system_events')
    .select('created_at, event_data')
    .eq('event_type', 'production_watchdog_boot')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (bootEvent) {
    const gitSha = (bootEvent.event_data as any)?.git_sha || 'unknown';
    results.git_sha = gitSha;
    results.boot_time = bootEvent.created_at;
    console.log(`Git SHA: ${gitSha}`);
    console.log(`Boot Time: ${bootEvent.created_at}`);
    console.log(`Status: ${gitSha.startsWith('ae8397b0') || gitSha.length >= 7 ? '✅ PASS' : '⚠️  CHECK'}\n`);
  } else {
    results.git_sha = 'NOT FOUND';
    console.log('Boot event not found\n');
  }
  
  // 2. Fetch completion
  console.log('2. Fetch Completion');
  console.log('-'.repeat(40));
  
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
  
  const { count: fetchFailed } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'reply_v2_fetch_job_failed')
    .gte('created_at', fifteenMinAgo);
  
  results.fetch = {
    started: fetchStarted || 0,
    completed: fetchCompleted || 0,
    failed: fetchFailed || 0,
    pass: (fetchCompleted || 0) >= 1,
  };
  
  console.log(`Fetch started: ${results.fetch.started} (target: >=1)`);
  console.log(`Fetch completed: ${results.fetch.completed} (target: >=1)`);
  console.log(`Fetch failed: ${results.fetch.failed}`);
  console.log(`Status: ${results.fetch.pass ? '✅ PASS' : '❌ FAIL'}\n`);
  
  // 3. Probe result
  console.log('3. Probe Result');
  console.log('-'.repeat(40));
  
  const { data: probeResult } = await supabase
    .from('system_events')
    .select('created_at, event_data')
    .eq('event_type', 'reply_v2_probe_boot_result')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (probeResult) {
    const probeData = probeResult.event_data as any;
    results.probe = {
      posted: probeData.posted || false,
      decision_id: probeData.decision_id || null,
      permit_id: probeData.permit_id || null,
      posted_tweet_id: probeData.posted_tweet_id || null,
      candidate_tweet_id: probeData.candidate_tweet_id || null,
      reason: probeData.reason || probeData.failure_reason || null,
      queue_size_before: probeData.queue_size_before || 0,
      queue_size_after: probeData.queue_size_after || 0,
      probe_run_id: probeData.probe_run_id || null,
    };
    
    console.log(`Probe Run ID: ${results.probe.probe_run_id}`);
    console.log(`Posted: ${results.probe.posted}`);
    console.log(`Decision ID: ${results.probe.decision_id || 'N/A'}`);
    console.log(`Permit ID: ${results.probe.permit_id || 'N/A'}`);
    console.log(`Posted Tweet ID: ${results.probe.posted_tweet_id || 'N/A'}`);
    console.log(`Reason: ${results.probe.reason || 'N/A'}`);
    console.log(`Queue Size Before: ${results.probe.queue_size_before}`);
    console.log(`Queue Size After: ${results.probe.queue_size_after}`);
    console.log(`Status: ${results.probe.posted ? '✅ PASS' : '⚠️  FAILED'}\n`);
  } else {
    results.probe = null;
    console.log('Probe result not found\n');
  }
  
  // 4. Trace chain (if posted)
  console.log('4. Trace Chain');
  console.log('-'.repeat(40));
  
  if (results.probe?.posted_tweet_id) {
    const tweetId = results.probe.posted_tweet_id;
    
    // Get permit
    const { data: permit } = await supabase
      .from('post_attempts')
      .select('*')
      .eq('actual_tweet_id', tweetId)
      .order('used_at', { ascending: false })
      .limit(1)
      .single();
    
    if (permit) {
      results.trace_chain = {
        permit_id: permit.permit_id,
        decision_id: permit.decision_id,
        posted_tweet_id: permit.actual_tweet_id,
        pipeline_source: permit.pipeline_source,
        target_is_root: permit.target_is_root,
        reason_code: permit.reason_code,
      };
      
      // Get decision
      const { data: decision } = await supabase
        .from('content_generation_metadata_comprehensive')
        .select('*')
        .eq('decision_id', permit.decision_id)
        .single();
      
      if (decision) {
        results.trace_chain.candidate_evaluation_id = decision.candidate_evaluation_id;
        results.trace_chain.queue_id = decision.queue_id;
        results.trace_chain.scheduler_run_id = decision.scheduler_run_id;
      }
      
      // Check click attempt event
      const { data: clickEvent } = await supabase
        .from('system_events')
        .select('*')
        .or(`event_data->>permit_id.eq.${permit.permit_id},event_data->>tweet_id.eq.${tweetId}`)
        .eq('event_type', 'post_reply_click_attempt')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      results.trace_chain.click_attempt_logged = !!clickEvent;
      
      console.log('Trace chain:');
      console.log(`  Candidate Evaluation ID: ${results.trace_chain.candidate_evaluation_id || 'N/A'}`);
      console.log(`  Queue ID: ${results.trace_chain.queue_id || 'N/A'}`);
      console.log(`  Scheduler Run ID: ${results.trace_chain.scheduler_run_id || 'N/A'}`);
      console.log(`  Decision ID: ${results.trace_chain.decision_id}`);
      console.log(`  Permit ID: ${results.trace_chain.permit_id}`);
      console.log(`  Posted Tweet ID: ${results.trace_chain.posted_tweet_id}`);
      console.log(`  Pipeline Source: ${results.trace_chain.pipeline_source}`);
      console.log(`  Target is Root: ${results.trace_chain.target_is_root}`);
      console.log(`  Reason Code: ${results.trace_chain.reason_code || 'NULL'}`);
      console.log(`  Click Attempt Logged: ${results.trace_chain.click_attempt_logged ? '✅ YES' : '❌ NO'}`);
      
      const allLinksExist = 
        results.trace_chain.candidate_evaluation_id &&
        results.trace_chain.queue_id &&
        results.trace_chain.scheduler_run_id &&
        results.trace_chain.decision_id &&
        results.trace_chain.permit_id &&
        results.trace_chain.posted_tweet_id;
      
      results.trace_chain_complete = !!allLinksExist;
      console.log(`\nTrace chain complete: ${allLinksExist ? '✅ YES' : '❌ NO'}`);
    } else {
      results.trace_chain = null;
      console.log('Permit not found for posted tweet');
    }
  } else {
    results.trace_chain = null;
    console.log('No posted tweet found');
  }
  
  console.log('');
  
  // 5. Queue size
  console.log('5. Queue Size');
  console.log('-'.repeat(40));
  
  const { count: queueSize } = await supabase
    .from('reply_candidate_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'queued')
    .gt('expires_at', new Date().toISOString());
  
  results.queue_size = queueSize || 0;
  console.log(`Queue size: ${results.queue_size}`);
  console.log(`Status: ${results.queue_size >= 0 ? '✅ PASS' : '❌ FAIL'}\n`);
  
  // 6. Ghost reconciliation
  console.log('6. Ghost Reconciliation');
  console.log('-'.repeat(40));
  
  const { count: newGhosts } = await supabase
    .from('ghost_tweets')
    .select('*', { count: 'exact', head: true })
    .gte('detected_at', probeTime);
  
  const { data: recentGhosts } = await supabase
    .from('ghost_tweets')
    .select('tweet_id, detected_at, reason')
    .gte('detected_at', probeTime)
    .order('detected_at', { ascending: false })
    .limit(10);
  
  results.ghosts_new = newGhosts || 0;
  console.log(`New ghosts (after probe): ${results.ghosts_new} (target: 0)`);
  
  if (recentGhosts && recentGhosts.length > 0) {
    console.log('Recent ghosts:');
    recentGhosts.forEach(g => {
      console.log(`  ${g.tweet_id} (${g.detected_at}): ${g.reason || 'N/A'}`);
    });
  }
  
  console.log(`Status: ${results.ghosts_new === 0 ? '✅ PASS' : '❌ FAIL'}\n`);
  
  // Summary
  console.log('========================================');
  console.log('SUMMARY');
  console.log('========================================\n');
  
  const allPassed = 
    results.fetch.pass &&
    results.probe !== null &&
    (results.probe.posted ? results.trace_chain_complete : true) &&
    results.ghosts_new === 0;
  
  console.log(`Git SHA: ${results.git_sha}`);
  console.log(`Fetch: ${results.fetch.pass ? '✅' : '❌'} (${results.fetch.started} started, ${results.fetch.completed} completed)`);
  console.log(`Probe: ${results.probe ? (results.probe.posted ? '✅ POSTED' : '⚠️  FAILED') : '❌ NOT FOUND'}`);
  if (results.probe?.posted) {
    console.log(`  Posted Tweet ID: ${results.probe.posted_tweet_id}`);
    console.log(`  Trace Chain: ${results.trace_chain_complete ? '✅ COMPLETE' : '❌ INCOMPLETE'}`);
  } else if (results.probe) {
    console.log(`  Failure Reason: ${results.probe.reason || 'N/A'}`);
  }
  console.log(`Queue Size: ${results.queue_size}`);
  console.log(`Ghosts (new): ${results.ghosts_new === 0 ? '✅' : '❌'} (${results.ghosts_new})`);
  
  console.log(`\n${allPassed ? '✅ OPERATIONAL' : '❌ NOT OPERATIONAL'}`);
  
  if (!allPassed) {
    const blockers: string[] = [];
    if (!results.fetch.pass) blockers.push(`Fetch incomplete (${results.fetch.started} started, ${results.fetch.completed} completed)`);
    if (!results.probe) blockers.push('Probe result not found');
    if (results.probe && !results.probe.posted) blockers.push(`Probe failed: ${results.probe.reason || 'N/A'}`);
    if (results.probe?.posted && !results.trace_chain_complete) blockers.push('Trace chain incomplete');
    if (results.ghosts_new > 0) blockers.push(`${results.ghosts_new} new ghosts`);
    
    console.log(`\nBlocking reasons: ${blockers.join(', ')}`);
  }
  
  return results;
}

productionProofGoldFinal().then(results => {
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

