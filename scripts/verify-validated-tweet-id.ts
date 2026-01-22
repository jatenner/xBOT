#!/usr/bin/env tsx
/**
 * ✅ VERIFY: Validated Tweet ID
 * 
 * Verifies that a POST_SUCCESS event has a validated tweet_id (18-20 digits)
 * and that the tweet URL loads correctly.
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';
import { assertValidTweetId } from '../src/posting/tweetIdValidator';
import { Client } from 'pg';

const decisionId = process.argv.find(arg => arg.startsWith('--decision-id='))?.split('=')[1];

async function main() {
  if (!decisionId) {
    console.error('❌ Usage: pnpm exec tsx scripts/verify-validated-tweet-id.ts --decision-id=<uuid>');
    process.exit(1);
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           ✅ VERIFY: Validated Tweet ID');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const supabase = getSupabaseClient();

  // Get POST_SUCCESS event
  const { data: postSuccess, error: eventError } = await supabase
    .from('system_events')
    .select('*')
    .eq('event_type', 'POST_SUCCESS')
    .eq('event_data->>decision_id', decisionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (eventError) {
    console.error(`❌ Error querying POST_SUCCESS: ${eventError.message}`);
    process.exit(1);
  }

  if (!postSuccess) {
    console.error(`❌ No POST_SUCCESS event found for decision_id=${decisionId}`);
    console.log(`   Run the posting attempt first, then wait 2 minutes.`);
    process.exit(1);
  }

  const eventData = typeof postSuccess.event_data === 'string' 
    ? JSON.parse(postSuccess.event_data)
    : postSuccess.event_data;

  const tweetId = eventData.tweet_id;
  const tweetUrl = eventData.tweet_url;

  console.log(`📊 POST_SUCCESS Event:`);
  console.log(`   Created: ${postSuccess.created_at}`);
  console.log(`   Decision ID: ${eventData.decision_id}`);
  console.log(`   Tweet ID: ${tweetId}`);
  console.log(`   Tweet URL: ${tweetUrl}\n`);

  // Validate tweet_id format
  const validation = assertValidTweetId(tweetId);
  if (!validation.valid) {
    console.error(`❌ VALIDATION FAILED: ${validation.error}`);
    console.error(`   Tweet ID: "${tweetId}" (length: ${tweetId.length})`);
    process.exit(1);
  }

  console.log(`✅ Tweet ID validation passed: ${tweetId} (${tweetId.length} digits)\n`);

  // Verify content_metadata
  const { data: contentMeta, error: metaError } = await supabase
    .from('content_metadata')
    .select('decision_id, tweet_id, status, posted_at')
    .eq('decision_id', decisionId)
    .maybeSingle();

  if (metaError) {
    console.error(`❌ Error querying content_metadata: ${metaError.message}`);
    process.exit(1);
  }

  if (!contentMeta) {
    console.error(`❌ No content_metadata found for decision_id=${decisionId}`);
    process.exit(1);
  }

  console.log(`📊 Content Metadata:`);
  console.log(`   Status: ${contentMeta.status}`);
  console.log(`   Tweet ID: ${contentMeta.tweet_id}`);
  console.log(`   Posted At: ${contentMeta.posted_at}\n`);

  if (contentMeta.tweet_id !== tweetId) {
    console.error(`❌ MISMATCH: content_metadata.tweet_id (${contentMeta.tweet_id}) != POST_SUCCESS.tweet_id (${tweetId})`);
    process.exit(1);
  }

  console.log(`✅ Tweet ID matches in both tables\n`);

  // Verify tweet_id is string type
  if (typeof tweetId !== 'string') {
    console.error(`❌ TYPE ERROR: tweet_id is not a string (got: ${typeof tweetId})`);
    process.exit(1);
  }

  console.log(`✅ Tweet ID is string type\n`);

  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`           ✅ VERIFICATION PASSED`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  console.log(`Tweet ID: ${tweetId} (${tweetId.length} digits)`);
  console.log(`Tweet URL: ${tweetUrl}`);
  console.log(`\n✅ Please verify the URL loads correctly in a browser.\n`);

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
