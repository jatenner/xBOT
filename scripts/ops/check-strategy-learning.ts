#!/usr/bin/env tsx
/**
 * Check strategy learning signals in production
 * - Query strategy_rewards table
 * - Check recent decisions for strategy attribution
 * - Verify reward computation
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';

async function main() {
  const supabase = getSupabaseClient();
  
  console.log('🔍 Checking Strategy Learning Signals\n');
  console.log('═'.repeat(60));
  
  // 1. Check strategy_rewards table
  console.log('\n📊 Strategy Rewards Table:');
  console.log('─'.repeat(60));
  
  const { data: strategyRewards, error: rewardsError } = await supabase
    .from('strategy_rewards')
    .select('*')
    .order('mean_reward', { ascending: false });
  
  if (rewardsError) {
    console.error('❌ Error querying strategy_rewards:', rewardsError.message);
  } else if (!strategyRewards || strategyRewards.length === 0) {
    console.log('⚠️  No strategy rewards found yet (system may be warming up)');
  } else {
    console.log(`✅ Found ${strategyRewards.length} strategy reward entries:\n`);
    console.log('| strategy_id | strategy_version | sample_count | mean_reward | last_updated_at |');
    console.log('|------------|-----------------|--------------|-------------|------------------|');
    strategyRewards.forEach(sr => {
      console.log(`| ${sr.strategy_id.padEnd(11)} | ${String(sr.strategy_version).padEnd(15)} | ${String(sr.sample_count).padEnd(12)} | ${sr.mean_reward.toFixed(4).padEnd(11)} | ${new Date(sr.last_updated_at).toISOString().substring(0, 19)} |`);
    });
  }
  
  // 2. Check recent decisions for strategy attribution
  console.log('\n\n🎯 Recent Decisions with Strategy Attribution:');
  console.log('─'.repeat(60));
  
  const strategyCounts: Record<string, number> = {};
  const selectionModeCounts: Record<string, number> = {};
  const decisionsWithReward: any[] = [];
  
  const { data: recentDecisions, error: decisionsError } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, features, created_at, actual_impressions, actual_likes, actual_replies, actual_retweets')
    .eq('decision_type', 'reply')
    .order('created_at', { ascending: false })
    .limit(20);
  
  if (decisionsError) {
    console.error('❌ Error querying content_metadata:', decisionsError.message);
  } else if (!recentDecisions || recentDecisions.length === 0) {
    console.log('⚠️  No recent reply decisions found');
  } else {
    console.log(`✅ Found ${recentDecisions.length} recent reply decisions:\n`);
    
    recentDecisions.forEach(decision => {
      const features = decision.features as any || {};
      const strategyId = features.strategy_id || 'unknown';
      const selectionMode = features.selection_mode || 'unknown';
      const reward = features.reward;
      
      strategyCounts[strategyId] = (strategyCounts[strategyId] || 0) + 1;
      selectionModeCounts[selectionMode] = (selectionModeCounts[selectionMode] || 0) + 1;
      
      if (reward !== undefined && reward !== null) {
        decisionsWithReward.push({
          decision_id: decision.decision_id,
          strategy_id: strategyId,
          selection_mode: selectionMode,
          reward: reward,
          impressions: decision.actual_impressions,
          likes: decision.actual_likes,
        });
      }
    });
    
    console.log('Strategy Distribution:');
    Object.entries(strategyCounts).forEach(([strategy, count]) => {
      console.log(`  ${strategy}: ${count}`);
    });
    
    console.log('\nSelection Mode Distribution:');
    Object.entries(selectionModeCounts).forEach(([mode, count]) => {
      console.log(`  ${mode}: ${count}`);
    });
    
    console.log(`\n✅ Decisions with reward computed: ${decisionsWithReward.length}/${recentDecisions.length}`);
    
    if (decisionsWithReward.length > 0) {
      console.log('\nSample decisions with rewards:');
      decisionsWithReward.slice(0, 5).forEach(d => {
        console.log(`  ${d.decision_id.substring(0, 8)}... | strategy=${d.strategy_id} | mode=${d.selection_mode} | reward=${d.reward?.toFixed(3) || 'N/A'} | impressions=${d.impressions || 'N/A'}`);
      });
    }
    
    // 3. Check for any strategies never selected
    console.log('\n\n⚠️  Strategy Coverage Check:');
    console.log('─'.repeat(60));
    
    const allStrategies = ['insight_punch', 'actionable_checklist', 'myth_correction', 'question_hook'];
    const selectedStrategies = Object.keys(strategyCounts);
    const unselectedStrategies = allStrategies.filter(s => !selectedStrategies.includes(s));
    
    if (unselectedStrategies.length > 0) {
      console.log(`⚠️  Strategies never selected: ${unselectedStrategies.join(', ')}`);
    } else if (selectedStrategies.length > 0) {
      console.log('✅ All strategies have been selected at least once');
    } else {
      console.log('⚠️  No strategy attribution found in recent decisions');
    }
  }
  
  console.log('\n' + '═'.repeat(60));
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
