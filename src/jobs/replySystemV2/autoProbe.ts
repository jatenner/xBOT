/**
 * 🔍 AUTO-PROBE SYSTEM
 * Automatically triggers probe when system detects no activity
 * No manual env flags required
 */

import { getSupabaseClient } from '../../db/index';

/**
 * Check if probe should run and execute if needed
 */
export async function checkAndRunAutoProbe(): Promise<void> {
  const supabase = getSupabaseClient();
  const gitSha = process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_SHA || 'unknown';
  
  console.log('[AUTO_PROBE] 🔍 Checking if probe should run...');
  
  // Check if probe already ran for this deploy
  const { data: deployProbe } = await supabase
    .from('system_events')
    .select('created_at, event_data')
    .eq('event_type', 'reply_v2_probe_result')
    .eq('event_data->>git_sha', gitSha)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (deployProbe) {
    console.log('[AUTO_PROBE] ⏭️  Probe already ran for this deploy, skipping...');
    return;
  }
  
  // Check condition (a): 0 permits USED in last 2 hours
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { count: permitsUsed } = await supabase
    .from('post_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'USED')
    .gte('used_at', twoHoursAgo);
  
  // Check condition (b): 0 posted replies with trace chain since deploy
  const { data: bootEvent } = await supabase
    .from('system_events')
    .select('created_at')
    .eq('event_type', 'production_watchdog_boot')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  const deployTime = bootEvent?.created_at || twoHoursAgo;
  
  const { count: tracedReplies } = await supabase
    .from('post_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'USED')
    .eq('pipeline_source', 'reply_v2_scheduler')
    .not('actual_tweet_id', 'is', null)
    .gte('used_at', deployTime);
  
  const shouldProbe = (permitsUsed || 0) === 0 || (tracedReplies || 0) === 0;
  
  if (!shouldProbe) {
    console.log('[AUTO_PROBE] ✅ System operational - no probe needed');
    return;
  }
  
  console.log('[AUTO_PROBE] 🚀 Triggering probe (permits_used_2h=0 or traced_replies=0)...');
  
  // Run probe
  await runAutoProbe(gitSha);
}

/**
 * Execute the probe
 */
async function runAutoProbe(gitSha: string): Promise<void> {
  const supabase = getSupabaseClient();
  const probeRunId = `auto_probe_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  
  // Log probe start
  await supabase.from('system_events').insert({
    event_type: 'reply_v2_probe_started',
    severity: 'info',
    message: `Auto-probe started: probe_run_id=${probeRunId}`,
    event_data: {
      probe_run_id: probeRunId,
      git_sha: gitSha,
      trigger_reason: 'no_activity_detected',
      started_at: new Date().toISOString(),
    },
    created_at: new Date().toISOString(),
  });
  
  // Get queue size before
  const { count: queueSizeBefore } = await supabase
    .from('reply_candidate_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'queued')
    .gt('expires_at', new Date().toISOString());
  
  let probeResult: any = {
    probe_run_id: probeRunId,
    git_sha: gitSha,
    queue_size_before: queueSizeBefore || 0,
    posted: false,
  };
  
  try {
    // Run scheduler attempt
    const { attemptScheduledReply } = await import('./tieredScheduler');
    const result = await attemptScheduledReply();
    
    probeResult.posted = result.posted;
    probeResult.candidate_tweet_id = result.candidate_tweet_id;
    probeResult.tier = result.tier;
    probeResult.reason = result.reason;
    
    // If posted, get full trace chain
    if (result.posted && result.candidate_tweet_id) {
      const { data: sloEvent } = await supabase
        .from('reply_slo_events')
        .select('decision_id, candidate_tweet_id')
        .eq('candidate_tweet_id', result.candidate_tweet_id)
        .eq('posted', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (sloEvent?.decision_id) {
        probeResult.decision_id = sloEvent.decision_id;
        
        const { data: permit } = await supabase
          .from('post_attempts')
          .select('permit_id, actual_tweet_id')
          .eq('decision_id', sloEvent.decision_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        if (permit) {
          probeResult.permit_id = permit.permit_id;
          probeResult.posted_tweet_id = permit.actual_tweet_id;
        }
      }
    }
    
    // Get queue size after
    const { count: queueSizeAfter } = await supabase
      .from('reply_candidate_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'queued')
      .gt('expires_at', new Date().toISOString());
    
    probeResult.queue_size_after = queueSizeAfter || 0;
    
  } catch (error: any) {
    console.error('[AUTO_PROBE] ❌ Probe failed:', error.message);
    probeResult.posted = false;
    probeResult.failure_reason = error.message;
    probeResult.stack_trace = error.stack?.substring(0, 1000);
  }
  
  // Log probe result
  await supabase.from('system_events').insert({
    event_type: 'reply_v2_probe_result',
    severity: probeResult.posted ? 'info' : 'warning',
    message: `Auto-probe result: posted=${probeResult.posted} reason=${probeResult.reason || probeResult.failure_reason || 'N/A'}`,
    event_data: probeResult,
    created_at: new Date().toISOString(),
  });
  
  console.log(`[AUTO_PROBE] ✅ Probe completed: posted=${probeResult.posted}`);
}

