/**
 * 🔍 PROBE: Force post the newest APPROVED permit
 * 
 * This script finds the newest APPROVED permit and forces it to be posted
 * immediately, bypassing the scheduler timing.
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';
import { attemptScheduledReply } from '../src/jobs/replySystemV2/tieredScheduler';

async function probePostLatestPermit(): Promise<void> {
  const supabase = getSupabaseClient();
  
  console.log('[PROBE] 🔍 Finding newest APPROVED permit...');
  
  // Find newest APPROVED permit
  const { data: approvedPermit } = await supabase
    .from('post_attempts')
    .select('permit_id, decision_id, target_tweet_id, status, pipeline_source')
    .eq('pipeline_source', 'reply_v2_scheduler')
    .eq('status', 'APPROVED')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (!approvedPermit) {
    console.log('[PROBE] ⚠️ No APPROVED permits found. Running scheduler to create one...');
    
    // Run scheduler to create a new permit
    try {
      const result = await attemptScheduledReply();
      console.log(`[PROBE] ✅ Scheduler result: posted=${result.posted} reason=${result.reason}`);
      
      if (result.posted) {
        console.log('[PROBE] ✅ Scheduler created permit and queued reply');
        console.log('[PROBE] ⏳ Reply will be posted by postingQueue job within 5 minutes');
      } else {
        console.log(`[PROBE] ⚠️ Scheduler did not post: ${result.reason}`);
      }
    } catch (error: any) {
      console.error(`[PROBE] ❌ Scheduler failed: ${error.message}`);
      throw error;
    }
    
    return;
  }
  
  console.log(`[PROBE] ✅ Found APPROVED permit: ${approvedPermit.permit_id}`);
  console.log(`[PROBE] Decision ID: ${approvedPermit.decision_id}`);
  console.log(`[PROBE] Target Tweet: ${approvedPermit.target_tweet_id}`);
  
  // Check if decision is queued
  const { data: decision } = await supabase
    .from('content_metadata')
    .select('decision_id, status, content, target_tweet_id')
    .eq('decision_id', approvedPermit.decision_id)
    .single();
  
  if (!decision) {
    console.error(`[PROBE] ❌ Decision not found: ${approvedPermit.decision_id}`);
    process.exit(1);
  }
  
  console.log(`[PROBE] Decision status: ${decision.status}`);
  
  if (decision.status !== 'queued') {
    console.log(`[PROBE] ⚠️ Decision not queued (status: ${decision.status}). Updating to queued...`);
    await supabase
      .from('content_metadata')
      .update({ status: 'queued' })
      .eq('decision_id', approvedPermit.decision_id);
    console.log('[PROBE] ✅ Decision updated to queued');
  }
  
  // Trigger posting queue immediately
  console.log('[PROBE] 🚀 Triggering posting queue to process this permit...');
  
  try {
    const { processPostingQueue } = await import('../src/jobs/postingQueue');
    await processPostingQueue();
    console.log('[PROBE] ✅ Posting queue completed');
    
    // Check if permit was used
    const { data: updatedPermit } = await supabase
      .from('post_attempts')
      .select('status, actual_tweet_id, used_at')
      .eq('permit_id', approvedPermit.permit_id)
      .single();
    
    if (updatedPermit?.status === 'USED' && updatedPermit.actual_tweet_id) {
      console.log(`[PROBE] ✅ SUCCESS! Permit USED with tweet_id: ${updatedPermit.actual_tweet_id}`);
      console.log(`[PROBE] Used at: ${updatedPermit.used_at}`);
    } else {
      console.log(`[PROBE] ⚠️ Permit status: ${updatedPermit?.status}, tweet_id: ${updatedPermit?.actual_tweet_id || 'none'}`);
    }
  } catch (error: any) {
    console.error(`[PROBE] ❌ Posting queue failed: ${error.message}`);
    console.error(`[PROBE] Stack: ${error.stack}`);
    throw error;
  }
}

// Run probe
probePostLatestPermit()
  .then(() => {
    console.log('[PROBE] ✅ Probe complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[PROBE] ❌ Probe failed:', error);
    process.exit(1);
  });

