#!/usr/bin/env npx ts-node
"use strict";
/**
 * Dry Run Planning Script
 * Plans content without posting for testing bandit and predictor systems
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
const planNext_1 = require("../src/jobs/planNext");
const logger_1 = require("../src/utils/logger");
async function main() {
    const args = process.argv.slice(2);
    const count = args.length > 0 ? parseInt(args[0], 10) : 3;
    if (isNaN(count) || count <= 0 || count > 20) {
        console.error('Usage: npm run dryrun:plan [count]');
        console.error('Example: npm run dryrun:plan 5');
        console.error('Count must be between 1-20');
        process.exit(1);
    }
    // Override posting disabled for dry run
    process.env.POSTING_DISABLED = 'true';
    (0, logger_1.log_compat)(`DRYRUN_PLAN: Planning ${count} content pieces (dry run mode)`);
    console.log(`🎯 Planning ${count} content pieces (no posting)...`);
    console.log(`📊 Environment: POSTING_DISABLED=true, ENABLE_BANDIT_LEARNING=${process.env.ENABLE_BANDIT_LEARNING || 'false'}\n`);
    try {
        const startTime = Date.now();
        if (count === 1) {
            // Single plan with detailed output
            const plan = await (0, planNext_1.planNextContent)();
            if (!plan) {
                console.log('❌ No plan generated (check configuration)');
                process.exit(1);
            }
            displayPlanDetails(plan, 1);
            // Also show learning-aware decision
            console.log('\n🤖 Learning-Aware Decision:');
            try {
                const { IntelligentDecisionEngine } = await Promise.resolve().then(() => __importStar(require('../src/ai/intelligentDecisionEngine')));
                const intelligentDecision = IntelligentDecisionEngine.getInstance();
                const decision = await intelligentDecision.makeLearningAwareDecision();
                console.log(`   Timing Arm: ${decision.timing_arm}`);
                console.log(`   Content Arm: ${decision.content_arm}`);
                console.log(`   Should Post: ${decision.should_post_now}`);
                console.log(`   Predicted ER: ${(decision.predicted_er * 100).toFixed(2)}%`);
                console.log(`   Predicted FT: ${(decision.predicted_follow_through * 100).toFixed(3)}%`);
                console.log(`   Reasons: ${decision.reasons.join(', ')}`);
            }
            catch (decisionErr) {
                (0, logger_1.log_compat)(`Failed to get learning-aware decision: ${decisionErr}`);
            }
        }
        else {
            // Batch planning
            const plans = await (0, planNext_1.planBatchContent)(count);
            if (plans.length === 0) {
                console.log('❌ No plans generated (check configuration)');
                process.exit(1);
            }
            console.log(`📋 Generated ${plans.length} plans:\n`);
            plans.forEach((plan, index) => {
                displayPlanSummary(plan, index + 1);
            });
            // Summary statistics
            const avgER = plans.reduce((sum, p) => sum + p.predictedER, 0) / plans.length;
            const avgFT = plans.reduce((sum, p) => sum + p.predictedFollowThrough, 0) / plans.length;
            const avgConfidence = plans.reduce((sum, p) => sum + p.confidence, 0) / plans.length;
            console.log('\n📊 Batch Summary:');
            console.log(`   Average Predicted ER: ${(avgER * 100).toFixed(2)}%`);
            console.log(`   Average Predicted FT: ${(avgFT * 100).toFixed(3)}%`);
            console.log(`   Average Confidence: ${(avgConfidence * 100).toFixed(1)}%`);
            // Format distribution
            const formatCounts = plans.reduce((acc, p) => {
                acc[p.format] = (acc[p.format] || 0) + 1;
                return acc;
            }, {});
            console.log(`   Format Distribution: ${Object.entries(formatCounts).map(([f, c]) => `${f}:${c}`).join(', ')}`);
        }
        const duration = Date.now() - startTime;
        console.log(`\n✅ Planning completed in ${duration}ms`);
        process.exit(0);
    }
    catch (err) {
        (0, logger_1.log_compat)(`❌ DRYRUN_PLAN_FAILED: ${err.message}`);
        console.error(`❌ Planning failed: ${err.message}`);
        process.exit(1);
    }
}
function displayPlanDetails(plan, index) {
    console.log(`📋 Plan #${index}:`);
    console.log(`   Format: ${plan.format}`);
    console.log(`   Hook Type: ${plan.hookType}`);
    console.log(`   Topic: ${plan.topic}`);
    console.log(`   Content Style: ${plan.contentStyle}`);
    console.log(`   Timing Arm: ${plan.timingArm}`);
    console.log(`   Content Arm: ${plan.contentArm}`);
    console.log(`   Predicted ER: ${(plan.predictedER * 100).toFixed(2)}%`);
    console.log(`   Predicted FT: ${(plan.predictedFollowThrough * 100).toFixed(3)}%`);
    console.log(`   Confidence: ${(plan.confidence * 100).toFixed(1)}%`);
    if (plan.experimentId) {
        console.log(`   Experiment: ${plan.experimentId} (variant ${plan.experimentVariant})`);
    }
    console.log(`   Reasoning:`);
    plan.reasoning.forEach((reason, i) => {
        console.log(`     ${i + 1}. ${reason}`);
    });
}
function displayPlanSummary(plan, index) {
    const er = (plan.predictedER * 100).toFixed(1);
    const ft = (plan.predictedFollowThrough * 100).toFixed(2);
    const conf = (plan.confidence * 100).toFixed(0);
    console.log(`${index}. ${plan.format} | ${plan.hookType} | ${plan.topic} | ER:${er}% FT:${ft}% Conf:${conf}%`);
    if (plan.experimentId) {
        console.log(`   └─ Experiment: ${plan.experimentId} (${plan.experimentVariant})`);
    }
}
// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
    console.log('\n⚠️ Planning interrupted by user');
    process.exit(130);
});
// Handle uncaught errors
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught exception:', err);
    process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled rejection at:', promise, 'reason:', reason);
    process.exit(1);
});
if (require.main === module) {
    main();
}
//# sourceMappingURL=dryrun-plan.js.map