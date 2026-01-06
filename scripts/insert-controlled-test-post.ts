/**
 * Insert exactly ONE controlled test post into queue
 */

import 'dotenv/config';
import { v4 as uuidv4 } from 'uuid';
import { getSupabaseClient } from '../src/db/index';
import { getBuildSHA } from '../src/posting/atomicPostExecutor';

async function main() {
  const buildSha = getBuildSHA();
  const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
  const decisionId = uuidv4();
  
  const content = `[CONTROLLED_TEST_1] build_sha=${buildSha.substring(0, 8)} ts=${timestamp} Testing single-writer control recovery. This is a controlled test post to verify traceability.`;
  
  if (content.length > 280) {
    console.error(`❌ Content too long: ${content.length} chars (max 280)`);
    process.exit(1);
  }
  
  console.log(`📝 Creating controlled test post:`);
  console.log(`   decision_id: ${decisionId}`);
  console.log(`   build_sha: ${buildSha}`);
  console.log(`   content length: ${content.length} chars`);
  console.log(`   content: ${content}\n`);
  
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('content_generation_metadata_comprehensive')
    .insert([{
      decision_id: decisionId,
      decision_type: 'single',
      status: 'queued',
      content: content,
      pipeline_source: 'controlled_test',
      build_sha: buildSha,
      job_run_id: `controlled_test_${Date.now()}`,
      created_at: new Date().toISOString(),
      scheduled_at: new Date().toISOString(),
    }])
    .select()
    .single();
  
  if (error) {
    console.error(`❌ Insert failed: ${error.message}`);
    process.exit(1);
  }
  
  console.log(`✅ Controlled test post inserted:`);
  console.log(`   decision_id: ${data.decision_id}`);
  console.log(`   status: ${data.status}`);
  console.log(`   Ready for posting queue`);
  
  process.exit(0);
}

main().catch(console.error);

