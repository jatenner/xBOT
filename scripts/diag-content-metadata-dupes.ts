#!/usr/bin/env tsx
/**
 * Diagnose content_metadata duplicates and missing rows
 * Usage: pnpm exec tsx scripts/diag-content-metadata-dupes.ts [decision_id]
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db';

async function main() {
  const specificDecisionId = process.argv[2];
  const supabase = getSupabaseClient();
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('           🔍 CONTENT_METADATA DUPLICATE DIAGNOSTICS\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // 1. Count duplicates (decision_id with count > 1)
  console.log('📊 STEP 1: Duplicate decision_ids\n');
  const { data: duplicates, error: dupError } = await supabase
    .from('content_metadata')
    .select('decision_id')
    .not('decision_id', 'is', null);
  
  if (dupError) {
    console.error(`❌ Error querying duplicates: ${dupError.message}`);
    process.exit(1);
  }
  
  // Group by decision_id and count
  const decisionIdCounts = new Map<string, number>();
  (duplicates || []).forEach((row: any) => {
    const did = String(row.decision_id || '');
    decisionIdCounts.set(did, (decisionIdCounts.get(did) || 0) + 1);
  });
  
  const duplicateIds = Array.from(decisionIdCounts.entries())
    .filter(([_, count]) => count > 1)
    .map(([id, count]) => ({ decision_id: id, count }));
  
  console.log(`Total decision_ids with duplicates: ${duplicateIds.length}`);
  if (duplicateIds.length > 0) {
    console.log('\nTop 10 duplicates:');
    duplicateIds
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .forEach(({ decision_id, count }) => {
        console.log(`  - ${decision_id}: ${count} rows`);
      });
  }
  
  // 2. If specific decision_id provided, show all rows for it
  if (specificDecisionId) {
    console.log(`\n📋 STEP 2: All rows for decision_id=${specificDecisionId}\n`);
    const { data: rows, error: rowsError } = await supabase
      .from('content_metadata')
      .select('id, decision_id, status, created_at, updated_at, scheduled_at, content')
      .eq('decision_id', specificDecisionId)
      .order('created_at', { ascending: false });
    
    if (rowsError) {
      console.error(`❌ Error querying rows: ${rowsError.message}`);
    } else if (!rows || rows.length === 0) {
      console.log(`⚠️  No rows found for decision_id=${specificDecisionId}`);
    } else {
      console.log(`Found ${rows.length} row(s):\n`);
      rows.forEach((row: any, idx: number) => {
        console.log(`Row ${idx + 1}:`);
        console.log(`  id: ${row.id}`);
        console.log(`  decision_id: ${row.decision_id}`);
        console.log(`  status: ${row.status}`);
        console.log(`  created_at: ${row.created_at}`);
        console.log(`  updated_at: ${row.updated_at || 'NULL'}`);
        console.log(`  scheduled_at: ${row.scheduled_at || 'NULL'}`);
        console.log(`  content_preview: ${(row.content || '').substring(0, 100)}...`);
        console.log('');
      });
    }
  }
  
  // 3. Count decisions with scheduled_at not null but missing content_metadata
  console.log('\n📊 STEP 3: Missing content_metadata rows\n');
  
  // Check reply_decisions with template_status=SET but no content_metadata
  const { data: missingMetadata, error: missingError } = await supabase
    .from('reply_decisions')
    .select('id, decision_id, target_tweet_id, template_status, generation_completed_at')
    .eq('template_status', 'SET')
    .not('generation_completed_at', 'is', null)
    .limit(100);
  
  if (missingError) {
    console.error(`❌ Error querying missing metadata: ${missingError.message}`);
  } else {
    const missingCount = [];
    for (const decision of (missingMetadata || [])) {
      const decisionId = decision.decision_id || decision.id;
      const { data: metadata } = await supabase
        .from('content_metadata')
        .select('decision_id')
        .eq('decision_id', decisionId)
        .limit(1);
      
      if (!metadata || metadata.length === 0) {
        missingCount.push({
          decision_id: decisionId,
          target_tweet_id: decision.target_tweet_id,
        });
      }
    }
    
    console.log(`Decisions with generation_completed_at but no content_metadata: ${missingCount.length}`);
    if (missingCount.length > 0 && missingCount.length <= 10) {
      console.log('\nMissing rows:');
      missingCount.forEach(({ decision_id, target_tweet_id }) => {
        console.log(`  - decision_id=${decision_id}, target_tweet_id=${target_tweet_id}`);
      });
    }
  }
  
  // 4. Check for scheduled_at not null but status != queued
  console.log('\n📊 STEP 4: Scheduled but not queued\n');
  const { data: scheduledNotQueued, error: scheduledError } = await supabase
    .from('content_metadata')
    .select('decision_id, status, scheduled_at')
    .not('scheduled_at', 'is', null)
    .neq('status', 'queued')
    .limit(20);
  
  if (scheduledError) {
    console.error(`❌ Error querying scheduled: ${scheduledError.message}`);
  } else {
    console.log(`Rows with scheduled_at but status != queued: ${(scheduledNotQueued || []).length}`);
    if (scheduledNotQueued && scheduledNotQueued.length > 0 && scheduledNotQueued.length <= 10) {
      scheduledNotQueued.forEach((row: any) => {
        console.log(`  - decision_id=${row.decision_id}, status=${row.status}, scheduled_at=${row.scheduled_at}`);
      });
    }
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
