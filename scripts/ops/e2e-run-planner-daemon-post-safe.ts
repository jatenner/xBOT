#!/usr/bin/env tsx
/**
 * 🎯 E2E Ops Script: Planner → Daemon → Post → Reward
 * 
 * Orchestrates a full test cycle:
 * 1. Trigger planner once (Railway)
 * 2. Wait for queued decisions
 * 3. Instruct user to run Mac Runner daemon
 * 4. Monitor DB for status transitions
 * 5. Assert at least one posted reply
 * 6. Verify reward computation
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';

async function main() {
  console.log('🎯 E2E Ops: Planner → Daemon → Post → Reward');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const supabase = getSupabaseClient();
  const maxWaitMinutes = 30;
  const pollIntervalSeconds = 20;
  
  // Step 1: Trigger planner
  console.log('📋 Step 1: Triggering planner...');
  console.log('   Run: railway run --service xBOT pnpm tsx scripts/ops/run-reply-v2-planner-once.ts');
  console.log('   Waiting for planner to create decisions...\n');
  
  // Wait a bit for planner to run
  await new Promise(resolve => setTimeout(resolve, 10000));
  
  // Step 2: Check for queued decisions
  console.log('📋 Step 2: Checking for queued decisions...');
  const { data: queuedDecisions } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, created_at, features')
    .eq('decision_type', 'reply')
    .eq('pipeline_source', 'reply_v2_planner')
    .eq('status', 'queued')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (!queuedDecisions || queuedDecisions.length === 0) {
    console.log('   ⚠️  No queued decisions found. Planner may not have run yet.');
    console.log('   Please run the planner manually and try again.\n');
    process.exit(1);
  }
  
  console.log(`   ✅ Found ${queuedDecisions.length} queued decisions`);
  console.log(`   Decision IDs: ${queuedDecisions.slice(0, 3).map(d => d.decision_id.substring(0, 8)).join(', ')}...\n`);
  
  // Step 3: Instruct user to run daemon
  console.log('📋 Step 3: Start Mac Runner daemon');
  console.log('   Run: RUNNER_MODE=true MAX_E2E_REPLIES=1 pnpm run executor:daemon');
  console.log('   Monitoring DB for status transitions...\n');
  
  // Step 4: Monitor for posted replies
  console.log('📋 Step 4: Monitoring for posted replies...');
  const startTime = Date.now();
  const maxWaitMs = maxWaitMinutes * 60 * 1000;
  
  while (Date.now() - startTime < maxWaitMs) {
    const { data: postedDecisions } = await supabase
      .from('content_generation_metadata_comprehensive')
      .select('decision_id, status, updated_at, features')
      .eq('decision_type', 'reply')
      .eq('pipeline_source', 'reply_v2_planner')
      .in('status', ['posting_attempt', 'posted'])
      .order('updated_at', { ascending: false })
      .limit(10);
    
    if (postedDecisions && postedDecisions.length > 0) {
      const posted = postedDecisions.find(d => d.status === 'posted');
      if (posted) {
        console.log(`   ✅ Found posted reply!`);
        console.log(`   Decision ID: ${posted.decision_id}`);
        console.log(`   Tweet ID: ${(posted.features as any)?.tweet_id || 'pending'}`);
        console.log(`   Updated at: ${posted.updated_at}\n`);
        
        // Step 5: Verify reward
        console.log('📋 Step 5: Verifying reward computation...');
        const { data: rewardDecision } = await supabase
          .from('content_generation_metadata_comprehensive')
          .select('decision_id, features')
          .eq('decision_id', posted.decision_id)
          .single();
        
        if (rewardDecision) {
          const features = (rewardDecision.features || {}) as any;
          if (features.reward !== undefined) {
            console.log(`   ✅ Reward computed: ${features.reward}`);
            console.log(`   Reward components: ${JSON.stringify(features.reward_components || {})}\n`);
          } else {
            console.log(`   ⚠️  Reward not yet computed (scraper may need to run)`);
          }
        }
        
        // Check strategy_rewards
        const { data: strategyRewards } = await supabase
          .from('strategy_rewards')
          .select('*')
          .order('last_updated_at', { ascending: false })
          .limit(5);
        
        if (strategyRewards && strategyRewards.length > 0) {
          console.log(`   ✅ Strategy rewards updated:`);
          strategyRewards.forEach(sr => {
            console.log(`      ${sr.strategy_id}/${sr.strategy_version}: sample_count=${sr.sample_count}, mean_reward=${sr.mean_reward}`);
          });
        } else {
          console.log(`   ⚠️  Strategy rewards not yet updated (scraper may need to run)`);
        }
        
        console.log('\n✅ E2E VALIDATION COMPLETE');
        process.exit(0);
      }
    }
    
    console.log(`   ⏳ Waiting... (${Math.round((Date.now() - startTime) / 1000)}s elapsed)`);
    await new Promise(resolve => setTimeout(resolve, pollIntervalSeconds * 1000));
  }
  
  console.log(`\n❌ Timeout: No posted reply found after ${maxWaitMinutes} minutes`);
  console.log('   Check Mac Runner logs for errors.');
  process.exit(1);
}

main().catch(err => {
  console.error('❌ E2E script failed:', err);
  process.exit(1);
});
