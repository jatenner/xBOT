#!/usr/bin/env tsx
"use strict";
/**
 * 🧪 VERIFICATION TEST RUNNER
 * Runs comprehensive mega prompt verification
 */
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
const megaPromptVerification_1 = require("../src/test/megaPromptVerification");
async function runVerification() {
    try {
        console.log('🧪 MEGA_PROMPT_VERIFICATION_RUNNER');
        console.log('=====================================\n');
        const result = await megaPromptVerification_1.megaPromptVerification.runFullVerification();
        console.log('\n📊 VERIFICATION_SUMMARY:');
        console.log(`🎯 Overall Status: ${result.overallStatus}`);
        console.log(`📝 Drafts Generated: ${result.draftsTest.summary.totalDrafts}`);
        console.log(`✅ Quality Gates Passed: ${result.draftsTest.summary.passedQualityGates}/${result.draftsTest.summary.totalDrafts}`);
        console.log(`📋 Fact Tokens Present: ${result.draftsTest.summary.hasFactTokens}/${result.draftsTest.summary.totalDrafts}`);
        console.log(`📈 Average Quality: ${result.draftsTest.summary.averageQualityScore}/100`);
        console.log(`🚀 Average Viral: ${result.draftsTest.summary.averageViralScore}/100`);
        if (result.issues.length > 0) {
            console.log('\n❌ ISSUES TO RESOLVE:');
            result.issues.forEach((issue, i) => console.log(`   ${i + 1}. ${issue}`));
            process.exit(1);
        }
        else {
            console.log('\n✅ ALL_TESTS_PASSED: Mega Prompt Pipeline ready for deployment!');
            process.exit(0);
        }
    }
    catch (error) {
        console.error('❌ VERIFICATION_ERROR:', error);
        process.exit(1);
    }
}
runVerification();
//# sourceMappingURL=verification-test.js.map