#!/usr/bin/env npx ts-node
"use strict";
/**
 * Dry Run Reply Script
 * Shows reply planning without posting for testing reply systems
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
const replyCycle_1 = require("../src/jobs/replyCycle");
const logger_1 = require("../src/utils/logger");
async function main() {
    // Override settings for dry run
    process.env.POSTING_DISABLED = 'true';
    process.env.ENABLE_REPLIES = 'true';
    (0, logger_1.log_compat)(`DRYRUN_REPLY: Testing reply cycle (dry run mode)`);
    console.log(`💬 Testing reply cycle (no actual replies)...`);
    console.log(`📊 Environment: POSTING_DISABLED=true, ENABLE_REPLIES=true\n`);
    try {
        const startTime = Date.now();
        // First, show current status
        console.log('📊 Reply Cycle Status:');
        const status = await (0, replyCycle_1.getReplyCycleStatus)();
        console.log(`   Enabled: ${status.enabled}`);
        console.log(`   Quota Used: ${status.quotaUsed}/${status.quotaLimit}`);
        if (status.timeUntilNextReply) {
            const minutesUntilNext = Math.ceil(status.timeUntilNextReply / 60000);
            console.log(`   Time Until Next: ${minutesUntilNext} minutes`);
        }
        console.log(`   Active Targets: ${status.activeTargets}`);
        if (status.lastDiscovery) {
            console.log(`   Last Discovery: ${status.lastDiscovery}`);
        }
        console.log('\n🔍 Running Reply Discovery and Planning...\n');
        // Run the reply cycle
        const result = await (0, replyCycle_1.runReplyCycle)();
        console.log('📋 Reply Cycle Results:');
        console.log(`   Targets Discovered: ${result.targetsDiscovered}`);
        console.log(`   Replies Planned: ${result.repliesPlanned}`);
        console.log(`   Quota Used: ${result.quotaUsed}`);
        if (result.errors.length > 0) {
            console.log(`   Errors: ${result.errors.length}`);
            result.errors.forEach((err, i) => {
                console.log(`     ${i + 1}. ${err}`);
            });
        }
        // Explain what would happen in real mode
        console.log('\n💡 In Production Mode:');
        if (result.repliesPlanned > 0) {
            console.log('   ✅ Would generate reply content');
            console.log('   ✅ Would validate reply quality');
            console.log('   ✅ Would post reply if valid');
            console.log('   ✅ Would update quota tracking');
            console.log('   ✅ Would track reply for learning');
        }
        else if (result.targetsDiscovered === 0) {
            console.log('   ℹ️ No reply targets discovered');
            console.log('   💡 In real mode, would monitor health hashtags and discussions');
            console.log('   💡 Would look for questions and conversations to engage');
        }
        else {
            console.log('   ⚠️ Targets found but none met opportunity threshold');
            console.log('   💡 Would wait for better opportunities');
        }
        // Show sample reply arms if possible
        console.log('\n🎯 Sample Reply Strategy (for demonstration):');
        const { selectReplyArm } = await Promise.resolve().then(() => __importStar(require('../src/learning/bandits')));
        try {
            const replySelection = await selectReplyArm(['health_questions', 'nutrition_tips', 'fitness_advice'], ['supportive', 'informative', 'expert_insight']);
            console.log(`   Selected Reply Arm: ${replySelection.armId}`);
            console.log(`   Algorithm: ${replySelection.algorithm}`);
            console.log(`   Expected Reward: ${replySelection.expectedReward.toFixed(3)}`);
            console.log(`   Reasoning: ${replySelection.reason}`);
        }
        catch (banditErr) {
            console.log('   ℹ️ No bandit data available yet (need more reply history)');
        }
        const duration = Date.now() - startTime;
        console.log(`\n✅ Reply dry run completed in ${duration}ms`);
        process.exit(0);
    }
    catch (err) {
        (0, logger_1.log_compat)(`❌ DRYRUN_REPLY_FAILED: ${err.message}`);
        console.error(`❌ Reply dry run failed: ${err.message}`);
        process.exit(1);
    }
}
// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
    console.log('\n⚠️ Reply dry run interrupted by user');
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
//# sourceMappingURL=dryrun-reply.js.map