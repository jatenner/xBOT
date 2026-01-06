/**
 * Reset a post to queued status
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

const decisionId = process.argv[2];

if (!decisionId) {
  console.error('Usage: tsx scripts/reset-post-to-queued.ts <decision_id>');
  process.exit(1);
}

async function main() {
  const supabase = getSupabaseClient();
  const fiveMinAgo = new Date(Date.now() - 6 * 60 * 1000).toISOString();
  
  const { data, error } = await supabase
    .from('content_generation_metadata_comprehensive')
    .update({ 
      status: 'queued',
      skip_reason: null,
      post_attempt_at: null,
      error_message: null,
      scheduled_at: fiveMinAgo
    })
    .eq('decision_id', decisionId)
    .select('decision_id, status, scheduled_at, skip_reason')
    .single();
  
  if (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
  
  if (!data) {
    console.error(`❌ Decision not found: ${decisionId}`);
    process.exit(1);
  }
  
  console.log(`✅ Reset to queued:`);
  console.log(`   decision_id: ${data.decision_id}`);
  console.log(`   status: ${data.status}`);
  console.log(`   scheduled_at: ${data.scheduled_at}`);
  console.log(`   skip_reason: ${data.skip_reason || 'null'}`);
  
  process.exit(0);
}

main().catch(console.error);

