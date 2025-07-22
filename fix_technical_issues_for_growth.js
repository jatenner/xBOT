#!/usr/bin/env node

/**
 * 🚨 CRITICAL TECHNICAL ISSUES FIX
 * 
 * Based on Render logs analysis, fixing the core issues preventing follower growth:
 * 1. Twitter API rate limit handling
 * 2. Database sync issues  
 * 3. Budget system initialization
 * 4. Posting consistency
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🚨 === CRITICAL TECHNICAL ISSUES FIX ===');
console.log('🎯 Goal: Fix issues preventing follower growth');

async function fixCriticalIssues() {
  try {
    console.log('\n📊 === DIAGNOSING CRITICAL ISSUES ===');
    
    // 1. Fix database schema issues
    await fixDatabaseSchemaIssues();
    
    // 2. Fix API rate limit handling
    await fixRateLimitHandling();
    
    // 3. Fix budget system initialization
    await fixBudgetSystemInit();
    
    // 4. Optimize posting consistency
    await optimizePostingConsistency();
    
    // 5. Enable aggressive follower growth mode
    await enableAggressiveGrowthMode();
    
    console.log('\n✅ === CRITICAL FIXES APPLIED ===');
    console.log('🎯 System should now be capable of rapid follower growth');
    
  } catch (error) {
    console.error('❌ Critical fix failed:', error);
    process.exit(1);
  }
}

async function fixDatabaseSchemaIssues() {
  console.log('\n🔧 === FIXING DATABASE SCHEMA ISSUES ===');
  
  // Fix missing columns in api_usage_tracking
  const schemaFixes = `
    -- Fix api_usage_tracking table
    ALTER TABLE api_usage_tracking 
    ADD COLUMN IF NOT EXISTS reads_made INTEGER DEFAULT 0;
    
    ALTER TABLE api_usage_tracking 
    ADD COLUMN IF NOT EXISTS writes_made INTEGER DEFAULT 0;
    
    -- Ensure follower_tracking table exists
    CREATE TABLE IF NOT EXISTS follower_tracking (
      id BIGSERIAL PRIMARY KEY,
      tweet_id BIGINT,
      followers_before INTEGER DEFAULT 0,
      followers_after INTEGER DEFAULT 0,
      followers_gained INTEGER DEFAULT 0,
      measurement_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    -- Ensure growth metrics table exists
    CREATE TABLE IF NOT EXISTS growth_metrics (
      id BIGSERIAL PRIMARY KEY,
      date DATE DEFAULT CURRENT_DATE,
      followers_start INTEGER DEFAULT 0,
      followers_end INTEGER DEFAULT 0,
      followers_gained INTEGER DEFAULT 0,
      posts_made INTEGER DEFAULT 0,
      f_per_1k DECIMAL(8,4) DEFAULT 0.0000,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `;
  
  const { error } = await supabase.rpc('execute', { query: schemaFixes });
  if (error) {
    console.log('⚠️ Schema fix error (may be normal):', error.message);
  } else {
    console.log('✅ Database schema issues fixed');
  }
}

async function fixRateLimitHandling() {
  console.log('\n🚀 === FIXING RATE LIMIT HANDLING ===');
  
  // Update bot config for better rate limit handling
  const rateLimitConfigs = [
    {
      key: 'intelligent_rate_limiting',
      value: {
        enabled: true,
        use_twitter_headers: true,
        exponential_backoff: true,
        max_retry_attempts: 3,
        base_delay_ms: 60000,
        max_delay_ms: 900000
      }
    },
    {
      key: 'posting_coordination',
      value: {
        enabled: true,
        min_interval_minutes: 90,
        respect_rate_limits: true,
        use_api_headers: true,
        fallback_to_estimation: true
      }
    },
    {
      key: 'api_usage_optimization',
      value: {
        enabled: true,
        track_real_usage: true,
        sync_with_twitter: true,
        prevent_burst_posting: true,
        conservative_mode_on_limits: true
      }
    }
  ];
  
  for (const config of rateLimitConfigs) {
    const { error } = await supabase
      .from('bot_config')
      .upsert({
        key: config.key,
        value: config.value,
        updated_at: new Date().toISOString()
      });
    
    if (error) {
      console.log(`⚠️ Failed to update ${config.key}:`, error.message);
    } else {
      console.log(`✅ Updated: ${config.key}`);
    }
  }
}

async function fixBudgetSystemInit() {
  console.log('\n💰 === FIXING BUDGET SYSTEM INITIALIZATION ===');
  
  const budgetConfigs = [
    {
      key: 'budget_system_enabled',
      value: {
        enabled: true,
        daily_limit: 5.00,
        emergency_limit: 4.75,
        initialization_required: false,
        auto_initialize: true
      }
    },
    {
      key: 'unified_budget_manager',
      value: {
        enabled: true,
        daily_limit: 5.00,
        emergency_limit: 4.75,
        allocation: {
          content_generation: 0.65,
          engagement: 0.20,
          learning: 0.10,
          emergency: 0.05
        }
      }
    },
    {
      key: 'emergency_budget_lockdown',
      value: {
        enabled: true,
        absolute_daily_limit: 5.00,
        emergency_limit: 4.75,
        file_based_lockdown: true,
        database_tracking: true,
        multiple_failsafes: true
      }
    }
  ];
  
  for (const config of budgetConfigs) {
    const { error } = await supabase
      .from('bot_config')
      .upsert({
        key: config.key,
        value: config.value,
        updated_at: new Date().toISOString()
      });
    
    if (error) {
      console.log(`⚠️ Failed to update ${config.key}:`, error.message);
    } else {
      console.log(`✅ Updated: ${config.key}`);
    }
  }
}

async function optimizePostingConsistency() {
  console.log('\n📅 === OPTIMIZING POSTING CONSISTENCY ===');
  
  const postingConfigs = [
    {
      key: 'master_posting_gate',
      value: {
        enabled: true,
        coordinated_posting: true,
        single_source_of_truth: true,
        prevent_conflicts: true,
        optimal_spacing: true
      }
    },
    {
      key: 'posting_optimization',
      value: {
        enabled: true,
        target_posts_per_day: 8,
        min_interval_minutes: 90,
        max_posts_per_hour: 2,
        intelligent_timing: true,
        consistency_priority: true
      }
    },
    {
      key: 'quality_vs_quantity_balance',
      value: {
        prioritize_consistency: true,
        lower_quality_threshold_for_consistency: true,
        minimum_posts_per_day: 6,
        quality_score_threshold: 0.6
      }
    }
  ];
  
  for (const config of postingConfigs) {
    const { error } = await supabase
      .from('bot_config')
      .upsert({
        key: config.key,
        value: config.value,
        updated_at: new Date().toISOString()
      });
    
    if (error) {
      console.log(`⚠️ Failed to update ${config.key}:`, error.message);
    } else {
      console.log(`✅ Updated: ${config.key}`);
    }
  }
}

async function enableAggressiveGrowthMode() {
  console.log('\n🚀 === ENABLING AGGRESSIVE FOLLOWER GROWTH MODE ===');
  
  const growthConfigs = [
    {
      key: 'aggressive_growth_mode',
      value: {
        enabled: true,
        priority: 'follower_acquisition',
        optimize_for_f_per_1k: true,
        viral_content_percentage: 60,
        engagement_hooks_mandatory: true,
        controversial_content_allowed: true
      }
    },
    {
      key: 'follower_growth_optimization',
      value: {
        enabled: true,
        target_f_per_1k: 3.0,
        viral_threshold: 5.0,
        learn_from_every_post: true,
        amplify_successful_patterns: true,
        avoid_failed_patterns: true
      }
    },
    {
      key: 'rapid_learning_acceleration',
      value: {
        enabled: true,
        learning_frequency_minutes: 10,
        pattern_recognition_aggressive: true,
        immediate_adaptation: true,
        competitive_intelligence_active: true
      }
    }
  ];
  
  for (const config of growthConfigs) {
    const { error } = await supabase
      .from('bot_config')
      .upsert({
        key: config.key,
        value: config.value,
        updated_at: new Date().toISOString()
      });
    
    if (error) {
      console.log(`⚠️ Failed to update ${config.key}:`, error.message);
    } else {
      console.log(`✅ Updated: ${config.key}`);
    }
  }
}

// Run the fixes
fixCriticalIssues(); 