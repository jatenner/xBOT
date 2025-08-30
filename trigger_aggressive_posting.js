#!/usr/bin/env node

/**
 * 🚀 AGGRESSIVE POSTING TRIGGER
 * 
 * Forces immediate posting to test our optimizations:
 * - Reduced 4h interval to 90min
 * - Fixed JSON parsing issues  
 * - Increased daily limits
 */

require('dotenv').config();

async function triggerAggressivePosting() {
  console.log('🚀 === AGGRESSIVE POSTING TRIGGER ===');
  console.log('🎯 Goal: Test optimized posting frequency and content quality');
  console.log('⏰ Current Time:', new Date().toLocaleString());
  console.log('');

  console.log('📊 OPTIMIZATIONS APPLIED:');
  console.log('✅ Posting interval: 4 hours → 90 minutes');
  console.log('✅ Daily limit: 8 posts → 16-20 posts');
  console.log('✅ JSON parsing: Added robust markdown cleaning');
  console.log('✅ Quality gates: Enhanced with fallback systems');
  console.log('');

  try {
    console.log('🔄 Loading optimized posting engine...');
    const { AutonomousPostingEngine } = require('./dist/core/autonomousPostingEngine.js');
    
    const postingEngine = new AutonomousPostingEngine();
    console.log('✅ Engine initialized with growth optimizations');
    console.log('');

    // Trigger 3 immediate posts to test the system
    for (let i = 1; i <= 3; i++) {
      console.log(`🚀 === POST ATTEMPT ${i}/3 ===`);
      
      const result = await postingEngine.executePost();
      
      if (result.success) {
        console.log(`✅ POST ${i} SUCCESS!`);
        console.log(`📝 Content: ${result.content ? result.content.substring(0, 100) + '...' : 'Generated'}`);
        console.log('');
        
        // Wait 2 minutes between posts for testing
        if (i < 3) {
          console.log('⏳ Waiting 2 minutes before next post...');
          await new Promise(resolve => setTimeout(resolve, 2 * 60 * 1000));
        }
      } else {
        console.log(`❌ POST ${i} FAILED: ${result.error}`);
        console.log('');
        
        // Still wait to avoid overwhelming system
        if (i < 3) {
          console.log('⏳ Waiting 1 minute before retry...');
          await new Promise(resolve => setTimeout(resolve, 60 * 1000));
        }
      }
    }

    console.log('🎉 === AGGRESSIVE POSTING TEST COMPLETE ===');
    console.log('✅ Check your Twitter account for new posts');
    console.log('✅ System should now post every 90 minutes automatically');
    console.log('✅ Daily limit increased to support growth');

  } catch (error) {
    console.error('❌ AGGRESSIVE POSTING ERROR:', error.message);
    console.error('📊 This indicates a system configuration issue');
  }
}

// Run the aggressive posting trigger
triggerAggressivePosting();
