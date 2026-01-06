/**
 * Diagnose why decisions are queued/blocked
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

const hoursArg = process.argv.find(arg => arg.startsWith('--hours='))?.replace('--hours=', '') || process.argv[2] || '6';
const hours = parseInt(hoursArg, 10);

async function main() {
  const supabase = getSupabaseClient();
  const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  
  console.log(`🔍 Diagnosing queue blocks (last ${hours} hours)`);
  console.log(`   Cutoff: ${cutoffTime}\n`);
  
  // Get all decisions in the time window
  const { data: decisions, error } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, decision_type, status, skip_reason, created_at, scheduled_at, updated_at')
    .gte('created_at', cutoffTime)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error(`❌ Error querying decisions: ${error.message}`);
    process.exit(1);
  }
  
  if (!decisions || decisions.length === 0) {
    console.log(`✅ No decisions found in last ${hours} hours`);
    process.exit(0);
  }
  
  console.log(`📊 Total decisions: ${decisions.length}\n`);
  
  // Group by status
  const byStatus: Record<string, typeof decisions> = {};
  for (const d of decisions) {
    const status = d.status || 'unknown';
    if (!byStatus[status]) byStatus[status] = [];
    byStatus[status].push(d);
  }
  
  // Group by skip_reason for blocked items
  const blockedByReason: Record<string, typeof decisions> = {};
  for (const d of decisions.filter(d => d.status === 'blocked')) {
    const reason = d.skip_reason || 'no_reason';
    if (!blockedByReason[reason]) blockedByReason[reason] = [];
    blockedByReason[reason].push(d);
  }
  
  // Print summary
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 BY STATUS:');
  console.log('═══════════════════════════════════════════════════════════');
  for (const [status, items] of Object.entries(byStatus).sort((a, b) => b[1].length - a[1].length)) {
    const byType = {
      single: items.filter(i => i.decision_type === 'single').length,
      thread: items.filter(i => i.decision_type === 'thread').length,
      reply: items.filter(i => i.decision_type === 'reply').length,
    };
    console.log(`\n${status.toUpperCase()}: ${items.length} total`);
    console.log(`   Types: ${byType.single} single, ${byType.thread} thread, ${byType.reply} reply`);
    console.log(`   Most recent 5:`);
    for (const item of items.slice(0, 5)) {
      const age = Math.round((Date.now() - new Date(item.created_at).getTime()) / (60 * 1000));
      console.log(`     - ${item.decision_id.substring(0, 8)}... (${item.decision_type}, ${age}min ago)`);
    }
  }
  
  if (Object.keys(blockedByReason).length > 0) {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🚫 BY BLOCK REASON:');
    console.log('═══════════════════════════════════════════════════════════');
    for (const [reason, items] of Object.entries(blockedByReason).sort((a, b) => b[1].length - a[1].length)) {
      console.log(`\n${reason}: ${items.length} blocked`);
      console.log(`   Most recent 5:`);
      for (const item of items.slice(0, 5)) {
        const age = Math.round((Date.now() - new Date(item.created_at).getTime()) / (60 * 1000));
        console.log(`     - ${item.decision_id.substring(0, 8)}... (${item.decision_type}, ${age}min ago)`);
      }
    }
  }
  
  // Check for queued items that might be ready
  const queued = decisions.filter(d => d.status === 'queued');
  if (queued.length > 0) {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('⏳ QUEUED ITEMS ANALYSIS:');
    console.log('═══════════════════════════════════════════════════════════');
    
    const now = new Date();
    const ready = queued.filter(d => {
      if (!d.scheduled_at) return true;
      return new Date(d.scheduled_at) <= now;
    });
    
    const notReady = queued.filter(d => {
      if (!d.scheduled_at) return false;
      return new Date(d.scheduled_at) > now;
    });
    
    console.log(`\nReady to post: ${ready.length}`);
    console.log(`Scheduled for future: ${notReady.length}`);
    
    if (ready.length > 0) {
      console.log(`\n   Ready items:`);
      for (const item of ready.slice(0, 10)) {
        const age = Math.round((Date.now() - new Date(item.created_at).getTime()) / (60 * 1000));
        console.log(`     - ${item.decision_id.substring(0, 8)}... (${item.decision_type}, ${age}min old)`);
      }
    }
  }
  
  process.exit(0);
}

main().catch(console.error);

