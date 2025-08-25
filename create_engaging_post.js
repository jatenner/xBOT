#!/usr/bin/env node

/**
 * SIMPLE POST CREATOR - Emergency Fix
 * 
 * This script creates engaging posts using the simplified system
 * and tracks real engagement metrics.
 */

const { SimplifiedPostingEngine } = require('./dist/core/simplifiedPostingEngine');
const { RealEngagementTracker } = require('./dist/metrics/realEngagementTracker');

async function createPost() {
  console.log('🚀 Creating engaging post with simplified system...');
  
  try {
    // Initialize systems
    const postingEngine = SimplifiedPostingEngine.getInstance();
    const engagementTracker = RealEngagementTracker.getInstance();
    
    // Initialize engagement tracker (skip if Twitter API has issues)
    try {
      await engagementTracker.initialize();
      console.log('✅ Engagement tracker initialized');
    } catch (error) {
      console.log(`⚠️ Engagement tracker failed to initialize: ${error.message}`);
      console.log('📝 Continuing without engagement tracking for now...');
    }
    
    // Get topic from command line or use default
    const topic = process.argv[2] || 'health breakthrough';
    console.log(`📝 Topic: ${topic}`);
    
    // Create the post
    const result = await postingEngine.createEngagingPost(topic);
    
    if (result.success) {
      console.log('✅ POST CREATED SUCCESSFULLY!');
      console.log(`🐦 Tweet ID: ${result.tweetId}`);
      console.log(`📊 Engagement Prediction: ${result.engagementPrediction}%`);
      console.log(`📝 Content: ${result.content}`);
      
      // Track initial metrics
      console.log('📊 Tracking initial metrics...');
      setTimeout(async () => {
        const metrics = await engagementTracker.trackTweet(result.tweetId);
        if (metrics) {
          console.log(`📈 Initial metrics: ${metrics.likes}❤️ ${metrics.retweets}🔄 ${metrics.replies}💬`);
        }
      }, 30000); // Wait 30 seconds for initial metrics
      
      // Get posting status
      const status = postingEngine.getStatus();
      console.log(`📊 Daily posts: ${status.dailyPostCount}/${status.maxDailyPosts}`);
      console.log(`⏰ Can post again: ${status.canPostNow ? 'Yes' : 'No'}`);
      
    } else {
      console.log('❌ POST FAILED!');
      console.log(`🚨 Error: ${result.error}`);
      
      // Show status for debugging
      const status = postingEngine.getStatus();
      console.log(`📊 Status: Daily posts: ${status.dailyPostCount}/${status.maxDailyPosts}`);
      console.log(`⏰ Can post: ${status.canPostNow}`);
      console.log(`🔒 Is posting: ${status.isPosting}`);
    }
    
  } catch (error) {
    console.error('💥 FATAL ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Show usage if no arguments
if (process.argv.includes('--help')) {
  console.log(`
🤖 SIMPLE POST CREATOR

Usage:
  node create_engaging_post.js [topic]
  
Examples:
  node create_engaging_post.js "sleep optimization"
  node create_engaging_post.js "nutrition breakthrough"
  node create_engaging_post.js "fitness hack"
  
The system will:
✅ Create engaging content optimized for likes/retweets
✅ Post to Twitter with proper rate limiting
✅ Track real engagement metrics
✅ Store data for learning

Rate Limits:
- Maximum 12 posts per day
- Minimum 45 minutes between posts
- Automatic daily reset
`);
  process.exit(0);
}

// Run the post creation
createPost().catch(error => {
  console.error('💥 Unhandled error:', error);
  process.exit(1);
});
