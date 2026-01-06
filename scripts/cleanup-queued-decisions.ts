/**
 * Cleanup queued decisions that are stale or missing required gate data
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

const hoursArg = process.argv.find(arg => arg.startsWith('--hours='))?.replace('--hours=', '') || process.argv[2] || '6';
const hours = parseInt(hoursArg, 10);

async function main() {
  const supabase = getSupabaseClient();
  const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  
  console.log(`🧹 Cleaning up queued decisions (older than ${hours} hours or missing gate data)`);
  console.log(`   Cutoff: ${cutoffTime}\n`);
  
  // Find queued decisions older than cutoff OR missing required fields
  const { data: staleDecisions, error: fetchError } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, decision_type, status, created_at, target_tweet_content_snapshot, target_tweet_content_hash, semantic_similarity')
    .in('status', ['queued', 'ready'])
    .or(`created_at.lt.${cutoffTime},target_tweet_content_snapshot.is.null`)
    .order('created_at', { ascending: false });
  
  if (fetchError) {
    console.error(`❌ Error fetching decisions: ${fetchError.message}`);
    process.exit(1);
  }
  
  if (!staleDecisions || staleDecisions.length === 0) {
    console.log(`✅ No stale or incomplete decisions found`);
    process.exit(0);
  }
  
  console.log(`📊 Found ${staleDecisions.length} decisions to clean up\n`);
  
  // Categorize by reason
  const byReason: Record<string, typeof staleDecisions> = {
    stale_backlog: [],
    missing_gate_data: [],
    both: [],
  };
  
  for (const d of staleDecisions) {
    const isStale = new Date(d.created_at).getTime() < new Date(cutoffTime).getTime();
    const isMissingSnapshot = !d.target_tweet_content_snapshot;
    
    if (isStale && isMissingSnapshot) {
      byReason.both.push(d);
    } else if (isStale) {
      byReason.stale_backlog.push(d);
    } else if (isMissingSnapshot) {
      byReason.missing_gate_data.push(d);
    }
  }
  
  console.log('📋 Breakdown:');
  console.log(`   Stale backlog (>${hours}h): ${byReason.stale_backlog.length}`);
  console.log(`   Missing gate data: ${byReason.missing_gate_data.length}`);
  console.log(`   Both stale + missing: ${byReason.both.length}\n`);
  
  // Update decisions
  const decisionIds = staleDecisions.map(d => d.decision_id);
  
  // Mark stale backlog as skipped
  const staleIds = [...byReason.stale_backlog, ...byReason.both].map(d => d.decision_id);
  if (staleIds.length > 0) {
    const { error: staleError } = await supabase
      .from('content_generation_metadata_comprehensive')
      .update({
        status: 'skipped',
        skip_reason: 'stale_backlog',
        updated_at: new Date().toISOString(),
      })
      .in('decision_id', staleIds);
    
    if (staleError) {
      console.error(`❌ Error updating stale decisions: ${staleError.message}`);
    } else {
      console.log(`✅ Marked ${staleIds.length} stale decisions as skipped`);
    }
  }
  
  // Mark missing gate data as skipped
  const missingIds = [...byReason.missing_gate_data, ...byReason.both].map(d => d.decision_id);
  if (missingIds.length > 0) {
    const { error: missingError } = await supabase
      .from('content_generation_metadata_comprehensive')
      .update({
        status: 'skipped',
        skip_reason: 'missing_gate_data',
        updated_at: new Date().toISOString(),
      })
      .in('decision_id', missingIds);
    
    if (missingError) {
      console.error(`❌ Error updating missing gate data decisions: ${missingError.message}`);
    } else {
      console.log(`✅ Marked ${missingIds.length} decisions with missing gate data as skipped`);
    }
  }
  
  // Deduplicate: if a decision is in both categories, only update once
  const uniqueIds = Array.from(new Set(decisionIds));
  const totalUpdated = uniqueIds.length;
  
  console.log(`\n✅ Cleanup complete: ${totalUpdated} decisions marked as skipped`);
  console.log(`\n📊 Summary by reason:`);
  console.log(`   stale_backlog: ${byReason.stale_backlog.length + byReason.both.length}`);
  console.log(`   missing_gate_data: ${byReason.missing_gate_data.length + byReason.both.length}`);
  
  process.exit(0);
}

main().catch(console.error);

