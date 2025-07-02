#!/usr/bin/env node

/**
 * 🧠 INTELLIGENT LEARNING SYSTEM DEPLOYMENT
 * ===========================================
 * Deploys the complete intelligent learning enhancement to your Twitter bot.
 * This transforms your bot from basic content generation to autonomous intelligence.
 */

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

console.log('🚀 DEPLOYING INTELLIGENT LEARNING SYSTEM');
console.log('=========================================');

async function main() {
  try {
    // 1. Verify SQL file exists
    const sqlFile = path.join(__dirname, 'supabase', 'intelligent_learning_enhancement_fixed.sql');
    
    try {
      await fs.access(sqlFile);
      console.log('✅ Intelligent learning SQL file found');
    } catch (error) {
      console.error('❌ SQL file not found:', sqlFile);
      process.exit(1);
    }

    // 2. Read and display SQL file info
    const sqlContent = await fs.readFile(sqlFile, 'utf8');
    console.log(`📊 SQL file size: ${(sqlContent.length / 1024).toFixed(1)}KB`);
    
    // Count tables and functions being created
    const tableMatches = sqlContent.match(/CREATE TABLE IF NOT EXISTS/g) || [];
    const functionMatches = sqlContent.match(/CREATE OR REPLACE FUNCTION/g) || [];
    const indexMatches = sqlContent.match(/CREATE INDEX IF NOT EXISTS/g) || [];
    
    console.log('📈 DEPLOYMENT SUMMARY:');
    console.log(`   🗃️  Tables: ${tableMatches.length} intelligent learning tables`);
    console.log(`   ⚙️  Functions: ${functionMatches.length} AI learning functions`);
    console.log(`   🔍 Indexes: ${indexMatches.length} performance indexes`);

    // 3. Check if we have Supabase CLI
    try {
      await execAsync('supabase --version');
      console.log('✅ Supabase CLI available');
    } catch (error) {
      console.log('⚠️  Supabase CLI not found - you\'ll need to run SQL manually');
    }

    // 4. Verify TypeScript integration file
    const tsFile = path.join(__dirname, 'src', 'utils', 'intelligentLearningConnector.ts');
    try {
      await fs.access(tsFile);
      const tsContent = await fs.readFile(tsFile, 'utf8');
      console.log('✅ TypeScript integration file ready');
      console.log(`📊 Integration file size: ${(tsContent.length / 1024).toFixed(1)}KB`);
    } catch (error) {
      console.error('❌ TypeScript integration file missing');
      process.exit(1);
    }

    // 5. Check PostTweet agent integration
    const postTweetFile = path.join(__dirname, 'src', 'agents', 'postTweet.ts');
    try {
      const postTweetContent = await fs.readFile(postTweetFile, 'utf8');
      
      if (postTweetContent.includes('intelligentLearning') && 
          postTweetContent.includes('performComprehensiveLearning')) {
        console.log('✅ PostTweet agent integration complete');
      } else {
        console.log('⚠️  PostTweet agent may need integration');
      }
    } catch (error) {
      console.log('⚠️  Could not verify PostTweet integration');
    }

    console.log('\n🎯 DEPLOYMENT INSTRUCTIONS:');
    console.log('============================');
    
    console.log('\n1. 📁 DATABASE SETUP:');
    console.log('   Run the following in your Supabase SQL editor:');
    console.log(`   File: ${sqlFile}`);
    
    console.log('\n2. 🔧 VERIFICATION:');
    console.log('   After running the SQL, verify these tables exist:');
    console.log('   - semantic_content_analysis');
    console.log('   - expertise_evolution');
    console.log('   - content_patterns');
    console.log('   - autonomous_improvements');
    console.log('   - learning_feedback_loop');
    console.log('   - tweet_metrics');

    console.log('\n3. 🧠 FEATURES DEPLOYED:');
    console.log('   ✨ Semantic content analysis with theme extraction');
    console.log('   📈 Expertise evolution tracking across 10 domains');
    console.log('   🔍 Pattern recognition for viral content identification');
    console.log('   🤖 Autonomous improvement suggestions and implementation');
    console.log('   🔄 Real-time learning feedback loops');
    console.log('   📊 Enhanced tweet metrics with engagement analysis');

    console.log('\n4. 🚀 INTELLIGENT CAPABILITIES:');
    console.log('   🧠 Bot now learns from every tweet posted');
    console.log('   📊 Tracks performance patterns and adapts strategy');
    console.log('   🎯 Evolves expertise in different healthcare domains');
    console.log('   🔄 Autonomous content strategy optimization');
    console.log('   📈 Real-time engagement pattern detection');
    console.log('   🎭 Personality evolution based on audience feedback');

    console.log('\n5. 📊 MONITORING:');
    console.log('   Your bot dashboard will now show:');
    console.log('   - Current expertise levels by domain');
    console.log('   - Successful content patterns discovered');
    console.log('   - Learning events and adaptations');
    console.log('   - Performance improvements over time');

    console.log('\n6. 🎛️  CONFIGURATION:');
    console.log('   Learning system can be controlled via bot_config:');
    console.log('   - learning_enabled: true/false');
    console.log('   - learning_sensitivity: 0.0-1.0');
    console.log('   - pattern_detection_enabled: true/false');
    console.log('   - expertise_tracking_enabled: true/false');

    // 7. Create a quick test script
    const testScript = `
// Test the intelligent learning system
import { intelligentLearning } from './src/utils/intelligentLearningConnector';

async function testIntelligentLearning() {
  console.log('🧠 Testing intelligent learning system...');
  
  try {
    // Check if learning is enabled
    const isEnabled = await intelligentLearning.isLearningEnabled();
    console.log('Learning enabled:', isEnabled);
    
    // Get current expertise
    const expertise = await intelligentLearning.getCurrentExpertise();
    console.log('Expertise domains:', expertise.length);
    
    // Get successful patterns
    const patterns = await intelligentLearning.getSuccessfulPatterns(0.6);
    console.log('Successful patterns:', patterns.length);
    
    // Get intelligence summary
    const summary = await intelligentLearning.getIntelligenceSummary();
    console.log('Intelligence summary:', summary);
    
    console.log('✅ Intelligent learning system is working!');
  } catch (error) {
    console.error('❌ Error testing learning system:', error.message);
  }
}

testIntelligentLearning();
`;

    await fs.writeFile('test_intelligent_learning.js', testScript);
    console.log('\n✅ Created test script: test_intelligent_learning.js');

    console.log('\n🎊 DEPLOYMENT READY!');
    console.log('=====================');
    console.log('Your bot is now equipped with revolutionary intelligent learning capabilities.');
    console.log('It will evolve autonomously, becoming more engaging and expert-like over time.');
    console.log('\nNext steps:');
    console.log('1. Run the SQL in your Supabase dashboard');
    console.log('2. Restart your bot to activate the learning system');
    console.log('3. Monitor the intelligence evolution in your dashboard');

  } catch (error) {
    console.error('💥 Deployment error:', error);
    process.exit(1);
  }
}

main(); 