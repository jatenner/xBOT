/**
 * Count queued decisions in database
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function main() {
  const supabase = getSupabaseClient();
  
  try {
    // Count all queued decisions
    const { count: totalQueued, error: totalError } = await supabase
      .from('content_generation_metadata_comprehensive')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'queued');
    
    if (totalError) {
      console.error(`❌ Error counting queued: ${totalError.message}`);
      process.exit(1);
    }
    
    // Count by type
    const { data: byType, error: byTypeError } = await supabase
      .from('content_generation_metadata_comprehensive')
      .select('decision_type, decision_id')
      .eq('status', 'queued');
    
    if (byTypeError) {
      console.error(`❌ Error fetching by type: ${byTypeError.message}`);
      process.exit(1);
    }
    
    const singles = (byType || []).filter(d => d.decision_type === 'single').length;
    const threads = (byType || []).filter(d => d.decision_type === 'thread').length;
    const replies = (byType || []).filter(d => d.decision_type === 'reply').length;
    
    console.log(`📊 Queued Decisions Summary:\n`);
    console.log(`   Total queued: ${totalQueued || 0}`);
    console.log(`   Singles: ${singles}`);
    console.log(`   Threads: ${threads}`);
    console.log(`   Replies: ${replies}`);
    
    if (totalQueued && totalQueued > 0) {
      console.log(`\n📋 Sample queued decisions:`);
      (byType || []).slice(0, 5).forEach(d => {
        console.log(`   - ${d.decision_id.substring(0, 8)}... (${d.decision_type})`);
      });
    }
    
    process.exit(0);
  } catch (error: any) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

main().catch(console.error);

