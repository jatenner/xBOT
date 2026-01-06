/**
 * Mark queued items as skipped (except controlled_test)
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function main() {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('content_generation_metadata_comprehensive')
    .update({ status: 'skipped', skip_reason: 'controlled_test_prep' })
    .eq('status', 'queued')
    .neq('pipeline_source', 'controlled_test')
    .select('decision_id');
  
  if (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
  
  console.log(`✅ Marked ${data?.length || 0} queued items as skipped`);
  if (data && data.length > 0) {
    data.forEach(item => {
      console.log(`   - ${item.decision_id}`);
    });
  }
  
  process.exit(0);
}

main().catch(console.error);

