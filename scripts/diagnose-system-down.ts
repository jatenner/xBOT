/**
 * 🔍 COMPREHENSIVE SYSTEM DIAGNOSTIC
 * Identifies why posting/replies are down
 */

import { getConfig, getModeFlags } from '../src/config/config';
import { getSupabaseClient } from '../src/db/index';
import { getCircuitBreakerStatus } from '../src/jobs/postingQueue';

async function diagnoseSystem() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('🔍 xBOT SYSTEM DIAGNOSTIC REPORT');
  console.log('═══════════════════════════════════════════════════════\n');

  // 1. Check Configuration
  console.log('📋 1. CONFIGURATION CHECK');
  console.log('─────────────────────────────────────────────────────');
  try {
    const config = getConfig();
    const flags = getModeFlags(config);
    
    console.log(`   MODE: ${config.MODE}`);
    console.log(`   Posting Disabled: ${flags.postingDisabled}`);
    console.log(`   Dry Run: ${flags.dryRun}`);
    console.log(`   Jobs Autostart: ${config.JOBS_AUTOSTART}`);
    console.log(`   Plan Interval: ${config.JOBS_PLAN_INTERVAL_MIN} min`);
    console.log(`   Posting Interval: ${config.JOBS_POSTING_INTERVAL_MIN} min`);
    console.log(`   Max Posts/Hour: ${config.MAX_POSTS_PER_HOUR}`);
    
    // Check environment variables
    console.log('\n   Environment Variables:');
    console.log(`   MODE: ${process.env.MODE || 'NOT SET (defaults to live)'}`);
    console.log(`   POSTING_DISABLED: ${process.env.POSTING_DISABLED || 'NOT SET'}`);
    console.log(`   DRY_RUN: ${process.env.DRY_RUN || 'NOT SET'}`);
    console.log(`   DISABLE_POSTING: ${process.env.DISABLE_POSTING || 'NOT SET'}`);
    console.log(`   LIVE_POSTS: ${process.env.LIVE_POSTS || 'NOT SET'}`);
    
    if (flags.postingDisabled) {
      console.log('\n   ⚠️  POSTING IS DISABLED!');
      if (config.MODE === 'shadow') {
        console.log('   Reason: MODE=shadow disables posting');
      }
      if (process.env.POSTING_DISABLED === 'true') {
        console.log('   Reason: POSTING_DISABLED=true');
      }
      if (process.env.DRY_RUN === 'true') {
        console.log('   Reason: DRY_RUN=true');
      }
      if (process.env.DISABLE_POSTING === 'true') {
        console.log('   Reason: DISABLE_POSTING=true');
      }
    }
  } catch (error: any) {
    console.error(`   ❌ Config check failed: ${error.message}`);
  }

  // 2. Check Circuit Breaker
  console.log('\n📊 2. CIRCUIT BREAKER STATUS');
  console.log('─────────────────────────────────────────────────────');
  try {
    const cbStatus = getCircuitBreakerStatus();
    console.log(`   State: ${cbStatus.state}`);
    console.log(`   Failures: ${cbStatus.failures}/${cbStatus.threshold}`);
    console.log(`   Last Failure: ${cbStatus.lastFailure?.toISOString() || 'None'}`);
    
    if (cbStatus.state === 'open') {
      console.log('\n   ⚠️  CIRCUIT BREAKER IS OPEN - Posting blocked!');
      const timeSinceFailure = cbStatus.lastFailure 
        ? Date.now() - cbStatus.lastFailure.getTime() 
        : 0;
      console.log(`   Time since failure: ${Math.round(timeSinceFailure / 1000)}s`);
    }
  } catch (error: any) {
    console.error(`   ❌ Circuit breaker check failed: ${error.message}`);
  }

  // 3. Check Database - Content Queue
  console.log('\n💾 3. DATABASE CONTENT QUEUE');
  console.log('─────────────────────────────────────────────────────');
  try {
    const supabase = getSupabaseClient();
    
    // Check queued content
    const { data: queued, error: queuedError } = await supabase
      .from('content_metadata')
      .select('decision_id, decision_type, status, created_at, scheduled_at')
      .eq('status', 'queued')
      .order('scheduled_at', { ascending: true })
      .limit(10);
    
    if (queuedError) {
      console.error(`   ❌ Query failed: ${queuedError.message}`);
    } else {
      console.log(`   Queued Content: ${queued?.length || 0} items`);
      if (queued && queued.length > 0) {
        console.log('   Next 5 items:');
        queued.slice(0, 5).forEach((item: any, i: number) => {
          const scheduled = item.scheduled_at ? new Date(item.scheduled_at) : null;
          const isReady = scheduled ? scheduled <= new Date() : false;
          console.log(`     ${i + 1}. ${item.decision_type} ${item.decision_id.substring(0, 8)}... (${isReady ? 'READY' : `scheduled ${scheduled?.toISOString()}`})`);
        });
      }
    }
    
    // Check posting status
    const { data: posting, error: postingError } = await supabase
      .from('content_metadata')
      .select('decision_id, decision_type, created_at')
      .eq('status', 'posting')
      .limit(5);
    
    if (!postingError && posting && posting.length > 0) {
      console.log(`\n   ⚠️  Stuck in 'posting' status: ${posting.length} items`);
      posting.forEach((item: any) => {
        const age = Math.round((Date.now() - new Date(item.created_at).getTime()) / (1000 * 60));
        console.log(`     - ${item.decision_type} ${item.decision_id.substring(0, 8)}... (stuck ${age}min)`);
      });
    }
    
    // Check recent posts
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentPosts, error: recentError } = await supabase
      .from('content_metadata')
      .select('decision_id, decision_type, posted_at, status')
      .eq('status', 'posted')
      .gte('posted_at', oneDayAgo)
      .order('posted_at', { ascending: false })
      .limit(10);
    
    if (!recentError) {
      console.log(`\n   Recent Posts (24h): ${recentPosts?.length || 0}`);
      if (recentPosts && recentPosts.length > 0) {
        const latest = recentPosts[0];
        const latestTime = new Date(latest.posted_at);
        const hoursAgo = Math.round((Date.now() - latestTime.getTime()) / (1000 * 60 * 60));
        console.log(`   Last post: ${hoursAgo}h ago (${latestTime.toISOString()})`);
      } else {
        console.log('   ⚠️  NO POSTS IN LAST 24 HOURS!');
      }
    }
    
    // Check recent replies
    const { data: recentReplies, error: replyError } = await supabase
      .from('content_metadata')
      .select('decision_id, posted_at')
      .eq('decision_type', 'reply')
      .eq('status', 'posted')
      .gte('posted_at', oneDayAgo)
      .order('posted_at', { ascending: false })
      .limit(10);
    
    if (!replyError) {
      console.log(`\n   Recent Replies (24h): ${recentReplies?.length || 0}`);
      if (recentReplies && recentReplies.length > 0) {
        const latest = recentReplies[0];
        const latestTime = new Date(latest.posted_at);
        const hoursAgo = Math.round((Date.now() - latestTime.getTime()) / (1000 * 60 * 60));
        console.log(`   Last reply: ${hoursAgo}h ago (${latestTime.toISOString()})`);
      } else {
        console.log('   ⚠️  NO REPLIES IN LAST 24 HOURS!');
      }
    }
  } catch (error: any) {
    console.error(`   ❌ Database check failed: ${error.message}`);
  }

  // 4. Check Job Heartbeats
  console.log('\n🕒 4. JOB HEARTBEATS');
  console.log('─────────────────────────────────────────────────────');
  try {
    const supabase = getSupabaseClient();
    const { data: heartbeats, error } = await supabase
      .from('job_heartbeats')
      .select('*')
      .in('job_name', ['plan', 'posting', 'reply_posting'])
      .order('updated_at', { ascending: false });
    
    if (error) {
      console.error(`   ❌ Query failed: ${error.message}`);
    } else if (heartbeats && heartbeats.length > 0) {
      heartbeats.forEach((hb: any) => {
        const lastRun = hb.last_run_at ? new Date(hb.last_run_at) : null;
        const age = lastRun ? Math.round((Date.now() - lastRun.getTime()) / (1000 * 60)) : null;
        console.log(`   ${hb.job_name}:`);
        console.log(`     Status: ${hb.last_run_status || 'unknown'}`);
        console.log(`     Last Run: ${age !== null ? `${age}min ago` : 'never'}`);
        if (hb.last_error) {
          console.log(`     Error: ${hb.last_error.substring(0, 100)}...`);
        }
        if (hb.consecutive_failures > 0) {
          console.log(`     ⚠️  Consecutive Failures: ${hb.consecutive_failures}`);
        }
      });
    } else {
      console.log('   ⚠️  No job heartbeats found');
    }
  } catch (error: any) {
    console.error(`   ❌ Heartbeat check failed: ${error.message}`);
  }

  // 5. Check System Events
  console.log('\n📢 5. RECENT SYSTEM EVENTS');
  console.log('─────────────────────────────────────────────────────');
  try {
    const supabase = getSupabaseClient();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: events, error } = await supabase
      .from('system_events')
      .select('*')
      .gte('created_at', oneDayAgo)
      .in('severity', ['critical', 'error'])
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) {
      console.error(`   ❌ Query failed: ${error.message}`);
    } else if (events && events.length > 0) {
      console.log(`   Found ${events.length} critical/error events in last 24h:`);
      events.forEach((event: any) => {
        const time = new Date(event.created_at);
        const hoursAgo = Math.round((Date.now() - time.getTime()) / (1000 * 60 * 60));
        console.log(`     [${hoursAgo}h ago] ${event.severity.toUpperCase()}: ${event.event_type}`);
        if (event.event_data) {
          console.log(`       Data: ${JSON.stringify(event.event_data).substring(0, 100)}...`);
        }
      });
    } else {
      console.log('   ✅ No critical events in last 24h');
    }
  } catch (error: any) {
    console.error(`   ❌ Events check failed: ${error.message}`);
  }

  // 6. Summary & Recommendations
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('📋 DIAGNOSTIC SUMMARY');
  console.log('═══════════════════════════════════════════════════════\n');
  
  const config = getConfig();
  const flags = getModeFlags(config);
  
  if (flags.postingDisabled) {
    console.log('🚨 PRIMARY ISSUE: Posting is DISABLED');
    console.log('\n   To enable posting:');
    if (config.MODE === 'shadow') {
      console.log('   1. Set MODE=live in Railway environment variables');
    }
    if (process.env.POSTING_DISABLED === 'true') {
      console.log('   1. Remove POSTING_DISABLED or set POSTING_DISABLED=false');
    }
    if (process.env.DRY_RUN === 'true') {
      console.log('   1. Remove DRY_RUN or set DRY_RUN=false');
    }
    if (process.env.DISABLE_POSTING === 'true') {
      console.log('   1. Remove DISABLE_POSTING or set DISABLE_POSTING=false');
    }
    console.log('   2. Restart Railway service');
  } else {
    console.log('✅ Posting is ENABLED in configuration');
    console.log('   Check circuit breaker and database queue above');
  }
  
  console.log('\n═══════════════════════════════════════════════════════');
}

diagnoseSystem().catch(console.error);



