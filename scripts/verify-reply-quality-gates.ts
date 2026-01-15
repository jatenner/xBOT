#!/usr/bin/env tsx
/**
 * 🔒 VERIFY REPLY QUALITY GATES
 * 
 * Shows last 24h gate blocks by reason code
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
  
  if (!failedEvents || failedEvents.length === 0) {
    console.log('ℹ️  No POST_FAILED events found in last 24h\n');
    return;
  }
  
  // Categorize by deny_reason_code
  const gateBlocks: Record<string, number> = {
    'NON_ROOT': 0,
    'SAFETY_GATE_THREAD_REPLY_FORBIDDEN': 0,
    'LOW_SIGNAL_TARGET': 0,
    'EMOJI_SPAM_TARGET': 0,
    'PARODY_OR_BOT_SIGNAL': 0,
    'NON_HEALTH_TOPIC': 0,
    'UNGROUNDED_REPLY': 0,
    'OTHER': 0,
  };
  
  const gateDetails: Array<{
    created_at: string;
    deny_reason_code: string;
    decision_id: string;
    target_tweet_id: string;
    app_version: string;
  }> = [];
  
  for (const event of failedEvents) {
    const eventData = typeof event.event_data === 'string' 
      ? JSON.parse(event.event_data) 
      : event.event_data;
    
    const denyReason = eventData.deny_reason_code || 
                      eventData.pipeline_error_reason || 
                      'OTHER';
    
    // Map to gate categories
    if (denyReason === 'NON_ROOT' || denyReason.includes('NON_ROOT')) {
      gateBlocks['NON_ROOT']++;
    } else if (denyReason === 'SAFETY_GATE_THREAD_REPLY_FORBIDDEN' || denyReason.includes('THREAD_REPLY')) {
      gateBlocks['SAFETY_GATE_THREAD_REPLY_FORBIDDEN']++;
    } else if (denyReason === 'LOW_SIGNAL_TARGET') {
      gateBlocks['LOW_SIGNAL_TARGET']++;
    } else if (denyReason === 'EMOJI_SPAM_TARGET') {
      gateBlocks['EMOJI_SPAM_TARGET']++;
    } else if (denyReason === 'PARODY_OR_BOT_SIGNAL') {
      gateBlocks['PARODY_OR_BOT_SIGNAL']++;
    } else if (denyReason === 'NON_HEALTH_TOPIC') {
      gateBlocks['NON_HEALTH_TOPIC']++;
    } else if (denyReason === 'UNGROUNDED_REPLY') {
      gateBlocks['UNGROUNDED_REPLY']++;
    } else {
      gateBlocks['OTHER']++;
    }
    
    // Store details for top 10
    if (gateDetails.length < 10) {
      gateDetails.push({
        created_at: event.created_at,
        deny_reason_code: denyReason,
        decision_id: eventData.decision_id || 'N/A',
        target_tweet_id: eventData.target_tweet_id || 'N/A',
        app_version: eventData.app_version || 'unknown',
      });
    }
  }
  
  console.log('📊 GATE BLOCKS (Last 24h):\n');
  for (const [reason, count] of Object.entries(gateBlocks)) {
    if (count > 0) {
      console.log(`   ${reason}: ${count}`);
    }
  }
  
  // Query reply_decisions for additional context
  const { data: replyDecisions } = await supabase
    .from('reply_decisions')
    .select('decision_id, target_tweet_id, deny_reason_code, created_at')
    .not('deny_reason_code', 'is', null)
    .gte('created_at', oneDayAgo)
    .order('created_at', { ascending: false })
    .limit(20);
  
  if (replyDecisions && replyDecisions.length > 0) {
    console.log(`\n📋 REPLY_DECISIONS DENIES (Last 24h, top 20):\n`);
    const decisionBlocks: Record<string, number> = {};
    for (const decision of replyDecisions) {
      const reason = decision.deny_reason_code || 'UNKNOWN';
      decisionBlocks[reason] = (decisionBlocks[reason] || 0) + 1;
    }
    
    for (const [reason, count] of Object.entries(decisionBlocks)) {
      console.log(`   ${reason}: ${count}`);
    }
  }
  
  // Query POST_SUCCESS count
  const { count: successCount } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'POST_SUCCESS')
    .gte('created_at', oneDayAgo);
  
  console.log(`\n✅ POST_SUCCESS (Last 24h): ${successCount || 0}`);
  
  if (gateDetails.length > 0) {
    console.log(`\n📋 RECENT GATE BLOCKS (Top 10):\n`);
    gateDetails.forEach((detail, i) => {
      console.log(`${i + 1}. ${detail.created_at}`);
      console.log(`   deny_reason_code: ${detail.deny_reason_code}`);
      console.log(`   decision_id: ${detail.decision_id}`);
      console.log(`   target_tweet_id: ${detail.target_tweet_id}`);
      console.log(`   app_version: ${detail.app_version}`);
      console.log('');
    });
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
