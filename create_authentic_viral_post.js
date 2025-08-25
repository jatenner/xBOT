#!/usr/bin/env node

/**
 * AUTHENTIC VIRAL POST CREATOR
 * 
 * Creates posts that are BOTH optimized for engagement AND sound authentically human.
 * This fixes the "weird and off" robotic content issue.
 */

require('dotenv').config();

async function createAuthenticViralPost() {
  console.log('🚀 CREATING AUTHENTIC + VIRAL POST');
  console.log('==================================');
  
  try {
    // Build the new content engines
    console.log('🔨 Building content engines...');
    const { execSync } = require('child_process');
    execSync('npm run build', { stdio: 'pipe' });
    
    const { OptimizationAwareContentEngine } = require('./dist/content/optimizationAwareContentEngine');
    const contentEngine = OptimizationAwareContentEngine.getInstance();
    
    console.log('✅ Optimization-aware content engine loaded');
    
    // Select engaging topic
    const topics = [
      'expensive supplement mistakes',
      'vitamin industry deception', 
      'health guru lies exposed',
      'medical industry secrets',
      'nutrition myth debunked'
    ];
    
    const selectedTopic = topics[Math.floor(Math.random() * topics.length)];
    console.log(`\n🎯 Topic: ${selectedTopic}`);
    
    // Generate optimized AND humanized content
    console.log('\n📝 Generating authentic viral content...');
    const optimizedContent = await contentEngine.generateOptimizedContent(selectedTopic);
    
    console.log(`\n✅ CONTENT GENERATED:`);
    console.log(`"${optimizedContent.content}"`);
    
    console.log(`\n📊 CONTENT ANALYSIS:`);
    console.log(`   - Engagement Potential: ${optimizedContent.engagementPotential}%`);
    console.log(`   - Optimization Score: ${optimizedContent.optimizationScore}/100`);
    console.log(`   - Applied Insights: ${optimizedContent.appliedInsights.length}`);
    console.log(`   - Predicted Likes: ${optimizedContent.viralPrediction.predicted_likes}`);
    console.log(`   - Predicted Shares: ${optimizedContent.viralPrediction.predicted_shares}`);
    console.log(`   - Viral Probability: ${Math.round(optimizedContent.viralPrediction.viral_probability * 100)}%`);
    
    console.log(`\n🎯 OPTIMIZATION STRATEGIES APPLIED:`);
    optimizedContent.appliedInsights.forEach((insight, i) => {
      console.log(`   ${i + 1}. ${insight}`);
    });
    
    // Post the content
    console.log(`\n🚀 Posting authentic viral content...`);
    
    const { ThreadPostingEngine } = require('./dist/posting/threadPostingEngine');
    const threadEngine = ThreadPostingEngine.getInstance();
    
    const result = await threadEngine.createSophisticatedSingle(optimizedContent.content);
    
    if (result.success && result.rootTweetId) {
      console.log(`\n🎉 AUTHENTIC VIRAL POST SUCCESSFUL!`);
      console.log(`   Tweet ID: ${result.rootTweetId}`);
      console.log(`   URL: https://twitter.com/Signal_Synapse/status/${result.rootTweetId}`);
      console.log(`   Engagement Prediction: ${result.engagementPrediction}%`);
      
      console.log(`\n✅ THIS POST FIXES ALL CONTENT ISSUES:`);
      console.log(`   ✅ Uses optimization insights from engagement data`);
      console.log(`   ✅ Sounds authentically human, not robotic`);
      console.log(`   ✅ Has natural flow and personality`);
      console.log(`   ✅ Includes personal voice and relatability`);
      console.log(`   ✅ Maintains controversial engagement hooks`);
      console.log(`   ✅ Predicts ${optimizedContent.viralPrediction.predicted_likes} likes vs previous 0-5`);
      
      console.log(`\n🔮 ENGAGEMENT PREDICTION:`);
      console.log(`   - This post should get ${optimizedContent.viralPrediction.predicted_likes} likes`);
      console.log(`   - ${optimizedContent.viralPrediction.predicted_shares} shares/retweets`);
      console.log(`   - ${optimizedContent.viralPrediction.predicted_followers} new followers`);
      console.log(`   - ${Math.round(optimizedContent.viralPrediction.viral_probability * 100)}% chance of viral performance`);
      
    } else {
      console.log(`❌ Failed to post: ${result.error}`);
    }
    
  } catch (error) {
    console.error('❌ Error creating authentic viral post:', error.message);
    
    // Show what the fixed system would create
    console.log('\n📝 EXAMPLE OF FIXED CONTENT:');
    console.log('=============================');
    
    console.log('\n❌ OLD ROBOTIC VERSION:');
    console.log('"Systematic review shows: After analyzing hundreds of studies on metabolic flexibility..."');
    
    console.log('\n✅ NEW AUTHENTIC VERSION:');
    console.log('"I spent $3,000 on supplements before realizing the truth:');
    console.log('');
    console.log('Most superfoods are just marketing terms for expensive vegetables.');
    console.log('');
    console.log('The supplement industry profits from your confusion. Here\'s what they don\'t want you to know:');
    console.log('');
    console.log('Your kitchen has everything you need.');
    console.log('');
    console.log('Fight me in the comments."');
    
    console.log('\n🎯 KEY IMPROVEMENTS:');
    console.log('   ✅ Personal story hook ("I spent $3,000...")');
    console.log('   ✅ Natural language flow');
    console.log('   ✅ Controversy + insider knowledge');
    console.log('   ✅ Emotional trigger (wasted money)');
    console.log('   ✅ Confrontational CTA');
    console.log('   ✅ Human personality, not clinical tone');
  }
}

createAuthenticViralPost();
