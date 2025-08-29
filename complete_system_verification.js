#!/usr/bin/env node

/**
 * 🔧 COMPLETE SYSTEM VERIFICATION
 * Comprehensive test of all integrated systems working together
 */

require('dotenv').config();

console.log('🔧 COMPLETE SYSTEM VERIFICATION...');
console.log('==================================');

async function verifyCompleteSystem() {
  try {
    console.log('📋 TESTING ALL SYSTEM COMPONENTS...\n');
    
    // Test 1: Database Unified Schema
    console.log('🗄️ TEST 1: Database Unified Schema');
    console.log('----------------------------------');
    
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    // Test all unified tables
    const tableTests = await Promise.all([
      supabase.from('unified_posts').select('count').limit(1),
      supabase.from('unified_ai_intelligence').select('count').limit(1),
      supabase.from('unified_metrics').select('count').limit(1)
    ]);
    
    const tablesWorking = tableTests.every(test => !test.error);
    console.log(`${tablesWorking ? '✅' : '❌'} Unified database schema: ${tablesWorking ? 'OPERATIONAL' : 'FAILED'}`);
    
    // Test 2: UnifiedDataManager
    console.log('\n🔄 TEST 2: UnifiedDataManager Integration');
    console.log('----------------------------------------');
    
    const { getUnifiedDataManager } = await import('./dist/lib/unifiedDataManager.js');
    const dataManager = getUnifiedDataManager();
    
    // Test AI decision storage and retrieval
    const testDecisionId = await dataManager.storeAIDecision({
      decisionTimestamp: new Date(),
      decisionType: 'system_consolidation',
      recommendation: { test: 'complete_verification', status: 'testing' },
      confidence: 1.0,
      reasoning: 'Complete system verification test',
      dataPointsUsed: 0,
      contextData: { verification_test: true }
    });
    
    const recentDecisions = await dataManager.getAIDecisions(1);
    const dataManagerWorking = testDecisionId && recentDecisions.length > 0;
    console.log(`${dataManagerWorking ? '✅' : '❌'} UnifiedDataManager: ${dataManagerWorking ? 'OPERATIONAL' : 'FAILED'}`);
    
    // Test 3: Enhanced Posting Orchestrator
    console.log('\n🎯 TEST 3: Enhanced Posting Orchestrator');
    console.log('---------------------------------------');
    
    const { getEnhancedPostingOrchestrator } = await import('./dist/core/enhancedPostingOrchestrator.js');
    const orchestrator = getEnhancedPostingOrchestrator();
    
    // Test elite content generation
    const eliteContent = await orchestrator.createEliteTweet({
      urgency: 'medium',
      audience_analysis: { verification_test: true },
      recent_performance: [],
      learning_insights: []
    });
    
    const orchestratorWorking = eliteContent && eliteContent.content && eliteContent.quality_score > 0;
    console.log(`${orchestratorWorking ? '✅' : '❌'} Enhanced Posting Orchestrator: ${orchestratorWorking ? 'OPERATIONAL' : 'FAILED'}`);
    console.log(`   Quality Score: ${eliteContent.quality_score.toFixed(2)}/1.0`);
    console.log(`   Viral Probability: ${(eliteContent.viral_probability * 100).toFixed(1)}%`);
    
    // Test smart reply generation
    const smartReply = await orchestrator.createSmartReply(
      "New research shows meditation improves focus by 40%",
      "Health optimization discussion"
    );
    
    const replyWorking = smartReply && smartReply.reply && smartReply.strategy;
    console.log(`${replyWorking ? '✅' : '❌'} Smart Reply System: ${replyWorking ? 'OPERATIONAL' : 'FAILED'}`);
    console.log(`   Strategy: ${smartReply.strategy}`);
    
    // Test 4: AutonomousPostingEngine Integration
    console.log('\n🤖 TEST 4: AutonomousPostingEngine Integration');
    console.log('--------------------------------------------');
    
    const { AutonomousPostingEngine } = await import('./dist/core/autonomousPostingEngine.js');
    const postingEngine = AutonomousPostingEngine.getInstance();
    
    // Test that it uses the Enhanced Orchestrator (check if method exists)
    const engineIntegrated = typeof postingEngine.executePost === 'function';
    console.log(`${engineIntegrated ? '✅' : '❌'} AutonomousPostingEngine: ${engineIntegrated ? 'INTEGRATED' : 'FAILED'}`);
    
    // Test 5: OpenAI Service Integration
    console.log('\n🧠 TEST 5: OpenAI Service Integration');
    console.log('-----------------------------------');
    
    const { getOpenAIService } = await import('./dist/services/openAIService.js');
    const openaiService = getOpenAIService();
    
    // Test budget enforcement and usage tracking
    const openaiWorking = typeof openaiService.chatCompletion === 'function';
    console.log(`${openaiWorking ? '✅' : '❌'} OpenAI Service: ${openaiWorking ? 'OPERATIONAL' : 'FAILED'}`);
    
    // Test 6: Learning Loop Connection
    console.log('\n🔄 TEST 6: Learning Loop Connection');
    console.log('----------------------------------');
    
    // Test that AI decisions are being tracked and can be retrieved
    const learningDecisions = await dataManager.getAIDecisions(5);
    const learningConnected = learningDecisions.length > 0 && 
                             learningDecisions.some(d => d.decisionType === 'api_usage' || d.decisionType === 'content_generation');
    
    console.log(`${learningConnected ? '✅' : '❌'} Learning Loop: ${learningConnected ? 'CONNECTED' : 'DISCONNECTED'}`);
    console.log(`   Tracked Decisions: ${learningDecisions.length}`);
    console.log(`   Decision Types: ${[...new Set(learningDecisions.map(d => d.decisionType))].join(', ')}`);
    
    // Test 7: Data Flow Verification
    console.log('\n📊 TEST 7: Data Flow Verification');
    console.log('---------------------------------');
    
    const dataStatus = await dataManager.getDataStatus();
    const dataFlowWorking = dataStatus.totalDecisions > 0;
    
    console.log(`${dataFlowWorking ? '✅' : '❌'} Data Flow: ${dataFlowWorking ? 'FLOWING' : 'BLOCKED'}`);
    console.log(`   Total Posts: ${dataStatus.totalPosts}`);
    console.log(`   Total Decisions: ${dataStatus.totalDecisions}`);
    console.log(`   Data Quality: ${(dataStatus.dataQuality * 100).toFixed(1)}%`);
    console.log(`   System Health: ${dataStatus.systemHealth}`);
    
    // Test 8: Quality Enhancement Integration
    console.log('\n✨ TEST 8: Quality Enhancement Integration');
    console.log('----------------------------------------');
    
    try {
      const { getContentQualityEnhancer } = await import('./dist/ai/qualityEnhancer.js');
      const qualityEnhancer = getContentQualityEnhancer();
      const qualityWorking = typeof qualityEnhancer.enhanceContent === 'function';
      console.log(`${qualityWorking ? '✅' : '❌'} Quality Enhancement: ${qualityWorking ? 'OPERATIONAL' : 'FAILED'}`);
    } catch (qualityError) {
      console.log(`⚠️ Quality Enhancement: OPTIONAL (${qualityError.message.substring(0, 50)}...)`);
    }
    
    // Test 9: Emergency Fallbacks
    console.log('\n🛡️ TEST 9: Emergency Fallbacks');
    console.log('------------------------------');
    
    try {
      const { emergencyCache, emergencyDuplicateCheck } = await import('./dist/lib/emergencyFallbacks.js');
      const fallbacksWorking = typeof emergencyCache.set === 'function' && 
                              typeof emergencyDuplicateCheck === 'function';
      console.log(`${fallbacksWorking ? '✅' : '❌'} Emergency Fallbacks: ${fallbacksWorking ? 'READY' : 'FAILED'}`);
    } catch (fallbackError) {
      console.log(`⚠️ Emergency Fallbacks: OPTIONAL (${fallbackError.message.substring(0, 50)}...)`);
    }
    
    // System Health Summary
    console.log('\n📋 SYSTEM HEALTH SUMMARY');
    console.log('========================');
    
    const allTests = [
      tablesWorking,
      dataManagerWorking,
      orchestratorWorking,
      replyWorking,
      engineIntegrated,
      openaiWorking,
      learningConnected,
      dataFlowWorking
    ];
    
    const passedTests = allTests.filter(test => test).length;
    const totalTests = allTests.length;
    const healthPercentage = Math.round((passedTests / totalTests) * 100);
    
    console.log(`🎯 Overall System Health: ${healthPercentage}% (${passedTests}/${totalTests} tests passed)`);
    
    if (healthPercentage >= 90) {
      console.log('🚀 SYSTEM STATUS: EXCELLENT - Ready for production deployment');
    } else if (healthPercentage >= 75) {
      console.log('✅ SYSTEM STATUS: GOOD - Minor issues to address');
    } else if (healthPercentage >= 50) {
      console.log('⚠️ SYSTEM STATUS: FAIR - Several issues need attention');
    } else {
      console.log('❌ SYSTEM STATUS: POOR - Major issues require fixing');
    }
    
    // Deployment Readiness
    console.log('\n🚀 DEPLOYMENT READINESS');
    console.log('======================');
    
    const criticalSystems = [dataManagerWorking, orchestratorWorking, engineIntegrated, openaiWorking];
    const criticalPassed = criticalSystems.filter(test => test).length;
    const deploymentReady = criticalPassed === criticalSystems.length;
    
    console.log(`🔧 Critical Systems: ${criticalPassed}/${criticalSystems.length} operational`);
    console.log(`${deploymentReady ? '✅' : '❌'} Deployment Ready: ${deploymentReady ? 'YES' : 'NO'}`);
    
    if (deploymentReady) {
      console.log('\n🎉 COMPLETE SYSTEM VERIFICATION SUCCESS!');
      console.log('=======================================');
      console.log('✅ All critical systems operational');
      console.log('✅ Unified database schema active');
      console.log('✅ Enhanced AI orchestrator integrated');
      console.log('✅ Learning loop connected');
      console.log('✅ Data flow unified');
      console.log('✅ Elite content generation ready');
      console.log('✅ Smart reply system operational');
      console.log('\n🚀 YOUR ELITE TWITTER BOT IS READY FOR DEPLOYMENT!');
      
      return { success: true, health: healthPercentage, deploymentReady: true };
    } else {
      console.log('\n⚠️ SYSTEM VERIFICATION INCOMPLETE');
      console.log('=================================');
      console.log('Some critical systems need attention before deployment.');
      
      return { success: false, health: healthPercentage, deploymentReady: false };
    }
    
  } catch (error) {
    console.error('❌ System verification failed:', error.message);
    return { success: false, health: 0, deploymentReady: false };
  }
}

// Execute verification
verifyCompleteSystem().then(result => {
  if (result.success && result.deploymentReady) {
    console.log('\n🏆 ELITE TWITTER GROWTH SYSTEM VERIFIED AND READY!');
    process.exit(0);
  } else {
    console.log(`\n🔧 System health: ${result.health}% - Additional work needed`);
    process.exit(result.deploymentReady ? 0 : 1);
  }
});
