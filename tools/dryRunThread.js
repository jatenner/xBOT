#!/usr/bin/env tsx
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const intelligentContentGenerator_1 = require("../src/agents/intelligentContentGenerator");
const tweetLinter_1 = require("../src/utils/tweetLinter");
const config_1 = require("../src/config");
const fs_1 = __importDefault(require("fs"));
const SESSION_PATH = '/app/data/twitter_session.json';
async function dryRunThread() {
    console.log('🧪 DRY RUN: Thread generation test');
    // Check if session exists
    if (!fs_1.default.existsSync(SESSION_PATH)) {
        console.log('⚠️  Session file not found at', SESSION_PATH);
        console.log('💡 Run: npm run seed:session');
        process.exit(1);
    }
    try {
        // Load config
        const config = await (0, config_1.loadBotConfig)();
        console.log(`📋 Config: threads=${config.enableThreads}, min=${config.threadMinTweets}, max=${config.threadMaxTweets}`);
        // Initialize content generator
        console.log('🧠 Initializing content generator...');
        const contentGenerator = intelligentContentGenerator_1.IntelligentContentGenerator.getInstance();
        // Generate thread
        console.log('🎯 Generating Signal_Synapse thread...');
        const threadData = await contentGenerator.generateSignalSynapseThread('sleep optimization');
        console.log('✅ Generated thread:');
        console.log(`📖 Topic: ${threadData.topic}`);
        console.log(`🎯 Hook type: ${threadData.hook_type}`);
        console.log(`📊 Tweet count: ${threadData.tweets.length}`);
        console.log(`🔗 Sources: ${threadData.source_urls.length}`);
        // Test linter
        console.log('\n🔍 Testing linter...');
        const { tweets, reasons } = (0, tweetLinter_1.lintAndSplitThread)(threadData.tweets);
        console.log(`✅ Linter result: ${tweets.length} tweets`);
        if (reasons.length > 0) {
            console.log(`🔧 Fixes applied: ${reasons.join(', ')}`);
        }
        // Display tweets
        console.log('\n📝 Final tweets:');
        tweets.forEach((tweet, i) => {
            console.log(`T${i + 1} (${tweet.length} chars): ${tweet}`);
        });
        console.log('\n📊 Thread stats:');
        console.log(`First tweet: ${tweets[0].substring(0, 50)}...`);
        console.log(`Last tweet: ${tweets[tweets.length - 1].substring(0, 50)}...`);
        console.log(`Total characters: ${tweets.reduce((sum, t) => sum + t.length, 0)}`);
        console.log('\n✅ Dry run completed successfully!');
        console.log('💡 Thread would be posted as:', tweets.length === 1 ? 'single tweet' : `${tweets.length}-tweet reply chain`);
    }
    catch (error) {
        console.error('❌ Dry run failed:', error.message);
        if (error.message.includes('THREAD_ABORT_INVALID_LENGTH')) {
            console.log('💡 Try adjusting THREAD_MIN_TWEETS or THREAD_MAX_TWEETS environment variables');
        }
        process.exit(1);
    }
}
// Run if called directly
if (require.main === module) {
    dryRunThread();
}
//# sourceMappingURL=dryRunThread.js.map