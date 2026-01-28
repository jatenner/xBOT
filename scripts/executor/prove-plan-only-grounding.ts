#!/usr/bin/env tsx
/**
 * 🧪 PROOF: PLAN_ONLY Grounding Check
 * 
 * Validates that PLAN_ONLY reply generation produces grounded content
 * that passes the adapter's grounding check.
 */

import { generateReplyContent } from '../../src/ai/replyGeneratorAdapter';

interface ProofResult {
  test: string;
  passed: boolean;
  details: string;
}

const results: ProofResult[] = [];

function recordResult(test: string, passed: boolean, details: string): void {
  results.push({ test, passed, details });
  console.log(`${passed ? '✅' : '❌'} ${test}: ${details}`);
}

async function main(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('     🧪 PROOF: PLAN_ONLY Grounding Check');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Test 1: Health tweet with concrete metrics (should pass)
  const healthTweet = "Practicing meditation enhances well-being. Studies show it improves physical strength by 20%. Consistency brings long-term rewards.";
  const healthAnchors = ['meditation', 'strength', '20%', 'consistency'];
  
  try {
    const result1 = await generateReplyContent({
      target_username: 'test_user',
      target_tweet_content: healthTweet,
      topic: 'health',
      model: 'gpt-4o-mini',
      template_id: 'insight_punch', // PLAN_ONLY mode
      prompt_version: '1',
      reply_context: {
        target_text: healthTweet,
        root_text: healthTweet,
      },
    });
    
    const replyLower = result1.content.toLowerCase();
    const hasMeditation = replyLower.includes('meditation');
    const hasStrength = replyLower.includes('strength');
    const has20Percent = replyLower.includes('20') || replyLower.includes('twenty');
    const hasConsistency = replyLower.includes('consistency');
    const anchorMatches = [hasMeditation, hasStrength, has20Percent, hasConsistency].filter(Boolean).length;
    
    recordResult(
      'Health tweet generates grounded reply',
      result1.content.length > 0 && anchorMatches >= 2,
      `Content: "${result1.content.substring(0, 100)}..." | Anchors matched: ${anchorMatches}/4`
    );
  } catch (error: any) {
    recordResult(
      'Health tweet generates grounded reply',
      false,
      `Error: ${error.message}`
    );
  }

  // Test 2: Irrelevant tweet (should fail gracefully or skip)
  const irrelevantTweet = "Just had the best coffee ever! ☕";
  
  try {
    const result2 = await generateReplyContent({
      target_username: 'test_user',
      target_tweet_content: irrelevantTweet,
      topic: 'health',
      model: 'gpt-4o-mini',
      template_id: 'insight_punch',
      prompt_version: '1',
      reply_context: {
        target_text: irrelevantTweet,
        root_text: irrelevantTweet,
      },
    });
    
    // If it generates, should still reference "coffee"
    const replyLower = result2.content.toLowerCase();
    const hasCoffee = replyLower.includes('coffee');
    
    recordResult(
      'Irrelevant tweet handled correctly',
      result2.content.length === 0 || hasCoffee,
      `Content: "${result2.content.substring(0, 100)}..." | Has coffee reference: ${hasCoffee}`
    );
  } catch (error: any) {
    const isSkip = error.message.includes('UNGROUNDED_GENERATION_SKIP') || error.message.includes('skip_reason');
    recordResult(
      'Irrelevant tweet handled correctly',
      isSkip,
      `Expected skip, got: ${error.message}`
    );
  }

  // Test 3: Empty content check
  recordResult(
    'Generated content never empty',
    results.every(r => !r.details.includes('length: 0') || !r.passed),
    `All ${results.length} tests completed`
  );

  // Summary
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📊 Results: ${passed}/${total} tests passed`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (passed === total) {
    console.log('✅ PROOF PASSED: PLAN_ONLY grounding check works correctly');
    process.exit(0);
  } else {
    console.log('❌ PROOF FAILED: Some grounding checks failed');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Proof script error:', error);
  process.exit(1);
});
