/**
 * Find a safe root tweet to reply to for controlled testing
 * Ensures tweet is root-level (not a reply) and from a normal account
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function main() {
  const supabase = getSupabaseClient();
  
  console.log('🔍 Finding safe root tweet for controlled reply test...\n');
  
  // Find recent tweets from our account that are root tweets (not replies)
  // We'll reply to one of our own tweets for safety
  const { data: ourTweets, error } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('tweet_id, content, posted_at, decision_type')
    .eq('status', 'posted')
    .not('tweet_id', 'is', null)
    .eq('decision_type', 'single') // Root tweets, not replies
    .order('posted_at', { ascending: false })
    .limit(10);
  
  if (error) {
    console.error(`❌ Error fetching tweets: ${error.message}`);
    process.exit(1);
  }
  
  if (!ourTweets || ourTweets.length === 0) {
    console.error(`❌ No root tweets found in database`);
    console.log(`   Try posting a single tweet first, then run this script`);
    process.exit(1);
  }
  
  // Pick the most recent root tweet
  const targetTweet = ourTweets[0];
  
  console.log('✅ Found safe root tweet:');
  console.log(`   Tweet ID: ${targetTweet.tweet_id}`);
  console.log(`   URL: https://x.com/SignalAndSynapse/status/${targetTweet.tweet_id}`);
  console.log(`   Posted at: ${targetTweet.posted_at}`);
  console.log(`   Content preview: ${(targetTweet.content || '').substring(0, 60)}...`);
  console.log(`   Type: ${targetTweet.decision_type} (root tweet)`);
  console.log('');
  console.log('📋 Use this tweet ID for controlled reply test:');
  console.log(`   TARGET_TWEET_ID=${targetTweet.tweet_id}`);
  
  process.exit(0);
}

main().catch(console.error);

