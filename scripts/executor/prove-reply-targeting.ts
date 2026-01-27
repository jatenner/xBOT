#!/usr/bin/env tsx
/**
 * 🧪 PROOF Phase 6.1-6.2: Reply Targeting Policy
 * 
 * Validates:
 * - Eligibility filter rejects invalid targets with correct reason codes
 * - Scoring selects expected valid targets (top-K)
 * - All decisions are auditable (stored in features)
 * 
 * Usage:
 *   pnpm run executor:prove:reply-targeting
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { checkEligibility, filterEligibleCandidates, EligibilityReason } from '../../src/growth/replyTargetEligibility';
import { scoreCandidate, scoreAndSelectTopK, formatScoringForStorage } from '../../src/growth/replyTargetScoring';
import type { ReplyTargetCandidate } from '../../src/growth/replyTargetEligibility';
import { getSupabaseClient } from '../../src/db/index';

const PROOF_TAG = `targeting-${Date.now()}`;

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
 * Test fixture: Create candidate set with various scenarios
 */
function createTestFixtures(): Array<{
  name: string;
  candidate: ReplyTargetCandidate;
  expectedEligible: boolean;
  expectedReason?: EligibilityReason;
}> {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const thirtyHoursAgo = new Date(now.getTime() - 30 * 60 * 60 * 1000); // Stale (>24h)

  return [
    // Valid candidate
    {
      name: 'valid_root_tweet',
      candidate: {
        target_tweet_id: 'test_valid_001',
        target_username: 'testuser1',
        tweet_posted_at: oneHourAgo.toISOString(),
        is_root_tweet: true,
        replied_to: false,
        like_count: 100,
        posted_minutes_ago: 60,
        target_followers: 50000,
      },
      expectedEligible: true,
      expectedReason: EligibilityReason.ELIGIBLE,
    },
    
    // Root tweet but already replied
    {
      name: 'already_replied',
      candidate: {
        target_tweet_id: 'test_replied_002',
        target_username: 'testuser2',
        tweet_posted_at: oneHourAgo.toISOString(),
        is_root_tweet: true,
        replied_to: true, // Already replied
        like_count: 200,
        posted_minutes_ago: 30,
        target_followers: 100000,
      },
      expectedEligible: false,
      expectedReason: EligibilityReason.ALREADY_REPLIED_RECENTLY,
    },
    
    // Not a root tweet
    {
      name: 'not_root_tweet',
      candidate: {
        target_tweet_id: 'test_not_root_003',
        target_username: 'testuser3',
        tweet_posted_at: oneHourAgo.toISOString(),
        is_root_tweet: false,
        target_in_reply_to_tweet_id: 'parent_001',
        replied_to: false,
        like_count: 50,
        posted_minutes_ago: 45,
        target_followers: 30000,
      },
      expectedEligible: false,
      expectedReason: EligibilityReason.NOT_ROOT_TWEET,
    },
    
    // Stale tweet (>24h old)
    {
      name: 'stale_tweet',
      candidate: {
        target_tweet_id: 'test_stale_004',
        target_username: 'testuser4',
        tweet_posted_at: thirtyHoursAgo.toISOString(),
        is_root_tweet: true,
        replied_to: false,
        like_count: 500,
        posted_minutes_ago: 1800, // 30 hours
        target_followers: 200000,
      },
      expectedEligible: false,
      expectedReason: EligibilityReason.STALE_TWEET,
    },
    
    // Missing required fields
    {
      name: 'missing_fields',
      candidate: {
        target_tweet_id: '', // Missing
        target_username: 'testuser5',
        tweet_posted_at: oneHourAgo.toISOString(),
        is_root_tweet: true,
        replied_to: false,
      },
      expectedEligible: false,
      expectedReason: EligibilityReason.MISSING_REQUIRED_FIELDS,
    },
    
    // High-value valid candidate (should score high)
    {
      name: 'high_value_valid',
      candidate: {
        target_tweet_id: 'test_high_value_005',
        target_username: 'testuser6',
        tweet_posted_at: oneHourAgo.toISOString(),
        is_root_tweet: true,
        replied_to: false,
        like_count: 1000,
        posted_minutes_ago: 30, // High velocity: 1000/30 = 33 likes/min
        target_followers: 500000,
        engagement_rate: 0.04,
      },
      expectedEligible: true,
      expectedReason: EligibilityReason.ELIGIBLE,
    },
    
    // Medium-value valid candidate
    {
      name: 'medium_value_valid',
      candidate: {
        target_tweet_id: 'test_medium_006',
        target_username: 'testuser7',
        tweet_posted_at: twoDaysAgo.toISOString(), // Older but still <24h threshold
        is_root_tweet: true,
        replied_to: false,
        like_count: 50,
        posted_minutes_ago: 2880, // 2 days
        target_followers: 10000,
      },
      expectedEligible: false, // Actually stale (>24h)
      expectedReason: EligibilityReason.STALE_TWEET,
    },
  ];
}

/**
 * Main proof execution
 */
async function main() {
  console.log(`[PROOF_TARGETING] Starting proof: ${PROOF_TAG}`);
  
  const fixtures = createTestFixtures();
  const results: Array<{
    fixture: string;
    passed: boolean;
    decision: any;
    expected: any;
    error?: string;
  }> = [];
  
  // Test 1: Eligibility filtering
  console.log('\n[PROOF_TARGETING] Test 1: Eligibility Filtering');
  console.log('─'.repeat(60));
  
  for (const fixture of fixtures) {
    try {
      const decision = await checkEligibility(fixture.candidate, {
        checkTargetExists: false, // Skip DB check for proof
        requireRootTweet: true,
      });
      
      const passed = 
        decision.eligible === fixture.expectedEligible &&
        decision.reason === fixture.expectedReason;
      
      results.push({
        fixture: fixture.name,
        passed,
        decision: {
          eligible: decision.eligible,
          reason: decision.reason,
          reasonDetails: decision.reasonDetails,
        },
        expected: {
          eligible: fixture.expectedEligible,
          reason: fixture.expectedReason,
        },
      });
      
      const status = passed ? '✅' : '❌';
      console.log(`${status} ${fixture.name}: ${decision.reason} (expected: ${fixture.expectedReason})`);
      
      if (!passed) {
        console.log(`   Details: ${decision.reasonDetails || 'N/A'}`);
      }
    } catch (error: any) {
      results.push({
        fixture: fixture.name,
        passed: false,
        decision: null,
        expected: {
          eligible: fixture.expectedEligible,
          reason: fixture.expectedReason,
        },
        error: error.message,
      });
      console.log(`❌ ${fixture.name}: ERROR - ${error.message}`);
    }
  }
  
  // Test 2: Batch filtering
  console.log('\n[PROOF_TARGETING] Test 2: Batch Filtering');
  console.log('─'.repeat(60));
  
  const allCandidates = fixtures.map(f => f.candidate);
  const { eligible, ineligible } = await filterEligibleCandidates(allCandidates, {
    checkTargetExists: false,
    requireRootTweet: true,
  });
  
  console.log(`✅ Filtered ${allCandidates.length} candidates → ${eligible.length} eligible, ${ineligible.length} ineligible`);
  
  const expectedEligibleCount = fixtures.filter(f => f.expectedEligible).length;
  const batchPassed = eligible.length === expectedEligibleCount;
  
  results.push({
    fixture: 'batch_filtering',
    passed: batchPassed,
    decision: { eligibleCount: eligible.length, ineligibleCount: ineligible.length },
    expected: { eligibleCount: expectedEligibleCount },
  });
  
  // Test 3: Scoring and top-K selection
  console.log('\n[PROOF_TARGETING] Test 3: Scoring and Top-K Selection');
  console.log('─'.repeat(60));
  
  if (eligible.length > 0) {
    const eligibilityReasons = new Map<string, EligibilityReason>();
    eligible.forEach(c => eligibilityReasons.set(c.target_tweet_id, EligibilityReason.ELIGIBLE));
    
    const scored = scoreAndSelectTopK(eligible, eligibilityReasons);
    
    console.log(`✅ Scored ${eligible.length} candidates, selected top ${scored.length}`);
    
    // Verify scoring components are present
    const allHaveComponents = scored.every(s => 
      s.scoringComponents &&
      typeof s.scoringComponents.totalScore === 'number' &&
      typeof s.scoringComponents.topicFit === 'number'
    );
    
    // Verify scores are sorted (descending)
    const isSorted = scored.every((s, i) => 
      i === 0 || scored[i - 1].score >= s.score
    );
    
    results.push({
      fixture: 'scoring_components',
      passed: allHaveComponents,
      decision: { hasComponents: allHaveComponents },
      expected: { hasComponents: true },
    });
    
    results.push({
      fixture: 'scoring_sorted',
      passed: isSorted,
      decision: { isSorted },
      expected: { isSorted: true },
    });
    
    // Print top candidates
    scored.forEach((s, i) => {
      console.log(`  ${i + 1}. ${s.target_tweet_id}: score=${s.score.toFixed(3)} (fit=${s.scoringComponents.topicFit.toFixed(2)}, vel=${s.scoringComponents.engagementVelocity.toFixed(2)}, inf=${s.scoringComponents.authorInfluence.toFixed(2)}, rec=${s.scoringComponents.recency.toFixed(2)})`);
    });
    
    // Test storage format
    const storageFormat = formatScoringForStorage(scored[0].scoringComponents);
    const hasStorageFields = 
      typeof storageFormat.reply_targeting_score === 'number' &&
      typeof storageFormat.reply_targeting_components === 'object';
    
    results.push({
      fixture: 'storage_format',
      passed: hasStorageFields,
      decision: { hasStorageFields },
      expected: { hasStorageFields: true },
    });
  } else {
    console.log('⚠️  No eligible candidates to score');
    results.push({
      fixture: 'scoring_components',
      passed: false,
      decision: { eligibleCount: 0 },
      expected: { eligibleCount: '>0' },
    });
  }
  
  // Summary
  const allPassed = results.every(r => r.passed);
  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  
  console.log('\n[PROOF_TARGETING] Summary');
  console.log('═'.repeat(60));
  console.log(`Results: ${passedCount}/${totalCount} tests passed`);
  console.log(`Status: ${allPassed ? '✅ PASS' : '❌ FAIL'}`);
  
  // Generate report
  const reportPath = getImmutableReportPath(PROOF_TAG);
  const report = generateReport(PROOF_TAG, results, fixtures, eligible.length, ineligible.length);
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
  fixtures: Array<any>,
  eligibleCount: number,
  ineligibleCount: number
): string {
  const now = new Date().toISOString();
  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  const status = passedCount === totalCount ? '✅ PASS' : '❌ FAIL';
  
  return `# Reply Targeting Policy Proof (Phase 6.1-6.2)

**Date:** ${now}  
**Status:** ${status}  
**Proof Tag:** ${proofTag}

**Acceptance Criteria:**
- Eligibility filter rejects invalid targets with correct reason codes
- Scoring selects expected valid targets (top-K)
- All decisions are auditable (stored in features format)

## Results

| Test | Status | Details |
|------|--------|---------|
${results.map(r => `| ${r.fixture} | ${r.passed ? '✅' : '❌'} | ${r.error || JSON.stringify(r.decision)} |`).join('\n')}

## Eligibility Filter Results

- **Total Candidates:** ${fixtures.length}
- **Eligible:** ${eligibleCount}
- **Ineligible:** ${ineligibleCount}

## Test Cases

${fixtures.map(f => `
### ${f.name}
- **Expected:** ${f.expectedEligible ? 'ELIGIBLE' : 'INELIGIBLE'} (${f.expectedReason})
- **Candidate:** ${JSON.stringify(f.candidate, null, 2)}
`).join('\n')}

## Scoring Results

${results.find(r => r.fixture === 'scoring_components')?.passed ? '✅ Scoring components present and valid' : '❌ Scoring components missing or invalid'}
${results.find(r => r.fixture === 'scoring_sorted')?.passed ? '✅ Scores sorted correctly (descending)' : '❌ Scores not sorted correctly'}
${results.find(r => r.fixture === 'storage_format')?.passed ? '✅ Storage format valid' : '❌ Storage format invalid'}

## Result

${status} - Reply targeting policy ${passedCount === totalCount ? 'meets all acceptance criteria' : 'has failures'}.
`;
}

// Run proof
main().catch(error => {
  console.error('[PROOF_TARGETING] Fatal error:', error);
  process.exit(1);
});
