/**
 * 🏆 PRODUCTION PROOF GOLD
 * Final proof check with complete trace chain
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function productionProofGold() {
  const supabase = getSupabaseClient();
  const results: any = {};
  
  console.log('========================================');
  console.log('PRODUCTION PROOF GOLD');
  console.log('========================================\n');
  
  const fifteenMinAgo = new Date(Date.now() - 15 * 60000).toISOString();
  const thirtyMinAgo = new Date(Date.now() - 30 * 60000).toISOString();
  
  // 1. Scheduler attempts created
  console.log('1. Scheduler Attempts Created');
  console.log('-'.repeat(40));
  
  const { count: attemptsCreated } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'reply_v2_attempt_created')
    .gte('created_at', fifteenMinAgo);
  
  results.attempts_created = attemptsCreated || 0;
  console.log(`Attempts created: ${results.attempts_created} (target: >=1)`);
  console.log(`Status: ${results.attempts_created >= 1 ? '✅ PASS' : '❌ FAIL'}\n`);
  
  // 2. Permits created
  console.log('2. Permits Created');
  console.log('-'.repeat(40));
  
  const { count: permitsCreated } = await supabase
    .from('post_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('decision_type', 'reply')
    .eq('pipeline_source', 'reply_v2_scheduler')
    .gte('created_at', fifteenMinAgo);
  
  results.permits_created = permitsCreated || 0;
  console.log(`Permits created: ${results.permits_created} (target: >=1)`);
  console.log(`Status: ${results.permits_created >= 1 ? '✅ PASS' : '❌ FAIL'}\n`);
  
  // 3. Permits USED with posted_tweet_id
  console.log('3. Permits USED');
  console.log('-'.repeat(40));
  
  const { data: usedPermits } = await supabase
    .from('post_attempts')
    .select('*')
    .eq('decision_type', 'reply')
    .eq('pipeline_source', 'reply_v2_scheduler')
    .eq('status', 'USED')
    .not('actual_tweet_id', 'is', null)
    .gte('created_at', fifteenMinAgo)
    .order('used_at', { ascending: false })
    .limit(5);
  
  results.permits_used = usedPermits?.length || 0;
  console.log(`Permits USED: ${results.permits_used} (target: >=1)`);
  
  if (usedPermits && usedPermits.length > 0) {
    console.log('\nLatest posted reply:');
    const latest = usedPermits[0];
    results.posted_tweet_id = latest.actual_tweet_id;
    results.posted_permit_id = latest.permit_id;
    results.posted_decision_id = latest.decision_id;
    
    console.log(`  Tweet ID: ${latest.actual_tweet_id}`);
    console.log(`  Permit ID: ${latest.permit_id}`);
    console.log(`  Decision ID: ${latest.decision_id}`);
    console.log(`  Pipeline Source: ${latest.pipeline_source}`);
    console.log(`  Target is Root: ${latest.target_is_root}`);
    console.log(`  Reason Code: ${latest.reason_code || 'NULL'}`);
  }
  
  console.log(`Status: ${results.permits_used >= 1 ? '✅ PASS' : '❌ FAIL'}\n`);
  
  // 4. Trace chain
  console.log('4. Trace Chain');
  console.log('-'.repeat(40));
  
  if (results.posted_decision_id) {
    const { data: decision } = await supabase
      .from('content_generation_metadata_comprehensive')
      .select('*')
      .eq('decision_id', results.posted_decision_id)
      .single();
    
    if (decision) {
      results.trace_chain = {
        candidate_evaluation_id: decision.candidate_evaluation_id,
        queue_id: decision.queue_id,
        scheduler_run_id: decision.scheduler_run_id,
        decision_id: decision.decision_id,
        permit_id: results.posted_permit_id,
        posted_tweet_id: results.posted_tweet_id,
      };
      
      console.log('Trace chain:');
      console.log(`  Candidate Evaluation ID: ${decision.candidate_evaluation_id || 'N/A'}`);
      console.log(`  Queue ID: ${decision.queue_id || 'N/A'}`);
      console.log(`  Scheduler Run ID: ${decision.scheduler_run_id || 'N/A'}`);
      console.log(`  Decision ID: ${decision.decision_id}`);
      console.log(`  Permit ID: ${results.posted_permit_id}`);
      console.log(`  Posted Tweet ID: ${results.posted_tweet_id}`);
      
      // Verify all links exist
      const allLinksExist = 
        decision.candidate_evaluation_id &&
        decision.queue_id &&
        decision.scheduler_run_id &&
        decision.decision_id &&
        results.posted_permit_id &&
        results.posted_tweet_id;
      
      results.trace_chain_complete = !!allLinksExist;
      console.log(`\nTrace chain complete: ${allLinksExist ? '✅ YES' : '❌ NO'}`);
    } else {
      results.trace_chain = null;
      console.log('Decision not found');
    }
  } else {
    results.trace_chain = null;
    console.log('No posted reply found');
  }
  
  console.log('');
  
  // 5. Fetch started/completed
  console.log('5. Fetch Status');
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
  
  results.fetch = {
    started: fetchStarted || 0,
    completed: fetchCompleted || 0,
    pass: (fetchStarted || 0) >= 1 && (fetchCompleted || 0) >= 1,
  };
  
  console.log(`Fetch started: ${results.fetch.started} (target: >=1)`);
  console.log(`Fetch completed: ${results.fetch.completed} (target: >=1)`);
  console.log(`Status: ${results.fetch.pass ? '✅ PASS' : '❌ FAIL'}\n`);
  
  // 6. Queue size
  console.log('6. Queue Size');
  console.log('-'.repeat(40));
  
  const { count: queueSize } = await supabase
    .from('reply_candidate_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'queued')
    .gt('expires_at', new Date().toISOString());
  
  results.queue_size = queueSize || 0;
  console.log(`Queue size: ${results.queue_size} (target: >=5)`);
  console.log(`Status: ${results.queue_size >= 5 ? '✅ PASS' : '❌ FAIL'}\n`);
  
  // 7. Ghost reconciliation
  console.log('7. Ghost Reconciliation');
  console.log('-'.repeat(40));
  
  const probeTime = new Date(Date.now() - 5 * 60000).toISOString(); // 5 minutes ago (after probe)
  
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
    results.attempts_created >= 1 &&
    results.permits_created >= 1 &&
    results.permits_used >= 1 &&
    results.trace_chain_complete &&
    results.fetch.pass &&
    results.queue_size >= 5 &&
    results.ghosts_new === 0;
  
  console.log(`Attempts Created: ${results.attempts_created >= 1 ? '✅' : '❌'} (${results.attempts_created})`);
  console.log(`Permits Created: ${results.permits_created >= 1 ? '✅' : '❌'} (${results.permits_created})`);
  console.log(`Permits USED: ${results.permits_used >= 1 ? '✅' : '❌'} (${results.permits_used})`);
  console.log(`Trace Chain: ${results.trace_chain_complete ? '✅' : '❌'}`);
  console.log(`Fetch: ${results.fetch.pass ? '✅' : '❌'} (${results.fetch.started} started, ${results.fetch.completed} completed)`);
  console.log(`Queue Size: ${results.queue_size >= 5 ? '✅' : '❌'} (${results.queue_size})`);
  console.log(`Ghosts (new): ${results.ghosts_new === 0 ? '✅' : '❌'} (${results.ghosts_new})`);
  
  console.log(`\n${allPassed ? '✅ OPERATIONAL' : '❌ NOT OPERATIONAL'}`);
  
  if (!allPassed) {
    const blockers: string[] = [];
    if (results.attempts_created < 1) blockers.push('No attempts created');
    if (results.permits_created < 1) blockers.push('No permits created');
    if (results.permits_used < 1) blockers.push('No permits USED');
    if (!results.trace_chain_complete) blockers.push('Trace chain incomplete');
    if (!results.fetch.pass) blockers.push(`Fetch incomplete (${results.fetch.started} started, ${results.fetch.completed} completed)`);
    if (results.queue_size < 5) blockers.push(`Queue low (${results.queue_size})`);
    if (results.ghosts_new > 0) blockers.push(`${results.ghosts_new} new ghosts`);
    
    console.log(`\nBlocking reasons: ${blockers.join(', ')}`);
  }
  
  return results;
}

productionProofGold().then(results => {
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

