#!/usr/bin/env node

/**
 * 🧪 TEST SCRIPT FOR STEALTH TWEET SCRAPER
 * Run this to see the exact output format of scraped tweets
 */

async function testScraper() {
  console.log('🧪 Testing Stealth Tweet Scraper...');
  
  try {
    // Compile TypeScript first
    const { execSync } = require('child_process');
    console.log('🔨 Compiling TypeScript...');
    execSync('npx tsc --build', { stdio: 'inherit' });
    
    // Import the compiled scraper
    const { stealthTweetScraper } = require('./dist/scraper/scrapeTweets.js');
    
    // Initialize the scraper
    console.log('🚀 Initializing scraper...');
    const initialized = await stealthTweetScraper.initialize();
    
    if (!initialized) {
      console.error('❌ Failed to initialize scraper');
      return;
    }
    
    // Test search for AI health tweets
    console.log('🔍 Searching for "ai health" tweets...');
    const result = await stealthTweetScraper.searchTweets('ai health', 3);
    
    console.log('\n📊 SCRAPER OUTPUT EXAMPLE:');
    console.log('=====================================');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.success && result.tweets.length > 0) {
      console.log('\n🎯 FIRST TWEET OBJECT FORMAT:');
      console.log('=====================================');
      const firstTweet = result.tweets[0];
      console.log(`Tweet ID: ${firstTweet.tweetId}`);
      console.log(`Content: ${firstTweet.content}`);
      console.log(`Author: @${firstTweet.author.username} (${firstTweet.author.displayName})`);
      console.log(`Verified: ${firstTweet.author.verified ? '✅' : '❌'}`);
      console.log(`Engagement: ${firstTweet.engagement.likes} likes, ${firstTweet.engagement.retweets} retweets`);
      console.log(`URL: ${firstTweet.url}`);
      console.log(`Is Reply: ${firstTweet.isReply ? 'Yes' : 'No'}`);
      console.log(`Timestamp: ${firstTweet.timestamp}`);
    }
    
    // Close the scraper
    await stealthTweetScraper.close();
    console.log('\n✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testScraper().catch(console.error); 