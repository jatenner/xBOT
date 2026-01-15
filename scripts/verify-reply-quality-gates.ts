#!/usr/bin/env tsx
/**
 * 🔒 VERIFY REPLY QUALITY GATES
 * 
 * Prints last 24h blocks grouped by deny_reason_code and sub-reason,
 * shows 5 example tweet_ids each.
 * 
 * Usage:
 *   railway run -s xBOT -- pnpm exec tsx scripts/verify-reply-quality-gates.ts
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db';

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🔒 REPLY QUALITY GATES VERIFICATION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const supabase = getSupabaseClient();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  // Query POST_FAILED events with gate-related deny reasons
  const { data: failedEvents } = await supabase
    .from('system_events')
    .select('event_data, created_at')
    .eq('event_type', 'POST_FAILED')
    .gte('created_at', oneDayAgo)
    .order('created_at', { ascending: false });
  
  // Query reply_decisions for deny reasons
  const { data: denyDecisions } = await supabase
    .from('reply_decisions')
    .select('decision_id, target_tweet_id, deny_reason_code, deny_reason_detail, created_at')
    .not('deny_reason_code', 'is', null)
    .gte('created_at', oneDayAgo)
    .order('created_at', { ascending: false });
  
  if ((!failedEvents || failedEvents.length === 0) && (!denyDecisions || denyDecisions.length === 0)) {
    console.log('ℹ️  No gate blocks found in last 24h\n');
    return;
  }
  
  // Group by deny_reason_code
  const blocksByReason: Record<string, {
    count: number;
    examples: Array<{
      decision_id: string;
      target_tweet_id: string;
      created_at: string;
      detail?: any;
    }>;
  }> = {};
  
  // Process system_events POST_FAILED
  if (failedEvents) {
    for (const event of failedEvents) {
      const eventData = typeof event.event_data === 'string' 
        ? JSON.parse(event.event_data) 
        : event.event_data;
      
      const denyReason = eventData.deny_reason_code || 
                        eventData.pipeline_error_reason || 
                        'OTHER';
      
      if (!blocksByReason[denyReason]) {
        blocksByReason[denyReason] = { count: 0, examples: [] };
      }
      
      blocksByReason[denyReason].count++;
      
      if (blocksByReason[denyReason].examples.length < 5) {
        blocksByReason[denyReason].examples.push({
          decision_id: eventData.decision_id || 'N/A',
          target_tweet_id: eventData.target_tweet_id || 'N/A',
          created_at: event.created_at,
          detail: eventData.detail || eventData.quality_filter_details || eventData.grounding_evidence
        });
      }
    }
  }
  
  // Process reply_decisions denies
  if (denyDecisions) {
    for (const decision of denyDecisions) {
      const denyReason = decision.deny_reason_code || 'OTHER';
      
      if (!blocksByReason[denyReason]) {
        blocksByReason[denyReason] = { count: 0, examples: [] };
      }
      
      blocksByReason[denyReason].count++;
      
      if (blocksByReason[denyReason].examples.length < 5) {
        let detail: any = null;
        if (decision.deny_reason_detail) {
          try {
            detail = typeof decision.deny_reason_detail === 'string' 
              ? JSON.parse(decision.deny_reason_detail)
              : decision.deny_reason_detail;
          } catch (e) {
            detail = decision.deny_reason_detail;
          }
        }
        
        blocksByReason[denyReason].examples.push({
          decision_id: decision.decision_id,
          target_tweet_id: decision.target_tweet_id,
          created_at: decision.created_at,
          detail: detail
        });
      }
    }
  }
  
  console.log('📊 GATE BLOCKS BY DENY_REASON_CODE (Last 24h):\n');
  
  const sortedReasons = Object.entries(blocksByReason).sort((a, b) => b[1].count - a[1].count);
  
  for (const [reason, data] of sortedReasons) {
    console.log(`${reason}: ${data.count} blocks`);
    
    if (data.examples.length > 0) {
      console.log(`   Examples (${data.examples.length}):`);
      for (const example of data.examples) {
        console.log(`     - decision_id: ${example.decision_id}`);
        console.log(`       target_tweet_id: ${example.target_tweet_id}`);
        console.log(`       created_at: ${example.created_at}`);
        if (example.detail) {
          const detailStr = typeof example.detail === 'string' 
            ? example.detail 
            : JSON.stringify(example.detail).substring(0, 100);
          console.log(`       detail: ${detailStr}...`);
        }
      }
    }
    console.log('');
  }
  
  // Query POST_SUCCESS count
  const { count: successCount } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'POST_SUCCESS')
    .gte('created_at', oneDayAgo);
  
  console.log(`✅ POST_SUCCESS (Last 24h): ${successCount || 0}\n`);
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
