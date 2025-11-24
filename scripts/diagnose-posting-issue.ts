/**
 * 🚨 URGENT POSTING DIAGNOSTIC SCRIPT
 * Checks why posts aren't going out
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

import { getSupabaseClient } from '../src/db/index';

async function diagnosePostingIssue() {
  console.log('🔍 DIAGNOSING POSTING ISSUE...\n');
  
  const supabase = getSupabaseClient();
  
  // 1. Check queued content
  console.log('1️⃣ Checking queued content...');
  const { data: queuedContent, error: queuedError } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, status, scheduled_at, created_at')
    .eq('status', 'queued')
    .in('decision_type', ['single', 'thread'])
    .order('scheduled_at', { ascending: true })
    .limit(10);
  
  if (queuedError) {
    console.error('❌ Error checking queued content:', queuedError.message);
  } else {
    console.log(`   Found ${queuedContent?.length || 0} queued content posts`);
    if (queuedContent && queuedContent.length > 0) {
      console.log('   First few:');
      queuedContent.slice(0, 3).forEach((post: any) => {
        const scheduled = new Date(post.scheduled_at);
        const now = new Date();
        const isReady = scheduled <= now;
        console.log(`   - ${post.decision_type} ${post.decision_id.substring(0, 8)}... (scheduled: ${scheduled.toISOString()}, ready: ${isReady ? 'YES' : 'NO'})`);
      });
    }
  }
  
  // 2. Check recent posts
  console.log('\n2️⃣ Checking recent posts (last 24h)...');
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recentPosts, error: recentError } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, status, posted_at, created_at')
    .in('decision_type', ['single', 'thread'])
    .gte('created_at', oneDayAgo)
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (recentError) {
    console.error('❌ Error checking recent posts:', recentError.message);
  } else {
    console.log(`   Found ${recentPosts?.length || 0} recent posts`);
    const posted = recentPosts?.filter((p: any) => p.status === 'posted') || [];
    const queued = recentPosts?.filter((p: any) => p.status === 'queued') || [];
    const failed = recentPosts?.filter((p: any) => p.status === 'failed') || [];
    const posting = recentPosts?.filter((p: any) => p.status === 'posting') || [];
    
    console.log(`   - Posted: ${posted.length}`);
    console.log(`   - Queued: ${queued.length}`);
    console.log(`   - Failed: ${failed.length}`);
    console.log(`   - Posting (stuck?): ${posting.length}`);
    
    if (posted.length > 0) {
      const lastPost = posted[0];
      const lastPostTime = new Date(lastPost.posted_at || lastPost.created_at);
      const hoursAgo = (Date.now() - lastPostTime.getTime()) / (1000 * 60 * 60);
      console.log(`   ⏰ Last post: ${hoursAgo.toFixed(1)} hours ago`);
    }
  }
  
  // 3. Check stuck posts
  console.log('\n3️⃣ Checking for stuck posts...');
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: stuckPosts, error: stuckError } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, status, created_at')
    .eq('status', 'posting')
    .lt('created_at', thirtyMinAgo);
  
  if (stuckError) {
    console.error('❌ Error checking stuck posts:', stuckError.message);
  } else {
    console.log(`   Found ${stuckPosts?.length || 0} stuck posts (status='posting' >30min)`);
    if (stuckPosts && stuckPosts.length > 0) {
      console.log('   ⚠️ These need to be recovered!');
      stuckPosts.forEach((post: any) => {
        const minutesStuck = Math.round((Date.now() - new Date(post.created_at).getTime()) / (1000 * 60));
        console.log(`   - ${post.decision_type} ${post.decision_id.substring(0, 8)}... (stuck ${minutesStuck}min)`);
      });
    }
  }
  
  // 4. Check plan job execution
  console.log('\n4️⃣ Checking plan job execution...');
  const { data: planJobs, error: planError } = await supabase
    .from('job_heartbeats')
    .select('job_name, status, created_at, execution_time_ms')
    .eq('job_name', 'plan')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (planError) {
    console.error('❌ Error checking plan jobs:', planError.message);
  } else {
    console.log(`   Found ${planJobs?.length || 0} plan job executions`);
    if (planJobs && planJobs.length > 0) {
      const lastPlan = planJobs[0];
      const lastPlanTime = new Date(lastPlan.created_at);
      const hoursAgo = (Date.now() - lastPlanTime.getTime()) / (1000 * 60 * 60);
      console.log(`   ⏰ Last plan run: ${hoursAgo.toFixed(1)} hours ago (status: ${lastPlan.status})`);
      
      if (hoursAgo > 3) {
        console.log('   ⚠️ Plan job hasn\'t run in >3 hours - this is the problem!');
      }
    } else {
      console.log('   ⚠️ No plan job executions found - plan job may not be running!');
    }
  }
  
  // 5. Check posting queue job execution
  console.log('\n5️⃣ Checking posting queue job execution...');
  const { data: postingJobs, error: postingError } = await supabase
    .from('job_heartbeats')
    .select('job_name, status, created_at')
    .eq('job_name', 'posting')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (postingError) {
    console.error('❌ Error checking posting jobs:', postingError.message);
  } else {
    console.log(`   Found ${postingJobs?.length || 0} posting job executions`);
    if (postingJobs && postingJobs.length > 0) {
      const lastPosting = postingJobs[0];
      const lastPostingTime = new Date(lastPosting.created_at);
      const minutesAgo = (Date.now() - lastPostingTime.getTime()) / (1000 * 60);
      console.log(`   ⏰ Last posting run: ${minutesAgo.toFixed(1)} minutes ago (status: ${lastPosting.status})`);
    }
  }
  
  // 6. Summary and recommendations
  console.log('\n📊 SUMMARY:');
  const hasQueuedContent = (queuedContent?.length || 0) > 0;
  const hasStuckPosts = (stuckPosts?.length || 0) > 0;
  const planRecent = planJobs && planJobs.length > 0 && (Date.now() - new Date(planJobs[0].created_at).getTime()) < 3 * 60 * 60 * 1000;
  
  if (!hasQueuedContent && !planRecent) {
    console.log('   🚨 ISSUE: No queued content AND plan job not running recently');
    console.log('   💡 FIX: Need to trigger plan job to generate content');
  } else if (hasQueuedContent) {
    console.log('   ✅ Content is queued - posting should work');
    if (hasStuckPosts) {
      console.log('   ⚠️ But there are stuck posts that need recovery');
    }
  } else if (hasStuckPosts) {
    console.log('   ⚠️ ISSUE: Stuck posts blocking queue');
    console.log('   💡 FIX: Need to recover stuck posts');
  }
  
  console.log('\n✅ Diagnostic complete');
}

diagnosePostingIssue().catch(console.error);
