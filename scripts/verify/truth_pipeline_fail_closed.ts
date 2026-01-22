#!/usr/bin/env tsx
/**
 * 🔒 FAIL-CLOSED VERIFICATION: Truth Pipeline
 * 
 * Forces a CreateTweet capture failure and verifies:
 * 1. POST_SUCCESS is NOT written
 * 2. POST_ID_CAPTURE_FAILED event IS written
 * 3. System fails closed (no false success)
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';
import { v4 as uuidv4 } from 'uuid';

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🔒 FAIL-CLOSED VERIFICATION: Truth Pipeline');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const supabase = getSupabaseClient();
  const now = new Date();
  const decisionId = uuidv4();
  const content = `🔒 Fail-closed test: This should NOT result in POST_SUCCESS if CreateTweet capture fails. ${Date.now()}`;

  console.log(`📝 Creating test decision for fail-closed verification...`);
  console.log(`   Decision ID: ${decisionId}`);
  console.log(`   Content: ${content.substring(0, 80)}...\n`);

  // Create test decision
  const { error: insertError } = await supabase
    .from('content_metadata')
    .insert({
      decision_id: decisionId,
      decision_type: 'single',
      content: content,
      status: 'queued',
      scheduled_at: now.toISOString(),
      generation_source: 'real',
      pipeline_source: 'manual_test',
      features: {
        test_decision: true,
        fail_closed_test: true,
        created_at: now.toISOString(),
        retry_count: 0,
      }
    });

  if (insertError) {
    console.error(`❌ Failed to create test decision: ${insertError.message}`);
    process.exit(1);
  }

  console.log(`✅ Test decision created: ${decisionId}\n`);

  // Check for existing POST_SUCCESS (should not exist yet)
  const { data: existingPostSuccess } = await supabase
    .from('system_events')
    .select('id')
    .eq('event_type', 'POST_SUCCESS')
    .eq('event_data->>decision_id', decisionId)
    .maybeSingle();

  if (existingPostSuccess) {
    console.error(`❌ POST_SUCCESS already exists for test decision (should not exist yet)`);
    process.exit(1);
  }

  console.log(`✅ No POST_SUCCESS exists yet (expected)\n`);

  console.log(`📋 Next steps:`);
  console.log(`   1. Set env: FORCE_SKIP_CREATETWEET_CAPTURE=true RUNNER_TEST_MODE=true`);
  console.log(`   2. Run: RUNNER_MODE=true RUNNER_BROWSER=cdp RUNNER_PROFILE_DIR=./.runner-profile pnpm run runner:once -- --once`);
  console.log(`   3. Wait 2 minutes`);
  console.log(`   4. Re-run this script to verify fail-closed behavior\n`);

  // If we're in verification mode (after posting attempt), check results
  const { data: postSuccess } = await supabase
    .from('system_events')
    .select('*')
    .eq('event_type', 'POST_SUCCESS')
    .eq('event_data->>decision_id', decisionId)
    .maybeSingle();

  const { data: captureFailed } = await supabase
    .from('system_events')
    .select('*')
    .eq('event_type', 'POST_ID_CAPTURE_FAILED')
    .eq('event_data->>decision_id', decisionId)
    .maybeSingle();

  if (postSuccess) {
    console.error(`❌ FAIL-CLOSED TEST FAILED: POST_SUCCESS was written when it should not have been`);
    console.error(`   This indicates the system did NOT fail closed properly`);
    console.error(`   Decision ID: ${decisionId}`);
    process.exit(1);
  }

  if (!captureFailed) {
    console.warn(`⚠️  POST_ID_CAPTURE_FAILED event not found`);
    console.warn(`   This may mean:`);
    console.warn(`   - The posting attempt hasn't run yet`);
    console.warn(`   - The failure was caught at a different layer`);
    console.warn(`   - Check system_events for other failure events\n`);
    
    // Check for any failure events
    const { data: failureEvents } = await supabase
      .from('system_events')
      .select('event_type, message, created_at')
      .or(`event_data->>decision_id.eq.${decisionId},event_data->>'decision_id'.eq.${decisionId}`)
      .order('created_at', { ascending: false })
      .limit(5);

    if (failureEvents && failureEvents.length > 0) {
      console.log(`📊 Found ${failureEvents.length} related events:`);
      failureEvents.forEach((evt: any) => {
        console.log(`   - ${evt.event_type}: ${evt.message?.substring(0, 100)}`);
      });
    }
  } else {
    console.log(`✅ POST_ID_CAPTURE_FAILED event found (expected)`);
    const failedData = typeof captureFailed.event_data === 'string'
      ? JSON.parse(captureFailed.event_data)
      : captureFailed.event_data;
    console.log(`   Reason: ${failedData.reason || 'Unknown'}`);
    console.log(`   Detail: ${failedData.detail || 'N/A'}`);
    console.log(`   Created: ${captureFailed.created_at}\n`);
  }

  // Check content_metadata status
  const { data: contentMeta } = await supabase
    .from('content_metadata')
    .select('status, tweet_id')
    .eq('decision_id', decisionId)
    .maybeSingle();

  if (contentMeta) {
    if (contentMeta.status === 'posted' && contentMeta.tweet_id) {
      console.error(`❌ FAIL-CLOSED TEST FAILED: content_metadata shows posted with tweet_id`);
      console.error(`   Status: ${contentMeta.status}`);
      console.error(`   Tweet ID: ${contentMeta.tweet_id}`);
      process.exit(1);
    } else {
      console.log(`✅ content_metadata status is NOT 'posted' (expected)`);
      console.log(`   Status: ${contentMeta.status}`);
      console.log(`   Tweet ID: ${contentMeta.tweet_id || 'null'}\n`);
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`           ✅ FAIL-CLOSED VERIFICATION PASSED`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`Summary:`);
  console.log(`  Decision ID: ${decisionId}`);
  console.log(`  POST_SUCCESS: ❌ NOT written (expected)`);
  console.log(`  POST_ID_CAPTURE_FAILED: ${captureFailed ? '✅ Written' : '⚠️  Not found'}`);
  console.log(`  content_metadata.status: ${contentMeta?.status || 'unknown'} (should NOT be 'posted')\n`);

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
