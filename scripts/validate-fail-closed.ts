#!/usr/bin/env tsx
/**
 * 🔍 VALIDATE FAIL-CLOSED: Test with real tweet IDs and assert correct classification
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db';
import { resolveTweetAncestry, recordReplyDecision, shouldAllowReply } from '../src/jobs/replySystemV2/replyDecisionRecorder';

interface TestCase {
  name: string;
  tweetId: string;
  expectedStatus: 'OK' | 'UNCERTAIN' | 'ERROR';
  expectedDepth: number | null;
  expectedDecision: 'ALLOW' | 'DENY';
}

async function validateFailClosed() {
  console.log('\n🔍 VALIDATING FAIL-CLOSED BEHAVIOR\n');
  console.log('═'.repeat(80));
  
  // Test cases: root tweet, depth1 reply, depth2 reply
  // REQUIRE REAL TWEET IDs (no defaults)
  const rootTweetId = process.argv[2];
  const depth1TweetId = process.argv[3];
  const depth2TweetId = process.argv[4];
  
  if (!rootTweetId || !depth1TweetId || !depth2TweetId) {
    console.error('❌ Usage: pnpm run validate:fail-closed -- <root_tweet_id> <depth1_tweet_id> <depth2_tweet_id>');
    console.error('   All 3 tweet IDs are REQUIRED (no defaults)');
    process.exit(1);
  }
  
  const testCases: TestCase[] = [
    {
      name: 'Root Tweet (should ALLOW)',
      tweetId: rootTweetId,
      expectedStatus: 'OK',
      expectedDepth: 0,
      expectedDecision: 'ALLOW',
    },
    {
      name: 'Depth 1 Reply (should DENY)',
      tweetId: depth1TweetId,
      expectedStatus: 'OK', // After improvements, should resolve to OK with depth=1
      expectedDepth: 1,
      expectedDecision: 'DENY',
    },
    {
      name: 'Depth 2 Reply (should DENY)',
      tweetId: depth2TweetId,
      expectedStatus: 'OK', // After improvements, should resolve to OK with depth=2
      expectedDepth: 2,
      expectedDecision: 'DENY',
    },
  ];
  
  const results: Array<{
    testCase: TestCase;
    ancestry: any;
    decision: { allow: boolean; reason: string };
    passed: boolean;
  }> = [];
  
  for (const testCase of testCases) {
    console.log(`\n📊 Testing: ${testCase.name}`);
    console.log(`   Tweet ID: ${testCase.tweetId}`);
    console.log(`   Expected: status=${testCase.expectedStatus}, depth=${testCase.expectedDepth}, decision=${testCase.expectedDecision}`);
    console.log('-'.repeat(80));
    
    try {
      const ancestry = await resolveTweetAncestry(testCase.tweetId);
      const decision = shouldAllowReply(ancestry);
      
      const passed = 
        ancestry.status === testCase.expectedStatus &&
        ancestry.ancestryDepth === testCase.expectedDepth &&
        (decision.allow ? 'ALLOW' : 'DENY') === testCase.expectedDecision;
      
      console.log(`   Status: ${ancestry.status} ${ancestry.status === testCase.expectedStatus ? '✅' : '❌'}`);
      console.log(`   Depth: ${ancestry.ancestryDepth ?? 'null'} ${ancestry.ancestryDepth === testCase.expectedDepth ? '✅' : '❌'}`);
      console.log(`   Decision: ${decision.allow ? 'ALLOW' : 'DENY'} ${(decision.allow ? 'ALLOW' : 'DENY') === testCase.expectedDecision ? '✅' : '❌'}`);
      console.log(`   Reason: ${decision.reason}`);
      console.log(`   Method: ${ancestry.method}`);
      console.log(`   Confidence: ${ancestry.confidence}`);
      
      if (passed) {
        console.log(`   ✅ TEST PASSED`);
      } else {
        console.log(`   ❌ TEST FAILED`);
      }
      
      results.push({ testCase, ancestry, decision, passed });
      
      // Record decision
      await recordReplyDecision({
        decision_id: undefined,
        target_tweet_id: ancestry.targetTweetId,
        target_in_reply_to_tweet_id: ancestry.targetInReplyToTweetId,
        root_tweet_id: ancestry.rootTweetId || 'null',
        ancestry_depth: ancestry.ancestryDepth ?? -1, // Use -1 for null in DB
        is_root: ancestry.isRoot,
        decision: decision.allow ? 'ALLOW' : 'DENY',
        reason: `Validation: ${decision.reason}`,
        trace_id: 'fail_closed_validation',
        job_run_id: 'validation_test',
        pipeline_source: 'validation_script',
        playwright_post_attempted: false,
      });
      
    } catch (error: any) {
      console.error(`   ❌ Error: ${error.message}`);
      results.push({
        testCase,
        ancestry: null,
        decision: { allow: false, reason: `Error: ${error.message}` },
        passed: false,
      });
    }
  }
  
  // Summary
  console.log('\n📊 VALIDATION SUMMARY:');
  console.log('═'.repeat(80));
  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  
  results.forEach((result, i) => {
    console.log(`\n[${i + 1}] ${result.testCase.name}: ${result.passed ? '✅ PASSED' : '❌ FAILED'}`);
    if (result.ancestry) {
      console.log(`    Status: ${result.ancestry.status}, Depth: ${result.ancestry.ancestryDepth ?? 'null'}, Decision: ${result.decision.allow ? 'ALLOW' : 'DENY'}`);
    }
  });
  
  console.log(`\n✅ Passed: ${passedCount}/${totalCount}`);
  
  if (passedCount === totalCount) {
    console.log('\n🎉 ALL TESTS PASSED - Fail-closed behavior validated!\n');
  } else {
    console.log('\n⚠️  SOME TESTS FAILED - Review results above\n');
    process.exit(1);
  }
  
  // Query latest rows
  console.log('\n📊 Latest reply_decisions rows:');
  console.log('-'.repeat(80));
  const supabase = getSupabaseClient();
  const { data: rows } = await supabase
    .from('reply_decisions')
    .select('*')
    .eq('trace_id', 'fail_closed_validation')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (rows && rows.length > 0) {
    rows.forEach((row, i) => {
      console.log(`\n[${i + 1}] ${row.decision}: depth=${row.ancestry_depth}, status=${row.reason?.includes('ANCESTRY') ? 'UNCERTAIN/ERROR' : 'OK'}`);
      console.log(`    Target: ${row.target_tweet_id}, Root: ${row.root_tweet_id || 'null'}`);
    });
  }
  
  console.log('\n✅ Validation complete\n');
}

validateFailClosed().catch((error) => {
  console.error('❌ Validation failed:', error);
  process.exit(1);
});
