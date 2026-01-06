/**
 * Check if decision is queued
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

const decisionId = process.argv[2] || '1e43a484-e5a8-48ed-bfb3-5d6e7358d6ba';

async function main() {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, status, scheduled_at, decision_type, content')
    .eq('decision_id', decisionId)
    .single();
  
  if (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
  
  console.log(`📊 Decision Status:`);
  console.log(`   Decision ID: ${data?.decision_id}`);
  console.log(`   Status: ${data?.status}`);
  console.log(`   Type: ${data?.decision_type}`);
  console.log(`   Scheduled at: ${data?.scheduled_at}`);
  console.log(`   Content preview: ${(data?.content || '').substring(0, 60)}...`);
  
  if (data?.status === 'queued') {
    console.log(`\n✅ Decision is queued and ready`);
  } else {
    console.log(`\n⚠️  Decision is NOT queued (status: ${data?.status})`);
  }
  
  process.exit(0);
}

main().catch(console.error);

