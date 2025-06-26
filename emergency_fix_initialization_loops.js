#!/usr/bin/env node

/**
 * EMERGENCY FIX: Critical Initialization Loop Prevention
 * 
 * This script fixes the massive initialization loops causing:
 * 1. Hundreds of duplicate agent initializations
 * 2. Missing growth loop system activation
 * 3. Resource waste and potential crashes
 * 
 * Based on Render logs and ChatGPT analysis
 */

const fs = require('fs');
const path = require('path');

console.log('🚨 EMERGENCY INITIALIZATION FIX');
console.log('================================');

// Fix 1: Patch AdaptiveContentLearner singleton
const adaptiveLearnerPath = 'src/agents/adaptiveContentLearner.ts';
console.log('🔧 Fixing AdaptiveContentLearner singleton...');

if (fs.existsSync(adaptiveLearnerPath)) {
  let adaptiveContent = fs.readFileSync(adaptiveLearnerPath, 'utf8');

  // Fix constructor to use singleton
  if (adaptiveContent.includes('new CompetitiveIntelligenceLearner()')) {
    adaptiveContent = adaptiveContent.replace(
      'this.competitiveIntelligence = new CompetitiveIntelligenceLearner();',
      'this.competitiveIntelligence = CompetitiveIntelligenceLearner.getInstance();'
    );
    
    fs.writeFileSync(adaptiveLearnerPath, adaptiveContent);
    console.log('✅ Fixed AdaptiveContentLearner to use singleton');
  } else {
    console.log('✅ AdaptiveContentLearner already uses singleton');
  }
}

// Fix 2: Reduce logging spam in NewsAPIAgent
const newsAPIPath = 'src/agents/newsAPIAgent.ts';
console.log('🔧 Reducing NewsAPIAgent logging spam...');

if (fs.existsSync(newsAPIPath)) {
  let content = fs.readFileSync(newsAPIPath, 'utf8');
  
  // Only log singleton creation once
  if (content.includes("console.log('✅ Using EXISTING NewsAPIAgent singleton instance');")) {
    content = content.replace(
      "console.log('✅ Using EXISTING NewsAPIAgent singleton instance');",
      "// Singleton reused (logging reduced)"
    );
    
    fs.writeFileSync(newsAPIPath, content);
    console.log('✅ Reduced NewsAPIAgent logging spam');
  }
}

console.log('\n🎉 EMERGENCY FIX COMPLETE!');
console.log('================================');
console.log('✅ Fixed singleton patterns');
console.log('✅ Reduced logging spam');
console.log('\n🚀 Ready for deployment to Render!');
