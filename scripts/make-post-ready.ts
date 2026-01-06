/**
 * Make a queued post immediately ready
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

const decisionId = process.argv[2];

if (!decisionId) {
  console.error('Usage: tsx scripts/make-post-ready.ts <decision_id>');
  process.exit(1);
}

async function main() {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  
  const { data, error } = await supabase
    .from('content_generation_metadata_comprehensive')
    .update({ 
      scheduled_at: fiveMinutesAgo, // Make it ready (5 min ago)
      status: 'queued'
    })
    .eq('decision_id', decisionId)
    .select('decision_id, scheduled_at, status')
    .single();
  
  if (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
  
  if (!data) {
    console.error(`❌ Decision not found: ${decisionId}`);
    process.exit(1);
  }
  
  console.log(`✅ Made post ready:`);
  console.log(`   decision_id: ${data.decision_id}`);
  console.log(`   scheduled_at: ${data.scheduled_at}`);
  console.log(`   status: ${data.status}`);
  
  process.exit(0);
}

main().catch(console.error);

