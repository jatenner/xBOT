#!/usr/bin/env node

/**
 * 🔍 VERIFY PRODUCTION API LIMITS
 * Simple test to see exactly what Twitter API headers we're getting
 */

async function verifyAPILimits() {
  console.log('🔍 VERIFYING TWITTER API LIMITS...');
  
  try {
    // Import the compiled modules
    const { xClient } = require('./dist/utils/xClient.js');
    
    console.log('✅ X Client loaded');
    
    // Try to make a request and catch the error to examine headers
         try {
       console.log('🔍 Making test request to Twitter API...');
       await xClient.getUserByUsername('SignalAndSynapse');
       console.log('✅ Request succeeded (no limits hit)');
     } catch (error) {
      console.log('❌ Request failed with:', error.code);
      
      if (error.headers) {
        console.log('\n📊 RAW HEADERS RECEIVED:');
        
        // Check each header individually
        const limitHeaders = [
          'x-user-limit-24hour-limit',
          'x-user-limit-24hour-remaining', 
          'x-user-limit-24hour-reset',
          'x-rate-limit-limit',
          'x-rate-limit-remaining',
          'x-rate-limit-reset'
        ];
        
        limitHeaders.forEach(header => {
          if (error.headers[header]) {
            console.log(`   ${header}: ${error.headers[header]}`);
          } else {
            console.log(`   ${header}: (not present)`);
          }
        });
        
        // Calculate the real usage
        const limit = parseInt(error.headers['x-user-limit-24hour-limit'] || '0');
        const remaining = parseInt(error.headers['x-user-limit-24hour-remaining'] || '0');
        const used = limit - remaining;
        
        console.log('\n🎯 CALCULATED USAGE:');
        console.log(`   Daily Limit: ${limit}`);
        console.log(`   Remaining: ${remaining}`);
        console.log(`   Used Today: ${used}`);
        console.log(`   Percentage Used: ${((used/limit)*100).toFixed(1)}%`);
        
        if (remaining > 0) {
          console.log('\n✅ ACCOUNT HAS CAPACITY - Can still post!');
        } else {
          console.log('\n❌ ACCOUNT EXHAUSTED - Cannot post until reset');
        }
        
      } else {
        console.log('❌ No headers found in error object');
      }
    }
    
  } catch (error) {
    console.error('❌ Script failed:', error);
  }
}

verifyAPILimits();