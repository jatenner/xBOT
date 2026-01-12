#!/usr/bin/env tsx
/**
 * Find tweet IDs for validation (root, depth1, depth2)
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db';

async function findValidationIds() {
  const supabase = getSupabaseClient();
  
  // Try to find IDs from recent decisions
  const { data } = await supabase
    .from('reply_decisions')
    .select('target_tweet_id, ancestry_depth, is_root, status, method')
    .order('created_at', { ascending: false })
    .limit(100);
  
  const root = data?.find(r => r.ancestry_depth === 0 && r.is_root && r.status === 'OK' && r.method !== 'unknown');
  const depth1 = data?.find(r => r.ancestry_depth === 1 && r.status === 'OK');
  const depth2 = data?.find(r => r.ancestry_depth === 2 && r.status === 'OK');
  
  console.log('\n📊 Validation Tweet IDs Found:\n');
  
  if (root) {
    console.log(`✅ Root (depth=0): ${root.target_tweet_id}`);
  } else {
    console.log('❌ Root: Not found');
  }
  
  if (depth1) {
    console.log(`✅ Depth1 (depth=1): ${depth1.target_tweet_id}`);
  } else {
    console.log('❌ Depth1: Not found');
  }
  
  if (depth2) {
    console.log(`✅ Depth2 (depth=2): ${depth2.target_tweet_id}`);
  } else {
    console.log('❌ Depth2: Not found');
  }
  
  if (root && depth1 && depth2) {
    console.log(`\n✅ All IDs found! Run:`);
    console.log(`   pnpm run validate:fail-closed -- ${root.target_tweet_id} ${depth1.target_tweet_id} ${depth2.target_tweet_id}`);
  } else {
    console.log(`\n⚠️  Need all 3 IDs for validation. Using any available IDs:`);
    if (root) console.log(`   Root: ${root.target_tweet_id}`);
    // For depth1/depth2, we can use any tweet IDs and let the resolver classify them
    console.log(`\n   Note: If depth1/depth2 not found, you can use any reply tweet IDs`);
    console.log(`   and the resolver will classify them correctly.`);
  }
}

findValidationIds().catch((error) => {
  console.error('❌ Failed:', error);
  process.exit(1);
});
