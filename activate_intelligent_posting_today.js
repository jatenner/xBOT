const { unifiedPostingCoordinator } = require('./dist/utils/unifiedPostingCoordinator.js');
const { intelligentPostingOptimizer } = require('./dist/agents/intelligentPostingOptimizerAgent.js');
const { masterPostingGate } = require('./dist/utils/masterPostingGate.js');
const { StreamlinedPostAgent } = require('./dist/agents/streamlinedPostAgent.js');
const { PostTweetAgent } = require('./dist/agents/postTweet.js');

/**
 * 🚀 EMERGENCY ACTIVATION: INTELLIGENT POSTING TODAY
 * 
 * Goal: Get the remaining 7 tweets posted today
 * Strategy: Temporarily reduce spacing, activate intelligent optimizer, force posting
 */
async function activateIntelligentPostingToday() {
  console.log('🚀 === EMERGENCY INTELLIGENT POSTING ACTIVATION ===');
  console.log('🎯 Goal: Post remaining 7 tweets today');
  console.log('🧠 Strategy: Activate intelligent optimizer + accelerated posting');
  console.log('');

  try {
    // 1. CHECK CURRENT STATUS
    console.log('📊 === STEP 1: CHECK CURRENT STATUS ===');
    const status = await unifiedPostingCoordinator.getStatus();
    console.log(`Current posts today: ${status.postsToday}`);
    console.log(`Daily limit: ${status.dailyLimit}`);
    console.log(`Remaining posts: ${status.remainingPosts}`);
    console.log(`Last post time: ${status.lastPostTime}`);
    console.log(`Next optimal time: ${status.nextOptimalTime}`);
    console.log('');

    // 2. ACTIVATE INTELLIGENT OPTIMIZER
    console.log('🧠 === STEP 2: ACTIVATE INTELLIGENT OPTIMIZER ===');
    console.log('Starting continuous learning system...');
    await intelligentPostingOptimizer.startContinuousLearning();
    
    // Get current optimal settings
    const optimalSettings = intelligentPostingOptimizer.getCurrentOptimalSettings();
    console.log(`🎯 Optimal daily limit: ${optimalSettings.dailyPostLimit}`);
    console.log(`⏰ Optimal hours: [${optimalSettings.optimalHours.join(', ')}]`);
    console.log(`📊 Confidence: ${(optimalSettings.confidence * 100).toFixed(1)}%`);
    console.log('');

    // 3. TEMPORARILY OPTIMIZE FOR TODAY'S COMPLETION
    console.log('⚡ === STEP 3: OPTIMIZE FOR TODAY ===');
    console.log('Temporarily reducing spacing for today only...');
    
    // Update coordinator with aggressive settings for today
    unifiedPostingCoordinator.updateSettings({
      dailyPostLimit: 15, // Increase limit for today
      minimumSpacingMinutes: 45, // Reduce spacing to 45 minutes
      optimalHours: [9, 11, 13, 15, 17, 19, 21, 23] // More posting windows
    });
    
    console.log('✅ Coordinator updated with accelerated settings');
    console.log('📊 New spacing: 45 minutes (was 90)');
    console.log('📊 New limit: 15 posts (was 8)');
    console.log('⏰ More posting windows added');
    console.log('');

    // 4. START MASTER POSTING GATE
    console.log('🏗️ === STEP 4: ACTIVATE MASTER POSTING GATE ===');
    console.log('Starting coordinated posting system...');
    await masterPostingGate.start();
    console.log('✅ Master Posting Gate active');
    console.log('');

    // 5. IMMEDIATE POSTING ACCELERATION
    console.log('🚀 === STEP 5: ACCELERATED POSTING CYCLE ===');
    console.log('Starting immediate posting cycle to complete today\'s quota...');
    
    const streamlinedAgent = new StreamlinedPostAgent();
    const postTweetAgent = new PostTweetAgent();
    
    let postsAttempted = 0;
    let postsSuccessful = 0;
    const maxAttempts = 10; // Safety limit
    
    while (postsSuccessful < 7 && postsAttempted < maxAttempts) {
      console.log(`\n🎯 === POSTING ATTEMPT ${postsAttempted + 1} ===`);
      
      // Check if we can post now
      const decision = await unifiedPostingCoordinator.canPostNow('EmergencyActivation', 'high');
      
      if (decision.canPost) {
        console.log(`✅ COORDINATOR APPROVED: ${decision.reason}`);
        
        // Choose agent (favor viral content)
        const useStreamlined = Math.random() < 0.8; // 80% viral content
        const agent = useStreamlined ? streamlinedAgent : postTweetAgent;
        const agentName = useStreamlined ? 'StreamlinedPostAgent' : 'PostTweetAgent';
        
        console.log(`🎯 Using: ${agentName}`);
        
        try {
          // Execute post
          const result = await agent.run(false);
          
          if (result.success) {
            postsSuccessful++;
            console.log(`✅ POST ${postsSuccessful}/7 SUCCESSFUL!`);
            console.log(`📝 Content preview: ${result.content ? result.content.substring(0, 100) + '...' : 'Posted'}`);
            
            // Wait a bit before next attempt
            console.log('⏳ Waiting 30 seconds before next post...');
            await new Promise(resolve => setTimeout(resolve, 30000));
            
          } else {
            console.log(`❌ Post failed: ${result.reason || result.error}`);
            console.log('⏳ Waiting 60 seconds before retry...');
            await new Promise(resolve => setTimeout(resolve, 60000));
          }
          
        } catch (error) {
          console.error(`❌ Agent error:`, error.message);
          console.log('⏳ Waiting 90 seconds before retry...');
          await new Promise(resolve => setTimeout(resolve, 90000));
        }
        
      } else {
        console.log(`🚨 COORDINATOR BLOCKED: ${decision.reason}`);
        console.log(`⏰ Wait time: ${decision.recommendedWaitMinutes} minutes`);
        
        if (decision.recommendedWaitMinutes > 0 && decision.recommendedWaitMinutes < 60) {
          console.log(`⏳ Waiting ${decision.recommendedWaitMinutes} minutes...`);
          await new Promise(resolve => setTimeout(resolve, decision.recommendedWaitMinutes * 60 * 1000));
        } else {
          console.log('⏳ Waiting 5 minutes and trying again...');
          await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
        }
      }
      
      postsAttempted++;
      
      // Show progress
      const currentStatus = await unifiedPostingCoordinator.getStatus();
      console.log(`📊 Progress: ${currentStatus.postsToday} total posts today`);
      console.log(`🎯 Goal: ${7 - postsSuccessful} posts remaining in this session`);
    }

    // 6. FINAL STATUS REPORT
    console.log('\n🎉 === FINAL STATUS REPORT ===');
    const finalStatus = await unifiedPostingCoordinator.getStatus();
    console.log(`📊 Total posts today: ${finalStatus.postsToday}`);
    console.log(`🎯 Posts in this session: ${postsSuccessful}`);
    console.log(`⏰ Last post time: ${finalStatus.lastPostTime}`);
    console.log(`🏁 Daily limit: ${finalStatus.dailyLimit}`);
    console.log(`📈 Remaining capacity: ${finalStatus.remainingPosts}`);
    
    if (finalStatus.postsToday >= 8) {
      console.log('🎉 SUCCESS: Daily posting goal achieved!');
      console.log('✅ Intelligent posting system is working correctly');
    } else {
      console.log(`📊 Progress made: ${finalStatus.postsToday}/8 posts completed`);
      console.log('🔄 System will continue posting at optimal intervals');
    }
    
    console.log('\n🧠 === INTELLIGENT SYSTEM STATUS ===');
    const optimalFinalSettings = intelligentPostingOptimizer.getCurrentOptimalSettings();
    console.log(`🎯 AI optimal frequency: ${optimalFinalSettings.dailyPostLimit} posts/day`);
    console.log(`⏰ AI optimal hours: [${optimalFinalSettings.optimalHours.join(', ')}]`);
    console.log(`📊 AI confidence: ${(optimalFinalSettings.confidence * 100).toFixed(1)}%`);
    console.log(`📈 Data points: ${optimalFinalSettings.dataPoints}`);
    
    console.log('\n✅ INTELLIGENT POSTING SYSTEM ACTIVATED');
    console.log('🔄 System will now continuously optimize posting frequency and timing');
    console.log('📈 Performance will improve over time based on engagement data');
    
  } catch (error) {
    console.error('❌ ACTIVATION FAILED:', error);
    console.error('Stack:', error.stack);
  }
}

// Run the activation
activateIntelligentPostingToday(); 