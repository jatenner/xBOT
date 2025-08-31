#!/usr/bin/env node

/**
 * 🔧 QUICK TEST POST
 * Simple test to see if basic posting works after fixes
 */

require('dotenv').config();

async function quickTestPost() {
  console.log('🔧 === QUICK POSTING TEST ===');
  console.log('⏰ Test Time:', new Date().toLocaleString());
  
  try {
    console.log('📝 Testing basic posting pipeline...');
    
    // Test 1: Can we import the SimplifiedPostingEngine?
    console.log('1️⃣ Testing SimplifiedPostingEngine import...');
    const { SimplifiedPostingEngine } = await import('./dist/core/simplifiedPostingEngine.js');
    const engine = SimplifiedPostingEngine.getInstance();
    console.log('✅ SimplifiedPostingEngine imported and instantiated');
    
    // Test 2: Can we generate content?
    console.log('2️⃣ Testing content generation...');
    const result = await engine.createEngagingPost('quick health tip');
    
    if (result.success) {
      console.log('✅ POST SUCCESS!');
      console.log(`📝 Content: ${result.content?.substring(0, 100)}...`);
      console.log(`🆔 Tweet ID: ${result.tweetId}`);
      console.log('🎉 SYSTEM IS OPERATIONAL!');
      return { success: true, operational: true };
    } else {
      console.log('❌ POST FAILED');
      console.log(`Error: ${result.error}`);
      return { success: false, error: result.error };
    }
    
  } catch (error) {
    console.error('❌ TEST FAILED:', error.message);
    console.error('Stack:', error.stack?.split('\n').slice(0, 5).join('\n'));
    return { success: false, error: error.message };
  }
}

// Run test
quickTestPost()
  .then(result => {
    if (result.success) {
      console.log('\n🎉 SYSTEM IS WORKING!');
      process.exit(0);
    } else {
      console.log('\n🚨 SYSTEM STILL HAS ISSUES');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('💥 Test crashed:', error);
    process.exit(1);
  });
