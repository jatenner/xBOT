/**
 * 🔍 PROOF SCRIPT: Verify Scheduler is Live
 * Outputs PASS/FAIL for each requirement
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function proveScheduler() {
  const supabase = getSupabaseClient();
  const results: Record<string, boolean> = {};
  
  console.log('========================================');
  console.log('SCHEDULER LIVE PROOF CHECK');
  console.log('========================================\n');
  
  const thirtyMinAgo = new Date(Date.now() - 30 * 60000).toISOString();
  
  // 1) Scheduler started events
  console.log('1) reply_v2_scheduler_job_started events...');
  const { count: schedulerStarted } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'reply_v2_scheduler_job_started')
    .gte('created_at', thirtyMinAgo);
  results.schedulerStarted = (schedulerStarted || 0) > 0;
  console.log(`   ${results.schedulerStarted ? '✅ PASS' : '❌ FAIL'}: ${schedulerStarted || 0} events in last 30 min\n`);
  
  // 2) SLO events
  console.log('2) reply_slo_events...');
  const { count: sloEvents } = await supabase
    .from('reply_slo_events')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', thirtyMinAgo);
  results.sloEvents = (sloEvents || 0) > 0;
  console.log(`   ${results.sloEvents ? '✅ PASS' : '❌ FAIL'}: ${sloEvents || 0} events in last 30 min\n`);
  
  // 3) Permits created
  console.log('3) post_attempts (permits) created...');
  const { count: permitsCreated } = await supabase
    .from('post_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('decision_type', 'reply')
    .eq('pipeline_source', 'reply_v2_scheduler')
    .gte('created_at', thirtyMinAgo);
  results.permitsCreated = (permitsCreated || 0) > 0;
  console.log(`   ${results.permitsCreated ? '✅ PASS' : '❌ FAIL'}: ${permitsCreated || 0} permits created in last 30 min\n`);
  
  // 4) At least one permit reaches USED with posted_tweet_id
  console.log('4) Permits marked USED with posted_tweet_id...');
  const { count: permitsUsed } = await supabase
    .from('post_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('decision_type', 'reply')
    .eq('pipeline_source', 'reply_v2_scheduler')
    .eq('status', 'USED')
    .not('actual_tweet_id', 'is', null)
    .gte('created_at', thirtyMinAgo);
  results.permitsUsed = (permitsUsed || 0) > 0;
  console.log(`   ${results.permitsUsed ? '✅ PASS' : '❌ FAIL'}: ${permitsUsed || 0} permits USED with tweet_id in last 30 min\n`);
  
  // 5) AI judge calls
  console.log('5) AI judge calls (target_judge)...');
  const { count: judgeCalls } = await supabase
    .from('llm_usage_log')
    .select('*', { count: 'exact', head: true })
    .eq('purpose', 'target_judge')
    .gte('timestamp', thirtyMinAgo);
  results.judgeCalls = (judgeCalls || 0) > 0;
  console.log(`   ${results.judgeCalls ? '✅ PASS' : '❌ FAIL'}: ${judgeCalls || 0} judge calls in last 30 min\n`);
  
  // Summary
  console.log('========================================');
  console.log('SUMMARY');
  console.log('========================================\n');
  
  const allPassed = Object.values(results).every(r => r);
  Object.entries(results).forEach(([key, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${key}: ${passed ? 'PASS' : 'FAIL'}`);
  });
  
  console.log(`\n${allPassed ? '✅ ALL CHECKS PASSED' : '❌ SOME CHECKS FAILED'}`);
  
  // Show latest scheduler event details
  const { data: latestScheduler } = await supabase
    .from('system_events')
    .select('*')
    .eq('event_type', 'reply_v2_scheduler_job_started')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (latestScheduler) {
    console.log(`\n📊 Latest scheduler event: ${latestScheduler.created_at}`);
    console.log(`   Message: ${latestScheduler.message}`);
  } else {
    console.log('\n⚠️  No scheduler events found');
  }
  
  process.exit(allPassed ? 0 : 1);
}

proveScheduler().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

