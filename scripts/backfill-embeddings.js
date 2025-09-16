#!/usr/bin/env npx ts-node
"use strict";
/**
 * Backfill Embeddings Script
 * Computes embeddings and content_hash for existing unified_posts
 */
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
const embeddings_1 = require("../src/learning/embeddings");
const logger_1 = require("../src/utils/logger");
async function main() {
    const args = process.argv.slice(2);
    const limit = args.length > 0 ? parseInt(args[0], 10) : 100;
    if (isNaN(limit) || limit <= 0) {
        console.error('Usage: npm run backfill-embeddings [limit]');
        console.error('Example: npm run backfill-embeddings 50');
        process.exit(1);
    }
    (0, logger_1.log_compat)(`BACKFILL_EMBEDDINGS: Starting backfill for up to ${limit} posts`);
    console.log(`⚡ Backfilling embeddings for up to ${limit} posts...`);
    try {
        const startTime = Date.now();
        const result = await (0, embeddings_1.backfillEmbeddings)(limit);
        const duration = Date.now() - startTime;
        console.log(`✅ Backfill completed in ${duration}ms`);
        console.log(`📊 Results:`);
        console.log(`   - Processed: ${result.processed} posts`);
        console.log(`   - Errors: ${result.errors} posts`);
        console.log(`   - Success rate: ${((result.processed / (result.processed + result.errors)) * 100).toFixed(1)}%`);
        if (result.errors > 0) {
            (0, logger_1.log_compat)(`⚠️ Some posts failed to process. Check logs for details.`);
        }
        process.exit(0);
    }
    catch (err) {
        (0, logger_1.log_compat)(`❌ BACKFILL_FAILED: ${err.message}`);
        console.error(`❌ Backfill failed: ${err.message}`);
        process.exit(1);
    }
}
// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
    console.log('\n⚠️ Backfill interrupted by user');
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
//# sourceMappingURL=backfill-embeddings.js.map