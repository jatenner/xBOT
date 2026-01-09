/**
 * 📊 PRODUCTION PROOF ROLLUP
 * Writes single system_event with all operational metrics
 * Runs every 10 minutes - this is the dashboard
 */

import { getSupabaseClient } from '../../db/index';

export async function runProductionProofRollup(): Promise<void> {
  const supabase = getSupabaseClient();
  
  console.log('[PROOF_ROLLUP] 📊 Generating production proof rollup...');
  
  const now = new Date();
  const fifteenMinAgo = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
  const sixtyMinAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
  
  // Fetch started/completed (last 15 min)
  const { count: fetchStarted } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'reply_v2_fetch_job_started')
    .gte('created_at', fifteenMinAgo);
  
  const { count: fetchCompleted } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'reply_v2_fetch_job_completed')
    .gte('created_at', fifteenMinAgo);
  
  // Queue size
  const { count: queueSize } = await supabase
    .from('reply_candidate_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'queued')
    .gt('expires_at', now.toISOString());
  
  // Scheduler started (last 60 min)
  const { count: schedulerStarted } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'reply_v2_scheduler_job_started')
    .gte('created_at', sixtyMinAgo);
  
  // Permits created/used (last 60 min)
  const { count: permitsCreated } = await supabase
    .from('post_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('pipeline_source', 'reply_v2_scheduler')
    .gte('created_at', sixtyMinAgo);
  
  const { count: permitsUsed } = await supabase
    .from('post_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'USED')
    .eq('pipeline_source', 'reply_v2_scheduler')
    .gte('used_at', sixtyMinAgo);
  
  // Posted tweet IDs (last 2 hours)
  const { data: postedTweets } = await supabase
    .from('post_attempts')
    .select('actual_tweet_id, used_at')
    .eq('status', 'USED')
    .eq('pipeline_source', 'reply_v2_scheduler')
    .not('actual_tweet_id', 'is', null)
    .gte('used_at', twoHoursAgo)
    .order('used_at', { ascending: false })
    .limit(10);
  
  const postedTweetIds = postedTweets?.map(t => t.actual_tweet_id) || [];
  
  // New ghosts (last 2 hours)
  const { count: newGhosts } = await supabase
    .from('ghost_tweets')
    .select('*', { count: 'exact', head: true })
    .gte('detected_at', twoHoursAgo);
  
  // Last error event
  const { data: lastError } = await supabase
    .from('system_events')
    .select('event_type, message, created_at, event_data')
    .in('severity', ['error', 'critical'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  // Compile rollup
  const rollup = {
    timestamp: now.toISOString(),
    git_sha: process.env.RAILWAY_GIT_COMMIT_SHA || 'unknown',
    fetch_started_15m: fetchStarted || 0,
    fetch_completed_15m: fetchCompleted || 0,
    queue_size: queueSize || 0,
    scheduler_started_60m: schedulerStarted || 0,
    permits_created_60m: permitsCreated || 0,
    permits_used_60m: permitsUsed || 0,
    posted_tweet_ids_last_2h: postedTweetIds,
    new_ghosts_last_2h: newGhosts || 0,
    last_error_event: lastError ? {
      event_type: lastError.event_type,
      message: lastError.message,
      created_at: lastError.created_at,
      event_data: lastError.event_data,
    } : null,
  };
  
  // Write rollup event
  await supabase.from('system_events').insert({
    event_type: 'production_proof_rollup',
    severity: 'info',
    message: `Production proof rollup: fetch=${rollup.fetch_completed_15m}/${rollup.fetch_started_15m} queue=${rollup.queue_size} scheduler=${rollup.scheduler_started_60m} permits=${rollup.permits_used_60m}/${rollup.permits_created_60m} ghosts=${rollup.new_ghosts_last_2h}`,
    event_data: rollup,
    created_at: now.toISOString(),
  });
  
  console.log(`[PROOF_ROLLUP] ✅ Rollup written: fetch=${rollup.fetch_completed_15m}/${rollup.fetch_started_15m} queue=${rollup.queue_size} permits=${rollup.permits_used_60m} ghosts=${rollup.new_ghosts_last_2h}`);
}

