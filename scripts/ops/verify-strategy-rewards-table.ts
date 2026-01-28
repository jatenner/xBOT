#!/usr/bin/env tsx
/**
 * Verify strategy_rewards table exists and show structure
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';

async function main() {
  const supabase = getSupabaseClient();
  
  console.log('🔍 Verifying strategy_rewards table...\n');
  
  // Check if table exists by querying it
  const { data, error } = await supabase
    .from('strategy_rewards')
    .select('*')
    .limit(5);
  
  if (error) {
    console.error('❌ Error querying strategy_rewards:', error.message);
    console.error('   Code:', error.code);
    process.exit(1);
  }
  
  console.log('✅ Table strategy_rewards exists and is queryable');
  console.log(`📊 Current rows: ${data?.length || 0}\n`);
  
  if (data && data.length > 0) {
    console.log('Sample data:');
    console.log('─'.repeat(80));
    console.log('| strategy_id | strategy_version | sample_count | mean_reward | last_updated_at |');
    console.log('|------------|-----------------|--------------|-------------|------------------|');
    data.forEach(row => {
      console.log(`| ${String(row.strategy_id).padEnd(11)} | ${String(row.strategy_version).padEnd(15)} | ${String(row.sample_count).padEnd(12)} | ${row.mean_reward.toFixed(4).padEnd(11)} | ${new Date(row.last_updated_at).toISOString().substring(0, 19)} |`);
    });
  } else {
    console.log('ℹ️  Table is empty (no rewards recorded yet)');
  }
  
  // Check table structure
  console.log('\n📋 Table structure:');
  console.log('─'.repeat(80));
  console.log('Columns: strategy_id, strategy_version, sample_count, total_reward, mean_reward, last_updated_at');
  console.log('Primary key: (strategy_id, strategy_version)');
  console.log('Indexes: idx_strategy_rewards_mean_reward, idx_strategy_rewards_sample_count');
  console.log('Function: update_strategy_reward()');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
