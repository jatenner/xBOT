#!/usr/bin/env tsx
/**
 * Prove ROOT_EVAL Pipeline End-to-End
 * 
 * Runs ROOT_EVAL bridge → checks evaluations → checks queue → runs scheduler → checks executor
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';
import { refreshCandidateQueue } from '../../src/jobs/replySystemV2/queueManager';

async function main() {
  const supabase = getSupabaseClient();
  
  console.log('🔍 ROOT_EVAL Pipeline Proof');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Step 1: Check root opportunities
  const { data: rootOpps } = await supabase
    .from('reply_opportunities')
    .select('target_tweet_id, created_at, tweet_posted_at')
    .eq('replied_to', false)
    .or('is_root_tweet.eq.true,target_in_reply_to_tweet_id.is.null')
    .order('created_at', { ascending: false })
    .limit(10);
  
  console.log(`1️⃣ Root opportunities: ${rootOpps?.length || 0}`);
  if (rootOpps && rootOpps.length > 0) {
    const newest = rootOpps[0];
    const ageMin = Math.round((Date.now() - new Date(newest.created_at).getTime()) / 1000 / 60);
    console.log(`   Newest: ${ageMin}m ago (created_at=${newest.created_at})`);
  }
  
  // Step 2: Run ROOT_EVAL bridge
  console.log(`\n2️⃣ Running ROOT_EVAL bridge...`);
  const bridgeResult = await refreshCandidateQueue();
  const evalCount = bridgeResult?.evaluated ?? 0;
  const queuedCount = bridgeResult?.queued ?? 0;
  const expiredCount = bridgeResult?.expired ?? 0;
  console.log(`   Result: evaluated=${evalCount} queued=${queuedCount} expired=${expiredCount}`);
  
  // Step 3: Check root evaluations
  const rootTweetIds = rootOpps?.map(o => o.target_tweet_id) || [];
  const { count: rootEvals } = await supabase
    .from('candidate_evaluations')
    .select('*', { count: 'exact', head: true })
    .in('candidate_tweet_id', rootTweetIds.length > 0 ? rootTweetIds : ['']);
  
  console.log(`\n3️⃣ Root evaluations: ${rootEvals || 0}`);
  
  // Step 4: Check queue
  const { count: queueCount } = await supabase
    .from('reply_candidate_queue')
    .select('*', { count: 'exact', head: true })
    .gt('expires_at', new Date().toISOString());
  
  console.log(`4️⃣ Queue rows: ${queueCount || 0}`);
  
  // Step 5: Check recent decisions
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: decisions } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('*', { count: 'exact', head: true })
    .eq('decision_type', 'reply')
    .in('pipeline_source', ['reply_v2_planner', 'reply_v2_scheduler'])
    .gte('created_at', oneHourAgo);
  
  console.log(`5️⃣ Decisions (last 60m): ${decisions || 0}`);
  
  // Step 6: Check executor claims
  const { data: recentDecisions } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, status, runtime_preflight_status, posted_at, target_tweet_url')
    .eq('decision_type', 'reply')
    .in('pipeline_source', ['reply_v2_planner', 'reply_v2_scheduler'])
    .gte('created_at', oneHourAgo)
    .order('created_at', { ascending: false })
    .limit(5);
  
  console.log(`\n6️⃣ Recent decisions:`);
  if (recentDecisions && recentDecisions.length > 0) {
    recentDecisions.forEach((d, i) => {
      console.log(`   ${i + 1}. ${d.decision_id?.substring(0, 8)}... status=${d.status} preflight=${d.runtime_preflight_status} posted=${d.posted_at ? 'yes' : 'no'}`);
      if (d.posted_at && d.target_tweet_url) {
        console.log(`      URL: ${d.target_tweet_url}`);
      }
    });
  } else {
    console.log(`   None`);
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`   Root opportunities: ${rootOpps?.length || 0}`);
  console.log(`   Root evaluations: ${rootEvals || 0}`);
  console.log(`   Queue rows: ${queueCount || 0}`);
  console.log(`   Decisions (60m): ${decisions || 0}`);
  
  if (rootEvals && rootEvals > 0 && queueCount && queueCount >= 5) {
    console.log(`\n✅ SUCCESS: Pipeline is populated!`);
  } else {
    console.log(`\n⚠️  BLOCKER: ${rootEvals === 0 ? 'No root evaluations' : queueCount === 0 ? 'No queue rows' : 'Unknown'}`);
  }
}

main().catch(console.error);
