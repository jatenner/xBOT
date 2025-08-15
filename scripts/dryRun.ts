#!/usr/bin/env npx tsx

/**
 * Dry run script for testing the posting pipeline without actually posting
 */

import OpenAI from 'openai';
import { generateThread } from '../src/ai/threadGenerator';
import { scoreThread, formatQualityReport } from '../src/quality/qualityGate';
import { isDuplicateThread } from '../src/utils/dedupe';
import { config, validateEnvironment, logConfiguration } from '../src/config/environment';

async function dryRun(topic: string) {
  console.log('🧪 DRY RUN - Testing posting pipeline');
  console.log('=====================================');
  
  try {
    // Validate environment (lenient for dry run)
    validateEnvironment(true);
    logConfiguration();
    
    if (!process.env.OPENAI_API_KEY) {
      console.log('⚠️ OPENAI_API_KEY not found - skipping content generation');
      console.log('🧪 In production, this would generate a thread about:', topic);
      console.log(`📊 Quality threshold: ${config.QUALITY_MIN_SCORE}/100`);
      console.log('\n✅ Dry run completed (environment validation only)');
      return;
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!
    });

    console.log(`\n🎯 Topic: "${topic}"`);
    console.log(`📊 Quality threshold: ${config.QUALITY_MIN_SCORE}/100`);

    // Generate thread
    console.log('\n🧠 Generating thread...');
    const thread = await generateThread(topic, openai);
    
    console.log(`✅ Generated ${thread.tweets.length} tweets:`);
    console.log(`\n📌 Hook A (${thread.hook_A.length} chars):`);
    console.log(`   "${thread.hook_A}"`);
    console.log(`\n📌 Hook B (${thread.hook_B.length} chars):`);
    console.log(`   "${thread.hook_B}"`);
    
    thread.tweets.forEach((tweet, i) => {
      console.log(`\n📝 Tweet ${i + 1} (${tweet.text.length} chars):`);
      console.log(`   "${tweet.text}"`);
    });

    console.log(`\n🎯 CTA: "${thread.cta}"`);
    console.log(`📊 Metadata: ${thread.metadata.angle} | ${thread.metadata.pillar} | ${thread.metadata.evidence_mode}`);

    // Quality assessment - use built-in score
    console.log('\n🔍 Quality assessment:');
    const qualityReport = {
      score: thread.quality.score,
      reasons: thread.quality.reasons,
      dims: thread.quality.rubric,
      passed: thread.quality.score >= 90
    };
    console.log(formatQualityReport(qualityReport));
    
    if (qualityReport.passed) {
      console.log('✅ Would pass quality gate');
    } else {
      console.log('❌ Would fail quality gate');
    }

    // Deduplication check
    console.log('\n🔍 Checking for duplicates...');
    let isDuplicate = false;
    try {
      isDuplicate = await isDuplicateThread([{ text: thread.hook_A }, ...thread.tweets]);
    } catch (error) {
      console.log('⚠️ Duplicate check skipped (database not available)');
    }
    console.log(`${isDuplicate ? '❌' : '✅'} Duplicate check: ${isDuplicate ? 'DUPLICATE DETECTED' : 'UNIQUE CONTENT'}`);

    // Summary
    console.log('\n📋 SUMMARY:');
    console.log(`   Topic: ${thread.topic}`);
    console.log(`   Tweets: ${thread.tweets.length + 1} total`);
    console.log(`   Quality: ${qualityReport.score}/100 ${qualityReport.passed ? '✅' : '❌'}`);
    console.log(`   Unique: ${isDuplicate ? '❌' : '✅'}`);
    console.log(`   Threading: ${config.ENABLE_THREADS ? 'ENABLED' : 'DISABLED'}`);
    
    if (qualityReport.passed && !isDuplicate && config.ENABLE_THREADS) {
      console.log('\n🎉 WOULD POST SUCCESSFULLY');
    } else {
      console.log('\n🚫 WOULD NOT POST - see issues above');
    }

  } catch (error) {
    console.error('\n❌ Dry run failed:', error);
    process.exit(1);
  }
}

// Get topic from command line
const topic = process.argv[2];
if (!topic) {
  console.error('❌ Usage: npm run e2e:dry "topic"');
  console.error('   Example: npm run e2e:dry "Sleep routine for night owls"');
  process.exit(1);
}

dryRun(topic).catch(error => {
  console.error('Dry run error:', error);
  process.exit(1);
});
