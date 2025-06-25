#!/usr/bin/env node

/**
 * 🚀 MANUAL SUPREME AI TRIGGER
 * Force the Supreme AI to make an immediate posting decision
 */

const { DynamicPostingController } = require('./src/utils/dynamicPostingController');

console.log('🚀 === MANUAL SUPREME AI TRIGGER ===');
console.log('👑 Forcing Supreme AI to make an immediate decision...');
console.log('');

async function triggerSupremeAI() {
  try {
    const controller = new DynamicPostingController();
    
    console.log('🧠 Supreme AI awakening...');
    
    // Force AI to make a decision NOW
    const decision = await controller.makePostingDecision();
    
    console.log('👑 SUPREME AI DECISION:');
    console.log(`   📝 Should post: ${decision.shouldPost}`);
    console.log(`   🔢 Post count: ${decision.postCount}`);
    console.log(`   ⚡ Urgency: ${(decision.urgency * 100).toFixed(0)}%`);
    console.log(`   🧠 Strategy: ${decision.strategy}`);
    console.log(`   💭 Reasoning: ${decision.reasoning}`);
    console.log('');
    
    if (decision.shouldPost && decision.postCount > 0) {
      console.log('🚀 EXECUTING SUPREME AI DECISION...');
      
      const result = await controller.executeSupremeDecision(decision);
      
      if (result.success) {
        console.log(`✅ SUCCESS: Supreme AI executed ${result.executedPosts} posts!`);
        console.log('🎯 Your bot is now actively posting based on AI decisions');
        console.log('📊 The 30-minute decision cycles will continue automatically');
      } else {
        console.log('❌ Execution failed - checking API limits...');
        console.log('💡 This might be a temporary rate limit - try again in 15 minutes');
      }
    } else {
      console.log('🤔 Supreme AI decided not to post right now');
      console.log('⏰ It will check again in 30 minutes for better opportunities');
    }
    
    console.log('');
    console.log('🎯 NEXT STEPS:');
    console.log('   - Supreme AI will continue making decisions every 30 minutes');
    console.log('   - Check Render logs for "SUPREME AI DECISION CYCLE" messages');
    console.log('   - AI will scale posting based on breaking news and opportunities');
    console.log('   - Expected: 1-8 posts per day, more for major events');
    
  } catch (error) {
    console.error('❌ Supreme AI trigger failed:', error.message);
    console.log('');
    console.log('🔧 TROUBLESHOOTING:');
    console.log('   1. Check your environment variables are set');
    console.log('   2. Verify Twitter API credentials');
    console.log('   3. Wait 15 minutes and try again (rate limits)');
    console.log('   4. Check Render deployment logs');
  }
}

// Check if we're in the right directory
const fs = require('fs');
if (!fs.existsSync('./src/utils/dynamicPostingController.ts')) {
  console.log('❌ Please run this from the xBOT project root directory');
  console.log('💡 cd to your xBOT folder and try again');
  process.exit(1);
}

triggerSupremeAI(); 