/**
 * 🔍 ACTUAL ROOT CAUSE INVESTIGATION
 * Directly queries database to find why posts aren't happening
 */

import { createClient } from '@supabase/supabase-js';

// Get credentials from environment (will be loaded from Railway or .env)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials');
  console.error('   SUPABASE_URL:', SUPABASE_URL ? '✅' : '❌');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? '✅' : '❌');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function investigate() {
  console.log('🔍 INVESTIGATING ACTUAL ROOT CAUSE...\n');
  console.log('='.repeat(70));
  
  const now = new Date();
  const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  
  // 1. CHECK QUEUED CONTENT
  console.log('\n1️⃣ CHECKING QUEUED CONTENT...');
  const { data: queuedContent, error: queuedError } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, status, scheduled_at, created_at')
    .eq('status', 'queued')
    .in('decision_type', ['single', 'thread'])
    .order('scheduled_at', { ascending: true })
    .limit(10);
  
  if (queuedError) {
    console.log(`   ❌ Error: ${queuedError.message}`);
  } else {
    console.log(`   Found: ${queuedContent?.length || 0} queued posts`);
    
    if (queuedContent && queuedContent.length > 0) {
      const graceMinutes = 5;
      const graceWindow = new Date(now.getTime() + graceMinutes * 60 * 1000);
      
      let readyCount = 0;
      queuedContent.forEach((p: any) => {
        const scheduled = new Date(p.scheduled_at);
        const isReady = scheduled <= graceWindow;
        if (isReady) readyCount++;
        const minsUntilReady = Math.max(0, Math.round((scheduled.getTime() - now.getTime()) / 60000));
        console.log(`   - ${p.decision_type} ${p.decision_id.substring(0, 8)}... scheduled: ${scheduled.toISOString()}, ready: ${isReady ? 'YES' : `NO (${minsUntilReady}min)`}`);
      });
      
      if (readyCount === 0) {
        console.log('\n   🚨 ROOT CAUSE IDENTIFIED: CONTENT SCHEDULED IN FUTURE');
        console.log(`   💡 All ${queuedContent.length} queued posts are scheduled for the future`);
        console.log(`   💡 Fix: Wait OR manually update scheduled_at to NOW()`);
        return;
      }
    } else {
      console.log('   ⚠️ No queued content found');
    }
  }
  
  // 2. CHECK RECENT POSTS
  console.log('\n2️⃣ CHECKING RECENT POSTS (last 4 hours)...');
  const { data: recentPosts, error: recentError } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, status, posted_at, created_at')
    .in('decision_type', ['single', 'thread'])
    .gte('created_at', fourHoursAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(20);
  
  if (recentError) {
    console.log(`   ❌ Error: ${recentError.message}`);
  } else {
    const posted = recentPosts?.filter((p: any) => p.status === 'posted') || [];
    const queued = recentPosts?.filter((p: any) => p.status === 'queued') || [];
    const failed = recentPosts?.filter((p: any) => p.status === 'failed') || [];
    const posting = recentPosts?.filter((p: any) => p.status === 'posting') || [];
    
    console.log(`   Posted: ${posted.length}`);
    console.log(`   Queued: ${queued.length}`);
    console.log(`   Failed: ${failed.length}`);
    console.log(`   Posting (stuck?): ${posting.length}`);
    
    if (posted.length > 0) {
      const lastPost = posted[0];
      const lastPostTime = new Date(lastPost.posted_at || lastPost.created_at);
      const hoursAgo = (now.getTime() - lastPostTime.getTime()) / (1000 * 60 * 60);
      console.log(`   ⏰ Last post: ${hoursAgo.toFixed(2)} hours ago`);
      
      if (hoursAgo >= 4) {
        console.log('\n   🚨 ROOT CAUSE IDENTIFIED: NO POSTS IN LAST 4 HOURS');
        console.log(`   💡 Last post was ${hoursAgo.toFixed(1)} hours ago`);
      }
    } else {
      console.log('\n   🚨 ROOT CAUSE IDENTIFIED: NO POSTS IN LAST 4 HOURS');
      console.log('   💡 No posts found in last 4 hours');
    }
    
    if (queued.length > 0 && posted.length === 0) {
      console.log('\n   🚨 ROOT CAUSE IDENTIFIED: CONTENT QUEUED BUT NOT POSTING');
      console.log(`   💡 ${queued.length} posts are queued but not posting`);
      console.log('   💡 Check posting queue execution (Query 5)');
    }
  }
  
  // 3. CHECK RATE LIMITS
  console.log('\n3️⃣ CHECKING RATE LIMITS...');
  const { data: postsThisHour, error: rateError } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type')
    .in('decision_type', ['single', 'thread'])
    .eq('status', 'posted')
    .gte('posted_at', oneHourAgo.toISOString());
  
  if (rateError) {
    console.log(`   ❌ Error: ${rateError.message}`);
  } else {
    const count = postsThisHour?.length || 0;
    console.log(`   Posts in last hour: ${count}`);
    
    // Check MAX_POSTS_PER_HOUR from environment (default 1)
    const maxPostsPerHour = parseInt(process.env.MAX_POSTS_PER_HOUR || '1', 10);
    console.log(`   Max posts per hour: ${maxPostsPerHour}`);
    
    if (count >= maxPostsPerHour) {
      console.log('\n   🚨 ROOT CAUSE IDENTIFIED: RATE LIMIT REACHED');
      console.log(`   💡 ${count}/${maxPostsPerHour} posts in last hour - limit reached`);
      console.log('   💡 Fix: Wait for next hour OR increase MAX_POSTS_PER_HOUR');
      return;
    }
  }
  
  // 4. CHECK PLAN JOB EXECUTION
  console.log('\n4️⃣ CHECKING PLAN JOB EXECUTION...');
  const { data: planJobs, error: planError } = await supabase
    .from('job_heartbeats')
    .select('job_name, status, created_at, execution_time_ms, error_message')
    .eq('job_name', 'plan')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (planError) {
    console.log(`   ❌ Error: ${planError.message}`);
    console.log('   ⚠️ job_heartbeats table may not exist');
  } else {
    console.log(`   Found ${planJobs?.length || 0} plan job executions`);
    
    if (planJobs && planJobs.length > 0) {
      const lastPlan = planJobs[0];
      const lastPlanTime = new Date(lastPlan.created_at);
      const hoursAgo = (now.getTime() - lastPlanTime.getTime()) / (1000 * 60 * 60);
      console.log(`   ⏰ Last plan run: ${hoursAgo.toFixed(2)} hours ago`);
      console.log(`   Status: ${lastPlan.status}`);
      if (lastPlan.error_message) {
        console.log(`   Error: ${lastPlan.error_message.substring(0, 150)}`);
      }
      
      if (hoursAgo > 3) {
        console.log('\n   🚨 ROOT CAUSE IDENTIFIED: PLAN JOB NOT RUNNING');
        console.log(`   💡 Plan job hasn't run in ${hoursAgo.toFixed(1)} hours`);
        console.log(`   💡 Check: JOBS_PLAN_INTERVAL_MIN=${process.env.JOBS_PLAN_INTERVAL_MIN || '60'}`);
        return;
      }
      
      const failedPlans = planJobs.filter((j: any) => j.status === 'failed' || j.status === 'error');
      if (failedPlans.length > 0) {
        console.log(`\n   ⚠️ ${failedPlans.length} failed plan jobs found`);
        const lastFailed = failedPlans[0];
        console.log('\n   🚨 ROOT CAUSE IDENTIFIED: PLAN JOB FAILING');
        console.log(`   💡 Error: ${lastFailed.error_message || 'Unknown error'}`);
        return;
      }
    } else {
      console.log('\n   🚨 ROOT CAUSE IDENTIFIED: PLAN JOB NEVER RUN');
      console.log('   💡 Plan job has never executed - check job scheduling');
      return;
    }
  }
  
  // 5. CHECK POSTING QUEUE EXECUTION
  console.log('\n5️⃣ CHECKING POSTING QUEUE EXECUTION...');
  const { data: postingJobs, error: postingError } = await supabase
    .from('job_heartbeats')
    .select('job_name, status, created_at')
    .eq('job_name', 'posting')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (postingError) {
    console.log(`   ❌ Error: ${postingError.message}`);
  } else {
    console.log(`   Found ${postingJobs?.length || 0} posting job executions`);
    
    if (postingJobs && postingJobs.length > 0) {
      const lastPosting = postingJobs[0];
      const lastPostingTime = new Date(lastPosting.created_at);
      const minutesAgo = (now.getTime() - lastPostingTime.getTime()) / (1000 * 60);
      console.log(`   ⏰ Last posting run: ${minutesAgo.toFixed(1)} minutes ago`);
      console.log(`   Status: ${lastPosting.status}`);
      
      if (minutesAgo > 10) {
        console.log('\n   🚨 ROOT CAUSE IDENTIFIED: POSTING QUEUE NOT RUNNING');
        console.log(`   💡 Posting queue hasn't run in ${minutesAgo.toFixed(1)} minutes (should run every 5min)`);
        return;
      }
    } else {
      console.log('\n   🚨 ROOT CAUSE IDENTIFIED: POSTING QUEUE NEVER RUN');
      console.log('   💡 Posting queue has never executed - check job scheduling');
      return;
    }
  }
  
  // 6. CHECK STUCK POSTS
  console.log('\n6️⃣ CHECKING STUCK POSTS...');
  const fifteenMinAgo = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
  const { data: stuckPosts, error: stuckError } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, status, created_at')
    .eq('status', 'posting')
    .lt('created_at', fifteenMinAgo);
  
  if (stuckError) {
    console.log(`   ❌ Error: ${stuckError.message}`);
  } else {
    console.log(`   Found: ${stuckPosts?.length || 0} stuck posts (status='posting' >15min)`);
    
    if (stuckPosts && stuckPosts.length > 0) {
      console.log('   ⚠️ Stuck posts detected:');
      stuckPosts.forEach((p: any) => {
        const minutesStuck = Math.round((now.getTime() - new Date(p.created_at).getTime()) / (1000 * 60));
        console.log(`   - ${p.decision_type} ${p.decision_id.substring(0, 8)}... (stuck ${minutesStuck}min)`);
      });
    }
  }
  
  // SUMMARY
  console.log('\n' + '='.repeat(70));
  console.log('📊 SUMMARY:');
  console.log('='.repeat(70));
  
  const hasQueuedContent = (queuedContent?.length || 0) > 0;
  const hasRecentPosts = (recentPosts?.filter((p: any) => p.status === 'posted').length || 0) > 0;
  const planRecent = planJobs && planJobs.length > 0 && (now.getTime() - new Date(planJobs[0].created_at).getTime()) < 3 * 60 * 60 * 1000;
  const postingRecent = postingJobs && postingJobs.length > 0 && (now.getTime() - new Date(postingJobs[0].created_at).getTime()) < 10 * 60 * 1000;
  
  if (!hasQueuedContent && !planRecent) {
    console.log('\n🚨 ROOT CAUSE: PLAN JOB NOT GENERATING CONTENT');
    console.log('   - No queued content in database');
    console.log('   - Plan job not running recently');
    console.log('   💡 ACTION: Check plan job logs for errors or trigger manually');
  } else if (hasQueuedContent && !hasRecentPosts && postingRecent) {
    console.log('\n🚨 ROOT CAUSE: POSTING QUEUE NOT PROCESSING QUEUED CONTENT');
    console.log('   - Content is queued and ready');
    console.log('   - Posting queue is running');
    console.log('   - But posts are not being processed');
    console.log('   💡 ACTION: Check posting queue logs for processing errors');
  } else if (!postingRecent) {
    console.log('\n🚨 ROOT CAUSE: POSTING QUEUE JOB NOT RUNNING');
    console.log('   - Posting queue job not executing');
    console.log('   💡 ACTION: Check job manager scheduling');
  } else {
    console.log('\n✅ System appears operational - check logs for specific errors');
    console.log('   All checks passed but posts still not happening');
    console.log('   💡 ACTION: Check Railway logs for posting errors');
  }
  
  console.log('\n✅ Investigation complete');
}

investigate().catch((error) => {
  console.error('❌ Investigation failed:', error.message);
  console.error(error.stack);
  process.exit(1);
});

