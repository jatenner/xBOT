/**
 * Deep System Inspection
 * Query database directly to see what's actually happening
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function inspect() {
  console.log('\n🔬 DEEP SYSTEM INSPECTION\n');
  const supabase = getSupabaseClient();
  
  // Check if ANY activity is happening in the last 5 minutes
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 LAST 5 MINUTES OF ACTIVITY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // 1. Check if ANY rows were updated
  const { data: recentUpdates, error: updateError } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, status, updated_at')
    .gte('updated_at', fiveMinAgo)
    .order('updated_at', { ascending: false })
    .limit(10);
  
  if (updateError) {
    console.log(`❌ Query failed: ${updateError.message}\n`);
  } else if (!recentUpdates || recentUpdates.length === 0) {
    console.log('🚨 ZERO database writes in last 5min');
    console.log('   → App is either:');
    console.log('     1. Not running at all');
    console.log('     2. Running but jobs not executing');
    console.log('     3. Stuck in an infinite loop\n');
  } else {
    console.log(`✅ Found ${recentUpdates.length} recent updates:`);
    recentUpdates.forEach((u, i) => {
      const secAgo = Math.round((Date.now() - new Date(u.updated_at).getTime()) / 1000);
      console.log(`   ${i + 1}. ${u.decision_type} - ${u.status} (${secAgo}s ago)`);
    });
    console.log('');
  }
  
  // 2. Check system_events to see if app is logging
  const { data: recentEvents, error: eventsError } = await supabase
    .from('system_events')
    .select('event_type, component, message, created_at')
    .gte('created_at', fiveMinAgo)
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (!eventsError && recentEvents && recentEvents.length > 0) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 RECENT SYSTEM EVENTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    recentEvents.forEach((e, i) => {
      const secAgo = Math.round((Date.now() - new Date(e.created_at).getTime()) / 1000);
      console.log(`${i + 1}. [${e.component}] ${e.event_type} (${secAgo}s ago)`);
      console.log(`   ${e.message.substring(0, 100)}...\n`);
    });
  }
  
  // 3. Check the overdue queue item status
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 OVERDUE QUEUE ITEM (10 days old)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const { data: overdueItem, error: overdueError } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, status, scheduled_at, created_at, updated_at, retry_count')
    .eq('status', 'ready')
    .order('scheduled_at', { ascending: true })
    .limit(1);
  
  if (!overdueError && overdueItem && overdueItem.length > 0) {
    const item = overdueItem[0];
    const hoursOverdue = Math.round((Date.now() - new Date(item.scheduled_at).getTime()) / (1000 * 60 * 60));
    const hoursSinceCreated = Math.round((Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60));
    const minSinceUpdated = Math.round((Date.now() - new Date(item.updated_at).getTime()) / (1000 * 60));
    
    console.log(`Decision: ${item.decision_id}`);
    console.log(`Type: ${item.decision_type}`);
    console.log(`Status: ${item.status}`);
    console.log(`Scheduled: ${hoursOverdue}h ago (${new Date(item.scheduled_at).toISOString()})`);
    console.log(`Created: ${hoursSinceCreated}h ago`);
    console.log(`Last updated: ${minSinceUpdated}min ago`);
    console.log(`Retry count: ${item.retry_count || 0}`);
    
    if (minSinceUpdated > 30) {
      console.log('\n🚨 SMOKING GUN: This item hasn\'t been touched in 30+ minutes!');
      console.log('   → postingQueue is NOT processing the queue');
      console.log('   → Either:');
      console.log('     1. postingQueue job not running');
      console.log('     2. Stuck in an error loop');
      console.log('     3. Browser pool completely frozen');
    }
  }
  
  // 4. Final verdict
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎯 VERDICT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  if (!recentUpdates || recentUpdates.length === 0) {
    console.log('🚨 APP IS NOT RUNNING');
    console.log('\n   The database shows ZERO activity in the last 5 minutes.');
    console.log('   Railway dashboard says "Online" but the app is NOT executing.');
    console.log('\n   This usually means:');
    console.log('   → App crashed after startup');
    console.log('   → jobManager failed to initialize');
    console.log('   → Migrations blocked startup');
    console.log('\n   Solution: Check Railway "Deploy Logs" (not service logs)');
    console.log('   Look for the startup sequence and any errors.');
  } else {
    console.log('✅ App IS running (database activity detected)');
    console.log('\n   But jobs may not be scheduled correctly.');
    console.log('   Check job intervals and scheduling logic.');
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

inspect().catch(error => {
  console.error('\n❌ Inspection failed:', error.message);
  process.exit(1);
});

