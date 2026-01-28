/**
 * 🎯 REPLY V2 PLANNER FINALIZATION
 * 
 * Finalizes planner decisions created in PLAN_ONLY mode:
 * - Sets status='queued' for Mac Runner execution
 * - Populates features with strategy attribution and plan_mode
 * - Updates both base table and view
 */

import { getSupabaseClient } from '../../db/index';

export interface PlannerFinalizeFields {
  strategy_id: string;
  strategy_version: string;
  selection_mode: 'explore' | 'exploit' | 'fallback';
  strategy_description: string;
  targeting_score_total: number;
  topic_fit: number;
  score_bucket: string;
  root_tweet_id?: string; // Required for FINAL_REPLY_GATE
  target_tweet_id?: string; // Required for posting
}

/**
 * Finalize a planner decision: set status='queued' and populate features
 */
export async function plannerFinalizeDecision(
  decisionId: string,
  fields: PlannerFinalizeFields
): Promise<{ success: boolean; error?: string }> {
  const supabase = getSupabaseClient();
  
  try {
    console.log(`[REPLY_V2_PLANNER_FINALIZE] Finalizing decision_id=${decisionId} strategy=${fields.strategy_id}`);
    
    // Build features object
    const features = {
      plan_mode: 'railway',
      strategy_id: fields.strategy_id,
      strategy_version: fields.strategy_version,
      selection_mode: fields.selection_mode,
      strategy_description: fields.strategy_description,
      targeting_score_total: fields.targeting_score_total,
      topic_fit: fields.topic_fit,
      score_bucket: fields.score_bucket,
    };
    
    // Update base table (content_generation_metadata_comprehensive)
    const scheduledAt = new Date().toISOString(); // Set scheduled_at for posting queue
    const updatePayload: any = {
      status: 'queued',
      content: '[PLAN_ONLY - Pending Mac Runner execution]',
      pipeline_source: 'reply_v2_planner',
      scheduled_at: scheduledAt, // Required for posting queue to pick up
      features: features,
    };
    
    // Set root_tweet_id if provided (required for FINAL_REPLY_GATE)
    if (fields.root_tweet_id) {
      updatePayload.root_tweet_id = fields.root_tweet_id;
    }
    
    // Set target_tweet_id if provided (required for posting)
    if (fields.target_tweet_id) {
      updatePayload.target_tweet_id = fields.target_tweet_id;
    }
    
    const { error: updateError1 } = await supabase
      .from('content_generation_metadata_comprehensive')
      .update(updatePayload)
      .eq('decision_id', decisionId);
    
    if (updateError1) {
      const errorMsg = `Failed to update base table: ${updateError1.message}`;
      console.error(`[REPLY_V2_PLANNER_FINALIZE] ❌ ${errorMsg}`);
      
      // Log failure to system_events
      await supabase.from('system_events').insert({
        event_type: 'reply_v2_planner_finalize_failed',
        severity: 'error',
        message: `Planner finalize failed: decision_id=${decisionId}`,
        event_data: {
          decision_id: decisionId,
          error: errorMsg,
          update_target: 'content_generation_metadata_comprehensive',
        },
        created_at: new Date().toISOString(),
      });
      
      return { success: false, error: errorMsg };
    }
    
    // Also update content_metadata view (for consistency)
    // Note: This may fail silently if view doesn't support updates, but base table update is primary
    const { error: updateError2 } = await supabase
      .from('content_metadata')
      .update({
        status: 'queued',
        content: '[PLAN_ONLY - Pending Mac Runner execution]',
        scheduled_at: scheduledAt, // Required for posting queue to pick up
        features: features,
      })
      .eq('decision_id', decisionId);
    
    if (updateError2) {
      // Log warning but don't fail (view updates may not be supported)
      console.warn(`[REPLY_V2_PLANNER_FINALIZE] ⚠️ View update failed (non-critical): ${updateError2.message}`);
    }
    
    console.log(`[REPLY_V2_PLANNER_FINALIZE] ✅ Decision finalized: decision_id=${decisionId} status=queued strategy=${fields.strategy_id}`);
    
    return { success: true };
  } catch (error: any) {
    const errorMsg = `Unexpected error: ${error.message}`;
    console.error(`[REPLY_V2_PLANNER_FINALIZE] ❌ ${errorMsg}`);
    
    // Log failure to system_events
    await supabase.from('system_events').insert({
      event_type: 'reply_v2_planner_finalize_failed',
      severity: 'error',
      message: `Planner finalize failed: decision_id=${decisionId}`,
      event_data: {
        decision_id: decisionId,
        error: errorMsg,
        stack: error.stack,
      },
      created_at: new Date().toISOString(),
    });
    
    return { success: false, error: errorMsg };
  }
}
