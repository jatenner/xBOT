#!/usr/bin/env node

/**
 * 🎯 FOLLOWER GROWTH MONITOR
 * Tracks daily progress toward 10 follower goal
 * Run: node monitor_follower_growth.js
 */

const { TwitterApi } = require('twitter-api-v2');
const { createClient } = require('@supabase/supabase-js');

// Initialize clients
const twitterClient = new TwitterApi(process.env.TWITTER_BEARER_TOKEN);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getTwitterMetrics() {
  try {
    // Get account info
    const user = await twitterClient.v2.me({
      'user.fields': ['public_metrics', 'created_at']
    });
    
    // Get recent tweets (last 24h)
    const tweets = await twitterClient.v2.userTimeline(user.data.id, {
      max_results: 50,
      'tweet.fields': ['public_metrics', 'created_at'],
      start_time: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    });

    return {
      followers: user.data.public_metrics.followers_count,
      following: user.data.public_metrics.following_count,
      tweets_count: user.data.public_metrics.tweet_count,
      recent_tweets: tweets.data?.length || 0,
      total_impressions: tweets.data?.reduce((sum, tweet) => 
        sum + (tweet.public_metrics?.impression_count || 0), 0) || 0,
      total_likes: tweets.data?.reduce((sum, tweet) => 
        sum + (tweet.public_metrics?.like_count || 0), 0) || 0,
      total_retweets: tweets.data?.reduce((sum, tweet) => 
        sum + (tweet.public_metrics?.retweet_count || 0), 0) || 0,
      total_replies: tweets.data?.reduce((sum, tweet) => 
        sum + (tweet.public_metrics?.reply_count || 0), 0) || 0
    };
  } catch (error) {
    console.error('❌ Error fetching Twitter metrics:', error.message);
    return null;
  }
}

async function getDatabaseMetrics() {
  try {
    // Get tweets posted in last 24h
    const { data: recentTweets } = await supabase
      .from('tweets')
      .select('*')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    // Get quality gate failures
    const { data: rejectedDrafts } = await supabase
      .from('rejected_drafts')
      .select('*')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    return {
      tweets_posted: recentTweets?.length || 0,
      drafts_rejected: rejectedDrafts?.length || 0,
      success_rate: recentTweets?.length > 0 ? 
        (recentTweets.length / (recentTweets.length + (rejectedDrafts?.length || 0)) * 100).toFixed(1) 
        : 0
    };
  } catch (error) {
    console.error('❌ Error fetching database metrics:', error.message);
    return null;
  }
}

async function saveProgressMetrics(metrics) {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const { error } = await supabase
      .from('daily_progress')
      .upsert({
        date: today,
        followers_count: metrics.followers,
        tweets_posted: metrics.tweets_posted,
        total_impressions: metrics.total_impressions,
        total_engagement: metrics.total_likes + metrics.total_retweets + metrics.total_replies,
        success_rate: metrics.success_rate,
        f_per_1k: metrics.total_impressions > 0 ? 
          ((metrics.followers_delta || 0) * 1000 / metrics.total_impressions).toFixed(2) : 0
      }, {
        onConflict: 'date'
      });

    if (error) throw error;
    console.log('💾 Progress metrics saved to database');
  } catch (error) {
    console.error('❌ Error saving progress:', error.message);
  }
}

async function displayProgress() {
  console.log('\n🎯 FOLLOWER GROWTH MONITOR');
  console.log('===========================');
  console.log(`📅 Date: ${new Date().toLocaleDateString()}`);
  console.log(`⏰ Time: ${new Date().toLocaleTimeString()}\n`);

  const twitterMetrics = await getTwitterMetrics();
  const dbMetrics = await getDatabaseMetrics();

  if (!twitterMetrics || !dbMetrics) {
    console.log('❌ Unable to fetch complete metrics');
    return;
  }

  const combinedMetrics = { ...twitterMetrics, ...dbMetrics };

  // Display current status
  console.log('📊 CURRENT METRICS (Last 24h)');
  console.log('------------------------------');
  console.log(`👥 Followers: ${combinedMetrics.followers}`);
  console.log(`📤 Tweets Posted: ${combinedMetrics.tweets_posted}`);
  console.log(`👀 Total Impressions: ${combinedMetrics.total_impressions.toLocaleString()}`);
  console.log(`❤️  Total Likes: ${combinedMetrics.total_likes}`);
  console.log(`🔄 Total Retweets: ${combinedMetrics.total_retweets}`);
  console.log(`💬 Total Replies: ${combinedMetrics.total_replies}`);
  console.log(`✅ Success Rate: ${combinedMetrics.success_rate}%`);
  console.log(`❌ Rejected Drafts: ${combinedMetrics.drafts_rejected}`);

  // Calculate progress toward goal
  const GOAL_FOLLOWERS = 10;
  const WEEK_START = new Date('2025-06-29'); // Adjust to actual start date
  const daysElapsed = Math.ceil((new Date() - WEEK_START) / (1000 * 60 * 60 * 24));
  const daysRemaining = Math.max(0, 7 - daysElapsed);
  const followersNeeded = Math.max(0, GOAL_FOLLOWERS - combinedMetrics.followers);

  console.log('\n🎯 GOAL PROGRESS');
  console.log('----------------');
  console.log(`🎯 Target: ${GOAL_FOLLOWERS} followers`);
  console.log(`📍 Current: ${combinedMetrics.followers} followers`);
  console.log(`📈 Needed: ${followersNeeded} more followers`);
  console.log(`📅 Days Remaining: ${daysRemaining}`);
  console.log(`⚡ Daily Rate Needed: ${daysRemaining > 0 ? (followersNeeded / daysRemaining).toFixed(1) : 'N/A'} followers/day`);

  // Status assessment
  let status = '🔴 BEHIND SCHEDULE';
  if (followersNeeded === 0) {
    status = '🎉 GOAL ACHIEVED!';
  } else if (followersNeeded <= daysRemaining * 1.5) {
    status = '🟢 ON TRACK';
  } else if (followersNeeded <= daysRemaining * 2.5) {
    status = '🟡 NEEDS IMPROVEMENT';
  }

  console.log(`📊 Status: ${status}\n`);

  // Recommendations
  console.log('💡 RECOMMENDATIONS');
  console.log('-------------------');
  
  if (combinedMetrics.tweets_posted < 6) {
    console.log('📤 INCREASE POSTING: Target 8-12 tweets/day');
  }
  
  if (combinedMetrics.success_rate < 70) {
    console.log('🎯 LOWER QUALITY GATES: Too many rejections');
  }
  
  if (combinedMetrics.total_impressions < 1000) {
    console.log('👀 IMPROVE CONTENT: Focus on viral hooks');
  }
  
  if (followersNeeded > 0 && daysRemaining <= 2) {
    console.log('🚨 EMERGENCY MODE: Aggressive following + engagement');
  }

  // Save metrics
  await saveProgressMetrics(combinedMetrics);
  
  console.log('\n🔄 Run again in 1 hour to track progress');
}

// Run the monitor
displayProgress().catch(console.error); 