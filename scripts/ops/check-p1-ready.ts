#!/usr/bin/env tsx
/**
 * P1 Readiness Check
 * Fails if any blocker prevents P1 completion
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';
import { Client } from 'pg';
import { isAuthBlocked } from '../../src/utils/authFreshnessCheck';

async function main() {
  const supabase = getSupabaseClient();
  const dbUrl = process.env.DATABASE_URL!;
  const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  
  await client.connect();
  
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('🎯 P1 Readiness Check');
  console.log('═══════════════════════════════════════════════════════════════════════════════\n');
  
  const blockers: string[] = [];
  
  // 1. Check auth freshness (executor-only blocker)
  console.log('1. Checking auth freshness...');
  const executionMode = process.env.EXECUTION_MODE || 'control';
  const isExecutorMode = executionMode === 'executor' && process.env.RUNNER_MODE === 'true';
  
  const authBlocked = await isAuthBlocked();
  if (authBlocked.blocked) {
    if (isExecutorMode) {
      blockers.push(`Executor auth invalid: ${authBlocked.reason}`);
      console.log(`   ❌ BLOCKED: ${authBlocked.reason}`);
    } else {
      console.log(`   ⚠️ WARNING: Railway not authenticated (${authBlocked.reason}) - public discovery only`);
      console.log(`   ✅ Not a blocker (Railway can run public discovery without auth)`);
    }
  } else {
    console.log('   ✅ Auth valid');
  }
  
  // 2. Check for public_search_* candidates
  console.log('\n2. Checking public_search_* candidates...');
  const { rows: publicCandidates } = await client.query(`
    SELECT COUNT(*) as count
    FROM reply_opportunities
    WHERE discovery_source LIKE 'public_search_%'
    AND replied_to = false
    AND created_at >= NOW() - INTERVAL '24 hours';
  `);
  
  const publicCount = parseInt(publicCandidates[0]?.count || '0', 10);
  if (publicCount === 0) {
    blockers.push('No public_search_* candidates found in last 24h');
    console.log('   ❌ BLOCKED: No public candidates');
  } else {
    console.log(`   ✅ Found ${publicCount} public candidates`);
  }
  
  // 3. Check accessibility status distribution
  console.log('\n3. Checking accessibility status...');
  const { rows: accessibilityDist } = await client.query(`
    SELECT accessibility_status, COUNT(*) as count
    FROM reply_opportunities
    WHERE discovery_source LIKE 'public_search_%'
    AND replied_to = false
    AND created_at >= NOW() - INTERVAL '24 hours'
    GROUP BY accessibility_status;
  `);
  
  const okCount = accessibilityDist.find((r: any) => r.accessibility_status === 'ok')?.count || 0;
  const unknownCount = accessibilityDist.find((r: any) => r.accessibility_status === 'unknown' || !r.accessibility_status)?.count || 0;
  const forbiddenCount = accessibilityDist.find((r: any) => r.accessibility_status === 'forbidden')?.count || 0;
  
  console.log(`   OK: ${okCount}, Unknown: ${unknownCount}, Forbidden: ${forbiddenCount}`);
  
  if (okCount === 0 && unknownCount === 0) {
    blockers.push('All public candidates are forbidden/login_wall');
    console.log('   ❌ BLOCKED: No accessible candidates');
  } else if (okCount === 0 && unknownCount > 0) {
    console.log('   ⚠️ WARNING: Candidates not yet probed (may be OK)');
  } else {
    console.log('   ✅ Accessible candidates available');
  }
  
  // 4. Check scheduler can create decisions
  console.log('\n4. Checking scheduler decision creation...');
  const { rows: recentDecisions } = await client.query(`
    SELECT COUNT(*) as count
    FROM content_generation_metadata_comprehensive
    WHERE decision_type = 'reply'
    AND pipeline_source = 'reply_v2_planner'
    AND created_at >= NOW() - INTERVAL '24 hours';
  `);
  
  const decisionCount = parseInt(recentDecisions[0]?.count || '0', 10);
  if (decisionCount === 0) {
    blockers.push('No decisions created by scheduler in last 24h');
    console.log('   ❌ BLOCKED: No decisions created');
  } else {
    console.log(`   ✅ ${decisionCount} decisions created`);
  }
  
  // 5. Check executor can claim decisions (if executor running)
  console.log('\n5. Checking executor claim capability...');
  const { rows: queuedDecisions } = await client.query(`
    SELECT COUNT(*) as count
    FROM content_generation_metadata_comprehensive
    WHERE decision_type = 'reply'
    AND status = 'queued'
    AND created_at >= NOW() - INTERVAL '24 hours';
  `);
  
  const queuedCount = parseInt(queuedDecisions[0]?.count || '0', 10);
  if (queuedCount > 0) {
    console.log(`   ✅ ${queuedCount} decisions queued (executor can claim)`);
  } else {
    console.log('   ⚠️ No queued decisions (may be normal if executor is processing)');
  }
  
  // Summary
  console.log('\n═══════════════════════════════════════════════════════════════════════════════');
  if (blockers.length === 0) {
    console.log('✅ P1 READY: No blockers detected');
    await client.end();
    process.exit(0);
  } else {
    console.log('❌ P1 NOT READY: Blockers detected');
    console.log('\nBlockers:');
    blockers.forEach((b, i) => console.log(`   ${i + 1}. ${b}`));
    await client.end();
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ P1 readiness check failed:', error);
  process.exit(1);
});
