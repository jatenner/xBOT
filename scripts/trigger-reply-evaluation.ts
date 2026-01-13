#!/usr/bin/env tsx
/**
 * Trigger reply evaluation cycle (scheduler + orchestrator)
 */

import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
  console.log('=== Triggering Reply Evaluation ===\n');
  
  // Trigger scheduler directly (attemptScheduledReply)
  const { attemptScheduledReply } = await import('../src/jobs/replySystemV2/tieredScheduler');
  
  try {
    const result = await attemptScheduledReply();
    console.log('\n✅ Scheduler run completed');
    console.log(`   Posted: ${result.posted}`);
    console.log(`   Reason: ${result.reason}`);
    if (result.candidate_tweet_id) {
      console.log(`   Candidate: ${result.candidate_tweet_id}`);
    }
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
