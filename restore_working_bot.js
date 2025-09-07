/**
 * 🔄 RESTORE WORKING BOT
 * 
 * This bypasses all the broken "fast" and "bulletproof" systems
 * and goes back to the original working AutonomousTwitterPoster
 */

const { AutonomousTwitterPoster } = require('./src/agents/autonomousTwitterPoster');

async function testOriginalBot() {
  console.log('🔄 RESTORING: Original working bot system...');
  
  // Enable live posting
  process.env.LIVE_POSTS = 'true';
  
  try {
    const poster = AutonomousTwitterPoster.getInstance();
    
    // Test with a simple tweet
    const testContent = 'Testing restored bot functionality - original system';
    
    console.log('📝 TESTING: Original AutonomousTwitterPoster...');
    console.log(`📝 CONTENT: "${testContent}"`);
    
    const result = await poster.postSingle(testContent, {
      topic: 'test',
      urgency: 'normal'
    });
    
    if (result.success) {
      console.log('✅ SUCCESS: Original bot system works!');
      console.log(`🐦 TWEET_ID: ${result.tweetId}`);
    } else {
      console.log('❌ FAILED:', result.error);
    }
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
  }
}

// Run the test
testOriginalBot().catch(console.error);
