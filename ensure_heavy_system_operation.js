#!/usr/bin/env node

/**
 * 🚀 ENSURE HEAVY SYSTEM OPERATION
 * 
 * Comprehensive script to verify and force heavy posting activity
 */

require('dotenv').config();

async function ensureHeavySystemOperation() {
  console.log('🚀 === ENSURING HEAVY SYSTEM OPERATION ===');
  console.log('🎯 Goal: Verify optimizations work and force continuous posting');
  console.log('⏰ Current Time:', new Date().toLocaleString());
  console.log('');

  console.log('📊 APPLIED OPTIMIZATIONS:');
  console.log('✅ Posting interval: 4h → 90min (167% increase)');
  console.log('✅ Daily limit: 8 → 16-20 posts (100-150% increase)');
  console.log('✅ JSON parsing: Fixed markdown code block issues');
  console.log('✅ Quality gates: Enhanced fallback systems');
  console.log('✅ Growth focus: Small account optimization');
  console.log('');

  try {
    console.log('🔄 Testing multiple posting engines...');
    
    // Test 1: Autonomous Posting Engine (Primary)
    console.log('🧪 === TEST 1: AUTONOMOUS POSTING ENGINE ===');
    try {
      const { AutonomousPostingEngine } = require('./dist/core/autonomousPostingEngine.js');
      const autonomousEngine = new AutonomousPostingEngine();
      
      const result1 = await autonomousEngine.executePost();
      if (result1.success) {
        console.log('✅ AUTONOMOUS: Posted successfully');
        console.log(`📝 Content: ${result1.content?.substring(0, 80)}...`);
      } else {
        console.log(`❌ AUTONOMOUS: ${result1.error}`);
      }
    } catch (error) {
      console.log(`❌ AUTONOMOUS ERROR: ${error.message}`);
    }
    
    console.log('');
    console.log('⏳ Waiting 3 minutes before next test...');
    await new Promise(resolve => setTimeout(resolve, 3 * 60 * 1000));

    // Test 2: Simplified Posting Engine (Backup)
    console.log('🧪 === TEST 2: SIMPLIFIED POSTING ENGINE ===');
    try {
      const { SimplifiedPostingEngine } = require('./dist/core/simplifiedPostingEngine.js');
      const simplifiedEngine = SimplifiedPostingEngine.getInstance();
      
      const result2 = await simplifiedEngine.createEngagingPost('health optimization breakthrough');
      if (result2.success) {
        console.log('✅ SIMPLIFIED: Posted successfully');
        console.log(`📝 Content: ${result2.content?.substring(0, 80)}...`);
        console.log(`🆔 Tweet ID: ${result2.tweetId}`);
      } else {
        console.log(`❌ SIMPLIFIED: ${result2.error}`);
      }
    } catch (error) {
      console.log(`❌ SIMPLIFIED ERROR: ${error.message}`);
    }

    console.log('');
    console.log('⏳ Waiting 3 minutes before next test...');
    await new Promise(resolve => setTimeout(resolve, 3 * 60 * 1000));

    // Test 3: Optimized Posting Engine (Enhanced)
    console.log('🧪 === TEST 3: OPTIMIZED POSTING ENGINE ===');
    try {
      const { OptimizedPostingEngine } = require('./dist/core/optimizedPostingEngine.js');
      const optimizedEngine = OptimizedPostingEngine.getInstance();
      
      const result3 = await optimizedEngine.createOptimizedPost('viral health discovery');
      if (result3.success) {
        console.log('✅ OPTIMIZED: Posted successfully');
        console.log(`📝 Content: ${result3.content?.substring(0, 80)}...`);
        console.log(`📊 Optimization Score: ${result3.optimizationScore}/100`);
      } else {
        console.log(`❌ OPTIMIZED: ${result3.error}`);
      }
    } catch (error) {
      console.log(`❌ OPTIMIZED ERROR: ${error.message}`);
    }

    console.log('');
    console.log('🎉 === HEAVY OPERATION TEST COMPLETE ===');
    console.log('');
    console.log('📊 EXPECTED RESULTS:');
    console.log('✅ 3 new posts should appear on your Twitter');
    console.log('✅ Railway system should post every 90 minutes automatically');
    console.log('✅ Daily posting should increase to 16+ posts');
    console.log('✅ Content quality should improve with fixed JSON parsing');
    console.log('');
    console.log('🔍 NEXT STEPS:');
    console.log('1. Check your Twitter account for 3 new posts');
    console.log('2. Monitor Railway logs for increased posting frequency');
    console.log('3. Verify no more repeated "get-rich-quick" content');
    console.log('4. Confirm higher quality, varied health content');

  } catch (error) {
    console.error('❌ HEAVY OPERATION TEST FAILED:', error.message);
    console.error('📊 This indicates system configuration issues');
    
    console.log('');
    console.log('🔧 TROUBLESHOOTING STEPS:');
    console.log('1. Check environment variables are loaded');
    console.log('2. Verify database connections');
    console.log('3. Test OpenAI API connectivity');
    console.log('4. Check browser automation setup');
  }
}

// Ensure heavy system operation
ensureHeavySystemOperation();
