/**
 * 🐕 TEMPLATE STATUS WATCHDOG
 * 
 * Marks stale PENDING rows (ALLOW decisions older than 10 minutes) as FAILED
 * Only touches ALLOW decisions (DENY decisions can stay PENDING)
 */

import { getSupabaseClient } from '../../db';

const STALE_THRESHOLD_MINUTES = 10;

/**
 * Mark stale PENDING rows as FAILED (stage-aware)
 */
export async function markStalePendingRows(): Promise<{
  checked: number;
  marked_failed: number;
  errors: number;
}> {
  const supabase = getSupabaseClient();
  
  // Find ALLOW decisions with PENDING status older than threshold
  const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MINUTES * 60 * 1000).toISOString();
  
  const { data: staleRows, error: findError } = await supabase
    .from('reply_decisions')
    .select('id, decision_id, target_tweet_id, created_at, template_selected_at, generation_started_at, generation_completed_at, posting_started_at, posted_reply_tweet_id')
    .eq('decision', 'ALLOW')
    .eq('template_status', 'PENDING')
    .lt('created_at', staleThreshold);
  
  if (findError) {
    console.error(`[TEMPLATE_WATCHDOG] ❌ Error finding stale rows: ${findError.message}`);
    return { checked: 0, marked_failed: 0, errors: 1 };
  }
  
  if (!staleRows || staleRows.length === 0) {
    return { checked: 0, marked_failed: 0, errors: 0 };
  }
  
  console.log(`[TEMPLATE_WATCHDOG] 🐕 Found ${staleRows.length} stale PENDING rows (ALLOW decisions older than ${STALE_THRESHOLD_MINUTES} minutes)`);
  
  let markedFailed = 0;
  let errors = 0;
  
  for (const row of staleRows) {
    try {
      // 🎯 PIPELINE STAGES: Determine exact failure stage
      let pipelineErrorReason: string;
      if (!row.template_selected_at) {
        pipelineErrorReason = 'TEMPLATE_SELECTION_TIMEOUT';
      } else if (!row.generation_started_at) {
        pipelineErrorReason = 'GENERATION_NOT_STARTED_TIMEOUT';
      } else if (!row.generation_completed_at) {
        pipelineErrorReason = 'GENERATION_TIMEOUT';
      } else if (!row.posted_reply_tweet_id) {
        pipelineErrorReason = 'POSTING_TIMEOUT';
      } else {
        // Should not happen - has posted_reply_tweet_id but still PENDING
        pipelineErrorReason = 'UNEXPECTED_STATE';
      }
      
      const { error: updateError } = await supabase
        .from('reply_decisions')
        .update({
          template_status: 'FAILED',
          template_error_reason: pipelineErrorReason,
          pipeline_error_reason: pipelineErrorReason, // 🎯 PIPELINE STAGES
        })
        .eq('id', row.id);
      
      if (updateError) {
        console.error(`[TEMPLATE_WATCHDOG] ❌ Failed to mark row ${row.id} as FAILED: ${updateError.message}`);
        errors++;
      } else {
        markedFailed++;
        console.log(`[TEMPLATE_WATCHDOG] ✅ Marked decision_id=${row.decision_id || 'N/A'} (id=${row.id}) as FAILED: ${pipelineErrorReason}`);
      }
    } catch (error: any) {
      console.error(`[TEMPLATE_WATCHDOG] ❌ Exception marking row ${row.id}: ${error.message}`);
      errors++;
    }
  }
  
  // Log summary
  if (markedFailed > 0) {
    await supabase.from('system_events').insert({
      event_type: 'template_watchdog_marked_failed',
      severity: 'warning',
      message: `Template watchdog marked ${markedFailed} stale PENDING rows as FAILED`,
      event_data: {
        marked_failed: markedFailed,
        threshold_minutes: STALE_THRESHOLD_MINUTES,
        stale_rows: staleRows.map(r => ({
          id: r.id,
          decision_id: r.decision_id,
          target_tweet_id: r.target_tweet_id,
          created_at: r.created_at,
        })),
      },
      created_at: new Date().toISOString(),
    });
  }
  
  return {
    checked: staleRows.length,
    marked_failed: markedFailed,
    errors,
  };
}

/**
 * Run watchdog job
 */
export async function runTemplateStatusWatchdog(): Promise<void> {
  console.log('[TEMPLATE_WATCHDOG] 🐕 Running template status watchdog...');
  
  const result = await markStalePendingRows();
  
  console.log(`[TEMPLATE_WATCHDOG] ✅ Watchdog complete: checked=${result.checked}, marked_failed=${result.marked_failed}, errors=${result.errors}`);
  
  if (result.errors > 0) {
    console.warn(`[TEMPLATE_WATCHDOG] ⚠️ ${result.errors} errors occurred`);
  }
}
