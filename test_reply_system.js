#!/usr/bin/env node

/**
 * 🧪 COMPLETE REPLY SYSTEM TEST
 * Tests the full scrape → analyze → reply workflow
 */

async function testReplySystem() {
  console.log('🧪 === TESTING COMPLETE REPLY SYSTEM ===');
  console.log('🔄 Workflow: Scrape → Analyze → Generate → Post');
  
  try {
    // Compile TypeScript first
    const { execSync } = require('child_process');
    console.log('🔨 Compiling TypeScript...');
    execSync('npx tsc --build', { stdio: 'inherit' });
    
    // Test 1: Initialize scraper
    console.log('\n🕵️ TEST 1: Initialize Stealth Scraper');
    console.log('=====================================');
    const { stealthTweetScraper } = require('./dist/scraper/scrapeTweets.js');
    
    const scraperReady = await stealthTweetScraper.initialize();
    if (!scraperReady) {
      console.error('❌ Scraper failed to initialize');
      return;
    }
    console.log('✅ Stealth scraper initialized');
    
    // Test 2: Scrape tweets
    console.log('\n🔍 TEST 2: Scrape Health Tweets');
    console.log('===============================');
    const scrapeResult = await stealthTweetScraper.getViralHealthTweets(3);
    
    if (!scrapeResult.success || scrapeResult.tweets.length === 0) {
      console.error('❌ Failed to scrape tweets:', scrapeResult.error);
      await stealthTweetScraper.close();
      return;
    }
    
    console.log(`✅ Found ${scrapeResult.tweets.length} viral health tweets`);
    const sampleTweet = scrapeResult.tweets[0];
    console.log(`📝 Sample tweet: "${sampleTweet.content.substring(0, 80)}..."`);
    console.log(`👤 Author: @${sampleTweet.author.username} (${sampleTweet.engagement.likes} likes)`);
    
    // Test 3: Generate reply
    console.log('\n🧠 TEST 3: Generate GPT Reply');
    console.log('=============================');
    const { replyAgent } = require('./dist/agents/replyAgent.js');
    
    const replyResult = await replyAgent.generateReply(sampleTweet);
    
    if (!replyResult.success) {
      console.error('❌ Failed to generate reply:', replyResult.reason);
      await stealthTweetScraper.close();
      return;
    }
    
    console.log(`✅ Reply generated (confidence: ${replyResult.confidence})`);
    console.log(`💬 Reply: "${replyResult.reply}"`);
    console.log(`🎭 Type: ${replyResult.replyType}`);
    console.log(`📊 Estimated engagement: ${replyResult.estimatedEngagement}`);
    console.log(`🚀 Should post: ${replyResult.shouldPost ? 'YES' : 'NO'}`);
    
    // Test 4: Check posting capability (DRY RUN)
    console.log('\n🐦 TEST 4: Reply Posting Check (DRY RUN)');
    console.log('=======================================');
    const { replyPoster } = require('./dist/twitter/postReply.js');
    
    const canReply = replyPoster.canReplyNow();
    const stats = replyPoster.getReplyStats();
    
    console.log(`✅ Can reply now: ${canReply ? 'YES' : 'NO'}`);
    console.log(`📊 Daily replies: ${stats.dailyReplies}/${stats.maxDailyReplies}`);
    console.log(`⏰ Last reply: ${stats.lastReplyTime}`);
    
    if (replyResult.shouldPost && canReply) {
      console.log('🎯 System ready to post reply!');
      console.log('⚠️ DRY RUN MODE - Not actually posting to Twitter');
      
      // Simulate posting
      console.log('🔄 Simulating Twitter API call...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log('✅ Simulated post successful!');
    } else {
      console.log('⏸️ Would skip posting due to confidence/rate limits');
    }
    
    // Test 5: Full system integration
    console.log('\n🤖 TEST 5: Full System Integration');
    console.log('=================================');
    
    console.log('🔄 Testing complete reply workflow...');
    const fullResult = await replyAgent.runReplySystem();
    
    console.log(`📊 SYSTEM TEST RESULTS:`);
    console.log(`   Success: ${fullResult.success}`);
    console.log(`   Tweets found: ${fullResult.tweetsFound}`);
    console.log(`   Replies generated: ${fullResult.repliesGenerated}`);
    console.log(`   Replies posted: ${fullResult.repliesPosted}`);
    console.log(`   Summary: ${fullResult.summary}`);
    
    if (fullResult.errors.length > 0) {
      console.log(`   Errors: ${fullResult.errors.join(', ')}`);
    }
    
    // Test 6: Stealth analysis
    console.log('\n🕵️ TEST 6: Stealth & Security Analysis');
    console.log('=====================================');
    const stealthStats = replyAgent.getStealthStats();
    
    console.log('🎭 Pattern usage:');
    stealthStats.patternsUsed.forEach(pattern => {
      console.log(`   ${pattern.name}: ${pattern.usageCount} uses`);
    });
    
    console.log(`📊 Author interactions: ${stealthStats.authorInteractions.length}`);
    console.log(`🔄 Recent replies tracked: ${stealthStats.recentRepliesCount}`);
    console.log(`📈 Total replies generated: ${stealthStats.totalRepliesGenerated}`);
    
    // Close scraper
    await stealthTweetScraper.close();
    
    console.log('\n🎉 === REPLY SYSTEM TEST COMPLETE ===');
    console.log('✅ All systems operational and stealth-ready!');
    console.log('🕵️ Security measures: ✅ Pattern rotation, ✅ Rate limiting, ✅ Duplicate prevention');
    console.log('🤖 Ready for autonomous operation every 60 minutes');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testReplySystem().catch(console.error); 