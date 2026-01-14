#!/usr/bin/env tsx
/**
 * Verify POST_SUCCESS events and print posted tweet URLs
 * Usage: railway run -s xBOT -- pnpm exec tsx scripts/verify-post-success.ts
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db';

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('           ✅ POST SUCCESS VERIFICATION\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const supabase = getSupabaseClient();
  
  // Check for POST_SUCCESS events in last 24h
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: successEvents, error: eventsError } = await supabase
    .from('system_events')
    .select('event_data, created_at')
    .eq('event_type', 'POST_SUCCESS')
    .gte('created_at', oneDayAgo)
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (eventsError) {
    console.error(`❌ Error querying system_events: ${eventsError.message}`);
    process.exit(1);
  }
  
  console.log(`📊 POST_SUCCESS Events (last 24h): ${successEvents?.length || 0}\n`);
  
  if (successEvents && successEvents.length > 0) {
    console.log('✅ Recent POST_SUCCESS events:\n');
    successEvents.forEach((event, i) => {
      const eventData = event.event_data as any;
      const tweetId = eventData?.posted_reply_tweet_id || eventData?.tweet_id;
      const targetId = eventData?.target_tweet_id;
      const decisionId = eventData?.decision_id;
      
      console.log(`${i + 1}. Posted at: ${event.created_at}`);
      if (decisionId) console.log(`   decision_id: ${decisionId}`);
      if (targetId) console.log(`   target_tweet_id: ${targetId}`);
      if (tweetId) {
        console.log(`   posted_reply_tweet_id: ${tweetId}`);
        console.log(`   🎯 Tweet URL: https://x.com/i/status/${tweetId}`);
      }
      console.log('');
    });
  } else {
    console.log('⚠️  No POST_SUCCESS events found in last 24h\n');
  }
  
  // Also check reply_decisions for recent posts
  const { data: recentPosts, error: postsError } = await supabase
    .from('reply_decisions')
    .select('decision_id, target_tweet_id, posted_reply_tweet_id, created_at')
    .not('posted_reply_tweet_id', 'is', null)
    .gte('created_at', oneDayAgo)
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (postsError) {
    console.error(`❌ Error querying reply_decisions: ${postsError.message}`);
    process.exit(1);
  }
  
  console.log(`📊 Recent successful posts (from reply_decisions): ${recentPosts?.length || 0}\n`);
  
  if (recentPosts && recentPosts.length > 0) {
    console.log('✅ Recent successful posts:\n');
    recentPosts.forEach((post, i) => {
      console.log(`${i + 1}. Posted at: ${post.created_at}`);
      console.log(`   decision_id: ${post.decision_id}`);
      console.log(`   target_tweet_id: ${post.target_tweet_id}`);
      console.log(`   posted_reply_tweet_id: ${post.posted_reply_tweet_id}`);
      console.log(`   🎯 Tweet URL: https://x.com/i/status/${post.posted_reply_tweet_id}`);
      console.log(`   📋 Target URL: https://x.com/i/status/${post.target_tweet_id}`);
      console.log('');
    });
  } else {
    console.log('⚠️  No recent posts found in reply_decisions\n');
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch((error) => {
  console.error('❌ Failed:', error);
  process.exit(1);
});
