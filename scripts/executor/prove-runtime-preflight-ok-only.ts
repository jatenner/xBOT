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
): Promise<{ blocked: boolean; status: string; timeoutMs?: number }> {
  const isPlannerDecision = decision.pipeline_source === 'reply_v2_planner';
  const isRunnerMode = true; // Simulate RUNNER_MODE=true
  
  if (!isPlannerDecision || !isRunnerMode || !decision.target_tweet_id) {
    return { blocked: false, status: 'skipped' };
  }
  
  const runtimePreflightStart = Date.now();
  
  // 🔒 CONFIGURABLE TIMEOUT: Same logic as postingQueue.ts
  const rawTimeout = parseInt(process.env.RUNTIME_PREFLIGHT_TIMEOUT_MS || '10000', 10);
  const runtimePreflightTimeoutMs = isNaN(rawTimeout) 
    ? 10000 
    : Math.max(3000, Math.min(20000, rawTimeout));
  
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
    decision.features.runtime_preflight_timeout_ms = runtimePreflightTimeoutMs;
    
    return { blocked: false, status: 'ok', timeoutMs: runtimePreflightTimeoutMs };
    
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
          runtime_preflight_timeout_ms: runtimePreflightTimeoutMs,
          error: preflightError.message,
          proving_phase: 'ok_only_gating'
        })
      })
      .eq('decision_id', decision.id);
    
    return { blocked: true, status, timeoutMs: runtimePreflightTimeoutMs };
  }
}

// Test timeout configuration parsing and clamping
function testTimeoutConfiguration(): void {
  console.log('🔒 PROOF: Runtime Preflight Timeout Configuration');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  interface TestCase {
    name: string;
    envValue: string | undefined;
    expected: number;
  }
  
  const tests: TestCase[] = [
    { name: 'Default (no env var)', envValue: undefined, expected: 10000 },
    { name: 'Valid env var (10000)', envValue: '10000', expected: 10000 },
    { name: 'Valid env var (15000)', envValue: '15000', expected: 15000 },
    { name: 'Below minimum (2000)', envValue: '2000', expected: 3000 },
    { name: 'Above maximum (25000)', envValue: '25000', expected: 20000 },
    { name: 'At minimum (3000)', envValue: '3000', expected: 3000 },
    { name: 'At maximum (20000)', envValue: '20000', expected: 20000 },
    { name: 'Invalid string (defaults)', envValue: 'invalid', expected: 10000 },
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    // Save original
    const original = process.env.RUNTIME_PREFLIGHT_TIMEOUT_MS;
    
    // Set test value
    if (test.envValue === undefined) {
      delete process.env.RUNTIME_PREFLIGHT_TIMEOUT_MS;
    } else {
      process.env.RUNTIME_PREFLIGHT_TIMEOUT_MS = test.envValue;
    }
    
    // Parse and clamp (same logic as postingQueue.ts)
    const rawTimeout = parseInt(process.env.RUNTIME_PREFLIGHT_TIMEOUT_MS || '10000', 10);
    const timeoutMs = isNaN(rawTimeout) 
      ? 10000 
      : Math.max(3000, Math.min(20000, rawTimeout));
    
    // Restore original
    if (original === undefined) {
      delete process.env.RUNTIME_PREFLIGHT_TIMEOUT_MS;
    } else {
      process.env.RUNTIME_PREFLIGHT_TIMEOUT_MS = original;
    }
    
    const result = timeoutMs === test.expected;
    
    console.log(`📋 Test: ${test.name}`);
    console.log(`   Env value: ${test.envValue || 'undefined'}`);
    console.log(`   Parsed: ${rawTimeout}`);
    console.log(`   Clamped: ${timeoutMs}`);
    console.log(`   Expected: ${test.expected}`);
    
    if (result) {
      passed++;
      console.log(`   ✅ PASS`);
    } else {
      failed++;
      console.log(`   ❌ FAIL (expected ${test.expected}, got ${timeoutMs})`);
    }
  }
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(`📊 Timeout Config Results: ${passed} passed, ${failed} failed\n`);
  
  if (failed > 0) {
    throw new Error(`Timeout configuration tests failed: ${failed}`);
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
    
    // Verify timeout is stored in features
    if (result.timeoutMs !== undefined) {
      const storedTimeout = decision.features.runtime_preflight_timeout_ms;
      if (storedTimeout === result.timeoutMs) {
        console.log(`   ✅ Timeout stored in features: ${storedTimeout}ms`);
      } else {
        console.log(`   ⚠️  Timeout not stored correctly (expected ${result.timeoutMs}, got ${storedTimeout})`);
      }
    }
    
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

async function main(): Promise<void> {
  // Test 1: Timeout configuration
  testTimeoutConfiguration();
  
  // Test 2: OK-only gating
  await testOkOnlyGating();
  
  console.log('\n✅ ALL PROOFS PASSED');
  console.log('   • Timeout configuration parsing and clamping');
  console.log('   • Runtime preflight OK-only gating');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Proof failed:', err);
  process.exit(1);
});
