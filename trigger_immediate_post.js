#!/usr/bin/env node

/**
 * 🚀 IMMEDIATE POST TRIGGER
 * Forces an immediate tweet to test the system
 */

console.log('🚀 === IMMEDIATE POST TRIGGER ===');
console.log('📅', new Date().toISOString());

async function triggerImmediatePost() {
  try {
    console.log('⚡ Forcing immediate tweet...');
    
    // Import the posting engine
    const { AutonomousPostingEngine } = await import('./dist/src/core/autonomousPostingEngine.js');
    const engine = AutonomousPostingEngine.getInstance();
    
    // Check decision first
    console.log('🧠 Checking posting decision...');
    const decision = await engine.makePostingDecision();
    
    console.log(`📋 Decision: ${decision.should_post ? 'POST' : 'WAIT'}`);
    console.log(`📝 Reason: ${decision.reason}`);
    console.log(`🎯 Strategy: ${decision.strategy}`);
    console.log(`📊 Confidence: ${(decision.confidence * 100).toFixed(1)}%`);
    
    if (!decision.should_post) {
      console.log('⚠️ Posting decision says NO, but forcing post anyway for testing...');
    }
    
    // Force execute post
    console.log('🚀 Executing forced post...');
    const result = await engine.executePost();
    
    if (result.success) {
      console.log('✅ === POST SUCCESSFUL ===');
      console.log(`🐦 Tweet ID: ${result.tweet_id || 'generated'}`);
      console.log(`📝 Content: ${result.content_preview || 'N/A'}`);
      
      console.log('\n🎉 SUCCESS! The posting system is working!');
      return true;
    } else {
      console.log('❌ === POST FAILED ===');
      console.log(`📝 Error: ${result.error}`);
      console.log(`🔧 Details: ${JSON.stringify(result, null, 2)}`);
      
      console.log('\n🔧 ISSUE: The posting system has problems');
      return false;
    }
    
  } catch (error) {
    console.error('💥 Immediate post trigger failed:', error);
    console.log('\n🚨 CRITICAL: The posting system is broken');
    return false;
  }
}

// Run the trigger
triggerImmediatePost().then(success => {
  if (success) {
    console.log('\n🎊 GREAT! Your Twitter bot is posting successfully!');
    console.log('📈 The system should continue posting autonomously');
  } else {
    console.log('\n🔧 FIX NEEDED: Check the errors above to resolve posting issues');
  }
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('💥 Trigger script failed:', error);
  process.exit(1);
});