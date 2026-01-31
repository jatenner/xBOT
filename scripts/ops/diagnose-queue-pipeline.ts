#!/usr/bin/env tsx
/**
 * Diagnose Queue Pipeline
 * 
 * Shows detailed breakdown of where pipeline is empty
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';

async function main() {
  const supabase = getSupabaseClient();
  
  console.log('🔍 Queue Pipeline Diagnosis');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // 1. Opportunities
  const { data: opps } = await supabase
    .from('reply_opportunities')
    .select('replied_to, tweet_posted_at, is_root_tweet, created_at');
  
  const unclaimedRoots = opps?.filter(o => !o.replied_to && o.is_root_tweet) || [];
  const now = Date.now();
  const threeHoursAgo = now - 3 * 60 * 60 * 1000;
  const fresh3h = unclaimedRoots.filter(o => 
    o.tweet_posted_at && new Date(o.tweet_posted_at).getTime() > threeHoursAgo
  ).length;
  
  console.log(`1️⃣ Reply Opportunities:`);
  console.log(`   Total: ${opps?.length || 0}`);
  console.log(`   Unclaimed roots: ${unclaimedRoots.length}`);
  console.log(`   Fresh (<3h): ${fresh3h}`);
  if (unclaimedRoots.length > 0) {
    const newest = unclaimedRoots.reduce((newest, o) => {
      if (!o.tweet_posted_at) return newest;
      const oTime = new Date(o.tweet_posted_at).getTime();
      const newestTime = newest ? new Date(newest).getTime() : 0;
      return oTime > newestTime ? o.tweet_posted_at : newest;
    }, null as string | null);
    console.log(`   Newest unclaimed: ${newest || 'N/A'}`);
  }
  
  // 2. Evaluations
  const { data: evals } = await supabase
    .from('candidate_evaluations')
    .select('candidate_tweet_id, passed_hard_filters, predicted_tier, status, created_at');
  
  const passedEvals = evals?.filter(e => e.passed_hard_filters) || [];
  const tier3Evals = passedEvals.filter(e => e.predicted_tier <= 3);
  
  // Check evaluations for root opportunities
  const rootTweetIds = new Set(unclaimedRoots.map(o => o.target_tweet_id));
  const rootEvals = evals?.filter(e => rootTweetIds.has(e.candidate_tweet_id)) || [];
  const rootPassedEvals = rootEvals.filter(e => e.passed_hard_filters);
  const rootTier3Evals = rootPassedEvals.filter(e => e.predicted_tier <= 3);
  
  console.log(`\n2️⃣ Candidate Evaluations:`);
  console.log(`   Total: ${evals?.length || 0}`);
  console.log(`   Passed hard filters: ${passedEvals.length}`);
  console.log(`   Tier <= 3: ${tier3Evals.length}`);
  console.log(`   For root opportunities: ${rootEvals.length} total, ${rootPassedEvals.length} passed, ${rootTier3Evals.length} tier<=3`);
  
  // 3. Queue
  const { data: queue } = await supabase
    .from('reply_candidate_queue')
    .select('status, created_at, expires_at')
    .eq('status', 'queued')
    .gt('expires_at', new Date().toISOString());
  
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const queueLast30m = queue?.filter(q => q.created_at >= thirtyMinAgo).length || 0;
  
  console.log(`\n3️⃣ Reply Candidate Queue:`);
  console.log(`   Queued (not expired): ${queue?.length || 0}`);
  console.log(`   Created last 30m: ${queueLast30m}`);
  
  // 4. Decisions
  const { data: decisions } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, status, features, created_at, pipeline_source')
    .eq('decision_type', 'reply')
    .in('pipeline_source', ['reply_v2_planner', 'reply_v2_scheduler'])
    .gte('created_at', thirtyMinAgo);
  
  const queuedDecisions = decisions?.filter(d => d.status === 'queued').length || 0;
  const runtimeOk = decisions?.filter(d => {
    const f = d.features || {};
    return f.runtime_preflight_status === 'ok';
  }).length || 0;
  
  console.log(`\n4️⃣ Decisions (last 30m):`);
  console.log(`   Total: ${decisions?.length || 0}`);
  console.log(`   Queued: ${queuedDecisions}`);
  console.log(`   Runtime preflight ok: ${runtimeOk}`);
  
  // Summary
  console.log(`\n📊 Summary:`);
  if (fresh3h === 0) {
    console.log(`   ⚠️  BLOCKER: No fresh opportunities (<3h)`);
  } else if (rootTier3Evals === 0) {
    console.log(`   ⚠️  BLOCKER: No evaluations for root opportunities (passed+tier<=3)`);
  } else if (queueLast30m === 0) {
    console.log(`   ⚠️  BLOCKER: Queue refresh not populating queue`);
  } else if (decisions?.length === 0) {
    console.log(`   ⚠️  BLOCKER: Scheduler not creating decisions`);
  } else {
    console.log(`   ✅ Pipeline appears functional`);
  }
}

main().catch(console.error);
