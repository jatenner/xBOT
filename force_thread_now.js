#!/usr/bin/env node

console.log('🧵 FORCING THREAD POST - Testing thread generation and real posting...');

async function forceThreadPost() {
  try {
    console.log('🚀 THREAD_TEST: Importing SimplifiedPostingEngine...');
    const { SimplifiedPostingEngine } = await import('./dist/core/simplifiedPostingEngine.js');
    
    console.log('🧠 THREAD_TEST: Initializing engine...');
    const engine = SimplifiedPostingEngine.getInstance();
    
    // Force a thread about viral health optimization
    const threadTopic = 'controversial health biohack that doctors hate but actually works';
    
    console.log(`🎯 THREAD_TEST: Forcing thread: "${threadTopic}"`);
    const result = await engine.createEngagingPost(threadTopic);
    
    console.log('✅ THREAD_TEST_RESULT:');
    console.log(`   Success: ${result.success}`);
    console.log(`   Format: ${result.format}`);
    console.log(`   Tweet ID: ${result.tweetId}`);
    console.log(`   Content Length: ${result.content?.length || 0} chars`);
    console.log(`   Method: ${result.method}`);
    
    if (result.success && result.format === 'thread') {
      console.log('🎉 SUCCESS: Thread was created!');
      console.log(`🔗 ROOT_TWEET_ID: ${result.tweetId}`);
      console.log(`📊 REPLY_IDS: ${result.replyIds?.length || 0} replies`);
      
      // Show first 200 chars of content
      if (result.content) {
        console.log(`📝 THREAD_PREVIEW: "${result.content.substring(0, 200)}..."`);
      }
    } else {
      console.log('❌ FAILED: Thread was not created properly');
      console.log(`📝 Got format: ${result.format} instead of thread`);
      if (result.error) {
        console.log(`❌ Error: ${result.error}`);
      }
    }
    
  } catch (error) {
    console.error('💥 THREAD_TEST_ERROR:', error.message);
    console.error('Stack:', error.stack);
  }
  
  process.exit(0);
}

forceThreadPost();
