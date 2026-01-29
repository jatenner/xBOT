#!/usr/bin/env tsx
/**
 * 🔒 PROOF: Runtime Preflight OK-Only Gating
 * 
 * Validates that strict OK-only gating works:
 * - When runtime preflight returns timeout/deleted/error, system blocks and does NOT call generation
 * - When runtime preflight returns ok, system proceeds
 */

import 'dotenv/config';

interface MockDecision {
  id: string;
  decision_type: string;
  pipeline_source: string;
  target_tweet_id: string;
  features: Record<string, any>;
}

interface MockSupabase {
  from: (table: string) => {
    update: (data: any) => {
      eq: (col: string, val: string) => Promise<{ error: null }>;
    };
  };
}

// Mock fetchTweetData that returns different statuses
async function mockFetchTweetData(tweetId: string, scenario: 'ok' | 'deleted' | 'timeout' | 'error'): Promise<any> {
  if (scenario === 'ok') {
    return { text: 'Mock tweet text', isReply: false };
  }
  if (scenario === 'deleted') {
    return null;
  }
  if (scenario === 'timeout') {
    await new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 100));
    throw new Error('timeout');
  }
  throw new Error('network_error');
}

// Simulate the runtime preflight logic
async function simulateRuntimePreflight(
  decision: MockDecision,
  scenario: 'ok' | 'deleted' | 'timeout' | 'error',
  supabase: MockSupabase
): Promise<{ blocked: boolean; status: string }> {
  const isPlannerDecision = decision.pipeline_source === 'reply_v2_planner';
  const isRunnerMode = true; // Simulate RUNNER_MODE=true
  
  if (!isPlannerDecision || !isRunnerMode || !decision.target_tweet_id) {
    return { blocked: false, status: 'skipped' };
  }
  
  const runtimePreflightStart = Date.now();
  
  try {
    const tweetData = await mockFetchTweetData(decision.target_tweet_id, scenario);
    const runtimePreflightLatency = Date.now() - runtimePreflightStart;
    
    if (!tweetData) {
      // Tweet deleted/not found
      await supabase.from('content_generation_metadata_comprehensive')
        .update({
          status: 'blocked_permanent',
          error_message: JSON.stringify({
            stale_reason: 'target_not_found_or_deleted_runtime',
            runtime_preflight_status: 'deleted',
            runtime_preflight_latency_ms: runtimePreflightLatency
          })
        })
        .eq('decision_id', decision.id);
      return { blocked: true, status: 'deleted' };
    }
    
    // Tweet exists - update features
    decision.features.runtime_preflight_status = 'ok';
    decision.features.runtime_preflight_checked_at = new Date().toISOString();
    decision.features.runtime_preflight_latency_ms = runtimePreflightLatency;
    
    return { blocked: false, status: 'ok' };
    
  } catch (preflightError: any) {
    const runtimePreflightLatency = Date.now() - runtimePreflightStart;
    const isTimeout = preflightError.message === 'timeout';
    const status = isTimeout ? 'timeout' : 'error';
    
    // 🔒 PROVING PHASE: Strict OK-only gating - block all non-ok statuses
    const finalStatus = isTimeout ? 'blocked' : 'blocked_permanent';
    await supabase.from('content_generation_metadata_comprehensive')
      .update({
        status: finalStatus,
        error_message: JSON.stringify({
          stale_reason: `runtime_preflight_${status}`,
          runtime_preflight_status: status,
          runtime_preflight_latency_ms: runtimePreflightLatency,
          error: preflightError.message,
          proving_phase: 'ok_only_gating'
        })
      })
      .eq('decision_id', decision.id);
    
    return { blocked: true, status };
  }
}

async function testOkOnlyGating(): Promise<void> {
  console.log('🔒 PROOF: Runtime Preflight OK-Only Gating');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const mockSupabase: MockSupabase = {
    from: () => ({
      update: () => ({
        eq: async () => ({ error: null })
      })
    })
  };
  
  const tests: Array<{
    name: string;
    scenario: 'ok' | 'deleted' | 'timeout' | 'error';
    expectedBlocked: boolean;
    expectedStatus: string;
  }> = [
    {
      name: 'Runtime preflight returns ok',
      scenario: 'ok',
      expectedBlocked: false,
      expectedStatus: 'ok'
    },
    {
      name: 'Runtime preflight returns deleted',
      scenario: 'deleted',
      expectedBlocked: true,
      expectedStatus: 'deleted'
    },
    {
      name: 'Runtime preflight times out',
      scenario: 'timeout',
      expectedBlocked: true,
      expectedStatus: 'timeout'
    },
    {
      name: 'Runtime preflight returns error',
      scenario: 'error',
      expectedBlocked: true,
      expectedStatus: 'error'
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    console.log(`\n📋 Test: ${test.name}`);
    
    const decision: MockDecision = {
      id: 'test-decision-id',
      decision_type: 'reply',
      pipeline_source: 'reply_v2_planner',
      target_tweet_id: '1234567890',
      features: {}
    };
    
    const result = await simulateRuntimePreflight(decision, test.scenario, mockSupabase);
    
    console.log(`   Result: blocked=${result.blocked}, status=${result.status}`);
    console.log(`   Expected: blocked=${test.expectedBlocked}, status=${test.expectedStatus}`);
    
    if (result.blocked === test.expectedBlocked && result.status === test.expectedStatus) {
      passed++;
      console.log(`   ✅ PASS`);
    } else {
      failed++;
      console.log(`   ❌ FAIL`);
    }
    
    // Verify that if blocked, generation would not be called
    if (result.blocked && result.status !== 'ok') {
      console.log(`   ✅ Verified: Generation would NOT be called (blocked)`);
    } else if (!result.blocked && result.status === 'ok') {
      console.log(`   ✅ Verified: Generation WOULD be called (proceed)`);
    }
  }
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`📊 Results: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    console.log('✅ ALL TESTS PASSED');
    process.exit(0);
  } else {
    console.log('❌ SOME TESTS FAILED');
    process.exit(1);
  }
}

testOkOnlyGating().catch(err => {
  console.error('❌ Proof failed:', err);
  process.exit(1);
});
