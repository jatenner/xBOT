#!/usr/bin/env tsx
/**
 * 🔒 VALIDATE FAIL-CLOSED: Test ancestry resolution with real tweet IDs
 * Asserts correct classification: root=ALLOW, depth>=1=DENY, uncertain=DENY
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db';
import { resolveTweetAncestry, recordReplyDecision, shouldAllowReply } from '../src/jobs/replySystemV2/replyDecisionRecorder';

interface TestCase {
  name: string;
  tweetId: string;
  expectedDepth: number | null;
  expectedStatus: 'OK' | 'UNCERTAIN' | 'ERROR';
  expectedDecision: 'ALLOW' | 'DENY';
}

async function validateFailClosed() {
  console.log('\n🔒 VALIDATING FAIL-CLOSED BEHAVIOR\n');
  console.log('═'.repeat(80));
  
  const supabase = getSupabaseClient();
  
  // Test cases: root tweet, depth1 reply, depth2 reply
  // Replace with real tweet IDs from your database
  const testCases: TestCase[] = [
    {
      name: 'Root Tweet',
      tweetId: process.argv[2] || '1987900630393069568', // Replace with real root tweet
      expectedDepth: 0,
      expectedStatus: 'OK',
      expectedDecision: 'ALLOW',
    },
    {
      name: 'Depth 1 Reply',
      tweetId: process.argv[3] || '1741970033939767379', // Replace with real depth1 reply
      expectedDepth: 1,
      expectedStatus: 'OK',
      expectedDecision: 'DENY',
    },
    {
      name: 'Depth 2 Reply',
      tweetId: process.argv[4] || '9999999999999999999', // Replace with real depth2 reply
      expectedDepth: 2,
      expectedStatus: 'OK',
      expectedDecision: 'DENY',
    },
  ];
  
  const results: Array<{
    testCase: TestCase;
    ancestry: any;
    decision: { allow: boolean; reason: string };
    passed: boolean;
  }> = [];
  
  console.log('\n📊 Running test cases...\n');
  
  for (const testCase of testCases) {
    console.log(`\n[TEST] ${testCase.name}: ${testCase.tweetId}`);
    console.log('-'.repeat(80));
    
    try {
      const ancestry = await resolveTweetAncestry(testCase.tweetId);
      const decision = shouldAllowReply(ancestry);
      
      console.log(`  Status: ${ancestry.status} (expected: ${testCase.expectedStatus})`);
      console.log(`  Depth: ${ancestry.ancestryDepth ?? 'null'} (expected: ${testCase.expectedDepth ?? 'null'})`);
      console.log(`  Decision: ${decision.allow ? 'ALLOW' : 'DENY'} (expected: ${testCase.expectedDecision})`);
      console.log(`  Reason: ${decision.reason}`);
      console.log(`  Method: ${ancestry.method}`);
      console.log(`  Signals: [${ancestry.signals.slice(0, 3).join(', ')}...]`);
      
      // Check assertions
      const statusMatch = ancestry.status === testCase.expectedStatus;
      const depthMatch = ancestry.ancestryDepth === testCase.expectedDepth;
      const decisionMatch = (decision.allow && testCase.expectedDecision === 'ALLOW') ||
                           (!decision.allow && testCase.expectedDecision === 'DENY');
      
      const passed = statusMatch && depthMatch && decisionMatch;
      
      if (!passed) {
        console.log(`  ❌ FAILED:`);
        if (!statusMatch) console.log(`     Status mismatch: got ${ancestry.status}, expected ${testCase.expectedStatus}`);
        if (!depthMatch) console.log(`     Depth mismatch: got ${ancestry.ancestryDepth}, expected ${testCase.expectedDepth}`);
        if (!decisionMatch) console.log(`     Decision mismatch: got ${decision.allow ? 'ALLOW' : 'DENY'}, expected ${testCase.expectedDecision}`);
      } else {
        console.log(`  ✅ PASSED`);
      }
      
      results.push({ testCase, ancestry, decision, passed });
      
      // Record decision
      await recordReplyDecision({
        decision_id: undefined,
        target_tweet_id: ancestry.targetTweetId,
        target_in_reply_to_tweet_id: ancestry.targetInReplyToTweetId,
        root_tweet_id: ancestry.rootTweetId || 'NULL',
        ancestry_depth: ancestry.ancestryDepth ?? -1, // Use -1 for null in DB
        is_root: ancestry.isRoot,
        decision: decision.allow ? 'ALLOW' : 'DENY',
        reason: `Validation test: ${decision.reason}`,
        trace_id: 'fail_closed_validation',
        job_run_id: 'validation_test',
        pipeline_source: 'validation_script',
        playwright_post_attempted: false,
      });
      
    } catch (error: any) {
      console.error(`  ❌ ERROR: ${error.message}`);
      results.push({
        testCase,
        ancestry: null,
        decision: { allow: false, reason: `Exception: ${error.message}` },
        passed: false,
      });
    }
  }
  
  // Summary
  console.log('\n\n📊 VALIDATION SUMMARY:');
  console.log('═'.repeat(80));
  
  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  
  results.forEach((result, i) => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`  [${i + 1}] ${status} ${result.testCase.name}`);
  });
  
  console.log(`\n  Total: ${passedCount}/${totalCount} passed`);
  
  if (passedCount === totalCount) {
    console.log('\n  ✅ All tests passed - fail-closed behavior validated!\n');
  } else {
    console.log('\n  ❌ Some tests failed - review ancestry resolution\n');
    process.exit(1);
  }
  
  // Query latest rows
  console.log('\n📊 Latest reply_decisions rows from validation:');
  console.log('-'.repeat(80));
  
  const { data: rows } = await supabase
    .from('reply_decisions')
    .select('*')
    .eq('trace_id', 'fail_closed_validation')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (rows && rows.length > 0) {
    rows.forEach((row, i) => {
      console.log(`  [${i + 1}] Target: ${row.target_tweet_id}`);
      console.log(`      Depth: ${row.ancestry_depth}, Is Root: ${row.is_root}`);
      console.log(`      Decision: ${row.decision}`);
      console.log(`      Reason: ${row.reason?.substring(0, 80)}...`);
      console.log('');
    });
  }
  
  console.log('═'.repeat(80));
}

validateFailClosed().catch((error) => {
  console.error('❌ Validation failed:', error);
  process.exit(1);
});
