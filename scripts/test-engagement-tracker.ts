#!/usr/bin/env tsx
/**
 * Manual test script for engagement tracking
 * Usage: pnpm exec tsx scripts/test-engagement-tracker.ts <posted_reply_tweet_id>
 */

import 'dotenv/config';
import { updateReplyEngagement } from '../src/jobs/replySystemV2/engagementTracker';
import { getSupabaseClient } from '../src/db';

async function testEngagementTracking(tweetId: string) {
  console.log(`📊 Testing engagement tracking for tweet: ${tweetId}\n`);

  const supabase = getSupabaseClient();

  // Step 1: Verify tweet exists in reply_decisions
  const { data: decision, error: findError } = await supabase
    .from('reply_decisions')
    .select('id, decision_id, posted_reply_tweet_id, decision, created_at')
    .eq('posted_reply_tweet_id', tweetId)
    .maybeSingle();

  if (findError) {
    console.error(`❌ Error finding decision: ${findError.message}`);
    process.exit(1);
  }

  if (!decision) {
    console.error(`❌ No reply_decision found for posted_reply_tweet_id=${tweetId}`);
    console.log(`   This tweet ID may not be in the reply_decisions table.`);
    console.log(`   Make sure you're using a tweet_id that was posted by the bot.`);
    process.exit(1);
  }

  console.log(`✅ Found reply_decision:`);
  console.log(`   decision_id: ${decision.decision_id || 'N/A'}`);
  console.log(`   decision: ${decision.decision}`);
  console.log(`   created_at: ${decision.created_at}`);
  console.log('');

  // Step 2: Check current engagement status
  const { data: current } = await supabase
    .from('reply_decisions')
    .select('engagement_24h_likes, engagement_24h_replies, engagement_24h_retweets, engagement_24h_views, engagement_fetched_at')
    .eq('id', decision.id)
    .single();

  console.log(`📊 Current engagement status:`);
  console.log(`   likes: ${current?.engagement_24h_likes || 0}`);
  console.log(`   replies: ${current?.engagement_24h_replies || 0}`);
  console.log(`   retweets: ${current?.engagement_24h_retweets || 0}`);
  console.log(`   views: ${current?.engagement_24h_views || 0}`);
  console.log(`   fetched_at: ${current?.engagement_fetched_at || 'NULL'}`);
  console.log('');

  // Step 3: Fetch engagement
  console.log(`🔄 Fetching engagement metrics...`);
  try {
    await updateReplyEngagement(tweetId);
    console.log(`✅ Engagement fetch completed`);
  } catch (error: any) {
    console.error(`❌ Engagement fetch failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }

  // Step 4: Verify update
  console.log(`\n📊 Updated engagement status:`);
  const { data: updated } = await supabase
    .from('reply_decisions')
    .select('engagement_24h_likes, engagement_24h_replies, engagement_24h_retweets, engagement_24h_views, engagement_fetched_at')
    .eq('id', decision.id)
    .single();

  if (updated) {
    console.log(`   likes: ${updated.engagement_24h_likes || 0}`);
    console.log(`   replies: ${updated.engagement_24h_replies || 0}`);
    console.log(`   retweets: ${updated.engagement_24h_retweets || 0}`);
    console.log(`   views: ${updated.engagement_24h_views || 0}`);
    console.log(`   fetched_at: ${updated.engagement_fetched_at || 'NULL'}`);
    
    if (updated.engagement_fetched_at) {
      console.log(`\n✅ SUCCESS: Engagement metrics updated at ${updated.engagement_fetched_at}`);
    } else {
      console.log(`\n⚠️  WARNING: engagement_fetched_at is still NULL - update may have failed`);
    }
  } else {
    console.error(`❌ Failed to retrieve updated data`);
    process.exit(1);
  }

  // Step 5: SQL proof query
  console.log(`\n📋 SQL Proof Query:`);
  console.log(`SELECT `);
  console.log(`  posted_reply_tweet_id,`);
  console.log(`  engagement_24h_likes,`);
  console.log(`  engagement_24h_replies,`);
  console.log(`  engagement_24h_retweets,`);
  console.log(`  engagement_24h_views,`);
  console.log(`  engagement_fetched_at`);
  console.log(`FROM reply_decisions`);
  console.log(`WHERE posted_reply_tweet_id = '${tweetId}';`);
}

// Parse command line arguments
const tweetId = process.argv[2];

if (!tweetId) {
  console.error('❌ Usage: pnpm exec tsx scripts/test-engagement-tracker.ts <posted_reply_tweet_id>');
  console.error('   Example: pnpm exec tsx scripts/test-engagement-tracker.ts 1234567890123456789');
  process.exit(1);
}

testEngagementTracking(tweetId).catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
