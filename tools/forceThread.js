#!/usr/bin/env tsx
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Force thread posting CLI tool
 * Usage: npm run post:thread [topic] [mode]
 */
const intelligentContentGenerator_1 = require("../src/agents/intelligentContentGenerator");
const autonomousTwitterPoster_1 = require("../src/agents/autonomousTwitterPoster");
const tweetLinter_1 = require("../src/utils/tweetLinter");
const config_1 = require("../src/config");
async function forceThread() {
    const args = process.argv.slice(2);
    const topic = args[0] || 'sleep optimization';
    const mode = args[1] || 'how_to';
    const validModes = ['how_to', 'myth_bust', 'checklist', 'story', 'stat_drop'];
    if (!validModes.includes(mode)) {
        console.error(`❌ Invalid mode: ${mode}. Must be one of: ${validModes.join(', ')}`);
        process.exit(1);
    }
    try {
        console.log(`FORCE_THREAD_START topic="${topic}" mode="${mode}"`);
        // Load config
        const config = await (0, config_1.loadBotConfig)();
        console.log(`📋 Config loaded: threads=${config.enableThreads}, force=${config.forcePost}`);
        if (!config.livePostsEnabled) {
            console.error('❌ LIVE_POSTS is disabled. Set LIVE_POSTS=true to post to X.');
            process.exit(1);
        }
        // Initialize components
        console.log('🧠 Initializing content generator...');
        const contentGenerator = intelligentContentGenerator_1.IntelligentContentGenerator.getInstance();
        console.log('🤖 Initializing Twitter poster...');
        const poster = autonomousTwitterPoster_1.AutonomousTwitterPoster.getInstance();
        await poster.initialize();
        // Generate thread
        console.log(`🎯 Generating ${mode} thread about "${topic}"...`);
        const threadData = await contentGenerator.generateSignalSynapseThread(topic);
        console.log(`✅ Generated thread:`);
        console.log(`📖 Topic: ${threadData.topic}`);
        console.log(`🎯 Hook type: ${threadData.hook_type}`);
        console.log(`📊 Tweet count: ${threadData.tweets.length}`);
        console.log(`🔗 Sources: ${threadData.source_urls.length}`);
        // Validate length constraints
        if (threadData.tweets.length < config.threadMinTweets ||
            threadData.tweets.length > config.threadMaxTweets) {
            console.error(`❌ Thread length ${threadData.tweets.length} outside bounds [${config.threadMinTweets}, ${config.threadMaxTweets}]`);
            process.exit(1);
        }
        // Lint the tweets
        console.log('🔍 Linting tweets...');
        const { tweets, reasons } = (0, tweetLinter_1.lintAndSplitThread)(threadData.tweets);
        if (reasons.length > 0) {
            console.log(`🔧 Linting applied: ${reasons.join(', ')}`);
        }
        console.log(`✅ Final tweet count: ${tweets.length}`);
        // Display tweets
        console.log('\n📝 Thread content:');
        tweets.forEach((tweet, i) => {
            console.log(`T${i + 1} (${tweet.length} chars): ${tweet.substring(0, 80)}${tweet.length > 80 ? '...' : ''}`);
        });
        // Confirm posting
        if (process.env.FORCE_CONFIRM !== 'false') {
            const readline = require('readline');
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });
            const answer = await new Promise(resolve => {
                rl.question('\n🚀 Post this thread to X? (y/N): ', resolve);
            });
            rl.close();
            if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
                console.log('❌ Posting cancelled by user');
                process.exit(0);
            }
        }
        // Post the thread
        console.log('\n🚀 Posting thread...');
        const startTime = Date.now();
        const result = await poster.postThread(tweets);
        const duration = Date.now() - startTime;
        console.log(`\n✅ THREAD POSTED SUCCESSFULLY!`);
        console.log(`🆔 Root ID: ${result.rootTweetId}`);
        console.log(`🔗 Permalink: ${result.permalink}`);
        console.log(`💬 Replies: ${result.replyIds.length}`);
        console.log(`⏱️  Duration: ${duration}ms`);
        console.log(`\nFinal permalink: ${result.permalink}`);
    }
    catch (error) {
        console.error(`❌ Force thread failed:`, error.message);
        if (error.message.includes('THREAD_ABORT_INVALID_LENGTH')) {
            console.log('💡 Try a different topic or adjust THREAD_MIN_TWEETS/THREAD_MAX_TWEETS');
        }
        if (error.message.includes('POST_SKIPPED_NO_SESSION')) {
            console.log('💡 Run: npm run seed:session to save Twitter login');
        }
        process.exit(1);
    }
}
// Run if called directly
if (require.main === module) {
    forceThread();
}
//# sourceMappingURL=forceThread.js.map