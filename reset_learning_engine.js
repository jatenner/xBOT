#!/usr/bin/env node

console.log('🔄 RESETTING LEARNING ENGINE - Force aggressive mode for rapid posting...');

async function resetLearningEngine() {
  try {
    console.log('🧠 RESET: Importing AggressiveLearningEngine...');
    const { AggressiveLearningEngine } = await import('./dist/learning/aggressiveLearningEngine.js');
    
    console.log('🎯 RESET: Getting learning engine instance...');
    const learningEngine = AggressiveLearningEngine.getInstance();
    
    // Get current status
    const currentStatus = learningEngine.getLearningStatus();
    console.log('📊 CURRENT_STATUS:');
    console.log(`   Phase: ${currentStatus.phase}`);
    console.log(`   Progress: ${currentStatus.progress.toFixed(1)}%`);
    console.log(`   Total Posts: ${currentStatus.totalPosts}`);
    console.log(`   Daily Target: ${currentStatus.dailyTarget}`);
    
    // Reset to aggressive phase
    console.log('🔄 RESET: Forcing reset to aggressive phase...');
    learningEngine.resetToAggressivePhase('Manual reset - system stuck in optimization');
    
    // Get new status
    const newStatus = learningEngine.getLearningStatus();
    console.log('✅ NEW_STATUS:');
    console.log(`   Phase: ${newStatus.phase}`);
    console.log(`   Progress: ${newStatus.progress.toFixed(1)}%`);
    console.log(`   Total Posts: ${newStatus.totalPosts}`);
    console.log(`   Daily Target: ${newStatus.dailyTarget}`);
    
    // Test posting strategy
    console.log('🧪 TESTING: Getting current posting strategy...');
    const strategy = await learningEngine.getCurrentPostingStrategy();
    
    console.log('🎯 STRATEGY_TEST:');
    console.log(`   Should Post: ${strategy.should_post_now}`);
    console.log(`   Type: ${strategy.recommended_type}`);
    console.log(`   Confidence: ${(strategy.confidence * 100).toFixed(0)}%`);
    console.log(`   Reasoning: ${strategy.reasoning}`);
    console.log(`   Target: ${strategy.target_daily_posts} posts/day`);
    
    if (strategy.should_post_now) {
      console.log('🎉 SUCCESS: Learning engine reset and ready to post!');
    } else {
      console.log('⚠️ WARNING: Still not recommending posts after reset');
    }
    
  } catch (error) {
    console.error('💥 RESET_ERROR:', error.message);
    console.error('Stack:', error.stack);
  }
  
  process.exit(0);
}

resetLearningEngine();
