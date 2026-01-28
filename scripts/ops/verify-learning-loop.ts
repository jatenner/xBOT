#!/usr/bin/env tsx
/**
 * Verify learning loop is functioning end-to-end
 * - Check strategy attribution on recent decisions
 * - Verify rewards are computed
 * - Verify strategy_rewards table updates
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';

async function main() {
  const supabase = getSupabaseClient();
  
  console.log('🔍 Verifying Learning Loop End-to-End\n');
  console.log('═'.repeat(80));
  
  // Check decisions from last 2 hours (to catch any that might have been created)
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  
  // STEP 3: Verify new decisions have strategy attribution
  console.log('\n📊 STEP 3: Recent Decisions with Strategy Attribution');
  console.log('─'.repeat(80));
  
  const { data: recentDecisions, error: decisionsError } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, features, created_at, actual_impressions, actual_likes, actual_replies, actual_retweets')
    .eq('decision_type', 'reply')
    .gte('created_at', twoHoursAgo)
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (decisionsError) {
    console.error('❌ Error querying decisions:', decisionsError.message);
    process.exit(1);
  }
  
  if (!recentDecisions || recentDecisions.length === 0) {
    console.log('⚠️  No reply decisions created in last 2 hours');
    console.log(`   Check window: ${twoHoursAgo} to now`);
    console.log('   Waiting for next reply generation cycle...');
    process.exit(0);
  }
  
  console.log(`✅ Found ${recentDecisions.length} recent reply decisions\n`);
  
  const validStrategies = ['insight_punch', 'actionable_checklist', 'myth_correction', 'question_hook'];
  const decisionsWithStrategy: any[] = [];
  const decisionsWithReward: any[] = [];
  
  console.log('| decision_id | created_at | strategy_id | strategy_version | selection_mode | topic_fit | targeting_score_total |');
  console.log('|------------|------------|------------|-----------------|----------------|-----------|----------------------|');
  
  recentDecisions.forEach(decision => {
    const features = decision.features as any || {};
    const strategyId = features.strategy_id || 'unknown';
    const strategyVersion = features.strategy_version || 'unknown';
    const selectionMode = features.selection_mode || 'unknown';
    const topicFit = features.topic_fit || features.reply_targeting_components?.topic_fit || 'N/A';
    const targetingScore = features.reply_targeting_score || features.targeting_score_total || 'N/A';
    const reward = features.reward;
    
    const decisionIdShort = decision.decision_id.substring(0, 8) + '...';
    const createdAt = new Date(decision.created_at).toISOString().substring(0, 19);
    
    console.log(`| ${decisionIdShort.padEnd(10)} | ${createdAt} | ${String(strategyId).padEnd(11)} | ${String(strategyVersion).padEnd(15)} | ${String(selectionMode).padEnd(14)} | ${String(topicFit).padEnd(9)} | ${String(targetingScore).padEnd(20)} |`);
    
    if (validStrategies.includes(strategyId)) {
      decisionsWithStrategy.push({
        decision_id: decision.decision_id,
        strategy_id: strategyId,
        selection_mode: selectionMode,
        created_at: decision.created_at,
        reward: reward,
      });
    }
    
    if (reward !== undefined && reward !== null && typeof reward === 'number') {
      decisionsWithReward.push({
        decision_id: decision.decision_id,
        strategy_id: strategyId,
        reward: reward,
        impressions: decision.actual_impressions,
        likes: decision.actual_likes,
      });
    }
  });
  
  console.log(`\n✅ Decisions with valid strategy attribution: ${decisionsWithStrategy.length}/${recentDecisions.length}`);
  console.log(`✅ Decisions with reward computed: ${decisionsWithReward.length}/${recentDecisions.length}`);
  
  // STEP 4: Show decisions with reward
  if (decisionsWithReward.length > 0) {
    console.log('\n📊 STEP 4: Decisions with Reward Populated');
    console.log('─'.repeat(80));
    console.log('| decision_id | strategy_id | reward | impressions | likes |');
    console.log('|------------|------------|--------|-------------|-------|');
    decisionsWithReward.slice(0, 5).forEach(d => {
      const decisionIdShort = d.decision_id.substring(0, 8) + '...';
      console.log(`| ${decisionIdShort.padEnd(10)} | ${String(d.strategy_id).padEnd(11)} | ${d.reward.toFixed(3).padEnd(6)} | ${String(d.impressions || 'N/A').padEnd(11)} | ${String(d.likes || 'N/A').padEnd(5)} |`);
    });
  } else {
    console.log('\n⚠️  STEP 4: No decisions with reward yet');
    console.log('   Waiting for metrics scraper to run...');
  }
  
  // STEP 5: Verify strategy_rewards updates
  console.log('\n📊 STEP 5: Strategy Rewards Table Snapshot');
  console.log('─'.repeat(80));
  
  const { data: strategyRewards, error: rewardsError } = await supabase
    .from('strategy_rewards')
    .select('*')
    .order('last_updated_at', { ascending: false })
    .limit(10);
  
  if (rewardsError) {
    console.error('❌ Error querying strategy_rewards:', rewardsError.message);
  } else if (!strategyRewards || strategyRewards.length === 0) {
    console.log('⚠️  No strategy rewards recorded yet');
    console.log('   Waiting for reward computation and strategy_rewards updates...');
  } else {
    console.log('| strategy_id | strategy_version | sample_count | total_reward | mean_reward | last_updated_at |');
    console.log('|------------|-----------------|--------------|--------------|-------------|------------------|');
    strategyRewards.forEach(sr => {
      const updatedAt = new Date(sr.last_updated_at).toISOString().substring(0, 19);
      console.log(`| ${String(sr.strategy_id).padEnd(11)} | ${String(sr.strategy_version).padEnd(15)} | ${String(sr.sample_count).padEnd(12)} | ${sr.total_reward.toFixed(4).padEnd(12)} | ${sr.mean_reward.toFixed(4).padEnd(11)} | ${updatedAt} |`);
    });
  }
  
  // Summary
  console.log('\n' + '═'.repeat(80));
  console.log('📋 VERIFICATION SUMMARY');
  console.log('─'.repeat(80));
  
  const hasStrategyAttribution = decisionsWithStrategy.length > 0;
  const hasRewards = decisionsWithReward.length > 0;
  const hasStrategyRewards = strategyRewards && strategyRewards.length > 0 && strategyRewards.some(sr => sr.sample_count >= 1);
  
  console.log(`Strategy Attribution: ${hasStrategyAttribution ? '✅' : '❌'} (${decisionsWithStrategy.length} decisions)`);
  console.log(`Reward Computation: ${hasRewards ? '✅' : '⏳'} (${decisionsWithReward.length} decisions)`);
  console.log(`Strategy Rewards Updates: ${hasStrategyRewards ? '✅' : '⏳'} (${strategyRewards?.length || 0} strategies)`);
  
  if (hasStrategyAttribution && hasRewards && hasStrategyRewards) {
    console.log('\n🎉 LEARNING LOOP IS FUNCTIONING END-TO-END!');
  } else {
    console.log('\n⚠️  Learning loop not yet complete:');
    if (!hasStrategyAttribution) {
      console.log('   - No strategy attribution found (waiting for reply generation cycle)');
    }
    if (!hasRewards) {
      console.log('   - Rewards not computed yet (waiting for metrics scraper)');
    }
    if (!hasStrategyRewards) {
      console.log('   - strategy_rewards table not updating (waiting for reward writes)');
    }
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
