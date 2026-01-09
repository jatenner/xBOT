/**
 * 🔍 PRODUCTION PROOF FINAL
 * Comprehensive proof check for operational status
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function productionProof() {
  const supabase = getSupabaseClient();
  const results: any = {};
  
  console.log('========================================');
  console.log('PRODUCTION PROOF FINAL');
  console.log('========================================\n');
  
  const thirtyMinAgo = new Date(Date.now() - 30 * 60000).toISOString();
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60000).toISOString();
  
  // PHASE 1: Migration applied
  console.log('PHASE 1: Migration Status');
  console.log('-'.repeat(40));
  
  const { data: migrationEvent } = await supabase
    .from('system_events')
    .select('*')
    .eq('event_type', 'migration_root_enforcement_applied')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  results.migration_applied = !!migrationEvent;
  console.log(`Migration applied: ${results.migration_applied ? '✅ YES' : '❌ NO'}`);
  if (migrationEvent) {
    console.log(`  Applied at: ${migrationEvent.created_at}`);
    console.log(`  Git SHA: ${(migrationEvent.event_data as any)?.git_sha}`);
  }
  
  // Verify schema
  const { data: schemaCheck } = await supabase
    .from('post_attempts')
    .select('target_is_root, target_in_reply_to_tweet_id, reason_code')
    .limit(1);
  
  results.schema_verified = !!schemaCheck;
  console.log(`Schema verified: ${results.schema_verified ? '✅ YES' : '❌ NO'}\n`);
  
  // PHASE 2: Fetch completion
  console.log('PHASE 2: Fetch Completion');
  console.log('-'.repeat(40));
  
  const { count: fetchStarted } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'reply_v2_fetch_job_started')
    .gte('created_at', thirtyMinAgo);
  
  const { count: fetchCompleted } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'reply_v2_fetch_job_completed')
    .gte('created_at', thirtyMinAgo);
  
  const { count: fetchFailed } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'reply_v2_fetch_job_failed')
    .gte('created_at', thirtyMinAgo);
  
  results.fetch = {
    started: fetchStarted || 0,
    completed: fetchCompleted || 0,
    failed: fetchFailed || 0,
    pass: (fetchStarted || 0) >= 3 && (fetchCompleted || 0) >= 2,
  };
  
  console.log(`Fetch started: ${results.fetch.started} (target: >=3)`);
  console.log(`Fetch completed: ${results.fetch.completed} (target: >=2)`);
  console.log(`Fetch failed: ${results.fetch.failed}`);
  console.log(`Status: ${results.fetch.pass ? '✅ PASS' : '❌ FAIL'}\n`);
  
  // PHASE 3: Queue size
  console.log('PHASE 3: Queue Health');
  console.log('-'.repeat(40));
  
  const { count: queueSize } = await supabase
    .from('reply_candidate_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'queued')
    .gt('expires_at', new Date().toISOString());
  
  results.queue = {
    size: queueSize || 0,
    pass: (queueSize || 0) >= 10,
  };
  
  console.log(`Queue size: ${results.queue.size} (target: >=10)`);
  console.log(`Status: ${results.queue.pass ? '✅ PASS' : '❌ FAIL'}\n`);
  
  // PHASE 4: Scheduler
  console.log('PHASE 4: Scheduler');
  console.log('-'.repeat(40));
  
  const { count: schedulerStarted } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'reply_v2_scheduler_job_started')
    .gte('created_at', thirtyMinAgo);
  
  const { count: sloEvents } = await supabase
    .from('reply_slo_events')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', thirtyMinAgo);
  
  results.scheduler = {
    started: schedulerStarted || 0,
    slo_events: sloEvents || 0,
    pass: (schedulerStarted || 0) >= 2 && (sloEvents || 0) >= 2,
  };
  
  console.log(`Scheduler started: ${results.scheduler.started} (target: >=2)`);
  console.log(`SLO events: ${results.scheduler.slo_events} (target: >=2)`);
  console.log(`Status: ${results.scheduler.pass ? '✅ PASS' : '❌ FAIL'}\n`);
  
  // PHASE 5: Permits
  console.log('PHASE 5: Permits');
  console.log('-'.repeat(40));
  
  const { count: permitsCreated } = await supabase
    .from('post_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('decision_type', 'reply')
    .eq('pipeline_source', 'reply_v2_scheduler')
    .gte('created_at', thirtyMinAgo);
  
  const { count: permitsUsed } = await supabase
    .from('post_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('decision_type', 'reply')
    .eq('pipeline_source', 'reply_v2_scheduler')
    .eq('status', 'USED')
    .not('actual_tweet_id', 'is', null)
    .gte('created_at', thirtyMinAgo);
  
  results.permits = {
    created: permitsCreated || 0,
    used: permitsUsed || 0,
    pass: (permitsCreated || 0) >= 2 && (permitsUsed || 0) >= 1,
  };
  
  console.log(`Permits created: ${results.permits.created} (target: >=2)`);
  console.log(`Permits USED: ${results.permits.used} (target: >=1)`);
  console.log(`Status: ${results.permits.pass ? '✅ PASS' : '❌ FAIL'}\n`);
  
  // PHASE 6: Trace chain for latest posted reply
  console.log('PHASE 6: Trace Chain');
  console.log('-'.repeat(40));
  
  const { data: latestPermit } = await supabase
    .from('post_attempts')
    .select('*')
    .eq('decision_type', 'reply')
    .eq('pipeline_source', 'reply_v2_scheduler')
    .eq('status', 'USED')
    .not('actual_tweet_id', 'is', null)
    .order('used_at', { ascending: false })
    .limit(1)
    .single();
  
  if (latestPermit) {
    results.trace_chain = {
      permit_id: latestPermit.permit_id,
      decision_id: latestPermit.decision_id,
      posted_tweet_id: latestPermit.actual_tweet_id,
      pipeline_source: latestPermit.pipeline_source,
      target_is_root: latestPermit.target_is_root,
      target_in_reply_to: latestPermit.target_in_reply_to_tweet_id,
      reason_code: latestPermit.reason_code,
    };
    
    // Get decision
    const { data: decision } = await supabase
      .from('content_generation_metadata_comprehensive')
      .select('*')
      .eq('decision_id', latestPermit.decision_id)
      .single();
    
    if (decision) {
      results.trace_chain.candidate_evaluation_id = decision.candidate_evaluation_id;
      results.trace_chain.queue_id = decision.queue_id;
      results.trace_chain.scheduler_run_id = decision.scheduler_run_id;
    }
    
    // Check system events
    const { data: events } = await supabase
      .from('system_events')
      .select('event_type, created_at')
      .or(`event_data->>decision_id.eq.${latestPermit.decision_id},event_data->>permit_id.eq.${latestPermit.permit_id},event_data->>tweet_id.eq.${latestPermit.actual_tweet_id}`)
      .order('created_at', { ascending: false })
      .limit(10);
    
    results.trace_chain.events = events?.map(e => e.event_type) || [];
    
    console.log(`Latest posted reply: ${latestPermit.actual_tweet_id}`);
    console.log(`  Permit ID: ${latestPermit.permit_id}`);
    console.log(`  Decision ID: ${latestPermit.decision_id}`);
    console.log(`  Pipeline Source: ${latestPermit.pipeline_source}`);
    console.log(`  Target is Root: ${latestPermit.target_is_root}`);
    console.log(`  Reason Code: ${latestPermit.reason_code || 'NULL'}`);
    console.log(`  Events: ${results.trace_chain.events.join(', ')}`);
  } else {
    results.trace_chain = null;
    console.log('No posted replies found in last 30 minutes');
  }
  
  console.log('');
  
  // PHASE 7: Ghost reconciliation
  console.log('PHASE 7: Ghost Reconciliation');
  console.log('-'.repeat(40));
  
  const { count: ghostTweets } = await supabase
    .from('ghost_tweets')
    .select('*', { count: 'exact', head: true })
    .gte('detected_at', twoHoursAgo);
  
  const { data: recentGhosts } = await supabase
    .from('ghost_tweets')
    .select('tweet_id, detected_at, reason')
    .gte('detected_at', twoHoursAgo)
    .order('detected_at', { ascending: false })
    .limit(10);
  
  results.ghosts = {
    count: ghostTweets || 0,
    recent: recentGhosts || [],
    pass: (ghostTweets || 0) === 0,
  };
  
  console.log(`Ghosts detected (last 2h): ${results.ghosts.count}`);
  if (recentGhosts && recentGhosts.length > 0) {
    console.log('Recent ghosts:');
    recentGhosts.forEach(g => {
      console.log(`  ${g.tweet_id} (${g.detected_at}): ${g.reason}`);
    });
  }
  console.log(`Status: ${results.ghosts.pass ? '✅ PASS' : '❌ FAIL'}\n`);
  
  // Summary
  console.log('========================================');
  console.log('SUMMARY');
  console.log('========================================\n');
  
  const allPassed = 
    results.migration_applied &&
    results.schema_verified &&
    results.fetch.pass &&
    results.queue.pass &&
    results.scheduler.pass &&
    results.permits.pass &&
    results.ghosts.pass &&
    results.trace_chain !== null;
  
  console.log(`Migration Applied: ${results.migration_applied ? '✅' : '❌'}`);
  console.log(`Schema Verified: ${results.schema_verified ? '✅' : '❌'}`);
  console.log(`Fetch: ${results.fetch.pass ? '✅' : '❌'} (${results.fetch.started} started, ${results.fetch.completed} completed)`);
  console.log(`Queue: ${results.queue.pass ? '✅' : '❌'} (${results.queue.size} queued)`);
  console.log(`Scheduler: ${results.scheduler.pass ? '✅' : '❌'} (${results.scheduler.started} started, ${results.scheduler.slo_events} SLO events)`);
  console.log(`Permits: ${results.permits.pass ? '✅' : '❌'} (${results.permits.created} created, ${results.permits.used} used)`);
  console.log(`Trace Chain: ${results.trace_chain ? '✅' : '❌'}`);
  console.log(`Ghosts: ${results.ghosts.pass ? '✅' : '❌'} (${results.ghosts.count} detected)`);
  
  console.log(`\n${allPassed ? '✅ OPERATIONAL' : '❌ NOT OPERATIONAL'}`);
  
  if (!allPassed) {
    const blockers: string[] = [];
    if (!results.migration_applied) blockers.push('Migration not applied');
    if (!results.schema_verified) blockers.push('Schema not verified');
    if (!results.fetch.pass) blockers.push(`Fetch incomplete (${results.fetch.started} started, ${results.fetch.completed} completed)`);
    if (!results.queue.pass) blockers.push(`Queue low (${results.queue.size} queued)`);
    if (!results.scheduler.pass) blockers.push(`Scheduler low (${results.scheduler.started} started)`);
    if (!results.permits.pass) blockers.push(`Permits low (${results.permits.created} created)`);
    if (!results.trace_chain) blockers.push('No posted replies found');
    if (!results.ghosts.pass) blockers.push(`${results.ghosts.count} ghosts detected`);
    
    console.log(`\nBlocking reasons: ${blockers.join(', ')}`);
  }
  
  return results;
}

productionProof().then(results => {
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

