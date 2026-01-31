#!/usr/bin/env tsx
/**
 * Diagnose ROOT_EVAL Data Issues
 * 
 * Runs SQL queries to understand created_at vs tweet_posted_at
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';

async function main() {
  const supabase = getSupabaseClient();
  
  console.log('🔍 ROOT_EVAL Data Diagnosis');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Query 1: Newest 20 root opportunities with both timestamps
  console.log('1️⃣ Newest 20 root opportunities:');
  const { data: opps } = await supabase
    .from('reply_opportunities')
    .select('target_tweet_id, is_root_tweet, target_in_reply_to_tweet_id, created_at, tweet_posted_at')
    .eq('replied_to', false)
    .order('created_at', { ascending: false })
    .limit(20);
  
  if (opps && opps.length > 0) {
    opps.forEach((opp, i) => {
      const createdAge = opp.created_at ? Math.round((Date.now() - new Date(opp.created_at).getTime()) / 1000 / 60) : null;
      const tweetAge = opp.tweet_posted_at ? Math.round((Date.now() - new Date(opp.tweet_posted_at).getTime()) / 1000 / 60) : null;
      console.log(`   ${i + 1}. ${opp.target_tweet_id}: created=${createdAge}m ago, tweet_posted=${tweetAge}m ago (null=${opp.tweet_posted_at === null})`);
    });
  } else {
    console.log('   No opportunities found');
  }
  
  // Query 2: Count NULL tweet_posted_at
  const { count: nullCount } = await supabase
    .from('reply_opportunities')
    .select('*', { count: 'exact', head: true })
    .eq('replied_to', false)
    .or('is_root_tweet.eq.true,target_in_reply_to_tweet_id.is.null')
    .is('tweet_posted_at', null);
  
  console.log(`\n2️⃣ Opportunities with NULL tweet_posted_at: ${nullCount || 0}`);
  
  // Query 3: Fresh window comparison
  const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  
  const { count: freshByTweet } = await supabase
    .from('reply_opportunities')
    .select('*', { count: 'exact', head: true })
    .eq('replied_to', false)
    .or('is_root_tweet.eq.true,target_in_reply_to_tweet_id.is.null')
    .gte('tweet_posted_at', threeHoursAgo);
  
  const { count: freshByCreated } = await supabase
    .from('reply_opportunities')
    .select('*', { count: 'exact', head: true })
    .eq('replied_to', false)
    .or('is_root_tweet.eq.true,target_in_reply_to_tweet_id.is.null')
    .gte('created_at', threeHoursAgo);
  
  console.log(`\n3️⃣ Fresh window comparison (<3h):`);
  console.log(`   By tweet_posted_at: ${freshByTweet || 0}`);
  console.log(`   By created_at: ${freshByCreated || 0}`);
  
  // Query 4: Root opportunities without evaluations
  const { data: rootOpps } = await supabase
    .from('reply_opportunities')
    .select('target_tweet_id')
    .eq('replied_to', false)
    .or('is_root_tweet.eq.true,target_in_reply_to_tweet_id.is.null')
    .limit(100);
  
  const rootTweetIds = rootOpps?.map(o => o.target_tweet_id) || [];
  
  const { count: rootEvals } = await supabase
    .from('candidate_evaluations')
    .select('*', { count: 'exact', head: true })
    .in('candidate_tweet_id', rootTweetIds.length > 0 ? rootTweetIds : ['']);
  
  console.log(`\n4️⃣ Root opportunities vs evaluations:`);
  console.log(`   Root opportunities: ${rootTweetIds.length}`);
  console.log(`   Evaluations for roots: ${rootEvals || 0}`);
  console.log(`   Missing evaluations: ${rootTweetIds.length - (rootEvals || 0)}`);
}

main().catch(console.error);
