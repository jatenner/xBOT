/**
 * Quick System Diagnosis
 * Check what's blocking posts and replies
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function diagnose() {
  console.log('\n🔍 SYSTEM DIAGNOSIS\n');
  const supabase = getSupabaseClient();
  
  // 1. Check if app is even running (recent decisions created)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('1️⃣  APP STATUS (last 30min)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  
  const { data: recentDecisions, error: recentError } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, status, created_at')
    .gte('created_at', thirtyMinAgo)
    .order('created_at', { ascending: false });
  
  if (recentError) {
    console.log(`❌ Query failed: ${recentError.message}`);
  } else if (!recentDecisions || recentDecisions.length === 0) {
    console.log('🚨 CRITICAL: No decisions created in last 30min');
    console.log('   → planJob is NOT running');
    console.log('   → Check if Railway deployment succeeded');
    console.log('   → Check if app crashed on startup');
  } else {
    console.log(`✅ App is running: ${recentDecisions.length} decisions created in last 30min`);
    const byStatus = recentDecisions.reduce((acc: any, d) => {
      acc[d.status] = (acc[d.status] || 0) + 1;
      return acc;
    }, {});
    console.log(`   Status breakdown: ${JSON.stringify(byStatus)}`);
  }
  
  // 2. Check queue status
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('2️⃣  QUEUE STATUS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const { data: queued, error: queueError } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, status, scheduled_at')
    .in('status', ['queued', 'ready'])
    .order('scheduled_at', { ascending: true })
    .limit(10);
  
  if (queueError) {
    console.log(`❌ Query failed: ${queueError.message}`);
  } else if (!queued || queued.length === 0) {
    console.log('⚠️  Queue is empty');
    console.log('   → planJob should be generating content');
  } else {
    console.log(`✅ Queue has ${queued.length} items`);
    const nextScheduled = queued[0]?.scheduled_at;
    if (nextScheduled) {
      const scheduledTime = new Date(nextScheduled);
      const now = new Date();
      const diffMin = Math.round((scheduledTime.getTime() - now.getTime()) / (1000 * 60));
      
      if (diffMin < 0) {
        console.log(`🚨 CRITICAL: ${Math.abs(diffMin)}min OVERDUE for posting!`);
        console.log('   → postingQueue is NOT processing');
        console.log('   → Check if browser pool is stuck');
      } else {
        console.log(`   Next post in ${diffMin}min at ${scheduledTime.toISOString()}`);
      }
    }
    
    console.log('\n   Queue items:');
    queued.forEach((item, i) => {
      const sched = new Date(item.scheduled_at);
      const minUntil = Math.round((sched.getTime() - Date.now()) / (1000 * 60));
      console.log(`   ${i + 1}. ${item.decision_type} - ${item.status} - in ${minUntil}min`);
    });
  }
  
  // 3. Check last successful post
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('3️⃣  LAST SUCCESSFUL POST');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const { data: lastPost, error: lastError } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, posted_at, tweet_id')
    .eq('status', 'posted')
    .order('posted_at', { ascending: false })
    .limit(1);
  
  if (lastError) {
    console.log(`❌ Query failed: ${lastError.message}`);
  } else if (!lastPost || lastPost.length === 0) {
    console.log('⚠️  No posts found');
  } else {
    const lastPostedAt = new Date(lastPost[0].posted_at);
    const hoursAgo = ((Date.now() - lastPostedAt.getTime()) / (1000 * 60 * 60)).toFixed(1);
    console.log(`Last post: ${hoursAgo}h ago`);
    console.log(`   Type: ${lastPost[0].decision_type}`);
    console.log(`   Tweet ID: ${lastPost[0].tweet_id}`);
    
    if (parseFloat(hoursAgo) > 1) {
      console.log(`   🚨 CRITICAL: ${hoursAgo}h since last post (should be <0.5h)`);
    }
  }
  
  // 4. Check recent failures
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('4️⃣  RECENT FAILURES (Last 1h)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  const { data: failures, error: failError } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, status, error_reason, updated_at')
    .in('status', ['failed', 'failed_permanent', 'retrying'])
    .gte('updated_at', oneHourAgo)
    .order('updated_at', { ascending: false })
    .limit(5);
  
  if (failError) {
    console.log(`❌ Query failed: ${failError.message}`);
  } else if (!failures || failures.length === 0) {
    console.log('✅ No failures in last hour');
  } else {
    console.log(`⚠️  ${failures.length} failures in last hour:`);
    failures.forEach((f, i) => {
      const minAgo = Math.round((Date.now() - new Date(f.updated_at).getTime()) / (1000 * 60));
      console.log(`   ${i + 1}. ${f.decision_type} - ${f.status} (${minAgo}min ago)`);
      if (f.error_reason) {
        console.log(`      Reason: ${f.error_reason.substring(0, 100)}...`);
      }
    });
  }
  
  // 5. Check reply opportunities
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('5️⃣  REPLY OPPORTUNITIES');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  const { count: oppCount, error: oppError } = await supabase
    .from('reply_opportunities')
    .select('*', { count: 'exact', head: true })
    .gte('tweet_posted_at', twentyFourHoursAgo);
  
  if (oppError) {
    console.log(`❌ Query failed: ${oppError.message}`);
  } else {
    const poolSize = oppCount || 0;
    console.log(`Pool size: ${poolSize} opportunities (<24h old)`);
    
    if (poolSize < 50) {
      console.log('   🚨 CRITICAL: Pool too low (<50)');
      console.log('   → Harvester may not be running');
    } else if (poolSize < 150) {
      console.log('   ⚠️  Pool below target (<150)');
    } else {
      console.log('   ✅ Pool healthy (>150)');
    }
  }
  
  // 6. Check system events (if table exists)
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('6️⃣  SYSTEM EVENTS (Last 30min)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const { data: events, error: eventsError } = await supabase
    .from('system_events')
    .select('event_type, severity, message, created_at')
    .gte('created_at', thirtyMinAgo)
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (eventsError && !eventsError.message.includes('does not exist')) {
    console.log(`❌ Query failed: ${eventsError.message}`);
  } else if (!events || events.length === 0) {
    console.log('ℹ️  No system events in last 30min (or table does not exist)');
  } else {
    console.log(`Found ${events.length} events:`);
    events.forEach((e, i) => {
      const minAgo = Math.round((Date.now() - new Date(e.created_at).getTime()) / (1000 * 60));
      const emoji = e.severity === 'error' ? '❌' : e.severity === 'warning' ? '⚠️' : 'ℹ️';
      console.log(`   ${i + 1}. ${emoji} ${e.event_type} (${minAgo}min ago)`);
      console.log(`      ${e.message.substring(0, 100)}${e.message.length > 100 ? '...' : ''}`);
    });
  }
  
  // Final verdict
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 DIAGNOSIS SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  if (!recentDecisions || recentDecisions.length === 0) {
    console.log('🚨 PRIMARY ISSUE: App not generating content');
    console.log('   Possible causes:');
    console.log('   1. Railway deployment failed');
    console.log('   2. App crashed on startup (check build logs)');
    console.log('   3. jobManager not starting');
    console.log('\n   Next steps:');
    console.log('   → Check Railway build logs');
    console.log('   → Check Railway deploy logs for startup errors');
    console.log('   → Verify all migrations applied successfully');
  } else if (queued && queued.length > 0 && queued[0]?.scheduled_at) {
    const nextTime = new Date(queued[0].scheduled_at);
    const diffMin = Math.round((nextTime.getTime() - Date.now()) / (1000 * 60));
    
    if (diffMin < -5) {
      console.log('🚨 PRIMARY ISSUE: postingQueue not processing overdue items');
      console.log('   Possible causes:');
      console.log('   1. Browser pool stuck/crashed');
      console.log('   2. Playwright auth session expired');
      console.log('   3. postingQueue job not running');
      console.log('\n   Next steps:');
      console.log('   → Check Railway logs for browser errors');
      console.log('   → Check if TWITTER_SESSION_B64 is valid');
      console.log('   → Restart service to reset browser pool');
    } else {
      console.log(`✅ System appears healthy - next post in ${diffMin}min`);
      console.log('   Just needs to reach scheduled time');
    }
  } else {
    console.log('⚠️  Queue empty but app generating content');
    console.log('   → System may be between cycles');
    console.log('   → Wait 5-10 minutes and re-check');
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

diagnose().catch(error => {
  console.error('\n❌ Diagnosis failed:', error.message);
  process.exit(1);
});

