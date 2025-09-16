#!/usr/bin/env tsx
"use strict";
/**
 * 🧪 POST GENERATION TEST
 *
 * Tests the authoritative content engine:
 * - Generates single tweet and thread examples
 * - Validates no first-person language
 * - Verifies evidence tags presence
 * - Shows content policy compliance
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const authoritativeEngine_1 = __importDefault(require("../src/content/authoritativeEngine"));
const contentPolicy_1 = __importDefault(require("../src/content/contentPolicy"));
async function testPostGeneration() {
    console.log('🧪 POST_TEST: Testing authoritative content generation...\n');
    const engine = authoritativeEngine_1.default.getInstance();
    const policy = contentPolicy_1.default.getInstance();
    // Test 1: Single Tweet Generation
    console.log('📝 TEST_1: Single tweet generation...');
    const singleResult = await engine.generatePost({
        topic: 'sleep optimization',
        format: 'single',
        complexity: 'simple'
    });
    console.log(`Result: ${singleResult.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    if (singleResult.success) {
        console.log(`Content: "${singleResult.content[0]}"`);
        console.log(`Evidence Score: ${singleResult.metadata.evidence_score.toFixed(2)}`);
        console.log(`Expert Voice Score: ${singleResult.metadata.expert_voice_score.toFixed(2)}`);
        console.log(`Evidence Tags: [${singleResult.metadata.evidence_tags.join(', ')}]`);
    }
    else {
        console.log(`Rejected: ${singleResult.metadata.rejected_reasons?.join(', ')}`);
    }
    // Policy check for single tweet
    const singlePolicyResult = await policy.enforcePolicy(singleResult.content);
    console.log(`Policy Compliance: ${singlePolicyResult.approved ? '✅ PASSED' : '❌ FAILED'}`);
    if (!singlePolicyResult.approved) {
        console.log(`Violations: ${singlePolicyResult.violations.join(', ')}`);
    }
    console.log();
    // Test 2: Thread Generation
    console.log('🧵 TEST_2: Thread generation...');
    const threadResult = await engine.generatePost({
        topic: 'metabolic health and exercise timing',
        format: 'thread',
        complexity: 'complex'
    });
    console.log(`Result: ${threadResult.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    if (threadResult.success) {
        console.log(`Format: ${threadResult.format} (${threadResult.content.length} tweets)`);
        console.log(`Thread Rationale: ${threadResult.metadata.thread_rationale}`);
        threadResult.content.forEach((tweet, index) => {
            console.log(`Tweet ${index + 1}: "${tweet}"`);
        });
        console.log(`Evidence Score: ${threadResult.metadata.evidence_score.toFixed(2)}`);
        console.log(`Expert Voice Score: ${threadResult.metadata.expert_voice_score.toFixed(2)}`);
        console.log(`Evidence Tags: [${threadResult.metadata.evidence_tags.join(', ')}]`);
    }
    else {
        console.log(`Rejected: ${threadResult.metadata.rejected_reasons?.join(', ')}`);
    }
    // Policy check for thread
    const threadPolicyResult = await policy.enforcePolicy(threadResult.content);
    console.log(`Policy Compliance: ${threadPolicyResult.approved ? '✅ PASSED' : '❌ FAILED'}`);
    if (!threadPolicyResult.approved) {
        console.log(`Violations: ${threadPolicyResult.violations.join(', ')}`);
    }
    console.log();
    // Test 3: Auto-format Detection
    console.log('🤖 TEST_3: Auto-format detection...');
    const autoResult = await engine.generatePost({
        topic: 'cardiovascular health markers and their clinical significance in preventive medicine',
        format: 'auto',
        complexity: 'complex'
    });
    console.log(`Result: ${autoResult.success ? '✅ SUCCESS' : '❌ FAILED'}`);
    if (autoResult.success) {
        console.log(`Auto-detected format: ${autoResult.format}`);
        console.log(`Content pieces: ${autoResult.content.length}`);
        console.log(`First piece: "${autoResult.content[0]}"`);
    }
    console.log();
    // Test 4: Policy Violation Test
    console.log('🚫 TEST_4: Policy violation detection...');
    const violationTest = await policy.enforcePolicy([
        "I tried this new supplement and it's amazing!",
        "My friend told me about this health hack.",
        "You should definitely take vitamin D every day."
    ]);
    console.log(`Violation Detection: ${!violationTest.approved ? '✅ CORRECTLY_REJECTED' : '❌ SHOULD_REJECT'}`);
    if (!violationTest.approved) {
        console.log(`Detected Violations:`);
        violationTest.violations.forEach((violation, index) => {
            console.log(`  ${index + 1}. ${violation}`);
        });
        console.log(`Recommendations:`);
        violationTest.recommendations.forEach((rec, index) => {
            console.log(`  ${index + 1}. ${rec}`);
        });
    }
    console.log();
    // Test 5: Content Quality Gates
    console.log('🚪 TEST_5: Quality gate enforcement...');
    const qualityTestContent = [
        "Research demonstrates a 40% improvement in sleep quality when blue light exposure ends 60 minutes before circadian rhythm preparation. [Harvard Sleep Medicine, 2023]",
        "Clinical studies reveal optimal protein synthesis occurs within 2-hour post-exercise window. [Journal of Sports Medicine]",
        "Evidence suggests 23% reduction in cardiovascular risk markers through targeted micronutrient optimization. [Mayo Clinic Research]"
    ];
    const qualityResult = await policy.enforcePolicy(qualityTestContent);
    console.log(`Quality Gates: ${qualityResult.approved ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Overall Score: ${(qualityResult.overall_score * 100).toFixed(1)}%`);
    console.log(`Checks Passed: ${qualityResult.checks.filter(c => c.passed).length}/${qualityResult.checks.length}`);
    qualityResult.checks.forEach(check => {
        const status = check.passed ? '✅' : '❌';
        const score = check.score ? ` (${(check.score * 100).toFixed(1)}%)` : '';
        console.log(`  ${status} ${check.name}${score}`);
    });
    console.log('\n' + '='.repeat(60));
    console.log('🎯 TEST_SUMMARY:');
    console.log(`Single Tweet: ${singleResult.success && singlePolicyResult.approved ? '✅' : '❌'}`);
    console.log(`Thread Generation: ${threadResult.success && threadPolicyResult.approved ? '✅' : '❌'}`);
    console.log(`Auto-format: ${autoResult.success ? '✅' : '❌'}`);
    console.log(`Policy Enforcement: ${!violationTest.approved ? '✅' : '❌'}`);
    console.log(`Quality Gates: ${qualityResult.approved ? '✅' : '❌'}`);
    const allTestsPassed = singleResult.success &&
        singlePolicyResult.approved &&
        threadResult.success &&
        threadPolicyResult.approved &&
        autoResult.success &&
        !violationTest.approved && // Should reject violations
        qualityResult.approved;
    if (allTestsPassed) {
        console.log('\n✅ ALL_TESTS_PASSED: Content generation system ready');
        process.exit(0);
    }
    else {
        console.log('\n❌ SOME_TESTS_FAILED: Review output above');
        process.exit(1);
    }
}
// Run tests
testPostGeneration().catch(error => {
    console.error('💥 POST_TEST_FAILED:', error);
    process.exit(1);
});
//# sourceMappingURL=test-post.js.map