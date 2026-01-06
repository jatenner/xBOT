/**
 * Verify if a tweet_id exists in database
 * Usage: tsx scripts/verify-tweet-saved.ts <tweet_id>
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

const tweetId = process.argv[2];

if (!tweetId) {
  console.error('Usage: tsx scripts/verify-tweet-saved.ts <tweet_id>');
  process.exit(1);
}

async function main() {
  const supabase = getSupabaseClient();
  
  console.log(`🔍 Verifying tweet_id: ${tweetId}\n`);
  
  // Check content_generation_metadata_comprehensive
  const { data, error } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, status, tweet_id, decision_type, pipeline_source, build_sha, job_run_id, posted_at, content')
    .eq('tweet_id', tweetId)
    .limit(1)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error(`❌ Query error: ${error.message}`);
    process.exit(1);
  }
  
  if (data) {
    console.log('✅ FOUND IN DATABASE');
    console.log(`   decision_id: ${data.decision_id}`);
    console.log(`   status: ${data.status}`);
    console.log(`   decision_type: ${data.decision_type}`);
    console.log(`   pipeline_source: ${data.pipeline_source || 'NULL'}`);
    console.log(`   build_sha: ${data.build_sha || 'NULL'}`);
    console.log(`   job_run_id: ${data.job_run_id || 'NULL'}`);
    console.log(`   posted_at: ${data.posted_at || 'NULL'}`);
    console.log(`   content_preview: ${(data.content || '').substring(0, 100)}`);
    console.log('\n📊 Classification: (A) IN_DB - from our pipeline');
  } else {
    console.log('❌ NOT FOUND IN DATABASE');
    console.log('\n📊 Classification: (B) NOT_IN_DB - ghost/bypass');
  }
  
  process.exit(0);
}

main().catch(console.error);
