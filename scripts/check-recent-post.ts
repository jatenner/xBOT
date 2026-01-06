/**
 * Check recent post for atomic flow verification
 */

import { getSupabaseClient } from '../src/db/index';
import { getConfig } from '../src/config/config';

async function check() {
  getConfig();
  const supabase = getSupabaseClient();

  const decisionId = '4d59e2e3-8f5a-4c1d-9b2e-1a3c4d5e6f7a';
  
  const { data } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, status, tweet_id, pipeline_source, build_sha, job_run_id, created_at, posted_at')
    .eq('decision_id', decisionId)
    .single();

  if (data) {
    console.log('Recent post verification:');
    console.log(`  decision_id=${data.decision_id}`);
    console.log(`  status=${data.status}`);
    console.log(`  tweet_id=${data.tweet_id || 'NULL'}`);
    console.log(`  pipeline=${data.pipeline_source}`);
    console.log(`  build_sha=${data.build_sha}`);
    console.log(`  created=${data.created_at}`);
    console.log(`  posted=${data.posted_at || 'NULL'}`);
    console.log(`  ✅ Atomic flow: ${data.status === 'posted' && data.tweet_id ? 'SUCCESS' : 'FAILED'}`);
  } else {
    console.log('Post not found');
  }
}

check().catch(console.error);

