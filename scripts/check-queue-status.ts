/**
 * Check current queue status
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function main() {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, status, decision_type, content')
    .eq('status', 'queued')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
  
  console.log(`📊 Queue Status: ${data?.length || 0} items queued\n`);
  
  if (data && data.length > 0) {
    console.log('Queued items:');
    data.forEach((item, i) => {
      console.log(`  ${i + 1}. ${item.decision_id} | ${item.decision_type} | ${(item.content || '').substring(0, 60)}...`);
    });
  } else {
    console.log('✅ Queue is empty');
  }
  
  process.exit(0);
}

main().catch(console.error);

