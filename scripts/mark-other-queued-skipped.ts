/**
 * Mark all queued items except controlled test decision as skipped
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

const controlledDecisionId = process.argv[2];

if (!controlledDecisionId) {
  console.error('Usage: tsx scripts/mark-other-queued-skipped.ts <controlled_decision_id>');
  process.exit(1);
}

async function main() {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('content_generation_metadata_comprehensive')
    .update({ 
      status: 'blocked', 
      skip_reason: 'controlled_test_prep' 
    })
    .eq('status', 'queued')
    .neq('decision_id', controlledDecisionId)
    .select('decision_id, decision_type');
  
  if (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
  
  console.log(`✅ Marked ${data?.length || 0} other queued items as blocked:`);
  (data || []).forEach(item => {
    console.log(`   - ${item.decision_id.substring(0, 8)}... (${item.decision_type})`);
  });
  
  process.exit(0);
}

main().catch(console.error);

