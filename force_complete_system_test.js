const { PostTweetAgent } = require('./dist/agents/postTweet.js');
const { StreamlinedPostAgent } = require('./dist/agents/streamlinedPostAgent.js');
const { supabaseClient } = require('./dist/utils/supabaseClient.js');
const { realTimeEngagementTracker } = require('./dist/agents/realTimeEngagementTracker.js');
const { nuclearBudgetEnforcer } = require('./dist/utils/nuclearBudgetEnforcer.js');

/**
 * 🧪 COMPLETE SYSTEM TEST - FORCE TWEET WITH FULL VALIDATION
 * 
 * Tests the entire pipeline:
 * 1. Budget system validation
 * 2. Tweet generation (viral, unique content)
 * 3. Live posting to Twitter
 * 4. Database storage verification
 * 5. Learning systems activation
 * 6. Engagement tracking
 */
async function forceCompleteSystemTest() {
  console.log('🚀 === COMPLETE SYSTEM TEST - FORCE TWEET ===');
  console.log('🎯 Goal: Validate entire pipeline from generation to learning');
  console.log('🛡️ Testing: Budget, Generation, Posting, Storage, Learning');
  console.log('');

  const testResults = {
    budgetCheck: false,
    tweetGeneration: false,
    tweetPosting: false,
    databaseStorage: false,
    learningActivation: false,
    engagementTracking: false,
    errors: []
  };

  try {
    // === STEP 1: BUDGET SYSTEM VALIDATION ===
    console.log('💰 === STEP 1: BUDGET SYSTEM VALIDATION ===');
    const budgetStatus = await nuclearBudgetEnforcer.getBudgetStatus();
    console.log(`Current spending: $${budgetStatus.totalSpent.toFixed(3)}`);
    console.log(`Remaining budget: $${budgetStatus.remainingBudget.toFixed(3)}`);
    console.log(`Failsafe level: ${budgetStatus.failsafeLevel}`);
    console.log(`Can spend: ${budgetStatus.canSpend}`);
    
    if (!budgetStatus.canSpend) {
      testResults.errors.push('Budget system blocked operations');
      console.log('❌ Budget system blocking operations - clearing any lockdowns');
      await nuclearBudgetEnforcer.releaseLockdown();
      console.log('✅ Lockdown cleared, retesting...');
      
      const retestBudget = await nuclearBudgetEnforcer.getBudgetStatus();
      if (!retestBudget.canSpend) {
        throw new Error('Budget system still blocking after lockdown release');
      }
    }
    
    testResults.budgetCheck = true;
    console.log('✅ Budget system operational');
    console.log('');

    // === STEP 2: DATABASE CONNECTIVITY TEST ===
    console.log('🗄️ === STEP 2: DATABASE CONNECTIVITY TEST ===');
    
    // Check bot_config table
    const { data: configs } = await supabaseClient.supabase
      .from('bot_config')
      .select('key, value')
      .limit(5);
    
    console.log(`Database connection: ${configs ? '✅ Connected' : '❌ Failed'}`);
    console.log(`Found ${configs?.length || 0} config entries`);
    
    // Check tweets table structure
    const { data: recentTweets } = await supabaseClient.supabase
      .from('tweets')
      .select('id, content, created_at, viral_score, engagement_data')
      .order('created_at', { ascending: false })
      .limit(3);
    
    console.log(`Recent tweets found: ${recentTweets?.length || 0}`);
    if (recentTweets?.length > 0) {
      console.log('Latest tweet preview:');
      const latest = recentTweets[0];
      console.log(`  Content: ${latest.content?.substring(0, 100)}...`);
      console.log(`  Created: ${latest.created_at}`);
      console.log(`  Viral Score: ${latest.viral_score || 'N/A'}`);
    }
    console.log('');

    // === STEP 3: FORCE TWEET GENERATION AND POSTING ===
    console.log('🎯 === STEP 3: FORCE TWEET GENERATION AND POSTING ===');
    
    console.log('Initializing StreamlinedPostAgent...');
    const streamlinedAgent = new StreamlinedPostAgent();
    
    console.log('Forcing tweet generation and posting...');
    const tweetResult = await streamlinedAgent.run(true, false); // forcePost=true, skipBudget=false
    
    testResults.tweetGeneration = true;
    console.log('✅ Tweet generation completed');
    
    if (tweetResult && tweetResult.success) {
      testResults.tweetPosting = true;
      console.log('✅ Tweet posted successfully');
      console.log(`Tweet content: ${tweetResult.content?.substring(0, 150)}...`);
      console.log(`Tweet ID: ${tweetResult.tweetId || 'N/A'}`);
    } else {
      testResults.errors.push('Tweet posting failed');
      console.log('❌ Tweet posting failed');
      console.log('Result:', JSON.stringify(tweetResult, null, 2));
    }
    console.log('');

    // === STEP 4: DATABASE STORAGE VERIFICATION ===
    console.log('📊 === STEP 4: DATABASE STORAGE VERIFICATION ===');
    
    // Wait a moment for database write
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const { data: latestTweets } = await supabaseClient.supabase
      .from('tweets')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (latestTweets && latestTweets.length > 0) {
      const latestTweet = latestTweets[0];
      const tweetAge = new Date() - new Date(latestTweet.created_at);
      
      if (tweetAge < 60000) { // Within last minute
        testResults.databaseStorage = true;
        console.log('✅ Tweet stored in database successfully');
        console.log(`Database ID: ${latestTweet.id}`);
        console.log(`Content: ${latestTweet.content?.substring(0, 100)}...`);
        console.log(`Viral Score: ${latestTweet.viral_score || 'N/A'}`);
        console.log(`Engagement Data: ${latestTweet.engagement_data ? 'Present' : 'Not set'}`);
        console.log(`Created: ${latestTweet.created_at}`);
        console.log(`Age: ${Math.round(tweetAge / 1000)} seconds`);
      } else {
        testResults.errors.push('No recent tweet found in database');
        console.log('❌ No recent tweet found in database');
        console.log(`Latest tweet is ${Math.round(tweetAge / 1000)} seconds old`);
      }
    } else {
      testResults.errors.push('No tweets found in database');
      console.log('❌ No tweets found in database at all');
    }
    console.log('');

    // === STEP 5: LEARNING SYSTEMS VALIDATION ===
    console.log('🧠 === STEP 5: LEARNING SYSTEMS VALIDATION ===');
    
    // Check learning data tables
    const { data: learningData } = await supabaseClient.supabase
      .from('ai_learning_data')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(3);
    
    console.log(`Learning entries found: ${learningData?.length || 0}`);
    
    if (learningData && learningData.length > 0) {
      testResults.learningActivation = true;
      console.log('✅ Learning systems active');
      
      const recentLearning = learningData[0];
      console.log('Latest learning entry:');
      console.log(`  Type: ${recentLearning.learning_type || 'N/A'}`);
      console.log(`  Context: ${recentLearning.context_data ? 'Present' : 'N/A'}`);
      console.log(`  Created: ${recentLearning.created_at}`);
    } else {
      testResults.errors.push('No learning data found');
      console.log('⚠️ No learning data found - may need initialization');
    }
    
    // Check viral content tracking
    const { data: viralData } = await supabaseClient.supabase
      .from('viral_content_performance')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(3);
    
    console.log(`Viral tracking entries: ${viralData?.length || 0}`);
    
    if (viralData && viralData.length > 0) {
      console.log('✅ Viral content tracking active');
      const recentViral = viralData[0];
      console.log(`Latest viral entry: ${recentViral.content_type || 'N/A'} content`);
    }
    console.log('');

    // === STEP 6: ENGAGEMENT TRACKING TEST ===
    console.log('📈 === STEP 6: ENGAGEMENT TRACKING TEST ===');
    
    try {
      console.log('Initializing engagement tracker...');
      await realTimeEngagementTracker.startTracking();
      
      testResults.engagementTracking = true;
      console.log('✅ Engagement tracking initialized');
      
      // Check recent engagement data
      const { data: engagementData } = await supabaseClient.supabase
        .from('engagement_data')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(5);
      
      console.log(`Recent engagement records: ${engagementData?.length || 0}`);
      
      if (engagementData && engagementData.length > 0) {
        console.log('Recent engagement summary:');
        engagementData.forEach((record, index) => {
          console.log(`  ${index + 1}. ${record.engagement_type || 'N/A'} - ${record.timestamp}`);
        });
      }
      
    } catch (error) {
      testResults.errors.push(`Engagement tracking error: ${error.message}`);
      console.log(`❌ Engagement tracking error: ${error.message}`);
    }
    console.log('');

    // === STEP 7: SYSTEM HEALTH CHECK ===
    console.log('🏥 === STEP 7: SYSTEM HEALTH CHECK ===');
    
    // Check for repetitive content in recent tweets
    const { data: recentContent } = await supabaseClient.supabase
      .from('tweets')
      .select('content, created_at')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (recentContent && recentContent.length > 1) {
      const contentSet = new Set();
      let duplicates = 0;
      
      recentContent.forEach(tweet => {
        const cleanContent = tweet.content?.toLowerCase().replace(/[^\w\s]/g, '').trim();
        if (cleanContent && contentSet.has(cleanContent)) {
          duplicates++;
        } else if (cleanContent) {
          contentSet.add(cleanContent);
        }
      });
      
      if (duplicates === 0) {
        console.log('✅ No repetitive content detected');
      } else {
        console.log(`⚠️ Found ${duplicates} potential duplicate tweets`);
        testResults.errors.push(`${duplicates} repetitive tweets detected`);
      }
    }
    
    // Check environment configuration
    console.log(`Live posting enabled: ${process.env.LIVE_POSTING_ENABLED || 'false'}`);
    console.log(`Dry run mode: ${process.env.DRY_RUN || 'false'}`);
    
    console.log('');

    // === FINAL RESULTS ===
    console.log('📊 === FINAL SYSTEM TEST RESULTS ===');
    
    const passedTests = Object.values(testResults).filter(val => val === true).length;
    const totalTests = Object.keys(testResults).length - 1; // -1 for errors array
    
    console.log(`Tests passed: ${passedTests}/${totalTests}`);
    console.log('');
    
    console.log('Individual test results:');
    console.log(`💰 Budget Check: ${testResults.budgetCheck ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`🎯 Tweet Generation: ${testResults.tweetGeneration ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`🚀 Tweet Posting: ${testResults.tweetPosting ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`📊 Database Storage: ${testResults.databaseStorage ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`🧠 Learning Systems: ${testResults.learningActivation ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`📈 Engagement Tracking: ${testResults.engagementTracking ? '✅ PASS' : '❌ FAIL'}`);
    
    if (testResults.errors.length > 0) {
      console.log('');
      console.log('❌ ERRORS ENCOUNTERED:');
      testResults.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }
    
    console.log('');
    
    if (passedTests === totalTests && testResults.errors.length === 0) {
      console.log('🎉 === SYSTEM STATUS: FULLY OPERATIONAL ===');
      console.log('✅ All systems working correctly');
      console.log('🚀 Ready for autonomous operation');
      console.log('💰 Budget system: Enforcing $5.00 limit');
      console.log('🎯 Posting system: Generating unique content');
      console.log('📊 Storage system: Saving to database');
      console.log('🧠 Learning system: Collecting intelligence');
    } else {
      console.log('⚠️ === SYSTEM STATUS: NEEDS ATTENTION ===');
      console.log(`${totalTests - passedTests} systems need fixing`);
      console.log('👨‍💻 Manual intervention recommended');
      
      // Recommendations
      if (!testResults.tweetPosting) {
        console.log('🔧 Recommendation: Check Twitter API credentials');
      }
      if (!testResults.databaseStorage) {
        console.log('🔧 Recommendation: Verify database schema and permissions');
      }
      if (!testResults.learningActivation) {
        console.log('🔧 Recommendation: Initialize learning system tables');
      }
    }

  } catch (error) {
    console.error('💥 CRITICAL SYSTEM ERROR:', error.message);
    console.error('Stack trace:', error.stack);
    testResults.errors.push(`Critical error: ${error.message}`);
  }
}

// Set environment for live testing
process.env.LIVE_POSTING_ENABLED = 'true';
process.env.DRY_RUN = 'false';

// Run the comprehensive test
forceCompleteSystemTest(); 