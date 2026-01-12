#!/usr/bin/env tsx
/**
 * Test cache hit by running inspect:tweet twice on same ID
 */

import 'dotenv/config';
import { resolveTweetAncestry } from '../src/jobs/replySystemV2/replyDecisionRecorder';
import { getSupabaseClient } from '../src/db';

async function testCacheHit() {
  // Use a real tweet ID (you can replace with any valid tweet ID)
  const testTweetId = process.argv[2];
  
  if (!testTweetId) {
    console.error('❌ Usage: pnpm exec tsx scripts/test-cache-hit.ts <tweet_id>');
    console.error('   Example: pnpm exec tsx scripts/test-cache-hit.ts 1234567890');
    process.exit(1);
  }
  
  console.log(`\n🔍 Testing cache hit for tweet ID: ${testTweetId}\n`);
  console.log('═'.repeat(80));
  
  // First run (should be cache miss)
  console.log('\n📊 FIRST RUN (should be cache MISS):');
  console.log('-'.repeat(80));
  const start1 = Date.now();
  const ancestry1 = await resolveTweetAncestry(testTweetId);
  const duration1 = Date.now() - start1;
  
  console.log(`  Status: ${ancestry1.status}`);
  console.log(`  Method: ${ancestry1.method}`);
  console.log(`  Cache Hit: ${ancestry1.cache_hit ? '✅ YES' : '❌ NO'}`);
  console.log(`  Duration: ${duration1}ms`);
  console.log(`  Root Tweet ID: ${ancestry1.rootTweetId || 'null'}`);
  console.log(`  Depth: ${ancestry1.ancestryDepth ?? 'null'}`);
  
  // Wait a moment
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Second run (should be cache hit)
  console.log('\n📊 SECOND RUN (should be cache HIT):');
  console.log('-'.repeat(80));
  const start2 = Date.now();
  const ancestry2 = await resolveTweetAncestry(testTweetId);
  const duration2 = Date.now() - start2;
  
  console.log(`  Status: ${ancestry2.status}`);
  console.log(`  Method: ${ancestry2.method}`);
  console.log(`  Cache Hit: ${ancestry2.cache_hit ? '✅ YES' : '❌ NO'}`);
  console.log(`  Duration: ${duration2}ms`);
  console.log(`  Root Tweet ID: ${ancestry2.rootTweetId || 'null'}`);
  console.log(`  Depth: ${ancestry2.ancestryDepth ?? 'null'}`);
  
  // Verify cache hit
  if (!ancestry2.cache_hit) {
    console.log('\n❌ FAILED: Second run did not show cache_hit=true');
    process.exit(1);
  }
  
  if (duration2 >= duration1) {
    console.log(`\n⚠️  WARNING: Second run (${duration2}ms) was not faster than first (${duration1}ms)`);
  } else {
    console.log(`\n✅ Cache hit was faster: ${duration1}ms → ${duration2}ms (${Math.round((1 - duration2/duration1) * 100)}% faster)`);
  }
  
  // Check cache table
  console.log('\n📊 Cache table verification:');
  console.log('-'.repeat(80));
  const supabase = getSupabaseClient();
  const { data: cacheRows, error } = await supabase
    .from('reply_ancestry_cache')
    .select('*')
    .eq('tweet_id', testTweetId)
    .maybeSingle();
  
  if (error && error.code !== '42P01') {
    console.error(`  ❌ Error querying cache: ${error.message}`);
  } else if (cacheRows) {
    console.log(`  ✅ Cache entry found:`);
    console.log(`     Tweet ID: ${cacheRows.tweet_id}`);
    console.log(`     Status: ${cacheRows.status}`);
    console.log(`     Method: ${cacheRows.method}`);
    console.log(`     Depth: ${cacheRows.depth ?? 'null'}`);
    console.log(`     Updated: ${cacheRows.updated_at}`);
  } else {
    console.log(`  ⚠️  No cache entry found in reply_ancestry_cache table`);
  }
  
  console.log('\n✅ Cache test complete\n');
}

testCacheHit().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
