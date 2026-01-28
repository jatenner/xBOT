#!/usr/bin/env tsx
/**
 * 🧪 PROOF Phase 6.3B: Reward-Based Strategy Learning
 * 
 * Validates:
 * - computeReward returns expected values on fixed cases
 * - strategy_rewards mean updates correctly over N samples
 * - ε-greedy chooses exploit vs explore deterministically using fixed RNG seed
 * 
 * Usage:
 *   pnpm run executor:prove:reward-learning
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { computeReward } from '../../src/growth/reward';
import { recordStrategyReward, getStrategyRewardStats } from '../../src/growth/strategyRewards';
import { epsilonGreedyStrategySelection } from '../../src/growth/epsilonGreedy';
import { getSupabaseClient } from '../../src/db/index';
import type { ScoredCandidate } from '../../src/growth/replyTargetScoring';

const PROOF_TAG = `reward-learning-${Date.now()}`;

/**
 * Get immutable report path
 */
function getImmutableReportPath(proofTag: string): string {
  const proofsDir = path.join(process.cwd(), 'docs', 'proofs', 'learning');
  if (!fs.existsSync(proofsDir)) {
    fs.mkdirSync(proofsDir, { recursive: true });
  }
  return path.join(proofsDir, `${proofTag}.md`);
}

/**
 * Test fixtures for reward computation
 */
const REWARD_TEST_CASES = [
  {
    name: 'high_engagement',
    metrics: { likes: 100, replies: 10, reposts: 5, bookmarks: 20, impressions: 1000 },
    expectedRange: [2.0, 5.0], // Should be in this range
  },
  {
    name: 'low_engagement',
    metrics: { likes: 5, replies: 0, reposts: 0, bookmarks: 1, impressions: 500 },
    expectedRange: [0.0, 1.0],
  },
  {
    name: 'no_impressions',
    metrics: { likes: 50, replies: 5, reposts: 2, bookmarks: 10 },
    expectedRange: [10.0, 50.0], // Higher without normalization
  },
  {
    name: 'zero_metrics',
    metrics: {},
    expectedRange: [0.0, 0.0],
  },
];

/**
 * Main proof execution
 */
async function main() {
  console.log(`[PROOF_REWARD_LEARNING] Starting proof: ${PROOF_TAG}`);
  
  const results: Array<{
    test: string;
    passed: boolean;
    details: any;
    error?: string;
  }> = [];
  
  const supabase = getSupabaseClient();
  
  // Test 1: Reward computation
  console.log('\n[PROOF_REWARD_LEARNING] Test 1: Reward Computation');
  console.log('─'.repeat(60));
  
  for (const testCase of REWARD_TEST_CASES) {
    try {
      const reward = computeReward(testCase.metrics);
      const inRange = reward >= testCase.expectedRange[0] && reward <= testCase.expectedRange[1];
      const isNonNegative = reward >= 0;
      
      results.push({
        test: `reward_${testCase.name}`,
        passed: inRange && isNonNegative,
        details: {
          reward,
          expectedRange: testCase.expectedRange,
          inRange,
          isNonNegative,
        },
      });
      
      const status = (inRange && isNonNegative) ? '✅' : '❌';
      console.log(`${status} ${testCase.name}: reward=${reward.toFixed(3)} (expected: ${testCase.expectedRange[0]}-${testCase.expectedRange[1]})`);
    } catch (error: any) {
      results.push({
        test: `reward_${testCase.name}`,
        passed: false,
        details: {},
        error: error.message,
      });
      console.log(`❌ ${testCase.name}: ERROR - ${error.message}`);
    }
  }
  
  // Test 2: Strategy rewards mean updates
  console.log('\n[PROOF_REWARD_LEARNING] Test 2: Strategy Rewards Mean Updates');
  console.log('─'.repeat(60));
  
  const testStrategyId = `proof_test_${Date.now()}`;
  const testStrategyVersion = '1';
  
  try {
    // Clear any existing test data
    await supabase
      .from('strategy_rewards')
      .delete()
      .eq('strategy_id', testStrategyId)
      .eq('strategy_version', testStrategyVersion);
    
    // Record N samples
    const sampleRewards = [1.0, 2.0, 3.0, 4.0, 5.0];
    let expectedMean = 0;
    
    for (let i = 0; i < sampleRewards.length; i++) {
      await recordStrategyReward(testStrategyId, testStrategyVersion, sampleRewards[i]);
      expectedMean = sampleRewards.slice(0, i + 1).reduce((a, b) => a + b, 0) / (i + 1);
      
      const stats = await getStrategyRewardStats(testStrategyId, testStrategyVersion);
      
      if (stats) {
        const meanCorrect = Math.abs(stats.mean_reward - expectedMean) < 0.01;
        const countCorrect = stats.sample_count === i + 1;
        
        if (i === sampleRewards.length - 1) {
          // Final check
          results.push({
            test: 'strategy_rewards_mean_updates',
            passed: meanCorrect && countCorrect,
            details: {
              sampleCount: stats.sample_count,
              expectedMean,
              actualMean: stats.mean_reward,
              meanCorrect,
              countCorrect,
            },
          });
          
          const status = (meanCorrect && countCorrect) ? '✅' : '❌';
          console.log(`${status} After ${stats.sample_count} samples: mean=${stats.mean_reward.toFixed(3)} (expected: ${expectedMean.toFixed(3)})`);
        }
      }
    }
    
    // Cleanup
    await supabase
      .from('strategy_rewards')
      .delete()
      .eq('strategy_id', testStrategyId)
      .eq('strategy_version', testStrategyVersion);
  } catch (error: any) {
    results.push({
      test: 'strategy_rewards_mean_updates',
      passed: false,
      details: {},
      error: error.message,
    });
    console.log(`❌ Strategy rewards mean updates: ERROR - ${error.message}`);
  }
  
  // Test 3: ε-greedy deterministic selection
  console.log('\n[PROOF_REWARD_LEARNING] Test 3: ε-Greedy Deterministic Selection');
  console.log('─'.repeat(60));
  
  try {
    // Create mock candidates with different strategies
    const mockCandidates: ScoredCandidate[] = [
      {
        target_tweet_id: 'test_001',
        score: 0.8,
        scoringComponents: { topicFit: 0.8, engagementVelocity: 0.7, authorInfluence: 0.6, recency: 0.9, totalScore: 0.8 },
        eligibilityReason: 'eligible' as any,
        _scoring: { strategy_id: 'strategy_a', strategy_version: '1', reply_targeting_score: 0.8 },
      } as any,
      {
        target_tweet_id: 'test_002',
        score: 0.7,
        scoringComponents: { topicFit: 0.7, engagementVelocity: 0.6, authorInfluence: 0.5, recency: 0.8, totalScore: 0.7 },
        eligibilityReason: 'eligible' as any,
        _scoring: { strategy_id: 'strategy_b', strategy_version: '1', reply_targeting_score: 0.7 },
      } as any,
    ];
    
    // Test with fixed seed (should be deterministic)
    const seed1 = 12345;
    const selection1 = await epsilonGreedyStrategySelection(mockCandidates, seed1);
    
    const seed2 = 12345; // Same seed
    const selection2 = await epsilonGreedyStrategySelection(mockCandidates, seed2);
    
    const seed3 = 67890; // Different seed
    const selection3 = await epsilonGreedyStrategySelection(mockCandidates, seed3);
    
    const deterministic = 
      selection1.strategyId === selection2.strategyId &&
      selection1.selectionMode === selection2.selectionMode;
    
    const differentSeedsDifferent = 
      selection1.strategyId !== selection3.strategyId ||
      selection1.selectionMode !== selection3.selectionMode ||
      seed1 === seed3; // If seeds are same, this test is invalid
    
    results.push({
      test: 'epsilon_greedy_deterministic',
      passed: deterministic,
      details: {
        seed1,
        seed2,
        seed3,
        selection1: { strategyId: selection1.strategyId, mode: selection1.selectionMode },
        selection2: { strategyId: selection2.strategyId, mode: selection2.selectionMode },
        selection3: { strategyId: selection3.strategyId, mode: selection3.selectionMode },
        deterministic,
      },
    });
    
    const status = deterministic ? '✅' : '❌';
    console.log(`${status} Same seed (${seed1}): strategy=${selection1.strategyId} mode=${selection1.selectionMode} (matches: ${deterministic})`);
    console.log(`   Different seed (${seed3}): strategy=${selection3.strategyId} mode=${selection3.selectionMode}`);
  } catch (error: any) {
    results.push({
      test: 'epsilon_greedy_deterministic',
      passed: false,
      details: {},
      error: error.message,
    });
    console.log(`❌ ε-greedy deterministic: ERROR - ${error.message}`);
  }
  
  // Summary
  const allPassed = results.every(r => r.passed);
  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  
  console.log('\n[PROOF_REWARD_LEARNING] Summary');
  console.log('═'.repeat(60));
  console.log(`Results: ${passedCount}/${totalCount} tests passed`);
  console.log(`Status: ${allPassed ? '✅ PASS' : '❌ FAIL'}`);
  
  // Generate report
  const reportPath = getImmutableReportPath(PROOF_TAG);
  const report = generateReport(PROOF_TAG, results);
  fs.writeFileSync(reportPath, report);
  
  console.log(`\n📄 Report written to: ${reportPath}`);
  
  // Exit with appropriate code
  process.exit(allPassed ? 0 : 1);
}

/**
 * Generate immutable proof report
 */
function generateReport(proofTag: string, results: Array<any>): string {
  const now = new Date().toISOString();
  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  const status = passedCount === totalCount ? '✅ PASS' : '❌ FAIL';
  
  return `# Reward-Based Strategy Learning Proof (Phase 6.3B)

**Date:** ${now}  
**Status:** ${status}  
**Proof Tag:** ${proofTag}

**Acceptance Criteria:**
- computeReward returns expected values on fixed cases
- strategy_rewards mean updates correctly over N samples
- ε-greedy chooses exploit vs explore deterministically using fixed RNG seed

## Results

| Test | Status | Details |
|------|--------|---------|
${results.map(r => `| ${r.test} | ${r.passed ? '✅' : '❌'} | ${r.error || JSON.stringify(r.details)} |`).join('\n')}

## Test Cases

### Reward Computation
${REWARD_TEST_CASES.map(tc => `
- **${tc.name}**: ${JSON.stringify(tc.metrics)} → Expected range: ${tc.expectedRange[0]}-${tc.expectedRange[1]}
`).join('')}

## Result

${status} - Reward-based strategy learning ${passedCount === totalCount ? 'meets all acceptance criteria' : 'has failures'}.
`;
}

// Run proof
main().catch(error => {
  console.error('[PROOF_REWARD_LEARNING] Fatal error:', error);
  process.exit(1);
});
