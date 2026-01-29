#!/usr/bin/env tsx
/**
 * Verify Live Opportunities
 * 
 * Checks if the newest reply opportunities have live tweets.
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';
import { fetchTweetData } from '../../src/gates/contextLockVerifier';

async function main() {
  console.log('🔍 Verifying Live Opportunities\n');
  
  const supabase = getSupabaseClient();
  
  // Get 10 newest opportunities
  const { data: opps, error } = await supabase
    .from('reply_opportunities')
    .select('target_tweet_id, target_tweet_content, created_at, account_username')
    .eq('replied_to', false)
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (error) {
    console.error('❌ Error fetching opportunities:', error.message);
    process.exit(1);
  }
  
  if (!opps || opps.length === 0) {
    console.log('⚠️  No opportunities found');
    process.exit(1);
  }
  
  console.log(`📊 Checking ${opps.length} newest opportunities...\n`);
  
  let liveCount = 0;
  let deletedCount = 0;
  
  for (const opp of opps) {
    try {
      const tweetData = await fetchTweetData(opp.target_tweet_id);
      if (tweetData && tweetData.text && tweetData.text.length > 20) {
        liveCount++;
        console.log(`✅ ${opp.target_tweet_id}: LIVE (${tweetData.text.substring(0, 50)}...)`);
      } else {
        deletedCount++;
        console.log(`❌ ${opp.target_tweet_id}: DELETED/MISSING`);
      }
    } catch (error: any) {
      deletedCount++;
      console.log(`❌ ${opp.target_tweet_id}: ERROR - ${error.message}`);
    }
  }
  
  console.log(`\n📊 Results:`);
  console.log(`   Live: ${liveCount}/${opps.length}`);
  console.log(`   Deleted/Missing: ${deletedCount}/${opps.length}`);
  console.log(`   Pass Rate: ${((liveCount / opps.length) * 100).toFixed(1)}%`);
  
  if (liveCount >= 7) {
    console.log(`\n✅ SUCCESS: Pass rate >= 70%`);
    process.exit(0);
  } else {
    console.log(`\n⚠️  WARNING: Pass rate < 70%`);
    process.exit(1);
  }
}

main().catch(console.error);
