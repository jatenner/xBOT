#!/usr/bin/env tsx
/**
 * 🔍 PROVE POSTING READY
 * 
 * Asserts:
 * - Deployment integrity (git_sha/app_version match expected)
 * - POST_ATTEMPT events exist
 * - Non-zero blocks for quality/grounding (proves gates active)
 * 
 * Usage:
 *   railway run -s xBOT -- pnpm exec tsx scripts/prove-posting-ready.ts
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db';

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🔍 PROVE POSTING READY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const supabase = getSupabaseClient();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  // 1. Check deployment integrity
  console.log('1️⃣  DEPLOYMENT INTEGRITY:\n');
  
  const gitSha = process.env.GIT_SHA || process.env.RAILWAY_GIT_COMMIT_SHA || 'unknown';
  const appVersion = process.env.APP_VERSION || gitSha;
  
  console.log(`   git_sha: ${gitSha}`);
  console.log(`   app_version: ${appVersion}`);
  
  if (gitSha === 'unknown' || appVersion === 'unknown') {
    console.log('   ⚠️  WARNING: git_sha/app_version not set\n');
  } else {
    console.log('   ✅ Deployment version tracked\n');
  }
  
  // 2. Check POST_ATTEMPT events exist
  console.log('2️⃣  POST_ATTEMPT EVENTS:\n');
  
  const { count: attemptCount } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'POST_ATTEMPT')
    .gte('created_at', oneDayAgo);
  
  console.log(`   POST_ATTEMPT events (last 24h): ${attemptCount || 0}`);
  
  if ((attemptCount || 0) > 0) {
    // Get sample POST_ATTEMPT to verify structure
    const { data: sampleAttempt } = await supabase
      .from('system_events')
      .select('event_data, created_at')
      .eq('event_type', 'POST_ATTEMPT')
      .gte('created_at', oneDayAgo)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (sampleAttempt?.event_data) {
      const eventData = typeof sampleAttempt.event_data === 'string'
        ? JSON.parse(sampleAttempt.event_data)
        : sampleAttempt.event_data;
      
      console.log(`   ✅ Sample POST_ATTEMPT found:`);
      console.log(`      decision_id: ${eventData.decision_id || 'N/A'}`);
      console.log(`      app_version: ${eventData.app_version || 'N/A'}`);
      console.log(`      target_tweet_id: ${eventData.target_tweet_id || 'N/A'}`);
      console.log(`      gate_result: ${eventData.gate_result || 'N/A'}`);
      console.log(`      created_at: ${sampleAttempt.created_at}`);
      
      if (!eventData.app_version || eventData.app_version === 'unknown') {
        console.log(`   ⚠️  WARNING: app_version missing in POST_ATTEMPT`);
      } else {
        console.log(`   ✅ app_version present in POST_ATTEMPT`);
      }
    }
  } else {
    console.log('   ⚠️  WARNING: No POST_ATTEMPT events found (gates may not be active)');
  }
  
  console.log('');
  
  // 3. Check gate blocks (quality/grounding)
  console.log('3️⃣  GATE BLOCKS (Quality/Grounding):\n');
  
  // Quality blocks from reply_decisions
  const { count: lowSignal } = await supabase
    .from('reply_decisions')
    .select('*', { count: 'exact', head: true })
    .eq('deny_reason_code', 'LOW_SIGNAL_TARGET')
    .gte('created_at', oneDayAgo);
  
  const { count: emojiSpam } = await supabase
    .from('reply_decisions')
    .select('*', { count: 'exact', head: true })
    .eq('deny_reason_code', 'EMOJI_SPAM_TARGET')
    .gte('created_at', oneDayAgo);
  
  const { count: parodyBot } = await supabase
    .from('reply_decisions')
    .select('*', { count: 'exact', head: true })
    .eq('deny_reason_code', 'PARODY_OR_BOT_SIGNAL')
    .gte('created_at', oneDayAgo);
  
  const { count: nonHealth } = await supabase
    .from('reply_decisions')
    .select('*', { count: 'exact', head: true })
    .eq('deny_reason_code', 'NON_HEALTH_TOPIC')
    .gte('created_at', oneDayAgo);
  
  const { count: targetQuality } = await supabase
    .from('reply_decisions')
    .select('*', { count: 'exact', head: true })
    .eq('deny_reason_code', 'TARGET_QUALITY_BLOCK')
    .gte('created_at', oneDayAgo);
  
  // Grounding blocks
  const { count: ungrounded } = await supabase
    .from('reply_decisions')
    .select('*', { count: 'exact', head: true })
    .eq('deny_reason_code', 'UNGROUNDED_REPLY')
    .gte('created_at', oneDayAgo);
  
  // Also check system_events for UNGROUNDED_REPLY
  const { data: ungroundedEvents } = await supabase
    .from('system_events')
    .select('event_data')
    .eq('event_type', 'POST_FAILED')
    .gte('created_at', oneDayAgo);
  
  let ungroundedFromEvents = 0;
  if (ungroundedEvents) {
    for (const event of ungroundedEvents) {
      const eventData = typeof event.event_data === 'string'
        ? JSON.parse(event.event_data)
        : event.event_data;
      if (eventData.deny_reason_code === 'UNGROUNDED_REPLY' || 
          eventData.pipeline_error_reason?.includes('UNGROUNDED_REPLY')) {
        ungroundedFromEvents++;
      }
    }
  }
  
  console.log(`   LOW_SIGNAL_TARGET: ${lowSignal || 0}`);
  console.log(`   EMOJI_SPAM_TARGET: ${emojiSpam || 0}`);
  console.log(`   PARODY_OR_BOT_SIGNAL: ${parodyBot || 0}`);
  console.log(`   NON_HEALTH_TOPIC: ${nonHealth || 0}`);
  console.log(`   TARGET_QUALITY_BLOCK: ${targetQuality || 0}`);
  console.log(`   UNGROUNDED_REPLY: ${(ungrounded || 0) + ungroundedFromEvents}`);
  
  const totalQualityBlocks = (lowSignal || 0) + (emojiSpam || 0) + (parodyBot || 0) + (nonHealth || 0) + (targetQuality || 0);
  const totalGroundingBlocks = (ungrounded || 0) + ungroundedFromEvents;
  
  console.log(`\n   Total Quality Blocks: ${totalQualityBlocks}`);
  console.log(`   Total Grounding Blocks: ${totalGroundingBlocks}`);
  
  if (totalQualityBlocks > 0 || totalGroundingBlocks > 0) {
    console.log(`   ✅ Gates are active (blocks detected)`);
  } else {
    console.log(`   ⚠️  WARNING: No quality/grounding blocks detected (gates may not be active)`);
  }
  
  console.log('');
  
  // 4. Check POST_SUCCESS/POST_FAILED
  console.log('4️⃣  POSTING OUTCOMES:\n');
  
  const { count: successCount } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'POST_SUCCESS')
    .gte('created_at', oneDayAgo);
  
  const { count: failedCount } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'POST_FAILED')
    .gte('created_at', oneDayAgo);
  
  console.log(`   POST_SUCCESS: ${successCount || 0}`);
  console.log(`   POST_FAILED: ${failedCount || 0}`);
  
  // Verify POST_SUCCESS includes app_version
  if ((successCount || 0) > 0) {
    const { data: sampleSuccess } = await supabase
      .from('system_events')
      .select('event_data')
      .eq('event_type', 'POST_SUCCESS')
      .gte('created_at', oneDayAgo)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (sampleSuccess?.event_data) {
      const eventData = typeof sampleSuccess.event_data === 'string'
        ? JSON.parse(sampleSuccess.event_data)
        : sampleSuccess.event_data;
      
      if (eventData.app_version && eventData.app_version !== 'unknown') {
        console.log(`   ✅ POST_SUCCESS includes app_version`);
      } else {
        console.log(`   ⚠️  WARNING: POST_SUCCESS missing app_version`);
      }
    }
  }
  
  console.log('');
  
  // Summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           📊 SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const allChecksPass = 
    (gitSha !== 'unknown' && appVersion !== 'unknown') &&
    (attemptCount || 0) > 0 &&
    (totalQualityBlocks > 0 || totalGroundingBlocks > 0);
  
  if (allChecksPass) {
    console.log('✅ POSTING READY: All checks passed');
    console.log(`   - Deployment tracked: ${appVersion}`);
    console.log(`   - POST_ATTEMPT events: ${attemptCount || 0}`);
    console.log(`   - Quality blocks: ${totalQualityBlocks}`);
    console.log(`   - Grounding blocks: ${totalGroundingBlocks}`);
  } else {
    console.log('⚠️  POSTING NOT READY: Some checks failed');
    if (gitSha === 'unknown' || appVersion === 'unknown') {
      console.log('   - Deployment version not tracked');
    }
    if ((attemptCount || 0) === 0) {
      console.log('   - No POST_ATTEMPT events found');
    }
    if (totalQualityBlocks === 0 && totalGroundingBlocks === 0) {
      console.log('   - No quality/grounding blocks detected');
    }
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
