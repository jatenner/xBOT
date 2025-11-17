/**
 * 🔍 DIAGNOSTIC: Reply Metrics Status
 * 
 * Checks why replies show "No metrics yet" in dashboard
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function diagnoseReplyMetrics() {
  console.log('[DIAGNOSTIC] 🔍 Checking reply metrics status...\n');
  
  const supabase = getSupabaseClient();
  
  // Get recent replies
  const { data: replies, error } = await supabase
    .from('content_metadata')
    .select('decision_id, tweet_id, posted_at, actual_impressions, actual_likes, actual_retweets, actual_replies, status, decision_type')
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .order('posted_at', { ascending: false })
    .limit(20);
  
  if (error) {
    console.error('❌ Error fetching replies:', error.message);
    return;
  }
  
  if (!replies || replies.length === 0) {
    console.log('ℹ️ No replies found');
    return;
  }
  
  console.log(`📊 Found ${replies.length} recent replies\n`);
  
  // Categorize replies
  const withTweetId = replies.filter(r => r.tweet_id);
  const withoutTweetId = replies.filter(r => !r.tweet_id);
  const withMetrics = replies.filter(r => r.actual_impressions !== null && r.actual_impressions > 0);
  const withoutMetrics = replies.filter(r => r.actual_impressions === null || r.actual_impressions === 0);
  
  console.log('📈 Summary:');
  console.log(`  ✅ With tweet_id: ${withTweetId.length}/${replies.length}`);
  console.log(`  ❌ Without tweet_id: ${withoutTweetId.length}/${replies.length}`);
  console.log(`  ✅ With metrics: ${withMetrics.length}/${replies.length}`);
  console.log(`  ❌ Without metrics: ${withoutMetrics.length}/${replies.length}\n`);
  
  // Check tweet_metrics table
  const tweetIds = withTweetId.map(r => r.tweet_id).filter(Boolean) as string[];
  let tweetMetricsCount = 0;
  if (tweetIds.length > 0) {
    const { data: tweetMetrics } = await supabase
      .from('tweet_metrics')
      .select('tweet_id')
      .in('tweet_id', tweetIds);
    tweetMetricsCount = tweetMetrics?.length || 0;
    console.log(`📊 tweet_metrics table: ${tweetMetricsCount}/${tweetIds.length} replies have entries\n`);
  }
  
  // Show detailed breakdown
  console.log('🔍 Detailed Breakdown:\n');
  
  for (const reply of replies.slice(0, 10)) {
    const hasTweetId = !!reply.tweet_id;
    const hasMetrics = reply.actual_impressions !== null && reply.actual_impressions > 0;
    const status = hasTweetId 
      ? (hasMetrics ? '✅ Has metrics' : '⚠️ Missing metrics')
      : '❌ Missing tweet_id';
    
    console.log(`${status}`);
    console.log(`  Decision ID: ${reply.decision_id}`);
    console.log(`  Tweet ID: ${reply.tweet_id || 'NULL'}`);
    console.log(`  Posted: ${reply.posted_at}`);
    console.log(`  Impressions: ${reply.actual_impressions ?? 'NULL'}`);
    console.log(`  Likes: ${reply.actual_likes ?? 'NULL'}`);
    console.log('');
  }
  
  // Check if scraper is running
  console.log('🔧 Recommendations:');
  if (withoutTweetId.length > 0) {
    console.log(`  ⚠️ ${withoutTweetId.length} replies missing tweet_id - run tweet ID recovery`);
  }
  if (withoutMetrics.length > 0 && withTweetId.length > 0) {
    console.log(`  ⚠️ ${withoutMetrics.length} replies with tweet_id but no metrics - check reply_metrics_scraper job`);
  }
  if (tweetMetricsCount < tweetIds.length) {
    console.log(`  ⚠️ ${tweetIds.length - tweetMetricsCount} replies missing from tweet_metrics table`);
  }
}

diagnoseReplyMetrics().catch(console.error);

