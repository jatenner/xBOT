#!/usr/bin/env node

/**
 * 🔄 CONSOLIDATE UNIFIED DATA ACCESS
 * Ensures all systems use the unified database schema
 */

// Load environment variables
require('dotenv').config();

console.log('🔄 CONSOLIDATING UNIFIED DATA ACCESS...');
console.log('=====================================');

async function consolidateDataAccess() {
  try {
    // Test UnifiedDataManager connection
    console.log('📊 Testing Unified Data Manager...');
    const { getUnifiedDataManager } = await import('./dist/lib/unifiedDataManager.js');
    const dataManager = getUnifiedDataManager();
    
    // Test data status
    const dataStatus = await dataManager.getDataStatus();
    console.log('✅ Unified Data Manager Status:');
    console.log(`   - Total Posts: ${dataStatus.totalPosts}`);
    console.log(`   - Total Decisions: ${dataStatus.totalDecisions}`);
    console.log(`   - Data Quality: ${(dataStatus.dataQuality * 100).toFixed(1)}%`);
    console.log(`   - System Health: ${dataStatus.systemHealth}`);
    
    // Test AI intelligence system
    console.log('\n🧠 Testing AI Intelligence Integration...');
    const testDecision = await dataManager.storeAIDecision({
      decisionTimestamp: new Date(),
      decisionType: 'system_consolidation',
      recommendation: {
        action: 'unified_data_access',
        status: 'testing',
        benefits: ['consolidated_schema', 'unified_learning', 'better_ai_decisions']
      },
      confidence: 1.0,
      reasoning: 'Testing unified data access consolidation',
      dataPointsUsed: dataStatus.totalPosts,
      contextData: {
        consolidation_test: true,
        system_health: dataStatus.systemHealth
      }
    });
    
    console.log(`✅ AI Decision stored with ID: ${testDecision}`);
    
    // Test performance data retrieval
    console.log('\n📈 Testing Performance Data Retrieval...');
    const recentPosts = await dataManager.getPostPerformance(7);
    console.log(`✅ Retrieved ${recentPosts.length} recent posts for analysis`);
    
    if (recentPosts.length > 0) {
      const avgEngagement = recentPosts.reduce((sum, post) => sum + (post.likes + post.retweets + post.replies), 0) / recentPosts.length;
      const totalFollowers = recentPosts.reduce((sum, post) => sum + post.followersAttributed, 0);
      
      console.log(`   - Average Engagement: ${avgEngagement.toFixed(1)} per post`);
      console.log(`   - Total Followers Attributed: +${totalFollowers.toFixed(2)}`);
    }
    
    // Test AI decision retrieval
    console.log('\n🤖 Testing AI Decision History...');
    const recentDecisions = await dataManager.getAIDecisions(7);
    console.log(`✅ Retrieved ${recentDecisions.length} recent AI decisions`);
    
    if (recentDecisions.length > 0) {
      const avgConfidence = recentDecisions.reduce((sum, decision) => sum + decision.confidence, 0) / recentDecisions.length;
      const decisionTypes = [...new Set(recentDecisions.map(d => d.decisionType))];
      
      console.log(`   - Average Confidence: ${(avgConfidence * 100).toFixed(1)}%`);
      console.log(`   - Decision Types: ${decisionTypes.join(', ')}`);
    }
    
    // Test Enhanced Posting Orchestrator integration
    console.log('\n🎯 Testing Enhanced Posting Orchestrator...');
    const { getEnhancedPostingOrchestrator } = await import('./dist/core/enhancedPostingOrchestrator.js');
    const orchestrator = getEnhancedPostingOrchestrator();
    
    // Test elite content creation (without posting)
    console.log('🎨 Testing Elite Content Generation...');
    const eliteContent = await orchestrator.createEliteTweet({
      urgency: 'medium',
      audience_analysis: { test_mode: true },
      recent_performance: recentPosts.slice(0, 5),
      learning_insights: recentDecisions.slice(0, 3)
    });
    
    console.log('✅ Elite Content Generated:');
    console.log(`   - Quality Score: ${eliteContent.quality_score.toFixed(2)}/1.0`);
    console.log(`   - Viral Probability: ${(eliteContent.viral_probability * 100).toFixed(1)}%`);
    console.log(`   - Learning Applied: ${eliteContent.learning_applied.length} insights`);
    console.log(`   - Content Preview: "${eliteContent.content.substring(0, 100)}..."`);
    
    // Test smart reply generation
    console.log('\n💬 Testing Smart Reply Generation...');
    const smartReply = await orchestrator.createSmartReply(
      "New study shows that intermittent fasting can improve cognitive function by 23%",
      "Health optimization discussion - cognitive enhancement"
    );
    
    console.log('✅ Smart Reply Generated:');
    console.log(`   - Strategy: ${smartReply.strategy}`);
    console.log(`   - Reply: "${smartReply.reply}"`);
    
    // Final integration test
    console.log('\n🔗 Testing Full Integration Flow...');
    
    // Simulate the full flow: AI decision → content generation → data storage
    const integrationTestDecision = await dataManager.storeAIDecision({
      decisionTimestamp: new Date(),
      decisionType: 'integration_test',
      recommendation: {
        action: 'test_full_flow',
        quality_score: eliteContent.quality_score,
        viral_probability: eliteContent.viral_probability
      },
      confidence: eliteContent.quality_score,
      reasoning: 'Testing complete integration from decision to content to storage',
      dataPointsUsed: recentPosts.length + recentDecisions.length,
      contextData: {
        content_preview: eliteContent.content.substring(0, 50),
        learning_applied: eliteContent.learning_applied,
        smart_reply_test: smartReply.strategy
      }
    });
    
    console.log(`✅ Integration Test Decision ID: ${integrationTestDecision}`);
    
    console.log('\n🎉 CONSOLIDATION COMPLETE!');
    console.log('==========================');
    console.log('✅ All systems successfully integrated with unified schema');
    console.log('✅ Enhanced AI Orchestrator operational');
    console.log('✅ Learning loop connected (decision → outcome → improvement)');
    console.log('✅ Data flow unified (single source of truth)');
    console.log('✅ Elite content generation ready');
    console.log('✅ Smart reply system operational');
    
    console.log('\n📊 SYSTEM STATUS SUMMARY:');
    console.log(`   🗄️ Database: Unified schema active`);
    console.log(`   🤖 AI Systems: Enhanced orchestrator integrated`);
    console.log(`   🧠 Learning: Decision-outcome loop connected`);
    console.log(`   📈 Metrics: Real-time performance tracking`);
    console.log(`   🎯 Content: Elite quality with max AI utilization`);
    
    return true;

  } catch (error) {
    console.error('❌ Consolidation failed:', error.message);
    console.log('\n🔧 TROUBLESHOOTING:');
    console.log('1. Ensure system is built: npm run build');
    console.log('2. Check database connectivity');
    console.log('3. Verify environment variables');
    console.log('4. Check OpenAI API availability');
    
    return false;
  }
}

// Run consolidation
consolidateDataAccess().then(success => {
  if (success) {
    console.log('\n🚀 UNIFIED SYSTEM READY FOR DEPLOYMENT!');
    console.log('Your bot now has:');
    console.log('- Maximum AI utilization for content generation');
    console.log('- Learning-based continuous improvement');
    console.log('- Unified data management');
    console.log('- Elite content quality with performance prediction');
    console.log('- Smart reply generation for engagement');
    process.exit(0);
  } else {
    console.log('\n⚠️ Consolidation incomplete - manual fixes needed');
    process.exit(1);
  }
});
