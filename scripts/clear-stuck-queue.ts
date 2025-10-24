#!/usr/bin/env tsx
/**
 * Clear stuck queued decisions that are preventing posting
 */

import dotenv from 'dotenv';
dotenv.config();

import { getSupabaseClient } from '../src/db/index';

async function clearStuckQueue() {
  console.log('🧹 Clearing stuck queued decisions...\n');
  
  const supabase = getSupabaseClient();
  
  // 1. Check current queue status
  const { data: queuedDecisions, error: queueError } = await supabase
    .from('content_metadata')
    .select('decision_id, scheduled_at, created_at, content')
    .eq('status', 'queued')
    .order('scheduled_at', { ascending: true });
  
  if (queueError) {
    console.error('❌ Error fetching queued decisions:', queueError.message);
    process.exit(1);
  }
  
  console.log(`📊 Found ${queuedDecisions?.length || 0} queued decisions\n`);
  
  if (!queuedDecisions || queuedDecisions.length === 0) {
    console.log('✅ No stuck decisions to clear');
    return;
  }
  
  // 2. Check which ones are already posted
  const { data: posted } = await supabase
    .from('posted_decisions')
    .select('decision_id');
  
  const postedIds = new Set((posted || []).map(p => p.decision_id));
  
  // 3. Find decisions that are stuck (queued but scheduled > 1 hour ago)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const stuckDecisions = queuedDecisions.filter(d => {
    const scheduledAt = new Date(d.scheduled_at as string);
    return scheduledAt < oneHourAgo;
  });
  
  console.log(`⚠️  Found ${stuckDecisions.length} decisions stuck (scheduled > 1 hour ago)\n`);
  
  if (stuckDecisions.length === 0) {
    console.log('✅ No stuck decisions to clear');
    return;
  }
  
  // 4. Show what we'll update
  console.log('📝 Stuck decisions that will be marked as failed:\n');
  stuckDecisions.forEach((d, i) => {
    const scheduledAt = new Date(d.scheduled_at as string);
    const hoursAgo = Math.round((Date.now() - scheduledAt.getTime()) / (60 * 60 * 1000));
    console.log(`${i + 1}. ${d.decision_id}`);
    console.log(`   Scheduled: ${hoursAgo} hours ago`);
    console.log(`   Content: "${String(d.content).substring(0, 60)}..."`);
    console.log(`   Already posted: ${postedIds.has(d.decision_id) ? 'YES' : 'NO'}\n`);
  });
  
  // 5. Update stuck decisions to 'failed' status
  const idsToUpdate = stuckDecisions
    .filter(d => !postedIds.has(d.decision_id)) // Don't update already posted
    .map(d => d.decision_id);
  
  if (idsToUpdate.length === 0) {
    console.log('✅ All stuck decisions are already posted, nothing to update');
    return;
  }
  
  console.log(`\n🔧 Updating ${idsToUpdate.length} stuck decisions to 'failed' status...`);
  
  const { error: updateError } = await supabase
    .from('content_metadata')
    .update({ status: 'failed' })
    .in('decision_id', idsToUpdate);
  
  if (updateError) {
    console.error('❌ Error updating decisions:', updateError.message);
    process.exit(1);
  }
  
  console.log(`✅ Successfully marked ${idsToUpdate.length} stuck decisions as failed\n`);
  
  // 6. Show remaining queue
  const { data: remainingQueue } = await supabase
    .from('content_metadata')
    .select('decision_id, scheduled_at')
    .eq('status', 'queued')
    .order('scheduled_at', { ascending: true })
    .limit(5);
  
  if (remainingQueue && remainingQueue.length > 0) {
    console.log(`📋 Next ${remainingQueue.length} queued decisions:`);
    remainingQueue.forEach((d, i) => {
      const scheduledAt = new Date(d.scheduled_at as string);
      const minutesUntil = Math.round((scheduledAt.getTime() - Date.now()) / 60000);
      console.log(`${i + 1}. ${d.decision_id}: ${minutesUntil > 0 ? `in ${minutesUntil} min` : `${Math.abs(minutesUntil)} min ago`}`);
    });
  } else {
    console.log('📋 No remaining queued decisions');
  }
  
  console.log('\n✅ Queue cleanup complete!');
}

clearStuckQueue().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

