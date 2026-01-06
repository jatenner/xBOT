/**
 * Delete a decision by decision_id
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

const decisionId = process.argv[2];

if (!decisionId) {
  console.error('Usage: tsx scripts/delete-decision.ts <decision_id>');
  process.exit(1);
}

async function main() {
  const supabase = getSupabaseClient();
  
  const { error } = await supabase
    .from('content_generation_metadata_comprehensive')
    .delete()
    .eq('decision_id', decisionId);
  
  if (error) {
    console.error(`❌ Error deleting decision: ${error.message}`);
    process.exit(1);
  }
  
  console.log(`✅ Decision deleted: ${decisionId}`);
  process.exit(0);
}

main().catch(console.error);

