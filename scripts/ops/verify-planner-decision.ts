#!/usr/bin/env tsx
/**
 * Verify planner decision details
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';

async function main() {
  const supabase = getSupabaseClient();
  
  const decisionId = process.argv[2] || '644d71d0-8baa-41ea-9eec-527ee8809e30';
  
  const { data: decision, error } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('*')
    .eq('decision_id', decisionId)
    .single();
  
  if (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
  
  if (!decision) {
    console.error(`❌ Decision not found: ${decisionId}`);
    process.exit(1);
  }
  
  const features = (decision.features || {}) as any;
  
  console.log('📊 Decision Details:');
  console.log(`   decision_id: ${decision.decision_id}`);
  console.log(`   status: ${decision.status}`);
  console.log(`   pipeline_source: ${decision.pipeline_source}`);
  console.log(`   target_tweet_id: ${decision.target_tweet_id}`);
  console.log(`   preflight_status: ${features.preflight_status || 'null'}`);
  console.log(`   preflight_ok: ${features.preflight_ok || 'null'}`);
  console.log(`   strategy_id: ${features.strategy_id || 'null'}`);
  console.log(`   runtime_preflight_status: ${features.runtime_preflight_status || 'null'}`);
  console.log(`   created_at: ${decision.created_at}`);
  console.log(`   updated_at: ${decision.updated_at}`);
  
  // SQL snapshot
  console.log('\n📋 SQL Snapshot:');
  console.log(`SELECT decision_id, status, pipeline_source, target_tweet_id,`);
  console.log(`       features->>'preflight_status' AS preflight_status,`);
  console.log(`       features->>'preflight_ok' AS preflight_ok,`);
  console.log(`       features->>'strategy_id' AS strategy_id,`);
  console.log(`       features->>'runtime_preflight_status' AS runtime_preflight_status`);
  console.log(`FROM content_generation_metadata_comprehensive`);
  console.log(`WHERE decision_id = '${decision.decision_id}';`);
}

main().catch(console.error);
