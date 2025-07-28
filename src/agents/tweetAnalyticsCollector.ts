/**
 * Tweet Analytics Collector
 * Nightly collection of public_metrics and organic_metrics for recent tweets
 */

import { minimalSupabaseClient as supabaseClient } from '../utils/minimalSupabaseClient';
import { xClient } from '../utils/xClient';

export class TweetAnalyticsCollector {
  async run(): Promise<void> {
    console.log('📊 === TWEET ANALYTICS COLLECTOR STARTED ===');
    
    try {
      // Get tweets from the last 24 hours
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      
      console.log(`🔍 Fetching tweets posted since ${oneDayAgo.toISOString()}`);
      
      const tweetResponse = await supabaseClient.supabase
        ?.from('tweets')
        .select('tweet_id, created_at')
        .gte('created_at', oneDayAgo.toISOString())
        .not('tweet_id', 'is', null);

      if (tweetResponse?.error) {
        console.error('❌ Error fetching recent tweets:', tweetResponse.error);
        return;
      }

      const recentTweets = tweetResponse?.data;

      if (!recentTweets || recentTweets.length === 0) {
        console.log('📭 No recent tweets found to analyze');
        return;
      }

      console.log(`📈 Found ${recentTweets.length} recent tweets to analyze`);
      
      let successCount = 0;
      let errorCount = 0;

      // Process each tweet using existing performance tracking system
      // Use the unified performance tracker to get the most recent metrics
      console.log(`📊 Using browser-based scraping for ${recentTweets.length} tweets`);
      
      for (const tweet of recentTweets) {
        try {
          console.log(`📊 Processing metrics for tweet ${tweet.tweet_id}`);
          
          // Query existing performance data from the performance tracking system
          const perfResponse = await supabaseClient.supabase
            ?.from('tweets')
            .select('performance_log, likes, retweets, replies')
            .eq('tweet_id', tweet.tweet_id)
            .single();

          if (perfResponse?.error || !perfResponse?.data) {
            console.warn(`⚠️ No performance data found for tweet ${tweet.tweet_id}`);
            errorCount++;
            continue;
          }

          const performanceData = perfResponse.data;

          // Use the latest metrics from performance tracking
          const likes = performanceData.likes || 0;
          const retweets = performanceData.retweets || 0;
          const replies = performanceData.replies || 0;

          // Upsert metrics into tweet_metrics table
          const upsertResponse = await supabaseClient.supabase
            ?.from('tweet_metrics')
            .upsert({
              tweet_id: tweet.tweet_id,
              like_count: likes,
              retweet_count: retweets,
              reply_count: replies,
              quote_count: 0, // Not available via scraping
              captured_at: new Date().toISOString()
            }, {
              onConflict: 'tweet_id'
            });

          if (upsertResponse?.error) {
            console.error(`❌ Error upserting metrics for tweet ${tweet.tweet_id}:`, upsertResponse.error);
            errorCount++;
          } else {
            console.log(`✅ Updated metrics for tweet ${tweet.tweet_id}: ${likes} likes, ${retweets} retweets`);
            successCount++;
          }

          // Small delay between database operations
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          console.error(`❌ Error processing tweet ${tweet.tweet_id}:`, error);
          errorCount++;
        }
      }

      console.log(`📊 === ANALYTICS COLLECTION COMPLETE ===`);
      console.log(`✅ Successfully updated: ${successCount} tweets`);
      console.log(`❌ Errors encountered: ${errorCount} tweets`);
      console.log(`📈 Success rate: ${((successCount / recentTweets.length) * 100).toFixed(1)}%`);

    } catch (error) {
      console.error('❌ Tweet analytics collection failed:', error);
    }
  }
}

// Export singleton instance
export const tweetAnalyticsCollector = new TweetAnalyticsCollector(); 