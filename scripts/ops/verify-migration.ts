#!/usr/bin/env tsx
/**
 * Verify rate controller migration applied
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';

async function main() {
  const supabase = getSupabaseClient();
  
  console.log('🔍 Verifying rate controller migration...\n');

  // Check tables
  const requiredTables = [
    'bot_backoff_state',
    'bot_run_counters',
    'rate_controller_state',
    'strategy_weights',
    'hour_weights',
    'prompt_version_weights',
  ];

  console.log('📊 Checking tables:');
  for (const table of requiredTables) {
    const { error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`  ❌ ${table}: ${error.message}`);
    } else {
      console.log(`  ✅ ${table}: exists`);
    }
  }

  // Check columns
  console.log('\n📊 Checking content_metadata columns:');
  const requiredColumns = ['prompt_version', 'strategy_id', 'hour_bucket', 'outcome_score'];
  for (const column of requiredColumns) {
    const { error } = await supabase.from('content_metadata').select(column).limit(1);
    if (error) {
      console.log(`  ❌ ${column}: ${error.message}`);
    } else {
      console.log(`  ✅ ${column}: exists`);
    }
  }

  // Check RPC function
  console.log('\n📊 Checking RPC function:');
  const { error: rpcError } = await supabase.rpc('increment_budget_counter', {
    p_date: new Date().toISOString().split('T')[0],
    p_nav_amount: 0,
    p_search_amount: 0,
  });
  if (rpcError) {
    console.log(`  ❌ increment_budget_counter: ${rpcError.message}`);
  } else {
    console.log(`  ✅ increment_budget_counter: exists`);
  }

  console.log('\n✅ Verification complete');
}

main().catch(console.error);
