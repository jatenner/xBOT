/**
 * 🔄 ALLOW DECISION RESUMER
 * 
 * Finds ALLOW decisions stuck at template_status=PENDING and resumes them
 * Only touches ALLOW decisions (DENY decisions are handled by watchdog)
 */

import { getSupabaseClient } from '../../db';

const STALE_THRESHOLD_MINUTES = 5;

/**
 * Resume stuck ALLOW decisions
 */
export async function resumeStuckAllowDecisions(): Promise<{
  checked: number;
  resumed: number;
  failed: number;
  errors: number;
}> {
  const supabase = getSupabaseClient();
  
  // Find ALLOW decisions with PENDING status older than threshold
  const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MINUTES * 60 * 1000).toISOString();
  
  const { data: stuckRows, error: findError } = await supabase
    .from('reply_decisions')
    .select('id, decision_id, target_tweet_id, scored_at, template_status, template_selected_at, generation_started_at, generation_completed_at, posting_started_at, posted_reply_tweet_id, candidate_features, candidate_score')
    .eq('decision', 'ALLOW')
    .eq('template_status', 'PENDING')
    .lt('scored_at', staleThreshold)
    .is('template_selected_at', null);
  
  if (findError) {
    console.error(`[ALLOW_RESUMER] ❌ Error finding stuck rows: ${findError.message}`);
    return { checked: 0, resumed: 0, failed: 0, errors: 1 };
  }
  
  if (!stuckRows || stuckRows.length === 0) {
    return { checked: 0, resumed: 0, failed: 0, errors: 0 };
  }
  
  console.log(`[ALLOW_RESUMER] 🔄 Found ${stuckRows.length} stuck ALLOW decisions (older than ${STALE_THRESHOLD_MINUTES} minutes)`);
  
  let resumed = 0;
  let failed = 0;
  let errors = 0;
  
  for (const row of stuckRows) {
    try {
      const canonicalId = row.decision_id || row.id;
      
      // Try to resume by triggering template selection
      // Import scheduler logic to resume from template selection stage
      const { selectReplyTemplate } = await import('./replyTemplateSelector');
      
      // Extract candidate features for template selection
      const candidateFeatures = row.candidate_features as any || {};
      const topicRelevance = candidateFeatures.topic_relevance || 70; // Default to 70 if missing
      const candidateScore = row.candidate_score || 75; // Default to 75 if missing
      
      // Try to get topic from candidate_features or use default
      const topic = candidateFeatures.topic || candidateFeatures.keywords || 'general';
      const contentPreview = candidateFeatures.content_preview || `Tweet ${row.target_tweet_id}`;
      
      try {
        console.log(`[ALLOW_RESUMER] 🔄 Resuming decision id=${row.id} (decision_id=${canonicalId})`);
        
        // Select template
        const templateSelection = await selectReplyTemplate({
          topic_relevance_score: topicRelevance / 100, // Normalize to 0-1
          candidate_score: candidateScore,
          topic,
          content_preview: contentPreview,
        });
        
        if (!templateSelection || !templateSelection.template_id) {
          throw new Error('Template selection returned null or missing template_id');
        }
        
        // Update decision with template selection
        const templateSelectedAt = new Date().toISOString();
        const { error: updateError } = await supabase
          .from('reply_decisions')
          .update({
            template_selected_at: templateSelectedAt,
            template_id: templateSelection.template_id,
            prompt_version: templateSelection.prompt_version,
            template_status: 'SET',
            template_error_reason: null,
          })
          .eq('id', row.id);
        
        if (updateError) {
          throw new Error(`Update failed: ${updateError.message}`);
        }
        
        // Log success
        await supabase.from('system_events').insert({
          event_type: 'allow_resumer_resumed',
          severity: 'info',
          message: `Allow resumer resumed decision id=${row.id} (decision_id=${canonicalId})`,
          event_data: {
            decision_id: canonicalId,
            id: row.id,
            target_tweet_id: row.target_tweet_id,
            template_id: templateSelection.template_id,
            template_selected_at: templateSelectedAt,
          },
          created_at: new Date().toISOString(),
        });
        
        resumed++;
        console.log(`[ALLOW_RESUMER] ✅ Resumed decision id=${row.id} (decision_id=${canonicalId}) - template_id=${templateSelection.template_id}`);
        
      } catch (resumeError: any) {
        // Mark as FAILED if resume fails
        const errorReason = `RESUME_FAILED_${resumeError.message.replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 50)}`;
        const { error: failError } = await supabase
          .from('reply_decisions')
          .update({
            template_status: 'FAILED',
            template_error_reason: errorReason,
            pipeline_error_reason: errorReason,
            template_selected_at: new Date().toISOString(), // Mark as attempted
          })
          .eq('id', row.id);
        
        if (failError) {
          console.error(`[ALLOW_RESUMER] ❌ Failed to mark as FAILED: ${failError.message}`);
          errors++;
        } else {
          failed++;
          console.log(`[ALLOW_RESUMER] ⚠️ Marked decision id=${row.id} as FAILED: ${errorReason}`);
        }
      }
    } catch (error: any) {
      console.error(`[ALLOW_RESUMER] ❌ Exception processing row ${row.id}: ${error.message}`);
      errors++;
    }
  }
  
  // Log summary
  if (resumed > 0 || failed > 0) {
    await supabase.from('system_events').insert({
      event_type: 'allow_resumer_summary',
      severity: 'info',
      message: `Allow resumer processed ${stuckRows.length} stuck decisions: ${resumed} resumed, ${failed} failed`,
      event_data: {
        checked: stuckRows.length,
        resumed,
        failed,
        errors,
        threshold_minutes: STALE_THRESHOLD_MINUTES,
      },
      created_at: new Date().toISOString(),
    });
  }
  
  return {
    checked: stuckRows.length,
    resumed,
    failed,
    errors,
  };
}

/**
 * Run resumer job
 */
export async function runAllowResumer(): Promise<void> {
  console.log('[ALLOW_RESUMER] 🔄 Running allow decision resumer...');
  
  const result = await resumeStuckAllowDecisions();
  
  console.log(`[ALLOW_RESUMER] ✅ Resumer complete: checked=${result.checked}, resumed=${result.resumed}, failed=${result.failed}, errors=${result.errors}`);
  
  if (result.errors > 0) {
    console.warn(`[ALLOW_RESUMER] ⚠️ ${result.errors} errors occurred`);
  }
}
