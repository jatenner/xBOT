import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

async function finalCheck() {
  const { getSupabaseClient } = await import('../src/db/index');
  const supabase = getSupabaseClient();
  const now = new Date();
  
  console.log('🔍 FINAL ROOT CAUSE CHECK\n');
  console.log('='.repeat(70));
  
  // Check plan job
  console.log('\n1️⃣ PLAN JOB:');
  const { data: planJob } = await supabase
    .from('job_heartbeats')
    .select('*')
    .eq('job_name', 'plan')
    .maybeSingle();
  
  if (planJob) {
    const lastSuccess = planJob.last_success ? new Date(planJob.last_success) : null;
    const lastFailure = planJob.last_failure ? new Date(planJob.last_failure) : null;
    const hoursSinceSuccess = lastSuccess ? (now.getTime() - lastSuccess.getTime()) / (1000 * 60 * 60) : Infinity;
    const hoursSinceFailure = lastFailure ? (now.getTime() - lastFailure.getTime()) / (1000 * 60 * 60) : Infinity;
    
    console.log(`   Last success: ${lastSuccess ? `${hoursSinceSuccess.toFixed(1)}h ago` : 'NEVER'}`);
    console.log(`   Last failure: ${lastFailure ? `${hoursSinceFailure.toFixed(1)}h ago` : 'NEVER'}`);
    console.log(`   Status: ${planJob.last_run_status}`);
    console.log(`   Consecutive failures: ${planJob.consecutive_failures}`);
    if (planJob.last_error) {
      console.log(`   Last error: ${planJob.last_error}`);
    }
    
    if (hoursSinceSuccess > 4) {
      console.log(`\n   🚨 ROOT CAUSE: Plan job hasn't succeeded in ${hoursSinceSuccess.toFixed(1)} hours`);
    }
  } else {
    console.log('   🚨 ROOT CAUSE: Plan job never ran (no record in job_heartbeats)');
  }
  
  // Check posting job
  console.log('\n2️⃣ POSTING QUEUE JOB:');
  const { data: postingJob } = await supabase
    .from('job_heartbeats')
    .select('*')
    .eq('job_name', 'posting')
    .maybeSingle();
  
  if (postingJob) {
    const lastSuccess = postingJob.last_success ? new Date(postingJob.last_success) : null;
    const lastFailure = postingJob.last_failure ? new Date(postingJob.last_failure) : null;
    const minsSinceSuccess = lastSuccess ? (now.getTime() - lastSuccess.getTime()) / (1000 * 60) : Infinity;
    const minsSinceFailure = lastFailure ? (now.getTime() - lastFailure.getTime()) / (1000 * 60) : Infinity;
    
    console.log(`   Last success: ${lastSuccess ? `${minsSinceSuccess.toFixed(1)}min ago` : 'NEVER'}`);
    console.log(`   Last failure: ${lastFailure ? `${minsSinceFailure.toFixed(1)}min ago` : 'NEVER'}`);
    console.log(`   Status: ${postingJob.last_run_status}`);
    console.log(`   Consecutive failures: ${postingJob.consecutive_failures}`);
    if (postingJob.last_error) {
      console.log(`   Last error: ${postingJob.last_error}`);
    }
    
    if (minsSinceSuccess > 10) {
      console.log(`\n   🚨 ROOT CAUSE: Posting queue hasn't succeeded in ${minsSinceSuccess.toFixed(1)} minutes`);
    }
  } else {
    console.log('   🚨 ROOT CAUSE: Posting queue never ran (no record in job_heartbeats)');
  }
  
  // Check queued content again
  console.log('\n3️⃣ QUEUED CONTENT:');
  const { data: queued } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, scheduled_at')
    .eq('status', 'queued')
    .in('decision_type', ['single', 'thread'])
    .order('scheduled_at', { ascending: true })
    .limit(5);
  
  console.log(`   Found: ${queued?.length || 0} queued posts`);
  if (queued && queued.length > 0) {
    const graceWindow = new Date(now.getTime() + 5 * 60 * 1000);
    const ready = queued.filter((p: any) => new Date(p.scheduled_at) <= graceWindow);
    console.log(`   Ready to post: ${ready.length}`);
    queued.forEach((p: any) => {
      const scheduled = new Date(p.scheduled_at);
      const minsUntil = Math.round((scheduled.getTime() - now.getTime()) / 60000);
      console.log(`   - ${p.decision_type} ${p.decision_id.substring(0, 8)}... scheduled: ${scheduled.toISOString()} (${minsUntil > 0 ? `${minsUntil}min` : 'READY'})`);
    });
  }
  
  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('📊 ROOT CAUSE SUMMARY:');
  console.log('='.repeat(70));
  
  if (!planJob) {
    console.log('\n🚨 PRIMARY ROOT CAUSE: PLAN JOB NEVER STARTED');
    console.log('   - No record in job_heartbeats table');
    console.log('   - Plan job not scheduled or not executing');
    console.log('   💡 ACTION: Check Railway logs for job manager startup');
  } else if (planJob.last_success && (now.getTime() - new Date(planJob.last_success).getTime()) > 4 * 60 * 60 * 1000) {
    console.log('\n🚨 PRIMARY ROOT CAUSE: PLAN JOB NOT RUNNING');
    const hoursAgo = (now.getTime() - new Date(planJob.last_success).getTime()) / (1000 * 60 * 60);
    console.log(`   - Last success: ${hoursAgo.toFixed(1)} hours ago`);
    console.log(`   - Status: ${planJob.last_run_status}`);
    console.log('   💡 ACTION: Check why plan job stopped running');
  }
  
  if (!postingJob) {
    console.log('\n🚨 SECONDARY ROOT CAUSE: POSTING QUEUE NEVER STARTED');
    console.log('   - No record in job_heartbeats table');
    console.log('   - Posting queue not scheduled or not executing');
    console.log('   💡 ACTION: Check Railway logs for job manager startup');
  } else if (postingJob.last_success && (now.getTime() - new Date(postingJob.last_success).getTime()) > 10 * 60 * 1000) {
    console.log('\n🚨 SECONDARY ROOT CAUSE: POSTING QUEUE NOT RUNNING');
    const minsAgo = (now.getTime() - new Date(postingJob.last_success).getTime()) / (1000 * 60);
    console.log(`   - Last success: ${minsAgo.toFixed(1)} minutes ago`);
    console.log(`   - Status: ${postingJob.last_run_status}`);
    console.log('   💡 ACTION: Check why posting queue stopped running');
  }
  
  if (queued && queued.length > 0) {
    const ready = queued.filter((p: any) => new Date(p.scheduled_at) <= new Date(now.getTime() + 5 * 60 * 1000));
    if (ready.length > 0 && postingJob && postingJob.last_success) {
      const minsAgo = (now.getTime() - new Date(postingJob.last_success).getTime()) / (1000 * 60);
      if (minsAgo < 10) {
        console.log('\n⚠️ CONTENT READY BUT NOT POSTING:');
        console.log(`   - ${ready.length} posts ready to post`);
        console.log(`   - Posting queue running (last success: ${minsAgo.toFixed(1)}min ago)`);
        console.log('   💡 ACTION: Check posting queue logs for processing errors');
      }
    }
  }
}

finalCheck().catch(console.error);

