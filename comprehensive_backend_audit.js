#!/usr/bin/env node

/**
 * 🔍 COMPREHENSIVE BACKEND & DATABASE AUDIT
 * 
 * Honest assessment of the entire system's learning capabilities,
 * intelligence, and follower growth potential
 */

require('dotenv').config();

console.log('🔍 === COMPREHENSIVE BACKEND & DATABASE AUDIT ===');
console.log('📊 Honest assessment of learning capabilities and follower growth potential\n');

async function comprehensiveAudit() {
  try {
    const { createClient } = require('@supabase/supabase-js');
    const fs = require('fs');
    const path = require('path');
    
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
    );

    console.log('🎯 === DATABASE LEARNING INFRASTRUCTURE AUDIT ===\n');

    // 1. Check core learning tables
    const learningTables = [
      'tweets', 'engagement_data', 'ai_learning_data', 'viral_content_performance',
      'follower_growth_patterns', 'content_patterns', 'learning_insights'
    ];

    console.log('📊 Core Learning Tables Status:');
    for (const tableName of learningTables) {
      try {
        const { data, error, count } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true });
        
        if (error) {
          console.log(`   ❌ ${tableName}: MISSING or ERROR - ${error.message}`);
        } else {
          console.log(`   ✅ ${tableName}: EXISTS (${count || 0} records)`);
        }
      } catch (e) {
        console.log(`   ❌ ${tableName}: NOT ACCESSIBLE - ${e.message}`);
      }
    }
    console.log('');

    // 2. Check actual tweet data quality
    console.log('📈 === TWEET DATA QUALITY ASSESSMENT ===\n');
    
    const { data: allTweets, error: tweetsError } = await supabase
      .from('tweets')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (tweetsError) {
      console.log('❌ CRITICAL ISSUE: Cannot access tweets table');
      console.log(`   Error: ${tweetsError.message}`);
      return { critical: true, issue: 'Database access failure' };
    }

    if (!allTweets || allTweets.length === 0) {
      console.log('❌ CRITICAL ISSUE: No tweets in database');
      console.log('   📝 System has no data to learn from');
      return { critical: true, issue: 'No learning data' };
    }

    console.log(`✅ Found ${allTweets.length} tweets for analysis`);
    
    // Analyze tweet patterns
    const humanTweets = allTweets.filter(t => 
      t.tweet_type === 'human_authentic' || 
      t.tweet_type === 'human_voice_demo' ||
      (t.content && !t.content.includes('#'))
    );
    
    const hashtagTweets = allTweets.filter(t => 
      t.content && t.content.includes('#')
    );
    
    const livePostedTweets = allTweets.filter(t => t.twitter_id);
    
    console.log(`📊 Tweet Quality Breakdown:`);
    console.log(`   🧠 Human-style tweets: ${humanTweets.length} (${((humanTweets.length/allTweets.length)*100).toFixed(1)}%)`);
    console.log(`   # Hashtag tweets: ${hashtagTweets.length} (${((hashtagTweets.length/allTweets.length)*100).toFixed(1)}%)`);
    console.log(`   📱 Live posted: ${livePostedTweets.length} (${((livePostedTweets.length/allTweets.length)*100).toFixed(1)}%)`);
    console.log('');

    // 3. Check learning system configuration
    console.log('🧠 === LEARNING SYSTEM CONFIGURATION AUDIT ===\n');
    
    const { data: learningConfigs } = await supabase
      .from('bot_config')
      .select('*')
      .like('key', '%learning%');
    
    console.log(`📋 Learning Configurations Found: ${learningConfigs?.length || 0}`);
    
    const criticalConfigs = [
      'learning_enabled', 'adaptive_content_learning', 'engagement_learning_system',
      'viral_pattern_learning', 'competitor_learning_active', 'ai_learning_insights'
    ];
    
    let learningSystemScore = 0;
    
    criticalConfigs.forEach(configKey => {
      const config = learningConfigs?.find(c => c.key === configKey);
      if (config) {
        const isEnabled = config.value === true || config.value === 'true' || 
                         (typeof config.value === 'object' && config.value.enabled === true);
        console.log(`   ${isEnabled ? '✅' : '❌'} ${configKey}: ${isEnabled ? 'ENABLED' : 'DISABLED'}`);
        if (isEnabled) learningSystemScore++;
      } else {
        console.log(`   ⚠️ ${configKey}: NOT CONFIGURED`);
      }
    });
    
    console.log(`\n📊 Learning System Score: ${learningSystemScore}/${criticalConfigs.length} (${((learningSystemScore/criticalConfigs.length)*100).toFixed(1)}%)`);
    console.log('');

    // 4. Audit learning agents
    console.log('🤖 === LEARNING AGENTS AUDIT ===\n');
    
    const agentsDir = path.join(__dirname, 'src', 'agents');
    const learningAgents = [
      'adaptiveContentLearner.ts',
      'autonomousLearningAgent.ts', 
      'strategyLearner.ts',
      'expertIntelligenceSystem.ts',
      'competitiveIntelligenceLearner.ts',
      'nuclearLearningEnhancer.ts',
      'realTimeContentLearningEngine.ts'
    ];
    
    let functionalAgents = 0;
    
    learningAgents.forEach(agentFile => {
      const agentPath = path.join(agentsDir, agentFile);
      if (fs.existsSync(agentPath)) {
        const content = fs.readFileSync(agentPath, 'utf8');
        const hasLearningMethods = content.includes('learn') && content.includes('async');
        console.log(`   ${hasLearningMethods ? '✅' : '⚠️'} ${agentFile}: ${hasLearningMethods ? 'FUNCTIONAL' : 'BASIC'}`);
        if (hasLearningMethods) functionalAgents++;
      } else {
        console.log(`   ❌ ${agentFile}: MISSING`);
      }
    });
    
    console.log(`\n🤖 Learning Agents Score: ${functionalAgents}/${learningAgents.length} (${((functionalAgents/learningAgents.length)*100).toFixed(1)}%)`);
    console.log('');

    // 5. Check engagement tracking capability
    console.log('📈 === ENGAGEMENT TRACKING AUDIT ===\n');
    
    const { data: engagementData } = await supabase
      .from('engagement_data')
      .select('*')
      .limit(10);
    
    if (engagementData && engagementData.length > 0) {
      console.log(`✅ Engagement tracking: ${engagementData.length} records found`);
      console.log('   📊 System can track and learn from real engagement');
    } else {
      console.log('⚠️ Engagement tracking: No data yet');
      console.log('   📝 System ready but needs real engagement data to learn');
    }
    console.log('');

    // 6. Budget system audit
    console.log('💰 === BUDGET PROTECTION AUDIT ===\n');
    
    const budgetFiles = [
      'emergencyBudgetLockdown.ts',
      'nuclearBudgetEnforcer.ts', 
      'smartBudgetOptimizer.ts',
      'unifiedBudgetManager.ts'
    ];
    
    let budgetProtections = 0;
    budgetFiles.forEach(file => {
      const filePath = path.join(__dirname, 'src', 'utils', file);
      if (fs.existsSync(filePath)) {
        console.log(`   ✅ ${file}: ACTIVE`);
        budgetProtections++;
      } else {
        console.log(`   ❌ ${file}: MISSING`);
      }
    });
    
    console.log(`\n💰 Budget Protection Score: ${budgetProtections}/${budgetFiles.length} (${((budgetProtections/budgetFiles.length)*100).toFixed(1)}%)`);
    console.log('');

    // 7. Human voice system audit
    console.log('🗣️ === HUMAN VOICE SYSTEM AUDIT ===\n');
    
    const humanVoiceFiles = [
      'humanContentConfig.ts',
      'globalContentInterceptor.ts',
      'humanContentFilter.ts'
    ];
    
    let humanVoiceComponents = 0;
    humanVoiceFiles.forEach(file => {
      const configPath = path.join(__dirname, 'src', 'config', file);
      const utilsPath = path.join(__dirname, 'src', 'utils', file);
      
      if (fs.existsSync(configPath) || fs.existsSync(utilsPath)) {
        console.log(`   ✅ ${file}: IMPLEMENTED`);
        humanVoiceComponents++;
      } else {
        console.log(`   ❌ ${file}: MISSING`);
      }
    });
    
    console.log(`\n🗣️ Human Voice Score: ${humanVoiceComponents}/${humanVoiceFiles.length} (${((humanVoiceComponents/humanVoiceFiles.length)*100).toFixed(1)}%)`);
    console.log('');

    // 8. Content generation audit
    console.log('📝 === CONTENT GENERATION AUDIT ===\n');
    
    // Check recent content quality
    const recentTweets = allTweets.slice(0, 10);
    let qualityScore = 0;
    
    recentTweets.forEach((tweet, index) => {
      let tweetScore = 0;
      const content = tweet.content || '';
      
      // Human authenticity
      if (!content.includes('#')) tweetScore += 25;
      if (content.includes("I've") || content.includes("Been") || content.includes("what I")) tweetScore += 25;
      if (content.includes('?')) tweetScore += 20;
      if (/\d+%|\d+x|\$\d+/.test(content)) tweetScore += 20;
      if (content.length > 50 && content.length < 250) tweetScore += 10;
      
      qualityScore += tweetScore;
      console.log(`   Tweet ${index + 1}: ${tweetScore}/100 - "${content.substring(0, 60)}..."`);
    });
    
    const avgQuality = qualityScore / recentTweets.length;
    console.log(`\n📊 Average Content Quality: ${avgQuality.toFixed(1)}/100`);
    console.log('');

    // 9. HONEST ASSESSMENT
    console.log('🎯 === HONEST SYSTEM ASSESSMENT ===\n');
    
    const scores = {
      database: allTweets.length > 0 ? 100 : 0,
      learning: (learningSystemScore / criticalConfigs.length) * 100,
      agents: (functionalAgents / learningAgents.length) * 100,
      budget: (budgetProtections / budgetFiles.length) * 100,
      humanVoice: (humanVoiceComponents / humanVoiceFiles.length) * 100,
      contentQuality: avgQuality
    };
    
    const overallScore = Object.values(scores).reduce((a, b) => a + b, 0) / Object.keys(scores).length;
    
    console.log('📊 SYSTEM SCORES:');
    Object.entries(scores).forEach(([category, score]) => {
      const status = score >= 80 ? '🟢' : score >= 60 ? '🟡' : '🔴';
      console.log(`   ${status} ${category}: ${score.toFixed(1)}%`);
    });
    
    console.log(`\n🎯 OVERALL SYSTEM SCORE: ${overallScore.toFixed(1)}%`);
    console.log('');

    // 10. CRITICAL GAPS ANALYSIS
    console.log('⚠️ === CRITICAL GAPS & RECOMMENDATIONS ===\n');
    
    const gaps = [];
    
    if (scores.contentQuality < 70) {
      gaps.push({
        issue: 'Content Quality Below Target',
        impact: 'LOW FOLLOWER GROWTH POTENTIAL',
        solution: 'Activate real-time content learning and human voice filters'
      });
    }
    
    if (scores.learning < 80) {
      gaps.push({
        issue: 'Learning System Not Fully Configured',
        impact: 'SYSTEM WON\'T IMPROVE OVER TIME',
        solution: 'Enable all learning configurations and ensure data flow'
      });
    }
    
    if (livePostedTweets.length / allTweets.length < 0.5) {
      gaps.push({
        issue: 'Most Tweets Not Posted Live',
        impact: 'NO REAL ENGAGEMENT DATA FOR LEARNING',
        solution: 'Enable live posting and track real engagement metrics'
      });
    }
    
    if (humanTweets.length / allTweets.length < 0.7) {
      gaps.push({
        issue: 'Too Many Robotic Tweets',
        impact: 'POOR AUDIENCE ENGAGEMENT',
        solution: 'Activate human voice system and remove hashtags'
      });
    }
    
    if (gaps.length === 0) {
      console.log('✅ NO CRITICAL GAPS FOUND - System ready for autonomous operation!');
    } else {
      gaps.forEach((gap, index) => {
        console.log(`${index + 1}. ❌ ${gap.issue}`);
        console.log(`   📉 Impact: ${gap.impact}`);
        console.log(`   🔧 Solution: ${gap.solution}`);
        console.log('');
      });
    }

    // 11. FOLLOWER GROWTH POTENTIAL
    console.log('📈 === FOLLOWER GROWTH POTENTIAL ASSESSMENT ===\n');
    
    let followerGrowthScore = 0;
    
    // Content quality factor
    if (avgQuality >= 80) followerGrowthScore += 30;
    else if (avgQuality >= 60) followerGrowthScore += 20;
    else followerGrowthScore += 10;
    
    // Human authenticity factor
    const humanPercentage = (humanTweets.length / allTweets.length) * 100;
    if (humanPercentage >= 70) followerGrowthScore += 25;
    else if (humanPercentage >= 50) followerGrowthScore += 15;
    else followerGrowthScore += 5;
    
    // Learning capability factor
    if (scores.learning >= 80) followerGrowthScore += 25;
    else if (scores.learning >= 60) followerGrowthScore += 15;
    else followerGrowthScore += 5;
    
    // Live posting factor
    const livePercentage = (livePostedTweets.length / allTweets.length) * 100;
    if (livePercentage >= 50) followerGrowthScore += 20;
    else if (livePercentage >= 25) followerGrowthScore += 10;
    else followerGrowthScore += 5;
    
    console.log('🎯 FOLLOWER GROWTH FACTORS:');
    console.log(`   📝 Content Quality: ${avgQuality.toFixed(1)}/100 (${avgQuality >= 80 ? 'EXCELLENT' : avgQuality >= 60 ? 'GOOD' : 'NEEDS WORK'})`);
    console.log(`   🗣️ Human Authenticity: ${humanPercentage.toFixed(1)}% (${humanPercentage >= 70 ? 'EXCELLENT' : humanPercentage >= 50 ? 'GOOD' : 'POOR'})`);
    console.log(`   🧠 Learning Capability: ${scores.learning.toFixed(1)}% (${scores.learning >= 80 ? 'EXCELLENT' : scores.learning >= 60 ? 'GOOD' : 'POOR'})`);
    console.log(`   📱 Live Posting Rate: ${livePercentage.toFixed(1)}% (${livePercentage >= 50 ? 'EXCELLENT' : livePercentage >= 25 ? 'GOOD' : 'POOR'})`);
    console.log('');
    console.log(`📈 FOLLOWER GROWTH POTENTIAL: ${followerGrowthScore}/100`);
    
    if (followerGrowthScore >= 80) {
      console.log('🟢 EXCELLENT - High potential for rapid follower growth');
    } else if (followerGrowthScore >= 60) {
      console.log('🟡 GOOD - Moderate follower growth expected');
    } else {
      console.log('🔴 POOR - Significant improvements needed for follower growth');
    }
    console.log('');

    // 12. FINAL RECOMMENDATION
    console.log('🎯 === FINAL HONEST RECOMMENDATION ===\n');
    
    if (overallScore >= 85 && followerGrowthScore >= 80) {
      console.log('🚀 DEPLOY TO PRODUCTION');
      console.log('   ✅ System is ready for autonomous operation');
      console.log('   ✅ High potential for follower growth');
      console.log('   ✅ Learning systems will improve performance over time');
    } else if (overallScore >= 70) {
      console.log('⚠️ DEPLOY WITH MONITORING');
      console.log('   📊 System functional but needs close monitoring');
      console.log('   🔧 Address identified gaps for better performance');
      console.log('   📈 Expect gradual improvement over time');
    } else {
      console.log('🔴 DO NOT DEPLOY YET');
      console.log('   ❌ Critical issues need resolution first');
      console.log('   📝 Fix content quality and learning systems');
      console.log('   🧠 Enable human voice and engagement tracking');
    }

    return {
      overallScore,
      followerGrowthScore,
      gaps,
      recommendation: overallScore >= 85 ? 'DEPLOY' : overallScore >= 70 ? 'MONITOR' : 'FIX_FIRST'
    };

  } catch (error) {
    console.error('❌ Audit failed:', error);
    return { critical: true, error: error.message };
  }
}

comprehensiveAudit()
  .then(result => {
    console.log('\n🔍 === AUDIT COMPLETE ===');
    if (result.critical) {
      console.log('❌ CRITICAL SYSTEM ISSUES FOUND');
      console.log('🔧 Must resolve before deployment');
    } else {
      console.log(`📊 System Score: ${result.overallScore?.toFixed(1)}%`);
      console.log(`📈 Growth Potential: ${result.followerGrowthScore}/100`);
      console.log(`🎯 Recommendation: ${result.recommendation}`);
    }
  })
  .catch(console.error); 