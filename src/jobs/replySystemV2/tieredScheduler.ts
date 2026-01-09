/**
 * ⏰ TIERED POSTING SCHEDULER
 * 
 * Posts ONE reply every 15 minutes from queue
 * Tiers: 1 (>=5000), 2 (>=1000), 3 (>=500), 4 (block)
 */

import { getSupabaseClient } from '../../db/index';
import { getNextCandidateFromQueue } from './queueManager';

const POSTING_INTERVAL_MINUTES = 15;
const TARGET_REPLIES_PER_HOUR = 4;
const TARGET_REPLIES_PER_15MIN = 1; // 4 per hour = 1 per 15 min

export interface SchedulerResult {
  posted: boolean;
  candidate_tweet_id?: string;
  tier?: number;
  reason: string;
  behind_schedule: boolean;
}

/**
 * Attempt to post ONE reply from queue
 */
export async function attemptScheduledReply(): Promise<SchedulerResult> {
  const supabase = getSupabaseClient();
  const schedulerRunId = `scheduler_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const slotTime = new Date();
  
  // 🔒 CRITICAL: Log job start IMMEDIATELY (before any work)
  try {
    await supabase.from('system_events').insert({
      event_type: 'reply_v2_scheduler_job_started',
      severity: 'info',
      message: `Reply V2 scheduler job started: scheduler_run_id=${schedulerRunId}`,
      event_data: {
        scheduler_run_id: schedulerRunId,
        slot_time: slotTime.toISOString(),
      },
      created_at: new Date().toISOString(),
    });
    console.log(`[SCHEDULER] ✅ Job start logged: ${schedulerRunId}`);
  } catch (logError: any) {
    console.error(`[SCHEDULER] ❌ Failed to log job start: ${logError.message}`);
    // Continue anyway - logging failure shouldn't block scheduler
  }
  
  console.log('[SCHEDULER] ⏰ Attempting scheduled reply...');
  
  // Round to nearest 15-min slot
  const slotMinutes = Math.floor(slotTime.getMinutes() / 15) * 15;
  slotTime.setMinutes(slotMinutes, 0, 0);
  
  console.log(`[SCHEDULER] 🆔 Scheduler run ID: ${schedulerRunId}`);
  console.log(`[SCHEDULER] ⏰ Slot time: ${slotTime.toISOString()}`);
  
  // Check if we're behind schedule
  const behindSchedule = await checkBehindSchedule();
  
  // Try tiers in order
  let candidate = await getNextCandidateFromQueue(1); // Tier 1 first
  let tier = 1;
  
  if (!candidate) {
    candidate = await getNextCandidateFromQueue(2); // Tier 2
    tier = 2;
  }
  
  if (!candidate && behindSchedule) {
    candidate = await getNextCandidateFromQueue(3); // Tier 3 only if behind
    tier = 3;
  }
  
  // Get queue metrics for SLO tracking
  const { data: queueMetrics } = await supabase
    .from('reply_candidate_queue')
    .select('predicted_tier')
    .eq('status', 'queued')
    .gt('expires_at', new Date().toISOString());
  
  const queueSize = queueMetrics?.length || 0;
  const tier1Count = queueMetrics?.filter(q => q.predicted_tier === 1).length || 0;
  const tier2Count = queueMetrics?.filter(q => q.predicted_tier === 2).length || 0;
  const tier3Count = queueMetrics?.filter(q => q.predicted_tier === 3).length || 0;
  
  if (!candidate) {
    console.log('[SCHEDULER] ⚠️ No candidates available in queue');
    
    // Log SLO event
    await supabase
      .from('reply_slo_events')
      .insert({
        scheduler_run_id: schedulerRunId,
        slot_time: slotTime.toISOString(),
        posted: false,
        reason: 'queue_empty',
        queue_size: queueSize,
        tier_1_count: tier1Count,
        tier_2_count: tier2Count,
        tier_3_count: tier3Count,
        slo_hit: false,
        slo_target: TARGET_REPLIES_PER_HOUR,
      });
    
    // Trigger immediate refill if queue empty
    if (queueSize === 0) {
      console.log('[SCHEDULER] 🔄 Queue empty - triggering immediate refill...');
      const { refreshCandidateQueue } = await import('./queueManager');
      await refreshCandidateQueue();
    }
    
    return {
      posted: false,
      reason: 'queue_empty',
      behind_schedule: behindSchedule,
    };
  }
  
  console.log(`[SCHEDULER] 🎯 Selected candidate: ${candidate.candidate_tweet_id} (tier ${tier})`);
  
  // 🔒 MANDATE 1: Create decision + permit IMMEDIATELY after selection, BEFORE generation
  let decisionId: string;
  let permit_id: string;
  let queueId: string | undefined;
  
  try {
    // Get candidate details (minimal - just for permit creation)
    const { data: candidateData } = await supabase
      .from('candidate_evaluations')
      .select('candidate_tweet_id, candidate_author_username, candidate_content')
      .eq('id', candidate.evaluation_id)
      .single();
    
    if (!candidateData) {
      throw new Error('Candidate data not found');
    }
    
    // Get queue entry ID for traceability
    const { data: queueEntry } = await supabase
      .from('reply_candidate_queue')
      .select('id')
      .eq('candidate_tweet_id', candidate.candidate_tweet_id)
      .eq('status', 'selected')
      .order('selected_at', { ascending: false })
      .limit(1)
      .single();
    
    queueId = queueEntry?.id;
    
    // Update queue with scheduler_run_id
    if (queueId) {
      await supabase
        .from('reply_candidate_queue')
        .update({ scheduler_run_id: schedulerRunId })
        .eq('id', queueId);
    }
    
    // Create decision FIRST (before generation)
    const { v4: uuidv4 } = await import('uuid');
    decisionId = uuidv4();
    
    // Insert decision with placeholder content (will be updated after generation)
    await supabase
      .from('content_generation_metadata_comprehensive')
      .insert({
        decision_id: decisionId,
        decision_type: 'reply',
        status: 'generating', // Status: generating → queued → posted
        content: '[GENERATING...]', // Placeholder
        target_tweet_id: candidate.candidate_tweet_id,
        pipeline_source: 'reply_v2_scheduler',
        build_sha: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_SHA || 'unknown',
        candidate_evaluation_id: candidate.evaluation_id,
        queue_id: queueId,
        scheduler_run_id: schedulerRunId,
      });
    
    // Also insert into content_metadata
    await supabase
      .from('content_metadata')
      .insert({
        decision_id: decisionId,
        decision_type: 'reply',
        status: 'generating',
        content: '[GENERATING...]',
        target_tweet_id: candidate.candidate_tweet_id,
        scheduled_at: new Date().toISOString(),
        pipeline_source: 'reply_v2_scheduler',
        build_sha: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_SHA || 'unknown',
        quality_score: candidate.overall_score / 100,
        candidate_evaluation_id: candidate.evaluation_id,
        queue_id: queueId,
        scheduler_run_id: schedulerRunId,
      });
    
    // 🎫 CREATE POSTING PERMIT IMMEDIATELY (before generation)
    const { createPostingPermit } = await import('../../posting/postingPermit');
    console.log(`[SCHEDULER] 🎫 Creating posting permit BEFORE generation...`);
    const permitResult = await createPostingPermit({
      decision_id: decisionId,
      decision_type: 'reply',
      pipeline_source: 'reply_v2_scheduler',
      content_preview: '[GENERATING...]',
      target_tweet_id: candidate.candidate_tweet_id,
      run_id: schedulerRunId,
    });
    
    if (!permitResult.success) {
      const errorMsg = `[SCHEDULER] ❌ BLOCKED: Failed to create posting permit: ${permitResult.error}`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    
    permit_id = permitResult.permit_id;
    console.log(`[SCHEDULER] ✅ Permit created: ${permit_id}`);
    
    // 🔒 MANDATE 1: Emit system_event 'reply_v2_attempt_created'
    await supabase.from('system_events').insert({
      event_type: 'reply_v2_attempt_created',
      severity: 'info',
      message: `Reply V2 attempt created: decision_id=${decisionId} permit_id=${permit_id}`,
      event_data: {
        decision_id: decisionId,
        permit_id: permit_id,
        candidate_id: candidate.candidate_tweet_id,
        candidate_evaluation_id: candidate.evaluation_id,
        scheduler_run_id: schedulerRunId,
        queue_id: queueId,
        pipeline_source: 'reply_v2_scheduler',
      },
      created_at: new Date().toISOString(),
    });
    
    console.log(`[SCHEDULER] ✅ Decision + permit created: decision_id=${decisionId} permit_id=${permit_id}`);
    
    // NOW generate reply content (after decision+permit exist)
    const { routeContentGeneration } = await import('../../ai/orchestratorRouter');
    const { extractKeywords } = await import('../../gates/ReplyQualityGate');
    const { buildReplyContext } = await import('../../utils/replyContextBuilder');
    
    // Build context
    const keywords = extractKeywords(candidateData.candidate_content);
    const replyContext = await buildReplyContext(candidate.candidate_tweet_id, candidateData.candidate_author_username);
    
    // Generate reply content
    const routerResponse = await routeContentGeneration({
      decision_type: 'reply',
      content_slot: 'reply',
      topic: 'health',
      angle: 'reply_context',
      tone: 'helpful',
      target_username: candidateData.candidate_author_username,
      target_tweet_content: candidateData.candidate_content,
      generator_name: 'contextual_reply',
      reply_context: {
        target_text: candidateData.candidate_content,
        root_text: replyContext.root_tweet_text || candidateData.candidate_content,
        root_tweet_id: candidate.candidate_tweet_id,
      },
    });
    
    let replyContent = routerResponse.text;
    if (Array.isArray(replyContent)) {
      replyContent = replyContent[0];
    }
    
    // Update decision with generated content
    await supabase
      .from('content_generation_metadata_comprehensive')
      .update({
        status: 'queued',
        content: replyContent,
      })
      .eq('decision_id', decisionId);
    
    await supabase
      .from('content_metadata')
      .update({
        status: 'queued',
        content: replyContent,
      })
      .eq('decision_id', decisionId);
    
    // Create reply opportunity (for compatibility)
    const { data: opportunity, error: oppError } = await supabase
      .from('reply_opportunities')
      .insert({
        target_tweet_id: candidate.candidate_tweet_id,
        target_username: candidateData.candidate_author_username,
        target_tweet_content: candidateData.candidate_content,
        is_root_tweet: true,
        source: 'tiered_scheduler',
        priority_score: candidate.overall_score,
        root_tweet_id: candidate.candidate_tweet_id,
      })
      .select()
      .single();
    
    if (oppError && !oppError.message.includes('duplicate')) {
      console.warn(`[SCHEDULER] Failed to create opportunity: ${oppError.message}`);
    }
    
    const replyDecisionId = decisionId;
    
    // Log SLO event (will be updated after posting completes)
    await supabase
      .from('reply_slo_events')
      .insert({
        scheduler_run_id: schedulerRunId,
        slot_time: slotTime.toISOString(),
        posted: true,
        reason: 'queued_for_posting',
        candidate_tweet_id: candidate.candidate_tweet_id,
        candidate_evaluation_id: candidate.evaluation_id,
        queue_id: queueId,
        predicted_tier: tier,
        decision_id: decisionId,
        queue_size: queueSize,
        tier_1_count: tier1Count,
        tier_2_count: tier2Count,
        tier_3_count: tier3Count,
        slo_hit: true,
        slo_target: TARGET_REPLIES_PER_HOUR,
      });
    
    // Update queue status
    await supabase
      .from('reply_candidate_queue')
      .update({
        status: 'posted',
        posted_at: new Date().toISOString(),
      })
      .eq('candidate_tweet_id', candidate.candidate_tweet_id);
    
    // Update evaluation status
    await supabase
      .from('candidate_evaluations')
      .update({
        status: 'posted',
        posted_at: new Date().toISOString(),
      })
      .eq('id', candidate.evaluation_id);
    
    console.log(`[SCHEDULER] ✅ Queued reply: ${replyDecisionId} to ${candidate.candidate_tweet_id}`);
    console.log(`[SCHEDULER] 🆔 Traceability: feed_run_id -> eval_id -> queue_id -> scheduler_run_id -> decision_id`);
    
    // Log job success to system_events
    try {
      await supabase.from('system_events').insert({
        event_type: 'reply_v2_scheduler_job_success',
        severity: 'info',
        message: `Reply V2 scheduler job success: posted=true decision_id=${replyDecisionId}`,
        event_data: { scheduler_run_id: schedulerRunId, decision_id: replyDecisionId, tier, posted: true },
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn(`[SCHEDULER] Failed to log job success: ${(e as Error).message}`);
    }
    
    // Queue will be processed by postingQueue job
    return {
      posted: true,
      candidate_tweet_id: candidate.candidate_tweet_id,
      tier: tier,
      reason: 'queued_for_posting',
      behind_schedule: behindSchedule,
    };
  } catch (error: any) {
    console.error(`[SCHEDULER] ❌ Failed to post reply: ${error.message}`);
    console.error(`[SCHEDULER] Stack: ${error.stack}`);
    
    // 🔒 MANDATE 2: Emit 'reply_v2_generation_failed' event
    try {
      await supabase.from('system_events').insert({
        event_type: 'reply_v2_generation_failed',
        severity: 'error',
        message: `Reply V2 generation failed: ${error.message}`,
        event_data: {
          decision_id: decisionId || 'unknown',
          permit_id: permit_id || 'unknown',
          candidate_id: candidate.candidate_tweet_id,
          scheduler_run_id: schedulerRunId,
          error: error.message,
          stack: error.stack?.substring(0, 1000),
        },
        created_at: new Date().toISOString(),
      });
    } catch (logError) {
      console.error(`[SCHEDULER] Failed to log generation failure: ${(logError as Error).message}`);
    }
    
    // Mark decision/permit as FAILED
    if (decisionId) {
      try {
        await supabase
          .from('content_generation_metadata_comprehensive')
          .update({
            status: 'failed',
            skip_reason: `generation_failed: ${error.message.substring(0, 200)}`,
          })
          .eq('decision_id', decisionId);
      } catch (updateError) {
        console.error(`[SCHEDULER] Failed to update decision status: ${(updateError as Error).message}`);
      }
    }
    
    if (permit_id) {
      try {
        const { markPermitFailed } = await import('../../posting/postingPermit');
        await markPermitFailed(permit_id, `Generation failed: ${error.message}`);
      } catch (permitError) {
        console.error(`[SCHEDULER] Failed to mark permit failed: ${(permitError as Error).message}`);
      }
    }
    
    // 🔒 CRITICAL: Reset candidate status to 'queued' on failure so it can be retried
    try {
      await supabase
        .from('reply_candidate_queue')
        .update({ 
          status: 'queued',
          selected_at: null, // Clear selection timestamp
        })
        .eq('candidate_tweet_id', candidate.candidate_tweet_id);
      console.log(`[SCHEDULER] ✅ Reset candidate ${candidate.candidate_tweet_id} to queued status`);
    } catch (resetError: any) {
      console.error(`[SCHEDULER] ❌ Failed to reset candidate status: ${resetError.message}`);
    }
    
    // Log SLO event for failure
    await supabase
      .from('reply_slo_events')
      .insert({
        scheduler_run_id: schedulerRunId,
        slot_time: slotTime.toISOString(),
        posted: false,
        reason: `posting_failed: ${error.message.substring(0, 100)}`,
        candidate_tweet_id: candidate.candidate_tweet_id,
        candidate_evaluation_id: candidate.evaluation_id,
        predicted_tier: tier,
        queue_size: queueSize,
        tier_1_count: tier1Count,
        tier_2_count: tier2Count,
        tier_3_count: tier3Count,
        slo_hit: false,
        slo_target: TARGET_REPLIES_PER_HOUR,
      });
    
    // Log job error to system_events with full stack trace
    try {
      await supabase.from('system_events').insert({
        event_type: 'reply_v2_scheduler_job_error',
        severity: 'error',
        message: `Reply V2 scheduler job error: ${error.message}`,
        event_data: { 
          scheduler_run_id: schedulerRunId, 
          error: error.message,
          stack: error.stack?.substring(0, 1000),
          candidate_tweet_id: candidate.candidate_tweet_id,
          tier,
          posted: false 
        },
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn(`[SCHEDULER] Failed to log job error: ${(e as Error).message}`);
    }
    
    return {
      posted: false,
      candidate_tweet_id: candidate.candidate_tweet_id,
      tier: tier,
      reason: error.message,
      behind_schedule: behindSchedule,
    };
  }
}

/**
 * Check if we're behind schedule (should have posted more replies)
 */
async function checkBehindSchedule(): Promise<boolean> {
  const supabase = getSupabaseClient();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  // Count replies posted in last hour
  const { data: recentReplies } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id')
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .gte('posted_at', oneHourAgo.toISOString());
  
  const repliesLastHour = recentReplies?.length || 0;
  const behindSchedule = repliesLastHour < TARGET_REPLIES_PER_HOUR;
  
  if (behindSchedule) {
    console.log(`[SCHEDULER] ⚠️ Behind schedule: ${repliesLastHour}/${TARGET_REPLIES_PER_HOUR} replies in last hour`);
  }
  
  return behindSchedule;
}

/**
 * Generate reply content for a candidate (simplified - uses existing reply generation)
 */
async function generateReplyContentForCandidate(targetContent: string): Promise<string> {
  // This would use the full LLM pipeline from replyJob
  // For now, return a placeholder that will be replaced by actual generation
  // In production, this would call the reply generation router
  return `Engaging reply to: ${targetContent.substring(0, 50)}...`;
}

