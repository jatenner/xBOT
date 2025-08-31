#!/usr/bin/env node

/**
 * 🚨 EMERGENCY POSTING SCRIPT
 * Bypasses stuck posting system and posts directly
 */

require('dotenv').config();

async function emergencyPost() {
  console.log('🚨 EMERGENCY POSTING - BYPASSING STUCK SYSTEM');
  
  try {
    // Import the TwitterPoster directly (our enhanced version)
    const { TwitterPoster } = await import('./src/posting/postThread.js');
    
    const poster = new TwitterPoster();
    
    // Generate simple health content
    const healthTips = [
      "Your environment shapes your behavior more than your motivation. If you want to build a habit, make it easy. If you want to break one, make it hard.",
      "The modern world is full of get-rich-quick schemes. Most of them are just get-poor-quick schemes for the people who fall for them.",
      "Your brain uses 20% of your daily calories. That afternoon mental fog? Often it's low blood sugar, not lack of caffeine. Try protein + complex carbs for steady energy."
    ];
    
    const content = healthTips[Math.floor(Math.random() * healthTips.length)];
    
    console.log(`📝 Posting emergency content: "${content.substring(0, 50)}..."`);
    
    const result = await poster.postSingleTweet(content);
    
    if (result.success) {
      console.log(`✅ EMERGENCY POST SUCCESSFUL: ${result.tweetId}`);
      console.log('🔄 System should be unstuck now');
      return { success: true, tweetId: result.tweetId };
    } else {
      console.error(`❌ Emergency post failed: ${result.error}`);
      return { success: false, error: result.error };
    }
    
  } catch (error) {
    console.error('💥 Emergency posting failed:', error);
    return { success: false, error: error.message };
  }
}

if (require.main === module) {
  emergencyPost()
    .then(result => {
      if (result.success) {
        console.log('🎉 EMERGENCY POSTING SUCCESSFUL - SYSTEM UNSTUCK!');
        process.exit(0);
      } else {
        console.error('🚨 EMERGENCY POSTING FAILED');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('💥 Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { emergencyPost };
