#!/usr/bin/env tsx
/**
 * Trigger one reply evaluation cycle to generate reply_decisions with new fields
 */

import 'dotenv/config';
import { fetchAndEvaluateCandidates } from '../src/jobs/replySystemV2/orchestrator';
import { attemptScheduledReply } from '../src/jobs/replySystemV2/tieredScheduler';

async function triggerEvaluation() {
  console.log('🎯 Triggering reply evaluation cycle...\n');

  try {
    // Step 1: Fetch and evaluate candidates (this will log candidate features)
    console.log('📊 Step 1: Fetching and evaluating candidates...');
    const fetchResult = await fetchAndEvaluateCandidates();
    console.log(`✅ Fetched: ${fetchResult.fetched}, Evaluated: ${fetchResult.evaluated}, Passed: ${fetchResult.passed_filters}`);
    console.log(`   Feed run ID: ${fetchResult.feed_run_id}\n`);

    // Step 2: Attempt scheduled reply (this will select template and log decision)
    console.log('📊 Step 2: Attempting scheduled reply...');
    const schedulerResult = await attemptScheduledReply();
    console.log(`✅ Posted: ${schedulerResult.posted}, Reason: ${schedulerResult.reason}`);
    if (schedulerResult.candidate_tweet_id) {
      console.log(`   Candidate: ${schedulerResult.candidate_tweet_id}`);
    }
    console.log('');

    console.log('✅ Evaluation cycle complete');
  } catch (error: any) {
    console.error('❌ Evaluation failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

triggerEvaluation().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
