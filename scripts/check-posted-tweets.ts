/**
 * Check for posted tweets in the last N minutes
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

const minutesArg = process.argv.find(arg => arg.startsWith('--minutes='))?.replace('--minutes=', '') || process.argv[2] || '10';
const minutes = parseInt(minutesArg, 10);

async function main() {
  const supabase = getSupabaseClient();
  const cutoffTime = new Date(Date.now() - minutes * 60 * 1000).toISOString();
  
  console.log(`🔍 Checking for posted tweets (last ${minutes} minutes)`);
  console.log(`   Cutoff: ${cutoffTime}\n`);
  
  const { data: posted, error } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, tweet_id, status, build_sha, pipeline_source, posted_at, decision_type, content')
    .eq('status', 'posted')
    .gte('posted_at', cutoffTime)
    .order('posted_at', { ascending: false })
    .limit(10);
  
  if (error) {
    console.error(`❌ Error querying posted tweets: ${error.message}`);
    process.exit(1);
  }
  
  if (!posted || posted.length === 0) {
    console.log(`📊 No posted tweets found in last ${minutes} minutes`);
    process.exit(0);
  }
  
  console.log(`📊 Found ${posted.length} posted tweet(s):\n`);
  
  for (const tweet of posted) {
    console.log(`✅ Tweet ID: ${tweet.tweet_id}`);
    console.log(`   Decision ID: ${tweet.decision_id}`);
    console.log(`   Type: ${tweet.decision_type}`);
    console.log(`   URL: https://x.com/i/web/status/${tweet.tweet_id}`);
    console.log(`   Build SHA: ${tweet.build_sha || 'MISSING'}`);
    console.log(`   Pipeline: ${tweet.pipeline_source || 'MISSING'}`);
    console.log(`   Posted at: ${tweet.posted_at}`);
    console.log(`   Content preview: ${(tweet.content || '').substring(0, 60)}...`);
    console.log('');
  }
  
  process.exit(0);
}

main().catch(console.error);


