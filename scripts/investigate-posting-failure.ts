/**
 * 🔍 COMPREHENSIVE POSTING FAILURE INVESTIGATION
 * Checks all systems to find why posting stopped
 */

import dotenv from 'dotenv';
dotenv.config();

import { getSupabaseClient } from '../src/db/index';

async function investigatePostingFailure() {
  console.log('════════════════════════════════════════════════════════════');
  console.log('🔍 POSTING FAILURE INVESTIGATION');
  console.log('════════════════════════════════════════════════════════════\n');
  
  const supabase = getSupabaseClient();
  const now = new Date();
  const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);
  
  // 1. CHECK RECENT POSTS
  console.log('1️⃣ CHECKING RECENT POSTS (last 12 hours)...');
  try {
    const { data: recentPosts, error: postsError } = await supabase
      .from('content_metadata')
      .select('decision_id, status, created_at, posted_at, decision_type, content')
      .gte('created_at', twelveHoursAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (postsError) {
      console.error('   ❌ Error querying posts:', postsError.message);
    } else {
      const posted = recentPosts?.filter(p => p.status === 'posted') || [];
      const queued = recentPosts?.filter(p => p.status === 'queued') || [];
      const posting = recentPosts?.filter(p => p.status === 'posting') || [];
      const failed = recentPosts?.filter(p => p.status === 'failed') || [];
      
      console.log(`   📊 Total posts created: ${recentPosts?.length || 0}`);
      console.log(`   ✅ Posted: ${posted.length}`);
      console.log(`   ⏳ Queued: ${queued.length}`);
      console.log(`   🔄 Posting (stuck?): ${posting.length}`);
      console.log(`   ❌ Failed: ${failed.length}`);
      
      if (posted.length > 0) {
        const lastPosted = new Date(String(posted[0].posted_at || posted[0].created_at));
        const hoursSince = (now.getTime() - lastPosted.getTime()) / (1000 * 60 * 60);
        console.log(`   ⏰ Last post: ${hoursSince.toFixed(1)}h ago`);
      } else {
        console.log('   🚨 NO POSTS IN LAST 12 HOURS!');
      }
      
      if (posting.length > 0) {
        console.log('\n   ⚠️ STUCK POSTS (status="posting"):');
        posting.forEach(p => {
          const stuckMinutes = Math.round((now.getTime() - new Date(String(p.created_at)).getTime()) / (1000 * 60));
          console.log(`      - ${p.decision_id} (stuck ${stuckMinutes}min)`);
        });
      }
      
      if (queued.length > 0) {
        console.log('\n   📋 QUEUED POSTS (ready to post):');
        queued.slice(0, 5).forEach(p => {
          const ageMinutes = Math.round((now.getTime() - new Date(String(p.created_at)).getTime()) / (1000 * 60));
          const content = String(p.content || '').substring(0, 50);
          console.log(`      - ${p.decision_id} (${ageMinutes}min old): "${content}..."`);
        });
      }
    }
  } catch (error: any) {
    console.error('   ❌ Exception:', error.message);
  }
  
  console.log('\n');
  
  // 2. CHECK JOB HEARTBEATS
  console.log('2️⃣ CHECKING JOB HEARTBEATS...');
  try {
    const { data: heartbeats, error: hbError } = await supabase
      .from('job_heartbeats')
      .select('*')
      .in('job_name', ['posting', 'plan', 'reply_posting'])
      .order('updated_at', { ascending: false });
    
    if (hbError) {
      console.error('   ❌ Error querying heartbeats:', hbError.message);
    } else {
      const postingHb = heartbeats?.find(h => h.job_name === 'posting');
      const planHb = heartbeats?.find(h => h.job_name === 'plan');
      const replyHb = heartbeats?.find(h => h.job_name === 'reply_posting');
      
      console.log('\n   📊 POSTING JOB:');
      if (postingHb) {
        const lastSuccess = postingHb.last_success ? new Date(String(postingHb.last_success)) : null;
        const lastFailure = postingHb.last_failure ? new Date(String(postingHb.last_failure)) : null;
        const consecutiveFailures = postingHb.consecutive_failures || 0;
        
        if (lastSuccess) {
          const hoursSince = (now.getTime() - lastSuccess.getTime()) / (1000 * 60 * 60);
          console.log(`      ✅ Last success: ${hoursSince.toFixed(1)}h ago`);
        } else {
          console.log('      🚨 NO SUCCESS RECORDED!');
        }
        
        if (lastFailure) {
          const hoursSince = (now.getTime() - lastFailure.getTime()) / (1000 * 60 * 60);
          console.log(`      ❌ Last failure: ${hoursSince.toFixed(1)}h ago`);
        }
        
        console.log(`      🔢 Consecutive failures: ${consecutiveFailures}`);
        console.log(`      📅 Updated: ${new Date(String(postingHb.updated_at)).toISOString()}`);
      } else {
        console.log('      🚨 NO HEARTBEAT RECORD FOUND!');
      }
      
      console.log('\n   📊 PLAN JOB:');
      if (planHb) {
        const lastSuccess = planHb.last_success ? new Date(String(planHb.last_success)) : null;
        const lastFailure = planHb.last_failure ? new Date(String(planHb.last_failure)) : null;
        const consecutiveFailures = planHb.consecutive_failures || 0;
        
        if (lastSuccess) {
          const hoursSince = (now.getTime() - lastSuccess.getTime()) / (1000 * 60 * 60);
          console.log(`      ✅ Last success: ${hoursSince.toFixed(1)}h ago`);
        } else {
          console.log('      🚨 NO SUCCESS RECORDED!');
        }
        
        if (lastFailure) {
          const hoursSince = (now.getTime() - lastFailure.getTime()) / (1000 * 60 * 60);
          console.log(`      ❌ Last failure: ${hoursSince.toFixed(1)}h ago`);
        }
        
        console.log(`      🔢 Consecutive failures: ${consecutiveFailures}`);
      } else {
        console.log('      🚨 NO HEARTBEAT RECORD FOUND!');
      }
      
      console.log('\n   📊 REPLY POSTING JOB:');
      if (replyHb) {
        const lastSuccess = replyHb.last_success ? new Date(String(replyHb.last_success)) : null;
        const lastFailure = replyHb.last_failure ? new Date(String(replyHb.last_failure)) : null;
        const consecutiveFailures = replyHb.consecutive_failures || 0;
        
        if (lastSuccess) {
          const hoursSince = (now.getTime() - lastSuccess.getTime()) / (1000 * 60 * 60);
          console.log(`      ✅ Last success: ${hoursSince.toFixed(1)}h ago`);
        } else {
          console.log('      🚨 NO SUCCESS RECORDED!');
        }
        
        if (lastFailure) {
          const hoursSince = (now.getTime() - lastFailure.getTime()) / (1000 * 60 * 60);
          console.log(`      ❌ Last failure: ${hoursSince.toFixed(1)}h ago`);
        }
        
        console.log(`      🔢 Consecutive failures: ${consecutiveFailures}`);
      } else {
        console.log('      ⚠️ No reply posting heartbeat (may be disabled)');
      }
    }
  } catch (error: any) {
    console.error('   ❌ Exception:', error.message);
  }
  
  console.log('\n');
  
  // 3. CHECK SYSTEM EVENTS (ERRORS)
  console.log('3️⃣ CHECKING RECENT ERRORS (system_events)...');
  try {
    const { data: events, error: eventsError } = await supabase
      .from('system_events')
      .select('*')
      .gte('created_at', twelveHoursAgo.toISOString())
      .in('severity', ['error', 'critical'])
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (eventsError) {
      console.error('   ❌ Error querying events:', eventsError.message);
    } else {
      const critical = events?.filter(e => e.severity === 'critical') || [];
      const errors = events?.filter(e => e.severity === 'error') || [];
      
      console.log(`   📊 Critical events: ${critical.length}`);
      console.log(`   📊 Error events: ${errors.length}`);
      
      if (critical.length > 0) {
        console.log('\n   🚨 CRITICAL EVENTS:');
        critical.slice(0, 5).forEach(e => {
          const eventTime = new Date(String(e.created_at));
          const hoursAgo = (now.getTime() - eventTime.getTime()) / (1000 * 60 * 60);
          console.log(`      - ${e.event_type} (${hoursAgo.toFixed(1)}h ago)`);
          if (e.event_data) {
            console.log(`        Data: ${JSON.stringify(e.event_data).substring(0, 100)}`);
          }
        });
      }
      
      if (errors.length > 0) {
        console.log('\n   ❌ ERROR EVENTS:');
        errors.slice(0, 5).forEach(e => {
          const eventTime = new Date(String(e.created_at));
          const hoursAgo = (now.getTime() - eventTime.getTime()) / (1000 * 60 * 60);
          console.log(`      - ${e.event_type} (${hoursAgo.toFixed(1)}h ago)`);
        });
      }
    }
  } catch (error: any) {
    console.error('   ❌ Exception:', error.message);
  }
  
  console.log('\n');
  
  // 4. CHECK QUEUED CONTENT
  console.log('4️⃣ CHECKING QUEUED CONTENT...');
  try {
    const { data: queued, error: queueError } = await supabase
      .from('content_metadata')
      .select('decision_id, decision_type, created_at, scheduled_at, content, thread_parts')
      .eq('status', 'queued')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (queueError) {
      console.error('   ❌ Error querying queue:', queueError.message);
    } else {
      console.log(`   📊 Queued items: ${queued?.length || 0}`);
      
      if (queued && queued.length > 0) {
        const now = new Date();
        queued.forEach(q => {
          const created = new Date(String(q.created_at));
          const scheduled = q.scheduled_at ? new Date(String(q.scheduled_at)) : created;
          const ageMinutes = Math.round((now.getTime() - created.getTime()) / (1000 * 60));
          const scheduledMinutes = Math.round((now.getTime() - scheduled.getTime()) / (1000 * 60));
          
          const content = q.decision_type === 'thread' 
            ? (q.thread_parts as string[] || []).join(' ').substring(0, 50)
            : String(q.content || '').substring(0, 50);
          
          console.log(`      - ${q.decision_id} (${q.decision_type}): ${ageMinutes}min old, scheduled ${scheduledMinutes > 0 ? scheduledMinutes + 'min ago' : 'in future'}`);
          console.log(`        "${content}..."`);
        });
      } else {
        console.log('   🚨 NO QUEUED CONTENT! This means plan job may not be generating content.');
      }
    }
  } catch (error: any) {
    console.error('   ❌ Exception:', error.message);
  }
  
  console.log('\n');
  
  // 5. CHECK CIRCUIT BREAKER STATUS (from postingQueue)
  console.log('5️⃣ CHECKING CIRCUIT BREAKER STATUS...');
  try {
    // Try to import and check circuit breaker
    const { getCircuitBreakerStatus } = await import('../src/jobs/postingQueue');
    const cbStatus = getCircuitBreakerStatus();
    
    console.log(`   📊 State: ${cbStatus.state}`);
    console.log(`   🔢 Failures: ${cbStatus.failures}`);
    
    if (cbStatus.lastFailure) {
      const hoursSince = (now.getTime() - cbStatus.lastFailure.getTime()) / (1000 * 60 * 60);
      console.log(`   ⏰ Last failure: ${hoursSince.toFixed(1)}h ago`);
    }
    
    if (cbStatus.state === 'open') {
      console.log('   🚨 CIRCUIT BREAKER IS OPEN - POSTING IS BLOCKED!');
    } else if (cbStatus.state === 'half-open') {
      console.log('   ⚠️ CIRCUIT BREAKER IS HALF-OPEN - Testing recovery...');
    } else {
      console.log('   ✅ Circuit breaker is closed (normal operation)');
    }
  } catch (error: any) {
    console.error('   ❌ Could not check circuit breaker:', error.message);
  }
  
  console.log('\n');
  
  // 6. CHECK RATE LIMITS
  console.log('6️⃣ CHECKING RATE LIMITS...');
  try {
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const { data: recentPosts, error: rateError } = await supabase
      .from('content_metadata')
      .select('decision_id, posted_at, decision_type')
      .eq('status', 'posted')
      .gte('posted_at', oneHourAgo.toISOString());
    
    if (rateError) {
      console.error('   ❌ Error checking rate limits:', rateError.message);
    } else {
      const contentPosts = recentPosts?.filter(p => p.decision_type !== 'reply') || [];
      const replyPosts = recentPosts?.filter(p => p.decision_type === 'reply') || [];
      
      console.log(`   📊 Posts this hour: ${contentPosts.length}/2 (limit)`);
      console.log(`   📊 Replies this hour: ${replyPosts.length}/4 (limit)`);
      
      if (contentPosts.length >= 2) {
        console.log('   ⛔ CONTENT POST LIMIT REACHED!');
      }
      if (replyPosts.length >= 4) {
        console.log('   ⛔ REPLY LIMIT REACHED!');
      }
    }
  } catch (error: any) {
    console.error('   ❌ Exception:', error.message);
  }
  
  console.log('\n');
  
  // 7. SUMMARY
  console.log('════════════════════════════════════════════════════════════');
  console.log('📋 INVESTIGATION SUMMARY');
  console.log('════════════════════════════════════════════════════════════');
  console.log('\nCheck the output above for:');
  console.log('  • Recent posts (should have posts in last 12h)');
  console.log('  • Job heartbeats (posting job should have recent success)');
  console.log('  • System errors (critical errors block posting)');
  console.log('  • Queued content (need content ready to post)');
  console.log('  • Circuit breaker (open = blocked)');
  console.log('  • Rate limits (limits reached = blocked)');
  console.log('\n════════════════════════════════════════════════════════════\n');
}

investigatePostingFailure()
  .then(() => {
    console.log('✅ Investigation complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Investigation failed:', error);
    process.exit(1);
  });

