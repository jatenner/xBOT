/**
 * Verify recent atomic posts have DB truth
 */

import { getSupabaseClient } from '../src/db/index';
import { getConfig } from '../src/config/config';

async function verify() {
  getConfig();
  const supabase = getSupabaseClient();

  const decisionIds = [
    '4d59e2e3-f369-47bf-8e8b-d1fc44310f60',
    'a2cbd4b3-4290-472b-9ff0-4499faa50707'
  ];

  console.log('🔍 Verifying recent atomic posts:\n');

  for (const decisionId of decisionIds) {
    const { data } = await supabase
      .from('content_generation_metadata_comprehensive')
      .select('decision_id, status, tweet_id, pipeline_source, build_sha, job_run_id, created_at, posted_at')
      .eq('decision_id', decisionId)
      .single();
    
    if (data) {
      console.log(`Post: ${decisionId.substring(0, 12)}...`);
      console.log(`  status=${data.status}`);
      console.log(`  tweet_id=${data.tweet_id || 'NULL'}`);
      console.log(`  pipeline=${data.pipeline_source}`);
      console.log(`  created=${data.created_at}`);
      console.log(`  posted=${data.posted_at || 'NULL'}`);
      console.log(`  ✅ DB Truth: ${data.status === 'posted' && data.tweet_id ? 'YES' : 'NO'}\n`);
    } else {
      console.log(`Post ${decisionId.substring(0, 12)}... NOT FOUND\n`);
    }
  }
}

verify().catch(console.error);
