/**
 * Test script to verify seed_account_stats table exists and weighted sampling works
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';
import { pickSeedsWeighted } from '../src/utils/seedSampling';

async function test() {
  const supabase = getSupabaseClient();
  
  // Test 1: Verify table exists
  console.log('Test 1: Verifying seed_account_stats table exists...');
  const { data, error } = await supabase
    .from('seed_account_stats')
    .select('handle')
    .limit(1);
  
  if (error) {
    if (error.code === '42P01') {
      console.log('❌ Table does not exist:', error.message);
      process.exit(1);
    }
    console.log('❌ Error querying table:', error.message);
    process.exit(1);
  }
  
  console.log('✅ Table exists and is queryable');
  
  // Test 2: Check columns
  console.log('\nTest 2: Checking columns...');
  const { data: sampleRow } = await supabase
    .from('seed_account_stats')
    .select('*')
    .limit(1);
  
  if (sampleRow && sampleRow.length > 0) {
    const columns = Object.keys(sampleRow[0]);
    console.log('✅ Columns found:', columns.join(', '));
    
    const requiredColumns = ['tier1_pass', 'tier2_pass', 'tier3_pass', 'disallowed_count'];
    const missingColumns = requiredColumns.filter(col => !columns.includes(col));
    if (missingColumns.length > 0) {
      console.log('⚠️  Missing columns:', missingColumns.join(', '));
    } else {
      console.log('✅ All required tier columns present');
    }
  } else {
    console.log('ℹ️  Table is empty (no rows yet)');
  }
  
  // Test 3: Test weighted sampling
  console.log('\nTest 3: Testing weighted seed sampling...');
  const testSeeds = ['hubermanlab', 'foundmyfitness', 'bengreenfield', 'jeff_nippard', 'drandygalpin'];
  try {
    const result = await pickSeedsWeighted(testSeeds, 3);
    console.log('✅ Weighted sampling works');
    console.log(`   Selected ${result.seeds.length} seeds: ${result.seeds.join(', ')}`);
    console.log('   Weights:');
    result.weights.forEach(w => {
      console.log(`     @${w.handle}: ${w.weight.toFixed(2)} (${w.reason})`);
    });
  } catch (err: any) {
    console.log('❌ Weighted sampling failed:', err.message);
    process.exit(1);
  }
  
  console.log('\n✅ All tests passed!');
  process.exit(0);
}

test().catch(console.error);

