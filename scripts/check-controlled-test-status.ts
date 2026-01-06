/**
 * Check status of controlled test post
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

const decisionId = '497a9126-e638-49ba-9420-192017d08f13';

async function main() {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('*')
    .eq('decision_id', decisionId)
    .single();
  
  if (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
  
  console.log(`📊 Controlled Test Post Status:\n`);
  console.log(`   decision_id: ${data.decision_id}`);
  console.log(`   status: ${data.status}`);
  console.log(`   tweet_id: ${data.tweet_id || 'NOT POSTED YET'}`);
  console.log(`   build_sha: ${data.build_sha || 'NULL'}`);
  console.log(`   pipeline_source: ${data.pipeline_source || 'NULL'}`);
  console.log(`   post_attempt_at: ${data.post_attempt_at || 'null'}`);
  console.log(`   error_message: ${data.error_message || 'null'}`);
  console.log(`   scheduled_at: ${data.scheduled_at}`);
  console.log(`   posted_at: ${data.posted_at || 'NOT POSTED YET'}`);
  
  if (data.tweet_id) {
    console.log(`\n✅ POST SUCCESSFUL!`);
    console.log(`   Tweet URL: https://twitter.com/Signal_Synapse/status/${data.tweet_id}`);
  } else {
    console.log(`\n⏳ Post not yet successful`);
  }
  
  process.exit(0);
}

main().catch(console.error);

