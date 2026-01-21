#!/usr/bin/env tsx
/**
 * 🧪 SEED TEST DECISION
 * 
 * Creates a single test reply decision for manual CDP posting verification.
 * 
 * Usage:
 *   RUNNER_MODE=true RUNNER_PROFILE_DIR=./.runner-profile pnpm run runner:seed-decision -- --tweet_id=1234567890
 * 
 * Requirements:
 *   - RUNNER_MODE=true (safety guard)
 *   - --tweet_id required (target tweet ID to reply to)
 */

import { getSupabaseClient } from '../../src/db';
import { v4 as uuidv4 } from 'uuid';

const RUNNER_MODE = process.env.RUNNER_MODE === 'true';

// Parse command line args
const args = process.argv.slice(2);
const tweetIdArg = args.find(arg => arg.startsWith('--tweet_id='));
const tweetId = tweetIdArg ? tweetIdArg.split('=')[1] : null;

async function main() {
  // Safety guard: only run in RUNNER_MODE
  if (!RUNNER_MODE) {
    console.error('❌ ERROR: RUNNER_MODE must be true');
    console.error('   This script only runs in runner environment for safety');
    process.exit(1);
  }
  
  // Require tweet_id
  if (!tweetId) {
    console.error('❌ ERROR: --tweet_id required');
    console.error('   Usage: pnpm run runner:seed-decision -- --tweet_id=1234567890');
    process.exit(1);
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🧪 SEED TEST DECISION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log(`Target tweet ID: ${tweetId}`);
  console.log(`RUNNER_MODE: ${RUNNER_MODE}`);
  console.log('');
  
  const supabase = getSupabaseClient();
  
  // Generate decision_id (UUID)
  const decisionId = uuidv4();
  const now = new Date().toISOString();
  
  // Simple reply text
  const replyContent = "Quick note: sleep quality and sunlight timing matter more than most people think.";
  
  // Insert into content_metadata (what posting queue reads)
  const { data: inserted, error } = await supabase
    .from('content_metadata')
    .insert({
      decision_id: decisionId,
      decision_type: 'reply',
      content: replyContent,
      target_tweet_id: tweetId,
      target_username: null, // Optional - posting queue doesn't require it
      root_tweet_id: tweetId, // For replies, root = target
      status: 'queued',
      scheduled_at: now, // Immediately ready (no future deferral)
      pipeline_source: 'reply_v2_scheduler',
      bandit_arm: 'test',
      topic_cluster: 'test',
      predicted_er: 0.5,
      quality_score: 0.8,
      // Minimal required fields for posting queue
      target_tweet_content_snapshot: null,
      target_tweet_content_hash: null,
      semantic_similarity: null,
      // No retry deferral - features.retry_count = 0 (or not set)
      features: {
        retry_count: 0,
        seeded_for_testing: true,
        seeded_at: now
      },
      created_at: now,
      updated_at: now
    })
    .select('decision_id, scheduled_at, status, content')
    .single();
  
  if (error) {
    console.error('❌ Failed to insert test decision:', error.message);
    console.error('   Error code:', error.code);
    console.error('   Error details:', error.details);
    process.exit(1);
  }
  
  if (!inserted) {
    console.error('❌ No data returned from insert');
    process.exit(1);
  }
  
  console.log('✅ Test decision created successfully!');
  console.log('');
  console.log('📋 Decision Details:');
  console.log(`   decision_id: ${inserted.decision_id}`);
  console.log(`   status: ${inserted.status}`);
  console.log(`   scheduled_at: ${inserted.scheduled_at}`);
  console.log(`   content: "${inserted.content}"`);
  console.log(`   target_tweet_id: ${tweetId}`);
  console.log('');
  console.log('🧪 Next Steps:');
  console.log('   1. Run: RUNNER_MODE=true RUNNER_PROFILE_DIR=./.runner-profile RUNNER_BROWSER=cdp \\');
  console.log('            POSTING_BYPASS_RETRY_DEFERRAL=true pnpm run runner:once -- --once');
  console.log('   2. Verify: pnpm exec tsx scripts/verify-post-success.ts --minutes=60');
  console.log('');
}

main().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
