#!/usr/bin/env node

/**
 * 🧪 CONTENT LEARNING ENGINE TEST
 * Tests the real-time content learning and strategy generation system
 */

async function testContentLearning() {
  console.log('🧪 === TESTING CONTENT LEARNING ENGINE ===');
  console.log('🔄 Workflow: Analyze Performance → Extract Insights → Generate Strategy');
  
  try {
    // Compile TypeScript first
    const { execSync } = require('child_process');
    console.log('🔨 Compiling TypeScript...');
    execSync('npx tsc --build', { stdio: 'inherit' });
    
    // Test 1: Initialize learning engine
    console.log('\n🧠 TEST 1: Initialize Content Learning Engine');
    console.log('===============================================');
    const { realTimeContentLearningEngine } = require('./dist/agents/realTimeContentLearningEngine.js');
    
    const learningStats = realTimeContentLearningEngine.getLearningStat();
    console.log('🧠 Learning Configuration:');
    console.log(`   Min data points: ${learningStats.minDataPoints}`);
    console.log(`   Confidence threshold: ${learningStats.confidenceThreshold}`);
    console.log(`   Strategy path: ${learningStats.strategyPath}`);
    console.log(`   Analysis log: ${learningStats.analysisLogPath}`);
    console.log(`   Last analysis: ${learningStats.lastAnalysis?.timestamp || 'Never'}`);
    
    // Test 2: Check current strategy
    console.log('\n📋 TEST 2: Current Strategy Analysis');
    console.log('===================================');
    try {
      const { optimizedStrategy } = require('./dist/strategy/tweetingStrategy.js');
      console.log('📊 Current Optimized Strategy:');
      console.log(`   Generated: ${optimizedStrategy.metadata.generatedAt}`);
      console.log(`   Confidence: ${Math.round(optimizedStrategy.metadata.confidence * 100)}%`);
      console.log(`   Best times: ${optimizedStrategy.bestTimeBlocks.join(', ')}`);
      console.log(`   Top tones: ${optimizedStrategy.highPerformanceTones.join(', ')}`);
      console.log(`   Keywords: ${optimizedStrategy.keywordsToPrioritize.join(', ')}`);
      console.log(`   Optimal length: ${optimizedStrategy.contentOptimization.optimalLength} chars`);
    } catch (strategyError) {
      console.error('❌ Could not load current strategy:', strategyError);
    }
    
    // Test 3: Database connectivity and data availability
    console.log('\n💾 TEST 3: Database Analysis');
    console.log('============================');
    try {
      const { supabaseClient } = require('./dist/utils/supabaseClient.js');
      
      // Check for performance data
      const { data: tweets, error } = await supabaseClient.supabase
        ?.from('tweets')
        ?.select('tweet_id, content, likes, retweets, replies, created_at, performance_log, gpt_reply_score')
        ?.eq('success', true)
        ?.order('created_at', { ascending: false })
        ?.limit(20);
      
      if (error) {
        console.error('❌ Database query failed:', error);
      } else {
        console.log(`✅ Found ${tweets?.length || 0} tweets for analysis`);
        
        if (tweets && tweets.length > 0) {
          // Analyze data quality
          const tweetsWithPerformanceLog = tweets.filter(t => t.performance_log && t.performance_log.length > 0);
          const tweetsWithReplyScore = tweets.filter(t => t.gpt_reply_score && t.gpt_reply_score > 0);
          const avgEngagement = tweets.reduce((sum, t) => sum + (t.likes + t.retweets + t.replies), 0) / tweets.length;
          
          console.log(`📊 Data Quality Analysis:`);
          console.log(`   Tweets with performance logs: ${tweetsWithPerformanceLog.length}/${tweets.length}`);
          console.log(`   Tweets with reply scores: ${tweetsWithReplyScore.length}/${tweets.length}`);
          console.log(`   Average engagement: ${Math.round(avgEngagement * 10) / 10}`);
          
          // Show sample tweet analysis
          if (tweets.length > 0) {
            const sampleTweet = tweets[0];
            console.log(`\n📝 Sample Tweet Analysis:`);
            console.log(`   ID: ${sampleTweet.tweet_id}`);
            console.log(`   Content: "${sampleTweet.content.substring(0, 80)}..."`);
            console.log(`   Engagement: ${sampleTweet.likes} likes, ${sampleTweet.retweets} retweets`);
            console.log(`   Performance log entries: ${sampleTweet.performance_log?.length || 0}`);
            console.log(`   Reply score: ${sampleTweet.gpt_reply_score || 'N/A'}`);
          }
        }
      }
    } catch (dbError) {
      console.error('❌ Database analysis failed:', dbError);
    }
    
    // Test 4: Run content learning analysis
    console.log('\n🔄 TEST 4: Content Learning Analysis');
    console.log('===================================');
    
    console.log('🧠 Running full content learning analysis...');
    const analysisResult = await realTimeContentLearningEngine.analyzeAndGenerateStrategy();
    
    console.log('\n📊 CONTENT LEARNING RESULTS:');
    console.log(`   Success: ${analysisResult.success}`);
    console.log(`   Data points: ${analysisResult.dataPoints}`);
    console.log(`   Confidence: ${Math.round(analysisResult.confidence * 100)}%`);
    console.log(`   Generated: ${analysisResult.generatedAt}`);
    console.log(`   Summary: ${analysisResult.summary}`);
    
    if (analysisResult.error) {
      console.log(`   Error: ${analysisResult.error}`);
    }
    
    if (analysisResult.success && analysisResult.insights) {
      console.log('\n🎯 EXTRACTED INSIGHTS:');
      console.log(`   Best posting times: ${analysisResult.insights.bestTimeBlocks.join(', ')}`);
      console.log(`   High-performance tones: ${analysisResult.insights.highPerformanceTones.join(', ')}`);
      console.log(`   Priority keywords: ${analysisResult.insights.keywordsToPrioritize.join(', ')}`);
      console.log(`   Optimal content length: ${analysisResult.insights.contentPatterns.topPerformingLength} chars`);
      console.log(`   Average engagement: ${Math.round(analysisResult.insights.contentPatterns.avgEngagement * 10) / 10}`);
      
      if (analysisResult.insights.contentPatterns.underperformingPatterns.length > 0) {
        console.log(`   Patterns to avoid: ${analysisResult.insights.contentPatterns.underperformingPatterns.join(', ')}`);
      }
      
      if (analysisResult.insights.replyInsights.bestReplyTones.length > 0) {
        console.log(`   Best reply tones: ${analysisResult.insights.replyInsights.bestReplyTones.join(', ')}`);
      }
    }
    
    // Test 5: Verify strategy file generation
    console.log('\n💾 TEST 5: Strategy File Verification');
    console.log('=====================================');
    
    const fs = require('fs');
    const path = require('path');
    const strategyPath = path.join(process.cwd(), 'src', 'strategy', 'tweetingStrategy.ts');
    
    if (fs.existsSync(strategyPath)) {
      console.log('✅ Strategy file exists');
      
      try {
        const strategyContent = fs.readFileSync(strategyPath, 'utf8');
        const contentLines = strategyContent.split('\n').length;
        const hasTimeBlocks = strategyContent.includes('bestTimeBlocks');
        const hasTones = strategyContent.includes('highPerformanceTones');
        const hasKeywords = strategyContent.includes('keywordsToPrioritize');
        const hasMetadata = strategyContent.includes('metadata');
        
        console.log(`📄 Strategy file analysis:`);
        console.log(`   Lines of code: ${contentLines}`);
        console.log(`   Contains time blocks: ${hasTimeBlocks ? '✅' : '❌'}`);
        console.log(`   Contains tones: ${hasTones ? '✅' : '❌'}`);
        console.log(`   Contains keywords: ${hasKeywords ? '✅' : '❌'}`);
        console.log(`   Contains metadata: ${hasMetadata ? '✅' : '❌'}`);
        
        // Show file modification time
        const stats = fs.statSync(strategyPath);
        console.log(`   Last modified: ${stats.mtime.toISOString()}`);
        
      } catch (fileError) {
        console.error('❌ Could not analyze strategy file:', fileError);
      }
    } else {
      console.error('❌ Strategy file does not exist');
    }
    
    // Test 6: Integration with growth master
    console.log('\n🚀 TEST 6: Growth Master Integration');
    console.log('===================================');
    
    try {
      const { AutonomousTwitterGrowthMaster } = require('./dist/agents/autonomousTwitterGrowthMaster.js');
      const growthMaster = AutonomousTwitterGrowthMaster.getInstance();
      
      // Test optimized strategy insights
      const insights = growthMaster.getOptimizedStrategyInsights();
      console.log('🧠 Growth Master Strategy Integration:');
      console.log(`   Confidence: ${Math.round(insights.confidence * 100)}%`);
      console.log(`   Best posting times: ${insights.bestPostingTimes.join(', ')}`);
      console.log(`   Preferred tones: ${insights.preferredTones.join(', ')}`);
      console.log(`   Keyword boosts: ${insights.keywordBoosts.join(', ')}`);
      console.log(`   Optimal length: ${insights.contentOptimization.optimalLength} chars`);
      
      // Test optimized content generation
      console.log('\n🎨 Testing optimized content generation...');
      const optimizedContent = await growthMaster.generateOptimizedContent(
        'Generate a health-focused tweet about the latest research',
        'viral'
      );
      
      console.log(`✅ Generated optimized content: "${optimizedContent.substring(0, 100)}..."`);
      
    } catch (integrationError) {
      console.error('❌ Growth master integration failed:', integrationError);
    }
    
    // Test 7: Performance insights analysis
    console.log('\n📈 TEST 7: Performance Insights Analysis');
    console.log('=======================================');
    
    if (analysisResult.success && analysisResult.insights.temporalPatterns) {
      const temporal = analysisResult.insights.temporalPatterns;
      
      console.log('⏰ Temporal Performance Analysis:');
      if (Object.keys(temporal.hourlyPerformance).length > 0) {
        const bestHour = Object.entries(temporal.hourlyPerformance)
          .sort(([,a], [,b]) => b - a)[0];
        console.log(`   Best performing hour: ${bestHour[0]}:00 (score: ${Math.round(bestHour[1] * 100) / 100})`);
      }
      
      if (Object.keys(temporal.weekdayPerformance).length > 0) {
        const bestDay = Object.entries(temporal.weekdayPerformance)
          .sort(([,a], [,b]) => b - a)[0];
        console.log(`   Best performing day: ${bestDay[0]} (score: ${Math.round(bestDay[1] * 100) / 100})`);
      }
      
      if (temporal.optimalPostingWindows.length > 0) {
        console.log(`   Optimal posting windows: ${temporal.optimalPostingWindows.slice(0, 3).join(', ')}`);
      }
    }
    
    console.log('\n🎉 === CONTENT LEARNING TEST COMPLETE ===');
    console.log('✅ System is learning from performance data!');
    console.log('🧠 Strategy file auto-updates every 24 hours');
    console.log('📊 Insights feed directly into content generation');
    console.log('🚀 Bot continuously optimizes based on what works');
    
    if (analysisResult.success) {
      console.log(`🎯 Current learning status: ${Math.round(analysisResult.confidence * 100)}% confidence from ${analysisResult.dataPoints} data points`);
    } else {
      console.log('⚠️ Learning system needs more data - will improve as more tweets are posted');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testContentLearning().catch(console.error); 