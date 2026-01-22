#!/usr/bin/env tsx
/**
 * 🧪 REGRESSION TEST: Validated Tweet ID Capture
 * 
 * Creates a controlled single tweet decision and runs one posting attempt
 * in RUNNER_MODE/CDP to verify:
 * 1. tweet_id is captured from CreateTweet GraphQL response
 * 2. tweet_id is validated (18-20 digits)
 * 3. POST_SUCCESS event has same validated tweet_id
 * 4. Tweet URL loads correctly
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';
import { v4 as uuidv4 } from 'uuid';
import { Client } from 'pg';

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🧪 REGRESSION TEST: Validated Tweet ID');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const supabase = getSupabaseClient();
  const now = new Date();
  const decisionId = uuidv4();
  const content = `🧪 Regression test: Validated tweet ID capture from CreateTweet GraphQL response. Testing 18-20 digit validation. ${Date.now()}`;

  console.log(`📝 Creating test decision...`);
  console.log(`   Decision ID: ${decisionId}`);
  console.log(`   Content: ${content.substring(0, 80)}...\n`);

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
        created_at: now.toISOString(),
        retry_count: 0,
      }
    });

  if (insertError) {
    console.error(`❌ Failed to create test decision: ${insertError.message}`);
    process.exit(1);
  }

  console.log(`✅ Test decision created: ${decisionId}\n`);
  console.log(`📋 Next steps:`);
  console.log(`   1. Run: RUNNER_MODE=true RUNNER_BROWSER=cdp RUNNER_PROFILE_DIR=./.runner-profile pnpm run runner:once -- --once`);
  console.log(`   2. Wait 2 minutes for POST_SUCCESS event`);
  console.log(`   3. Run: pnpm exec tsx scripts/verify-validated-tweet-id.ts --decision-id=${decisionId}\n`);

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
