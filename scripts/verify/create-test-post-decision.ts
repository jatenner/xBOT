#!/usr/bin/env tsx
/**
 * 🧪 CREATE TEST POST DECISION
 * 
 * Creates a single test post decision for verifying the test/prod lane guardrail.
 * This script sets is_test_post=true and is used to prove the guardrail works.
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';
import { v4 as uuidv4 } from 'uuid';

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🧪 CREATE TEST POST DECISION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const supabase = getSupabaseClient();
  const now = new Date();
  const decisionId = uuidv4();
  const content = `🧪 Test post for PROD/TEST lane verification. This should be blocked unless ALLOW_TEST_POSTS=true. ${Date.now()}`;

  console.log(`📝 Creating test decision...`);
  console.log(`   Decision ID: ${decisionId}`);
  console.log(`   Content: ${content.substring(0, 80)}...`);
  console.log(`   is_test_post: true\n`);

  // Create test decision with is_test_post=true
  const { data: inserted, error: insertError } = await supabase
    .from('content_metadata')
    .insert({
      decision_id: decisionId,
      decision_type: 'single',
      content: content,
      status: 'queued',
      scheduled_at: now.toISOString(),
      generation_source: 'real',
      pipeline_source: 'manual_test',
      is_test_post: true, // 🔒 TEST LANE: Mark as test post
      features: {
        test_decision: true,
        created_at: now.toISOString(),
        retry_count: 0,
      }
    })
    .select('decision_id, status, scheduled_at, is_test_post')
    .single();

  if (insertError) {
    console.error(`❌ Failed to create test decision: ${insertError.message}`);
    process.exit(1);
  }

  console.log(`✅ Test decision created successfully!`);
  console.log(`   Decision ID: ${inserted.decision_id}`);
  console.log(`   Status: ${inserted.status}`);
  console.log(`   Scheduled At: ${inserted.scheduled_at}`);
  console.log(`   is_test_post: ${inserted.is_test_post}\n`);

  console.log(`📋 Next Steps:`);
  console.log(`   1. WITHOUT ALLOW_TEST_POSTS: Run posting queue and verify it's blocked`);
  console.log(`      RUNNER_MODE=true RUNNER_BROWSER=cdp RUNNER_PROFILE_DIR=./.runner-profile \\`);
  console.log(`      pnpm run runner:once -- --once`);
  console.log(`      (Should see [TEST_LANE_BLOCK] in logs)`);
  console.log(``);
  console.log(`   2. WITH ALLOW_TEST_POSTS=true: Run posting queue and verify it posts`);
  console.log(`      RUNNER_MODE=true RUNNER_BROWSER=cdp RUNNER_PROFILE_DIR=./.runner-profile \\`);
  console.log(`      ALLOW_TEST_POSTS=true pnpm run runner:once -- --once`);
  console.log(`      (Should see POST_SUCCESS in system_events)\n`);

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
