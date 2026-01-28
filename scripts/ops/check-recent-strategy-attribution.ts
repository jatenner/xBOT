#!/usr/bin/env tsx
/**
 * Check recent decisions for strategy attribution
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';

async function main() {
  const supabase = getSupabaseClient();
  
  console.log('🔍 Checking recent decisions for strategy attribution...\n');
  
  // Get migration time (approximate - when we just applied it)
  const migrationTime = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 minutes ago
  
  const { data: recentDecisions, error } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, features, created_at, actual_impressions, actual_likes')
    .eq('decision_type', 'reply')
    .gte('created_at', migrationTime)
    .order('created_at', { ascending: false })
    .limit(20);
  
  if (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
  
  if (!recentDecisions || recentDecisions.length === 0) {
    console.log('⚠️  No reply decisions created after migration time');
    console.log(`   Migration time: ${migrationTime}`);
    console.log('   Waiting for next reply generation cycle...');
    process.exit(0);
  }
  
  console.log(`✅ Found ${recentDecisions.length} recent reply decisions\n`);
  
  const validStrategies = ['insight_punch', 'actionable_checklist', 'myth_correction', 'question_hook'];
  const strategyCounts: Record<string, number> = {};
  const selectionModeCounts: Record<string, number> = {};
  const sampleDecisions: any[] = [];
  
  recentDecisions.forEach(decision => {
    const features = decision.features as any || {};
    const strategyId = features.strategy_id || 'unknown';
    const selectionMode = features.selection_mode || 'unknown';
    
    strategyCounts[strategyId] = (strategyCounts[strategyId] || 0) + 1;
    selectionModeCounts[selectionMode] = (selectionModeCounts[selectionMode] || 0) + 1;
    
    if (validStrategies.includes(strategyId)) {
      sampleDecisions.push({
        decision_id: decision.decision_id.substring(0, 8) + '...',
        strategy_id: strategyId,
        selection_mode: selectionMode,
        created_at: decision.created_at,
      });
    }
  });
  
  console.log('Strategy Distribution:');
  Object.entries(strategyCounts).forEach(([strategy, count]) => {
    const isValid = validStrategies.includes(strategy);
    console.log(`  ${isValid ? '✅' : '⚠️ '} ${strategy}: ${count}`);
  });
  
  console.log('\nSelection Mode Distribution:');
  Object.entries(selectionModeCounts).forEach(([mode, count]) => {
    console.log(`  ${mode}: ${count}`);
  });
  
  if (sampleDecisions.length > 0) {
    console.log('\n✅ Sample decisions with valid strategy attribution:');
    console.log('─'.repeat(80));
    sampleDecisions.slice(0, 5).forEach(d => {
      console.log(`  ${d.decision_id} | strategy=${d.strategy_id} | mode=${d.selection_mode} | created=${d.created_at.substring(0, 19)}`);
    });
  } else {
    console.log('\n⚠️  No decisions found with valid strategy attribution');
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
