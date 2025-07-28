/**
 * 🧪 BROWSER POSTING TEST
 * 
 * Tests the enhanced browser-based tweet posting with new selectors,
 * retry logic, and fallback strategies.
 */

import { browserTweetPoster } from '../utils/browserTweetPoster';

async function testBrowserPosting() {
  console.log('🧪 === BROWSER POSTING TEST ===');
  
  try {
    // Enable debug screenshots for testing
    process.env.DEBUG_SCREENSHOT = 'true';
    
    console.log('🚀 Initializing browser tweet poster...');
    const initSuccess = await browserTweetPoster.initialize();
    
    if (!initSuccess) {
      console.error('❌ Failed to initialize browser tweet poster');
      return;
    }

    console.log('✅ Browser tweet poster initialized successfully');
    
    // Check status
    const status = browserTweetPoster.getStatus();
    console.log('📊 Status:', status);
    
    // Test tweet content
    const testTweet = `🧪 Browser posting test ${new Date().toLocaleTimeString()} - Testing enhanced selectors and retry logic for reliable tweet posting! #TestTweet #BrowserAutomation`;
    
    console.log(`📝 Attempting to post test tweet: "${testTweet}"`);
    
    // Post the tweet
    const result = await browserTweetPoster.postTweet(testTweet);
    
    if (result.success) {
      console.log('✅ TEST PASSED: Tweet posted successfully!');
      console.log(`🆔 Tweet ID: ${result.tweet_id}`);
    } else {
      console.error('❌ TEST FAILED: Tweet posting failed');
      console.error(`❌ Error: ${result.error}`);
    }
    
    // Clean up
    await browserTweetPoster.close();
    console.log('🔒 Browser closed');
    
  } catch (error) {
    console.error('💥 Test error:', error);
  }
}

// Run the test if called directly
if (require.main === module) {
  testBrowserPosting().then(() => {
    console.log('🧪 Test completed');
    process.exit(0);
  }).catch((error) => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  });
}

export { testBrowserPosting }; 