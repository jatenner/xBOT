#!/usr/bin/env node

/**
 * 🧪 QUICK BULLETPROOF TEST
 * Test with timeout to avoid hanging
 */

require('dotenv').config();

async function testBulletproofQuick() {
  console.log('🧪 QUICK BULLETPROOF TEST STARTING...');
  
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Test timeout after 60 seconds')), 60000);
  });
  
  const testPromise = async () => {
    const { FixedThreadPoster } = require('./dist/posting/fixedThreadPoster.js');
    
    const testContent = [
      "🧪 BULLETPROOF TEST: This is a test of the improved Twitter automation system. Enhanced selectors and fallback strategies should make posting more reliable.",
      "🔧 TECHNICAL IMPROVEMENTS: Multiple selector strategies, comprehensive post button detection, keyboard shortcut fallbacks, and better error handling.",
      "🎯 RESULT: If you see this thread, the bulletproof Twitter automation is working perfectly! Ready for health content deployment."
    ];
    
    console.log('✅ Test content prepared');
    console.log('🧵 Thread parts:', testContent.length);
    
    const threadPoster = FixedThreadPoster.getInstance();
    const validation = threadPoster.validateTweets(testContent);
    
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.issues.join(', ')}`);
    }
    
    console.log('✅ Validation passed');
    console.log('🚀 TESTING BULLETPROOF POSTING...');
    
    const result = await threadPoster.postProperThread(testContent);
    
    return result;
  };
  
  try {
    const result = await Promise.race([testPromise(), timeoutPromise]);
    
    if (result.success) {
      console.log('🎊 === BULLETPROOF TEST SUCCESSFUL! ===');
      console.log(`✅ Root Tweet ID: ${result.rootTweetId}`);
      console.log(`🧵 Replies: ${result.replyIds?.length || 0}`);
      console.log(`📊 Total Posted: ${result.totalTweetsPosted}`);
      console.log('');
      console.log('🚀 BULLETPROOF SYSTEM READY FOR PRODUCTION!');
      console.log('   Enhanced Twitter automation is working');
      console.log('   Ready to deploy health content');
      console.log('   Ready to push to Railway');
      
      return true;
    } else {
      console.log('❌ === BULLETPROOF TEST FAILED ===');
      console.log(`📝 Error: ${result.error}`);
      console.log('');
      console.log('🔧 STILL NEEDS WORK:');
      console.log('   Check the detailed logs above');
      console.log('   May need additional selector fixes');
      
      return false;
    }
    
  } catch (error) {
    if (error.message.includes('timeout')) {
      console.log('⏰ === TEST TIMEOUT ===');
      console.log('🔧 The automation is taking too long');
      console.log('   This usually means browser/session issues');
      console.log('   Try refreshing Twitter session or manual posting');
    } else {
      console.log('💥 === TEST CRASHED ===');
      console.log(`📝 Error: ${error.message}`);
    }
    
    return false;
  }
}

// Execute test
testBulletproofQuick().then((success) => {
  if (success) {
    console.log('');
    console.log('🎯 NEXT STEPS:');
    console.log('   1. Deploy to Railway');
    console.log('   2. Test health content posting');
    console.log('   3. Enable autonomous operation');
  } else {
    console.log('');
    console.log('🔧 ALTERNATIVES:');
    console.log('   1. Try manual posting first');
    console.log('   2. Refresh Twitter session');
    console.log('   3. Deploy to Railway anyway (different environment)');
  }
}).catch(console.error);
