#!/usr/bin/env tsx
/**
 * Verify Latest Post - Show newest POST_SUCCESS events with URLs
 * Usage: railway run -s xBOT -- pnpm exec tsx scripts/verify-latest-post.ts
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db';

async function main() {
  const supabase = getSupabaseClient();
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('           ✅ LATEST POST VERIFICATION\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Get newest POST_SUCCESS events
  const { data: successEvents, error: successError } = await supabase
    .from('system_events')
    .select('created_at, event_data, message')
    .eq('event_type', 'POST_SUCCESS')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (successError) {
    console.error(`❌ Error querying POST_SUCCESS: ${successError.message}`);
    process.exit(1);
  }
  
  console.log(`📊 POST_SUCCESS Events: ${successEvents?.length || 0}\n`);
  
  if (successEvents && successEvents.length > 0) {
    console.log('Newest POST_SUCCESS events:\n');
    successEvents.forEach((event: any, idx: number) => {
      const data = event.event_data || {};
      const timestamp = new Date(event.created_at).toISOString();
      const decisionId = data.decision_id || 'unknown';
      const targetTweetId = data.target_tweet_id || 'unknown';
      const postedTweetId = data.posted_reply_tweet_id || 'unknown';
      const templateId = data.template_id || 'null';
      const promptVersion = data.prompt_version || 'null';
      
      console.log(`${idx + 1}. ${timestamp}`);
      console.log(`   decision_id: ${decisionId}`);
      console.log(`   target_tweet_id: ${targetTweetId}`);
      console.log(`   posted_reply_tweet_id: ${postedTweetId}`);
      console.log(`   template_id: ${templateId}, prompt_version: ${promptVersion}`);
      console.log(`   🎯 Tweet URL: https://x.com/i/status/${postedTweetId}`);
      console.log(`   📋 Target URL: https://x.com/i/status/${targetTweetId}`);
      console.log('');
    });
  } else {
    console.log('⚠️  No POST_SUCCESS events found\n');
    
    // Check for recent posted_reply_tweet_id in reply_decisions
    const { data: recentPosts } = await supabase
      .from('reply_decisions')
      .select('decision_id, target_tweet_id, posted_reply_tweet_id, posting_completed_at')
      .eq('decision', 'ALLOW')
      .not('posted_reply_tweet_id', 'is', null)
      .order('posting_completed_at', { ascending: false })
      .limit(5);
    
    if (recentPosts && recentPosts.length > 0) {
      console.log('Recent successful posts (from reply_decisions):\n');
      recentPosts.forEach((post: any, idx: number) => {
        const timestamp = post.posting_completed_at || 'N/A';
        console.log(`${idx + 1}. ${timestamp}`);
        console.log(`   decision_id: ${post.decision_id}`);
        console.log(`   target_tweet_id: ${post.target_tweet_id}`);
        console.log(`   posted_reply_tweet_id: ${post.posted_reply_tweet_id}`);
        console.log(`   🎯 Tweet URL: https://x.com/i/status/${post.posted_reply_tweet_id}`);
        console.log(`   📋 Target URL: https://x.com/i/status/${post.target_tweet_id}`);
        console.log('');
      });
    }
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
