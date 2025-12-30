/**
 * Emergency: Force process ONE queue item manually
 * This will test if posting works at all
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function forceProcessOne() {
  console.log('\n🚨 EMERGENCY: Manually triggering posting queue\n');
  
  const supabase = getSupabaseClient();
  
  // Get the most overdue ready item
  const { data: readyItems, error } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, status, scheduled_at')
    .eq('status', 'ready')
    .order('scheduled_at', { ascending: true })
    .limit(1);
  
  if (error || !readyItems || readyItems.length === 0) {
    console.log('❌ No ready items found');
    return;
  }
  
  const item = readyItems[0];
  console.log(`Found overdue item: ${item.decision_id} (${item.decision_type})`);
  console.log(`Scheduled: ${item.scheduled_at}`);
  
  // Import and call processPostingQueue directly
  console.log('\n🔧 Calling processPostingQueue()...\n');
  
  try {
    const { processPostingQueue } = await import('../src/jobs/postingQueue');
    await processPostingQueue();
    console.log('\n✅ processPostingQueue() completed!');
    console.log('Check if tweet was posted.');
  } catch (error: any) {
    console.error('\n❌ processPostingQueue() FAILED:');
    console.error(error.message);
    console.error(error.stack);
  }
}

forceProcessOne().catch(error => {
  console.error('\n❌ Script failed:', error.message);
  process.exit(1);
});

