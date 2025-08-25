#!/usr/bin/env node

/**
 * SIMPLE POST TEST - Without complex engagement tracking
 * 
 * This tests the core posting functionality without external dependencies
 */

require('dotenv').config();

console.log('🧪 Testing Core Posting Functionality');
console.log('====================================');

async function testPosting() {
  try {
    console.log('📦 Loading simplified posting engine...');
    
    const { SimplifiedPostingEngine } = require('./dist/core/simplifiedPostingEngine');
    const engine = SimplifiedPostingEngine.getInstance();
    
    console.log('✅ Engine loaded successfully');
    
    // Check status
    const status = engine.getStatus();
    console.log(`📊 Current status:`);
    console.log(`   - Can post now: ${status.canPostNow}`);
    console.log(`   - Daily posts: ${status.dailyPostCount}/${status.maxDailyPosts}`);
    console.log(`   - Is posting: ${status.isPosting}`);
    
    if (!status.canPostNow) {
      console.log('⚠️ Cannot post right now due to rate limits');
      return;
    }
    
    // Test topic
    const topic = process.argv[2] || 'sleep optimization breakthrough';
    console.log(`📝 Creating post about: ${topic}`);
    
    console.log('🚀 Attempting to create engaging post...');
    
    // Use the simplified engine but catch any errors gracefully
    try {
      const result = await engine.createEngagingPost(topic);
      
      if (result.success) {
        console.log('✅ POST CREATED SUCCESSFULLY!');
        console.log(`🐦 Tweet ID: ${result.tweetId}`);
        console.log(`📊 Engagement Prediction: ${result.engagementPrediction}%`);
        console.log(`📝 Content Preview: ${result.content?.substring(0, 100)}...`);
        
        // Show updated status
        const newStatus = engine.getStatus();
        console.log(`📊 Updated status: ${newStatus.dailyPostCount}/${newStatus.maxDailyPosts} posts today`);
        
        console.log('\n🎯 SUCCESS! The simplified system is working.');
        console.log('📈 Monitor your Twitter account for the new post.');
        
      } else {
        console.log('❌ POST CREATION FAILED');
        console.log(`🚨 Error: ${result.error}`);
        
        // Diagnose the issue
        if (result.error?.includes('rate limit')) {
          console.log('💡 Issue: Rate limiting - try again later');
        } else if (result.error?.includes('Twitter')) {
          console.log('💡 Issue: Twitter API problem - check credentials');
        } else if (result.error?.includes('content')) {
          console.log('💡 Issue: Content generation problem - try different topic');
        } else {
          console.log('💡 Issue: Unknown error - check logs');
        }
      }
      
    } catch (error) {
      console.log('❌ POSTING ENGINE ERROR');
      console.log(`🚨 Error: ${error.message}`);
      
      // Provide specific debugging info
      if (error.message.includes('Twitter')) {
        console.log('💡 This appears to be a Twitter API issue');
        console.log('🔧 Recommendation: Check Twitter API credentials and permissions');
      } else if (error.message.includes('OpenAI')) {
        console.log('💡 This appears to be an OpenAI API issue');
        console.log('🔧 Recommendation: Check OpenAI API key and quota');
      } else {
        console.log('💡 This appears to be a system configuration issue');
        console.log('🔧 Recommendation: Check all environment variables');
      }
    }
    
  } catch (error) {
    console.error('💥 FATAL ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Show usage if requested
if (process.argv.includes('--help')) {
  console.log(`
🧪 SIMPLE POST TEST

Usage:
  node simple_post_test.js [topic]
  
Examples:
  node simple_post_test.js "sleep optimization"
  node simple_post_test.js "nutrition breakthrough"
  node simple_post_test.js "fitness hack"
  
This script tests the core posting functionality without complex dependencies.
It will create a real Twitter post if successful.
`);
  process.exit(0);
}

// Run the test
testPosting().catch(error => {
  console.error('💥 Unhandled error:', error);
  process.exit(1);
});
