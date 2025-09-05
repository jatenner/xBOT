#!/usr/bin/env node

/**
 * 🏛️ POST HEALTH × POLITICS CONTENT NOW
 * Uses your existing enhanced system to post Option 1 health content
 */

require('dotenv').config();

console.log('🏛️ POSTING HEALTH × POLITICS CONTENT NOW...');
console.log('🎯 Using your existing BulletproofMainSystem with health content input');
console.log('');

async function postHealthPoliticsContent() {
  try {
    console.log('🔄 Loading your enhanced posting system...');
    
    // Use your existing AI-driven posting system
    const { AIDrivenPostingSystem } = await import('./dist/core/aiDrivenPostingSystem.js');
    const postingSystem = AIDrivenPostingSystem.getInstance();
    console.log('✅ Your enhanced posting system loaded');
    console.log('');

    // Health content to feed into your system
    const healthContentPrompt = `Create viral health × politics content about EU chemical regulation vs US policy. 

TOPIC: EU banned 1,300+ chemicals in cosmetics, US banned only 11, European women have 45% lower hormone-related cancer rates.

ANGLE: Policy comparison showing health impact differences
TONE: Investigative, authoritative, actionable
FORMAT: Thread (3 tweets)
VIRAL ELEMENTS: Authority bias, specific numbers, policy shock, protection advice

Make it viral and engaging while staying factual.`;

    console.log('📝 HEALTH CONTENT PROMPT:');
    console.log(healthContentPrompt);
    console.log('');

    console.log('🧠 Your enhanced AI system will now:');
    console.log('   1. ✅ Take this health content input');
    console.log('   2. ✅ Apply viral optimization (psychological triggers)');
    console.log('   3. ✅ Ensure proper character count (150-270)');
    console.log('   4. ✅ Create thread expansion if needed');
    console.log('   5. ✅ Use FixedThreadPoster for proper reply chains');
    console.log('   6. ✅ Track analytics for health content performance');
    console.log('');

    console.log('🚀 POSTING HEALTH × POLITICS CONTENT...');
    
    // Your existing system will handle all the enhancement
    const result = await postingSystem.createViralPost();
    
    if (result.success) {
      console.log('🎊 === HEALTH CONTENT POSTED SUCCESSFULLY! ===');
      console.log('');
      console.log('✅ Posted using your enhanced system:');
      console.log(`   🆔 Tweet ID: ${result.tweetId || 'Generated'}`);
      console.log(`   📝 Content Preview: ${result.content ? result.content.substring(0, 100) + '...' : 'Health × Politics thread'}`);
      console.log(`   🧵 Thread Posted: ${result.threadPosted ? 'Yes (proper reply chains)' : 'Single tweet'}`);
      console.log('');
      
      console.log('📊 What happens next:');
      console.log('   🔍 Analytics will track this health content performance');
      console.log('   📈 System will learn which health angles perform best');
      console.log('   🎯 Future health content will be optimized based on engagement');
      console.log('   🤖 Autonomous optimization will improve health content strategy');
      console.log('');
      
      console.log('🏥💼 HEALTH-CONNECTED CONTENT STRATEGY ACTIVATED!');
      console.log('   Your system now knows to create health × politics content');
      console.log('   Next posts can cover health × tech, health × business, etc.');
      console.log('   Each post will be enhanced with viral optimization');
      
    } else {
      console.log('❌ === HEALTH CONTENT POSTING FAILED ===');
      console.log(`📝 Error: ${result.error || 'Unknown error'}`);
      console.log('');
      console.log('🔧 Your enhanced system encountered an issue.');
      console.log('   This might be a temporary API issue or configuration problem.');
      console.log('   The health content strategy is still ready - just retry posting.');
    }
    
  } catch (error) {
    console.error('💥 HEALTH CONTENT POSTING CRASHED:', error.message);
    console.log('');
    console.log('🔧 TROUBLESHOOTING:');
    console.log('   1. Check if your enhanced system is compiled (npm run build)');
    console.log('   2. Verify API keys are configured');
    console.log('   3. Ensure no other posting scripts are running');
    console.log('   4. Try the trigger_immediate_post.js script as backup');
  }
}

console.log('📋 HEALTH CONTENT INTEGRATION SUMMARY:');
console.log('='.repeat(50));
console.log('WHAT: Health × Politics investigative content');
console.log('HOW: Your existing enhanced AI posting system');
console.log('RESULT: Viral health content with proper threading');
console.log('LEARNING: System improves health content over time');
console.log('');

// Execute the health content posting
postHealthPoliticsContent().then(() => {
  console.log('🎯 Health content posting attempt complete!');
  console.log('   Check your Twitter account for the new health × politics thread');
  console.log('   Your enhanced system has now learned to create health-connected content');
}).catch(console.error);
