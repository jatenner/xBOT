/**
 * Find an external (non-self) tweet for controlled reply testing
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function main() {
  const supabase = getSupabaseClient();
  const ourHandle = (process.env.TWITTER_USERNAME || 'SignalAndSynapse').toLowerCase();
  
  console.log('🔍 Finding external tweet for Controlled Reply Test #2...\n');
  console.log(`   Our handle: @${ourHandle}`);
  console.log(`   Excluding: @SignalAndSynapse, @Signal_Synapse\n`);
  
  // Find external root tweets from reply_opportunities
  const { data: opportunities, error } = await supabase
    .from('reply_opportunities')
    .select('target_tweet_id, target_username, target_tweet_content, like_count, tweet_posted_at')
    .eq('is_root_tweet', true)
    .neq('target_username', 'SignalAndSynapse')
    .neq('target_username', 'Signal_Synapse')
    .neq('target_username', ourHandle)
    .order('like_count', { ascending: false })
    .limit(5);
  
  if (error) {
    console.error(`❌ Error fetching opportunities: ${error.message}`);
    process.exit(1);
  }
  
  if (!opportunities || opportunities.length === 0) {
    console.error(`❌ No external tweets found in reply_opportunities`);
    console.log(`   Try running replyOpportunityHarvester first`);
    process.exit(1);
  }
  
  // Pick the most recent high-engagement tweet
  const targetTweet = opportunities[0];
  
  console.log('✅ Found external root tweet:');
  console.log(`   Tweet ID: ${targetTweet.target_tweet_id}`);
  console.log(`   URL: https://x.com/${targetTweet.target_username}/status/${targetTweet.target_tweet_id}`);
  console.log(`   Author: @${targetTweet.target_username}`);
  console.log(`   Likes: ${targetTweet.like_count}`);
  console.log(`   Posted at: ${targetTweet.tweet_posted_at}`);
  console.log(`   Content preview: ${(targetTweet.target_tweet_content || '').substring(0, 80)}...`);
  console.log('');
  console.log('📋 Use this tweet ID for Controlled Reply Test #2:');
  console.log(`   TARGET_TWEET_ID=${targetTweet.target_tweet_id}`);
  
  process.exit(0);
}

main().catch(console.error);

