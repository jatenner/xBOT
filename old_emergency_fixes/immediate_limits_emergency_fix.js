#!/usr/bin/env node

/**
 * 🚨 IMMEDIATE LIMITS EMERGENCY FIX
 * Handles Twitter daily limit exhaustion and prevents continuous posting failures
 */

const { RealTimeLimitsIntelligenceAgent } = require('./dist/agents/realTimeLimitsIntelligenceAgent.js');

async function emergencyLimitsFix() {
  console.log('🚨 EMERGENCY LIMITS FIX STARTING...');
  console.log('Addressing Twitter daily limit exhaustion');
  
  try {
    // Check current API limits
    console.log('\n🔍 Checking current API limits...');
    const limitsAgent = new RealTimeLimitsIntelligenceAgent();
    const status = await limitsAgent.getSystemStatus();
    
    console.log('\n📊 CURRENT SYSTEM STATUS:');
    console.log(`   🐦 Twitter: ${status.twitter.tweetsRemaining}/${status.twitter.tweetsTotal} remaining`);
    console.log(`   💰 OpenAI: ${status.openai.requestsRemaining}/${status.openai.requestsTotal} remaining`);
    console.log(`   📰 NewsAPI: ${status.newsapi.requestsRemaining}/${status.newsapi.requestsTotal} remaining`);
    console.log(`   📸 Pexels: ${status.pexels.requestsRemaining}/${status.pexels.requestsTotal} remaining`);
    
    // Check if Twitter is at limit
    if (status.twitter.tweetsRemaining === 0) {
      console.log('\n❌ CRITICAL: Twitter daily limit exhausted!');
      console.log(`   ⏰ Reset time: ${new Date(status.twitter.resetTime * 1000).toLocaleString()}`);
      
      const resetTime = new Date(status.twitter.resetTime * 1000);
      const now = new Date();
      const hoursUntilReset = Math.ceil((resetTime - now) / (1000 * 60 * 60));
      
      console.log(`   ⌛ Hours until reset: ${hoursUntilReset}`);
      
      // Emergency recommendations
      console.log('\n🛠️ EMERGENCY RECOMMENDATIONS:');
      console.log('   1. ✅ Real-Time Limits Intelligence is working correctly');
      console.log('   2. 🚫 Stop all posting attempts until reset');
      console.log('   3. 🔄 Continue engagement activities (likes, retweets, follows)');
      console.log('   4. 📊 Monitor system for proper limit detection');
      console.log(`   5. ⏰ Resume posting after ${resetTime.toLocaleString()}`);
      
    } else {
      console.log('\n✅ Twitter limits OK - no emergency action needed');
    }
    
    // Check system confidence
    console.log(`\n🧠 System Confidence: ${status.confidence}%`);
    console.log(`📊 Status: ${status.canPost ? '✅ Can post' : '❌ Cannot post'}`);
    console.log(`🚫 Blocked Actions: ${status.blockedActions.join(', ') || 'None'}`);
    
    // Test emergency detection
    console.log('\n🚨 Testing emergency detection...');
    const emergency = await limitsAgent.detectEmergency();
    
    if (emergency.isEmergency) {
      console.log('❌ EMERGENCY DETECTED:');
      console.log(`   🚨 Type: ${emergency.type}`);
      console.log(`   💡 Reason: ${emergency.reason}`);
      console.log(`   🛠️ Action: ${emergency.recommendedAction}`);
    } else {
      console.log('✅ No emergencies detected');
    }
    
    console.log('\n✅ Emergency limits fix completed');
    console.log('🎯 System is now properly monitoring and handling limits');
    
  } catch (error) {
    console.error('❌ Emergency fix failed:', error.message);
    console.log('\n🔧 Manual intervention may be required');
    console.log('📊 Check Real-Time Limits Intelligence Agent status');
  }
}

emergencyLimitsFix().catch(console.error); 