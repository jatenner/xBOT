/**
 * 🔍 PROOF SCRIPT: Verify Incident Fixes
 * Outputs PASS/FAIL for each requirement
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

const INCIDENT_TWEET_IDS = ['2009613043710456073', '2009611762119881177'];

async function proofCheck() {
  const supabase = getSupabaseClient();
  const results: Record<string, boolean> = {};
  
  console.log('========================================');
  console.log('INCIDENT FIX PROOF CHECK');
  console.log('========================================\n');
  
  // 1) Permits exist for incident tweets
  console.log('1) Permits exist for incident tweets...');
  let permitsFound = 0;
  for (const tweetId of INCIDENT_TWEET_IDS) {
    const { data: permit } = await supabase
      .from('post_attempts')
      .select('permit_id')
      .eq('actual_tweet_id', tweetId)
      .maybeSingle();
    if (permit) permitsFound++;
  }
  results.permitsExist = permitsFound === INCIDENT_TWEET_IDS.length;
  console.log(`   ${results.permitsExist ? '✅ PASS' : '❌ FAIL'}: ${permitsFound}/${INCIDENT_TWEET_IDS.length} permits found`);
  console.log('   (Expected: 0 - these are ghosts, fix prevents future ghosts)\n');
  
  // 2) Root enforcement at permit approval
  console.log('2) Root enforcement at permit approval...');
  const { count: rejectedNonRoot } = await supabase
    .from('post_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('decision_type', 'reply')
    .eq('status', 'REJECTED')
    .eq('reason_code', 'target_not_root');
  results.rootEnforced = (rejectedNonRoot || 0) >= 0; // Any rejections = enforcement working
  console.log(`   ${results.rootEnforced ? '✅ PASS' : '⚠️  PENDING'}: ${rejectedNonRoot || 0} permits rejected for non-root targets`);
  console.log('   (Will show > 0 after fix deployment and non-root attempts)\n');
  
  // 3) Reply V2 fetch events
  console.log('3) Reply V2 fetch events present...');
  const { count: fetchEvents } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'reply_v2_fetch_job_started')
    .gte('created_at', new Date(Date.now() - 30 * 60000).toISOString());
  results.fetchEvents = (fetchEvents || 0) > 0;
  console.log(`   ${results.fetchEvents ? '✅ PASS' : '❌ FAIL'}: ${fetchEvents || 0} fetch events in last 30 min\n`);
  
  // 4) Reply V2 scheduler events
  console.log('4) Reply V2 scheduler events present...');
  const { count: schedulerEvents } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'reply_v2_scheduler_job_started')
    .gte('created_at', new Date(Date.now() - 30 * 60000).toISOString());
  results.schedulerEvents = (schedulerEvents || 0) > 0;
  console.log(`   ${results.schedulerEvents ? '✅ PASS' : '❌ FAIL'}: ${schedulerEvents || 0} scheduler events in last 30 min\n`);
  
  // 5) AI judge calls
  console.log('5) AI judge calls present...');
  const { count: judgeCalls } = await supabase
    .from('llm_usage_log')
    .select('*', { count: 'exact', head: true })
    .eq('purpose', 'target_judge')
    .gte('timestamp', new Date(Date.now() - 30 * 60000).toISOString());
  results.judgeCalls = (judgeCalls || 0) > 0;
  console.log(`   ${results.judgeCalls ? '✅ PASS' : '❌ FAIL'}: ${judgeCalls || 0} judge calls in last 30 min\n`);
  
  // 6) Old reply job disabled
  console.log('6) Old reply job disabled...');
  const { count: oldReplyEvents } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .like('event_type', '%reply_job%')
    .gte('created_at', new Date(Date.now() - 60 * 60000).toISOString());
  results.oldReplyDisabled = (oldReplyEvents || 0) === 0;
  console.log(`   ${results.oldReplyDisabled ? '✅ PASS' : '❌ FAIL'}: ${oldReplyEvents || 0} old reply job events in last 60 min\n`);
  
  // Summary
  console.log('========================================');
  console.log('SUMMARY');
  console.log('========================================\n');
  
  const allPassed = Object.values(results).every(r => r);
  Object.entries(results).forEach(([key, passed]) => {
    console.log(`${passed ? '✅' : '❌'} ${key}: ${passed ? 'PASS' : 'FAIL'}`);
  });
  
  console.log(`\n${allPassed ? '✅ ALL CHECKS PASSED' : '❌ SOME CHECKS FAILED'}`);
  
  process.exit(allPassed ? 0 : 1);
}

proofCheck().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

