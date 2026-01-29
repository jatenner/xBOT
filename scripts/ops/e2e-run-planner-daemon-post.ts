#!/usr/bin/env tsx
/**
 * 🔒 E2E OPS SCRIPT: Planner → Daemon → Posted Reply
 * 
 * Orchestrates:
 * 1. Run planner once (creates queued decisions)
 * 2. Wait for decisions to be created
 * 3. Run Mac Runner daemon (processes decisions)
 * 4. Monitor for at least 1 posted reply
 * 5. Assert success criteria
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';
import { execSync } from 'child_process';

const MAX_WAIT_MINUTES = 15;
const CHECK_INTERVAL_SECONDS = 30;

async function main() {
  console.log('🔒 E2E: Planner → Daemon → Posted Reply\n');
  
  const supabase = getSupabaseClient();
  const startTime = Date.now();
  
  // Step 1: Run planner once
  console.log('Step 1: Running planner...');
  try {
    execSync('railway run --service xBOT pnpm tsx scripts/ops/run-reply-v2-planner-once.ts', {
      stdio: 'inherit',
      env: { ...process.env },
    });
    console.log('✅ Planner completed\n');
  } catch (error: any) {
    console.error(`❌ Planner failed: ${error.message}`);
    process.exit(1);
  }
  
  // Step 2: Wait for decisions to be created
  console.log('Step 2: Waiting for queued decisions...');
  await new Promise(resolve => setTimeout(resolve, 10000)); // 10s wait
  
  const { data: queuedDecisions } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, features')
    .eq('pipeline_source', 'reply_v2_planner')
    .eq('status', 'queued')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (!queuedDecisions || queuedDecisions.length === 0) {
    console.log('❌ FAIL: No queued decisions found after planner run');
    process.exit(1);
  }
  
  console.log(`✅ Found ${queuedDecisions.length} queued decisions\n`);
  
  // Step 3: Check if Mac Runner is running
  console.log('Step 3: Checking Mac Runner daemon...');
  console.log('⚠️  NOTE: Mac Runner daemon should be started separately:');
  console.log('   RUNNER_MODE=true RUNNER_PROFILE_DIR=./.runner-profile EXECUTION_MODE=executor HEADLESS=true pnpm run executor:daemon\n');
  
  // Step 4: Monitor for posted reply
  console.log('Step 4: Monitoring for posted reply...');
  const decisionIds = queuedDecisions.map((d: any) => d.decision_id);
  
  let postedCount = 0;
  let elapsedMinutes = 0;
  
  while (elapsedMinutes < MAX_WAIT_MINUTES) {
    const { data: postedDecisions } = await supabase
      .from('content_generation_metadata_comprehensive')
      .select('decision_id, status, features, tweet_id, updated_at')
      .in('decision_id', decisionIds)
      .eq('status', 'posted');
    
    postedCount = postedDecisions?.length || 0;
    
    if (postedCount > 0) {
      console.log(`✅ SUCCESS: ${postedCount} decision(s) posted!`);
      for (const decision of postedDecisions || []) {
        const features = (decision.features || {}) as Record<string, any>;
        console.log(`   - decision_id: ${decision.decision_id}`);
        console.log(`   - tweet_id: ${decision.tweet_id || 'pending'}`);
        console.log(`   - preflight_status: ${features.preflight_status || 'unknown'}`);
        console.log(`   - strategy_id: ${features.strategy_id || 'unknown'}`);
      }
      break;
    }
    
    // Check status distribution
    const { data: statusData } = await supabase
      .from('content_generation_metadata_comprehensive')
      .select('status')
      .in('decision_id', decisionIds);
    
    const statusCounts: Record<string, number> = {};
    for (const row of statusData || []) {
      statusCounts[row.status] = (statusCounts[row.status] || 0) + 1;
    }
    
    console.log(`   [${elapsedMinutes}m] Status: ${JSON.stringify(statusCounts)}`);
    
    await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL_SECONDS * 1000));
    elapsedMinutes = Math.floor((Date.now() - startTime) / 60000);
  }
  
  // Step 5: Assert success
  if (postedCount === 0) {
    console.log(`\n❌ FAIL: No decisions posted after ${elapsedMinutes} minutes`);
    console.log('   Check Mac Runner logs for errors');
    process.exit(1);
  }
  
  // Step 6: Verify reward (may be delayed)
  console.log('\nStep 5: Checking for reward computation...');
  const { data: rewardDecisions } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, features')
    .in('decision_id', decisionIds)
    .not('features->reward', 'is', null);
  
  if (rewardDecisions && rewardDecisions.length > 0) {
    console.log(`✅ Found ${rewardDecisions.length} decision(s) with reward`);
  } else {
    console.log('⚠️  No rewards yet (metrics scraper may not have run)');
  }
  
  console.log('\n✅ E2E TEST PASSED');
  process.exit(0);
}

main().catch((error) => {
  console.error('❌ E2E TEST FAILED:', error.message);
  process.exit(1);
});
