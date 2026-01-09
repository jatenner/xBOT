/**
 * 🔍 VERIFY PRODUCTION PROOF
 * Provides DB proof that jobs are running
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function verifyProductionProof() {
  const supabase = getSupabaseClient();
  
  console.log('========================================');
  console.log('PRODUCTION PROOF VERIFICATION');
  console.log('========================================\n');
  console.log(`Verification Time: ${new Date().toISOString()}\n`);
  
  // 1) Fetch runs in last 10 minutes
  console.log('1) FETCH RUNS (Last 10 minutes)');
  console.log('---');
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  
  const { count: fetchStarted } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'reply_v2_fetch_job_started')
    .gte('created_at', tenMinutesAgo);
  
  const { count: fetchCompleted } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .like('event_type', '%reply_v2_fetch%completed%')
    .gte('created_at', tenMinutesAgo);
  
  const { data: recentFetches } = await supabase
    .from('system_events')
    .select('created_at, event_type, message')
    .eq('event_type', 'reply_v2_fetch_job_started')
    .gte('created_at', tenMinutesAgo)
    .order('created_at', { ascending: false })
    .limit(5);
  
  console.log(`Started: ${fetchStarted || 0}`);
  console.log(`Completed: ${fetchCompleted || 0}`);
  
  if (recentFetches && recentFetches.length > 0) {
    console.log('\nRecent fetch runs:');
    recentFetches.forEach((event, i) => {
      console.log(`  ${i + 1}. ${event.created_at}: ${event.event_type}`);
    });
  }
  
  if ((fetchStarted || 0) > 0) {
    console.log('\n✅ PROOF: Fetch is running!');
  } else {
    console.log('\n❌ PROOF: Fetch NOT running (0 starts in last 10 min)');
  }
  
  // 2) Scheduler activity in last 30 minutes
  console.log('\n2) SCHEDULER ACTIVITY (Last 30 minutes)');
  console.log('---');
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  
  const { count: schedulerEvents } = await supabase
    .from('reply_slo_events')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', thirtyMinutesAgo);
  
  const { data: recentScheduler } = await supabase
    .from('reply_slo_events')
    .select('created_at, event_type')
    .gte('created_at', thirtyMinutesAgo)
    .order('created_at', { ascending: false })
    .limit(5);
  
  console.log(`SLO Events: ${schedulerEvents || 0}`);
  
  if (recentScheduler && recentScheduler.length > 0) {
    console.log('\nRecent scheduler events:');
    recentScheduler.forEach((event, i) => {
      console.log(`  ${i + 1}. ${event.created_at}: ${(event as any).event_type || 'unknown'}`);
    });
  }
  
  if ((schedulerEvents || 0) > 0) {
    console.log('\n✅ PROOF: Scheduler is active!');
  } else {
    console.log('\n⚠️  PROOF: No scheduler activity (may need more time - runs every 15 min)');
  }
  
  // Summary
  console.log('\n=== PROOF SUMMARY ===');
  const fetchProof = (fetchStarted || 0) > 0;
  const schedulerProof = (schedulerEvents || 0) > 0;
  
  if (fetchProof) {
    console.log('✅ Fetch running: PROVEN');
  } else {
    console.log('❌ Fetch running: NOT PROVEN');
    console.log('   Check Railway logs for:');
    console.log('   - "[BOOT] JOBS_AUTOSTART env var: ..."');
    console.log('   - "🕒 JOB_MANAGER: startJobs() called"');
    console.log('   - "🕒 JOB_MANAGER: Job scheduling ENABLED"');
  }
  
  if (schedulerProof) {
    console.log('✅ Scheduler active: PROVEN');
  } else {
    console.log('⚠️  Scheduler active: Not yet proven (may need more time)');
  }
}

verifyProductionProof().catch(console.error);

