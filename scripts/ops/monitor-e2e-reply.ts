#!/usr/bin/env tsx
/**
 * Monitor E2E reply execution
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';

async function main() {
  const supabase = getSupabaseClient();
  const decisionId = process.argv[2] || '644d71d0-8baa-41ea-9eec-527ee8809e30';
  
  console.log(`🔍 Monitoring decision: ${decisionId}\n`);
  
  const maxWaitMs = 15 * 60 * 1000; // 15 minutes
  const pollIntervalMs = 10 * 1000; // 10 seconds
  const startTime = Date.now();
  
  let lastStatus = 'queued';
  let postedDecision: any = null;
  
  while (Date.now() - startTime < maxWaitMs) {
    const { data: decision, error } = await supabase
      .from('content_generation_metadata_comprehensive')
      .select('*')
      .eq('decision_id', decisionId)
      .single();
    
    if (error) {
      console.error(`❌ Error querying decision: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
      continue;
    }
    
    if (!decision) {
      console.error(`❌ Decision not found: ${decisionId}`);
      break;
    }
    
    const features = (decision.features || {}) as any;
    const currentStatus = decision.status;
    const runtimePreflight = features.runtime_preflight_status || 'null';
    const tweetId = decision.tweet_id || 'null';
    
    if (currentStatus !== lastStatus) {
      console.log(`\n📊 Status Change:`);
      console.log(`   ${lastStatus} → ${currentStatus}`);
      console.log(`   runtime_preflight_status: ${runtimePreflight}`);
      console.log(`   tweet_id: ${tweetId}`);
      console.log(`   updated_at: ${decision.updated_at}`);
      lastStatus = currentStatus;
    }
    
    if (currentStatus === 'posted' && tweetId !== 'null') {
      postedDecision = decision;
      console.log(`\n✅ SUCCESS: Reply posted!`);
      console.log(`   decision_id: ${decision.decision_id}`);
      console.log(`   tweet_id: ${tweetId}`);
      console.log(`   status: ${currentStatus}`);
      console.log(`   runtime_preflight_status: ${runtimePreflight}`);
      console.log(`   strategy_id: ${features.strategy_id || 'null'}`);
      console.log(`   posted_at: ${decision.posted_at || 'null'}`);
      break;
    }
    
    if (currentStatus === 'failed' || currentStatus === 'blocked') {
      console.log(`\n❌ FAILED: Status=${currentStatus}`);
      console.log(`   error_message: ${decision.error_message || 'null'}`);
      console.log(`   skip_reason: ${decision.skip_reason || 'null'}`);
      break;
    }
    
    // Show progress every 30 seconds
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    if (elapsed % 30 === 0 && elapsed > 0) {
      process.stdout.write(`\r⏳ Waiting... (${elapsed}s elapsed, status=${currentStatus}, runtime_preflight=${runtimePreflight})`);
    }
    
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }
  
  if (!postedDecision) {
    console.log(`\n⏱️  Timeout: No posted reply after ${Math.floor((Date.now() - startTime) / 1000)}s`);
    
    // Final status check
    const { data: finalDecision } = await supabase
      .from('content_generation_metadata_comprehensive')
      .select('*')
      .eq('decision_id', decisionId)
      .single();
    
    if (finalDecision) {
      const finalFeatures = (finalDecision.features || {}) as any;
      console.log(`\n📊 Final Status:`);
      console.log(`   status: ${finalDecision.status}`);
      console.log(`   runtime_preflight_status: ${finalFeatures.runtime_preflight_status || 'null'}`);
      console.log(`   tweet_id: ${finalDecision.tweet_id || 'null'}`);
      console.log(`   error_message: ${finalDecision.error_message || 'null'}`);
    }
    
    process.exit(1);
  }
  
  // Verify reward
  console.log(`\n🔍 Verifying reward computation...`);
  const rewardFeatures = (postedDecision.features || {}) as any;
  const reward = rewardFeatures.reward;
  
  if (reward !== undefined && reward !== null) {
    console.log(`✅ Reward computed: ${reward}`);
  } else {
    console.log(`⚠️  Reward not yet computed (may be computed asynchronously)`);
  }
  
  // SQL evidence
  console.log(`\n📋 SQL Evidence:`);
  console.log(`SELECT decision_id, status, tweet_id,`);
  console.log(`       features->>'runtime_preflight_status' AS runtime_preflight_status,`);
  console.log(`       features->>'strategy_id' AS strategy_id,`);
  console.log(`       features->>'reward' AS reward,`);
  console.log(`       posted_at`);
  console.log(`FROM content_generation_metadata_comprehensive`);
  console.log(`WHERE decision_id = '${decisionId}';`);
  
  process.exit(0);
}

main().catch(console.error);
