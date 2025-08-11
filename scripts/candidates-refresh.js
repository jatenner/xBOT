#!/usr/bin/env node

/**
 * 🎮 CANDIDATE REFRESH CLI
 * 
 * PURPOSE: Generate and queue content candidates for staging
 * USAGE: npm run candidates:refresh
 */

const { ContentSourceManager } = require('../dist/candidates/sources');
const { CandidatePreprocessor } = require('../dist/candidates/prep');
const { CandidateQueue } = require('../dist/candidates/queue');

async function main() {
  console.log('🎮 xBOT Candidate Refresh CLI');
  console.log('============================\n');

  // Check environment
  const env = process.env.APP_ENV || 'unknown';
  const liveMode = process.env.LIVE_POSTS === 'true';
  const redisPrefix = process.env.REDIS_PREFIX || 'app:';

  console.log(`Environment: ${env}`);
  console.log(`Live Posts: ${liveMode}`);
  console.log(`Redis Prefix: ${redisPrefix}`);
  console.log('');

  // Prevent running in production with live posting
  if (env === 'production' && liveMode) {
    console.error('❌ Cannot run candidate refresh in production with LIVE_POSTS=true');
    console.error('   Set LIVE_POSTS=false to run in shadow mode');
    process.exit(1);
  }

  try {
    // Initialize components
    console.log('🔧 Initializing components...');
    const sourceManager = new ContentSourceManager();
    const preprocessor = new CandidatePreprocessor();
    const candidateQueue = new CandidateQueue();

    // Get source statistics
    const sourceStats = sourceManager.getSourceStats();
    console.log('📊 Content Sources:');
    Object.entries(sourceStats).forEach(([name, stats]) => {
      console.log(`   ${name}: ${stats.enabled ? '✅' : '❌'} (${stats.expectedCandidates} candidates)`);
    });
    console.log('');

    // Generate candidates
    console.log('🎯 Generating candidates...');
    const rawCandidates = await sourceManager.getAllCandidates();
    console.log(`Generated ${rawCandidates.length} raw candidates\n`);

    if (rawCandidates.length === 0) {
      console.log('⚠️  No candidates generated. Check source configuration.');
      return;
    }

    // Preprocess candidates
    console.log('🔧 Preprocessing candidates...');
    const preparedCandidates = await preprocessor.prepareCandidates(rawCandidates);
    
    // Get preprocessing stats
    const prepStats = preprocessor.getPreparationStats(preparedCandidates);
    console.log(`📈 Preparation Stats:`);
    console.log(`   Total: ${prepStats.total}`);
    console.log(`   Duplicates: ${prepStats.duplicates}`);
    console.log(`   Avg Recency Score: ${prepStats.avgRecencyScore.toFixed(3)}`);
    console.log(`   Top Sources: ${prepStats.topSources.join(', ')}`);
    console.log('');

    // Show topic distribution
    console.log('📂 Topic Distribution:');
    Object.entries(prepStats.byTopic).forEach(([topic, count]) => {
      console.log(`   ${topic}: ${count} candidates`);
    });
    console.log('');

    // Queue candidates
    console.log('🚀 Enqueueing candidates...');
    const queueResult = await candidateQueue.enqueueBatch(preparedCandidates);
    
    console.log(`📊 Queue Results:`);
    console.log(`   Success: ${queueResult.success}`);
    console.log(`   Skipped: ${queueResult.skipped} (duplicates)`);
    console.log(`   Errors: ${queueResult.errors}`);
    console.log('');

    // Get final queue stats
    const queueStats = await candidateQueue.getStats();
    console.log('📈 Final Queue Stats:');
    console.log(`   Queue Depth: ${queueStats.queueDepth}`);
    console.log(`   Avg Priority: ${queueStats.avgPriority.toFixed(1)}`);
    console.log(`   Top Topics: ${queueStats.topTopics.slice(0, 3).join(', ')}`);
    
    if (queueStats.oldestCandidate) {
      const hoursOld = (Date.now() - queueStats.oldestCandidate.getTime()) / (1000 * 60 * 60);
      console.log(`   Oldest: ${hoursOld.toFixed(1)}h ago`);
    }
    console.log('');

    // Show sample candidates
    if (queueResult.success > 0) {
      console.log('🎯 Sample Candidates:');
      const samples = await candidateQueue.peek(3);
      samples.forEach((candidate, index) => {
        console.log(`   ${index + 1}. "${candidate.text.substring(0, 60)}..."`);
        console.log(`      Topic: ${candidate.topic} | Priority: ${candidate.queuePriority} | Source: ${candidate.source}`);
      });
      console.log('');
    }

    // Queue health check
    const queueHealth = await candidateQueue.getHealth();
    console.log(`🔍 Queue Health: ${queueHealth.status.toUpperCase()}`);
    if (queueHealth.message !== 'Queue operating normally') {
      console.log(`   ${queueHealth.message}`);
    }
    console.log('');

    // Cleanup old candidates
    console.log('🧹 Cleaning up expired candidates...');
    const cleaned = await candidateQueue.cleanupExpired();
    if (cleaned > 0) {
      console.log(`   Removed ${cleaned} expired candidates`);
    } else {
      console.log('   No expired candidates found');
    }
    console.log('');

    // Final summary
    console.log('✅ Candidate refresh complete!');
    console.log(`   Generated: ${rawCandidates.length} → Prepared: ${preparedCandidates.length} → Queued: ${queueResult.success}`);
    console.log('');
    
    // Next steps
    console.log('🔮 Next Steps:');
    if (env === 'staging') {
      console.log('   1. Run scheduler to test candidate selection: npm run schedule:test');
      console.log('   2. Monitor queue depth and candidate quality');
      console.log('   3. Adjust source weights if needed');
    } else {
      console.log('   1. Review candidate quality in staging first');
      console.log('   2. Test with LIVE_POSTS=false before production');
    }

  } catch (error) {
    console.error('❌ Candidate refresh failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = { main };