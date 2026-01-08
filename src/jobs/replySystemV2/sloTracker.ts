/**
 * 📊 SLO TRACKER
 * 
 * Updates SLO events after posting completes
 */

import { getSupabaseClient } from '../../db/index';

/**
 * Update SLO event after posting completes
 */
export async function updateSloEventAfterPosting(
  decisionId: string,
  permitId: string,
  tweetId: string
): Promise<void> {
  const supabase = getSupabaseClient();
  
  // Find SLO event for this decision
  const { data: sloEvent } = await supabase
    .from('reply_slo_events')
    .select('*')
    .eq('decision_id', decisionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (sloEvent) {
    await supabase
      .from('reply_slo_events')
      .update({
        permit_id: permitId,
        posted_tweet_id: tweetId,
        posted: true,
        slo_hit: true,
        reason: 'posted_successfully',
      })
      .eq('id', sloEvent.id);
    
    console.log(`[SLO_TRACKER] ✅ Updated SLO event for decision ${decisionId}`);
  }
}

/**
 * Update SLO event if posting failed
 */
export async function updateSloEventOnFailure(
  decisionId: string,
  reason: string
): Promise<void> {
  const supabase = getSupabaseClient();
  
  const { data: sloEvent } = await supabase
    .from('reply_slo_events')
    .select('*')
    .eq('decision_id', decisionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (sloEvent) {
    await supabase
      .from('reply_slo_events')
      .update({
        posted: false,
        slo_hit: false,
        reason: `posting_failed: ${reason}`,
      })
      .eq('id', sloEvent.id);
    
    console.log(`[SLO_TRACKER] ❌ Updated SLO event for failed decision ${decisionId}`);
  }
}

