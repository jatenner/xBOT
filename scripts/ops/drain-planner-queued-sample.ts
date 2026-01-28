#!/usr/bin/env tsx
/**
 * 🔍 DRAIN PLANNER QUEUED SAMPLE
 * 
 * One-time production validation script (read-only).
 * Queries up to 5 queued decisions from reply_v2_planner pipeline.
 * Does NOT mutate DB - only prints IDs for operator observation.
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';

async function main(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('     🔍 DRAIN PLANNER QUEUED SAMPLE (Read-Only)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const supabase = getSupabaseClient();
  
  // Query queued planner decisions
  const { data: decisions, error } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, created_at, status, content, features')
    .eq('decision_type', 'reply')
    .eq('pipeline_source', 'reply_v2_planner')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(5);
  
  if (error) {
    console.error(`❌ Query failed: ${error.message}`);
    process.exit(1);
  }
  
  if (!decisions || decisions.length === 0) {
    console.log('ℹ️  No queued planner decisions found.');
    console.log('\n📋 Next steps:');
    console.log('   1. Wait for Railway planner to create new decisions');
    console.log('   2. Run Mac Runner daemon: pnpm run executor:daemon');
    console.log('   3. Observe status transitions: queued → posting_attempt → posted');
    process.exit(0);
  }
  
  console.log(`📊 Found ${decisions.length} queued planner decisions:\n`);
  
  decisions.forEach((decision, index) => {
    const features = (decision.features || {}) as Record<string, any>;
    const contentPreview = decision.content 
      ? (decision.content.length > 50 ? decision.content.substring(0, 50) + '...' : decision.content)
      : '[empty]';
    
    console.log(`${index + 1}. Decision ID: ${decision.decision_id}`);
    console.log(`   Created: ${decision.created_at}`);
    console.log(`   Status: ${decision.status}`);
    console.log(`   Content: ${contentPreview}`);
    console.log(`   Strategy: ${features.strategy_id || 'unknown'}`);
    console.log(`   Plan Mode: ${features.plan_mode || 'unknown'}`);
    console.log('');
  });
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 Next Steps:');
  console.log('');
  console.log('1. Start Mac Runner daemon:');
  console.log('   RUNNER_MODE=true RUNNER_PROFILE_DIR=./.runner-profile \\');
  console.log('   EXECUTION_MODE=executor HEADLESS=true pnpm run executor:daemon');
  console.log('');
  console.log('2. Monitor status transitions:');
  console.log('   psql "$DATABASE_URL" -c "');
  console.log('     SELECT decision_id, status, updated_at');
  console.log('     FROM content_generation_metadata_comprehensive');
  console.log('     WHERE decision_id IN (');
  decisions.forEach((d, i) => {
    console.log(`       '\''${d.decision_id}'\''${i < decisions.length - 1 ? ',' : ''}`);
  });
  console.log('     )');
  console.log('     ORDER BY updated_at DESC;');
  console.log('   "');
  console.log('');
  console.log('3. Expected transitions:');
  console.log('   queued → posting_attempt → posted');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main().catch(error => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});
