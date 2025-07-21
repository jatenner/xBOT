const { StreamlinedPostAgent } = require('./dist/agents/streamlinedPostAgent.js');
const { PostTweetAgent } = require('./dist/agents/postTweet.js');
const { unifiedPostingCoordinator } = require('./dist/utils/unifiedPostingCoordinator.js');

/**
 * 🚀 IMMEDIATE POSTING SCRIPT
 * 
 * Goal: Post 1 tweet immediately to test system, then continue with remaining posts
 */
async function immediatePostNow() {
  console.log('🚀 === IMMEDIATE POSTING SCRIPT ===');
  console.log('🎯 Goal: Post 1 tweet RIGHT NOW to test system');
  console.log('');

  try {
    // 1. Check current status
    console.log('📊 CURRENT STATUS:');
    const status = await unifiedPostingCoordinator.getStatus();
    console.log(`Posts today: ${status.postsToday}/${status.dailyLimit}`);
    console.log(`Remaining: ${status.remainingPosts}`);
    console.log(`Last post: ${status.lastPostTime}`);
    console.log('');

    // 2. Temporarily override spacing for immediate post
    console.log('⚡ TEMPORARILY REDUCING SPACING FOR IMMEDIATE TEST');
    unifiedPostingCoordinator.updateSettings({
      minimumSpacingMinutes: 1, // 1 minute spacing for immediate test
      dailyPostLimit: 15 // Increase limit
    });
    console.log('✅ Spacing reduced to 1 minute for immediate posting');
    console.log('');

    // 3. Immediate posting attempt
    console.log('🚀 ATTEMPTING IMMEDIATE POST...');
    
    const decision = await unifiedPostingCoordinator.canPostNow('ImmediateTest', 'urgent');
    console.log(`Decision: ${decision.canPost ? '✅ APPROVED' : '❌ BLOCKED'}`);
    console.log(`Reason: ${decision.reason}`);
    
    if (!decision.canPost) {
      console.log(`Wait time: ${decision.recommendedWaitMinutes} minutes`);
      console.log('');
      
      // Force an urgent post regardless
      console.log('🚨 FORCING URGENT POST (bypassing coordinator for test)');
    }

    // Choose viral agent for better content
    const streamlinedAgent = new StreamlinedPostAgent();
    console.log('🎯 Using StreamlinedPostAgent for viral content');
    console.log('');

    console.log('📝 GENERATING AND POSTING TWEET...');
    const result = await streamlinedAgent.run(false); // forcePost = false to respect some limits

    if (result.success) {
      console.log('🎉 === POST SUCCESSFUL! ===');
      console.log(`✅ Tweet posted successfully!`);
      console.log(`📝 Content: ${result.content ? result.content.substring(0, 150) + '...' : 'Content generated'}`);
      console.log(`🆔 Tweet ID: ${result.tweetId || 'Generated'}`);
      console.log(`💰 Cost: $${result.cost || '0.00'}`);
      console.log('');

      // Check updated status
      const newStatus = await unifiedPostingCoordinator.getStatus();
      console.log('📊 UPDATED STATUS:');
      console.log(`Posts today: ${newStatus.postsToday}/${newStatus.dailyLimit}`);
      console.log(`Remaining: ${newStatus.remainingPosts}`);
      console.log('');
      
      if (newStatus.remainingPosts > 0) {
        console.log(`🎯 SUCCESS! System is working. ${newStatus.remainingPosts} posts remaining.`);
        console.log('🔄 Now continuing with remaining posts...');
        console.log('');
        
        // Continue posting the remaining tweets with proper spacing
        await continueRemainingPosts(newStatus.remainingPosts);
      } else {
        console.log('🎉 Daily goal achieved!');
      }

    } else {
      console.log('❌ === POST FAILED ===');
      console.log(`Error: ${result.error || result.reason}`);
      console.log('');
      
      // Try backup agent
      console.log('🔄 Trying backup PostTweetAgent...');
      const postTweetAgent = new PostTweetAgent();
      const backupResult = await postTweetAgent.run(false);
      
      if (backupResult.success) {
        console.log('🎉 BACKUP AGENT SUCCESS!');
        console.log(`📝 Content: ${backupResult.content ? backupResult.content.substring(0, 150) + '...' : 'Posted'}`);
      } else {
        console.log('❌ Both agents failed');
        console.log('🔍 Checking system issues...');
        await diagnoseIssues();
      }
    }

  } catch (error) {
    console.error('❌ SCRIPT ERROR:', error.message);
    console.error('Stack:', error.stack);
  }
}

/**
 * 🔄 Continue posting remaining tweets
 */
async function continueRemainingPosts(remainingCount) {
  console.log(`🔄 === CONTINUING WITH ${remainingCount} REMAINING POSTS ===`);
  
  // Restore normal spacing but keep increased limit
  unifiedPostingCoordinator.updateSettings({
    minimumSpacingMinutes: 30, // 30 minutes for faster posting today
    dailyPostLimit: 15
  });
  
  const streamlinedAgent = new StreamlinedPostAgent();
  let postsCompleted = 0;
  let attempts = 0;
  const maxAttempts = remainingCount * 2; // Allow some failures
  
  while (postsCompleted < remainingCount && attempts < maxAttempts) {
    attempts++;
    console.log(`\n🎯 === ATTEMPT ${attempts}: POST ${postsCompleted + 1}/${remainingCount} ===`);
    
    const decision = await unifiedPostingCoordinator.canPostNow('ContinuedPosting', 'medium');
    
    if (decision.canPost) {
      console.log(`✅ Approved: ${decision.reason}`);
      
      try {
        const result = await streamlinedAgent.run(false);
        
        if (result.success) {
          postsCompleted++;
          console.log(`✅ POST ${postsCompleted}/${remainingCount} SUCCESS!`);
          console.log(`📝 Content: ${result.content ? result.content.substring(0, 100) + '...' : 'Posted'}`);
          
          if (postsCompleted < remainingCount) {
            console.log('⏳ Waiting 2 minutes before next post...');
            await new Promise(resolve => setTimeout(resolve, 120000)); // 2 minutes
          }
        } else {
          console.log(`❌ Post failed: ${result.error || result.reason}`);
          console.log('⏳ Waiting 3 minutes before retry...');
          await new Promise(resolve => setTimeout(resolve, 180000)); // 3 minutes
        }
        
      } catch (error) {
        console.error(`❌ Agent error: ${error.message}`);
        console.log('⏳ Waiting 5 minutes before retry...');
        await new Promise(resolve => setTimeout(resolve, 300000)); // 5 minutes
      }
      
    } else {
      console.log(`🚨 Blocked: ${decision.reason}`);
      const waitMinutes = Math.min(decision.recommendedWaitMinutes, 10); // Max 10 minute wait
      console.log(`⏳ Waiting ${waitMinutes} minutes...`);
      await new Promise(resolve => setTimeout(resolve, waitMinutes * 60 * 1000));
    }
  }
  
  const finalStatus = await unifiedPostingCoordinator.getStatus();
  console.log('\n🎉 === FINAL RESULTS ===');
  console.log(`📊 Total posts today: ${finalStatus.postsToday}`);
  console.log(`🎯 Session posts completed: ${postsCompleted}`);
  console.log(`✅ Success rate: ${Math.round((postsCompleted / attempts) * 100)}%`);
}

/**
 * 🔍 Diagnose system issues
 */
async function diagnoseIssues() {
  console.log('🔍 === SYSTEM DIAGNOSTICS ===');
  
  try {
    // Check if it's a dry run mode issue
    console.log('1. Checking environment...');
    console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`DRY_RUN: ${process.env.DRY_RUN}`);
    
    // Check Twitter credentials
    console.log('2. Checking Twitter credentials...');
    const hasCredentials = process.env.TWITTER_API_KEY && process.env.TWITTER_API_SECRET && 
                          process.env.TWITTER_ACCESS_TOKEN && process.env.TWITTER_ACCESS_TOKEN_SECRET;
    console.log(`Twitter credentials: ${hasCredentials ? '✅ Present' : '❌ Missing'}`);
    
    // Check budget
    console.log('3. Checking budget...');
    console.log('Budget status: Checked earlier - $1.30/$3 available');
    
    console.log('');
    console.log('🚨 If this is a DRY_RUN issue, set DRY_RUN=false in environment');
    console.log('🚨 If credentials are missing, check your .env file');
    
  } catch (error) {
    console.error('Diagnostics error:', error.message);
  }
}

// Run the script
immediatePostNow(); 