/**
 * Validate that new reply decisions include required gate data
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

const minutesArg = process.argv.find(arg => arg.startsWith('--minutes='))?.replace('--minutes=', '') || process.argv[2] || '60';
const minutes = parseInt(minutesArg, 10);

async function main() {
  const supabase = getSupabaseClient();
  const cutoffTime = new Date(Date.now() - minutes * 60 * 1000).toISOString();
  
  console.log(`🔍 Validating new reply decisions (last ${minutes} minutes)`);
  console.log(`   Cutoff: ${cutoffTime}\n`);
  
  // Get all reply decisions created in the time window
  const { data: replies, error } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, decision_type, status, created_at, target_tweet_content_snapshot, target_tweet_content_hash, semantic_similarity, root_tweet_id')
    .eq('decision_type', 'reply')
    .gte('created_at', cutoffTime)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error(`❌ Error querying replies: ${error.message}`);
    process.exit(1);
  }
  
  if (!replies || replies.length === 0) {
    console.log(`✅ No reply decisions found in last ${minutes} minutes`);
    process.exit(0);
  }
  
  console.log(`📊 Found ${replies.length} reply decisions\n`);
  
  // Check for required fields
  const withSnapshot = replies.filter(r => r.target_tweet_content_snapshot && r.target_tweet_content_snapshot.length >= 20);
  const withHash = replies.filter(r => r.target_tweet_content_hash);
  const withSimilarity = replies.filter(r => r.semantic_similarity !== null && r.semantic_similarity !== undefined);
  const withRootId = replies.filter(r => r.root_tweet_id);
  
  const missingSnapshot = replies.filter(r => !r.target_tweet_content_snapshot || r.target_tweet_content_snapshot.length < 20);
  const missingHash = replies.filter(r => !r.target_tweet_content_hash);
  const missingSimilarity = replies.filter(r => r.semantic_similarity === null || r.semantic_similarity === undefined);
  
  console.log('📋 Validation Results:');
  console.log(`   ✅ With snapshot (>=20 chars): ${withSnapshot.length}/${replies.length} (${((withSnapshot.length / replies.length) * 100).toFixed(1)}%)`);
  console.log(`   ✅ With hash: ${withHash.length}/${replies.length} (${((withHash.length / replies.length) * 100).toFixed(1)}%)`);
  console.log(`   ✅ With similarity: ${withSimilarity.length}/${replies.length} (${((withSimilarity.length / replies.length) * 100).toFixed(1)}%)`);
  console.log(`   ✅ With root_tweet_id: ${withRootId.length}/${replies.length} (${((withRootId.length / replies.length) * 100).toFixed(1)}%)`);
  
  if (missingSnapshot.length > 0) {
    console.log(`\n❌ Missing snapshot (${missingSnapshot.length}):`);
    for (const r of missingSnapshot.slice(0, 5)) {
      const age = Math.round((Date.now() - new Date(r.created_at).getTime()) / (60 * 1000));
      console.log(`   - ${r.decision_id.substring(0, 8)}... (${age}min ago, status: ${r.status})`);
    }
  }
  
  if (missingHash.length > 0) {
    console.log(`\n❌ Missing hash (${missingHash.length}):`);
    for (const r of missingHash.slice(0, 5)) {
      const age = Math.round((Date.now() - new Date(r.created_at).getTime()) / (60 * 1000));
      console.log(`   - ${r.decision_id.substring(0, 8)}... (${age}min ago, status: ${r.status})`);
    }
  }
  
  // Overall health score
  const allComplete = replies.filter(r => 
    r.target_tweet_content_snapshot && 
    r.target_tweet_content_snapshot.length >= 20 &&
    r.target_tweet_content_hash &&
    r.semantic_similarity !== null &&
    r.semantic_similarity !== undefined
  );
  
  const healthScore = (allComplete.length / replies.length) * 100;
  
  console.log(`\n📊 Overall Health Score: ${healthScore.toFixed(1)}%`);
  console.log(`   Complete: ${allComplete.length}/${replies.length}`);
  console.log(`   Incomplete: ${replies.length - allComplete.length}/${replies.length}`);
  
  if (healthScore < 100) {
    console.log(`\n⚠️  WARNING: Some reply decisions are missing required gate data`);
    process.exit(1);
  } else {
    console.log(`\n✅ All reply decisions include required gate data`);
    process.exit(0);
  }
}

main().catch(console.error);

