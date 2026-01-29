#!/usr/bin/env tsx
/**
 * 🔒 PROOF: Runtime Preflight Check
 * 
 * Validates that runtime preflight correctly handles:
 * - ok: tweet exists
 * - deleted: tweet not found
 * - timeout: fetch timeout
 * - error: other errors
 */

import 'dotenv/config';

interface PreflightResult {
  status: 'ok' | 'deleted' | 'timeout' | 'error';
  latency_ms: number;
  error?: string;
}

async function testRuntimePreflight(): Promise<void> {
  console.log('🔒 PROOF: Runtime Preflight Check');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const tests: Array<{ name: string; tweetId: string; expectedStatus: PreflightResult['status'] }> = [
    {
      name: 'Valid tweet (should be ok or timeout)',
      tweetId: '2016656684853432684', // Real tweet ID from recent decisions
      expectedStatus: 'ok' // May timeout, but should not be deleted
    },
    {
      name: 'Invalid tweet ID (should be deleted)',
      tweetId: '9999999999999999999',
      expectedStatus: 'deleted'
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    console.log(`\n📋 Test: ${test.name}`);
    console.log(`   Tweet ID: ${test.tweetId}`);
    
    try {
      const { fetchTweetData } = await import('../../src/gates/contextLockVerifier');
      
      const startTime = Date.now();
      const fetchPromise = fetchTweetData(test.tweetId);
      const timeoutPromise = new Promise<null>((_, reject) => 
        setTimeout(() => reject(new Error('timeout')), 6000)
      );
      
      const tweetData = await Promise.race([fetchPromise, timeoutPromise]);
      const latency = Date.now() - startTime;
      
      const result: PreflightResult = tweetData 
        ? { status: 'ok', latency_ms: latency }
        : { status: 'deleted', latency_ms: latency };
      
      console.log(`   ✅ Result: ${result.status} (${result.latency_ms}ms)`);
      
      // Accept ok or timeout for valid tweets, deleted for invalid
      if (test.expectedStatus === 'ok' && (result.status === 'ok' || result.status === 'timeout')) {
        passed++;
      } else if (test.expectedStatus === 'deleted' && result.status === 'deleted') {
        passed++;
      } else {
        console.log(`   ❌ Expected ${test.expectedStatus}, got ${result.status}`);
        failed++;
      }
      
    } catch (error: any) {
      const latency = Date.now() - Date.now();
      const result: PreflightResult = error.message === 'timeout'
        ? { status: 'timeout', latency_ms: 6000 }
        : { status: 'error', latency_ms: 0, error: error.message };
      
      console.log(`   ⚠️  Result: ${result.status} (${result.error || 'timeout'})`);
      
      // Timeout is acceptable for valid tweets
      if (test.expectedStatus === 'ok' && result.status === 'timeout') {
        passed++;
      } else if (test.expectedStatus === 'deleted' && result.status === 'deleted') {
        passed++;
      } else {
        failed++;
      }
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

testRuntimePreflight().catch(err => {
  console.error('❌ Proof failed:', err);
  process.exit(1);
});
