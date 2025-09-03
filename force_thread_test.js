#!/usr/bin/env node

console.log('🧵 FORCING THREAD TEST - Testing thread generation and posting...');

async function forceThreadPost() {
  try {
    // Import the simplified posting engine
    const { SimplifiedPostingEngine } = await import('./dist/core/simplifiedPostingEngine.js');
    
    console.log('🚀 THREAD_TEST: Initializing SimplifiedPostingEngine...');
    const engine = SimplifiedPostingEngine.getInstance();
    
    // Force a scientific thread about a trending health topic
    const threadTopic = 'thread about sleep optimization and circadian rhythm hacking for maximum energy';
    
    console.log(`🎯 THREAD_TEST: Forcing thread creation: "${threadTopic}"`);
    const result = await engine.createEngagingPost(threadTopic);
    
    console.log('✅ THREAD_TEST_RESULT:', JSON.stringify(result, null, 2));
    
    if (result.success && result.format === 'thread') {
      console.log('🎉 SUCCESS: Thread was created and posted!');
      console.log(`📊 THREAD_METRICS: ${result.tweetCount} tweets in thread`);
      console.log(`🔗 ROOT_TWEET_ID: ${result.tweetId}`);
    } else {
      console.log('❌ FAILED: Thread was not created properly');
      console.log('📝 FORMAT_RETURNED:', result.format);
    }
    
  } catch (error) {
    console.error('💥 THREAD_TEST_ERROR:', error.message);
  }
  
  process.exit(0);
}

forceThreadPost();
