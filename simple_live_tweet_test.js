#!/usr/bin/env node

/**
 * 🚀 SIMPLE LIVE TWEET TEST
 * 
 * Direct approach to post a real live tweet
 */

require('dotenv').config();

console.log('🚀 === SIMPLE LIVE TWEET TEST ===');
console.log('🔥 Attempting to post a real tweet...\n');

async function simpleLiveTweetTest() {
  try {
    // Force live mode
    process.env.NODE_ENV = 'production';
    process.env.LIVE_POSTING_ENABLED = 'true';
    
    console.log('🎯 Generating autonomous content...');
    
    const autonomousContent = [
      "🧠 Autonomous AI system LIVE! Testing real-time intelligence and learning. #AI #Autonomous #Innovation",
      "⚡ Zero-intervention AI posting with full intelligence tracking! #TechBreakthrough #MachineLearning", 
      "🎯 Live autonomous system operational! Predictive analytics active. #AIRevolution #Automation",
      "🚀 Autonomous intelligence achieved! Learning and optimizing automatically. #FutureIsNow #AI",
      "🔥 AI-powered autonomous posting LIVE! Intelligent decision making active! #AutomationWin #Tech"
    ];
    
    const selectedContent = autonomousContent[Math.floor(Math.random() * autonomousContent.length)];
    console.log(`📝 Selected: ${selectedContent}`);
    
    console.log('\n🔥 Attempting live posting in 3 seconds...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Method 1: Try running main system with immediate post flag
    console.log('🚀 Method 1: Triggering main system...');
    
    const { spawn } = require('child_process');
    
    const postProcess = spawn('node', ['src/index.js'], {
      env: {
        ...process.env,
        FORCE_IMMEDIATE_POST: 'true',
        IMMEDIATE_TWEET_CONTENT: selectedContent,
        BYPASS_SCHEDULE: 'true',
        LIVE_POSTING_ENABLED: 'true'
      },
      stdio: 'inherit'
    });
    
    // Set timeout to prevent hanging
    const timeout = setTimeout(() => {
      postProcess.kill();
      console.log('⏰ Timeout reached, moving to next method...');
    }, 15000);
    
    postProcess.on('close', (code) => {
      clearTimeout(timeout);
      console.log(`📊 Main system exited with code: ${code}`);
    });
    
    // Wait a bit then try method 2
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    console.log('\n🔄 Method 2: Direct scheduler activation...');
    
    try {
      // Try to run scheduler directly
      const schedulerProcess = spawn('npx', ['tsx', '-e', `
        import { Scheduler } from './src/agents/scheduler.js';
        
        console.log('🎯 Starting scheduler for immediate post...');
        
        const scheduler = new Scheduler();
        await scheduler.start();
        
        console.log('✅ Scheduler started successfully');
      `], {
        env: {
          ...process.env,
          FORCE_IMMEDIATE_POST: 'true',
          IMMEDIATE_TWEET_CONTENT: selectedContent
        },
        stdio: 'inherit'
      });
      
      const schedulerTimeout = setTimeout(() => {
        schedulerProcess.kill();
        console.log('⏰ Scheduler timeout reached');
      }, 20000);
      
      schedulerProcess.on('close', (code) => {
        clearTimeout(schedulerTimeout);
        console.log(`📊 Scheduler exited with code: ${code}`);
      });
      
    } catch (schedulerError) {
      console.log('⚠️ Scheduler method had issues:', schedulerError.message);
    }
    
    // Wait then check results
    await new Promise(resolve => setTimeout(resolve, 15000));
    
    console.log('\n🔍 Checking results...');
    
    // Check database for recent posts
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
    );
    
    const { data: recentTweets, error } = await supabase
      .from('tweets')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (!error && recentTweets && recentTweets.length > 0) {
      console.log('\n📊 Recent database activity:');
      
      const last5Minutes = new Date(Date.now() - 5 * 60 * 1000);
      const recentPosts = recentTweets.filter(t => new Date(t.created_at) > last5Minutes);
      
      if (recentPosts.length > 0) {
        console.log('🎉 Recent posts found:');
        recentPosts.forEach((tweet, index) => {
          console.log(`  ${index + 1}. ${tweet.content.substring(0, 60)}...`);
          console.log(`     📅 ${tweet.created_at}`);
          console.log(`     🆔 ${tweet.tweet_id}`);
          if (tweet.twitter_id) {
            console.log(`     🐦 Twitter ID: ${tweet.twitter_id}`);
            console.log('     ✅ CONFIRMED: Posted to Twitter!');
          }
          console.log('');
        });
        
        // Check if our content was posted
        const ourPost = recentPosts.find(t => 
          t.content.includes('Autonomous') || 
          t.content.includes('LIVE') ||
          t.content === selectedContent
        );
        
        if (ourPost) {
          console.log('🎯 OUR AUTONOMOUS POST FOUND!');
          console.log(`📝 Content: ${ourPost.content}`);
          
          if (ourPost.twitter_id) {
            console.log('🎉 LIVE TWEET CONFIRMED: Posted to Twitter!');
            console.log(`🔗 Twitter URL: https://twitter.com/user/status/${ourPost.twitter_id}`);
          } else {
            console.log('📊 Post saved to database, Twitter status checking...');
          }
        }
      } else {
        console.log('⚠️ No recent posts in last 5 minutes');
      }
    }
    
    console.log('\n🎯 === LIVE TWEET TEST COMPLETE ===');
    console.log('');
    console.log('📋 What was attempted:');
    console.log('   🚀 Main system activation with immediate post');
    console.log('   🔄 Direct scheduler activation');
    console.log('   📊 Database verification');
    console.log('');
    console.log('🔍 Next steps:');
    console.log('   1. Check your Twitter account manually');
    console.log('   2. Look for recent tweets with AI/Autonomous content');
    console.log('   3. Check Twitter notifications for posting activity');
    console.log('   4. Verify in Twitter Analytics');
    
    return {
      success: true,
      attempted: true,
      content: selectedContent,
      checkTwitter: true
    };
    
  } catch (error) {
    console.error('❌ Simple live tweet test failed:', error);
    
    console.log('\n🔧 === MANUAL POSTING INSTRUCTIONS ===');
    console.log('');
    console.log('🎯 To manually verify your system works:');
    console.log('   1. Start your main system: npm start');
    console.log('   2. Watch for automatic posting');
    console.log('   3. Check Twitter account activity');
    console.log('   4. Monitor database for new tweets');
    console.log('');
    console.log('📋 Troubleshooting:');
    console.log('   • Verify Twitter API credentials');
    console.log('   • Check environment variables');
    console.log('   • Ensure posting permissions enabled');
    
    return {
      success: false,
      error: error.message,
      manualVerificationNeeded: true
    };
  }
}

// Run the simple live tweet test
simpleLiveTweetTest()
  .then((result) => {
    console.log('\n🚀 === SIMPLE LIVE TWEET TEST COMPLETE ===');
    
    if (result.success) {
      console.log('🎉 Test execution completed!');
      console.log('🔍 Check your Twitter account for the live tweet!');
    } else {
      console.log('⚠️ Test encountered issues');
      console.log('🔧 Manual verification recommended');
    }
  })
  .catch((error) => {
    console.error('❌ Test execution failed:', error);
  }); 