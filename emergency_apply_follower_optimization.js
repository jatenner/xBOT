#!/usr/bin/env node

/**
 * 🚨 EMERGENCY: Apply Follower Optimization Settings
 * This script manually applies the quality gate optimizations
 * that should have been applied by migration but weren't
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function applyFollowerOptimization() {
  console.log('🚨 EMERGENCY: Applying follower optimization settings...');
  
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // 1. Lower quality gates for follower acquisition
    console.log('📊 Updating quality gate settings...');
    const { data: currentConfig, error: fetchError } = await supabase
      .from('bot_config')
      .select('value')
      .eq('key', 'runtime_config')
      .single();

    if (fetchError) {
      console.error('❌ Error fetching current config:', fetchError);
      return;
    }

    const updatedConfig = {
      ...currentConfig.value,
      // Lower quality gates
      quality: {
        readabilityMin: 35,  // Down from 55
        credibilityMin: 0.4,  // Down from 0.85
        factCountMin: 1,      // Keep at 1
      },
      // Remove URL/citation requirements
      requireUrl: false,
      requireCitation: false,
      // Increase posting frequency
      maxDailyTweets: 12,    // Up from 6
      // Set follower growth strategy
      postingStrategy: 'follower_growth',
      // Enable more aggressive posting
      fallbackStaggerMinutes: 60,  // Down from 90
    };

    const { error: updateError } = await supabase
      .from('bot_config')
      .update({ value: updatedConfig })
      .eq('key', 'runtime_config');

    if (updateError) {
      console.error('❌ Error updating config:', updateError);
      return;
    }

    console.log('✅ Quality gates optimized for follower acquisition!');
    console.log('📊 New settings:');
    console.log(`   • Readability: 55 → 35`);
    console.log(`   • Credibility: 0.85 → 0.4`);
    console.log(`   • Daily tweets: 6 → 12`);
    console.log(`   • URL required: true → false`);
    console.log(`   • Citation required: true → false`);
    console.log(`   • Strategy: balanced → follower_growth`);

    // 2. Create daily progress tracking table
    console.log('📋 Creating daily progress tracking...');
    const { error: tableError } = await supabase.rpc('execute_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS daily_progress (
          date DATE PRIMARY KEY DEFAULT CURRENT_DATE,
          followers_count INTEGER DEFAULT 0,
          tweets_posted INTEGER DEFAULT 0,
          total_impressions BIGINT DEFAULT 0,
          total_engagement INTEGER DEFAULT 0,
          success_rate NUMERIC(5,2) DEFAULT 0,
          f_per_1k NUMERIC(8,2) DEFAULT 0,
          notes TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );
        
        INSERT INTO daily_progress (date, followers_count, notes)
        VALUES (CURRENT_DATE, 0, 'Baseline - start of 10 follower challenge')
        ON CONFLICT (date) DO NOTHING;
      `
    });

    if (tableError) {
      console.log('⚠️ Table creation may have failed (might already exist):', tableError.message);
    } else {
      console.log('✅ Daily progress tracking table ready');
    }

    console.log('\n🎯 FOLLOWER OPTIMIZATION COMPLETE!');
    console.log('🚀 Bot should start posting more frequently within minutes');
    console.log('📊 Expected result: 8-12 tweets/day instead of 2-3');
    console.log('🎯 Goal: 10 followers by end of week');
    
  } catch (error) {
    console.error('💥 Emergency fix failed:', error);
  }
}

// Run the emergency fix
applyFollowerOptimization(); 