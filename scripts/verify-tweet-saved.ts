/**
 * 🔍 VERIFY TWEET SAVED
 * 
 * Verifies that a tweet ID exists in content_generation_metadata_comprehensive
 * and confirms all scrape-ready fields are present.
 * 
 * Usage: npx tsx scripts/verify-tweet-saved.ts <tweet_id>
 */

import { getSupabaseClient } from '../src/db/index';

const tweetId = process.argv[2];

if (!tweetId) {
  console.error('❌ Usage: npx tsx scripts/verify-tweet-saved.ts <tweet_id>');
  process.exit(1);
}

async function main() {
  const supabase = getSupabaseClient();
  
  console.log(`[VERIFY] 🔍 Searching for tweet_id: ${tweetId}`);
  
  const { data, error } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('*')
    .eq('tweet_id', tweetId)
    .single();
  
  if (error || !data) {
    console.error(`❌ Tweet not found in database`);
    console.error(`   Error: ${error?.message || 'No data'}`);
    process.exit(1);
  }
  
  console.log(`\n✅ Tweet found!`);
  console.log(`   decision_id: ${data.decision_id}`);
  console.log(`   decision_type: ${data.decision_type}`);
  console.log(`   status: ${data.status}`);
  console.log(`   posted_at: ${data.posted_at || 'NULL'}`);
  console.log(`   pipeline_source: ${data.pipeline_source || 'NULL'}`);
  console.log(`   build_sha: ${data.build_sha || 'NULL'}`);
  console.log(`   job_run_id: ${data.job_run_id || 'NULL'}`);
  
  if (data.decision_type === 'reply') {
    console.log(`\n📊 Reply-specific fields:`);
    console.log(`   target_tweet_id: ${data.target_tweet_id || 'NULL'}`);
    console.log(`   root_tweet_id: ${data.root_tweet_id || 'NULL'}`);
    console.log(`   target_tweet_content_snapshot: ${data.target_tweet_content_snapshot ? `"${data.target_tweet_content_snapshot.substring(0, 60)}..." (${data.target_tweet_content_snapshot.length} chars)` : 'NULL'}`);
    console.log(`   target_tweet_content_hash: ${data.target_tweet_content_hash || 'NULL'}`);
    console.log(`   semantic_similarity: ${data.semantic_similarity || 'NULL'}`);
    
    // Check scrape readiness
    const checks = {
      'Snapshot present': Boolean(data.target_tweet_content_snapshot),
      'Snapshot >= 40 chars': (data.target_tweet_content_snapshot?.length || 0) >= 40,
      'Root == Target (ROOT-ONLY)': data.root_tweet_id === data.target_tweet_id,
      'Semantic >= 0.25': (data.semantic_similarity || 0) >= 0.25,
      'Pipeline source present': Boolean(data.pipeline_source),
      'Build SHA present': Boolean(data.build_sha),
    };
    
    console.log(`\n🔬 Scrape-Ready Checks:`);
    let allPass = true;
    for (const [check, pass] of Object.entries(checks)) {
      console.log(`   ${pass ? '✅' : '❌'} ${check}`);
      if (!pass) allPass = false;
    }
    
    if (allPass) {
      console.log(`\n✅ Tweet is SCRAPE-READY!`);
    } else {
      console.log(`\n⚠️ Tweet has missing/invalid fields`);
      process.exit(1);
    }
  }
  
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Script error:', err.message);
  process.exit(1);
});
