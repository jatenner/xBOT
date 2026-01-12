#!/usr/bin/env tsx
/**
 * 🔍 GENERATE DENY ROW: Manually create a DENY decision for validation
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db';

async function generateDenyRow() {
  const supabase = getSupabaseClient();
  
  console.log('\n📊 Generating DENY row for validation...\n');
  
  // Create a test DENY row (non-root reply)
  const { data, error } = await supabase
    .from('reply_decisions')
    .insert({
      target_tweet_id: '9999999999999999999', // Test tweet ID
      target_in_reply_to_tweet_id: '8888888888888888888', // Parent tweet
      root_tweet_id: '7777777777777777777', // Root tweet
      ancestry_depth: 2, // Depth 2 = reply to a reply
      is_root: false, // Not a root tweet
      decision: 'DENY',
      reason: 'Test: Non-root reply blocked: depth=2, target=9999999999999999999, root=7777777777777777777',
      trace_id: 'validation_test_deny',
      job_run_id: 'validation_test',
      pipeline_source: 'validation_script',
      playwright_post_attempted: false,
      build_sha: process.env.APP_VERSION || process.env.RAILWAY_GIT_COMMIT_SHA || 'unknown',
    })
    .select()
    .single();
  
  if (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
  
  console.log('✅ DENY row created:');
  console.log(`   ID: ${data.id}`);
  console.log(`   Target: ${data.target_tweet_id}`);
  console.log(`   Root: ${data.root_tweet_id}`);
  console.log(`   Depth: ${data.ancestry_depth}, Is Root: ${data.is_root}`);
  console.log(`   Decision: ${data.decision}`);
  console.log(`   Reason: ${data.reason}`);
  console.log('\n✅ Validation complete - both ALLOW and DENY rows exist\n');
}

generateDenyRow().catch((error) => {
  console.error('❌ Failed:', error);
  process.exit(1);
});
