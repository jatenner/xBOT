/**
 * 🔍 DIAGNOSTIC: Check if metrics are stored properly for tweets and replies
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function checkMetricsStorage() {
  console.log('[DIAGNOSTIC] 🔍 Checking metrics storage for tweets and replies...\n');
  
  const supabase = getSupabaseClient();
  
  // Check tweets (single posts)
  const { data: tweets } = await supabase
    .from('content_metadata')
    .select('decision_id, tweet_id, decision_type, actual_impressions, actual_likes, actual_retweets, actual_replies')
    .eq('decision_type', 'single')
    .eq('status', 'posted')
    .not('tweet_id', 'is', null)
    .order('posted_at', { ascending: false })
    .limit(10);
  
  // Check replies
  const { data: replies } = await supabase
    .from('content_metadata')
    .select('decision_id, tweet_id, decision_type, actual_impressions, actual_likes, actual_retweets, actual_replies')
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .not('tweet_id', 'is', null)
    .order('posted_at', { ascending: false })
    .limit(10);
  
  console.log('📊 TWEETS (Single Posts):');
  console.log(`  Found ${tweets?.length || 0} recent tweets\n`);
  
  if (tweets && tweets.length > 0) {
    const tweetIds = tweets.map(t => t.tweet_id).filter(Boolean) as string[];
    
    // Check which tables have metrics
    const [outcomesData, learningPostsData, tweetMetricsData] = await Promise.all([
      supabase.from('outcomes').select('tweet_id').in('tweet_id', tweetIds),
      supabase.from('learning_posts').select('tweet_id').in('tweet_id', tweetIds),
      supabase.from('tweet_metrics').select('tweet_id').in('tweet_id', tweetIds)
    ]);
    
    const inOutcomes = outcomesData.data?.length || 0;
    const inLearningPosts = learningPostsData.data?.length || 0;
    const inTweetMetrics = tweetMetricsData.data?.length || 0;
    const inContentMetadata = tweets.filter(t => t.actual_impressions !== null).length;
    
    console.log(`  ✅ content_metadata: ${inContentMetadata}/${tweets.length} have metrics`);
    console.log(`  ✅ outcomes: ${inOutcomes}/${tweets.length} have entries`);
    console.log(`  ✅ learning_posts: ${inLearningPosts}/${tweets.length} have entries`);
    console.log(`  ✅ tweet_metrics: ${inTweetMetrics}/${tweets.length} have entries\n`);
  }
  
  console.log('📊 REPLIES:');
  console.log(`  Found ${replies?.length || 0} recent replies\n`);
  
  if (replies && replies.length > 0) {
    const replyIds = replies.map(r => r.tweet_id).filter(Boolean) as string[];
    
    // Check which tables have metrics
    const [outcomesData, learningPostsData, tweetMetricsData, replyPerfData] = await Promise.all([
      supabase.from('outcomes').select('tweet_id').in('tweet_id', replyIds),
      supabase.from('learning_posts').select('tweet_id').in('tweet_id', replyIds),
      supabase.from('tweet_metrics').select('tweet_id').in('tweet_id', replyIds),
      supabase.from('reply_performance').select('reply_tweet_id').in('reply_tweet_id', replyIds)
    ]);
    
    const inOutcomes = outcomesData.data?.length || 0;
    const inLearningPosts = learningPostsData.data?.length || 0;
    const inTweetMetrics = tweetMetricsData.data?.length || 0;
    const inReplyPerf = replyPerfData.data?.length || 0;
    const inContentMetadata = replies.filter(r => r.actual_impressions !== null).length;
    
    console.log(`  ✅ content_metadata: ${inContentMetadata}/${replies.length} have metrics`);
    console.log(`  ${inOutcomes > 0 ? '✅' : '❌'} outcomes: ${inOutcomes}/${replies.length} have entries`);
    console.log(`  ${inLearningPosts > 0 ? '✅' : '❌'} learning_posts: ${inLearningPosts}/${replies.length} have entries`);
    console.log(`  ✅ tweet_metrics: ${inTweetMetrics}/${replies.length} have entries`);
    console.log(`  ✅ reply_performance: ${inReplyPerf}/${replies.length} have entries\n`);
    
    if (inOutcomes === 0 || inLearningPosts === 0) {
      console.log('🚨 ISSUE FOUND:');
      if (inOutcomes === 0) {
        console.log('  ❌ Replies NOT writing to outcomes table (used by bandit algorithms)');
      }
      if (inLearningPosts === 0) {
        console.log('  ❌ Replies NOT writing to learning_posts table (used by 30+ learning systems)');
      }
      console.log('\n  💡 Fix: Update replyMetricsScraperJob.ts to write to these tables\n');
    }
  }
}

checkMetricsStorage().catch(console.error);






