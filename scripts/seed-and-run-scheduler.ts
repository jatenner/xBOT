#!/usr/bin/env tsx
/**
 * Seed queue and immediately trigger scheduler
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { getSupabaseClient } from '../src/db';

async function main() {
  console.log('=== Seed and Run Scheduler ===\n');
  
  // Step 1: Seed candidates
  console.log('Step 1: Seeding candidates...');
  const { execSync } = await import('child_process');
  try {
    execSync('pnpm exec tsx scripts/seed-reply-candidates.ts --count=20', {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
  } catch (error: any) {
    console.error(`❌ Seeding failed: ${error.message}`);
    process.exit(1);
  }
  
  console.log('\nStep 2: Triggering scheduler...');
  
  // Step 2: Trigger scheduler
  const { attemptScheduledReply } = await import('../src/jobs/replySystemV2/tieredScheduler');
  
  try {
    const result = await attemptScheduledReply();
    console.log(`\n✅ Scheduler completed:`);
    console.log(`   Posted: ${result.posted}`);
    console.log(`   Reason: ${result.reason}`);
    if (result.candidate_tweet_id) {
      console.log(`   Candidate: ${result.candidate_tweet_id}`);
    }
  } catch (error: any) {
    console.error(`❌ Scheduler error: ${error.message}`);
    console.error(error.stack);
  }
  
  // Step 3: Query decisions created in last 5 minutes
  console.log('\nStep 3: Querying decisions (last 5 minutes)...');
  const supabase = getSupabaseClient();
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  
  const { data: decisions, error: decisionsError } = await supabase
    .from('reply_decisions')
    .select('decision_id, target_tweet_id, decision, deny_reason_code, deny_reason_detail, pipeline_source, created_at')
    .gte('created_at', fiveMinutesAgo)
    .order('created_at', { ascending: false });
  
  if (decisionsError) {
    console.error(`❌ Query error: ${decisionsError.message}`);
    return;
  }
  
  const allowCount = decisions?.filter(d => d.decision === 'ALLOW').length || 0;
  const denyCount = decisions?.filter(d => d.decision === 'DENY').length || 0;
  
  console.log(`\n📊 Decision Summary:`);
  console.log(`   ALLOW: ${allowCount}`);
  console.log(`   DENY: ${denyCount}`);
  console.log(`   TOTAL: ${decisions?.length || 0}`);
  
  // Deny reason breakdown
  const denyReasons = new Map<string, number>();
  decisions?.filter(d => d.decision === 'DENY').forEach(d => {
    const reason = d.deny_reason_code || 'UNKNOWN';
    denyReasons.set(reason, (denyReasons.get(reason) || 0) + 1);
  });
  
  if (denyReasons.size > 0) {
    console.log(`\n📋 DENY Reason Breakdown:`);
    for (const [reason, count] of Array.from(denyReasons.entries()).sort((a, b) => b[1] - a[1])) {
      console.log(`   ${reason}: ${count}`);
    }
  }
  
  // Show 5 newest rows
  console.log(`\n📋 5 Newest Decisions:`);
  const newest = decisions?.slice(0, 5) || [];
  newest.forEach((d, i) => {
    console.log(`\n   [${i + 1}] ${d.created_at}`);
    console.log(`       decision_id: ${d.decision_id}`);
    console.log(`       target_tweet_id: ${d.target_tweet_id}`);
    console.log(`       decision: ${d.decision}`);
    if (d.deny_reason_code) {
      console.log(`       deny_reason_code: ${d.deny_reason_code}`);
    }
    if (d.deny_reason_detail) {
      console.log(`       deny_reason_detail: ${d.deny_reason_detail.substring(0, 150)}...`);
    }
    console.log(`       pipeline_source: ${d.pipeline_source || 'null'}`);
  });
}

main().catch(console.error);
