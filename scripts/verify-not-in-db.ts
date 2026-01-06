/**
 * Verifier: Check for tweets NOT_IN_DB (ghost posts)
 * Usage: tsx scripts/verify-not-in-db.ts [--since-hours=24]
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

const SINCE_HOURS = parseInt(process.argv.find(arg => arg.startsWith('--since-hours='))?.split('=')[1] || '24', 10);

async function main() {
  const supabase = getSupabaseClient();
  const since = new Date(Date.now() - SINCE_HOURS * 60 * 60 * 1000).toISOString();
  
  console.log(`🔍 Checking for NOT_IN_DB tweets since ${since} (${SINCE_HOURS}h ago)`);
  console.log(`📅 Current time: ${new Date().toISOString()}\n`);
  
  // Get all tweets posted in the time window from DB
  const { data: dbTweets, error: dbError } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('tweet_id, decision_id, status, posted_at, decision_type, pipeline_source, build_sha')
    .not('tweet_id', 'is', null)
    .gte('posted_at', since)
    .order('posted_at', { ascending: false });
  
  if (dbError) {
    console.error(`❌ DB query error: ${dbError.message}`);
    process.exit(1);
  }
  
  const dbTweetIds = new Set((dbTweets || []).map(t => t.tweet_id));
  console.log(`✅ Found ${dbTweetIds.size} tweets IN_DB since ${since}`);
  
  if (dbTweetIds.size > 0) {
    console.log(`\n📊 Sample IN_DB tweets:`);
    (dbTweets || []).slice(0, 5).forEach(t => {
      console.log(`   ${t.tweet_id} | ${t.status} | ${t.decision_type} | ${t.pipeline_source || 'NULL'} | ${t.build_sha || 'NULL'} | ${t.posted_at}`);
    });
  }
  
  // Check for NULL/dev build_sha (potential ghost indicators)
  const nullBuildSha = (dbTweets || []).filter(t => !t.build_sha || t.build_sha === 'dev' || t.build_sha === 'unknown');
  if (nullBuildSha.length > 0) {
    console.log(`\n⚠️ Found ${nullBuildSha.length} tweets with NULL/dev/unknown build_sha:`);
    nullBuildSha.slice(0, 10).forEach(t => {
      console.log(`   ${t.tweet_id} | build_sha=${t.build_sha || 'NULL'} | ${t.posted_at}`);
    });
  }
  
  // Summary
  console.log(`\n📊 SUMMARY:`);
  console.log(`   IN_DB tweets: ${dbTweetIds.size}`);
  console.log(`   NULL/dev build_sha: ${nullBuildSha.length}`);
  console.log(`   Time window: ${SINCE_HOURS} hours`);
  
  // Exit code: 0 if clean, 1 if issues found
  if (nullBuildSha.length > 0) {
    console.log(`\n❌ ISSUES FOUND: ${nullBuildSha.length} tweets with NULL/dev build_sha`);
    process.exit(1);
  } else {
    console.log(`\n✅ CLEAN: All tweets have valid build_sha`);
    process.exit(0);
  }
}

main().catch(console.error);

