#!/usr/bin/env tsx
/**
 * 🔍 QUERY REPLY_DECISIONS: Simple query script for validation
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db';

async function queryDecisions() {
  const supabase = getSupabaseClient();
  
  console.log('\n📊 Querying reply_decisions table...\n');
  
  // Check table exists
  const { data: rows, error } = await supabase
    .from('reply_decisions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (error) {
    console.error(`❌ Error: ${error.message}`);
    if (error.code === '42P01') {
      console.error('   Table does not exist! Run migration first.');
    }
    process.exit(1);
  }
  
  if (!rows || rows.length === 0) {
    console.log('ℹ️  No rows found in reply_decisions table');
    console.log('   Run validate-forensic-pipeline.ts to generate test rows');
    return;
  }
  
  console.log(`✅ Found ${rows.length} row(s):\n`);
  
  rows.forEach((row, i) => {
    console.log(`[${i + 1}] ID: ${row.id}`);
    console.log(`    Created: ${row.created_at}`);
    console.log(`    Target Tweet: ${row.target_tweet_id}`);
    console.log(`    Root Tweet: ${row.root_tweet_id}`);
    console.log(`    Depth: ${row.ancestry_depth}, Is Root: ${row.is_root}`);
    console.log(`    Decision: ${row.decision}`);
    console.log(`    Reason: ${row.reason || 'N/A'}`);
    console.log(`    Pipeline: ${row.pipeline_source || 'N/A'}`);
    console.log(`    Posted Tweet ID: ${row.posted_reply_tweet_id || 'N/A'}`);
    console.log('');
  });
  
  // Summary
  const allowCount = rows.filter(r => r.decision === 'ALLOW').length;
  const denyCount = rows.filter(r => r.decision === 'DENY').length;
  const rootCount = rows.filter(r => r.is_root).length;
  const nonRootCount = rows.filter(r => !r.is_root).length;
  
  console.log('📊 Summary:');
  console.log(`   ALLOW: ${allowCount}, DENY: ${denyCount}`);
  console.log(`   Root tweets: ${rootCount}, Non-root: ${nonRootCount}`);
}

queryDecisions().catch((error) => {
  console.error('❌ Query failed:', error);
  process.exit(1);
});
