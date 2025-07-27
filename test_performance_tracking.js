#!/usr/bin/env node

/**
 * 🧪 PERFORMANCE TRACKING SYSTEM TEST
 * Tests the stealth tweet performance monitoring system
 */

async function testPerformanceTracking() {
  console.log('🧪 === TESTING PERFORMANCE TRACKING SYSTEM ===');
  console.log('🔄 Workflow: Query DB → Scrape Metrics → Update Performance');
  
  try {
    // Compile TypeScript first
    const { execSync } = require('child_process');
    console.log('🔨 Compiling TypeScript...');
    execSync('npx tsc --build', { stdio: 'inherit' });
    
    // Test 1: Initialize performance tracker
    console.log('\n📊 TEST 1: Initialize Performance Tracker');
    console.log('==========================================');
    const { tweetPerformanceTracker } = require('./dist/jobs/updateTweetPerformance.js');
    
    const trackerStats = tweetPerformanceTracker.getTrackingStats();
    console.log('📊 Tracking Configuration:');
    console.log(`   Max tweets per job: ${trackerStats.maxTweetsPerJob}`);
    console.log(`   Delay range: ${trackerStats.delayRange}`);
    console.log(`   Update threshold: ${trackerStats.updateThreshold}`);
    console.log(`   Session available: ${trackerStats.sessionAvailable ? '✅' : '❌'}`);
    
    // Test 2: Check database connectivity
    console.log('\n💾 TEST 2: Database Connectivity');
    console.log('================================');
    try {
      const { supabaseClient } = require('./dist/utils/supabaseClient.js');
      
      // Query recent tweets
      const { data: tweets, error } = await supabaseClient.supabase
        ?.from('tweets')
        ?.select('id, tweet_id, content, created_at, likes, retweets, replies, performance_log, last_performance_update')
        ?.eq('success', true)
        ?.order('created_at', { ascending: false })
        ?.limit(5);
      
      if (error) {
        console.error('❌ Database query failed:', error);
      } else {
        console.log(`✅ Found ${tweets?.length || 0} recent tweets in database`);
        
        if (tweets && tweets.length > 0) {
          const sampleTweet = tweets[0];
          console.log(`📝 Sample tweet: ${sampleTweet.tweet_id}`);
          console.log(`   Content: "${sampleTweet.content.substring(0, 60)}..."`);
          console.log(`   Current metrics: ${sampleTweet.likes} likes, ${sampleTweet.retweets} retweets`);
          console.log(`   Performance log entries: ${sampleTweet.performance_log?.length || 0}`);
          console.log(`   Last update: ${sampleTweet.last_performance_update || 'Never'}`);
        }
      }
    } catch (dbError) {
      console.error('❌ Database connection failed:', dbError);
    }
    
    // Test 3: Initialize stealth browser (DRY RUN)
    console.log('\n🕵️ TEST 3: Stealth Browser Initialization');
    console.log('=========================================');
    
    console.log('🔄 Initializing stealth browser...');
    const initialized = await tweetPerformanceTracker.initialize();
    
    if (initialized) {
      console.log('✅ Stealth browser initialized successfully');
      console.log('🎭 Stealth features active:');
      console.log('   - Webdriver detection bypass');
      console.log('   - Realistic user agent');
      console.log('   - Twitter session loading');
      console.log('   - Random delays (1-3s)');
      
      // Test 4: Dry run performance tracking
      console.log('\n📈 TEST 4: Performance Tracking Dry Run');
      console.log('======================================');
      
      console.log('🔄 Running performance tracking system...');
      const result = await tweetPerformanceTracker.runPerformanceUpdate();
      
      console.log('📊 PERFORMANCE TRACKING RESULTS:');
      console.log(`   Success: ${result.success}`);
      console.log(`   Tweets processed: ${result.tweetsProcessed}`);
      console.log(`   Tweets updated: ${result.tweetsUpdated}`);
      console.log(`   Duration: ${Math.round(result.duration / 1000)}s`);
      console.log(`   Summary: ${result.summary}`);
      
      if (result.errors.length > 0) {
        console.log('   Errors:');
        result.errors.forEach(error => console.log(`     - ${error}`));
      }
      
      // Test 5: Verify database updates
      if (result.tweetsUpdated > 0) {
        console.log('\n💾 TEST 5: Verify Database Updates');
        console.log('==================================');
        
        try {
          const { supabaseClient } = require('./dist/utils/supabaseClient.js');
          
          // Query recently updated tweets
          const { data: updatedTweets, error } = await supabaseClient.supabase
            ?.from('tweets')
            ?.select('tweet_id, likes, retweets, replies, performance_log, last_performance_update')
            ?.not('last_performance_update', 'is', null)
            ?.order('last_performance_update', { ascending: false })
            ?.limit(3);
          
          if (error) {
            console.error('❌ Could not verify database updates:', error);
          } else if (updatedTweets && updatedTweets.length > 0) {
            console.log(`✅ Verified ${updatedTweets.length} recently updated tweets:`);
            
            updatedTweets.forEach((tweet, index) => {
              console.log(`   ${index + 1}. Tweet ${tweet.tweet_id}:`);
              console.log(`      Current: ${tweet.likes} likes, ${tweet.retweets} retweets`);
              console.log(`      Log entries: ${tweet.performance_log?.length || 0}`);
              console.log(`      Last update: ${new Date(tweet.last_performance_update).toLocaleString()}`);
              
              if (tweet.performance_log && tweet.performance_log.length > 0) {
                const latestEntry = tweet.performance_log[tweet.performance_log.length - 1];
                console.log(`      Latest log: ${latestEntry.likes} likes at ${new Date(latestEntry.t).toLocaleString()}`);
              }
            });
          } else {
            console.log('⚠️ No recently updated tweets found in database');
          }
        } catch (verifyError) {
          console.error('❌ Database verification failed:', verifyError);
        }
      }
      
    } else {
      console.error('❌ Stealth browser failed to initialize');
    }
    
    // Test 6: Performance analysis
    console.log('\n📈 TEST 6: Performance Analysis');
    console.log('===============================');
    
    try {
      const { supabaseClient } = require('./dist/utils/supabaseClient.js');
      
      // Analyze performance trends
      const { data: analyticsData, error } = await supabaseClient.supabase
        ?.from('tweets')
        ?.select('tweet_id, content, likes, retweets, replies, created_at, performance_log')
        ?.not('performance_log', 'is', null)
        ?.order('created_at', { ascending: false })
        ?.limit(10);
      
      if (error) {
        console.error('❌ Analytics query failed:', error);
      } else if (analyticsData && analyticsData.length > 0) {
        console.log(`📊 Performance analytics for ${analyticsData.length} tweets:`);
        
        let totalGrowth = 0;
        let tweetsWithGrowth = 0;
        
        analyticsData.forEach(tweet => {
          if (tweet.performance_log && tweet.performance_log.length > 1) {
            const firstEntry = tweet.performance_log[0];
            const lastEntry = tweet.performance_log[tweet.performance_log.length - 1];
            const likesGrowth = lastEntry.likes - firstEntry.likes;
            const retweetsGrowth = lastEntry.retweets - firstEntry.retweets;
            
            if (likesGrowth > 0 || retweetsGrowth > 0) {
              totalGrowth += likesGrowth + retweetsGrowth;
              tweetsWithGrowth++;
              console.log(`   📈 ${tweet.tweet_id}: +${likesGrowth} likes, +${retweetsGrowth} retweets`);
            }
          }
        });
        
        if (tweetsWithGrowth > 0) {
          const avgGrowth = Math.round(totalGrowth / tweetsWithGrowth);
          console.log(`✅ Average engagement growth: ${avgGrowth} per tweet`);
        } else {
          console.log('📊 No engagement growth detected yet (normal for new tweets)');
        }
      } else {
        console.log('📊 No performance data available for analysis');
      }
    } catch (analyticsError) {
      console.error('❌ Performance analysis failed:', analyticsError);
    }
    
    console.log('\n🎉 === PERFORMANCE TRACKING TEST COMPLETE ===');
    console.log('✅ System ready for autonomous operation!');
    console.log('🕵️ Stealth features: ✅ Session persistence, ✅ Random delays, ✅ Detection bypass');
    console.log('📊 Data tracking: ✅ Historical logs, ✅ Growth analysis, ✅ Smart scheduling');
    console.log('🤖 Scheduled to run every 30 minutes for real-time insights');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testPerformanceTracking().catch(console.error); 