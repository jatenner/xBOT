#!/usr/bin/env tsx
/**
 * 🔍 PROVE GATES LIVE
 * 
 * Asserts POST_ATTEMPT exists in last 2h and at least one gate block exists;
 * otherwise says "not deployed".
 * 
 * Usage:
 *   railway run -s xBOT -- pnpm exec tsx scripts/prove-gates-live.ts
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db';

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🔍 PROVE GATES LIVE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const supabase = getSupabaseClient();
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  // Check 1: POST_ATTEMPT events in last 2h
  const { count: attemptCount } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'POST_ATTEMPT')
    .gte('created_at', twoHoursAgo);
  
  console.log(`1️⃣  POST_ATTEMPT events (last 2h): ${attemptCount || 0}`);
  
  if ((attemptCount || 0) === 0) {
    console.log('   ⚠️  No POST_ATTEMPT events found - gates may not be active\n');
  } else {
    console.log('   ✅ POST_ATTEMPT events exist\n');
  }
  
  // Check 2: Gate blocks in last 24h
  const gateReasons = [
    'LOW_SIGNAL_TARGET',
    'EMOJI_SPAM_TARGET',
    'PARODY_OR_BOT_SIGNAL',
    'NON_HEALTH_TOPIC',
    'TARGET_QUALITY_BLOCK',
    'UNGROUNDED_REPLY',
    'NON_ROOT',
    'SAFETY_GATE_THREAD_REPLY_FORBIDDEN',
  ];
  
  let totalBlocks = 0;
  const blockCounts: Record<string, number> = {};
  
  // Check system_events POST_FAILED
  const { data: failedEvents } = await supabase
    .from('system_events')
    .select('event_data')
    .eq('event_type', 'POST_FAILED')
    .gte('created_at', oneDayAgo);
  
  if (failedEvents) {
    for (const event of failedEvents) {
      const eventData = typeof event.event_data === 'string'
        ? JSON.parse(event.event_data)
        : event.event_data;
      
      const reason = eventData.deny_reason_code || eventData.pipeline_error_reason || 'OTHER';
      if (gateReasons.includes(reason)) {
        blockCounts[reason] = (blockCounts[reason] || 0) + 1;
        totalBlocks++;
      }
    }
  }
  
  // Check reply_decisions
  const { data: denyDecisions } = await supabase
    .from('reply_decisions')
    .select('deny_reason_code')
    .in('deny_reason_code', gateReasons)
    .gte('created_at', oneDayAgo);
  
  if (denyDecisions) {
    for (const decision of denyDecisions) {
      const reason = decision.deny_reason_code || 'OTHER';
      if (gateReasons.includes(reason)) {
        blockCounts[reason] = (blockCounts[reason] || 0) + 1;
        totalBlocks++;
      }
    }
  }
  
  console.log(`2️⃣  Gate blocks (last 24h): ${totalBlocks}`);
  
  if (totalBlocks > 0) {
    console.log('   ✅ Gate blocks detected - gates are active');
    console.log('   Breakdown:');
    for (const [reason, count] of Object.entries(blockCounts)) {
      console.log(`     ${reason}: ${count}`);
    }
  } else {
    console.log('   ⚠️  No gate blocks detected - gates may not be active');
  }
  
  console.log('');
  
  // Final verdict
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           📊 VERDICT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const gatesLive = (attemptCount || 0) > 0 && totalBlocks > 0;
  
  if (gatesLive) {
    console.log('✅ GATES ARE LIVE');
    console.log(`   - POST_ATTEMPT events: ${attemptCount || 0} (last 2h)`);
    console.log(`   - Gate blocks: ${totalBlocks} (last 24h)`);
  } else {
    console.log('❌ GATES NOT DEPLOYED OR NOT ACTIVE');
    if ((attemptCount || 0) === 0) {
      console.log('   - No POST_ATTEMPT events found');
    }
    if (totalBlocks === 0) {
      console.log('   - No gate blocks detected');
    }
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
