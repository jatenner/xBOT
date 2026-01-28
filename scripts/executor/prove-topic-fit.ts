#!/usr/bin/env tsx
/**
 * 🧪 PROOF Phase 6.3: Topic-Fit Embeddings
 * 
 * Validates:
 * - Health-related text scores higher than unrelated text
 * - Scores are within expected bounds (0-1)
 * - Fallback works if embeddings disabled (via DISABLE_TOPIC_FIT_EMBEDDINGS=true)
 * 
 * Usage:
 *   pnpm run executor:prove:topic-fit
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { computeTopicFit, computeTopicFitWithDetails } from '../../src/growth/topicAnchors';
import { getTextEmbedding } from '../../src/growth/embeddings';

const PROOF_TAG = `topic-fit-${Date.now()}`;

/**
 * Get immutable report path
 */
function getImmutableReportPath(proofTag: string): string {
  const proofsDir = path.join(process.cwd(), 'docs', 'proofs', 'targeting');
  if (!fs.existsSync(proofsDir)) {
    fs.mkdirSync(proofsDir, { recursive: true });
  }
  return path.join(proofsDir, `${proofTag}.md`);
}

/**
 * Test fixtures: health-related vs unrelated text
 */
const TEST_FIXTURES = [
  {
    name: 'health_sleep',
    text: 'Sleep quality is crucial for recovery and cognitive function. Deep sleep stages help with memory consolidation.',
    expectedHigh: true,
    category: 'health',
  },
  {
    name: 'health_nutrition',
    text: 'Nutrition plays a key role in longevity. Proper macronutrient balance and micronutrient intake support optimal health.',
    expectedHigh: true,
    category: 'health',
  },
  {
    name: 'health_training',
    text: 'Strength training adaptations improve muscle mass and bone density. Progressive overload is essential for gains.',
    expectedHigh: true,
    category: 'health',
  },
  {
    name: 'unrelated_politics',
    text: 'The latest political debate focused on economic policy and tax reform. Voters are divided on the issue.',
    expectedHigh: false,
    category: 'unrelated',
  },
  {
    name: 'unrelated_tech',
    text: 'The new smartphone features advanced AI processing and improved camera sensors. Battery life has increased significantly.',
    expectedHigh: false,
    category: 'unrelated',
  },
  {
    name: 'unrelated_sports',
    text: 'The championship game was intense. The winning team scored in the final minutes with a spectacular goal.',
    expectedHigh: false,
    category: 'unrelated',
  },
  {
    name: 'edge_case_empty',
    text: '',
    expectedHigh: false,
    category: 'edge',
  },
  {
    name: 'edge_case_short',
    text: 'Hi',
    expectedHigh: false,
    category: 'edge',
  },
];

/**
 * Main proof execution
 */
async function main() {
  console.log(`[PROOF_TOPIC_FIT] Starting proof: ${PROOF_TAG}`);
  
  const results: Array<{
    fixture: string;
    passed: boolean;
    score: number;
    expected: string;
    details?: any;
    error?: string;
  }> = [];
  
  // Test 1: Health-related vs unrelated scoring
  console.log('\n[PROOF_TOPIC_FIT] Test 1: Health-Related vs Unrelated Scoring');
  console.log('─'.repeat(60));
  
  const healthScores: number[] = [];
  const unrelatedScores: number[] = [];
  
  for (const fixture of TEST_FIXTURES) {
    try {
      const fitDetails = await computeTopicFitWithDetails(fixture.text);
      const score = fitDetails.score;
      
      if (fixture.category === 'health') {
        healthScores.push(score);
      } else if (fixture.category === 'unrelated') {
        unrelatedScores.push(score);
      }
      
      const passed = fixture.expectedHigh 
        ? score > 0.4 // Health-related should score > 0.4
        : score < 0.6; // Unrelated should score < 0.6
      
      results.push({
        fixture: fixture.name,
        passed,
        score,
        expected: fixture.expectedHigh ? 'high (>0.4)' : 'low (<0.6)',
        details: {
          bestAnchor: fitDetails.bestAnchor,
          rawSimilarity: fitDetails.bestAnchor 
            ? fitDetails.similarities[fitDetails.bestAnchor] 
            : undefined,
        },
      });
      
      const status = passed ? '✅' : '❌';
      console.log(`${status} ${fixture.name}: score=${score.toFixed(3)} (expected: ${fixture.expectedHigh ? 'high' : 'low'})`);
      
      if (fitDetails.bestAnchor) {
        console.log(`   Best anchor: ${fitDetails.bestAnchor}, raw similarity: ${fitDetails.similarities[fitDetails.bestAnchor]?.toFixed(3)}`);
      }
    } catch (error: any) {
      results.push({
        fixture: fixture.name,
        passed: false,
        score: 0.5, // Fallback
        expected: fixture.expectedHigh ? 'high' : 'low',
        error: error.message,
      });
      console.log(`❌ ${fixture.name}: ERROR - ${error.message}`);
    }
  }
  
  // Test 2: Score bounds validation
  console.log('\n[PROOF_TOPIC_FIT] Test 2: Score Bounds Validation');
  console.log('─'.repeat(60));
  
  const allScores = results.map(r => r.score);
  const minScore = Math.min(...allScores);
  const maxScore = Math.max(...allScores);
  const avgScore = allScores.reduce((a, b) => a + b, 0) / allScores.length;
  
  const boundsPassed = minScore >= 0 && maxScore <= 1;
  results.push({
    fixture: 'score_bounds',
    passed: boundsPassed,
    score: avgScore,
    expected: '0-1 range',
  });
  
  console.log(`✅ Score bounds: min=${minScore.toFixed(3)} max=${maxScore.toFixed(3)} avg=${avgScore.toFixed(3)}`);
  
  // Test 3: Health vs unrelated comparison
  console.log('\n[PROOF_TOPIC_FIT] Test 3: Health vs Unrelated Comparison');
  console.log('─'.repeat(60));
  
  if (healthScores.length > 0 && unrelatedScores.length > 0) {
    const avgHealth = healthScores.reduce((a, b) => a + b, 0) / healthScores.length;
    const avgUnrelated = unrelatedScores.reduce((a, b) => a + b, 0) / unrelatedScores.length;
    const comparisonPassed = avgHealth > avgUnrelated;
    
    results.push({
      fixture: 'health_vs_unrelated',
      passed: comparisonPassed,
      score: avgHealth - avgUnrelated,
      expected: 'health > unrelated',
      details: {
        avgHealth,
        avgUnrelated,
        difference: avgHealth - avgUnrelated,
      },
    });
    
    console.log(`✅ Health avg: ${avgHealth.toFixed(3)}, Unrelated avg: ${avgUnrelated.toFixed(3)}, Difference: ${(avgHealth - avgUnrelated).toFixed(3)}`);
  }
  
  // Test 4: Fallback behavior (simulate via env flag)
  console.log('\n[PROOF_TOPIC_FIT] Test 4: Fallback Behavior');
  console.log('─'.repeat(60));
  
  const originalEnv = process.env.DISABLE_TOPIC_FIT_EMBEDDINGS;
  process.env.DISABLE_TOPIC_FIT_EMBEDDINGS = 'true';
  
  try {
    const fallbackScore = await computeTopicFit('Sleep quality is important for health and recovery.');
    const fallbackPassed = fallbackScore === 0.5;
    
    results.push({
      fixture: 'fallback_disabled',
      passed: fallbackPassed,
      score: fallbackScore,
      expected: '0.5 (fallback)',
    });
    
    console.log(`${fallbackPassed ? '✅' : '❌'} Fallback score: ${fallbackScore} (expected: 0.5)`);
  } catch (error: any) {
    results.push({
      fixture: 'fallback_disabled',
      passed: false,
      score: 0,
      expected: '0.5 (fallback)',
      error: error.message,
    });
  } finally {
    // Restore env
    if (originalEnv !== undefined) {
      process.env.DISABLE_TOPIC_FIT_EMBEDDINGS = originalEnv;
    } else {
      delete process.env.DISABLE_TOPIC_FIT_EMBEDDINGS;
    }
  }
  
  // Summary
  const allPassed = results.every(r => r.passed);
  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  
  console.log('\n[PROOF_TOPIC_FIT] Summary');
  console.log('═'.repeat(60));
  console.log(`Results: ${passedCount}/${totalCount} tests passed`);
  console.log(`Status: ${allPassed ? '✅ PASS' : '❌ FAIL'}`);
  
  // Generate report
  const reportPath = getImmutableReportPath(PROOF_TAG);
  const report = generateReport(PROOF_TAG, results, healthScores, unrelatedScores);
  fs.writeFileSync(reportPath, report);
  
  console.log(`\n📄 Report written to: ${reportPath}`);
  
  // Exit with appropriate code
  process.exit(allPassed ? 0 : 1);
}

/**
 * Generate immutable proof report
 */
function generateReport(
  proofTag: string,
  results: Array<any>,
  healthScores: number[],
  unrelatedScores: number[]
): string {
  const now = new Date().toISOString();
  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  const status = passedCount === totalCount ? '✅ PASS' : '❌ FAIL';
  
  const avgHealth = healthScores.length > 0 
    ? (healthScores.reduce((a, b) => a + b, 0) / healthScores.length).toFixed(3)
    : 'N/A';
  const avgUnrelated = unrelatedScores.length > 0
    ? (unrelatedScores.reduce((a, b) => a + b, 0) / unrelatedScores.length).toFixed(3)
    : 'N/A';
  
  return `# Topic-Fit Embeddings Proof (Phase 6.3)

**Date:** ${now}  
**Status:** ${status}  
**Proof Tag:** ${proofTag}

**Acceptance Criteria:**
- Health-related text scores higher than unrelated text
- Scores are within expected bounds (0-1)
- Fallback works if embeddings disabled

## Results

| Test | Status | Score | Expected | Details |
|------|--------|-------|----------|---------|
${results.map(r => `| ${r.fixture} | ${r.passed ? '✅' : '❌'} | ${r.score.toFixed(3)} | ${r.expected} | ${r.error || JSON.stringify(r.details || {})} |`).join('\n')}

## Score Analysis

- **Health-related average:** ${avgHealth}
- **Unrelated average:** ${avgUnrelated}
- **Difference:** ${(parseFloat(avgHealth) - parseFloat(avgUnrelated)).toFixed(3)}

## Test Cases

${TEST_FIXTURES.map(f => `
### ${f.name}
- **Text:** "${f.text.substring(0, 80)}${f.text.length > 80 ? '...' : ''}"
- **Expected:** ${f.expectedHigh ? 'HIGH (>0.4)' : 'LOW (<0.6)'}
- **Category:** ${f.category}
`).join('\n')}

## Result

${status} - Topic-fit embeddings ${passedCount === totalCount ? 'meet all acceptance criteria' : 'have failures'}.
`;
}

// Run proof
main().catch(error => {
  console.error('[PROOF_TOPIC_FIT] Fatal error:', error);
  process.exit(1);
});
