/**
 * 🔍 FIND ACTUAL ROOT CAUSE
 * Queries database directly to identify why posts aren't happening
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

import { getSupabaseClient } from '../src/db/index';
import { getConfig, getModeFlags } from '../src/config/config';

async function findRootCause() {
  console.log('🔍 FINDING ACTUAL ROOT CAUSE...\n');
  console.log('='.repeat(70));
  
  const supabase = getSupabaseClient();
  const config = getConfig();
  const flags = getModeFlags(config);
  
  const now = new Date();
  const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  
  // 1. CHECK POSTING DISABLED FLAG
  console.log('\n1️⃣ POSTING DISABLED CHECK:');
  console.log(`   flags.postingDisabled: ${flags.postingDisabled}`);
  console.log(`   MODE: ${config.MODE}`);
  console.log(`   POSTING_DISABLED env: ${process.env.POSTING_DISABLED || 'not set'}`);
  
  if (flags.postingDisabled) {
    console.log('   🚨 ROOT CAUSE: POSTING IS DISABLED');
    console.log('   💡 Fix: Set POSTING_DISABLED=false or MODE=live');
    return;
  }
  
  // 2. CHECK QUEUED CONTENT
  console.log('\n2️⃣ QUEUED CONTENT CHECK:');
  const { data: queuedContent, error: queuedError } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, status, scheduled_at, created_at')
    .eq('status', 'queued')
    .in('decision_type', ['single', 'thread'])
    .order('scheduled_at', { ascending: true })
    .limit(10);
  
  if (queuedError) {
    console.log(`   ❌ Database error: ${queuedError.message}`);
  } else {
    console.log(`   Found: ${queuedContent?.length || 0} queued posts`);
    
    if (queuedContent && queuedContent.length > 0) {
      const graceMinutes = parseInt(process.env.GRACE_MINUTES || '5', 10);
      const graceWindow = new Date(now.getTime() + graceMinutes * 60 * 1000);
      
      queuedContent.forEach((p: any) => {
        const scheduled = new Date(p.scheduled_at);
        const isReady = scheduled <= graceWindow;
        const minsUntilReady = Math.max(0, Math.round((scheduled.getTime() - now.getTime()) / 60000));
        console.log(`   - ${p.decision_type} ${p.decision_id.substring(0, 8)}... scheduled: ${scheduled.toISOString()}, ready: ${isReady ? 'YES' : `NO (${minsUntilReady}min)`}`);
      });
      
      const readyCount = queuedContent.filter((p: any) => new Date(p.scheduled_at) <= graceWindow).length;
      if (readyCount === 0) {
        console.log('   🚨 ROOT CAUSE: CONTENT SCHEDULED IN FUTURE');
        console.log(`   💡 Fix: Content exists but scheduled_at is in future (grace window: ${graceMinutes}min)`);
        return;
      }
    } else {
      console.log('   ⚠️ No queued content found');
    }
  }
  
  // 3. CHECK RECENT POSTS (last 4 hours)
  console.log('\n3️⃣ RECENT POSTS CHECK (last 4 hours):');
  const { data: recentPosts, error: recentError } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, status, posted_at, created_at')
    .in('decision_type', ['single', 'thread'])
    .gte('created_at', fourHoursAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(20);
  
  if (recentError) {
    console.log(`   ❌ Database error: ${recentError.message}`);
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
      
      if (hoursAgo < 4) {
        console.log('   ✅ Posts happening recently - not the issue');
      }
    } else {
      console.log('   ⚠️ No posts in last 4 hours');
    }
  }
  
  // 4. CHECK RATE LIMITS
  console.log('\n4️⃣ RATE LIMIT CHECK:');
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const { data: postsThisHour, error: rateError } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type')
    .in('decision_type', ['single', 'thread'])
    .eq('status', 'posted')
    .gte('posted_at', oneHourAgo);
  
  if (rateError) {
    console.log(`   ❌ Database error: ${rateError.message}`);
  } else {
    const count = postsThisHour?.length || 0;
    const maxPostsPerHour = config.MAX_POSTS_PER_HOUR ?? 1;
    console.log(`   Posts in last hour: ${count}/${maxPostsPerHour}`);
    
    if (count >= maxPostsPerHour) {
      console.log('   🚨 ROOT CAUSE: RATE LIMIT REACHED');
      console.log(`   💡 Fix: Wait for next hour OR increase MAX_POSTS_PER_HOUR`);
      return;
    }
  }
  
  // 5. CHECK PLAN JOB EXECUTION
  console.log('\n5️⃣ PLAN JOB EXECUTION CHECK:');
  const { data: planJobs, error: planError } = await supabase
    .from('job_heartbeats')
    .select('job_name, status, created_at, execution_time_ms, error_message')
    .eq('job_name', 'plan')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (planError) {
    console.log(`   ❌ Database error: ${planError.message}`);
    console.log('   ⚠️ job_heartbeats table may not exist or be accessible');
  } else {
    console.log(`   Found ${planJobs?.length || 0} plan job executions`);
    
    if (planJobs && planJobs.length > 0) {
      const lastPlan = planJobs[0];
      const lastPlanTime = new Date(lastPlan.created_at);
      const hoursAgo = (now.getTime() - lastPlanTime.getTime()) / (1000 * 60 * 60);
      console.log(`   ⏰ Last plan run: ${hoursAgo.toFixed(2)} hours ago`);
      console.log(`   Status: ${lastPlan.status}`);
      if (lastPlan.error_message) {
        console.log(`   Error: ${lastPlan.error_message.substring(0, 100)}`);
      }
      
      if (hoursAgo > 3) {
        console.log('   🚨 ROOT CAUSE: PLAN JOB NOT RUNNING');
        console.log(`   💡 Fix: Plan job hasn't run in ${hoursAgo.toFixed(1)} hours`);
        console.log(`   💡 Check: JOBS_PLAN_INTERVAL_MIN=${config.JOBS_PLAN_INTERVAL_MIN || 60}`);
        return;
      }
      
      // Check if plan job is failing
      const failedPlans = planJobs.filter((j: any) => j.status === 'failed' || j.status === 'error');
      if (failedPlans.length > 0) {
        console.log(`   ⚠️ ${failedPlans.length} failed plan jobs found`);
        const lastFailed = failedPlans[0];
        console.log(`   🚨 ROOT CAUSE: PLAN JOB FAILING`);
        console.log(`   💡 Error: ${lastFailed.error_message || 'Unknown error'}`);
        return;
      }
    } else {
      console.log('   🚨 ROOT CAUSE: PLAN JOB NEVER RUN');
      console.log('   💡 Fix: Plan job has never executed - check job scheduling');
      return;
    }
  }
  
  // 6. CHECK POSTING QUEUE JOB EXECUTION
  console.log('\n6️⃣ POSTING QUEUE JOB EXECUTION CHECK:');
  const { data: postingJobs, error: postingError } = await supabase
    .from('job_heartbeats')
    .select('job_name, status, created_at')
    .eq('job_name', 'posting')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (postingError) {
    console.log(`   ❌ Database error: ${postingError.message}`);
  } else {
    console.log(`   Found ${postingJobs?.length || 0} posting job executions`);
    
    if (postingJobs && postingJobs.length > 0) {
      const lastPosting = postingJobs[0];
      const lastPostingTime = new Date(lastPosting.created_at);
      const minutesAgo = (now.getTime() - lastPostingTime.getTime()) / (1000 * 60);
      console.log(`   ⏰ Last posting run: ${minutesAgo.toFixed(1)} minutes ago`);
      console.log(`   Status: ${lastPosting.status}`);
      
      if (minutesAgo > 10) {
        console.log('   🚨 ROOT CAUSE: POSTING QUEUE NOT RUNNING');
        console.log(`   💡 Fix: Posting queue hasn't run in ${minutesAgo.toFixed(1)} minutes (should run every 5min)`);
        return;
      }
    } else {
      console.log('   🚨 ROOT CAUSE: POSTING QUEUE NEVER RUN');
      console.log('   💡 Fix: Posting queue has never executed - check job scheduling');
      return;
    }
  }
  
  // 7. CHECK STUCK POSTS
  console.log('\n7️⃣ STUCK POSTS CHECK:');
  const fifteenMinAgo = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
  const { data: stuckPosts, error: stuckError } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, status, created_at')
    .eq('status', 'posting')
    .lt('created_at', fifteenMinAgo);
  
  if (stuckError) {
    console.log(`   ❌ Database error: ${stuckError.message}`);
  } else {
    console.log(`   Found: ${stuckPosts?.length || 0} stuck posts (status='posting' >15min)`);
    
    if (stuckPosts && stuckPosts.length > 0) {
      console.log('   ⚠️ Stuck posts detected (should auto-recover)');
      stuckPosts.forEach((p: any) => {
        const minutesStuck = Math.round((now.getTime() - new Date(p.created_at).getTime()) / (1000 * 60));
        console.log(`   - ${p.decision_type} ${p.decision_id.substring(0, 8)}... (stuck ${minutesStuck}min)`);
      });
    }
  }
  
  // 8. CHECK CONFIGURATION
  console.log('\n8️⃣ CONFIGURATION CHECK:');
  console.log(`   JOBS_PLAN_INTERVAL_MIN: ${config.JOBS_PLAN_INTERVAL_MIN || 60} minutes`);
  console.log(`   JOBS_POSTING_INTERVAL_MIN: ${config.JOBS_POSTING_INTERVAL_MIN || 5} minutes`);
  console.log(`   MAX_POSTS_PER_HOUR: ${config.MAX_POSTS_PER_HOUR ?? 1}`);
  console.log(`   GRACE_MINUTES: ${process.env.GRACE_MINUTES || '5'}`);
  
  // SUMMARY
  console.log('\n' + '='.repeat(70));
  console.log('📊 SUMMARY:');
  
  const hasQueuedContent = (queuedContent?.length || 0) > 0;
  const hasRecentPosts = (recentPosts?.filter((p: any) => p.status === 'posted').length || 0) > 0;
  const planRecent = planJobs && planJobs.length > 0 && (now.getTime() - new Date(planJobs[0].created_at).getTime()) < 3 * 60 * 60 * 1000;
  const postingRecent = postingJobs && postingJobs.length > 0 && (now.getTime() - new Date(postingJobs[0].created_at).getTime()) < 10 * 60 * 1000;
  
  if (!hasQueuedContent && !planRecent) {
    console.log('🚨 ROOT CAUSE IDENTIFIED: PLAN JOB NOT GENERATING CONTENT');
    console.log('   - No queued content in database');
    console.log('   - Plan job not running recently');
    console.log('   💡 ACTION: Check plan job logs for errors or trigger manually');
  } else if (hasQueuedContent && !hasRecentPosts) {
    console.log('🚨 ROOT CAUSE IDENTIFIED: POSTING QUEUE NOT PROCESSING');
    console.log('   - Content is queued but not posting');
    console.log('   💡 ACTION: Check posting queue logs for errors');
  } else if (!postingRecent) {
    console.log('🚨 ROOT CAUSE IDENTIFIED: POSTING QUEUE JOB NOT RUNNING');
    console.log('   - Posting queue job not executing');
    console.log('   💡 ACTION: Check job manager scheduling');
  } else {
    console.log('✅ System appears operational - check logs for specific errors');
  }
  
  console.log('\n✅ Root cause analysis complete');
}

findRootCause().catch(console.error);

