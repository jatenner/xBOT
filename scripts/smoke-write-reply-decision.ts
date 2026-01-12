#!/usr/bin/env tsx
/**
 * Smoke test: Write a reply decision row with timestamps to prove DB writes work
 */

import 'dotenv/config';
import { recordReplyDecision } from '../src/jobs/replySystemV2/replyDecisionRecorder';
import { getSupabaseClient } from '../src/db/index';

async function smokeTest() {
  console.log('🧪 Smoke test: Writing reply decision with timestamps...\n');

  const { randomUUID } = await import('crypto');
  const decisionId = randomUUID();
  const scoredAt = new Date().toISOString();

  try {
    // Write decision row (same code path as tieredScheduler)
    await recordReplyDecision({
      decision_id: decisionId,
      target_tweet_id: '1234567890', // Dummy tweet ID
      target_in_reply_to_tweet_id: null,
      root_tweet_id: '1234567890',
      ancestry_depth: 0,
      is_root: true,
      decision: 'DENY',
      reason: 'Smoke test - deterministic write',
      status: 'OK',
      confidence: 'HIGH',
      method: 'smoke_test',
      cache_hit: false,
      scored_at: scoredAt, // 🎯 PIPELINE STAGES
      template_status: 'PENDING',
      trace_id: 'smoke_test_trace',
      job_run_id: 'smoke_test_job',
      pipeline_source: 'smoke_test',
    });

    console.log(`✅ Decision row written: decision_id=${decisionId}`);
    console.log(`   scored_at=${scoredAt}\n`);

    // Query back the inserted row
    const supabase = getSupabaseClient();
    const { data: row, error } = await supabase
      .from('reply_decisions')
      .select('id, decision_id, created_at, scored_at, template_selected_at, generation_started_at, generation_completed_at, posting_started_at, posting_completed_at, pipeline_error_reason, template_status')
      .eq('decision_id', decisionId)
      .single();

    if (error) {
      console.error(`❌ Failed to query row: ${error.message}`);
      process.exit(1);
    }

    if (!row) {
      console.error('❌ Row not found after insert');
      process.exit(1);
    }

    console.log('📊 Inserted row details:');
    console.log(`   id: ${row.id}`);
    console.log(`   decision_id: ${row.decision_id}`);
    console.log(`   created_at: ${row.created_at}`);
    console.log(`   scored_at: ${row.scored_at || 'NULL'}`);
    console.log(`   template_selected_at: ${row.template_selected_at || 'NULL'}`);
    console.log(`   generation_started_at: ${row.generation_started_at || 'NULL'}`);
    console.log(`   generation_completed_at: ${row.generation_completed_at || 'NULL'}`);
    console.log(`   posting_started_at: ${row.posting_started_at || 'NULL'}`);
    console.log(`   posting_completed_at: ${row.posting_completed_at || 'NULL'}`);
    console.log(`   pipeline_error_reason: ${row.pipeline_error_reason || 'NULL'}`);
    console.log(`   template_status: ${row.template_status || 'NULL'}`);

    // Verify scored_at is populated
    if (row.scored_at) {
      console.log('\n✅ SUCCESS: scored_at is populated');
      console.log(`   scored_at=${row.scored_at}`);
    } else {
      console.log('\n❌ FAILURE: scored_at is NULL');
      process.exit(1);
    }

    console.log('\n✅ Smoke test complete');

  } catch (error: any) {
    console.error('❌ Smoke test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

smokeTest().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
