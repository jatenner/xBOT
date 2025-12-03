/**
 * 🔍 DIRECT ROOT CAUSE CHECK
 * Uses codebase database connection to find actual root cause
 */

import dotenv from 'dotenv';
import path from 'path';

// Load .env if it exists
dotenv.config({ path: path.join(__dirname, '../.env') });

// Import database connection from codebase
async function checkRootCause() {
  try {
    // Dynamic import to avoid validation errors if env vars missing
    const { getSupabaseClient } = await import('../src/db/index');
    
    console.log('🔍 CHECKING ACTUAL ROOT CAUSE...\n');
    console.log('='.repeat(70));
    
    const supabase = getSupabaseClient();
    const now = new Date();
    const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);
    
    // 1. QUEUED CONTENT
    console.log('\n1️⃣ Queued Content:');
    const { data: queued, error: qErr } = await supabase
      .from('content_metadata')
      .select('decision_id, decision_type, scheduled_at')
      .eq('status', 'queued')
      .in('decision_type', ['single', 'thread'])
      .order('scheduled_at', { ascending: true })
      .limit(5);
    
    if (qErr) {
      console.log(`   ❌ Error: ${qErr.message}`);
    } else {
      console.log(`   Found: ${queued?.length || 0} queued posts`);
      if (queued && queued.length > 0) {
        const graceWindow = new Date(now.getTime() + 5 * 60 * 1000);
        const ready = queued.filter((p: any) => new Date(p.scheduled_at) <= graceWindow);
        console.log(`   Ready to post: ${ready.length}`);
        if (ready.length === 0) {
          console.log('   🚨 ROOT CAUSE: Content scheduled in future');
          return;
        }
      } else {
        console.log('   ⚠️ No queued content');
      }
    }
    
    // 2. RECENT POSTS
    console.log('\n2️⃣ Recent Posts (last 4h):');
    const { data: recent, error: rErr } = await supabase
      .from('content_metadata')
      .select('status, posted_at')
      .in('decision_type', ['single', 'thread'])
      .gte('created_at', fourHoursAgo.toISOString());
    
    if (rErr) {
      console.log(`   ❌ Error: ${rErr.message}`);
    } else {
      const posted = recent?.filter((p: any) => p.status === 'posted') || [];
      console.log(`   Posted: ${posted.length}`);
      if (posted.length === 0) {
        console.log('   🚨 ROOT CAUSE: No posts in last 4 hours');
      } else {
        const lastPost = posted[0];
        const hoursAgo = (now.getTime() - new Date(lastPost.posted_at).getTime()) / (1000 * 60 * 60);
        console.log(`   Last post: ${hoursAgo.toFixed(1)}h ago`);
        if (hoursAgo >= 4) {
          console.log('   🚨 ROOT CAUSE: No posts in last 4 hours');
        }
      }
    }
    
    // 3. PLAN JOB
    console.log('\n3️⃣ Plan Job:');
    const { data: planJobs, error: pErr } = await supabase
      .from('job_heartbeats')
      .select('status, created_at, error_message')
      .eq('job_name', 'plan')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (pErr) {
      console.log(`   ❌ Error: ${pErr.message}`);
      console.log('   ⚠️ job_heartbeats table may not exist');
    } else if (planJobs) {
      const hoursAgo = (now.getTime() - new Date(planJobs.created_at).getTime()) / (1000 * 60 * 60);
      console.log(`   Last run: ${hoursAgo.toFixed(1)}h ago, Status: ${planJobs.status}`);
      if (hoursAgo > 3) {
        console.log('   🚨 ROOT CAUSE: Plan job not running');
        return;
      }
      if (planJobs.status === 'failed') {
        console.log(`   🚨 ROOT CAUSE: Plan job failing - ${planJobs.error_message}`);
        return;
      }
    } else {
      console.log('   🚨 ROOT CAUSE: Plan job never ran');
      return;
    }
    
    // 4. POSTING QUEUE
    console.log('\n4️⃣ Posting Queue:');
    const { data: postingJobs, error: postErr } = await supabase
      .from('job_heartbeats')
      .select('status, created_at')
      .eq('job_name', 'posting')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (postErr) {
      console.log(`   ❌ Error: ${postErr.message}`);
    } else if (postingJobs) {
      const minsAgo = (now.getTime() - new Date(postingJobs.created_at).getTime()) / (1000 * 60);
      console.log(`   Last run: ${minsAgo.toFixed(1)}min ago, Status: ${postingJobs.status}`);
      if (minsAgo > 10) {
        console.log('   🚨 ROOT CAUSE: Posting queue not running');
        return;
      }
    } else {
      console.log('   🚨 ROOT CAUSE: Posting queue never ran');
      return;
    }
    
    // 5. RATE LIMIT
    console.log('\n5️⃣ Rate Limit:');
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const { count, error: rateErr } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .in('decision_type', ['single', 'thread'])
      .eq('status', 'posted')
      .gte('posted_at', oneHourAgo);
    
    if (rateErr) {
      console.log(`   ❌ Error: ${rateErr.message}`);
    } else {
      const maxPosts = parseInt(process.env.MAX_POSTS_PER_HOUR || '1', 10);
      console.log(`   Posts this hour: ${count || 0}/${maxPosts}`);
      if ((count || 0) >= maxPosts) {
        console.log('   🚨 ROOT CAUSE: Rate limit reached');
        return;
      }
    }
    
    console.log('\n✅ All checks passed - system should be posting');
    console.log('💡 Check Railway logs for specific posting errors');
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('DATABASE_URL') || error.message.includes('SUPABASE')) {
      console.error('\n💡 Missing database credentials');
      console.error('   Run this script on Railway where env vars are available:');
      console.error('   railway run pnpm exec tsx scripts/direct-root-cause-check.ts');
    }
    process.exit(1);
  }
}

checkRootCause();

