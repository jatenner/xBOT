/**
 * Clear retry deferral for a decision
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

const decisionId = process.argv[2];

if (!decisionId) {
  console.error('Usage: tsx scripts/clear-retry-deferral.ts <decision_id>');
  process.exit(1);
}

async function main() {
  const supabase = getSupabaseClient();
  
  // Clear retry fields
  const { data, error } = await supabase
    .from('content_generation_metadata_comprehensive')
    .update({ 
      post_attempt_at: null,
      error_message: null,
      status: 'queued'
    })
    .eq('decision_id', decisionId)
    .select('decision_id, status, post_attempt_at, error_message')
    .single();
  
  if (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
  
  if (!data) {
    console.error(`❌ Decision not found: ${decisionId}`);
    process.exit(1);
  }
  
  console.log(`✅ Cleared retry deferral:`);
  console.log(`   decision_id: ${data.decision_id}`);
  console.log(`   status: ${data.status}`);
  console.log(`   post_attempt_at: ${data.post_attempt_at || 'null'}`);
  console.log(`   error_message: ${data.error_message || 'null'}`);
  
  process.exit(0);
}

main().catch(console.error);

