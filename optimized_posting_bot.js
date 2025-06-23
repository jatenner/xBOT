#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');

console.log('🚀 === OPTIMIZED POSTING BOT ===');
console.log('📊 High-frequency posting for maximum engagement');
console.log('⚡ Bypassing complex strategist logic for immediate results');

async function main() {
  try {
    // Build the project
    console.log('📦 Building project...');
    execSync('npm run build', { stdio: 'inherit' });

    // Import and run the optimized bot
    const { QuickPostModeAgent } = require('./dist/agents/quickPostModeAgent');
    const quickPoster = new QuickPostModeAgent();

    console.log('🔄 Starting continuous posting cycle...');
    
    let postCount = 0;
    const maxPosts = 5; // Post 5 tweets immediately to catch up

    while (postCount < maxPosts) {
      console.log(`\n🎯 === POST ATTEMPT ${postCount + 1}/${maxPosts} ===`);
      
      if (postCount === 0) {
        // Force first post immediately
        console.log('🔥 FORCE POSTING FIRST TWEET');
        await quickPoster.forcePost();
      } else {
        // Use normal posting logic with 30-min intervals
        await quickPoster.run();
      }

      postCount++;

      // Wait 35 minutes between posts for sustained activity
      if (postCount < maxPosts) {
        console.log('⏰ Waiting 35 minutes for next post...');
        console.log('📊 This creates consistent posting rhythm');
        await new Promise(resolve => setTimeout(resolve, 35 * 60 * 1000));
      }
    }

    console.log('✅ OPTIMIZED POSTING CYCLE COMPLETE');
    console.log(`📊 Posted ${postCount} high-quality tweets`);
    console.log('🔄 Bot will continue with normal strategist mode');

  } catch (error) {
    console.error('❌ Optimized posting error:', error);
    process.exit(1);
  }
}

// Handle process termination gracefully
process.on('SIGINT', () => {
  console.log('\n🛑 Gracefully shutting down optimized posting bot...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Terminating optimized posting bot...');
  process.exit(0);
});

// Run the optimized posting bot
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
}); 