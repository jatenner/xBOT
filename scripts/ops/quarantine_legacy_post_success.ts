#!/usr/bin/env tsx
/**
 * 🔒 QUARANTINE LEGACY INVALID POST_SUCCESS
 * 
 * Moves POST_SUCCESS events with invalid tweet_ids (not 18-20 digits) to
 * POST_SUCCESS_LEGACY_INVALID for audit safety while cleaning the canonical stream.
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';
import { assertValidTweetId } from '../../src/posting/tweetIdValidator';

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🔒 QUARANTINE LEGACY INVALID POST_SUCCESS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const supabase = getSupabaseClient();

  // Find all POST_SUCCESS events
  const { data: allPostSuccess, error: queryError } = await supabase
    .from('system_events')
    .select('*')
    .eq('event_type', 'POST_SUCCESS')
    .order('created_at', { ascending: false });

  if (queryError) {
    console.error(`❌ Error querying POST_SUCCESS: ${queryError.message}`);
    process.exit(1);
  }

  if (!allPostSuccess || allPostSuccess.length === 0) {
    console.log('✅ No POST_SUCCESS events found');
    process.exit(0);
  }

  console.log(`📊 Found ${allPostSuccess.length} POST_SUCCESS events\n`);

  // Identify invalid events
  const invalidEvents: Array<{
    id: string;
    created_at: string;
    decision_id: string;
    tweet_id: string;
  }> = [];

  for (const event of allPostSuccess) {
    const eventData = typeof event.event_data === 'string'
      ? JSON.parse(event.event_data)
      : event.event_data;

    const tweetId = eventData.tweet_id;
    if (!tweetId) {
      console.warn(`⚠️  Event ${event.id} has no tweet_id in event_data`);
      continue;
    }

    const validation = assertValidTweetId(tweetId);
    if (!validation.valid) {
      invalidEvents.push({
        id: event.id,
        created_at: event.created_at,
        decision_id: eventData.decision_id || 'unknown',
        tweet_id: tweetId,
      });
    }
  }

  if (invalidEvents.length === 0) {
    console.log('✅ No invalid POST_SUCCESS events found - all are valid');
    process.exit(0);
  }

  console.log(`⚠️  Found ${invalidEvents.length} invalid POST_SUCCESS event(s) to quarantine:\n`);

  invalidEvents.forEach((evt, idx) => {
    console.log(`${idx + 1}. ID: ${evt.id}`);
    console.log(`   Created: ${evt.created_at}`);
    console.log(`   Decision ID: ${evt.decision_id}`);
    console.log(`   Tweet ID: ${evt.tweet_id} (${evt.tweet_id.length} digits - INVALID)\n`);
  });

  // Quarantine: Update event_type to POST_SUCCESS_LEGACY_INVALID
  console.log('🔒 Quarantining invalid events...\n');

  let quarantinedCount = 0;
  for (const evt of invalidEvents) {
    const { error: updateError } = await supabase
      .from('system_events')
      .update({
        event_type: 'POST_SUCCESS_LEGACY_INVALID',
        message: `Legacy invalid POST_SUCCESS (quarantined): tweet_id=${evt.tweet_id} has invalid format`,
      })
      .eq('id', evt.id);

    if (updateError) {
      console.error(`❌ Failed to quarantine event ${evt.id}: ${updateError.message}`);
      process.exit(1);
    }

    quarantinedCount++;
    console.log(`✅ Quarantined: ${evt.id} (tweet_id=${evt.tweet_id})`);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           ✅ QUARANTINE COMPLETE');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log(`Quarantined ${quarantinedCount} invalid POST_SUCCESS event(s)`);
  console.log(`Event type changed: POST_SUCCESS → POST_SUCCESS_LEGACY_INVALID`);
  console.log(`All other fields preserved for audit trail\n`);

  // Verify: Check that no invalid POST_SUCCESS remain
  const { data: remainingInvalid, error: verifyError } = await supabase
    .from('system_events')
    .select('id')
    .eq('event_type', 'POST_SUCCESS');

  if (verifyError) {
    console.error(`❌ Error verifying: ${verifyError.message}`);
    process.exit(1);
  }

  // Validate remaining POST_SUCCESS
  let remainingInvalidCount = 0;
  if (remainingInvalid) {
    for (const event of remainingInvalid) {
      const fullEvent = allPostSuccess.find(e => e.id === event.id);
      if (fullEvent) {
        const eventData = typeof fullEvent.event_data === 'string'
          ? JSON.parse(fullEvent.event_data)
          : fullEvent.event_data;
        const tweetId = eventData.tweet_id;
        if (tweetId) {
          const validation = assertValidTweetId(tweetId);
          if (!validation.valid) {
            remainingInvalidCount++;
          }
        }
      }
    }
  }

  if (remainingInvalidCount > 0) {
    console.error(`❌ FAIL: ${remainingInvalidCount} invalid POST_SUCCESS still remain`);
    process.exit(1);
  }

  console.log('✅ Verification: All remaining POST_SUCCESS events have valid tweet_ids');
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
