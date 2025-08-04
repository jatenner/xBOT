/**
 * 🚨 EMERGENCY TEST POSTING SCRIPT
 * Direct posting to test if Twitter connection works
 */

const { ViralFollowerGrowthMaster } = require('./dist/agents/viralFollowerGrowthMaster.js');
const { BrowserTweetPoster } = require('./dist/utils/browserTweetPoster.js');

async function emergencyTestPost() {
  console.log('🚨 === EMERGENCY TEST POSTING ===');
  console.log('🎯 Goal: Test if we can actually post to Twitter');
  
  try {
    // Generate simple viral content
    console.log('🧠 Generating viral content...');
    const viralMaster = ViralFollowerGrowthMaster.getInstance();
    const content = await viralMaster.generateViralContent('controversial_health');
    
    console.log('📝 Generated content:', content.content);
    console.log('📊 Expected engagement:', content.expectedEngagement);
    
    // Attempt direct posting
    console.log('🚀 Attempting to post to Twitter...');
    const browserPoster = new BrowserTweetPoster();
    
    const result = await browserPoster.postTweet(content.content);
    
    if (result.success) {
      console.log('✅ SUCCESS: Tweet posted to Twitter!');
      console.log('🔗 Tweet ID:', result.tweetId);
      console.log('📊 Now monitor for real engagement...');
      
      // Wait 5 minutes then check real engagement
      console.log('⏱️ Waiting 5 minutes to check real engagement...');
      setTimeout(async () => {
        console.log('🔍 Checking real engagement...');
        // This would need real Twitter API integration
        console.log('📈 Check Twitter directly for likes, retweets, replies');
      }, 5 * 60 * 1000);
      
    } else {
      console.log('❌ FAILED: Could not post to Twitter');
      console.log('💡 Error:', result.error);
      console.log('🔧 Manual posting required');
      
      // Provide manual posting instructions
      console.log('\n📋 MANUAL POSTING INSTRUCTIONS:');
      console.log('1. Go to https://twitter.com/compose/tweet');
      console.log('2. Copy this content:');
      console.log('---START---');
      console.log(content.content);
      console.log('---END---');
      console.log('3. Post manually and monitor engagement');
    }
    
  } catch (error) {
    console.error('❌ Emergency posting failed:', error.message);
    console.log('🔧 System needs immediate repair');
  }
}

// Run the emergency test
emergencyTestPost().catch(console.error);