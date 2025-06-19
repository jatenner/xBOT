const { TweetCleanup } = require('./dist/utils/tweetCleanup.js');

async function strategicCleanup() {
  console.log('🎯 === STRATEGIC TWEET CLEANUP ===');
  console.log('🎯 Goal: Remove problematic content while preserving valuable tweets\n');

  const cleanup = new TweetCleanup();

  // Phase 1: Remove tweets with problematic keywords
  console.log('📋 PHASE 1: Emergency keyword cleanup');
  const problematicKeywords = [
    'brain teaser',
    'riddle',
    'five-letter word',
    'what am i',
    'late night brain',
    'good morning',
    'test tweet',
    'testing',
    'hello world'
  ];

  const keywordResults = await cleanup.emergencyKeywordCleanup(problematicKeywords, true); // DRY RUN first
  console.log(`📊 Found ${keywordResults.reviewed} tweets with problematic keywords`);
  console.log(`🗑️ Would delete ${keywordResults.deleted} tweets\n`);

  // Phase 2: Review low-quality tweets (but keep ones with engagement)
  console.log('📋 PHASE 2: Quality-based cleanup');
  const qualityResults = await cleanup.reviewLowQualityTweets({
    qualityThreshold: 40, // Very low threshold - only remove truly bad content
    daysBack: 30, // Last 30 days
    dryRun: true // DRY RUN first
  });
  console.log(`📊 Found ${qualityResults.reviewed} low-quality tweets`);
  console.log(`🗑️ Would delete ${qualityResults.deleted} tweets\n`);

  // Summary
  const totalToDelete = keywordResults.deleted + qualityResults.deleted;
  console.log('📊 === CLEANUP SUMMARY ===');
  console.log(`🗑️ Total tweets to remove: ${totalToDelete}`);
  console.log(`✅ Strategy: Keep tweets with engagement, remove only problematic content`);
  console.log(`🛡️ Benefits: Preserve SEO, engagement history, and follower trust`);
  
  console.log('\n🤔 RECOMMENDATION:');
  if (totalToDelete < 50) {
    console.log('✅ PROCEED: Low cleanup volume - minimal impact');
    console.log('   Run: node selective_cleanup_strategy.js --execute');
  } else if (totalToDelete < 200) {
    console.log('⚠️ MODERATE: Consider manual review of high-engagement tweets');
    console.log('   Review first, then run: node selective_cleanup_strategy.js --execute');
  } else {
    console.log('🚨 HIGH VOLUME: Consider keeping account as-is');
    console.log('   Your content quality improvements will fix future tweets');
    console.log('   Old problematic tweets will be buried by new quality content');
  }

  // If --execute flag is provided, run actual cleanup
  if (process.argv.includes('--execute')) {
    console.log('\n🚀 === EXECUTING CLEANUP ===');
    console.log('⚠️ This will actually delete tweets!');
    
    // Wait 5 seconds for user to cancel if needed
    console.log('⏳ Starting in 5 seconds... (Ctrl+C to cancel)');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Execute keyword cleanup
    console.log('🗑️ Executing keyword cleanup...');
    await cleanup.emergencyKeywordCleanup(problematicKeywords, false);
    
    // Execute quality cleanup
    console.log('🗑️ Executing quality cleanup...');
    await cleanup.reviewLowQualityTweets({
      qualityThreshold: 40,
      daysBack: 30,
      dryRun: false
    });
    
    console.log('✅ Cleanup complete!');
  }
}

// Handle errors gracefully
strategicCleanup().catch(error => {
  console.error('❌ Cleanup failed:', error);
  process.exit(1);
}); 