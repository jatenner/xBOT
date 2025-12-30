/**
 * Clear stale/duplicate queue items
 * These are OLD items blocking the queue
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function clearStaleQueue() {
  console.log('\n🧹 CLEARING STALE QUEUE ITEMS\n');
  
  const supabase = getSupabaseClient();
  
  // 1. Mark items >24h old as failed
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  const { data: staleItems, error: queryError } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, status, created_at, scheduled_at')
    .in('status', ['queued', 'ready'])
    .lt('created_at', oneDayAgo);
  
  if (queryError) {
    console.log(`❌ Query failed: ${queryError.message}`);
    return;
  }
  
  if (!staleItems || staleItems.length === 0) {
    console.log('✅ No stale items found');
    return;
  }
  
  console.log(`Found ${staleItems.length} stale items (>24h old):`);
  staleItems.forEach((item, i) => {
    const hoursOld = Math.round((Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60));
    console.log(`  ${i + 1}. ${item.decision_type} - ${item.status} (${hoursOld}h old)`);
  });
  
  console.log('\n🗑️  Marking as failed_permanent...');
  
  const { error: updateError } = await supabase
    .from('content_generation_metadata_comprehensive')
    .update({
      status: 'failed_permanent',
      updated_at: new Date().toISOString()
    })
    .in('decision_id', staleItems.map(i => i.decision_id));
  
  if (updateError) {
    console.log(`❌ Update failed: ${updateError.message}`);
  } else {
    console.log(`✅ Cleared ${staleItems.length} stale items`);
  }
  
  // 2. Check current queue
  const { data: currentQueue, error: queueError } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, status, created_at')
    .in('status', ['queued', 'ready'])
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (!queueError && currentQueue) {
    console.log(`\n📊 Current queue: ${currentQueue.length} items`);
    currentQueue.forEach((item, i) => {
      const minOld = Math.round((Date.now() - new Date(item.created_at).getTime()) / (1000 * 60));
      console.log(`  ${i + 1}. ${item.decision_type} - ${item.status} (${minOld}min old)`);
    });
  }
  
  console.log('\n✅ Queue cleanup complete!');
  console.log('New content will be generated on next planJob cycle (every 30min)');
}

clearStaleQueue().catch(error => {
  console.error('\n❌ Failed:', error.message);
  process.exit(1);
});

