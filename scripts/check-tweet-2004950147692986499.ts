#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkTweet() {
  console.log('🔍 INVESTIGATING TWEET 2004950147692986499\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Find this tweet in our database
  const { data: byTweetId } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('*')
    .eq('tweet_id', '2004950147692986499')
    .single();

  // Also check thread_tweet_ids
  const { data: byThreadIds } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('*')
    .contains('thread_tweet_ids', ['2004950147692986499']);

  const record = byTweetId || (byThreadIds && byThreadIds[0]);

  if (!record) {
    console.log('❌ TWEET NOT FOUND IN DATABASE!\n');
    console.log('This is a critical issue - posted but not saved\n');
    return;
  }

  console.log('📊 DATABASE RECORD:\n');
  console.log(`   Decision ID: ${record.decision_id}`);
  console.log(`   Decision Type: ${record.decision_type}`);
  console.log(`   Status: ${record.status}`);
  console.log(`   Tweet ID: ${record.tweet_id}`);
  console.log(`   Thread Tweet IDs: ${JSON.stringify(record.thread_tweet_ids)}`);
  console.log(`   Created: ${new Date(record.created_at).toLocaleString('en-US', { timeZone: 'America/New_York' })}`);
  console.log(`   Posted: ${record.posted_at ? new Date(record.posted_at).toLocaleString('en-US', { timeZone: 'America/New_York' }) : 'N/A'}\n`);

  if (record.thread_parts) {
    console.log(`📝 THREAD PARTS (Should be ${record.thread_parts.length} tweets):\n`);
    record.thread_parts.forEach((part: string, i: number) => {
      console.log(`   ${i + 1}. ${part.slice(0, 80)}...\n`);
    });
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('🎯 DIAGNOSIS:\n');

  if (record.decision_type === 'thread' && record.thread_parts && record.thread_parts.length > 1) {
    if (record.thread_tweet_ids && record.thread_tweet_ids.length === record.thread_parts.length) {
      console.log(`   ✅ Thread posted correctly (${record.thread_tweet_ids.length} tweets)`);
      console.log(`      All tweet IDs saved: ${JSON.stringify(record.thread_tweet_ids)}\n`);
      console.log('   Check X to see if all tweets in thread are visible\n');
    } else if (record.thread_tweet_ids && record.thread_tweet_ids.length > 1) {
      console.log(`   ⚠️  Partial thread: ${record.thread_tweet_ids.length}/${record.thread_parts.length} tweets posted\n`);
    } else {
      console.log(`   ❌ FUNDAMENTAL ERROR: Thread planned but only 1 tweet posted!\n`);
      console.log(`      Expected: ${record.thread_parts.length} tweets`);
      console.log(`      Actually posted: 1 tweet\n`);
      console.log('   This means thread composer FAILED partway through\n');
    }
  } else if (record.decision_type === 'single') {
    console.log('   ✅ This was a single post (not a thread)\n');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

checkTweet();

