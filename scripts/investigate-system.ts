/**
 * 🔍 SYSTEM INVESTIGATION SCRIPT
 * Performs all checks from SYSTEM_INVESTIGATION_DEC_2025.md
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';
import { getConfig, getModeFlags } from '../src/config/config';
import { ENV } from '../src/config/env';

async function checkDatabaseState() {
  console.log('\n📊 CHECKING DATABASE STATE...\n');
  const supabase = getSupabaseClient();

  // Check last post/reply
  console.log('1. Last Posts/Replies:');
  const { data: lastActivity, error: lastError } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, status, posted_at, created_at, content')
    .in('decision_type', ['single', 'thread', 'reply'])
    .order('created_at', { ascending: false })
    .limit(10);

  if (lastError) {
    console.error('   ❌ Error:', lastError.message);
  } else if (lastActivity && lastActivity.length > 0) {
    lastActivity.forEach((item, idx) => {
      const timestamp = item.posted_at || item.created_at;
      const hoursAgo = timestamp 
        ? Math.round((Date.now() - new Date(timestamp).getTime()) / (1000 * 60 * 60))
        : 'unknown';
      console.log(`   ${idx + 1}. ${item.decision_type} | ${item.status} | ${hoursAgo}h ago | ${item.content?.substring(0, 50)}...`);
    });
  } else {
    console.log('   ⚠️ No posts/replies found in database');
  }

  // Check queued content
  console.log('\n2. Queued Content:');
  const { data: queued, error: queuedError } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, status, scheduled_at, created_at')
    .eq('status', 'queued')
    .order('created_at', { ascending: false })
    .limit(20);

  if (queuedError) {
    console.error('   ❌ Error:', queuedError.message);
  } else {
    const byType = queued?.reduce((acc: any, item) => {
      acc[item.decision_type] = (acc[item.decision_type] || 0) + 1;
      return acc;
    }, {}) || {};
    console.log(`   Total queued: ${queued?.length || 0}`);
    console.log(`   By type:`, byType);
    if (queued && queued.length > 0) {
      console.log(`   Oldest queued: ${queued[queued.length - 1].created_at}`);
      console.log(`   Newest queued: ${queued[0].created_at}`);
    }
  }

  // Check opportunity pool
  console.log('\n3. Reply Opportunity Pool:');
  const { count: oppCount, error: oppError } = await supabase
    .from('reply_opportunities')
    .select('*', { count: 'exact', head: true })
    .gte('tweet_posted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  if (oppError) {
    console.error('   ❌ Error:', oppError.message);
  } else {
    console.log(`   Opportunities (<24h old): ${oppCount || 0}`);
  }

  // Check discovered accounts
  console.log('\n4. Discovered Accounts:');
  const { count: accountCount, error: accountError } = await supabase
    .from('discovered_accounts')
    .select('*', { count: 'exact', head: true });

  if (accountError) {
    console.error('   ❌ Error:', accountError.message);
  } else {
    console.log(`   Total accounts: ${accountCount || 0}`);
  }

  // Check posts with NULL tweet_id (potential issues)
  console.log('\n5. Posts with NULL tweet_id (potential issues):');
  const { data: nullPosts, error: nullError } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, status, posted_at, created_at')
    .eq('status', 'posted')
    .is('tweet_id', null)
    .order('posted_at', { ascending: false })
    .limit(10);

  if (nullError) {
    console.error('   ❌ Error:', nullError.message);
  } else if (nullPosts && nullPosts.length > 0) {
    console.log(`   ⚠️ Found ${nullPosts.length} posts with NULL tweet_id`);
    nullPosts.forEach((item, idx) => {
      const hoursAgo = item.posted_at 
        ? Math.round((Date.now() - new Date(item.posted_at).getTime()) / (1000 * 60 * 60))
        : 'unknown';
      console.log(`   ${idx + 1}. ${item.decision_type} | posted ${hoursAgo}h ago`);
    });
  } else {
    console.log('   ✅ No posts with NULL tweet_id');
  }

  // Check stuck posts (status='posting' >15min)
  console.log('\n6. Stuck Posts (status=posting >15min):');
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
  const { data: stuckPosts, error: stuckError } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, status, created_at')
    .eq('status', 'posting')
    .lt('created_at', fifteenMinAgo.toISOString())
    .limit(10);

  if (stuckError) {
    console.error('   ❌ Error:', stuckError.message);
  } else if (stuckPosts && stuckPosts.length > 0) {
    console.log(`   ⚠️ Found ${stuckPosts.length} stuck posts`);
    stuckPosts.forEach((item, idx) => {
      const minutesAgo = Math.round((Date.now() - new Date(item.created_at).getTime()) / (1000 * 60));
      console.log(`   ${idx + 1}. ${item.decision_type} | stuck ${minutesAgo}min`);
    });
  } else {
    console.log('   ✅ No stuck posts');
  }
}

async function checkEnvironmentVariables() {
  console.log('\n🔧 CHECKING ENVIRONMENT VARIABLES...\n');
  
  const config = getConfig();
  const flags = getModeFlags(config);

  console.log('1. Critical Flags:');
  console.log(`   POSTING_DISABLED: ${process.env.POSTING_DISABLED || 'NOT SET (OK)'}`);
  console.log(`   ENABLE_REPLIES: ${process.env.ENABLE_REPLIES || 'NOT SET (defaults to true)'}`);
  console.log(`   JOBS_PLAN_INTERVAL_MIN: ${config.JOBS_PLAN_INTERVAL_MIN || 'NOT SET'}`);
  console.log(`   OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? 'SET ✅' : 'NOT SET ❌'}`);
  
  console.log('\n2. Mode Flags:');
  console.log(`   postingEnabled: ${flags.postingEnabled}`);
  console.log(`   postingDisabled: ${flags.postingDisabled}`);
  console.log(`   replyEnabled: ${flags.replyEnabled}`);
  console.log(`   plannerEnabled: ${flags.plannerEnabled}`);
  
  console.log('\n3. Rate Limits:');
  console.log(`   MAX_POSTS_PER_HOUR: ${config.MAX_POSTS_PER_HOUR || 'NOT SET'}`);
  console.log(`   MAX_REPLIES_PER_HOUR: ${process.env.MAX_REPLIES_PER_HOUR || 'NOT SET'}`);
  console.log(`   MAX_REPLIES_PER_DAY: ${process.env.MAX_REPLIES_PER_DAY || 'NOT SET'}`);
  
  console.log('\n4. Job Intervals:');
  console.log(`   JOBS_PLAN_INTERVAL_MIN: ${config.JOBS_PLAN_INTERVAL_MIN || 'NOT SET'}`);
  console.log(`   JOBS_REPLY_INTERVAL_MIN: ${config.JOBS_REPLY_INTERVAL_MIN || 'NOT SET'}`);
  console.log(`   JOBS_LEARN_INTERVAL_MIN: ${config.JOBS_LEARN_INTERVAL_MIN || 'NOT SET'}`);
}

async function checkJobHeartbeats() {
  console.log('\n⏰ CHECKING JOB HEARTBEATS...\n');
  const supabase = getSupabaseClient();

  // Check job_heartbeats table if it exists
  const { data: heartbeats, error } = await supabase
    .from('job_heartbeats')
    .select('job_name, last_run_at, status, error_message')
    .order('last_run_at', { ascending: false })
    .limit(20);

  if (error) {
    if (error.code === '42P01') {
      console.log('   ℹ️ job_heartbeats table does not exist (this is OK)');
    } else {
      console.error('   ❌ Error:', error.message);
    }
  } else if (heartbeats && heartbeats.length > 0) {
    console.log('Recent Job Runs:');
    heartbeats.forEach((hb, idx) => {
      const hoursAgo = hb.last_run_at 
        ? Math.round((Date.now() - new Date(hb.last_run_at).getTime()) / (1000 * 60 * 60))
        : 'never';
      const status = hb.status === 'success' ? '✅' : hb.status === 'error' ? '❌' : '⚠️';
      console.log(`   ${idx + 1}. ${hb.job_name} | ${status} | ${hoursAgo}h ago`);
      if (hb.error_message) {
        console.log(`      Error: ${hb.error_message.substring(0, 100)}`);
      }
    });
  } else {
    console.log('   ⚠️ No job heartbeats found');
  }
}

async function checkSystemEvents() {
  console.log('\n📋 CHECKING SYSTEM EVENTS...\n');
  const supabase = getSupabaseClient();

  const { data: events, error } = await supabase
    .from('system_events')
    .select('event_type, severity, event_data, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    if (error.code === '42P01') {
      console.log('   ℹ️ system_events table does not exist (this is OK)');
    } else {
      console.error('   ❌ Error:', error.message);
    }
  } else if (events && events.length > 0) {
    console.log('Recent System Events:');
    events.forEach((event, idx) => {
      const hoursAgo = Math.round((Date.now() - new Date(event.created_at).getTime()) / (1000 * 60 * 60));
      const severity = event.severity === 'critical' ? '🔴' : event.severity === 'error' ? '❌' : '⚠️';
      console.log(`   ${idx + 1}. ${severity} ${event.event_type} | ${hoursAgo}h ago`);
      if (event.event_data && typeof event.event_data === 'object') {
        const data = event.event_data as any;
        if (data.error_message) {
          console.log(`      ${data.error_message.substring(0, 100)}`);
        }
      }
    });
  } else {
    console.log('   ✅ No recent system events');
  }
}

async function main() {
  console.log('🔍 SYSTEM INVESTIGATION - Running All Checks');
  console.log('='.repeat(60));
  console.log(`Started at: ${new Date().toISOString()}\n`);

  try {
    await checkEnvironmentVariables();
    await checkDatabaseState();
    await checkJobHeartbeats();
    await checkSystemEvents();

    console.log('\n' + '='.repeat(60));
    console.log('✅ Investigation complete');
    console.log('\n📝 Next Steps:');
    console.log('1. Review the findings above');
    console.log('2. Check Railway logs for job execution');
    console.log('3. Verify environment variables in Railway dashboard');
    console.log('4. Fix any issues identified');
  } catch (error: any) {
    console.error('\n❌ Investigation failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();

