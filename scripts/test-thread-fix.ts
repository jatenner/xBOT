/**
 * Test Thread Posting Fix
 * Tests the BulletproofThreadComposer with fixed contenteditable handling
 */

import { BulletproofThreadComposer } from '../src/posting/BulletproofThreadComposer';

async function testThreadPosting() {
  console.log('🧵 Testing Thread Posting Fix...\n');
  
  const testThread = [
    "🔥 Thread test 1/4: This is testing the fixed contenteditable handling for Twitter's thread composer.",
    "Thread test 2/4: The previous issue was that .fill() doesn't work on contenteditable divs - only on form inputs.",
    "Thread test 3/4: We now use keyboard shortcuts (Meta+A, Backspace) to clear the text box before typing.",
    "Thread test 4/4: This should work reliably now! ✨"
  ];
  
  console.log(`📝 Thread segments to post:`);
  testThread.forEach((segment, i) => {
    console.log(`   ${i + 1}. ${segment.substring(0, 80)}...`);
  });
  
  console.log('\n🚀 Posting thread...\n');
  
  try {
    const result = await BulletproofThreadComposer.post(testThread);
    
    if (result.success) {
      console.log('\n✅ SUCCESS!');
      console.log(`   Mode: ${result.mode}`);
      console.log(`   Root URL: ${result.rootTweetUrl}`);
      console.log(`   Tweet IDs: ${result.tweetIds?.join(', ') || 'none captured'}`);
    } else {
      console.log('\n❌ FAILED!');
      console.log(`   Error: ${result.error}`);
    }
    
    return result.success;
    
  } catch (error: any) {
    console.error('\n❌ EXCEPTION!');
    console.error(`   ${error.message}`);
    return false;
  }
}

// Run the test
testThreadPosting()
  .then(success => {
    console.log('\n' + '='.repeat(60));
    console.log(success ? '✅ Thread posting test PASSED' : '❌ Thread posting test FAILED');
    console.log('='.repeat(60));
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Test crashed:', error);
    process.exit(1);
  });

