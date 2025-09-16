#!/usr/bin/env npx ts-node
"use strict";
/**
 * Learning Job Runner
 * Runs aggregateAndLearn once for manual testing
 */
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
const aggregateAndLearn_1 = require("../src/jobs/aggregateAndLearn");
const logger_1 = require("../src/utils/logger");
async function main() {
    (0, logger_1.log_compat)(`JOBS_LEARN: Starting manual learning job execution`);
    console.log(`🧠 Running learning aggregation job...`);
    try {
        const startTime = Date.now();
        const result = await (0, aggregateAndLearn_1.runAggregateAndLearn)();
        const duration = Date.now() - startTime;
        console.log(`✅ Learning job completed in ${duration}ms`);
        console.log(`📊 Results:`);
        console.log(`   - Posts processed: ${result.postsProcessed}`);
        console.log(`   - Arms updated: ${result.armsUpdated}`);
        console.log(`   - Models retrained: ${result.modelsRetrained ? 'Yes' : 'No'}`);
        console.log(`   - Embeddings processed: ${result.embeddingsProcessed}`);
        if (result.errors.length > 0) {
            console.log(`   - Errors: ${result.errors.length}`);
            result.errors.forEach((err, i) => {
                console.log(`     ${i + 1}. ${err}`);
            });
        }
        if (result.postsProcessed === 0) {
            console.log(`ℹ️ No recent posts found to process (check LEARNING_LOOKBACK_DAYS)`);
        }
        process.exit(0);
    }
    catch (err) {
        (0, logger_1.log_compat)(`❌ LEARNING_JOB_FAILED: ${err.message}`);
        console.error(`❌ Learning job failed: ${err.message}`);
        process.exit(1);
    }
}
// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
    console.log('\n⚠️ Learning job interrupted by user');
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
//# sourceMappingURL=jobs-learn.js.map