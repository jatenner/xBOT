#!/usr/bin/env node

console.log('🧵 FORCE THREAD TEST: Testing thread generation and posting...');

async function forceThreadTest() {
  try {
    console.log('🎯 Forcing thread generation...');
    
    const { SimplifiedPostingEngine } = await import('./dist/core/simplifiedPostingEngine.js');
    const engine = SimplifiedPostingEngine.getInstance();
    
    // Force thread by including "thread" in topic
    const result = await engine.createEngagingPost('thread about sleep optimization and circadian rhythm hacking');
    
    console.log('📊 THREAD_TEST_RESULT:');
    console.log(`   Success: ${result.success}`);
    console.log(`   Tweet ID: ${result.tweetId || 'None'}`);
    console.log(`   Content Preview: ${(result.content || '').substring(0, 100)}...`);
    console.log(`   Error: ${result.error || 'None'}`);
    
    if (result.success) {
      console.log('✅ THREAD_TEST: Thread generation worked!');
    } else {
      console.log('❌ THREAD_TEST: Thread generation failed!');
    }
    
  } catch (error) {
    console.error('💥 THREAD_TEST_CRASHED:', error.message);
  }
}

forceThreadTest();
