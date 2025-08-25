#!/usr/bin/env node

/**
 * VIRAL OPTIMIZED POST CREATOR
 * 
 * This applies the engagement optimization insights to create
 * content that follows the algorithm's recommendations for higher engagement.
 */

require('dotenv').config();

async function createViralOptimizedPost() {
  console.log('🚀 CREATING VIRAL-OPTIMIZED POST');
  console.log('=================================');
  
  try {
    // Get optimization insights
    const { EngagementOptimizer } = require('./dist/intelligence/engagementOptimizer');
    const optimizer = EngagementOptimizer.getInstance();
    
    console.log('📊 Getting optimization insights...');
    const insights = await optimizer.analyzeEngagementGaps();
    
    // Apply top 3 insights to create viral content
    const topInsight = insights[0]; // "Content hooks are not provocative enough"
    
    console.log(`\n🎯 Applying top insight:`);
    console.log(`   Problem: ${topInsight.problem}`);
    console.log(`   Solution: ${topInsight.solution}`);
    console.log(`   Action: ${topInsight.recommended_action}`);
    
    // Create content following the recommendations
    const viralHooks = [
      "I spent $5,000 learning this health secret...",
      "Former medical insider reveals:",
      "Plot twist: Everything doctors tell you about X is wrong",
      "Rich people know this, poor people get told lies:",
      "I wasted 2 years believing this health myth:"
    ];
    
    const controversialTakes = [
      "Your gut controls your mood more than your brain does",
      "Vitamin D supplements are mostly a scam designed to make you buy pills instead of go outside",
      "Morning routines are productivity theater for people who can't admit they hate their jobs",
      "The supplement industry profits from your confusion about basic nutrition",
      "Most 'superfoods' are just marketing terms for expensive vegetables"
    ];
    
    const emotionalTriggers = [
      "Most people are walking around depressed because they're destroying their microbiome with processed foods",
      "I spent $2,000 on supplements before realizing the real problem was in my kitchen",
      "The health industry doesn't want you healthy - they want you dependent",
      "Your energy crashes aren't normal - they're a sign your body is fighting what you're feeding it"
    ];
    
    // Select random elements following optimization suggestions
    const selectedHook = viralHooks[Math.floor(Math.random() * viralHooks.length)];
    const selectedTake = controversialTakes[Math.floor(Math.random() * controversialTakes.length)];
    const selectedTrigger = emotionalTriggers[Math.floor(Math.random() * emotionalTriggers.length)];
    
    // Construct optimized tweet
    const optimizedContent = selectedHook + "\\n\\n" + selectedTake + "\\n\\n" + selectedTrigger + "\\n\\nFight me in the comments.";
    
    console.log(`\n📝 Generated Optimized Content:`);
    console.log(`"${optimizedContent}"`);
    
    // Test viral prediction
    const prediction = await optimizer.predictViralPotential(optimizedContent);
    console.log(`\n📈 Viral Prediction:`);
    console.log(`   - Estimated Likes: ${prediction.predicted_likes}`);
    console.log(`   - Estimated Shares: ${prediction.predicted_shares}`);
    console.log(`   - Estimated Followers: ${prediction.predicted_followers}`);
    console.log(`   - Viral Probability: ${Math.round(prediction.viral_probability * 100)}%`);
    
    // Post it using our sophisticated system
    console.log(`\n🚀 Posting with sophisticated system...`);
    const { ThreadPostingEngine } = require('./dist/posting/threadPostingEngine');
    const threadEngine = ThreadPostingEngine.getInstance();
    
    // Create shortened version for Twitter
    const twitterContent = selectedHook + " " + selectedTake.substring(0, 100) + "... Fight me in the comments.";
    
    const result = await threadEngine.createSophisticatedSingle(twitterContent);
    
    if (result.success) {
      console.log(`✅ VIRAL-OPTIMIZED POST CREATED!`);
      console.log(`   Tweet ID: ${result.rootTweetId}`);
      console.log(`   Engagement Prediction: ${result.engagementPrediction}%`);
      console.log(`   URL: https://twitter.com/Signal_Synapse/status/${result.rootTweetId}`);
      
      console.log(`\n🎉 This post applies all top optimization insights:`);
      console.log(`   ✅ Provocative hook with money/insider knowledge`);
      console.log(`   ✅ Controversial take challenging common beliefs`);
      console.log(`   ✅ Emotional trigger with personal stakes`);
      console.log(`   ✅ Confrontational CTA ("Fight me")`);
      
    } else {
      console.log(`❌ Failed to post: ${result.error}`);
    }
    
  } catch (error) {
    console.error('❌ Error creating viral optimized post:', error.message);
  }
}

createViralOptimizedPost();
