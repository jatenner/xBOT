#!/usr/bin/env tsx
"use strict";
/**
 * Dry Run Post Generator
 * Generates content without posting; prints quality scores and chosen template
 */
Object.defineProperty(exports, "__esModule", { value: true });
const threadComposer_1 = require("../src/content/threadComposer");
const qualityGate_1 = require("../src/content/qualityGate");
const replyEngine_1 = require("../src/reply/replyEngine");
async function main() {
    console.log('🧪 DRY RUN: Content Generation & Quality Assessment');
    console.log('===============================================\n');
    // Parse command line arguments
    const args = process.argv.slice(2);
    const options = {};
    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--type':
                options.type = args[++i];
                break;
            case '--topic':
                options.topic = args[++i];
                break;
            case '--target-tweet':
                options.targetTweet = args[++i];
                break;
            case '--template':
                options.templateType = args[++i];
                break;
            case '--help':
                showHelp();
                process.exit(0);
        }
    }
    // Default options
    options.type = options.type || 'thread';
    options.topic = options.topic || 'sleep optimization';
    console.log(`📝 Type: ${options.type}`);
    console.log(`🎯 Topic: ${options.topic}`);
    if (options.templateType)
        console.log(`📋 Template: ${options.templateType}`);
    if (options.targetTweet)
        console.log(`🎯 Target Tweet: ${options.targetTweet}`);
    console.log('');
    try {
        if (options.type === 'reply') {
            await runReplyDryRun(options);
        }
        else if (options.type === 'thread') {
            await runThreadDryRun(options);
        }
        else {
            await runSingleDryRun(options);
        }
        console.log('\n✅ Dry run completed successfully!');
        console.log('💡 Use --help to see all options');
    }
    catch (error) {
        console.error('\n❌ Dry run failed:', error.message);
        process.exit(1);
    }
}
async function runThreadDryRun(options) {
    console.log('🧵 THREAD GENERATION');
    console.log('==================\n');
    const composer = new threadComposer_1.ThreadComposer();
    const qualityGate = new qualityGate_1.QualityGate();
    // Show available templates
    const templates = composer.getAvailableTemplates();
    console.log('📋 Available Templates:');
    templates.forEach((template, i) => {
        const marker = (options.templateType && template.type === options.templateType) ? '👉' : '  ';
        console.log(`${marker} ${i + 1}. ${template.type} (${template.targetTweets} tweets) - ${template.description}`);
    });
    console.log('');
    // Generate thread
    console.log('⚡ Generating thread...');
    const threadResult = await composer.generateThread(options.topic, options.templateType);
    console.log(`\n📄 Generated Thread (${threadResult.tweets.length} tweets):`);
    console.log('─'.repeat(60));
    threadResult.tweets.forEach((tweet, i) => {
        console.log(`${i + 1}/${threadResult.tweets.length} ${tweet}`);
        console.log('');
    });
    console.log(`🎨 Template Used: ${threadResult.template.type} - ${threadResult.template.description}`);
    console.log('');
    // Quality assessment
    console.log('🔍 QUALITY ASSESSMENT');
    console.log('====================\n');
    const qualityResult = await qualityGate.evaluateThread(threadResult.tweets);
    console.log(`📊 Overall Score: ${qualityResult.score.overallScore}/100`);
    console.log(`✅ Passes Quality Gate: ${qualityResult.passed ? 'YES' : 'NO'} (threshold: 80)`);
    if (qualityResult.autoRevised) {
        console.log(`🔄 Auto-Revised: YES`);
        console.log(`📝 Revised Content Available: ${qualityResult.revisedContent ? 'YES' : 'NO'}`);
    }
    console.log('\n📈 Score Breakdown:');
    console.log(`  🎯 Hook Clarity:   ${qualityResult.score.hookClarity}/25`);
    console.log(`  💡 Big Idea:       ${qualityResult.score.bigIdea}/15`);
    console.log(`  ⚡ Actionability:  ${qualityResult.score.actionability}/20`);
    console.log(`  ✨ Novelty:        ${qualityResult.score.novelty}/20`);
    console.log(`  📖 Readability:    ${qualityResult.score.readability}/10`);
    console.log(`  💬 Human Tone:     ${qualityResult.score.humanTone}/10`);
    console.log(`\n💭 Rationale: ${qualityResult.rationale}`);
    if (qualityResult.suggestions && qualityResult.suggestions.length > 0) {
        console.log('\n🔧 Improvement Suggestions:');
        qualityResult.suggestions.forEach((suggestion, i) => {
            console.log(`  ${i + 1}. ${suggestion}`);
        });
    }
}
async function runSingleDryRun(options) {
    console.log('📄 SINGLE POST GENERATION');
    console.log('========================\n');
    // For single posts, we'll generate a 1-tweet "thread"
    const composer = new threadComposer_1.ThreadComposer();
    const qualityGate = new qualityGate_1.QualityGate();
    console.log('⚡ Generating single post...');
    const threadResult = await composer.generateThread(options.topic, 'mini');
    const singleTweet = [threadResult.tweets[0]]; // Take just the first tweet
    console.log('\n📄 Generated Single Post:');
    console.log('─'.repeat(60));
    console.log(singleTweet[0]);
    console.log('');
    // Quality assessment
    console.log('🔍 QUALITY ASSESSMENT');
    console.log('====================\n');
    const qualityResult = await qualityGate.evaluateThread(singleTweet);
    console.log(`📊 Overall Score: ${qualityResult.score.overallScore}/100`);
    console.log(`✅ Passes Quality Gate: ${qualityResult.passed ? 'YES' : 'NO'} (threshold: 80)`);
    console.log('\n📈 Score Breakdown:');
    console.log(`  🎯 Hook Clarity:   ${qualityResult.score.hookClarity}/25`);
    console.log(`  💡 Big Idea:       ${qualityResult.score.bigIdea}/15`);
    console.log(`  ⚡ Actionability:  ${qualityResult.score.actionability}/20`);
    console.log(`  ✨ Novelty:        ${qualityResult.score.novelty}/20`);
    console.log(`  📖 Readability:    ${qualityResult.score.readability}/10`);
    console.log(`  💬 Human Tone:     ${qualityResult.score.humanTone}/10`);
    console.log(`\n💭 Rationale: ${qualityResult.rationale}`);
    if (qualityResult.suggestions && qualityResult.suggestions.length > 0) {
        console.log('\n🔧 Improvement Suggestions:');
        qualityResult.suggestions.forEach((suggestion, i) => {
            console.log(`  ${i + 1}. ${suggestion}`);
        });
    }
}
async function runReplyDryRun(options) {
    console.log('💬 REPLY GENERATION');
    console.log('==================\n');
    if (!options.targetTweet) {
        // Use default example
        options.targetTweet = 'I tried intermittent fasting for 30 days and lost 15 pounds. The hunger was intense the first week but got easier.';
        console.log('🎯 Using example target tweet (use --target-tweet to specify your own):');
    }
    console.log(`📝 Target Tweet: "${options.targetTweet}"`);
    console.log('');
    const replyEngine = new replyEngine_1.ReplyEngine();
    const qualityGate = new qualityGate_1.QualityGate();
    console.log('⚡ Analyzing target tweet...');
    try {
        const replyResult = await replyEngine.generateReply(options.targetTweet);
        console.log('\n🧠 Tweet Analysis:');
        console.log(`  📊 Health Relevance: ${Math.round(replyResult.analysis.healthRelevance * 100)}%`);
        console.log(`  📋 Post Type: ${replyResult.analysis.postType}`);
        console.log(`  🎯 Intent: ${replyResult.analysis.intent}`);
        console.log(`  🎭 Tonality: ${replyResult.analysis.tonality}`);
        console.log(`  🏷️  Key Topics: ${replyResult.analysis.keyTopics.join(', ')}`);
        console.log('\n💬 Generated Reply:');
        console.log('─'.repeat(60));
        console.log(replyResult.selectedReply);
        console.log(`\n📏 Length: ${replyResult.selectedReply.length}/220 characters`);
        console.log(`🧠 Reasoning: ${replyResult.reasoning}`);
        if (replyResult.alternatives.length > 0) {
            console.log('\n🔄 Alternative Replies:');
            replyResult.alternatives.forEach((alt, i) => {
                console.log(`  ${i + 1}. ${alt} (${alt.length} chars)`);
            });
        }
        // Quality assessment for the reply
        console.log('\n🔍 QUALITY ASSESSMENT');
        console.log('====================\n');
        const qualityResult = await qualityGate.evaluateReply(replyResult.selectedReply, options.targetTweet);
        console.log(`📊 Overall Score: ${qualityResult.score.overallScore}/100`);
        console.log(`✅ Passes Quality Gate: ${qualityResult.passed ? 'YES' : 'NO'} (threshold: 80)`);
        console.log(`💭 Rationale: ${qualityResult.rationale}`);
        if (qualityResult.suggestions && qualityResult.suggestions.length > 0) {
            console.log('\n🔧 Improvement Suggestions:');
            qualityResult.suggestions.forEach((suggestion, i) => {
                console.log(`  ${i + 1}. ${suggestion}`);
            });
        }
    }
    catch (error) {
        if (error.message.includes('not health-relevant enough')) {
            console.log('\n⚠️  Tweet rejected: Not health-relevant enough for reply');
            console.log('💡 Try a tweet about sleep, nutrition, exercise, stress, or other health topics');
        }
        else {
            throw error;
        }
    }
}
function showHelp() {
    console.log(`
🧪 xBOT Dry Run Content Generator

Usage: npm run dryrun:post [options]

Options:
  --type <type>          Content type: single, thread, reply (default: thread)
  --topic <topic>        Topic for generation (default: "sleep optimization")
  --template <template>  Thread template: mini, deep, checklist (optional)
  --target-tweet <text>  Target tweet for reply generation (required for replies)
  --help                 Show this help message

Examples:
  npm run dryrun:post
  npm run dryrun:post --type thread --topic "stress management" --template deep
  npm run dryrun:post --type single --topic "morning routine"
  npm run dryrun:post --type reply --target-tweet "I can't sleep at night"

Quality Scoring (0-100):
  • Hook Clarity (25pts): Specific, engaging opening
  • Big Idea (15pts): Single clear concept
  • Actionability (20pts): Concrete micro-steps
  • Novelty (20pts): Surprising insights, myth-busting
  • Readability (10pts): Short sentences, good formatting
  • Human Tone (10pts): Conversational, not lecture-y

Thresholds:
  • ≥80: Passes quality gate (will post)
  • 70-79: Auto-revision attempted
  • <70: Fails quality gate (won't post)
`);
}
if (require.main === module) {
    main().catch((err) => {
        console.error('💥 Dry run crashed:', err.message);
        process.exit(1);
    });
}
//# sourceMappingURL=dryrun-post.js.map