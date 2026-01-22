#!/usr/bin/env tsx
/**
 * 🧪 CREATE TEST REPLY DECISION
 * 
 * Creates a single test reply decision for E2E reply truth pipeline verification.
 * This script sets is_test_post=true and targets a known tweet.
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';
import { v4 as uuidv4 } from 'uuid';

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🧪 CREATE TEST REPLY DECISION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const supabase = getSupabaseClient();
  const now = new Date();
  const decisionId = uuidv4();

  // Find the most recent successful tweet from our account
  console.log('🔍 Finding most recent successful tweet from our account...');
  const { data: recentTweets, error: tweetError } = await supabase
    .from('content_metadata')
    .select('tweet_id, content, posted_at, decision_type')
    .eq('status', 'posted')
    .not('tweet_id', 'is', null)
    .order('posted_at', { ascending: false })
    .limit(1);

  if (tweetError || !recentTweets || recentTweets.length === 0) {
    console.error('❌ Failed to find recent tweet:', tweetError?.message);
    console.error('💡 Using fallback target_tweet_id from environment or default');
    
    // Fallback: use environment variable or a known tweet ID
    const fallbackTweetId = process.env.TEST_REPLY_TARGET_TWEET_ID || '1234567890123456789';
    console.log(`   Using fallback: ${fallbackTweetId}`);
    
    await createTestReply(supabase, decisionId, now, fallbackTweetId);
    return;
  }

  const targetTweet = recentTweets[0];
  const targetTweetId = targetTweet.tweet_id;
  
  console.log(`✅ Found target tweet:`);
  console.log(`   Tweet ID: ${targetTweetId}`);
  console.log(`   Posted at: ${targetTweet.posted_at}`);
  console.log(`   Content preview: ${targetTweet.content?.substring(0, 60)}...\n`);

  await createTestReply(supabase, decisionId, now, targetTweetId);
}

async function createTestReply(supabase: any, decisionId: string, now: Date, targetTweetId: string) {
  const content = `🧪 Test reply for REPLY truth pipeline verification. This should be blocked unless ALLOW_TEST_POSTS=true. ${Date.now()}`;

  console.log(`📝 Creating test reply decision...`);
  console.log(`   Decision ID: ${decisionId}`);
  console.log(`   Target Tweet ID: ${targetTweetId}`);
  console.log(`   Content: ${content.substring(0, 80)}...`);
  console.log(`   is_test_post: true\n`);

  // Create test reply decision with is_test_post=true
  const { data: inserted, error: insertError } = await supabase
    .from('content_generation_metadata_comprehensive')
    .insert({
      decision_id: decisionId,
      decision_type: 'reply',
      content: content,
      status: 'queued',
      scheduled_at: now.toISOString(),
      generation_source: 'real',
      pipeline_source: 'manual_test',
      target_tweet_id: targetTweetId,
      is_test_post: true, // 🔒 TEST LANE: Mark as test post
      features: {
        test_decision: true,
        created_at: now.toISOString(),
        retry_count: 0,
      }
    })
    .select('decision_id, status, scheduled_at, is_test_post, target_tweet_id')
    .single();

  if (insertError) {
    console.error(`❌ Failed to create test reply decision: ${insertError.message}`);
    process.exit(1);
  }

  console.log(`✅ Test reply decision created successfully!`);
  console.log(`   Decision ID: ${inserted.decision_id}`);
  console.log(`   Status: ${inserted.status}`);
  console.log(`   Scheduled At: ${inserted.scheduled_at}`);
  console.log(`   Target Tweet ID: ${inserted.target_tweet_id}`);
  console.log(`   is_test_post: ${inserted.is_test_post}\n`);

  console.log(`📋 Next Steps:`);
  console.log(`   1. Set ALLOW_TEST_POSTS=true (temporarily)`);
  console.log(`      export ALLOW_TEST_POSTS=true`);
  console.log(``);
  console.log(`   2. Run posting queue to post the reply:`);
  console.log(`      RUNNER_MODE=true RUNNER_BROWSER=cdp RUNNER_PROFILE_DIR=./.runner-profile \\`);
  console.log(`      ALLOW_TEST_POSTS=true pnpm run runner:once -- --once`);
  console.log(``);
  console.log(`   3. Verify REPLY_SUCCESS event in system_events:`);
  console.log(`      SELECT * FROM system_events WHERE event_type = 'REPLY_SUCCESS' AND event_data->>'decision_id' = '${decisionId}';`);
  console.log(``);
  console.log(`   4. Unset ALLOW_TEST_POSTS after test:`);
  console.log(`      unset ALLOW_TEST_POSTS\n`);

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
