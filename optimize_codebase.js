#!/usr/bin/env node

/**
 * 🎯 CODEBASE OPTIMIZATION
 * 
 * Clean up duplicate agents and streamline architecture
 */

const fs = require('fs');
const path = require('path');

function optimizeCodebase() {
  console.log('🎯 === CODEBASE OPTIMIZATION ===');
  console.log('Analyzing and optimizing the agent architecture...');
  console.log('');

  try {
    // STEP 1: Analyze agent files
    analyzeAgentFiles();
    
    // STEP 2: Create optimization recommendations
    createOptimizationRecommendations();
    
    console.log('');
    console.log('✅ === CODEBASE OPTIMIZATION COMPLETE ===');
    console.log('🎯 Recommendations generated for cleaner architecture!');
    
  } catch (error) {
    console.error('💥 Optimization failed:', error);
  }
}

function analyzeAgentFiles() {
  console.log('📊 === ANALYZING AGENT FILES ===');
  
  const agentsDir = './src/agents';
  const agentFiles = fs.readdirSync(agentsDir).filter(f => f.endsWith('.ts'));
  
  console.log(`📁 Found ${agentFiles.length} agent files`);
  
  // Group agents by functionality
  const agentGroups = {
    posting: [],
    learning: [],
    engagement: [], 
    content: [],
    viral: [],
    research: [],
    strategy: [],
    utility: []
  };
  
  agentFiles.forEach(file => {
    const fileName = file.toLowerCase();
    
    if (fileName.includes('post') || fileName.includes('tweet')) {
      agentGroups.posting.push(file);
    } else if (fileName.includes('learn') || fileName.includes('intelligence')) {
      agentGroups.learning.push(file);
    } else if (fileName.includes('engagement')) {
      agentGroups.engagement.push(file);
    } else if (fileName.includes('content') || fileName.includes('generate')) {
      agentGroups.content.push(file);
    } else if (fileName.includes('viral') || fileName.includes('growth')) {
      agentGroups.viral.push(file);
    } else if (fileName.includes('research') || fileName.includes('trend')) {
      agentGroups.research.push(file);
    } else if (fileName.includes('strategy') || fileName.includes('orchestrat')) {
      agentGroups.strategy.push(file);
    } else {
      agentGroups.utility.push(file);
    }
  });
  
  console.log('📊 Agent categorization:');
  Object.entries(agentGroups).forEach(([category, files]) => {
    if (files.length > 0) {
      console.log(`   ${category}: ${files.length} files`);
      if (files.length > 3) {
        console.log(`     ⚠️ Potential for consolidation`);
      }
    }
  });
}

function createOptimizationRecommendations() {
  console.log('💡 === OPTIMIZATION RECOMMENDATIONS ===');
  
  console.log('');
  console.log('🎯 CORE SYSTEM SIMPLIFICATION:');
  console.log('   1. ✅ KEEP: postTweet.ts (main posting agent)');
  console.log('   2. ✅ KEEP: streamlinedPostAgent.ts (viral content)');
  console.log('   3. ✅ KEEP: intelligentSchedulingAgent.ts (timing)');
  console.log('   4. ✅ KEEP: supremeAIOrchestrator.ts (coordination)');
  console.log('');
  
  console.log('🗑️ CANDIDATES FOR REMOVAL/CONSOLIDATION:');
  console.log('   • Multiple learning agents → Keep 1-2 core ones');
  console.log('   • Duplicate content generators → Consolidate into postTweet.ts');
  console.log('   • Overlapping engagement trackers → Keep realTimeEngagementTracker.ts');
  console.log('   • Legacy agents with .backup extensions → Remove');
  console.log('');
  
  console.log('⚡ PERFORMANCE OPTIMIZATIONS:');
  console.log('   • Lazy load agents only when needed');
  console.log('   • Cache agent instances (singleton pattern)');
  console.log('   • Remove unused imports and dependencies');
  console.log('   • Optimize rate limit checking');
  console.log('');
  
  console.log('🔧 ARCHITECTURE IMPROVEMENTS:');
  console.log('   • Single source of truth for rate limits (DONE)');
  console.log('   • Unified database recording method (FIXED)');
  console.log('   • Clear separation of concerns');
  console.log('   • Consistent error handling');
  console.log('');
  
  console.log('📁 FILE ORGANIZATION:');
  console.log('   • Core posting: src/agents/core/');
  console.log('   • Learning systems: src/agents/learning/');
  console.log('   • Content generation: src/agents/content/');
  console.log('   • Utilities: src/utils/');
}

// Run the optimization analysis
optimizeCodebase(); 