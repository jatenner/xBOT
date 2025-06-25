#!/usr/bin/env node

/**
 * 🚨 PRODUCTION API LIMITS VERIFICATION
 * Tests real API limits vs. hardcoded assumptions
 */

const { RealTimeLimitsIntelligenceAgent } = require('./dist/agents/realTimeLimitsIntelligenceAgent.js');

async function verifyProductionLimits() {
  console.log('🚨 VERIFYING PRODUCTION API LIMITS...');
  
  try {
    const limitsAgent = new RealTimeLimitsIntelligenceAgent();
    const limits = await limitsAgent.getCurrentLimits(true);
    
    console.log('\n📊 REAL TWITTER LIMITS:');
    console.log(`   📝 Daily: ${limits.twitter.dailyTweets.remaining}/${limits.twitter.dailyTweets.limit}`);
    console.log(`   📅 Monthly: ${limits.twitter.monthlyTweets.remaining}/${limits.twitter.monthlyTweets.limit}`);
    console.log(`   📖 Reads: ${limits.twitter.readRequests.remaining}/${limits.twitter.readRequests.limit}`);
    console.log(`   🔒 Account: ${limits.twitter.accountStatus}`);
    console.log(`   🚫 Locked: ${limits.twitter.isLocked}`);
    
    console.log('\n🎯 SYSTEM STATUS:');
    console.log(`   ✅ Can Post: ${limits.systemStatus.canPost}`);
    console.log(`   🤝 Can Engage: ${limits.systemStatus.canEngage}`);
    console.log(`   🔍 Can Research: ${limits.systemStatus.canResearch}`);
    console.log(`   🚫 Blocked: ${limits.systemStatus.blockedActions.join(', ') || 'None'}`);
    console.log(`   🎯 Confidence: ${limits.systemStatus.confidence * 100}%`);
    
    if (limits.twitter.dailyTweets.remaining === 0) {
      console.log('\n❌ CRITICAL: Daily limit appears exhausted');
      console.log(`   ⏰ Reset: ${limits.twitter.dailyTweets.resetTime}`);
      console.log('   🔧 Check if this is a code bug or real limit');
    } else {
      console.log('\n✅ DAILY LIMITS OK - Production errors are likely code bugs');
    }
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
  }
}

verifyProductionLimits().catch(console.error);