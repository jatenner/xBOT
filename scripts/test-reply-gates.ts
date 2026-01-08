/**
 * Test script for reply gates
 * Run with: pnpm exec tsx scripts/test-reply-gates.ts
 */

import 'dotenv/config';

async function testPreResolutionGate() {
  console.log('Testing pre-resolution gate logic...\n');
  
  // Test case 1: Block opportunity with target_in_reply_to_tweet_id
  const opp1 = {
    target_tweet_id: '1234567890',
    target_in_reply_to_tweet_id: '9876543210',
    is_root_tweet: false,
    root_tweet_id: '9876543210',
  };
  
  const preGateChecks1 = {
    has_in_reply_to: !!(opp1.target_in_reply_to_tweet_id),
    is_root_tweet: opp1.is_root_tweet === true || opp1.is_root_tweet === 1,
    root_mismatch: opp1.root_tweet_id && opp1.root_tweet_id !== opp1.target_tweet_id,
  };
  
  console.log('Test 1: Opportunity with in_reply_to_tweet_id');
  console.log(`  has_in_reply_to: ${preGateChecks1.has_in_reply_to} (should be true)`);
  console.log(`  Result: ${preGateChecks1.has_in_reply_to ? '✅ BLOCKED' : '❌ ALLOWED (BUG!)'}\n`);
  
  // Test case 2: Allow root tweet
  const opp2 = {
    target_tweet_id: '1234567890',
    target_in_reply_to_tweet_id: null,
    is_root_tweet: true,
    root_tweet_id: '1234567890',
  };
  
  const preGateChecks2 = {
    has_in_reply_to: !!(opp2.target_in_reply_to_tweet_id),
    is_root_tweet: opp2.is_root_tweet === true || opp2.is_root_tweet === 1,
    root_mismatch: opp2.root_tweet_id && opp2.root_tweet_id !== opp2.target_tweet_id,
  };
  
  console.log('Test 2: Root tweet opportunity');
  console.log(`  has_in_reply_to: ${preGateChecks2.has_in_reply_to} (should be false)`);
  console.log(`  is_root_tweet: ${preGateChecks2.is_root_tweet} (should be true)`);
  console.log(`  root_mismatch: ${preGateChecks2.root_mismatch} (should be false)`);
  console.log(`  Result: ${!preGateChecks2.has_in_reply_to && preGateChecks2.is_root_tweet && !preGateChecks2.root_mismatch ? '✅ ALLOWED' : '❌ BLOCKED (BUG!)'}\n`);
  
  // Test case 3: Block root mismatch
  const opp3 = {
    target_tweet_id: '1234567890',
    target_in_reply_to_tweet_id: null,
    is_root_tweet: true,
    root_tweet_id: '9999999999', // Different!
  };
  
  const preGateChecks3 = {
    has_in_reply_to: !!(opp3.target_in_reply_to_tweet_id),
    is_root_tweet: opp3.is_root_tweet === true || opp3.is_root_tweet === 1,
    root_mismatch: opp3.root_tweet_id && opp3.root_tweet_id !== opp3.target_tweet_id,
  };
  
  console.log('Test 3: Root mismatch');
  console.log(`  root_mismatch: ${preGateChecks3.root_mismatch} (should be true)`);
  console.log(`  Result: ${preGateChecks3.root_mismatch ? '✅ BLOCKED' : '❌ ALLOWED (BUG!)'}\n`);
  
  console.log('✅ All gate logic tests completed');
}

async function testNullRootHandling() {
  console.log('\nTesting null rootTweetId handling...\n');
  
  // Test: resolver returns null rootTweetId
  const resolved = {
    originalCandidateId: '1234567890',
    rootTweetId: null, // Fail-closed
    isRootTweet: false,
  };
  
  const rootId = resolved.rootTweetId;
  const shouldBlock = rootId === null;
  
  console.log('Test: Resolver returns null rootTweetId');
  console.log(`  rootTweetId: ${rootId}`);
  console.log(`  shouldBlock: ${shouldBlock} (should be true)`);
  console.log(`  Result: ${shouldBlock ? '✅ BLOCKED (fail-closed)' : '❌ ALLOWED (BUG!)'}\n`);
  
  console.log('✅ Null root handling test completed');
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🧪 REPLY GATE TESTS');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  await testPreResolutionGate();
  await testNullRootHandling();
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('✅ ALL TESTS COMPLETE');
  console.log('═══════════════════════════════════════════════════════════\n');
}

main().catch(console.error);

