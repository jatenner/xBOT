#!/usr/bin/env node

console.log('🔧 FIXING CONTENT VARIETY ISSUES...');

async function fixContentVariety() {
  try {
    console.log('🎯 TESTING: Learning engine thread recommendations...');
    const { AggressiveLearningEngine } = await import('./dist/learning/aggressiveLearningEngine.js');
    const learningEngine = AggressiveLearningEngine.getInstance();
    
    // Test multiple strategy calls to see thread frequency
    console.log('📊 TESTING: 10 strategy calls to check thread frequency...');
    const strategies = [];
    
    for (let i = 0; i < 10; i++) {
      const strategy = await learningEngine.getCurrentPostingStrategy();
      strategies.push(strategy);
      console.log(`   ${i+1}. Type: ${strategy.recommended_type}, Should Post: ${strategy.should_post_now}, Reason: ${strategy.reasoning}`);
    }
    
    const threadCount = strategies.filter(s => s.recommended_type === 'thread').length;
    const threadPercentage = (threadCount / strategies.length) * 100;
    
    console.log(`\n📈 THREAD_FREQUENCY_TEST:`);
    console.log(`   Threads: ${threadCount}/10 (${threadPercentage.toFixed(0)}% - should be ~40%)`);
    console.log(`   Simple: ${strategies.filter(s => s.recommended_type === 'simple').length}/10`);
    console.log(`   Reply: ${strategies.filter(s => s.recommended_type === 'reply').length}/10`);
    
    if (threadPercentage < 30) {
      console.log('⚠️ WARNING: Thread frequency too low!');
    } else {
      console.log('✅ Thread frequency looks good');
    }
    
    console.log('\n🎯 TESTING: Hook diversification...');
    const { HookDiversificationEngine } = await import('./dist/ai/hookDiversificationEngine.js');
    const hookEngine = HookDiversificationEngine.getInstance();
    
    // Test multiple hook calls
    const hooks = [];
    for (let i = 0; i < 8; i++) {
      const hook = hookEngine.getDiverseHook('sleep', 'simple');
      hooks.push(hook);
      console.log(`   ${i+1}. "${hook.substring(0, 60)}..."`);
    }
    
    // Check for repetition
    const uniqueHooks = new Set(hooks.map(h => h.substring(0, 30)));
    const varietyPercentage = (uniqueHooks.size / hooks.length) * 100;
    
    console.log(`\n📊 HOOK_VARIETY_TEST:`);
    console.log(`   Unique hooks: ${uniqueHooks.size}/${hooks.length} (${varietyPercentage.toFixed(0)}% variety)`);
    
    if (varietyPercentage < 70) {
      console.log('⚠️ WARNING: Hook variety too low!');
    } else {
      console.log('✅ Hook variety looks good');
    }
    
    // Check usage stats
    console.log('\n📈 HOOK_USAGE_STATS:');
    const stats = hookEngine.getUsageStats();
    stats.slice(0, 5).forEach((stat, i) => {
      console.log(`   ${i+1}. "${stat.pattern.substring(0, 40)}..." - Used ${stat.useCount}x`);
    });
    
  } catch (error) {
    console.error('💥 ERROR:', error.message);
  }
}

fixContentVariety();
