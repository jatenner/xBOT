#!/usr/bin/env tsx
/**
 * 🔄 Force Reply V2 Pipeline
 * 
 * Runs one complete cycle:
 * 1. Harvest (if allowed)
 * 2. Refresh candidate queue
 * 3. Run scheduler
 * 4. Print counts after each step
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';
import { refreshCandidateQueue } from '../../src/jobs/replySystemV2/queueManager';
import { attemptScheduledReply } from '../../src/jobs/replySystemV2/tieredScheduler';

async function checkCounts(step: string) {
  const supabase = getSupabaseClient();
  
  // Opportunities
  const { data: opps } = await supabase
    .from('reply_opportunities')
    .select('replied_to, tweet_posted_at, is_root_tweet');
  
  const unclaimedRoots = opps?.filter(o => !o.replied_to && o.is_root_tweet) || [];
  const now = Date.now();
  const threeHoursAgo = now - 3 * 60 * 60 * 1000;
  const fresh3h = unclaimedRoots.filter(o => 
    o.tweet_posted_at && new Date(o.tweet_posted_at).getTime() > threeHoursAgo
  ).length;
  
  // Evaluations
  const { data: evals } = await supabase
    .from('candidate_evaluations')
    .select('passed_hard_filters, predicted_tier');
  
  const passedEvals = evals?.filter(e => e.passed_hard_filters) || [];
  const tier3Evals = passedEvals.filter(e => e.predicted_tier <= 3);
  
  // Queue
  const { data: queue } = await supabase
    .from('reply_candidate_queue')
    .select('status, created_at')
    .eq('status', 'queued')
    .gt('expires_at', new Date().toISOString());
  
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const queueLast30m = queue?.filter(q => q.created_at >= thirtyMinAgo).length || 0;
  
  // Decisions
  const { data: decisions } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, status, created_at')
    .eq('decision_type', 'reply')
    .in('pipeline_source', ['reply_v2_planner', 'reply_v2_scheduler'])
    .gte('created_at', thirtyMinAgo);
  
  console.log(`\n📊 ${step}:`);
  console.log(`  opps: ${unclaimedRoots.length} unclaimed roots, ${fresh3h} fresh (<3h)`);
  console.log(`  evals: ${evals?.length || 0} total, ${passedEvals.length} passed, ${tier3Evals.length} tier<=3`);
  console.log(`  queue: ${queue?.length || 0} queued, ${queueLast30m} last 30m`);
  console.log(`  decisions: ${decisions?.length || 0} last 30m`);
}

async function main() {
  console.log('🔄 Force Reply V2 Pipeline');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Step 0: Initial counts
  await checkCounts('Initial State');
  
  // Step 1: Harvest (if allowed)
  const harvestingEnabled = process.env.HARVESTING_ENABLED === 'true';
  if (harvestingEnabled) {
    console.log('\n🌾 Step 1: Running harvester...');
    try {
      const { replyOpportunityHarvester } = await import('../../src/jobs/replyOpportunityHarvester');
      await replyOpportunityHarvester();
      console.log('✅ Harvester completed');
    } catch (error: any) {
      console.warn(`⚠️  Harvester failed (may not be allowed on Railway): ${error.message}`);
    }
  } else {
    console.log('\n🌾 Step 1: Skipping harvester (HARVESTING_ENABLED != true)');
  }
  
  await checkCounts('After Harvest');
  
  // Step 2: Refresh queue
  console.log('\n📋 Step 2: Refreshing candidate queue...');
  try {
    const queueResult = await refreshCandidateQueue();
    const evalCount = queueResult?.evaluated ?? 0;
    const queuedCount = queueResult?.queued ?? 0;
    const expiredCount = queueResult?.expired ?? 0;
    console.log(`✅ Queue refresh: evaluated=${evalCount} queued=${queuedCount} expired=${expiredCount}`);
  } catch (error: any) {
    console.error(`❌ Queue refresh failed: ${error.message}`);
    throw error;
  }
  
  await checkCounts('After Queue Refresh');
  
  // Step 3: Run scheduler
  console.log('\n🎯 Step 3: Running scheduler...');
  try {
    const schedulerResult = await attemptScheduledReply();
    console.log(`✅ Scheduler: posted=${schedulerResult.posted} reason=${schedulerResult.reason}`);
  } catch (error: any) {
    console.error(`❌ Scheduler failed: ${error.message}`);
    throw error;
  }
  
  await checkCounts('After Scheduler');
  
  console.log('\n✅ Pipeline complete!');
}

main().catch(console.error);
