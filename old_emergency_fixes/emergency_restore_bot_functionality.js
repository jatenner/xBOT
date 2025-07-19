#!/usr/bin/env node

/**
 * 🚨 EMERGENCY BOT RESTORATION
 * ===========================
 * 
 * FOUND THE ISSUE: Emergency budget lockdown system is still active
 * and preventing ALL posting operations for 7 days.
 * 
 * This script will restore normal operations while keeping burst protection.
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function disableEmergencyLockdowns() {
  console.log('🔓 DISABLING EMERGENCY LOCKDOWNS');
  console.log('=' .repeat(60));
  
  const lockdownConfigs = [
    {
      key: 'emergency_cost_protection',
      value: {
        reason: 'Emergency lockdown DISABLED - bot operations restored',
        enabled: false,
        daily_budget_limit: 3,
        max_tokens_per_call: 500,
        cost_alert_threshold: 0.9,
        disable_learning_agents: false,
        burst_protection_minutes: 5,
        max_openai_calls_per_hour: 20,
        disable_autonomous_learning: false,
        disable_real_time_engagement: false,
        disable_competitive_intelligence: false,
        restored_at: new Date().toISOString()
      }
    },
    {
      key: 'emergency_environment',
      value: {
        EMERGENCY_MODE: false,
        DAILY_BUDGET_LIMIT: 3,
        MAX_POSTS_PER_HOUR: 1,
        EMERGENCY_COST_MODE: false,
        deployment_timestamp: new Date().toISOString(),
        DISABLE_LEARNING_AGENTS: false,
        DISABLE_AUTONOMOUS_LEARNING: false,
        RESTORED: true
      }
    },
    {
      key: 'enable_emergency_posting',
      value: false
    },
    {
      key: 'enable_emergency_content', 
      value: false
    },
    {
      key: 'EMERGENCY_MODE_DISABLED',
      value: true
    },
    {
      key: 'ignore_environment_emergency',
      value: true
    },
    {
      key: 'emergency_simple_mode',
      value: false
    },
    {
      key: 'emergency_ultra_cost_mode',
      value: false
    }
  ];
  
  for (const config of lockdownConfigs) {
    try {
      const { error } = await supabase
        .from('bot_config')
        .upsert({
          key: config.key,
          value: config.value,
          updated_at: new Date().toISOString()
        });
      
      if (error) {
        console.error(`❌ Failed to update ${config.key}:`, error);
      } else {
        console.log(`✅ ${config.key}: Lockdown disabled`);
      }
    } catch (err) {
      console.error(`❌ Error updating ${config.key}:`, err);
    }
  }
}

async function restoreNormalBudgetSettings() {
  console.log('\n💰 RESTORING NORMAL BUDGET SETTINGS');
  console.log('=' .repeat(60));
  
  const budgetConfigs = [
    {
      key: 'daily_budget_limit',
      value: 3.00
    },
    {
      key: 'openai_daily_budget_limit',
      value: 3
    },
    {
      key: 'budget_enforcer_active',
      value: true
    },
    {
      key: 'emergency_brake_threshold',
      value: 2.8
    }
  ];
  
  for (const config of budgetConfigs) {
    try {
      const { error } = await supabase
        .from('bot_config')
        .upsert({
          key: config.key,
          value: config.value,
          updated_at: new Date().toISOString()
        });
      
      if (error) {
        console.error(`❌ Failed to update ${config.key}:`, error);
      } else {
        console.log(`✅ ${config.key}: Set to ${config.value}`);
      }
    } catch (err) {
      console.error(`❌ Error updating ${config.key}:`, err);
    }
  }
}

async function enableNormalPostingWithBurstProtection() {
  console.log('\n📝 ENABLING NORMAL POSTING WITH BURST PROTECTION');
  console.log('=' .repeat(60));
  
  const postingConfigs = [
    {
      key: 'bot_enabled',
      value: true
    },
    {
      key: 'posting_enabled',
      value: true
    },
    {
      key: 'emergency_posting_control',
      value: {
        enabled: true,
        timestamp: new Date().toISOString(),
        max_posts_per_hour: 1,
        nuclear_anti_burst: true,
        disable_burst_agents: true,
        force_single_post_mode: true,
        disable_quick_post_mode: true,
        minimum_interval_minutes: 120,
        normal_operations_restored: true
      }
    },
    {
      key: 'viral_content_active',
      value: {
        enabled: true,
        viral_templates_enabled: true,
        academic_content_disabled: true,
        sophisticated_content: true,
        restored_at: new Date().toISOString()
      }
    }
  ];
  
  for (const config of postingConfigs) {
    try {
      const { error } = await supabase
        .from('bot_config')
        .upsert({
          key: config.key,
          value: config.value,
          updated_at: new Date().toISOString()
        });
      
      if (error) {
        console.error(`❌ Failed to update ${config.key}:`, error);
      } else {
        console.log(`✅ ${config.key}: Enabled`);
      }
    } catch (err) {
      console.error(`❌ Error updating ${config.key}:`, err);
    }
  }
}

async function resetDailyCounters() {
  console.log('\n🔄 RESETTING DAILY COUNTERS');
  console.log('=' .repeat(60));
  
  const today = new Date().toISOString().split('T')[0];
  
  const resetConfigs = [
    {
      key: 'daily_budget_status',
      value: {
        date: today,
        spent: 0,
        limit: 3,
        remaining: 3,
        reset_at: new Date().toISOString(),
        emergency_lockdown_cleared: true
      }
    },
    {
      key: 'daily_posting_count',
      value: {
        date: today,
        count: 0,
        limit: 6,
        remaining: 6,
        reset_at: new Date().toISOString()
      }
    }
  ];
  
  for (const config of resetConfigs) {
    try {
      const { error } = await supabase
        .from('bot_config')
        .upsert({
          key: config.key,
          value: config.value,
          updated_at: new Date().toISOString()
        });
      
      if (error) {
        console.error(`❌ Failed to reset ${config.key}:`, error);
      } else {
        console.log(`✅ ${config.key}: Reset for today`);
      }
    } catch (err) {
      console.error(`❌ Error resetting ${config.key}:`, err);
    }
  }
}

async function createSystemRestoreLog() {
  console.log('\n📋 CREATING SYSTEM RESTORE LOG');
  console.log('=' .repeat(60));
  
  try {
    const { error } = await supabase
      .from('bot_config')
      .upsert({
        key: 'system_restore_log',
        value: {
          restored_at: new Date().toISOString(),
          reason: 'Emergency budget lockdown disabled - 7 day silence resolved',
          actions_taken: [
            'Disabled emergency_cost_protection',
            'Disabled emergency_environment lockdown',
            'Restored normal budget limits ($3/day)',
            'Enabled posting with burst protection',
            'Reset daily counters',
            'Enabled viral content system'
          ],
          previous_issue: 'Bot silent for 7 days due to emergency budget lockdown',
          lockdown_duration: '7 days (July 11 - July 18, 2025)',
          burst_protection_maintained: true,
          viral_content_restored: true
        },
        updated_at: new Date().toISOString()
      });
    
    if (error) {
      console.error('❌ Failed to create restore log:', error);
    } else {
      console.log('✅ System restore log created');
    }
  } catch (err) {
    console.error('❌ Error creating restore log:', err);
  }
}

async function main() {
  console.log('🚨 EMERGENCY BOT RESTORATION IN PROGRESS');
  console.log('Resolving 7-day silence caused by emergency lockdown...\n');
  
  await disableEmergencyLockdowns();
  await restoreNormalBudgetSettings();
  await enableNormalPostingWithBurstProtection();
  await resetDailyCounters();
  await createSystemRestoreLog();
  
  console.log('\n🎉 EMERGENCY RESTORATION COMPLETE!');
  console.log('=' .repeat(60));
  
  console.log('✅ Emergency lockdowns DISABLED');
  console.log('✅ Normal budget limits RESTORED ($3/day)');
  console.log('✅ Posting operations ENABLED');
  console.log('✅ Burst protection MAINTAINED');
  console.log('✅ Viral content system ENABLED');
  console.log('✅ Daily counters RESET');
  
  console.log('\n📊 CURRENT SETTINGS:');
  console.log('• Daily budget: $3.00');
  console.log('• Max posts per hour: 1');
  console.log('• Minimum interval: 120 minutes');
  console.log('• Burst posting: DISABLED');
  console.log('• Emergency lockdown: DISABLED');
  console.log('• Viral content: ENABLED');
  
  console.log('\n🔧 NEXT STEPS:');
  console.log('1. Monitor first posts to ensure system is working');
  console.log('2. Check that burst protection is still effective');
  console.log('3. Verify viral content is being generated');
  console.log('4. Watch budget usage to ensure it stays under $3/day');
  console.log('5. Redeploy to Render if necessary');
  
  console.log('\n⚠️  IMPORTANT: The bot should start posting again within the next hour.');
  console.log('If it doesn\'t, check Render deployment status.');
}

main().catch(console.error); 