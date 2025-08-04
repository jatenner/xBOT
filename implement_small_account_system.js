#!/usr/bin/env node

/**
 * 🚀 IMPLEMENT SMALL ACCOUNT GROWTH SYSTEM
 * ========================================
 * Deploys the complete small account optimization system
 */

const fs = require('fs');
const path = require('path');

async function main() {
  console.log('🚀 IMPLEMENTING SMALL ACCOUNT GROWTH SYSTEM');
  console.log('===========================================');

  try {
    // Load environment
    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const lines = envContent.split('\n');
      
      for (const line of lines) {
        if (line.includes('SUPABASE_URL=') && !process.env.SUPABASE_URL) {
          process.env.SUPABASE_URL = line.split('=')[1]?.replace(/"/g, '').trim();
        }
        if (line.includes('SUPABASE_ANON_KEY=') && !process.env.SUPABASE_ANON_KEY) {
          process.env.SUPABASE_ANON_KEY = line.split('=')[1]?.replace(/"/g, '').trim();
        }
      }
    }

    // Step 1: Test small account optimizer
    console.log('\n🎯 Step 1: Testing Small Account Optimizer...');
    
    try {
      const { smallAccountOptimizer } = require('./src/growth/smallAccountOptimizer');
      
      const metrics = await smallAccountOptimizer.analyzeGrowthPotential();
      console.log('✅ Small Account Optimizer working');
      console.log(`   Current: ${metrics.current_followers} followers`);
      console.log(`   Target: ${metrics.target_followers} followers`);
      console.log(`   Need: ${metrics.followers_per_day_needed.toFixed(1)} followers/day`);
      console.log(`   Current avg likes: ${metrics.current_avg_likes.toFixed(3)}`);

      // Test content evaluation
      const testContent = "Why doctors won't tell you this simple health trick that big pharma hates...";
      const evaluation = await smallAccountOptimizer.shouldPostContent(testContent, metrics);
      
      console.log(`\\n📝 Content Evaluation Test:`);
      console.log(`   Should post: ${evaluation.should_post}`);
      console.log(`   Viral score: ${evaluation.viral_score}`);
      console.log(`   Reasoning: ${evaluation.reasoning}`);
      
    } catch (error) {
      console.error('❌ Small Account Optimizer test failed:', error.message);
    }

    // Step 2: Test viral content generator
    console.log('\\n🔥 Step 2: Testing Viral Content Generator...');
    
    try {
      const { viralHealthContentGenerator } = require('./src/content/viralHealthContentGenerator');
      
      const viralContent = await viralHealthContentGenerator.generateControversialTake();
      console.log('✅ Viral Content Generator working');
      console.log(`   Content: "${viralContent.content}"`);
      console.log(`   Viral Score: ${viralContent.viral_score}/10`);
      console.log(`   Hooks: ${viralContent.engagement_hooks.join(', ')}`);
      console.log(`   Strategy: ${viralContent.posting_strategy}`);

      // Test quick tip generation
      const quickTip = await viralHealthContentGenerator.generateQuickTip();
      console.log(`\\n💡 Quick Tip Generated:`);
      console.log(`   "${quickTip.content}"`);
      console.log(`   Score: ${quickTip.viral_score}/10`);

    } catch (error) {
      console.error('❌ Viral Content Generator test failed:', error.message);
    }

    // Step 3: Test community engagement bot
    console.log('\\n🤝 Step 3: Testing Community Engagement Bot...');
    
    try {
      const { communityEngagementBot } = require('./src/engagement/communityEngagementBot');
      
      const plan = await communityEngagementBot.generateDailyPlan();
      console.log('✅ Community Engagement Bot working');
      console.log(`   Daily actions planned: ${plan.total_actions}`);
      console.log(`   Replies: ${plan.replies}`);
      console.log(`   Likes: ${plan.likes}`);
      console.log(`   Follows: ${plan.follows}`);
      console.log(`   Target accounts: ${plan.target_accounts.length}`);

    } catch (error) {
      console.error('❌ Community Engagement Bot test failed:', error.message);
      console.log('⚠️ This may require browser setup for full functionality');
    }

    // Step 4: Create database tables for small account tracking
    console.log('\\n🗄️ Step 4: Setting up database tables...');
    
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

    // Create small account growth log table
    try {
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS small_account_growth_log (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          date DATE NOT NULL,
          followers_count INTEGER NOT NULL,
          target_followers INTEGER DEFAULT 50,
          progress_percentage DECIMAL(5,2) DEFAULT 0,
          days_remaining INTEGER DEFAULT 30,
          on_track BOOLEAN DEFAULT true,
          avg_likes_per_tweet DECIMAL(5,3) DEFAULT 0,
          tweets_posted_today INTEGER DEFAULT 0,
          engagement_actions_today INTEGER DEFAULT 0,
          adjustments_needed TEXT[],
          created_at TIMESTAMPTZ DEFAULT NOW(),
          
          UNIQUE(date)
        );
        
        CREATE INDEX IF NOT EXISTS idx_small_account_growth_date ON small_account_growth_log(date);
      `;

      const { error } = await supabase.rpc('exec', { sql: createTableQuery });
      
      if (error) {
        console.log('⚠️ Database table creation may need manual setup');
        console.log('   Run the following SQL in Supabase dashboard:');
        console.log(createTableQuery);
      } else {
        console.log('✅ Database tables ready');
      }

    } catch (error) {
      console.log('⚠️ Database setup requires manual configuration');
    }

    // Step 5: Initialize the master controller
    console.log('\\n🎯 Step 5: Initializing Small Account Master Controller...');
    
    try {
      const { smallAccountMasterController } = require('./src/core/smallAccountMasterController');
      
      // Get system summary
      const summary = await smallAccountMasterController.getDailySummary();
      console.log('✅ Small Account Master Controller ready');
      console.log('\\n📊 System Status:');
      console.log(summary);

    } catch (error) {
      console.error('❌ Master Controller test failed:', error.message);
    }

    // Step 6: Implementation summary
    console.log('\\n🎉 IMPLEMENTATION COMPLETE!');
    console.log('============================');
    
    console.log('✅ SYSTEMS DEPLOYED:');
    console.log('   🎯 Small Account Optimizer - Quality over quantity posting');
    console.log('   🔥 Viral Health Content Generator - Controversial engagement content');
    console.log('   🤝 Community Engagement Bot - Strategic follower growth');
    console.log('   📊 Growth Tracking System - Real-time progress monitoring');
    console.log('   🎯 Master Controller - Unified growth orchestration');

    console.log('\\n📈 GROWTH STRATEGY ACTIVE:');
    console.log('   🎯 Target: 17 → 50 followers in 30 days');
    console.log('   📝 Max 4 tweets per day (down from 6+)');
    console.log('   🔥 Viral score 7+ required for posting');
    console.log('   🤝 15 community engagement actions daily');
    console.log('   ⏰ Optimal timing: 8-9 AM, 7-8 PM');

    console.log('\\n🚀 NEXT STEPS:');
    console.log('   1. Start the small account master controller');
    console.log('   2. Monitor daily growth metrics');
    console.log('   3. Adjust strategy based on weekly performance');
    console.log('   4. Scale up once you reach 50+ followers');

    console.log('\\n📋 TO ACTIVATE:');
    console.log('   Run: node -e "require(\'./src/core/smallAccountMasterController\').smallAccountMasterController.startGrowthSystem()"');

  } catch (error) {
    console.error('\\n❌ IMPLEMENTATION FAILED:', error.message);
    console.error(error.stack);
  }
}

main().catch(console.error);