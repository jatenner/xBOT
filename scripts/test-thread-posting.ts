/**
 * 🧪 TEST THREAD POSTING
 * 
 * This script forces a thread post to verify the thread posting system works.
 * Use this to debug thread posting issues.
 */

import { BulletproofThreadComposer } from '../src/posting/BulletproofThreadComposer';

async function testThreadPosting() {
  console.log('🧪 TEST: Starting thread posting test...\n');
  
  // Test thread content
  const testThread = [
    "Magnesium is one of the most important minerals for sleep quality, yet 75% of people are deficient. Here's what you need to know:",
    
    "Magnesium regulates GABA receptors in your brain - the same neurotransmitter that sleep medications target. Low levels = racing thoughts at night.",
    
    "The best form: Magnesium glycinate (not oxide). Take 300-400mg 1-2 hours before bed. Oxide causes digestive issues and absorbs poorly.",
    
    "Works synergistically with vitamin D and B6. If you're supplementing D but still sleeping poorly, magnesium deficiency is likely the culprit."
  ];
  
  console.log(`📝 Test thread: ${testThread.length} tweets\n`);
  testThread.forEach((tweet, i) => {
    console.log(`   Tweet ${i + 1}: "${tweet.substring(0, 60)}..." (${tweet.length} chars)`);
  });
  
  console.log('\n🚀 Posting thread to Twitter...\n');
  
  try {
    const result = await BulletproofThreadComposer.post(testThread);
    
    if (result.success) {
      console.log('\n✅ TEST PASSED: Thread posted successfully!');
      console.log(`   Root URL: ${result.rootTweetUrl}`);
      console.log(`   Mode: ${result.mode}`);
      if (result.tweetIds && result.tweetIds.length > 0) {
        console.log(`   Tweet IDs: ${result.tweetIds.join(', ')}`);
      }
    } else {
      console.log('\n❌ TEST FAILED: Thread posting failed');
      console.log(`   Error: ${result.error}`);
      process.exit(1);
    }
    
  } catch (error: any) {
    console.error('\n💥 TEST CRASHED:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
  
  console.log('\n🎉 Thread posting test complete!');
}

// Run the test
testThreadPosting().catch((error) => {
  console.error('💥 Test failed:', error);
  process.exit(1);
});

