#!/usr/bin/env npx ts-node

/**
 * Dry Run Reply Script
 * Shows reply planning without posting for testing reply systems
 */

import { config } from 'dotenv';
config();

import { runReplyCycle, getReplyCycleStatus } from '../src/jobs/replyCycle';
import { log_compat as log, log_compat as warn, log_compat as error } from '../src/utils/logger';

async function main() {
  // Override settings for dry run
  process.env.POSTING_DISABLED = 'true';
  process.env.ENABLE_REPLIES = 'true';
  
  log(`DRYRUN_REPLY: Testing reply cycle (dry run mode)`);
  console.log(`💬 Testing reply cycle (no actual replies)...`);
  console.log(`📊 Environment: POSTING_DISABLED=true, ENABLE_REPLIES=true\n`);
  
  try {
    const startTime = Date.now();
    
    // First, show current status
    console.log('📊 Reply Cycle Status:');
    const status = await getReplyCycleStatus();
    
    console.log(`   Enabled: ${status.enabled}`);
    console.log(`   Quota Used: ${status.quotaUsed}/${status.quotaLimit}`);
    
    if (status.timeUntilNextReply) {
      const minutesUntilNext = Math.ceil(status.timeUntilNextReply / 60000);
      console.log(`   Time Until Next: ${minutesUntilNext} minutes`);
    }
    
    console.log(`   Active Targets: ${status.activeTargets}`);
    
    if (status.lastDiscovery) {
      console.log(`   Last Discovery: ${status.lastDiscovery}`);
    }
    
    console.log('\n🔍 Running Reply Discovery and Planning...\n');
    
    // Run the reply cycle
    const result = await runReplyCycle();
    
    console.log('📋 Reply Cycle Results:');
    console.log(`   Targets Discovered: ${result.targetsDiscovered}`);
    console.log(`   Replies Planned: ${result.repliesPlanned}`);
    console.log(`   Quota Used: ${result.quotaUsed}`);
    
    if (result.errors.length > 0) {
      console.log(`   Errors: ${result.errors.length}`);
      result.errors.forEach((err, i) => {
        console.log(`     ${i + 1}. ${err}`);
      });
    }
    
    // Explain what would happen in real mode
    console.log('\n💡 In Production Mode:');
    
    if (result.repliesPlanned > 0) {
      console.log('   ✅ Would generate reply content');
      console.log('   ✅ Would validate reply quality');
      console.log('   ✅ Would post reply if valid');
      console.log('   ✅ Would update quota tracking');
      console.log('   ✅ Would track reply for learning');
    } else if (result.targetsDiscovered === 0) {
      console.log('   ℹ️ No reply targets discovered');
      console.log('   💡 In real mode, would monitor health hashtags and discussions');
      console.log('   💡 Would look for questions and conversations to engage');
    } else {
      console.log('   ⚠️ Targets found but none met opportunity threshold');
      console.log('   💡 Would wait for better opportunities');
    }
    
    // Show sample reply arms if possible
    console.log('\n🎯 Sample Reply Strategy (for demonstration):');
    
    const { selectReplyArm } = await import('../src/learning/bandits');
    
    try {
      const replySelection = await selectReplyArm(
        ['health_questions', 'nutrition_tips', 'fitness_advice'],
        ['supportive', 'informative', 'expert_insight']
      );
      
      console.log(`   Selected Reply Arm: ${replySelection.armId}`);
      console.log(`   Algorithm: ${replySelection.algorithm}`);
      console.log(`   Expected Reward: ${replySelection.expectedReward.toFixed(3)}`);
      console.log(`   Reasoning: ${replySelection.reason}`);
      
    } catch (banditErr) {
      console.log('   ℹ️ No bandit data available yet (need more reply history)');
    }
    
    const duration = Date.now() - startTime;
    console.log(`\n✅ Reply dry run completed in ${duration}ms`);
    
    process.exit(0);
    
  } catch (err: any) {
    error(`❌ DRYRUN_REPLY_FAILED: ${err.message}`);
    console.error(`❌ Reply dry run failed: ${err.message}`);
    process.exit(1);
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n⚠️ Reply dry run interrupted by user');
  process.exit(130);
});

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

if (require.main === module) {
  main();
}
