#!/usr/bin/env node
/**
 * Posting Validation Script
 * Tests the Twitter posting functionality end-to-end
 */

import { UltimateTwitterPoster } from '../src/posting/UltimateTwitterPoster.js';
import { XApiPoster } from '../src/posting/xApiPoster.js';
import { getEnvConfig } from '../src/config/env.js';

async function validatePosting() {
  console.log('🧪 VALIDATE_POSTING: Starting validation...');
  
  const config = getEnvConfig();
  const testContent = `Test post from xBOT validation script - ${new Date().toISOString()}`;
  
  let success = false;
  let method = '';
  let error = '';
  
  try {
    if (config.FEATURE_X_API_POSTING) {
      console.log('🔌 Testing X API posting...');
      method = 'X API';
      
      const apiPoster = new XApiPoster();
      const result = await apiPoster.postStatus(testContent);
      
      if (result.success) {
        console.log(`✅ X API posting successful - Tweet ID: ${result.tweetId}`);
        success = true;
      } else {
        error = result.error || 'Unknown X API error';
      }
    } else {
      console.log('🌐 Testing Playwright posting...');
      method = 'Playwright';
      
      const poster = new UltimateTwitterPoster();
      const result = await poster.postTweet(testContent);
      
      await poster.dispose();
      
      if (result.success) {
        console.log(`✅ Playwright posting successful - Tweet ID: ${result.tweetId}`);
        success = true;
      } else {
        error = result.error || 'Unknown Playwright error';
      }
    }
  } catch (e) {
    error = e.message;
  }
  
  // Print results
  console.log('\n📊 VALIDATION RESULTS:');
  console.log('='.repeat(50));
  console.log(`Method: ${method}`);
  console.log(`Success: ${success ? '✅ YES' : '❌ NO'}`);
  console.log(`Content: "${testContent}"`);
  
  if (success) {
    console.log('🎉 Posting validation PASSED');
    process.exit(0);
  } else {
    console.log(`💥 Posting validation FAILED: ${error}`);
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

validatePosting().catch(error => {
  console.error('💥 Validation script error:', error);
  process.exit(1);
});
