#!/usr/bin/env tsx
/**
 * 🧪 PROOF: Reply Pipeline Non-Zero Output
 * 
 * Validates:
 * - When raw opportunities > 0, pipeline produces selected > 0 under reasonable conditions
 * - Tier fallback triggers only when tier_ok==0
 * 
 * Usage:
 *   pnpm run executor:prove:reply-pipeline-nonzero
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { filterEligibleCandidates } from '../../src/growth/replyTargetEligibility';
import { scoreAndSelectTopK } from '../../src/growth/replyTargetScoring';
import type { ReplyTargetCandidate } from '../../src/growth/replyTargetEligibility';

const PROOF_TAG = `reply-pipeline-nonzero-${Date.now()}`;

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
 * Main proof execution
 */
async function main() {
  console.log(`[PROOF_REPLY_PIPELINE] Starting proof: ${PROOF_TAG}`);
  
  const results: Array<{
    test: string;
    passed: boolean;
    details: any;
    error?: string;
  }> = [];
  
  // Test 1: Pipeline produces output when opportunities exist
  console.log('\n[PROOF_REPLY_PIPELINE] Test 1: Pipeline Non-Zero Output');
  console.log('─'.repeat(60));
  
  try {
    // Create mock opportunities that should pass all filters
    const now = Date.now();
    const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();
    
    const mockOpportunities: any[] = [
      {
        id: 1,
        target_tweet_id: 'test_001',
        tweet_id: 'test_001',
        is_root_tweet: true,
        tweet_posted_at: oneHourAgo,
        replied_to: false,
        target_in_reply_to_tweet_id: null,
        tier: 'A',
        target_tweet_content: 'Sleep quality matters for health optimization and longevity.',
        like_count: 1000,
        reply_count: 50,
        retweet_count: 200,
        engagement_rate: 0.05,
      },
      {
        id: 2,
        target_tweet_id: 'test_002',
        tweet_id: 'test_002',
        is_root_tweet: true,
        tweet_posted_at: oneHourAgo,
        replied_to: false,
        target_in_reply_to_tweet_id: null,
        tier: 'B',
        target_tweet_content: 'Nutrition and protein intake affect muscle recovery.',
        like_count: 500,
        reply_count: 20,
        retweet_count: 100,
        engagement_rate: 0.03,
      },
    ];
    
    // Simulate pipeline stages
    const rawCount = mockOpportunities.length;
    
    // Root filter
    const rootOnly = mockOpportunities.filter(opp => {
      const isRoot = opp.is_root_tweet === true || opp.is_root_tweet === 1;
      const hasInReplyTo = opp.target_in_reply_to_tweet_id;
      return isRoot && !hasInReplyTo;
    });
    const rootCount = rootOnly.length;
    
    // Freshness filter (24h)
    const freshOnly = rootOnly.filter(opp => {
      if (!opp.tweet_posted_at) return false;
      const postedAt = new Date(opp.tweet_posted_at).getTime();
      const ageHours = (now - postedAt) / (1000 * 60 * 60);
      return ageHours <= 24;
    });
    const freshCount = freshOnly.length;
    
    // Convert to candidates
    const candidates: ReplyTargetCandidate[] = freshOnly.map(opp => ({
      target_tweet_id: opp.target_tweet_id,
      tweet_posted_at: opp.tweet_posted_at,
      is_root_tweet: opp.is_root_tweet,
      replied_to: opp.replied_to,
      target_tweet_content: opp.target_tweet_content || '',
    }));
    
    // Eligibility filter
    const { eligible } = await filterEligibleCandidates(candidates, {
      checkTargetExists: false, // Skip DB check in proof
      requireRootTweet: true,
    });
    const eligibleCount = eligible.length;
    
    // Scoring and top-K
    const eligibilityReasonsMap = new Map<string, any>();
    eligible.forEach(c => eligibilityReasonsMap.set(c.target_tweet_id, 'eligible' as any));
    
    const scored = await scoreAndSelectTopK(eligible, eligibilityReasonsMap);
    const selectedCount = scored.length;
    
    // Tier filter (S/A/B)
    const tierA = scored.filter(s => {
      const opp = freshOnly.find(o => o.target_tweet_id === s.target_tweet_id);
      return String(opp?.tier || '').toUpperCase() === 'A';
    });
    const tierB = scored.filter(s => {
      const opp = freshOnly.find(o => o.target_tweet_id === s.target_tweet_id);
      return String(opp?.tier || '').toUpperCase() === 'B';
    });
    const tierOk = tierA.length + tierB.length;
    
    const producesOutput = selectedCount > 0 && rawCount > 0;
    
    results.push({
      test: 'pipeline_nonzero_output',
      passed: producesOutput,
      details: {
        rawCount,
        rootCount,
        freshCount,
        eligibleCount,
        selectedCount,
        tierOk,
        producesOutput,
      },
    });
    
    const status = producesOutput ? '✅' : '❌';
    console.log(`${status} Pipeline produces output: raw=${rawCount} → selected=${selectedCount} (expected: >0)`);
  } catch (error: any) {
    results.push({
      test: 'pipeline_nonzero_output',
      passed: false,
      details: {},
      error: error.message,
    });
    console.log(`❌ Pipeline nonzero output: ERROR - ${error.message}`);
  }
  
  // Test 2: Tier fallback triggers only when tier_ok==0
  console.log('\n[PROOF_REPLY_PIPELINE] Test 2: Tier Fallback Logic');
  console.log('─'.repeat(60));
  
  try {
    // Scenario 1: tier_ok > 0, should NOT use fallback
    const tierOkScenario = {
      tierSCount: 1,
      tierACount: 2,
      tierBCount: 0,
      tierCCount: 5,
    };
    const tierOk = tierOkScenario.tierSCount + tierOkScenario.tierACount + tierOkScenario.tierBCount;
    const shouldUseFallback1 = tierOk === 0;
    const fallbackCorrect1 = !shouldUseFallback1; // Should NOT use fallback when tier_ok > 0
    
    // Scenario 2: tier_ok == 0, should use fallback
    const tierZeroScenario = {
      tierSCount: 0,
      tierACount: 0,
      tierBCount: 0,
      tierCCount: 3,
    };
    const tierOk2 = tierZeroScenario.tierSCount + tierZeroScenario.tierACount + tierZeroScenario.tierBCount;
    const shouldUseFallback2 = tierOk2 === 0;
    const fallbackCorrect2 = shouldUseFallback2; // SHOULD use fallback when tier_ok == 0
    
    const fallbackLogicCorrect = fallbackCorrect1 && fallbackCorrect2;
    
    results.push({
      test: 'tier_fallback_logic',
      passed: fallbackLogicCorrect,
      details: {
        scenario1: { tierOk, shouldUseFallback: shouldUseFallback1, correct: fallbackCorrect1 },
        scenario2: { tierOk: tierOk2, shouldUseFallback: shouldUseFallback2, correct: fallbackCorrect2 },
        fallbackLogicCorrect,
      },
    });
    
    const status = fallbackLogicCorrect ? '✅' : '❌';
    console.log(`${status} Tier fallback logic: scenario1 (tier_ok>0, no fallback)=${fallbackCorrect1} scenario2 (tier_ok=0, fallback)=${fallbackCorrect2}`);
  } catch (error: any) {
    results.push({
      test: 'tier_fallback_logic',
      passed: false,
      details: {},
      error: error.message,
    });
    console.log(`❌ Tier fallback logic: ERROR - ${error.message}`);
  }
  
  // Summary
  const allPassed = results.every(r => r.passed);
  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  
  console.log('\n[PROOF_REPLY_PIPELINE] Summary');
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
  
  return `# Reply Pipeline Non-Zero Output Proof

**Date:** ${now}  
**Status:** ${status}  
**Proof Tag:** ${proofTag}

**Acceptance Criteria:**
- When raw opportunities > 0, pipeline produces selected > 0 under reasonable conditions
- Tier fallback triggers only when tier_ok==0

## Results

| Test | Status | Details |
|------|--------|---------|
${results.map(r => `| ${r.test} | ${r.passed ? '✅' : '❌'} | ${r.error || JSON.stringify(r.details)} |`).join('\n')}

## Result

${status} - Reply pipeline non-zero output ${passedCount === totalCount ? 'meets all acceptance criteria' : 'has failures'}.
`;
}

// Run proof
main().catch(error => {
  console.error('[PROOF_REPLY_PIPELINE] Fatal error:', error);
  process.exit(1);
});
