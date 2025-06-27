/**
 * Tweet Analytics Collector
 * Nightly collection of public_metrics and organic_metrics for recent tweets
 */

import { supabaseClient } from '../utils/supabaseClient';
import { xClient } from '../utils/xClient';

export class TweetAnalyticsCollector {
  async run(): Promise<void> {
    console.log('📊 === TWEET ANALYTICS COLLECTOR STARTED ===');
    
    try {
      // Get tweets from the last 24 hours
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      
      console.log(`🔍 Fetching tweets posted since ${oneDayAgo.toISOString()}`);
      
      const { data: recentTweets, error } = await supabaseClient.supabase
        ?.from('tweets')
        .select('tweet_id, created_at')
        .gte('created_at', oneDayAgo.toISOString())
        .not('tweet_id', 'is', null);

      if (error) {
        console.error('❌ Error fetching recent tweets:', error);
        return;
      }

      if (!recentTweets || recentTweets.length === 0) {
        console.log('📭 No recent tweets found to analyze');
        return;
      }

      console.log(`📈 Found ${recentTweets.length} recent tweets to analyze`);
      
      let successCount = 0;
      let errorCount = 0;

      // Process each tweet to fetch updated metrics
      for (const tweet of recentTweets) {
        try {
          console.log(`📊 Fetching metrics for tweet ${tweet.tweet_id}`);
          
          // Fetch fresh metrics from Twitter API
          const tweetData = await xClient.getTweetById(tweet.tweet_id);
          
          if (!tweetData) {
            console.warn(`⚠️ Could not fetch data for tweet ${tweet.tweet_id}`);
            errorCount++;
            continue;
          }

          // Upsert metrics into tweet_metrics table
          const { error: upsertError } = await supabaseClient.supabase
            ?.from('tweet_metrics')
            .upsert({
              tweet_id: tweet.tweet_id,
              like_count: tweetData.public_metrics.like_count,
              retweet_count: tweetData.public_metrics.retweet_count,
              reply_count: tweetData.public_metrics.reply_count,
              quote_count: tweetData.public_metrics.quote_count,
              captured_at: new Date().toISOString()
            }, {
              onConflict: 'tweet_id'
            });

          if (upsertError) {
            console.error(`❌ Error upserting metrics for tweet ${tweet.tweet_id}:`, upsertError);
            errorCount++;
          } else {
            console.log(`✅ Updated metrics for tweet ${tweet.tweet_id}: ${tweetData.public_metrics.like_count} likes, ${tweetData.public_metrics.retweet_count} retweets`);
            successCount++;
          }

          // Rate limiting: small delay between requests
          await new Promise(resolve => setTimeout(resolve, 1000));
          
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