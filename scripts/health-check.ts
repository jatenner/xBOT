/**
 * 🏥 HEALTH CHECK SCRIPT
 * Prints system health status: last runs, queue depth, errors
 */

import { getSupabaseClient } from '../src/db/index';
import * as dotenv from 'dotenv';
dotenv.config();

async function healthCheck(): Promise<void> {
  const supabase = getSupabaseClient();

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('🏥 xBOT HEALTH CHECK');
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    // 1. Last planJob run
    const { data: lastPlan } = await supabase
      .from('job_heartbeats')
      .select('last_run_at, last_run_status, last_error')
      .eq('job_name', 'plan')
      .single();

    console.log('📋 PLAN JOB:');
    if (lastPlan) {
      const lastRun = lastPlan.last_run_at ? new Date(lastPlan.last_run_at) : null;
      const minutesAgo = lastRun ? Math.round((Date.now() - lastRun.getTime()) / 60000) : null;
      console.log(`   Last run: ${lastRun?.toISOString() || 'never'} ${minutesAgo ? `(${minutesAgo}min ago)` : ''}`);
      console.log(`   Status: ${lastPlan.last_run_status || 'unknown'}`);
      if (lastPlan.last_error) {
        console.log(`   Error: ${lastPlan.last_error.substring(0, 100)}`);
      }
    } else {
      console.log('   ⚠️  No heartbeat found');
    }

    // 2. Queue depth
    const { data: queued, error: queueError } = await supabase
      .from('content_metadata')
      .select('decision_id, scheduled_at, status')
      .eq('status', 'queued')
      .order('scheduled_at', { ascending: true })
      .limit(20);

    console.log('\n📦 QUEUE DEPTH:');
    if (queueError) {
      console.log(`   ❌ Error: ${queueError.message}`);
    } else {
      const count = queued?.length || 0;
      console.log(`   Queued items: ${count}`);
      if (count > 0 && queued) {
        const next = new Date(queued[0].scheduled_at);
        const minutesUntil = Math.round((next.getTime() - Date.now()) / 60000);
        console.log(`   Next scheduled: ${next.toISOString()} (${minutesUntil > 0 ? `in ${minutesUntil}min` : 'overdue'})`);
      }
    }

    // 3. Last post time
    const { data: lastPost, error: postError } = await supabase
      .from('content_metadata')
      .select('posted_at, decision_id, tweet_id')
      .eq('status', 'posted')
      .not('posted_at', 'is', null)
      .order('posted_at', { ascending: false })
      .limit(1)
      .single();

    console.log('\n📅 LAST POST:');
    if (postError && postError.code !== 'PGRST116') {
      console.log(`   ❌ Error: ${postError.message}`);
    } else if (lastPost) {
      const posted = new Date(lastPost.posted_at);
      const hoursAgo = Math.round((Date.now() - posted.getTime()) / 3600000 * 10) / 10;
      console.log(`   Time: ${posted.toISOString()} (${hoursAgo}h ago)`);
      console.log(`   Decision ID: ${lastPost.decision_id}`);
      console.log(`   Tweet ID: ${lastPost.tweet_id || 'N/A'}`);
    } else {
      console.log('   ⚠️  No posts found');
    }

    // 4. Last errors summary
    const { data: recentErrors, error: errorsError } = await supabase
      .from('content_metadata')
      .select('decision_id, error_message, updated_at, status')
      .in('status', ['failed', 'failed_permanent'])
      .order('updated_at', { ascending: false })
      .limit(5);

    console.log('\n❌ RECENT ERRORS:');
    if (errorsError) {
      console.log(`   ❌ Error: ${errorsError.message}`);
    } else if (recentErrors && recentErrors.length > 0) {
      recentErrors.forEach((err, i) => {
        const time = new Date(err.updated_at);
        const hoursAgo = Math.round((Date.now() - time.getTime()) / 3600000 * 10) / 10;
        console.log(`   ${i + 1}. ${err.status}: ${err.error_message?.substring(0, 80) || 'No message'} (${hoursAgo}h ago)`);
      });
    } else {
      console.log('   ✅ No recent errors');
    }

    // 5. System health status
    const lastPostedHours = lastPost ? (Date.now() - new Date(lastPost.posted_at).getTime()) / 3600000 : Infinity;
    const queueEmpty = !queued || queued.length === 0;
    const hasRecentErrors = recentErrors && recentErrors.length > 0;

    console.log('\n🏥 SYSTEM HEALTH:');
    if (lastPostedHours > 4 && queueEmpty) {
      console.log('   ⚠️  WARNING: No posts in 4+ hours and queue is empty');
      console.log('   → Check planJob logs');
    } else if (lastPostedHours > 4 && !queueEmpty) {
      console.log('   🚨 CRITICAL: No posts in 4+ hours but queue has items');
      console.log('   → Check postingQueue logs');
    } else if (hasRecentErrors) {
      console.log('   ⚠️  WARNING: Recent errors detected');
      console.log('   → Review error messages above');
    } else {
      console.log('   ✅ HEALTHY: System operating normally');
    }

    console.log('\n═══════════════════════════════════════════════════════\n');

  } catch (error: any) {
    console.error('❌ Health check failed:', error.message);
    process.exit(1);
  }
}

healthCheck().catch(console.error);
