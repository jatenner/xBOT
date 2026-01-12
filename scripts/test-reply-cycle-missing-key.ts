#!/usr/bin/env tsx
/**
 * Test reply cycle with missing OpenAI API key
 * Should write decision row with scored_at and pipeline_error_reason
 */

import 'dotenv/config';
import { attemptScheduledReply } from '../src/jobs/replySystemV2/tieredScheduler';
import { getSupabaseClient } from '../src/db/index';

async function testMissingKey() {
  console.log('🧪 Testing reply cycle with missing OpenAI API key...\n');

  // Save original key
  const originalKey = process.env.OPENAI_API_KEY;
  
  // Remove key
  delete process.env.OPENAI_API_KEY;
  console.log('🔑 Removed OPENAI_API_KEY from environment\n');

  try {
    // Attempt scheduled reply (should fail gracefully)
    console.log('📊 Attempting scheduled reply...');
    const result = await attemptScheduledReply();
    console.log(`Result: ${JSON.stringify(result, null, 2)}\n`);
  } catch (error: any) {
    console.log(`✅ Expected error caught: ${error.message}\n`);
  } finally {
    // Restore original key
    if (originalKey) {
      process.env.OPENAI_API_KEY = originalKey;
    }
  }

  // Wait a moment for DB writes
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Query for recent decision rows with missing key error
  const supabase = getSupabaseClient();
  const { data: rows, error } = await supabase
    .from('reply_decisions')
    .select('id, decision_id, created_at, scored_at, template_selected_at, generation_started_at, pipeline_error_reason, template_status, pipeline_source')
    .eq('pipeline_source', 'reply_v2_scheduler')
    .gte('created_at', new Date(Date.now() - 60000).toISOString()) // Last minute
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error(`❌ Failed to query rows: ${error.message}`);
    process.exit(1);
  }

  console.log('📊 Recent decision rows:');
  if (!rows || rows.length === 0) {
    console.log('   No rows found in last minute');
  } else {
    rows.forEach((row: any, i: number) => {
      console.log(`\n   ${i + 1}. decision_id=${row.decision_id?.substring(0, 12) || 'N/A'}...`);
      console.log(`      created_at: ${row.created_at}`);
      console.log(`      scored_at: ${row.scored_at || 'NULL'}`);
      console.log(`      template_selected_at: ${row.template_selected_at || 'NULL'}`);
      console.log(`      generation_started_at: ${row.generation_started_at || 'NULL'}`);
      console.log(`      pipeline_error_reason: ${row.pipeline_error_reason || 'NULL'}`);
      console.log(`      template_status: ${row.template_status || 'NULL'}`);
      
      if (row.scored_at && row.pipeline_error_reason?.includes('MISSING')) {
        console.log(`      ✅ SUCCESS: scored_at populated and pipeline_error_reason indicates missing key`);
      }
    });
  }

  console.log('\n✅ Test complete');
}

testMissingKey().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
