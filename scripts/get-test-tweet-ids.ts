#!/usr/bin/env tsx
/**
 * Get test tweet IDs from recent decisions
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db';

async function getTestTweetIds() {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('reply_decisions')
    .select('target_tweet_id, ancestry_depth, is_root, status, method')
    .order('created_at', { ascending: false })
    .limit(30);
  
  if (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
  
  console.log('\n📊 Recent decisions (candidates for validation):\n');
  
  const rootCandidates: string[] = [];
  const depth1Candidates: string[] = [];
  const depth2Candidates: string[] = [];
  
  data?.forEach((r) => {
    if (r.ancestry_depth === 0 && r.is_root && r.status === 'OK' && r.method !== 'unknown') {
      rootCandidates.push(r.target_tweet_id);
    } else if (r.ancestry_depth === 1 && r.status === 'OK') {
      depth1Candidates.push(r.target_tweet_id);
    } else if (r.ancestry_depth === 2 && r.status === 'OK') {
      depth2Candidates.push(r.target_tweet_id);
    }
  });
  
  console.log(`ROOT candidates (depth=0, is_root=true, status=OK): ${rootCandidates.length}`);
  rootCandidates.slice(0, 5).forEach((id, i) => console.log(`  [${i+1}] ${id}`));
  
  console.log(`\nDEPTH1 candidates (depth=1, status=OK): ${depth1Candidates.length}`);
  depth1Candidates.slice(0, 5).forEach((id, i) => console.log(`  [${i+1}] ${id}`));
  
  console.log(`\nDEPTH2 candidates (depth=2, status=OK): ${depth2Candidates.length}`);
  depth2Candidates.slice(0, 5).forEach((id, i) => console.log(`  [${i+1}] ${id}`));
  
  if (rootCandidates.length > 0 && depth1Candidates.length > 0 && depth2Candidates.length > 0) {
    console.log(`\n✅ Recommended test IDs:`);
    console.log(`  Root: ${rootCandidates[0]}`);
    console.log(`  Depth1: ${depth1Candidates[0]}`);
    console.log(`  Depth2: ${depth2Candidates[0]}`);
    console.log(`\nCommand:`);
    console.log(`  pnpm run validate:fail-closed -- ${rootCandidates[0]} ${depth1Candidates[0]} ${depth2Candidates[0]}`);
  } else {
    console.log(`\n⚠️  Need at least one of each type for full validation`);
  }
  
  // Also show any recent tweet ID for cache testing
  if (data && data.length > 0) {
    console.log(`\n📝 For cache testing (any recent ID):`);
    console.log(`  ${data[0].target_tweet_id}`);
    console.log(`\nCommand:`);
    console.log(`  pnpm exec tsx scripts/test-cache-hit.ts ${data[0].target_tweet_id}`);
  }
}

getTestTweetIds().catch((error) => {
  console.error('❌ Failed:', error);
  process.exit(1);
});
