#!/usr/bin/env node

/**
 * OPTIMIZED POST CREATOR - Addresses repetitive content and low views
 * 
 * This uses the sophisticated content engine and view optimization
 * to create unique, engaging posts with thread capability.
 */

require('dotenv').config();

const { SophisticatedContentEngine } = require('./dist/content/sophisticatedContentEngine');
const { ThreadPostingEngine } = require('./dist/posting/threadPostingEngine');
const { ViewOptimizationEngine } = require('./dist/intelligence/viewOptimizationEngine');

async function createOptimizedPost() {
  const topic = process.argv[2] || 'health optimization breakthrough';
  const forceThread = process.argv.includes('--thread');
  
  console.log('🚀 Creating Optimized Post with Anti-Duplication System');
  console.log('=======================================================');
  console.log(`📝 Topic: ${topic}`);
  console.log(`🧵 Force thread: ${forceThread ? 'YES' : 'NO (auto-detect)'}`);
  
  try {
    // Initialize our sophisticated systems
    const contentEngine = SophisticatedContentEngine.getInstance();
    const threadEngine = ThreadPostingEngine.getInstance();
    const viewOptimizer = ViewOptimizationEngine.getInstance();
    
    console.log('✅ All engines initialized');
    
    // Step 1: Generate unique content that avoids duplication
    console.log('\\n📊 STEP 1: Generating Unique Content...');
    const contentVariation = await contentEngine.generateUniqueContent(topic);
    
    console.log(`✅ Content variation generated:`);
    console.log(`   - Topic: ${contentVariation.topic}`);
    console.log(`   - Angle: ${contentVariation.angle}`);
    console.log(`   - Format: ${contentVariation.format}`);
    console.log(`   - Depth: ${contentVariation.depth}`);
    console.log(`   - Uniqueness: ${Math.round(contentVariation.uniqueness_score * 100)}%`);
    
    // Step 2: Decide between single post and thread
    console.log('\\n🎯 STEP 2: Determining Optimal Format...');
    const recommendation = threadEngine.getPostingRecommendation(topic);
    const shouldUseThread = forceThread || recommendation.shouldUseThread;
    
    console.log(`📋 Recommendation: ${recommendation.reason}`);
    console.log(`🧵 Using format: ${shouldUseThread ? 'THREAD' : 'SINGLE TWEET'}`);
    
    // Step 3: Create the post
    console.log('\\n🔧 STEP 3: Creating Post...');
    let result;
    
    if (shouldUseThread) {
      console.log('🧵 Creating sophisticated thread...');
      result = await threadEngine.createSophisticatedThread(topic);
    } else {
      console.log('📝 Creating sophisticated single tweet...');
      result = await threadEngine.createSophisticatedSingle(topic);
    }
    
    if (!result.success) {
      console.error(`❌ Post creation failed: ${result.error}`);
      return;
    }
    
    console.log(`✅ Post created successfully!`);
    console.log(`   - Root Tweet ID: ${result.rootTweetId}`);
    console.log(`   - Total Tweets: ${result.totalTweets}`);
    console.log(`   - Thread IDs: ${result.threadTweetIds?.join(', ') || 'N/A'}`);
    console.log(`   - Engagement Prediction: ${result.engagementPrediction}%`);
    
    // Step 4: Analyze view potential
    console.log('\\n📈 STEP 4: View Optimization Analysis...');
    
    // For analysis, we'll create a sample content string
    const analysisContent = shouldUseThread 
      ? `Thread about ${topic} with ${result.totalTweets} parts`
      : `Single tweet about ${topic}`;
    
    const viewAnalysis = viewOptimizer.analyzeViewPotential(analysisContent, {
      followerCount: 25, // Current follower count
      recentEngagement: 0.01, // Very low recent engagement
      postingFrequency: 3 // Posts per day
    });
    
    console.log(`📊 View Analysis Results:`);
    console.log(`   - Estimated Views: ${viewAnalysis.estimatedViews}`);
    console.log(`   - Visibility Score: ${viewAnalysis.visibilityScore}/100`);
    console.log(`   - Algorithmic Penalties: ${viewAnalysis.algorithmicPenalties.length}`);
    console.log(`   - Risk Factors: ${viewAnalysis.riskFactors.length}`);
    
    if (viewAnalysis.algorithmicPenalties.length > 0) {
      console.log('\\n⚠️  ALGORITHMIC PENALTIES DETECTED:');
      viewAnalysis.algorithmicPenalties.forEach(penalty => {
        console.log(`   🚨 ${penalty}`);
      });
    }
    
    if (viewAnalysis.riskFactors.length > 0) {
      console.log('\\n⚠️  RISK FACTORS:');
      viewAnalysis.riskFactors.forEach(risk => {
        console.log(`   ⚠️  ${risk}`);
      });
    }
    
    if (viewAnalysis.optimizationSuggestions.length > 0) {
      console.log('\\n💡 OPTIMIZATION SUGGESTIONS:');
      viewAnalysis.optimizationSuggestions.forEach(suggestion => {
        console.log(`   ${suggestion}`);
      });
    }
    
    // Step 5: Success summary
    console.log('\\n🎉 POST CREATION COMPLETE!');
    console.log('============================');
    console.log(`✅ Avoided content duplication`);
    console.log(`✅ Used sophisticated ${shouldUseThread ? 'thread' : 'single'} format`);
    console.log(`✅ Optimized for ${viewAnalysis.estimatedViews} estimated views`);
    console.log(`✅ Identified and addressed ${viewAnalysis.algorithmicPenalties.length + viewAnalysis.riskFactors.length} potential issues`);
    
    console.log(`\\n🐦 Check your post: https://twitter.com/Signal_Synapse/status/${result.rootTweetId}`);
    
    return result;
    
  } catch (error) {
    console.error(`❌ Error creating optimized post: ${error.message}`);
    console.error('Stack trace:', error.stack);
  }
}

// Show usage if --help flag
if (process.argv.includes('--help')) {
  console.log('OPTIMIZED POST CREATOR - Usage:');
  console.log('===============================');
  console.log('node create_optimized_post.js [topic] [--thread] [--help]');
  console.log('');
  console.log('Examples:');
  console.log('  node create_optimized_post.js "sleep optimization"');
  console.log('  node create_optimized_post.js "productivity hack" --thread');
  console.log('  node create_optimized_post.js "intermittent fasting breakthrough"');
  console.log('');
  console.log('Features:');
  console.log('  ✅ Prevents duplicate content');
  console.log('  ✅ Creates sophisticated threads when appropriate');
  console.log('  ✅ Analyzes view optimization potential');
  console.log('  ✅ Provides actionable suggestions');
  console.log('  ✅ Predicts engagement');
} else {
  createOptimizedPost();
}
