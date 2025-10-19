#!/usr/bin/env node
/**
 * 🧪 FORCE TEST POST
 * Posts one tweet immediately to test ID extraction and scraping
 */

require('dotenv').config();

async function forceTestPost() {
  console.log('🧪 === FORCE TEST POST ===');
  console.log('🎯 Testing: ID extraction + author verification + scraping');
  console.log('⏰ Time:', new Date().toLocaleString());
  console.log('');

  try {
    // Use the posting queue system
    const { postingSingleContent } = require('./dist/src/jobs/postingQueueJob.js');
    
    console.log('✅ Loaded posting system');
    console.log('📝 Generating test content...');
    
    // Create a simple test post
    const testContent = `Testing our posting system at ${new Date().toLocaleTimeString()}. 

Quick health fact: Sleep quality matters more than quantity. Even 6 hours of deep sleep beats 8 hours of interrupted rest.`;

    console.log('');
    console.log('📄 TEST CONTENT:');
    console.log('─'.repeat(60));
    console.log(testContent);
    console.log('─'.repeat(60));
    console.log('');
    console.log('🚀 Posting to Twitter...');
    
    // Force post via posting queue
    const result = await postingSingleContent(testContent);
    
    console.log('');
    console.log('📊 RESULT:');
    console.log(JSON.stringify(result, null, 2));
    console.log('');
    
    if (result && result.success) {
      console.log('✅ POST SUCCESS!');
      console.log(`   Tweet ID: ${result.tweetId}`);
      console.log('');
      console.log('🔍 NEXT STEPS:');
      console.log('   1. Check Twitter: https://x.com/Signal_Synapse');
      console.log(`   2. Verify tweet: https://x.com/Signal_Synapse/status/${result.tweetId}`);
      console.log('   3. Check if ID is correct (not @BestInDogs)');
      console.log('   4. Wait 30 seconds for scraping job to run');
    } else {
      console.log('❌ POST FAILED');
      console.log('   Error:', result?.error || 'Unknown error');
    }
    
  } catch (error) {
    console.error('❌ SCRIPT ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

forceTestPost();

